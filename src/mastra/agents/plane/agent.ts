import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { getMcpToolsForAgent } from "../../mcp";
import { planeInstructions } from "./plane-instructions";

const mcpTools = await getMcpToolsForAgent("plane");

export const planeAgent = new Agent({
  id: "plane",
  name: "Plane Agent",
  description:
    "Compagnon's Plane specialist. Handles workspaces, projects, work items, cycles, modules, comments, and relations through the Plane MCP server.",
  model: companionModel,
  instructions: planeInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  tools: {
    ...mcpTools,
  } as Record<string, any>,
});