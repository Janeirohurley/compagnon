import { memoryManager } from "../services/memory-manager";
import { consolidateSchema, type ConsolidateInput } from "../domain/schemas/consolidate";

export const memoryConsolidateTool = {
  name: "memory_consolidate",
  description: "Consolidate repeated episodes into reusable procedures.",
  inputSchema: consolidateSchema,
  execute: async (input: ConsolidateInput) => {
    const result = await memoryManager.consolidateEpisodes(input);
    return { success: true, ...result };
  },
};
