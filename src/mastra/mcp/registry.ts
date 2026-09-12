import {
  MCPClient,
  MCPOAuthClientProvider,
  type MastraMCPServerDefinition,
  type OAuthStorage,
} from '@mastra/mcp';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import {
  type McpServerConfig,
  buildArgs,
  getMcpServersForAgent,
  interpolate,
  loadMcpServersConfig,
  mapEnv,
} from './config';
import { getEnabledServerIds, getWorkspaceServerSettings, listCustomServers, type WorkspaceMcpServer } from './mcp-store';

const DEFAULT_CONNECT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minimal file-backed OAuth token store so Notion (or any OAuth MCP server)
 * keeps its tokens across process restarts and per workspace (each workspace
 * can connect its own account). Tokens are kept outside the repository under
 * the user's home directory and never committed.
 *
 * Legacy layout (~/.compagnon/oauth/<server>.json, single-workspace) is read
 * as a fallback for the default workspace so existing authorizations survive.
 */
function buildOAuthStorage(serverId: string, workspaceId = 'default'): OAuthStorage {
  const dir = join(homedir(), '.compagnon', 'oauth', workspaceId);
  const file = join(dir, `${serverId}.json`);
  const legacyFile = join(homedir(), '.compagnon', 'oauth-workspace-legacy', `${workspaceId}-${serverId}.json`);

  let cache: Record<string, string> | undefined;

  function load(): Record<string, string> {
    if (cache) return cache;
    cache = {};
    for (const candidate of [file, legacyFile]) {
      try {
        if (existsSync(candidate)) {
          cache = { ...cache, ...(JSON.parse(readFileSync(candidate, 'utf-8')) as Record<string, string>) };
        }
      } catch {
        // malformed or missing, try next source
      }
    }
    return cache;
  }

  function persist(): void {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify(load()), 'utf-8');
    } catch (error) {
      console.warn(
        `[Compagnon] MCP "${serverId}": could not persist OAuth tokens:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    set(key, value) {
      load()[key] = value;
      persist();
    },
    get(key) {
      return load()[key];
    },
    delete(key) {
      delete load()[key];
      persist();
    },
  };
}

/**
 * Build the provider that powers an OAuth-protected remote MCP server.
 * Kept outside buildServerDefinition so the provider (and its persisted
 * token storage) survives disconnect/retry cycles within loadServerTools.
 */
function buildOAuthProvider(config: McpServerConfig, workspaceId = 'default'): MCPOAuthClientProvider | null {
  const auth = config.auth;

  if (!auth || auth.provider !== 'mcp') {
    return null;
  }

  const redirectUrl = interpolate(String(auth.redirectUrl));

  return new MCPOAuthClientProvider({
    redirectUrl,
    clientMetadata: {
      redirect_uris: [redirectUrl],
      client_name: auth.clientName,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    storage: buildOAuthStorage(config.id, workspaceId),
    onRedirectToAuthorization: (url) => {
      console.log(
        `[Compagnon] MCP "${config.id}" (workspace "${workspaceId}") requires authorization. Please open in your browser:\n  ${url.toString()}`,
      );
      openInBrowser(config.id, url.toString());
    },
  });
}

/**
 * Opens an authorization URL in the user's default browser (new tab), falling
 * back to just logging the URL when no desktop opener is available (headless
 * server, CI, or a machine without a display). Fire-and-forget: a failure to
 * open the browser must never block the OAuth flow, since the URL is always
 * printed for manual copy.
 */
function openInBrowser(serverId: string, url: string): void {
  let command: string;
  const args: string[] = [];

  switch (process.platform) {
    case 'darwin':
      command = 'open';
      args.push(url);
      break;
    case 'win32':
      command = 'cmd';
      args.push('/c', 'start', '', url);
      break;
    default:
      command = 'xdg-open';
      args.push(url);
      break;
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {
      // Browser opener unavailable (headless server / no DISPLAY): the flow
      // still works via the printed authorization URL.
    });
    child.unref();
  } catch (error) {
    console.warn(
      `[Compagnon] MCP "${serverId}": could not open the browser automatically (${error instanceof Error ? error.message : error}). Use the URL above.`,
    );
  }
}

function buildServerDefinition(
  config: McpServerConfig,
  overrides?: Record<string, string>,
  workspaceId = 'default',
): MastraMCPServerDefinition | null {
  if (config.type === 'stdio') {
    const command = interpolate(config.command ?? '', overrides);

    if (command === '') {
      console.warn(`[Compagnon] MCP "${config.id}": empty command, skipping.`);
      return null;
    }

    const definition: MastraMCPServerDefinition = {
      command,
      args: buildArgs(config, overrides),
      ...(config.env ? { env: mapEnv(config.env, overrides) } : {}),
      ...(config.inheritDefaultEnv !== undefined
        ? { inheritDefaultEnv: config.inheritDefaultEnv }
        : {}),
      ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
      ...(config.forwardInstructions !== undefined
        ? { forwardInstructions: config.forwardInstructions }
        : {}),
    };

    return definition;
  }

  const urlString = interpolate(config.url ?? '', overrides);

  if (urlString === '') {
    console.warn(`[Compagnon] MCP "${config.id}": empty URL, skipping.`);
    return null;
  }

  let url: URL;

  try {
    url = new URL(urlString);
  } catch (error) {
    console.warn(
      `[Compagnon] MCP "${config.id}": invalid URL "${urlString}", skipping.`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const oauthProvider = buildOAuthProvider(config, workspaceId);

  return {
    url,
    ...(config.headers
      ? { requestInit: { headers: mapEnv(config.headers, overrides ?? {}) } }
      : {}),
    ...(config.allowedHosts ? { allowedHosts: config.allowedHosts } : {}),
    ...(oauthProvider ? { authProvider: oauthProvider } : {}),
    ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
    ...(config.forwardInstructions !== undefined
      ? { forwardInstructions: config.forwardInstructions }
      : {}),
  };
}

async function loadServerTools(
  config: McpServerConfig,
  global: { connectRetries?: number; retryDelayMs?: number; timeout?: number },
  workspaceId = 'default',
  overrides?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const definition = buildServerDefinition(config, overrides, workspaceId);

  if (!definition) {
    return {};
  }

  const oauthProvider = buildOAuthProvider(config, workspaceId);

  // OAuth servers must not block the boot when the user has not connected
  // yet. If there are no persisted valid tokens, degrade to an empty tool set:
  // the user connects later (e.g. via the notion_connect tool), which persists
  // tokens for future runs.
  if (oauthProvider) {
    let hasTokens = false;
    try {
      hasTokens = await oauthProvider.hasValidTokens();
    } catch {
      hasTokens = false;
    }

    if (!hasTokens) {
      console.log(
        `[Compagnon] MCP "${config.id}" is not authorized yet; skipping OAuth tool load. Connect it to use it.`,
      );
      return {};
    }
  }

  const maxAttempts = global.connectRetries ?? DEFAULT_CONNECT_RETRIES;
  const retryDelayMs = global.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Scope the client so a failed attempt can be cleanly disconnected
    // before the next one, preventing orphan child processes from writing
    // to a closed stdio pipe (EPIPE / "Connection closed" flakiness).
    let client: MCPClient | undefined;

    try {
      client = new MCPClient({
        id: `compagnon-${config.id}`,
        servers: {
          [config.id]: definition,
        },
        ...(global.timeout !== undefined ? { timeout: global.timeout } : {}),
      });

      // For OAuth servers, listTools may surface a "needs-auth" state instead
      // of throwing. Drive the interactive flow once, then retry the listing.
      if (oauthProvider) {
        if (client.getServerAuthState(config.id) === 'needs-auth') {
          await client.authenticate(config.id);
        }
      }

      const tools = await client.listTools();

      console.log(
        `[Compagnon] MCP "${config.id}" connected successfully (attempt ${attempt}/${maxAttempts}).`,
      );

      return tools;
    } catch (error) {
      lastError = error;

      console.warn(
        `[Compagnon] MCP "${config.id}" attempt ${attempt}/${maxAttempts} failed:`,
        error instanceof Error ? error.message : error,
      );

      try {
        await client?.disconnect();
      } catch {
        // Ignore disconnect errors on already-failed clients.
      }

      if (attempt < maxAttempts) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  console.warn(
    `[Compagnon] MCP "${config.id}" unavailable after ${maxAttempts} attempts:`,
    lastError instanceof Error ? lastError.message : lastError,
  );

  return {};
}

/**
 * True when the configured OAuth server currently holds valid tokens that the
 * boot path would honor. Unlike file existence, this distinguishes a completed
 * authorization from an interrupted one (e.g. registered client + code_verifier
 * persisted but no access token exchanged).
 */
export async function hasValidOAuthTokens(workspaceId: string, serverId: string): Promise<boolean> {
  const config = loadMcpServersConfig();
  const server = config.servers.find((s) => s.id === serverId);

  if (!server) {
    return false;
  }

  const provider = buildOAuthProvider(server, workspaceId);

  if (!provider) {
    return false;
  }

  try {
    return await provider.hasValidTokens();
  } catch {
    return false;
  }
}

/**
 * Revoke a server's OAuth authorization: clears the persisted tokens, client
 * info and code verifier from the file-backed store, so the tools stop loading
 * on the next resolution and the server must be authorized again to be used.
 * Server-side revocation (removing the integration on the provider's side)
 * stays the user's action where the provider requires it (e.g. Notion).
 */
export async function disconnectOAuthServer(workspaceId: string, serverId: string): Promise<boolean> {
  const config = loadMcpServersConfig();
  const server = config.servers.find((s) => s.id === serverId);

  if (!server) {
    return false;
  }

  const provider = buildOAuthProvider(server, workspaceId);

  if (!provider) {
    return false;
  }

  try {
    await provider.clear();
    return true;
  } catch (error) {
    console.warn(
      `[Compagnon] MCP "${serverId}": could not clear OAuth tokens:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** Flatten a server row's env + decrypted secrets into interpolation overrides. */
function serverOverrides(
  settings: { env?: Record<string, string>; secrets?: Record<string, unknown> } | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...(settings?.env ?? {}) };
  for (const [key, value] of Object.entries(settings?.secrets ?? {})) {
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

/**
 * Overlay a workspace row onto a config-file server so per-workspace edits are
 * actually honored at load time: a workspace that reconfigures the SSH server
 * for another machine replaces `command`/`args` and adds its `env` without
 * changing mcp.servers.json or the other workspaces (REQ-003b).
 */
function withRowOverrides(
  config: McpServerConfig,
  row: { command?: string | null; args?: string[] | null; env?: Record<string, string>; url?: string | null } | undefined,
): McpServerConfig {
  if (!row) return config;
  const merged: McpServerConfig = { ...config };

  if (row.command) merged.command = row.command;
  if (row.args && row.args.length > 0) merged.args = row.args;
  if (row.url) merged.url = row.url;
  if (row.env && Object.keys(row.env).length > 0) {
    merged.env = { ...(config.env ?? {}), ...row.env };
  }

  return merged;
}

export async function getMcpToolsForAgent(
  workspaceId: string,
  agentId: string,
  scopeOverrides?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const config = loadMcpServersConfig();
  const enabledIds = new Set(await getEnabledServerIds(workspaceId));
  const settings = await getWorkspaceServerSettings(workspaceId);

  const servers = getMcpServersForAgent(config, agentId);
  const tools: Record<string, unknown> = {};

  for (const server of servers) {
    if (!enabledIds.has(server.id)) continue;
    Object.assign(
      tools,
      await loadServerTools(
        withRowOverrides(server, settings[server.id]),
        config.global ?? {},
        workspaceId,
        { ...serverOverrides(settings[server.id]), ...scopeOverrides },
      ),
    );
  }

  for (const custom of await listCustomServers(workspaceId, [agentId])) {
    Object.assign(
      tools,
      await loadServerTools(
        toConfig(custom),
        config.global ?? {},
        workspaceId,
        { ...serverOverrides(settings[custom.id]), ...scopeOverrides },
      ),
    );
  }

  return tools;
}

/**
 * Load the union of MCP tools for several agent ids (used by the workspace
 * runtime so the companion only exposes MCP servers whose agent is enabled for
 * that workspace). Servers are de-duplicated by id. The per-workspace enabled
 * state from the MCP settings store is the effective gate (enabling a server
 * in one workspace never leaks into another).
 *
 * `scopeOverrides` lets a project-scoped caller re-root workspace-level servers
 * (e.g. the `filesystem` server's `{{COMPANION_WORKSPACE_ROOTS}}`) to the
 * project path so a project session cannot escape it. Scope overrides win over
 * the workspace server settings.
 */
export async function getMcpToolsForAgents(
  workspaceId: string,
  agentIds: string[],
  scopeOverrides?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const config = loadMcpServersConfig();
  const wanted = new Set(agentIds);
  const enabledIds = new Set(await getEnabledServerIds(workspaceId));
  const settings = await getWorkspaceServerSettings(workspaceId);

  const servers = config.servers.filter(
    (server) => server.agents?.some((agentId) => wanted.has(agentId)) && enabledIds.has(server.id),
  );

  const tools: Record<string, unknown> = {};
  for (const server of servers) {
    Object.assign(
      tools,
      await loadServerTools(
        withRowOverrides(server, settings[server.id]),
        config.global ?? {},
        workspaceId,
        { ...serverOverrides(settings[server.id]), ...scopeOverrides },
      ),
    );
  }

  for (const custom of await listCustomServers(workspaceId, agentIds)) {
    Object.assign(
      tools,
      await loadServerTools(
        toConfig(custom),
        config.global ?? {},
        workspaceId,
        { ...serverOverrides(settings[custom.id]), ...scopeOverrides },
      ),
    );
  }

  return tools;
}

/** Map a workspace-scoped server row to a config loadable by the registry. */
function toConfig(server: WorkspaceMcpServer): McpServerConfig {
  return {
    id: server.id,
    agents: server.agents,
    type: server.type,
    command: server.command ?? undefined,
    args: server.args,
    url: server.url ?? undefined,
    headers: server.headers,
    env: server.env,
  };
}

/**
 * Explicitly establish an OAuth connection to an MCP server configured with an
 * `auth` block. Runs the interactive authorization flow (opening the browser /
 * printing the URL) and persists the resulting tokens so subsequent boots load
 * the tools automatically. Returns the server's tools once connected.
 *
 * Used for one-time setup of OAuth-protected servers such as Notion.
 */
export async function connectOAuthServer(workspaceId: string, serverId: string): Promise<Record<string, unknown>> {
  const config = loadMcpServersConfig();
  const server = config.servers.find((s) => s.id === serverId);

  if (!server) {
    throw new Error(`[Compagnon] MCP "${serverId}": no such server in mcp.servers.json.`);
  }

  const provider = buildOAuthProvider(server, workspaceId);
  if (!provider) {
    throw new Error(`[Compagnon] MCP "${serverId}": server is not configured for OAuth.`);
  }

  const definition = buildServerDefinition(server, undefined, workspaceId);
  if (!definition) {
    throw new Error(`[Compagnon] MCP "${serverId}": could not build server definition.`);
  }

  if (!('url' in definition && definition.url instanceof URL)) {
    throw new Error(`[Compagnon] MCP "${serverId}": OAuth requires an HTTP (url) server.`);
  }

  const timeout = config.global?.timeout;

  const client = new MCPClient({
    id: `compagnon-${serverId}`,
    servers: {
      [serverId]: definition,
    },
    ...(timeout !== undefined ? { timeout } : {}),
  });

  // Force a connection attempt so the server can signal "needs-auth".
  try {
    try {
      await client.listTools();
    } catch {
      // connection rejection expected before authorization
    }

    if (client.getServerAuthState(serverId) === 'needs-auth') {
      await client.authenticate(serverId);
    }
  } finally {
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
  }

  console.log(`[Compagnon] MCP "${serverId}" authorized. Reloading tools…`);

  // Reconnect fresh now that tokens are persisted and load the tools.
  const toolsClient = new MCPClient({
    id: `compagnon-${serverId}`,
    servers: {
      [serverId]: definition,
    },
    ...(timeout !== undefined ? { timeout } : {}),
  });

  const tools = await toolsClient.listTools();
  await toolsClient.disconnect().catch(() => undefined);
  return tools;
}