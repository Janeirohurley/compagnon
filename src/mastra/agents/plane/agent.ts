import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { planeInstructions } from "./plane-instructions";
import { getPlaneMcpTools } from "../../mcp/plane-tools";
import { planeAdvancementTool } from "./tools/plane-advancement-tool";
import { planeBlockageTool } from "./tools/plane-blockage-tool";

// Load MCP Plane tools at startup
const mcpTools = await getPlaneMcpTools();

export const planeAgent = new Agent({
  id: "plane",
  name: "Plane Agent",
  description:
    "Compagnon's Plane Agent. Manages project tracking via Plane: work items, cycles, modules, advancement reports, and blockage detection.",
  model: companionModel,
  instructions: planeInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  maxSteps: 30,
  tools: {
    ...mcpTools,
    // Custom advancement tools (not available via MCP)
    plane_get_advancement: planeAdvancementTool,
    plane_detect_blockages: planeBlockageTool,
  } as Record<string, any>,
});
