// Project-scoped companion tests (feature-projects).
//
// Covers the scoped companion runtime: a project session builds a companion
// bound to the project (confinement root derived from project.project_path),
// it is cached and dropped on demand, mismatched/unknown projects never build
// an agent, and the request-scope resolution precedence (header > body >
// query) is honored. Mirrors `workspaces/tests/runtime.test.ts` env setup.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
const DB = '/tmp/compagnon-project-runtime-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let getProjectCompanion: typeof import('../runtime')['getProjectCompanion'];
let dropProjectCompanion: typeof import('../runtime')['dropProjectCompanion'];
let createProject: typeof import('../project-store')['createProject'];
let createWorkspace: typeof import('../../workspaces/store')['createWorkspace'];

describe('Project-scoped companion', () => {
  beforeAll(async () => {
    ({ getProjectCompanion, dropProjectCompanion } = await import('../runtime'));
    ({ createProject } = await import('../project-store'));
    ({ createWorkspace } = await import('../../workspaces/store'));
  });

  it('builds a companion for an existing project of the workspace', async () => {
    const ws = `proj-ws-${Date.now()}`;
    await createWorkspace({ id: ws, name: 'Projects', slug: ws, config: { projectPath: '/ws/root' } });
    const project = await createProject({
      workspaceId: ws,
      name: 'Backend',
      projectPath: '/ws/root/backend',
    });

    const companion = await getProjectCompanion(ws, project.id);
    expect(companion.id).toBe('companion');
    expect(companion.listAgents).toBeDefined();
  });

  it('caches the companion and rebuilds after a drop', async () => {
    const ws = `cached-proj-ws-${Date.now()}`;
    await createWorkspace({ id: ws, name: 'Projects', slug: ws, config: { projectPath: '/ws/root' } });
    const project = await createProject({
      workspaceId: ws,
      name: 'Frontend',
      projectPath: '/ws/root/frontend',
    });

    const first = await getProjectCompanion(ws, project.id);
    const second = await getProjectCompanion(ws, project.id);
    expect(second).toBe(first);

    dropProjectCompanion(ws, project.id);
    const third = await getProjectCompanion(ws, project.id);
    expect(third).not.toBe(first);
  });

  it('refuses a project from another workspace', async () => {
    const ws = `own-ws-${Date.now()}`;
    const other = `other-ws-${Date.now()}`;
    await createWorkspace({ id: ws, name: 'Owner', slug: ws, config: { projectPath: '/ws' } });
    await createWorkspace({ id: other, name: 'Other', slug: other, config: { projectPath: '/ws' } });
    const project = await createProject({ workspaceId: ws, name: 'Secret', projectPath: '/ws/secret' });

    await expect(getProjectCompanion(other, project.id)).rejects.toThrow(/does not exist in workspace/);
  });

  it('rejects an unknown project id', async () => {
    await expect(getProjectCompanion('anystr', 'missing-project')).rejects.toThrow(/does not exist in workspace/);
  });

  it('rebuilds after a project_path change through the PATCH route', async () => {
    const { projectRoutes } = await import('../../routes/project-routes');
    const route = projectRoutes.find((r) => r.method === 'PATCH' && r.path === '/projects/:id');
    if (!route) throw new Error('PATCH /projects/:id not found');

    const ws = `patch-proj-ws-${Date.now()}`;
    await createWorkspace({ id: ws, name: 'Projects', slug: ws, config: { projectPath: '/ws/root' } });
    const project = await createProject({ workspaceId: ws, name: 'API', projectPath: '/ws/root/api' });

    const before = await getProjectCompanion(ws, project.id);

    const res = await (route.handler as (c: unknown) => Promise<Response>)({
      req: { param: (key: string) => (key === 'id' ? project.id : undefined), json: async () => ({ projectPath: '/ws/root/api-v2' }) },
    });
    expect(res.status).toBe(200);

    const after = await getProjectCompanion(ws, project.id);
    expect(after).not.toBe(before);
  });
});

describe('resolveProjectFromRequest precedence', () => {
  it('prefers the header over body over query, and returns null otherwise', async () => {
    const { resolveProjectFromRequest } = await import('../resolve');

    const withHeader = { req: { header: (k: string) => (k === 'x-project-id' ? 'p-header' : undefined), query: () => undefined } };
    expect(resolveProjectFromRequest(withHeader, { projectId: 'p-body' })).toBe('p-header');

    const noHeader = { req: { header: () => undefined, query: () => undefined } };
    expect(resolveProjectFromRequest(noHeader, { projectId: 'p-body' })).toBe('p-body');

    const fromQuery = { req: { header: () => undefined, query: (k: string) => (k === 'projectId' ? 'p-query' : undefined) } };
    expect(resolveProjectFromRequest(fromQuery, {})).toBe('p-query');

    expect(resolveProjectFromRequest({ req: { header: () => undefined, query: () => undefined } }, {})).toBeNull();
    expect(resolveProjectFromRequest({ req: { header: () => '   ', query: () => undefined } }, { projectId: '' })).toBeNull();
  });

  it('the /chat route 404s on an unknown project scope without streaming', async () => {
    const { chatRoutes } = await import('../../routes/chat-routes');
    const route = chatRoutes.find((r) => r.method === 'POST' && r.path === '/chat');
    if (!route) throw new Error('POST /chat not found');

    const res = await (route.handler as (c: unknown) => Promise<Response>)({
      req: {
        header: () => undefined,
        query: () => undefined,
        json: async () => ({ messages: [], threadId: 't', projectId: 'no-such-project' }),
      },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('does not exist in workspace');
  });
});