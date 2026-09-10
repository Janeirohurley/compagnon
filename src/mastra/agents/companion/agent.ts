// Main Agent (Compagnon) - Agent factory
//
// Phase 2: `createCompanionAgent(cfg, workspaceId, subAgents?)` builds a
// per-workspace companion whose sub-agents are the factory-built agents of the
// workspace's `enabledAgents` and whose tools load MCP lazily (no top-level
// await). The workspace runtime (`workspaces/runtime.ts`) is the only source
// of agent instances; default-bound helpers below keep the legacy
// single-workspace behavior for tools/workflows that still run on `"default"`.
import { Agent } from '@mastra/core/agent';

import { companionInstructions } from '../../instructions/companion-instructions';
import { getCompanionModelConfig } from '../../config/model-config';
import { getCompanionTools } from '../../tools';
import { getMcpToolsForAgents } from '../../mcp';
import { requestPlanTool } from '../../tools/request-plan-tool';
import { planExecutorTool } from '../../tools/plan-executor-tool';
import { researchRequestTool } from '../../tools/research-request-tool';
import { buildMemoryDelegationPrompt, parseMemoryTaskResult, type MemoryTask } from '../memory/delegation';
import { getCompanionMemory } from './memory';
import { retrieveContext, resolveMemoryIds, sanitizeForMemory } from './memory-context';
import type { WorkspaceConfig } from '../../workspaces/types';

import { buildSubAgents } from '../../workspaces/subagents';

/**
 * Build a companion agent for a workspace. `subAgents` is optional so the
 * runtime can share the exact instances it also exposes; when omitted the
 * sub-agents are built from `cfg.enabledAgents` here.
 */
export function createCompanionAgent(
  cfg: WorkspaceConfig,
  _workspaceId: string,
  subAgents?: Record<string, Agent>,
): Agent {
  const agents = subAgents ?? buildSubAgents(cfg);

  const model = getCompanionModelConfig(cfg.model);

  // Per-workspace tool set: the project-file tools close over cfg.projectPath
  // (Phase 3); the workspace instructions, when non-empty, are stacked above
  // the base companion instructions.
  const nativeTools = getCompanionTools(cfg.projectPath);
  const instructions = cfg.instructions?.trim()
    ? `${cfg.instructions.trim()}\n\n---\n\n${companionInstructions}`
    : companionInstructions;

  return new Agent({
    id: 'companion',
    name: 'Compagnon',

    description:
      'Autonomous AI agent specialized in understanding, observing, organizing, and improving its working environment through available tools and skills.',

    instructions,

    model,

    memory: getCompanionMemory(),

    editor: {
      instructions: false,
    },

    skills: [
      '.agents/skills/companion-foundation',
      '.agents/skills/workspace-observation',
      '.agents/skills/knowledge-memory',
      '.agents/skills/policy-safety',
      '.agents/skills/master-communication',
      '.agents/skills/planning-sync',
      '.agents/skills/filesystem',
      '.agents/skills/git',
      '.agents/skills/developer',
      '.agents/skills/documentation',
      '.agents/skills/git-commit',
      '.agents/skills/documentation-writer',
      '.agents/skills/create-readme',
      '.agents/skills/commit-message',
      '.agents/skills/commit-message-storyteller',
      '.agents/skills/create-implementation-plan',
      '.agents/skills/doc-and-modernize',
      '.agents/skills/draw-io-diagram-generator',
      '.agents/skills/example-skill',

      '.agents/skills/markdown-to-html',
      '.agents/skills/mcp-implementation-security-review',
      '.agents/skills/mcp-security-audit',
      '.agents/skills/readme-blueprint-generator',
      '.agents/skills/remote-operations',
      '.agents/skills/git-flow-branch-creator',
    ],

    // MCP tools resolve lazily on each run. The companion exposes the servers
    // aimed at itself plus those whose target agent is enabled for the
    // workspace (disabled sub-agents -> no MCP server of that agent).
    tools: async () => ({
      ...nativeTools,
      request_plan: requestPlanTool,
      plan_executor: planExecutorTool,
      research_request: researchRequestTool,
      ...(await getMcpToolsForAgents(['companion', ...cfg.enabledAgents])),
    }),

    // Subagents - specialized agents for specific tasks
    agents,
  });
}

// ---------------------------------------------------------------------------
// Default-bound helpers (single-workspace behavior preserved for the tools and
// workflows that still run on the `default` workspace).
// ---------------------------------------------------------------------------

async function getDefaultRuntime() {
  const { getWorkspaceRuntime } = await import('../../workspaces/runtime');
  const { DEFAULT_WORKSPACE_ID } = await import('../../workspaces/types');
  return getWorkspaceRuntime(DEFAULT_WORKSPACE_ID);
}

/** Helper to delegate to the Memory Agent (default workspace). */
export async function delegateToMemoryAgent(task: MemoryTask) {
  const runtime = await getDefaultRuntime();
  const memoryAgent = runtime.agents.memory;
  const prompt = buildMemoryDelegationPrompt(task);
  const response = await memoryAgent.generate(prompt);
  return parseMemoryTaskResult(response.text);
}

// Execute the companion agent with real, injected memory context.
// The relevant context is retrieved (resolveMemoryIds + retrieveContext) and
// prepended to the prompt, and the native Mastra memory pipeline (message
// history, semantic recall, working memory, observational memory) is enabled
// via the `memory` option — all scoped to resourceId/threadId (default
// resource "anonymous").
export async function generateWithMemory(
  prompt: string,
  options?: Record<string, unknown>
): Promise<{ text: string }> {
  const ids = resolveMemoryIds(options as Record<string, unknown>);

  const context = await retrieveContext(prompt, ids);
  const finalPrompt = context ? `${context}\n\n${prompt}` : prompt;

  const runtime = await getDefaultRuntime();
  const companionAgent = runtime.companion;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (companionAgent as any).generate(finalPrompt, {
    ...(options ?? {}),
    memory: {
      thread: { id: ids.threadId || ids.resourceId, resourceId: ids.resourceId },
      resource: ids.resourceId,
    },
  } as any);

  if (sanitizeForMemory(result.text ?? "") === null) {
    console.warn("[Memory] Skipped explicit persistence of sensitive text (secret pattern detected).");
  }

  return result;
}