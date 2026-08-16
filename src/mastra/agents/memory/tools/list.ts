import { memoryManager } from "../services/memory-manager";
import { listSchema, type ListInput } from "../domain/schemas/list";

export const memoryListTool = {
  name: "memory_list",
  description: "List memories with optional filtering by scope.",
  inputSchema: listSchema,
  execute: async (input: ListInput) => {
    const memories = await memoryManager.listMemories(input.scope, input.scopeId);
    return { success: true, count: memories.length, memories: memories.slice(0, input.limit) };
  },
};
