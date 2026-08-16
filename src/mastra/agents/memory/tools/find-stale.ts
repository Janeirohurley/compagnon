import { memoryManager } from "../services/memory-manager";
import { findStaleSchema, type FindStaleInput } from "../domain/schemas/find-stale";

export const memoryFindStaleTool = {
  name: "memory_find_stale",
  description: "Find memories that have not been verified recently.",
  inputSchema: findStaleSchema,
  execute: async (input: FindStaleInput) => {
    const staleIds = await memoryManager.findStaleMemories(input.daysThreshold);
    return { success: true, staleIds, count: staleIds.length };
  },
};
