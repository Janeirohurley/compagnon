// Tools catalogue endpoints tests (feature-tools-dynamic-workspace-1).
//
// Covers GET /tools shape (workspace-scoped, secret-free), the enable/disable
// toggles (no delete) for MCP servers and plugins, and the custom-server POST.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

const DB = '/tmp/compagnon-tools-routes-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let toolsRoutes: typeof import('../tools-routes')['toolsRoutes'];
let upsertConnection: typeof import('../../connections/connection-store')['upsertConnection'];
let loadMcpServersConfig: typeof import('../../mcp/config')['loadMcpServersConfig'];

type Handler = (c: unknown) => Promise<Response>;

function findRoute(method: string, path: string): Handler {
  const route = toolsRoutes.find((r) => r.method === method && r.path === path);
  if (!route) throw new Error(`route ${method} ${path} not found`);
  return route.handler as Handler;
}

function ctx(workspaceId: string, body?: unknown, params: Record<string, string> = {}) {
  return {
    req: {
      header: () => workspaceId,
      param: (key: string) => params[key],
      json: async () => body,
    },
  };
}

describe('Tools routes', () => {
  beforeAll(async () => {
    ({ toolsRoutes } = await import('../tools-routes'));
    ({ upsertConnection } = await import('../../connections/connection-store'));
    ({ loadMcpServersConfig } = await import('../../mcp/config'));
  });

  it('GET /tools returns workspace-scoped servers without secrets', async () => {
    const res = await findRoute('GET', '/tools')(ctx('ws-tools'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.servers)).toBe(true);
    expect(Array.isArray(body.plugins)).toBe(true);
    expect(body.servers).toHaveLength(loadMcpServersConfig().servers.length);

    const forbidden = ['secrets', 'headers'];
    for (const server of body.servers) {
      for (const key of forbidden) {
        expect(server).not.toHaveProperty(key);
      }
      expect(server).toHaveProperty('enabled');
      expect(Array.isArray(server.requiredEnv)).toBe(true);
      expect(Array.isArray(server.requiredEnvMissing)).toBe(true);
      expect(server).toHaveProperty('env');
      expect(Array.isArray(server.secretKeys)).toBe(true);
      expect(JSON.stringify(server)).not.toContain('ghp_');
    }
  });

  it('GET /tools flags OAuth servers and their per-workspace authorization state', async () => {
    const res = await findRoute('GET', '/tools')(ctx('ws-auth-check'));
    expect(res.status).toBe(200);
    const servers = (await res.json()).servers as Array<{ id: string; auth: boolean; authorized: boolean }>;

    const notion = servers.find((s) => s.id === 'notion');
    expect(notion?.auth).toBe(true);
    expect(typeof notion?.authorized).toBe('boolean');

    const filesystem = servers.find((s) => s.id === 'filesystem');
    expect(filesystem?.auth).toBe(false);
    expect(filesystem?.authorized).toBe(false);
  });

  it('POST /tools/mcp/:serverId/connect rejects unknown or non-OAuth servers', async () => {
    const unknown = await findRoute('POST', '/tools/mcp/:serverId/connect')(ctx('ws-a', {}, { serverId: 'nope' }));
    expect(unknown.status).toBe(400);

    const nonOAuth = await findRoute('POST', '/tools/mcp/:serverId/connect')(ctx('ws-a', {}, { serverId: 'github' }));
    expect(nonOAuth.status).toBe(400);
    expect((await nonOAuth.json()).error).toContain('OAuth');
  });

  it('POST /tools/mcp/:serverId/disconnect is a no-op for unknown servers', async () => {
    const res = await findRoute('POST', '/tools/mcp/:serverId/disconnect')(
      ctx('ws-a', {}, { serverId: 'nope' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).disconnected).toBe(false);
  });

  it('enable/disable a server is per-workspace (no delete)', async () => {
    const first = loadMcpServersConfig().servers[0].id;

    const toggle = await findRoute('PATCH', '/tools/mcp/:serverId')(
      ctx('ws-toggle', { enabled: false }, { serverId: first }),
    );
    expect(toggle.status).toBe(200);
    expect((await toggle.json()).enabled).toBe(false);

    const wsToogled = await findRoute('GET', '/tools')(ctx('ws-toggle'));
    const wsOther = await findRoute('GET', '/tools')(ctx('ws-other'));

    const a = (await wsToogled.json()).servers as Array<{ id: string; enabled: boolean }>;
    const b = (await wsOther.json()).servers as Array<{ id: string; enabled: boolean }>;
    expect(a.find((s) => s.id === first)?.enabled).toBe(false);
    expect(b.find((s) => s.id === first)?.enabled).toBe(true);
  });

  it('PATCH /tools/mcp validates body and 404s unknown servers', async () => {
    const res = await findRoute('PATCH', '/tools/mcp/:serverId')(
      ctx('ws-a', { enabled: 'yes' }, { serverId: 'x' }),
    );
    expect(res.status).toBe(400);

    const missing = await findRoute('PATCH', '/tools/mcp/:serverId')(
      ctx('ws-a', { enabled: true }, { serverId: 'nope' }),
    );
    expect(missing.status).toBe(404);
  });

  it('POST /tools/mcp creates a custom server for the request workspace', async () => {
    const res = await findRoute('POST', '/tools/mcp')(
      ctx('ws-new', {
        type: 'url',
        name: 'local-llm',
        url: 'http://localhost:11434',
        env: { MODEL: 'llama3' },
        secrets: { API_KEY: 'sk-custom' },
      }),
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.kind).toBe('custom');
    expect(created.name).toBe('local-llm');
    expect(created.env.MODEL).toBe('llama3');
    expect(created.secretKeys).toContain('API_KEY');
    expect(JSON.stringify(created)).not.toContain('sk-custom');

    const inWorkspace = await findRoute('GET', '/tools')(ctx('ws-new'));
    const servers = (await inWorkspace.json()).servers as Array<{ id: string }>;
    expect(servers.some((s) => s.id === created.id)).toBe(true);
  });

  it('PATCH /tools/mcp with config updates env and secrets per workspace', async () => {
    const first = loadMcpServersConfig().servers[0].id;

    const res = await findRoute('PATCH', '/tools/mcp/:serverId')(
      ctx('ws-cfg', { config: { env: { FOO: 'bar' }, secrets: { GITHUB_TOKEN: 'ghp_other-account' } } }, { serverId: first }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.env.FOO).toBe('bar');
    expect(body.secretKeys).toContain('GITHUB_TOKEN');
    expect(JSON.stringify(body)).not.toContain('ghp_other-account');

    const otherWs = await findRoute('GET', '/tools')(ctx('ws-cfg-other'));
    const otherServer = (await otherWs.json()).servers.find((s: { id: string }) => s.id === first);
    expect(otherServer.env.FOO).toBeUndefined();
    expect(otherServer.secretKeys).not.toContain('GITHUB_TOKEN');
  });

  it('POST /tools/mcp rejects invalid input', async () => {
    const noType = await findRoute('POST', '/tools/mcp')(ctx('ws-a', { name: 'x' }));
    expect(noType.status).toBe(400);

    const noUrl = await findRoute('POST', '/tools/mcp')(ctx('ws-a', { type: 'url', name: 'x' }));
    expect(noUrl.status).toBe(400);

    const noCommand = await findRoute('POST', '/tools/mcp')(ctx('ws-a', { type: 'stdio', name: 'x' }));
    expect(noCommand.status).toBe(400);
  });

  it('PATCH /tools/plugins toggles a connection for the workspace', async () => {
    const connection = (await upsertConnection({
      workspaceId: 'ws-plugins',
      provider: 'github',
      name: 'GitHub',
    }))!;

    const res = await findRoute('PATCH', '/tools/plugins/:connectionId')(
      ctx('ws-plugins', { enabled: false }, { connectionId: connection.id }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(false);

    const otherWs = await findRoute('GET', '/tools')(ctx('ws-other'));
    expect(
      (await otherWs.json()).plugins.find((p: { id: string }) => p.id === connection.id),
    ).toBeUndefined();

    const missing = await findRoute('PATCH', '/tools/plugins/:connectionId')(
      ctx('ws-plugins', { enabled: true }, { connectionId: 'nope' }),
    );
    expect(missing.status).toBe(404);
  });
});