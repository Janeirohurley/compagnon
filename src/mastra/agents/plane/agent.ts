import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { planeTools } from "../../plane";
import { planeContextWorkflowTool } from "../../tools/plane-context-workflow-tool";
import { planeInstructions } from "./plane-instructions";

export const planeAgent = new Agent({
  id: "plane",
  name: "Plane Agent",
  description:
    "Compagnon's native Plane specialist. Handles workspace selection, project context, work item management, comments, cycles, modules, and relation tracking through the typed Plane service layer.",
  model: companionModel,
  instructions: planeInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  tools: {
    ...planeTools,
    planeContextWorkflowTool,
  } as Record<string, any>,
});
