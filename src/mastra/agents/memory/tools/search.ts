import { memoryManager } from "../services/memory-manager";
import { searchSchema, type SearchInput } from "../domain/schemas/search";

export const memorySearchTool = {
  name: "memory_search",
  description: "Search across all memory types (semantic, episodes, procedures, decisions). Use to retrieve relevant context before performing tasks.",
  inputSchema: searchSchema,
  execute: async (input: SearchInput) => {
    const results = await memoryManager.search(input);
    return { success: true, count: results.length, results };
  },
};
