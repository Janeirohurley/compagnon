import { memoryManager } from "../services/memory-manager";
import { retrieveContextSchema, type RetrieveContextInput } from "../domain/schemas/retrieve-context";

export const memoryRetrieveContextTool = {
  name: "memory_retrieve_context",
  description: "Retrieve relevant context for a task based on query.",
  inputSchema: retrieveContextSchema,
  execute: async (input: RetrieveContextInput) => {
    const results = await memoryManager.search({
      query: input.query,
      limit: input.limit,
    });
    return { success: true, count: results.length, results };
  },
};
