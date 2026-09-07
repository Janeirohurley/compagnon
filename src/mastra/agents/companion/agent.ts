// Main Agent (Compagnon) - Entry point
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { companionInstructions } from '../../instructions/companion-instructions';
import { getCompanionModelConfig } from '../../config/model-config';
import { getCompanionTools } from '../../tools';
import { getMcpToolsForAgent } from '../../mcp';
import { requestPlanTool } from '../../tools/request-plan-tool';
import { planExecutorTool } from '../../tools/plan-executor-tool';
import { researchRequestTool } from '../../tools/research-request-tool';
import { memoryAgent } from '../memory';
import { plannerAgent } from '../planner';
import { githubAgent } from '../github';
import { outlineAgent } from '../outline';
import { notionAgent } from '../notion';
import { planeAgent } from '../plane';
import { researchAgent } from '../research';
import { buildMemoryDelegationPrompt, parseMemoryTaskResult, type MemoryTask } from '../memory/delegation';
import { retrieveRelevantMemories, extractTaskMemories } from '../memory/hooks';

const model = getCompanionModelConfig();

const nativeTools = getCompanionTools();
const mcpTools = await getMcpToolsForAgent('companion');

// Memory hooks wrapper - optional middleware
// async function executeWithMemory(
//   task: string,
//   execute: () => Promise<{ text: string }>
// ): Promise<{ text: string }> {
//   await retrieveRelevantMemories({ task: task.substring(0, 500) });

//   const result = await execute();

//   await extractTaskMemories(
//     { task: task.substring(0, 500) },
//     { success: true, result: result.text.substring(0, 500) }
//   );

//   return result;
// }

export const companionAgent = new Agent({
  id: 'companion',
  name: 'Compagnon',

  description:
    'Autonomous AI agent specialized in understanding, observing, organizing, and improving its working environment through available tools and skills.',

  instructions: companionInstructions,

  model,

  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),

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

  tools: {
    ...nativeTools,
    request_plan: requestPlanTool,
    plan_executor: planExecutorTool,
    research_request: researchRequestTool,
    ...mcpTools,
  },

  // Subagents - specialized agents for specific tasks
  agents: {
    memory: memoryAgent,
    planner: plannerAgent,
    github: githubAgent,
    outline: outlineAgent,
    notion: notionAgent,
    plane: planeAgent,
    research: researchAgent,
  },
});

// Helper to delegate to Memory Agent
export async function delegateToMemoryAgent(task: MemoryTask) {
  const prompt = buildMemoryDelegationPrompt(task);
  const response = await memoryAgent.generate(prompt);
  return parseMemoryTaskResult(response.text);
}

// Execute companion agent with memory hooks (automatic retrieval/extraction)
export async function generateWithMemory(
  prompt: string,
  options?: Record<string, unknown>
): Promise<{ text: string }> {
  await retrieveRelevantMemories({ task: prompt.substring(0, 500) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (companionAgent as any).generate(prompt, options as any);

  await extractTaskMemories(
    { task: prompt.substring(0, 500) },
    { success: true, result: result.text.substring(0, 500) }
  );

  return result;
}

// Export the agent as default
export const agent = companionAgent;
