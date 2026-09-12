// Per-workspace MCP server settings (feature-tools-dynamic-workspace-1).
//
// mcp.servers.json is the declarative default source of truth; this store
// mirrors it on a per-workspace basis so each workspace can independently
// enable/disable (no delete) a server or register its own custom server.
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

import { decryptObject, encryptObject } from '../config/crypto';
import { loadMcpServersConfig } from './config';

export type McpServerKind = 'config' | 'custom';
export type McpServerType = 'url' | 'stdio';

export type WorkspaceMcpServer = {
  id: string;
  workspaceId: string;
  kind: McpServerKind;
  type: McpServerType;
  name: string;
  url: string | null;
  command: string | null;
  args: string[];
  headers: Record<string, string>;
  agents: string[];
  requiredEnv: string[];
  env: Record<string, string>;
  secretKeys: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ServerRow = Record<string, unknown>;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

let initialized: Promise<void> | undefined;

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS compagnon_mcp_servers (
      workspace_id TEXT NOT NULL,
      id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'config',
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      command TEXT,
      args_json TEXT,
      headers_json TEXT,
      agents_json TEXT,
      required_env_json TEXT,
      env_json TEXT NOT NULL DEFAULT '{}',
      encrypted_secrets_json TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, id)
    )
  `);

  const info = await db.execute('PRAGMA table_info(compagnon_mcp_servers)');
  const columnNames = (info.rows as unknown as Array<{ name: string }>).map((r) => r.name);
  if (!columnNames.includes('env_json')) {
    await db.execute("ALTER TABLE compagnon_mcp_servers ADD COLUMN env_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!columnNames.includes('encrypted_secrets_json')) {
    await db.execute('ALTER TABLE compagnon_mcp_servers ADD COLUMN encrypted_secrets_json TEXT');
  }
}

function ready(): Promise<void> {
  initialized ??= init();
  return initialized;
}

function json(value: unknown, fallback: unknown): unknown {
  if (value == null) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toServer(row: ServerRow): WorkspaceMcpServer {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    kind: String(row.kind) as McpServerKind,
    type: String(row.type) as McpServerType,
    name: String(row.name),
    url: row.url ? String(row.url) : null,
    command: row.command ? String(row.command) : null,
    args: (json(row.args_json, []) as string[]) ?? [],
    headers: (json(row.headers_json, {}) as Record<string, string>) ?? {},
    agents: (json(row.agents_json, []) as string[]) ?? [],
    requiredEnv: (json(row.required_env_json, []) as string[]) ?? [],
    env: (json(row.env_json, {}) as Record<string, string>) ?? {},
    secretKeys: Object.keys(decryptObject(row.encrypted_secrets_json ? String(row.encrypted_secrets_json) : null)),
    enabled: Number(row.enabled) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Decrypt the per-workspace secret overrides stored for a server row. */
function secretsOf(row: ServerRow): Record<string, unknown> {
  return decryptObject(row.encrypted_secrets_json ? String(row.encrypted_secrets_json) : null);
}

/**
 * Seed every server declared in mcp.servers.json into this workspace
 * (INSERT OR IGNORE keeps any prior edit the user made).
 */
export async function provisionWorkspaceServers(workspaceId: string): Promise<void> {
  await ready();
  const config = loadMcpServersConfig();
  const now = new Date().toISOString();

  for (const server of config.servers) {
    const url = server.type === 'url' ? server.url : null;
    const command = server.type === 'stdio' ? server.command : null;
    await db.execute({
      sql: `INSERT OR IGNORE INTO compagnon_mcp_servers
        (workspace_id, id, kind, type, name, url, command, args_json, headers_json, agents_json, required_env_json, enabled, created_at, updated_at)
        VALUES (?, ?, 'config', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        workspaceId,
        server.id,
        server.type,
        server.id,
        url ?? null,
        command ?? null,
        JSON.stringify(server.args ?? []),
        JSON.stringify(server.headers ?? {}),
        JSON.stringify(server.agents ?? []),
        JSON.stringify(server.requiredEnv ?? []),
        server.enabled === false ? 0 : 1,
        now,
        now,
      ],
    });
  }
}

