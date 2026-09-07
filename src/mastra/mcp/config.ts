import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export interface McpOptionalArgs {
  whenEnv: string;
  args: string[];
}

export interface McpOAuthConfig {
  provider: 'mcp';
  redirectUrl: string | URL;
  clientName: string;
}

export interface McpServerConfig {
  id: string;
  enabled?: boolean;
  agents: string[];
  type: 'stdio' | 'url';
  command?: string;
  args?: string[];
  optionalArgs?: McpOptionalArgs[];
  env?: Record<string, string>;
  inheritDefaultEnv?: boolean;
  url?: string;
  headers?: Record<string, string>;
  allowedHosts?: string[];
  requiredEnv?: string[];
  timeout?: number;
  forwardInstructions?: boolean;
  auth?: McpOAuthConfig;
}

export interface McpServersConfig {
  global?: {
    timeout?: number;
    connectRetries?: number;
    retryDelayMs?: number;
  };
  servers: McpServerConfig[];
}

const PLACEHOLDER_REGEX = /\{\{([A-Z0-9_]+)(?::([^}]*))?\}\}/g;

const MISSING_VAR_PATTERN = /\{\{[A-Z0-9_]+(?::[^}]*)?\}\}/g;

export function resolveEnv(name: string, fallback?: string): string {
  return process.env[name] ?? fallback ?? '';
}

export function interpolate(value: string): string {
  return value.replace(
    PLACEHOLDER_REGEX,
    (_match: string, name: string, fallback?: string) => resolveEnv(name, fallback),
  );
}

export function envHasPlaceholders(value: string): boolean {
  return MISSING_VAR_PATTERN.test(value);
}

export function expandArgs(args: string[]): string[] {
  const expanded: string[] = [];

  for (const raw of args) {
    const standalone = raw.match(/^\{\{([A-Z0-9_]+)(?::([^}]*))?\}\}$/);

    if (standalone) {
      const value = resolveEnv(standalone[1], standalone[2]);

      if (value === '') {
        continue;
      }

      if (value.includes(',')) {
        const parts = value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);

        if (parts.length) {
          expanded.push(...parts);
        }

        continue;
      }

      expanded.push(value);
      continue;
    }

    const value = interpolate(raw);

    if (value !== '') {
      expanded.push(value);
    }
  }

  return expanded;
}

export function buildArgs(config: McpServerConfig): string[] {
  const args = expandArgs(config.args ?? []);

  for (const optional of config.optionalArgs ?? []) {
    if (process.env[optional.whenEnv]) {
      args.push(...expandArgs(optional.args));
    }
  }

  return args;
}

export function mapEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, interpolate(value)]));
}

export function isMcpServerEnabled(config: McpServerConfig): boolean {
  if (config.enabled === false) {
    return false;
  }

  if (config.requiredEnv?.some((name) => !process.env[name])) {
    return false;
  }

  return true;
}

export function getMcpServersForAgent(config: McpServersConfig, agentId: string): McpServerConfig[] {
  return config.servers.filter(
    (server) => server.agents?.includes(agentId) && isMcpServerEnabled(server),
  );
}

let resolvedConfigPath: string | undefined;

function resolveMcpConfigPath(): string {
  if (resolvedConfigPath) {
    return resolvedConfigPath;
  }

  const explicit = process.env.COMPANION_MCP_CONFIG;

  if (explicit) {
    resolvedConfigPath = resolve(process.cwd(), explicit);
    return resolvedConfigPath;
  }

  // Walk up from the current working directory: the dev server may run the
  // bundled app with a different cwd (e.g. src/mastra/public) than the
  // project root where mcp.servers.json lives.
  let dir = process.cwd();

  for (;;) {
    const candidate = join(dir, 'mcp.servers.json');

    if (existsSync(candidate)) {
      resolvedConfigPath = candidate;
      return resolvedConfigPath;
    }

    const parent = dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  resolvedConfigPath = resolve(process.cwd(), 'mcp.servers.json');
  return resolvedConfigPath;
}

export function loadMcpServersConfig(): McpServersConfig {
  const configPath = resolveMcpConfigPath();

  const raw = readFileSync(configPath, 'utf-8');

  return JSON.parse(raw) as McpServersConfig;
}