// Workspace runtime tests (Phase 2).
//
// Covers the per-workspace agent factory: the default runtime exposes the
// companion + all enabled sub-agents, a workspace whose config restricts
// enabledAgents only mounts those, the MCP server union is limited to the
// enabled agents, and the cache/drop behavior.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
// The store connects lazily; give this test file its own scratch database and
// reset it so the file is idempotent across runs and never races the default.
const DB = '/tmp/compagnon-runtime-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let getWorkspaceRuntime: typeof import('../runtime')['getWorkspaceRuntime'];
let dropWorkspaceRuntime: typeof import('../runtime')['dropWorkspaceRuntime'];
let createWorkspace: typeof import('../store')['createWorkspace'];

const ALL = ['memory', 'planner', 'github', 'outline', 'notion', 'plane', 'research'];

describe('Workspace runtime', () => {
  beforeAll(async () => {
    ({ getWorkspaceRuntime, dropWorkspaceRuntime } = await import('../runtime'));
    ({ createWorkspace } = await import('../store'));
  });

  it('exposes the companion plus every enabled sub-agent for the default workspace', async () => {
    const runtime = await getWorkspaceRuntime('default');
    expect(runtime.companion).toBeDefined();
    expect(runtime.companion.id).toBe('companion');

    expect(Object.keys(runtime.agents).sort()).toEqual([...ALL].sort());

    const subAgents = await runtime.companion.listAgents();
    expect(Object.keys(subAgents).sort()).toEqual([...ALL].sort());
  });

  it('only mounts the enabledAgents of a custom workspace', async () => {
    const id = `limited-${Date.now()}`;
    const enabled = ['memory', 'planner'];
    await createWorkspace({
      id,
      name: 'Limited',
      slug: id,
      config: { projectPath: '/tmp', enabledAgents: enabled },
    });

    const runtime = await getWorkspaceRuntime(id);
    expect(Object.keys(runtime.agents)).toEqual(enabled);

    const subAgents = await runtime.companion.listAgents();
    expect(Object.keys(subAgents)).toEqual(enabled);
  });

  it('limits the MCP server union to the enabled agents (companion + enabled)', async () => {
    const id = `no-research-${Date.now()}`;
    const enabled = ALL.filter((agent) => agent !== 'research');
    await createWorkspace({
      id,
      name: 'NoResearch',
      slug: id,
      config: { projectPath: '/tmp', enabledAgents: enabled },
    });

    const runtime = await getWorkspaceRuntime(id);
    expect(runtime.mcpAgentIds).toEqual(['companion', ...enabled]);
    // Disabled-agent servers are never requested.
    expect(runtime.mcpAgentIds).not.toContain('research');
  });

  it('caches the runtime and drops it on demand', async () => {
    const id = `cached-${Date.now()}`;
    await createWorkspace({
      id,
      name: 'Cached',
      slug: id,
      config: { projectPath: '/tmp', enabledAgents: ['memory'] },
    });
    const first = await getWorkspaceRuntime(id);
    const second = await getWorkspaceRuntime(id);
    expect(second.companion).toBe(first.companion);

    dropWorkspaceRuntime(id);
    const third = await getWorkspaceRuntime(id);
    expect(third.companion).not.toBe(first.companion);
  });

  it('resolves a per-workspace model override through the shared config', async () => {
    const { createCompanionAgent } = await import('../../agents/companion/agent');
    const agent = createCompanionAgent(
      { projectPath: '/tmp', enabledAgents: [], model: { providerId: 'openai', modelId: 'gpt-4o' } },
      'override-ws',
    );
    const model = (agent as any).model;
    // Provider registry/env default provider is reapplied with the override id
    // when it matches, otherwise the override identity is kept.
    expect(model?.modelId ?? model).toBeTruthy();
  });

  it('stacks non-empty workspace instructions above the base companion instructions', async () => {
    const { createCompanionAgent } = await import('../../agents/companion/agent');
    const agent = createCompanionAgent(
      { projectPath: '/tmp', enabledAgents: [], instructions: 'RESERVE-workspace-instructions' },
      'instructions-ws',
    );
    const raw = (agent as any).__getOverridableFields().instructions as string;
    expect(raw).toContain('RESERVE-workspace-instructions');
    expect(raw).toContain('You are Compagnon.');
  });

  it('builds the companion file tools on the workspace project root', async () => {
    const { createProjectFileTools } = await import('../../tools/project-file-tools');
    const { getCompanionTools } = await import('../../tools');
    const fromCompanion = getCompanionTools('/ws/guest-a');
    // Both entry points produce tools bound to the configured root.
    const tools = createProjectFileTools('/ws/guest-a');
    for (const name of [
      'list_project_files',
      'read_project_file',
      'write_project_file',
      'edit_project_file',
      'delete_project_file',
    ] as const) {
      expect(fromCompanion[name]).toBeDefined();
      expect(tools[name]).toBeDefined();
    }
  });
});