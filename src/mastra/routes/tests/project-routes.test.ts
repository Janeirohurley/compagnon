// Project routes tests (feature-projects).
//
// Covers the /projects CRUD endpoints: workspace scoping, validation and the
// HEAD/GET/POST/PATCH/DELETE handlers.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
const DB = '/tmp/compagnon-project-routes-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let projectRoutes: typeof import('../project-routes')['projectRoutes'];

type Handler = (c: unknown) => Promise<Response>;

function findRoute(method: string, path: string): Handler {
  const route = projectRoutes.find((r) => r.method === method && r.path === path);
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

describe('Project routes', () => {
  beforeAll(async () => {
    ({ projectRoutes } = await import('../project-routes'));
  });

  it('GET /projects returns an empty list for a fresh workspace', async () => {
    const res = await findRoute('GET', '/projects')(ctx('ws-empty'));
    expect(res.status).toBe(200);
    expect((await res.json()).projects).toEqual([]);
  });

  it('POST /projects creates a project in the request workspace', async () => {
    const res = await findRoute('POST', '/projects')(
      ctx('ws-create', { name: 'Backend', description: 'API service', projectPath: '/srv/back' }),
    );
    expect(res.status).toBe(201);
    const project = (await res.json()).project;
    expect(project.workspaceId).toBe('ws-create');
    expect(project.name).toBe('Backend');
    expect(project.slug).toBe('backend');
    expect(project.status).toBe('active');

    const listed = await (await findRoute('GET', '/projects')(ctx('ws-create'))).json();
    expect(listed.projects).toHaveLength(1);
  });

  it('GET /projects/:id returns the project or 404', async () => {
    const { project } = await (
      await findRoute('POST', '/projects')(ctx('ws-get', { name: 'Frontend' }))
    ).json();

    const res = await findRoute('GET', '/projects/:id')(ctx('ws-get', {}, { id: project.id }));
    expect(res.status).toBe(200);
    expect((await res.json()).project.name).toBe('Frontend');

    const missing = await findRoute('GET', '/projects/:id')(ctx('ws-get', {}, { id: 'nope' }));
    expect(missing.status).toBe(404);
  });

  it('POST /projects validates name and status', async () => {
    const noName = await findRoute('POST', '/projects')(ctx('ws-a', {}));
    expect(noName.status).toBe(400);
    expect((await noName.json()).error).toContain('name');

    const badStatus = await findRoute('POST', '/projects')(ctx('ws-a', { name: 'x', status: 'weird' }));
    expect(badStatus.status).toBe(400);
    expect((await badStatus.json()).error).toContain('status');
  });

  it('PATCH /projects/:id updates a project and 404s unknown ids', async () => {
    const { project } = await (
      await findRoute('POST', '/projects')(ctx('ws-patch', { name: 'Old name' }))
    ).json();

    const res = await findRoute('PATCH', '/projects/:id')(
      ctx('ws-patch', { name: 'New name', status: 'paused' }, { id: project.id }),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()).project;
    expect(updated.name).toBe('New name');
    expect(updated.status).toBe('paused');

    const missing = await findRoute('PATCH', '/projects/:id')(
      ctx('ws-patch', { name: 'x' }, { id: 'nope' }),
    );
    expect(missing.status).toBe(404);
  });

  it('DELETE /projects/:id removes the project and 404s if it is gone', async () => {
    const { project } = await (
      await findRoute('POST', '/projects')(ctx('ws-del', { name: 'To remove' }))
    ).json();

    const res = await findRoute('DELETE', '/projects/:id')(ctx('ws-del', {}, { id: project.id }));
    expect(res.status).toBe(200);

    const again = await findRoute('DELETE', '/projects/:id')(ctx('ws-del', {}, { id: project.id }));
    expect(again.status).toBe(404);
  });

  it('keeps projects isolated across workspaces end to end', async () => {
    await findRoute('POST', '/projects')(ctx('ws-iso', { name: 'Backend' }));

    const other = await (await findRoute('GET', '/projects')(ctx('ws-other'))).json();
    expect(other.projects).toEqual([]);

    const own = await (await findRoute('GET', '/projects')(ctx('ws-iso'))).json();
    expect(own.projects).toHaveLength(1);
  });
});