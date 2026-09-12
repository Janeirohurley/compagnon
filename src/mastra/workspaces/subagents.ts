// Sub-agent factory registry (Phase 2).
//
// Central place mapping the workspace `enabledAgents` registration keys to
// their factory function. Kept out of `runtime.ts` so both the runtime and the
// companion factory can share it without a circular import.
import type { Agent } from '@mastra/core/agent';

import type { WorkspaceConfig } from './types';
import { createMemoryAgent } from '../agents/memory/agent';
import { createPlannerAgent } from '../agents/planner/agent';
import { createGithubAgent } from '../agents/github/agent';
import { createOutlineAgent } from '../agents/outline/agent';
import { createNotionAgent } from '../agents/notion/agent';
import { createPlaneAgent } from '../agents/plane/agent';
import { createResearchAgent } from '../agents/research/agent';

const FACTORIES: Record<string, (cfg: WorkspaceConfig, workspaceId: string) => Agent> = {
  memory: createMemoryAgent,
  planner: createPlannerAgent,
  github: createGithubAgent,
  outline: createOutlineAgent,
  notion: createNotionAgent,
  plane: createPlaneAgent,
  research: createResearchAgent,
};

/** Build one factory-built Agent per entry of `cfg.enabledAgents`, keyed by registration key. */
export function buildSubAgents(cfg: WorkspaceConfig, workspaceId: string = 'default'): Record<string, Agent> {
  const agents: Record<string, Agent> = {};
  for (const id of cfg.enabledAgents) {
    const factory = FACTORIES[id];
    if (factory) {
      agents[id] = factory(cfg, workspaceId);
    }
  }
  return agents;
}