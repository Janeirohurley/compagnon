import { memoryManager } from "../services/memory-manager";
import { getSchema, type GetInput } from "../domain/schemas/get";

export const memoryGetTool = {
  name: "memory_get",
  description: "Retrieve a specific memory by its ID.",
  inputSchema: getSchema,
  execute: async (input: GetInput) => {
    const memory = await memoryManager.getMemory(input.id);
    if (!memory) {
      return { success: false, error: "Memory not found" };
    }
    return { success: true, memory };
  },
};
