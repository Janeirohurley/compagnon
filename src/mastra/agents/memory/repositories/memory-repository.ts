// Semantic Memory Repository - Data access layer
import { memoryDb, initializeMemoryDatabase } from "../storage/client";
import type { SemanticMemory, MemoryScope, MemoryStatus, SourceType } from "../domain/types";

export async function createMemory(memory: Omit<SemanticMemory, "createdAt" | "updatedAt">): Promise<SemanticMemory> {
  await initializeMemoryDatabase();

  const now = new Date().toISOString();
  await memoryDb.execute(
    `INSERT INTO semantic_memories 
      (id, scope, scope_id, subject, predicate, value, confidence, source_type, source_reference, created_at, updated_at, status, use_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      memory.id, memory.scope, memory.scopeId || null, memory.subject, memory.predicate,
      memory.value, memory.confidence, memory.source.type, memory.source.reference || null,
      now, now, memory.status, memory.useCount
    ] as (string | number | Uint8Array)[]
  );

  return { ...memory, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function findMemoryById(id: string): Promise<SemanticMemory | null> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM semantic_memories WHERE id = ?", [id]);

  if (!result.rows?.length) return null;
  return mapRowToMemory(result.rows[0] as Record<string, unknown>);
}

export async function findMemoriesByScope(scope: MemoryScope, scopeId?: string): Promise<SemanticMemory[]> {
  await initializeMemoryDatabase();

  let sql = "SELECT * FROM semantic_memories WHERE status != 'archived'";
  const args: (string | number | Uint8Array)[] = [];

  if (scope) {
    sql += " AND scope = ?";
    args.push(scope);
    if (scopeId) {
      sql += " AND scope_id = ?";
      args.push(scopeId);
    }
  }

  sql += " ORDER BY updated_at DESC";
  const result = await memoryDb.execute(sql, args);

  return result.rows?.map(row => mapRowToMemory(row as Record<string, unknown>)) || [];
}

export async function findMemoriesBySubject(subject: string, scope?: MemoryScope): Promise<SemanticMemory[]> {
  await initializeMemoryDatabase();

  let sql = "SELECT * FROM semantic_memories WHERE subject LIKE ? AND status != 'archived'";
  const args: (string | number | Uint8Array)[] = [`%${subject}%`];

  if (scope) {
    sql += " AND scope = ?";
    args.push(scope);
  }

  const result = await memoryDb.execute(sql, args);
  return result.rows?.map(row => mapRowToMemory(row as Record<string, unknown>)) || [];
}

export async function updateMemoryById(id: string, updates: Partial<SemanticMemory>): Promise<SemanticMemory | null> {
  await initializeMemoryDatabase();

  const fields: string[] = ["updated_at = ?"];
  const args: (string | number | Uint8Array)[] = [new Date().toISOString()];

  if (updates.value !== undefined) { fields.push("value = ?"); args.push(updates.value); }
  if (updates.confidence !== undefined) { fields.push("confidence = ?"); args.push(updates.confidence); }
  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.lastVerifiedAt !== undefined) { fields.push("last_verified_at = ?"); args.push(updates.lastVerifiedAt.toISOString()); }
  if (updates.lastUsedAt !== undefined) { fields.push("last_used_at = ?"); args.push(updates.lastUsedAt.toISOString()); }

  args.push(id);
  await memoryDb.execute(`UPDATE semantic_memories SET ${fields.join(", ")} WHERE id = ?`, args);

  return findMemoryById(id);
}

export async function deleteMemoryById(id: string): Promise<void> {
  await initializeMemoryDatabase();
  await memoryDb.execute("DELETE FROM semantic_memories WHERE id = ?", [id]);
}

export async function archiveMemoryById(id: string): Promise<SemanticMemory | null> {
  return updateMemoryById(id, { status: "archived" });
}

export async function supersedeMemoryById(id: string): Promise<SemanticMemory | null> {
  return updateMemoryById(id, { status: "superseded" });
}

export async function findStaleMemories(daysThreshold: number): Promise<SemanticMemory[]> {
  await initializeMemoryDatabase();
  const threshold = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();

  const result = await memoryDb.execute(
    `SELECT * FROM semantic_memories 
     WHERE (last_verified_at IS NULL OR last_verified_at < ?) 
     AND status = 'active'`,
    [threshold]
  );

  return result.rows?.map(row => mapRowToMemory(row as Record<string, unknown>)) || [];
}

function mapRowToMemory(row: Record<string, unknown>): SemanticMemory {
  return {
    id: String(row.id),
    scope: String(row.scope) as MemoryScope,
    scopeId: row.scope_id ? String(row.scope_id) : undefined,
    subject: String(row.subject),
    predicate: String(row.predicate),
    value: String(row.value),
    confidence: Number(row.confidence),
    source: {
      type: String(row.source_type) as SourceType,
      reference: row.source_reference ? String(row.source_reference) : undefined,
    },
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)) : undefined,
    lastVerifiedAt: row.last_verified_at ? new Date(String(row.last_verified_at)) : undefined,
    status: String(row.status) as MemoryStatus,
    useCount: Number(row.use_count),
  };
}
