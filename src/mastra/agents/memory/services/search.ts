import { findMemoriesByScope, findMemoriesBySubject } from "../repositories/memory-repository";
import type { MemorySearchInput, MemorySearchResult } from "../domain/types";
import { logMemoryEvent } from "../observability/logger";

export async function searchMemories(input: MemorySearchInput): Promise<MemorySearchResult[]> {
  const { query, scope, scopeId, minConfidence = 0, limit = 10 } = input;
  const queryLower = query.toLowerCase();

  logMemoryEvent({
    type: "memory.retrieved",
    scope,
    scopeId,
    details: { query, limit },
  });

  // Search by subject first, then by scope
  const subjectMemories = await findMemoriesBySubject(query, scope);
  const scopeMemories = await findMemoriesByScope(scope || "global", scopeId);

  const allMemories = [...subjectMemories];
  for (const m of scopeMemories) {
    if (!allMemories.find(existing => existing.id === m.id)) {
      allMemories.push(m);
    }
  }

  const results: MemorySearchResult[] = [];

  for (const memory of allMemories) {
    if (memory.status !== "active" || memory.confidence < minConfidence) continue;

    const text = `${memory.subject} ${memory.predicate} ${memory.value}`.toLowerCase();
    if (text.includes(queryLower) || queryLower.includes(memory.subject.toLowerCase())) {
      results.push({
        type: "semantic",
        id: memory.id,
        score: memory.confidence,
        data: memory,
      });
    }
  }

  return results.slice(0, limit);
}
