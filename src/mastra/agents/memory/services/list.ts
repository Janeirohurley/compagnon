import { findMemoriesByScope } from "../repositories/memory-repository";
import type { MemoryScope, SemanticMemory } from "../domain/types";

export async function listMemories(scope?: MemoryScope, scopeId?: string): Promise<SemanticMemory[]> {
  if (scope) {
    return findMemoriesByScope(scope, scopeId);
  }
  return findMemoriesByScope("global");
}
