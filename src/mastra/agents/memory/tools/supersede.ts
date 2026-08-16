import { memoryManager } from "../services/memory-manager";
import { supersedeSchema, type SupersedeInput } from "../domain/schemas/supersede";

export const memorySupersedeTool = {
  name: "memory_supersede",
  description: "Replace an existing memory with a new version. Marks the old memory as superseded and creates a new active memory with updated information.",
  inputSchema: supersedeSchema,
  execute: async (input: SupersedeInput) => {
    const memory = await memoryManager.supersedeMemory(input.id, {
      scope: input.scope,
      scopeId: input.scopeId,
      subject: input.subject,
      predicate: input.predicate,
      value: input.value,
      confidence: input.confidence,
      source: { type: input.sourceType },
    });
    return { success: true, memory, supersededId: input.id };
  },
};
