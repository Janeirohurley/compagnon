import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { companionInstructions } from '../instructions/companion-instructions';
import { getCompanionModelConfig } from '../config/model-config';
import { getCompanionTools } from '../tools';
import { getCompanionMcpTools } from '../mcp';

const model = getCompanionModelConfig();

const nativeTools = getCompanionTools();
const mcpTools = await getCompanionMcpTools();

export const agent = new Agent({
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
    '.agents/skills/outline-knowledge',
    '.agents/skills/plane-knowledge',
    '.agents/skills/filesystem',
    '.agents/skills/git',
    '.agents/skills/github',
  ],

  tools: {
    ...nativeTools,
    ...mcpTools,
  },
});