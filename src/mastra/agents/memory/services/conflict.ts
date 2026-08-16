import { createConflict, findPendingConflicts, resolveConflict as resolveConflictInDb } from "../repositories/conflict-repository";
import type { RememberInput, MemoryConflict } from "../domain/types";
import { searchMemories } from "./search";

export async function detectConflicts(candidate: RememberInput): Promise<MemoryConflict[]> {
  const conflicts: MemoryConflict[] = [];

  const results = await searchMemories({
    query: `${candidate.subject} ${candidate.predicate}`,
    scope: candidate.scope,
    scopeId: candidate.scopeId,
    limit: 5,
  });

  for (const result of results) {
    if (result.type !== "semantic") continue;
    const existing = result.data as { subject: string; predicate: string; value: string };

    if (existing.subject === candidate.subject &&
        existing.predicate === candidate.predicate &&
        existing.value !== candidate.value) {
      const conflict = await createConflict({
        id: crypto.randomUUID(),
        memoryAId: result.id,
        memoryBId: "",
        memoryAExcerpt: `${existing.subject} ${existing.predicate} ${existing.value}`,
        memoryBExcerpt: `${candidate.subject} ${candidate.predicate} ${candidate.value}`,
        reason: `Conflicting values: "${existing.value}" vs "${candidate.value}"`,
        resolution: "pending",
      });
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

export async function getPendingConflicts(): Promise<MemoryConflict[]> {
  return findPendingConflicts();
}

export async function resolveConflict(id: string, resolution: MemoryConflict["resolution"]): Promise<MemoryConflict | null> {
  return resolveConflictInDb(id, resolution);
}
