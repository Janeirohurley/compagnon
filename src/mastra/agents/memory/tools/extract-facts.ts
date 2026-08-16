import { memoryManager } from "../services/memory-manager";
import { extractFactsSchema, type ExtractFactsInput } from "../domain/schemas/extract-facts";

export const memoryExtractFactsTool = {
  name: "memory_extract_facts",
  description: "Extract factual statements from text and store as memories.",
  inputSchema: extractFactsSchema,
  execute: async (input: ExtractFactsInput) => {
    const facts = input.text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const memories = [];
    for (const fact of facts.slice(0, 5)) {
      const memory = await memoryManager.remember({
        scope: input.scope,
        scopeId: input.scopeId,
        subject: "extracted_fact",
        predicate: "states",
        value: fact.trim(),
        confidence: 0.7,
        source: { type: "agent" },
      });
      memories.push(memory);
    }
    return { success: true, count: memories.length, memories };
  },
};
