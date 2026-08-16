// Decision Repository - Data access layer
import { memoryDb, initializeMemoryDatabase } from "../storage/client";
import type { Decision } from "../domain/types";

export async function createDecision(decision: Omit<Decision, "createdAt" | "updatedAt">): Promise<Decision> {
  await initializeMemoryDatabase();

  const now = new Date().toISOString();
  await memoryDb.execute(
    `INSERT INTO decisions 
      (id, project, repository, title, context, alternatives, decision, rationale, status, superseded_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      decision.id, decision.project || null, decision.repository || null, decision.title,
      decision.context, JSON.stringify(decision.alternatives), decision.decision,
      decision.rationale, decision.status, decision.supersededBy || null, now, now
    ] as (string | number | Uint8Array)[]
  );

  return { ...decision, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function findDecisionById(id: string): Promise<Decision | null> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM decisions WHERE id = ?", [id]);

  if (!result.rows?.length) return null;
  return mapRowToDecision(result.rows[0] as Record<string, unknown>);
}

export async function findDecisionsByProject(project: string): Promise<Decision[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM decisions WHERE project = ? ORDER BY created_at DESC",
    [project]
  );

  return result.rows?.map(row => mapRowToDecision(row as Record<string, unknown>)) || [];
}

export async function findDecisionsByRepository(repository: string): Promise<Decision[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM decisions WHERE repository = ? ORDER BY created_at DESC",
    [repository]
  );

  return result.rows?.map(row => mapRowToDecision(row as Record<string, unknown>)) || [];
}

export async function findAllDecisions(): Promise<Decision[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM decisions ORDER BY created_at DESC");

  return result.rows?.map(row => mapRowToDecision(row as Record<string, unknown>)) || [];
}

export async function updateDecisionById(id: string, updates: Partial<Decision>): Promise<Decision | null> {
  await initializeMemoryDatabase();

  const fields: string[] = ["updated_at = ?"];
  const args: (string | number | Uint8Array)[] = [new Date().toISOString()];

  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.supersededBy !== undefined) { fields.push("superseded_by = ?"); args.push(updates.supersededBy ?? ""); }

  args.push(id);
  await memoryDb.execute(`UPDATE decisions SET ${fields.join(", ")} WHERE id = ?`, args);

  return findDecisionById(id);
}

export async function deleteDecisionById(id: string): Promise<void> {
  await initializeMemoryDatabase();
  await memoryDb.execute("DELETE FROM decisions WHERE id = ?", [id]);
}

function mapRowToDecision(row: Record<string, unknown>): Decision {
  return {
    id: String(row.id),
    project: row.project ? String(row.project) : undefined,
    repository: row.repository ? String(row.repository) : undefined,
    title: String(row.title),
    context: String(row.context),
    alternatives: JSON.parse(String(row.alternatives)),
    decision: String(row.decision),
    rationale: String(row.rationale),
    status: String(row.status) as Decision["status"],
    supersededBy: row.superseded_by ? String(row.superseded_by) : undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}