export async function listWorkspaceServers(workspaceId: string): Promise<WorkspaceMcpServer[]> {
  await provisionWorkspaceServers(workspaceId);
  const result = await db.execute({
    sql: 'SELECT * FROM compagnon_mcp_servers WHERE workspace_id = ?',
    args: [workspaceId],
  });
  return (result.rows as unknown as ServerRow[])
    .map(toServer)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'config' ? -1 : 1));
}

/** Ids of the servers enabled for this workspace (effective tool-loading set). */
export async function getEnabledServerIds(workspaceId: string): Promise<string[]> {
  await provisionWorkspaceServers(workspaceId);
  const result = await db.execute({
    sql: 'SELECT id FROM compagnon_mcp_servers WHERE workspace_id = ? AND enabled = 1',
    args: [workspaceId],
  });
  return (result.rows as unknown as Array<{ id: unknown }>).map((r) => String(r.id));
}

/** User-created servers for a workspace, optionally narrowed to wanted agent ids. */
export async function listCustomServers(workspaceId: string, agentIds?: string[]): Promise<WorkspaceMcpServer[]> {
  await ready();
  const result = await db.execute({
    sql: "SELECT * FROM compagnon_mcp_servers WHERE workspace_id = ? AND kind = 'custom' AND enabled = 1",
    args: [workspaceId],
  });
  const wanted = agentIds ? new Set(agentIds) : null;
  return (result.rows as unknown as ServerRow[])
    .map(toServer)
    .filter((server) => !wanted || server.agents.some((agentId) => wanted.has(agentId)));
}

/** env + decrypted secrets of every server of a workspace, keyed by server id. */
export async function getWorkspaceServerSettings(workspaceId: string): Promise<
  Record<
    string,
    {
      env: Record<string, string>;
      secrets: Record<string, unknown>;
      command: string | null;
      args: string[] | null;
      url: string | null;
    }
  >
> {
  await ready();
  const result = await db.execute({
    sql: 'SELECT id, command, args_json, url, env_json, encrypted_secrets_json FROM compagnon_mcp_servers WHERE workspace_id = ?',
    args: [workspaceId],
  });
  const settings: Record<
    string,
    {
      env: Record<string, string>;
      secrets: Record<string, unknown>;
      command: string | null;
      args: string[] | null;
      url: string | null;
    }
  > = {};
  for (const row of result.rows as unknown as ServerRow[]) {
    settings[String(row.id)] = {
      env: (json(row.env_json, {}) as Record<string, string>) ?? {},
      secrets: row.encrypted_secrets_json ? secretsOf(row) : {},
      command: typeof row.command === 'string' ? row.command : null,
      args: row.args_json ? (json(row.args_json, []) as string[]) ?? null : null,
      url: typeof row.url === 'string' && row.url !== '' ? row.url : null,
    };
  }
  return settings;
}

/** Enable/disable a server for a workspace. No delete operation (REQ-002). */
export async function setServerEnabled(workspaceId: string, id: string, enabled: boolean): Promise<WorkspaceMcpServer | null> {
  await provisionWorkspaceServers(workspaceId);
  const result = await db.execute({
    sql: 'UPDATE compagnon_mcp_servers SET enabled = ?, updated_at = ? WHERE workspace_id = ? AND id = ?',
    args: [enabled ? 1 : 0, new Date().toISOString(), workspaceId, id],
  });
  if (Number(result.rowsAffected) === 0) return null;
  return getWorkspaceServer(workspaceId, id);
}

export async function getWorkspaceServer(workspaceId: string, id: string): Promise<WorkspaceMcpServer | null> {
  await ready();
  const result = await db.execute({
    sql: 'SELECT * FROM compagnon_mcp_servers WHERE workspace_id = ? AND id = ?',
    args: [workspaceId, id],
  });
  const row = result.rows[0] as unknown as ServerRow | undefined;
  return row ? toServer(row) : null;
}

