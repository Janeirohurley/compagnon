import { memoryManager } from "../services/memory-manager";
import { forgetSchema, type ForgetInput } from "../domain/schemas/forget";

export const memoryForgetTool = {
  name: "memory_forget",
  description: "Archive (soft delete) a memory by ID.",
  inputSchema: forgetSchema,
  execute: async (input: ForgetInput) => {
    await memoryManager.forget(input.id);
    return { success: true, message: "Memory archived" };
  },
};
