import { createMemory } from "../repositories/memory-repository";
import type { RememberInput, SemanticMemory } from "../domain/types";
import { logMemoryEvent } from "../observability/logger";

export async function rememberMemory(input: RememberInput): Promise<SemanticMemory> {
  const { scope, scopeId, subject, predicate, value, confidence, source } = input;
  const id = crypto.randomUUID();

  const memory = await createMemory({
    id, scope, scopeId, subject, predicate, value, confidence, source,
    status: "active", useCount: 0
  });

  logMemoryEvent({
    type: "memory.created",
    memoryId: id,
    memoryType: "semantic",
    scope,
    scopeId,
    details: { subject, predicate, value, confidence },
  });

  return memory;
}
