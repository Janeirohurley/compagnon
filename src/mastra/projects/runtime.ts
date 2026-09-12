// Project-scoped companion runtime (feature-projects).
//
// A project session confines the companion to the project's own root: the
// companion is rebuilt on a config whose `projectPath` is the project's path
// (falling back to the workspace root when the project has none), so the
// project-file tools can never escape the project. Global (workspace) sessions
// keep using the workspace runtime's companion, which is rooted on the
// workspace folder and may therefore work on any of the workspace's projects.
import type { Agent } from '@mastra/core/agent';

import { getWorkspaceRuntime } from '../workspaces/runtime';
import { createCompanionAgent } from '../agents/companion/agent';
import { getProject } from './project-store';

const cache = new Map<string, Promise<Agent>>();

function cacheKey(workspaceId: string, projectId: string): string {
  return `${workspaceId}::${projectId}`;
}

async function buildProjectCompanion(workspaceId: string, projectId: string): Promise<Agent> {
  const project = await getProject(projectId);
  if (!project || project.workspaceId !== workspaceId) {
    throw new Error(`[Compagnon] Project "${projectId}" does not exist in workspace "${workspaceId}".`);
  }

  const workspaceRuntime = await getWorkspaceRuntime(workspaceId);

  // Project confinement: only the file root changes; the workspace config
  // (model, instructions, enabled agents, MCP servers) is inherited as-is.
  const projectRoot = project.projectPath.trim()
    ? project.projectPath
    : workspaceRuntime.workspace.config.projectPath;
  const cfg = { ...workspaceRuntime.workspace.config, projectPath: projectRoot };

  // Confine the workspace-level filesystem MCP server to the project root too:
  // its `{{COMPANION_WORKSPACE_ROOTS}}` placeholder is re-rooted here so a
  // project session cannot reach the workspace through MCP either.
  return createCompanionAgent(cfg, workspaceId, workspaceRuntime.agents, {
    COMPANION_WORKSPACE_ROOTS: projectRoot,
  });
}

/**
 * Resolve the companion bound to a project scope (cached; concurrent
 * resolutions share a single promise so the companion is built exactly once).
 * Mirrors `getWorkspaceRuntime`: the agent is only ever produced here.
 */
export function getProjectCompanion(workspaceId: string, projectId: string): Promise<Agent> {
  const existing = cache.get(cacheKey(workspaceId, projectId));
  if (existing) return existing;
  const companion = buildProjectCompanion(workspaceId, projectId);
  cache.set(cacheKey(workspaceId, projectId), companion);
  // A rejected build (missing/mismatched project) must not poison the cache.
  companion.catch(() => {
    if (cache.get(cacheKey(workspaceId, projectId)) === companion) {
      cache.delete(cacheKey(workspaceId, projectId));
    }
  });
  return companion;
}

/** Drop one project companion (project updated or deleted). */
export function dropProjectCompanion(workspaceId: string, projectId: string): void {
  cache.delete(cacheKey(workspaceId, projectId));
}

/** Drop every project companion of a workspace (workspace config changed). */
export function dropWorkspaceProjectCompanions(workspaceId: string): void {
  const prefix = `${workspaceId}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}