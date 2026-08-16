// Procedure Repository - Data access layer
import { memoryDb, initializeMemoryDatabase } from "../storage/client";
import type { Procedure, ProcedureInput, UpdateProcedureInput } from "../domain/types";

export async function createProcedure(input: ProcedureInput): Promise<Procedure> {
  await initializeMemoryDatabase();

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await memoryDb.execute(
    `INSERT INTO procedures 
      (id, name, purpose, prerequisites, steps, failure_modes, success_count, failure_count, confidence, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.name, input.purpose, JSON.stringify(input.prerequisites), JSON.stringify(input.steps),
      input.failureModes ? JSON.stringify(input.failureModes) : null, 0, 0, 0.5, "[]", now, now
    ] as (string | number | Uint8Array)[]
  );

  return {
    id, name: input.name, purpose: input.purpose, prerequisites: input.prerequisites,
    steps: input.steps, failureModes: input.failureModes, successCount: 0, failureCount: 0,
    confidence: 0.5, source: [], createdAt: new Date(now), updatedAt: new Date(now),
  };
}

export async function findProcedureById(id: string): Promise<Procedure | null> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM procedures WHERE id = ?", [id]);

  if (!result.rows?.length) return null;
  return mapRowToProcedure(result.rows[0] as Record<string, unknown>);
}

export async function findProcedureByName(name: string): Promise<Procedure | null> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM procedures WHERE name = ?", [name]);

  if (!result.rows?.length) return null;
  return mapRowToProcedure(result.rows[0] as Record<string, unknown>);
}

export async function findAllProcedures(): Promise<Procedure[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM procedures ORDER BY updated_at DESC");

  return result.rows?.map(row => mapRowToProcedure(row as Record<string, unknown>)) || [];
}

export async function updateProcedureById(id: string, input: UpdateProcedureInput): Promise<Procedure | null> {
  await initializeMemoryDatabase();

  const fields: string[] = ["updated_at = ?"];
  const args: (string | number | Uint8Array)[] = [new Date().toISOString()];

  if (input.purpose !== undefined) { fields.push("purpose = ?"); args.push(input.purpose); }
  if (input.steps !== undefined) { fields.push("steps = ?"); args.push(JSON.stringify(input.steps)); }
  if (input.failureModes !== undefined) { fields.push("failure_modes = ?"); args.push(JSON.stringify(input.failureModes)); }
  if (input.successCount !== undefined) { fields.push("success_count = ?"); args.push(input.successCount); }
  if (input.failureCount !== undefined) { fields.push("failure_count = ?"); args.push(input.failureCount); }
  if (input.confidence !== undefined) { fields.push("confidence = ?"); args.push(input.confidence); }

  args.push(id);
  await memoryDb.execute(`UPDATE procedures SET ${fields.join(", ")} WHERE id = ?`, args);

  return findProcedureById(id);
}

export async function deleteProcedureById(id: string): Promise<void> {
  await initializeMemoryDatabase();
  await memoryDb.execute("DELETE FROM procedures WHERE id = ?", [id]);
}

function mapRowToProcedure(row: Record<string, unknown>): Procedure {
  return {
    id: String(row.id),
    name: String(row.name),
    purpose: String(row.purpose),
    prerequisites: JSON.parse(String(row.prerequisites)),
    steps: JSON.parse(String(row.steps)),
    failureModes: row.failure_modes ? JSON.parse(String(row.failure_modes)) : undefined,
    successCount: Number(row.success_count),
    failureCount: Number(row.failure_count),
    confidence: Number(row.confidence),
    source: JSON.parse(String(row.source)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}
