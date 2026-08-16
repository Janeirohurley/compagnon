import { memoryManager } from "../services/memory-manager";
import { verifySchema, type VerifyInput } from "../domain/schemas/verify";

export const memoryVerifyTool = {
  name: "memory_verify",
  description: "Verify a memory's content and optionally update its confidence.",
  inputSchema: verifySchema,
  execute: async (input: VerifyInput) => {
    const memory = await memoryManager.verifyMemory(input.id, input.verifiedValue);
    return { success: true, memory };
  },
};