/** Decrypted per-workspace secret overrides for a server. */
export async function getWorkspaceServerSecrets(
  workspaceId: string,
  id: string,
): Promise<Record<string, unknown>> {
  await ready();
  const result = await db.execute({
    sql: 'SELECT encrypted_secrets_json FROM compagnon_mcp_servers WHERE workspace_id = ? AND id = ?',
    args: [workspaceId, id],
  });
  const row = result.rows[0] as unknown as ServerRow | undefined;
  return row ? secretsOf(row) : {};
}

/**
 * Update a workspace server's runtime settings (url/command/env/secrets/...).
 * env and secrets are merged into the stored overrides; a secret value set to
 * "" removes that key. No delete operation (REQ-002).
 */
export async function updateServerConfig(
  workspaceId: string,
  id: string,
  patch: {
    name?: string;
    url?: string | null;
    command?: string | null;
    args?: string[];
    headers?: Record<string, string>;
    agents?: string[];
    env?: Record<string, string>;
    secrets?: Record<string, unknown>;
  },
): Promise<WorkspaceMcpServer | null> {
  await provisionWorkspaceServers(workspaceId);
  const existing = await getWorkspaceServer(workspaceId, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const url = patch.url !== undefined ? patch.url : existing.url;
  const command = patch.command !== undefined ? patch.command : existing.command;
  // env is a full replacement when provided (the UI sends the whole env map, so
  // a removed row really removes the variable). Secrets are merged beneath.
  const env = patch.env !== undefined ? { ...patch.env } : existing.env;
  const currentSecrets = await getWorkspaceServerSecrets(workspaceId, id);
  const secrets: Record<string, unknown> = { ...currentSecrets };
  for (const [key, value] of Object.entries(patch.secrets ?? {})) {
    if (value === '' || value === undefined || value === null) {
      delete secrets[key];
    } else {
      secrets[key] = value;
    }
  }

  await db.execute({
    sql: `UPDATE compagnon_mcp_servers SET
      name = ?, url = ?, command = ?, args_json = ?, headers_json = ?, agents_json = ?,
      env_json = ?, encrypted_secrets_json = ?, updated_at = ?
      WHERE workspace_id = ? AND id = ?`,
    args: [
      patch.name ?? existing.name,
      url,
      command,
      JSON.stringify(patch.args ?? existing.args),
      JSON.stringify(patch.headers ?? existing.headers),
      JSON.stringify(patch.agents ?? existing.agents),
      JSON.stringify(env),
      encryptObject(secrets),
      now,
      workspaceId,
      id,
    ],
  });

  return getWorkspaceServer(workspaceId, id);
}

export async function upsertServer(input: {
  id?: string;
  workspaceId: string;
  type: McpServerType;
  name: string;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  agents?: string[];
  requiredEnv?: string[];
  env?: Record<string, string>;
  secrets?: Record<string, unknown>;
}): Promise<WorkspaceMcpServer> {
  await ready();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const url = input.type === 'url' ? input.url ?? null : null;
  const command = input.type === 'stdio' ? input.command ?? null : null;

  await db.execute({
    sql: `INSERT OR REPLACE INTO compagnon_mcp_servers
      (workspace_id, id, kind, type, name, url, command, args_json, headers_json, agents_json, required_env_json, env_json, encrypted_secrets_json, enabled, created_at, updated_at)
      VALUES (?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.workspaceId,
      id,
      input.type,
      input.name,
      url,
      command,
      JSON.stringify(input.args ?? []),
      JSON.stringify(input.headers ?? {}),
      JSON.stringify(input.agents ?? ['companion']),
      JSON.stringify(input.requiredEnv ?? []),
      JSON.stringify(input.env ?? {}),
      encryptObject(input.secrets ?? {}),
      1,
      now,
      now,
    ],
  });

  const server = await getWorkspaceServer(input.workspaceId, id);
  if (!server) throw new Error('Failed to create MCP server.');
  return server;
}