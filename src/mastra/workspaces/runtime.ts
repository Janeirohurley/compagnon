// Workspace runtime (Phase 2).
//
// Builds, caches and serves a per-workspace Mastra agent set: the companion
// built on the workspace config (enabled sub-agents, MCP filtered to those
// agents, optional model override) plus the enabled sub-agent instances. All
// routes and entry points resolve agents through this module.
import type { Agent } from '@mastra/core/agent';

import { ALL_ENABLED_AGENTS, DEFAULT_WORKSPACE_ID, type Workspace, type WorkspaceConfig } from './types';
import { getWorkspace } from './store';
import { buildSubAgents } from './subagents';
import { createCompanionAgent } from '../agents/companion/agent';

/** Runtime for one workspace: the companion + its enabled sub-agents. */
export interface WorkspaceRuntime {
  workspace: Workspace;
  /** The per-workspace companion agent. */
  companion: Agent;
  /** Enabled sub-agents keyed by registration key (memory, planner, github, ...). */
  agents: Record<string, Agent>;
  /** Sub-agent ids whose MCP servers this workspace may load. */
  mcpAgentIds: string[];
}

const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  projectPath: '.',
  enabledAgents: [...ALL_ENABLED_AGENTS],
};

const cache = new Map<string, Promise<WorkspaceRuntime>>();

async function buildRuntime(workspaceId: string): Promise<WorkspaceRuntime> {
  const dbWorkspace = await getWorkspace(workspaceId);
  const cfg = dbWorkspace?.config ?? DEFAULT_WORKSPACE_CONFIG;
  const workspace: Workspace =
    dbWorkspace ?? {
      id: workspaceId,
      name: workspaceId,
      slug: workspaceId,
      config: DEFAULT_WORKSPACE_CONFIG,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

  const subAgents = buildSubAgents(cfg);
  const companion = createCompanionAgent(cfg, workspace.id, subAgents);

  return {
    workspace,
    companion,
    agents: subAgents,
    mcpAgentIds: ['companion', ...cfg.enabledAgents],
  };
}

/**
 * Resolve the runtime for a workspace id (cached; concurrent resolutions share
 * a single promise so the companion/sub-agents are built exactly once).
 */
export function getWorkspaceRuntime(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<WorkspaceRuntime> {
  const existing = cache.get(workspaceId);
  if (existing) {
    return existing;
  }
  const runtime = buildRuntime(workspaceId);
  cache.set(workspaceId, runtime);
  return runtime;
}

/** Drop a cached runtime (e.g. a workspace was created/updated). */
export function dropWorkspaceRuntime(workspaceId: string): void {
  cache.delete(workspaceId);
}

/** Convenience accessor for the single-workspace (default) runtime. */
export function getDefaultWorkspaceRuntime(): Promise<WorkspaceRuntime> {
  return getWorkspaceRuntime(DEFAULT_WORKSPACE_ID);
}