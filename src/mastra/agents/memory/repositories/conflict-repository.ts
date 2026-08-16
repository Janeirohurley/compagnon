// Conflict Repository - Data access layer
import { memoryDb, initializeMemoryDatabase } from "../storage/client";
import type { MemoryConflict } from "../domain/types";

export async function createConflict(conflict: Omit<MemoryConflict, "detectedAt" | "resolvedAt">): Promise<MemoryConflict> {
  await initializeMemoryDatabase();

  const now = new Date().toISOString();
  await memoryDb.execute(
    `INSERT INTO memory_conflicts 
      (id, memory_a_id, memory_b_id, memory_a_excerpt, memory_b_excerpt, reason, detected_at, resolution, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conflict.id, conflict.memoryAId, conflict.memoryBId, conflict.memoryAExcerpt,
      conflict.memoryBExcerpt, conflict.reason, now, conflict.resolution, null
    ] as (string | number | Uint8Array)[]
  );

  return { ...conflict, detectedAt: new Date(now) };
}

export async function findConflictById(id: string): Promise<MemoryConflict | null> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM memory_conflicts WHERE id = ?", [id]);

  if (!result.rows?.length) return null;
  return mapRowToConflict(result.rows[0] as Record<string, unknown>);
}

export async function findPendingConflicts(): Promise<MemoryConflict[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM memory_conflicts WHERE resolution = 'pending' ORDER BY detected_at DESC"
  );

  return result.rows?.map(row => mapRowToConflict(row as Record<string, unknown>)) || [];
}

export async function findConflictsByMemory(memoryId: string): Promise<MemoryConflict[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM memory_conflicts WHERE memory_a_id = ? OR memory_b_id = ? ORDER BY detected_at DESC",
    [memoryId, memoryId]
  );

  return result.rows?.map(row => mapRowToConflict(row as Record<string, unknown>)) || [];
}

export async function resolveConflict(id: string, resolution: MemoryConflict["resolution"]): Promise<MemoryConflict | null> {
  await initializeMemoryDatabase();
  const now = new Date().toISOString();

  await memoryDb.execute(
    "UPDATE memory_conflicts SET resolution = ?, resolved_at = ? WHERE id = ?",
    [resolution, now, id]
  );

  return findConflictById(id);
}

export async function deleteConflictById(id: string): Promise<void> {
  await initializeMemoryDatabase();
  await memoryDb.execute("DELETE FROM memory_conflicts WHERE id = ?", [id]);
}

function mapRowToConflict(row: Record<string, unknown>): MemoryConflict {
  return {
    id: String(row.id),
    memoryAId: String(row.memory_a_id),
    memoryBId: String(row.memory_b_id),
    memoryAExcerpt: String(row.memory_a_excerpt),
    memoryBExcerpt: String(row.memory_b_excerpt),
    reason: String(row.reason),
    detectedAt: new Date(String(row.detected_at)),
    resolution: String(row.resolution) as MemoryConflict["resolution"],
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : undefined,
  };
}
