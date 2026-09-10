// Phase 1 tests: workspace tenancy (TASK-010).
//
// Data isolation is exercised against a dedicated temp LibSQL file so the real
// mastra.db is never touched. Env must be set BEFORE any dynamic import
// because the storage modules capture `TURSO_DATABASE_URL` at load time.
import { describe, it, expect, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = 'file:/tmp/compagnon-workspaces-test.db';
process.env.APP_ENCRYPTION_KEY = 'test-encryption-key';
process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

const { pickWorkspaceId, resolveWorkspaceFromRequest } = await import('../resolve');
const { createWorkspace, getWorkspace, listWorkspaces } = await import('../store');
const { resolveMemoryIds } = await import('../../agents/companion/memory-context');
const { getCompanionMemory } = await import('../../agents/companion/memory');
const { buildWorkspaceRequestContext } = await import('../request-context');
const { listConnections, upsertConnection } = await import('../../connections/connection-store');

const RUN = Date.now().toString(36);
const WS_A = `ws-a-${RUN}`;
const WS_B = `ws-b-${RUN}`;

describe('pickWorkspaceId', () => {
  it('returns the first non-empty candidate', () => {
    expect(pickWorkspaceId('ws-a', 'ws-b')).toBe('ws-a');
    expect(pickWorkspaceId('', 'ws-b')).toBe('ws-b');
    expect(pickWorkspaceId('  ', null, undefined)).toBe('default');
  });
});

describe('resolveWorkspaceFromRequest', () => {
  it('header wins over body and query', () => {
    const c = {
      req: { header: () => 'ws-h', query: () => 'ws-q' },
    };
    expect(resolveWorkspaceFromRequest(c, { workspaceId: 'ws-b' })).toBe('ws-h');
  });

  it('body wins over query, no header', () => {
    const c = { req: { header: () => null, query: () => 'ws-q' } };
    expect(resolveWorkspaceFromRequest(c, { workspaceId: 'ws-b' })).toBe('ws-b');
  });

  it('falls back to query and then to default', () => {
    const c = { req: { header: () => null, query: () => 'ws-q' } };
    expect(resolveWorkspaceFromRequest(c, {})).toBe('ws-q');
    const c2 = { req: { header: () => null, query: () => null } };
    expect(resolveWorkspaceFromRequest(c2, {})).toBe('default');
  });
});

describe('workspace registry', () => {
  beforeAll(async () => {
    await listWorkspaces(); // triggers bootstrap
  });

  it('bootstraps the default workspace idempotently', async () => {
    const all = await listWorkspaces();
    const def = all.find((w) => w.id === 'default');
    expect(def).toBeTruthy();
    expect(def?.name).toBe('Default');
    expect(def?.config.enabledAgents).toContain('notion');
    expect(def?.config.projectPath).toEqual(process.cwd());
  });

  it('creates and reads a workspace with its config', async () => {
    const ws = await createWorkspace({
      id: WS_A,
      name: 'Workspace A',
      slug: 'ws-a',
      config: { projectPath: '/srv/guest-a', enabledAgents: ['memory', 'planner'] },
    });
    expect(ws.config.projectPath).toBe('/srv/guest-a');
    expect(ws.config.enabledAgents).toEqual(['memory', 'planner']);
    const fetched = await getWorkspace(WS_A);
    expect(fetched?.name).toBe('Workspace A');
  });

  it('lists every workspace including the bootstrap default', async () => {
    const ids = (await listWorkspaces()).map((w) => w.id);
    expect(ids).toContain('default');
    expect(ids).toContain(WS_A);
  });
});

describe('identity resolution (TASK-004)', () => {
  it('maps workspaceId to resourceId via resolveMemoryIds', () => {
    expect(resolveMemoryIds({ workspaceId: WS_A })).toEqual({ resourceId: WS_A });
  });
});

describe('buildWorkspaceRequestContext (TASK-003)', () => {
  it('sets reserved memory keys scoped to the workspace', () => {
    const rc = buildWorkspaceRequestContext(WS_A, 'thread-1');
    expect(rc.get('mastra__threadId')).toBe('thread-1');
    expect(rc.get('mastra__resourceId')).toBe(WS_A);
    const memory = rc.get('MastraMemory') as { thread: { id: string }; resourceId: string };
    expect(memory.resourceId).toBe(WS_A);
    expect(memory.thread.id).toBe('thread-1');
  });
});

describe('working memory isolation (TEST-001)', () => {
  it('keeps two workspaces memory-separate', async () => {
    const memory = getCompanionMemory();

    await memory.updateWorkingMemory({
      threadId: 'ws-a',
      resourceId: 'ws-a',
      workingMemory: '# Faits\n- a-proprio: du workspace A',
    });
    await memory.updateWorkingMemory({
      threadId: WS_B,
      resourceId: WS_B,
      workingMemory: '# Faits\n- b-proprio: du workspace B',
    });

    const a = await memory.getWorkingMemory({ threadId: 'ws-a', resourceId: 'ws-a' });
    const b = await memory.getWorkingMemory({ threadId: WS_B, resourceId: WS_B });

    expect(a).toContain('a-proprio');
    expect(b).toContain('b-proprio');
    expect(a).not.toContain('b-proprio');
    expect(b).not.toContain('a-proprio');
  });
});

describe('connection scoping (TEST-006)', () => {
  it('upserts under a workspace and never leaks it to another', async () => {
    const CONN_B = `conn-ws-b-${RUN}`;
    await upsertConnection({
      id: CONN_B,
      workspaceId: WS_B,
      provider: 'notion',
      name: 'Notion B',
      secrets: { token: 'secret-b' },
    });
    await upsertConnection({
      id: 'conn-default',
      provider: 'outline',
      name: 'Outline Default',
    });

    const b = await listConnections(WS_B);
    expect(b.some((c) => c.id === CONN_B)).toBe(true);
    expect(b.some((c) => c.id === 'conn-default')).toBe(false);

    const a = await listConnections(WS_A);
    expect(a.every((c) => c.workspaceId === WS_A)).toBe(true);

    const def = await listConnections('default');
    expect(def.some((c) => c.id === 'conn-default')).toBe(true);
    expect(def.some((c) => c.id === CONN_B)).toBe(false);
  });
});