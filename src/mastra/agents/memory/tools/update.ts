import { memoryManager } from "../services/memory-manager";
import { updateSchema, type UpdateInput } from "../domain/schemas/update";

export const memoryUpdateTool = {
  name: "memory_update",
  description: "Update an existing memory's value, confidence, or status.",
  inputSchema: updateSchema,
  execute: async (input: UpdateInput) => {
    const memory = await memoryManager.update(input.id, input);
    return { success: true, memory };
  },
};
