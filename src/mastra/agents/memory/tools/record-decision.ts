import { memoryManager } from "../services/memory-manager";
import { recordDecisionSchema, type RecordDecisionInput } from "../domain/schemas/record-decision";

export const memoryRecordDecisionTool = {
  name: "memory_record_decision",
  description: "Record an architectural or operational decision.",
  inputSchema: recordDecisionSchema,
  execute: async (input: RecordDecisionInput) => {
    const decision = await memoryManager.recordDecision(input);
    return { success: true, decision };
  },
};
