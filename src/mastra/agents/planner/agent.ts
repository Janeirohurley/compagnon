import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { plannerInstructions } from "./planner-instructions";
import { PlannerOutputProcessor } from "./runtime/planner-output-processor";

export const plannerAgent = new Agent({
  id: "planner",
  name: "Planner Agent",
  description:
    "Planning specialist. Delegates to this agent whenever the user asks for a plan, roadmap, task decomposition, dependency analysis, execution sequencing, risk analysis, or acceptance criteria. Transforms objectives into validated, structured execution plans. Does not implement anything.",
  model: companionModel,
  instructions: plannerInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  outputProcessors: [new PlannerOutputProcessor()],
});
