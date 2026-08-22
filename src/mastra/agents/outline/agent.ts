import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { outlineInstructions } from "./outline-instructions";
import { getOutlineMcpTools } from "../../mcp/outline-tools";

// Load MCP Outline tools at startup
const mcpTools = await getOutlineMcpTools();

export const outlineAgent = new Agent({
  id: "outline",
  name: "Outline Agent",
  description:
    "Compagnon's Outline Agent. Manages documentation and knowledge base via Outline: search, read, create, update documents, manage collections, and publish knowledge from Memory.",
  model: companionModel,
  instructions: outlineInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  maxSteps: 30,
  tools: mcpTools as Record<string, any>,
});
