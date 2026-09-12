// Per-workspace MCP settings store tests (feature-tools-dynamic-workspace-1).
//
// Covers provisioning from mcp.servers.json, workspace isolation, the
// enable/disable (no delete) toggle, and custom-server creation.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

const DB = '/tmp/compagnon-mcp-store-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let listWorkspaceServers: typeof import('../mcp-store')['listWorkspaceServers'];
let getEnabledServerIds: typeof import('../mcp-store')['getEnabledServerIds'];
let listCustomServers: typeof import('../mcp-store')['listCustomServers'];
let getWorkspaceServerSecrets: typeof import('../mcp-store')['getWorkspaceServerSecrets'];
let getWorkspaceServerSettings: typeof import('../mcp-store')['getWorkspaceServerSettings'];
let setServerEnabled: typeof import('../mcp-store')['setServerEnabled'];
let updateServerConfig: typeof import('../mcp-store')['updateServerConfig'];
let upsertServer: typeof import('../mcp-store')['upsertServer'];
let loadMcpServersConfig: typeof import('../../mcp/config')['loadMcpServersConfig'];

describe('MCP per-workspace settings store', () => {
  beforeAll(async () => {
    ({
      listWorkspaceServers,
      getEnabledServerIds,
      listCustomServers,
      getWorkspaceServerSecrets,
      getWorkspaceServerSettings,
      setServerEnabled,
      updateServerConfig,
      upsertServer,
    } = await import('../mcp-store'));
    ({ loadMcpServersConfig } = await import('../../mcp/config'));
  });

  it('provisions one row per server declared in mcp.servers.json', async () => {
    const declared = loadMcpServersConfig().servers;
    const servers = await listWorkspaceServers('ws-provision');

    expect(servers).toHaveLength(declared.length);
    for (const server of declared) {
      const row = servers.find((s) => s.id === server.id);
      expect(row).toBeDefined();
      expect(row?.kind).toBe('config');
      expect(row?.enabled).toBe(server.enabled !== false);
    }
  });

  it('isolates enable/disable between workspaces', async () => {
    const first = loadMcpServersConfig().servers[0].id;

    const updated = await setServerEnabled('ws-a', first, false);
    expect(updated?.enabled).toBe(false);

    const wsAServers = await listWorkspaceServers('ws-a');
    expect(wsAServers.find((s) => s.id === first)?.enabled).toBe(false);

    const wsBServers = await listWorkspaceServers('ws-b');
    expect(wsBServers.find((s) => s.id === first)?.enabled).toBe(true);
  });

  it('getEnabledServerIds returns only enabled ids for the workspace', async () => {
    const first = loadMcpServersConfig().servers[0].id;

    const idsA = await getEnabledServerIds('ws-a');
    const idsB = await getEnabledServerIds('ws-b');

    expect(idsA).not.toContain(first);
    expect(idsB).toContain(first);
  });

  it('returns null when toggling an unknown server', async () => {
    const result = await setServerEnabled('ws-a', 'does-not-exist', true);
    expect(result).toBeNull();
  });

  it('creates a custom server and lists it per workspace', async () => {
    const created = await upsertServer({
      workspaceId: 'ws-a',
      type: 'stdio',
      name: 'my-tools',
      command: 'npx',
      args: ['-y', 'mcp-bridge'],
      agents: ['companion', 'research'],
    });

    expect(created.kind).toBe('custom');
    expect(created.enabled).toBe(true);

    const wsA = await listWorkspaceServers('ws-a');
    const wsB = await listWorkspaceServers('ws-b');

    expect(wsA.some((s) => s.id === created.id)).toBe(true);
    expect(wsB.some((s) => s.id === created.id)).toBe(false);

    const customs = await listCustomServers('ws-a', ['research']);
    expect(customs.some((s) => s.id === created.id)).toBe(true);

    const otherAgents = await listCustomServers('ws-a', ['planner']);
    expect(otherAgents.some((s) => s.id === created.id)).toBe(false);
  });

  it('stores per-workspace env and encrypted secrets without leaking values', async () => {
    const updated = await updateServerConfig('ws-secrets', 'filesystem', {
      env: { COMPANION_WORKSPACE_ROOTS: '/custom/roots' },
      secrets: { GITHUB_TOKEN: 'ghp_workspace-token' },
    });

    expect(updated).not.toBeNull();
    const publicServer = updated!;
    expect(publicServer.env).toEqual({ COMPANION_WORKSPACE_ROOTS: '/custom/roots' });
    expect(publicServer.secretKeys).toContain('GITHUB_TOKEN');
    const serialized = JSON.stringify(publicServer);
    expect(serialized).not.toContain('ghp_workspace-token');

    const secrets = await getWorkspaceServerSecrets('ws-secrets', 'filesystem');
    expect(secrets.GITHUB_TOKEN).toBe('ghp_workspace-token');

    const settings = await getWorkspaceServerSettings('ws-secrets');
    expect(settings['filesystem'].secrets.GITHUB_TOKEN).toBe('ghp_workspace-token');
    expect(settings['filesystem'].env.COMPANION_WORKSPACE_ROOTS).toBe('/custom/roots');
  });

  it('keeps the override isolated to its workspace and deletes a secret when set to ""', async () => {
    const empty = await updateServerConfig('ws-secrets', 'filesystem', { env: {}, secrets: { GITHUB_TOKEN: '' } });
    expect(empty?.secretKeys).not.toContain('GITHUB_TOKEN');

    const otherWs = await getWorkspaceServerSecrets('ws-b', 'filesystem');
    expect(otherWs.GITHUB_TOKEN).toBeUndefined();

    const serverInOther = await getWorkspaceServerSettings('ws-b');
    expect(serverInOther['filesystem'].env.COMPANION_WORKSPACE_ROOTS).toBeUndefined();
  });
});