#!/usr/bin/env node
/**
 * One-shot migration of the deprecated custom memory tables
 * (semantic_memories, decisions, procedures) into the unified Mastra
 * working memory (resource-scoped blocks, deterministic field mapping,
 * provenance preserved). Episodes are NOT migrated: they are reconstructed
 * by observational memory from the persisted message history.
 *
 * Usage:
 *   npx tsx scripts/migrate-custom-memory.ts                  # real migration (resource "anonymous")
 *   npx tsx scripts/migrate-custom-memory.ts --dry-run        # show the mapping without writing
 *   npx tsx scripts/migrate-custom-memory.ts --resource u-42  # target a specific resourceId
 *
 * After a successful run, migrated rows are marked `superseded` so the old
 * tables stay readable as an audit trail (TASK-011/TASK-012 of
 * plan/refactor-memory-mastra-unification-1.md).
 */
import { createClient } from "@libsql/client";

interface FlagOptions {
  dryRun: boolean;
  resource: string;
}

function parseArgs(argv: string[]): FlagOptions {
  const options: FlagOptions = { dryRun: false, resource: "anonymous" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--resource" && argv[i + 1]) {
      options.resource = argv[i + 1];
      i++;
    } else if (arg === "--help") {
      console.log(
        "Usage: npx tsx scripts/migrate-custom-memory.ts [--dry-run] [--resource <resourceId>]",
      );
      process.exit(0);
    }
  }
  return options;
}

interface SourceRow {
  subject: string;
  predicate: string;
  value: string;
  source_type: string;
  source_reference: string | null;
  id: string;
}

interface DecisionRow {
  id: string;
  title: string;
  context: string;
  alternatives: string;
  decision: string;
  rationale: string;
}

interface ProcedureRow {
  id: string;
  name: string;
  purpose: string;
  steps: string;
}

function hasTable(db: ReturnType<typeof createClient>, name: string): Promise<boolean> {
  return db
    .execute("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name])
    .then((r) => r.rows.length > 0);
}

async function loadFacts(db: ReturnType<typeof createClient>): Promise<SourceRow[]> {
  const result = await db.execute(
    "SELECT id, subject, predicate, value, source_type, source_reference FROM semantic_memories WHERE status = 'active' ORDER BY updated_at ASC",
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    subject: String(row.subject),
    predicate: String(row.predicate),
    value: String(row.value),
    source_type: String(row.source_type),
    source_reference: row.source_reference == null ? null : String(row.source_reference),
  }));
}

async function loadDecisions(db: ReturnType<typeof createClient>): Promise<DecisionRow[]> {
  const result = await db.execute(
    "SELECT id, title, context, alternatives, decision, rationale FROM decisions WHERE status = 'accepted' ORDER BY updated_at ASC",
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    context: String(row.context),
    alternatives: String(row.alternatives),
    decision: String(row.decision),
    rationale: String(row.rationale),
  }));
}

async function loadProcedures(db: ReturnType<typeof createClient>): Promise<ProcedureRow[]> {
  const result = await db.execute(
    "SELECT id, name, purpose, steps FROM procedures ORDER BY updated_at ASC",
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    purpose: String(row.purpose),
    steps: String(row.steps),
  }));
}

function provenance(type: string, reference: string | null): string {
  return reference ? ` (source: ${type} · ${reference})` : ` (source: ${type})`;
}

function buildWorkingMemory(
  facts: SourceRow[],
  decisions: DecisionRow[],
  procedures: ProcedureRow[],
): string {
  const blocks: string[] = [];

  const faits = facts
    .filter((f) => f.predicate !== "prefers")
    .map((f) => `- ${f.subject}: ${f.value}${provenance(f.source_type, f.source_reference)}`);
  if (faits.length) blocks.push(`# Faits\n${faits.join("\n")}`);

  const preferences = facts
    .filter((f) => f.predicate === "prefers")
    .map((f) => `- ${f.subject}: ${f.value}${provenance(f.source_type, f.source_reference)}`);
  if (preferences.length) blocks.push(`# Préférences\n${preferences.join("\n")}`);

  const decisionsLines = decisions.map(
    (d) =>
      `- Décision: ${d.title} | Contexte: ${d.context} | Raison: ${d.rationale} | Alternative: ${d.alternatives}${provenance("decision", d.id)}`,
  );
  if (decisionsLines.length) blocks.push(`# Décisions\n${decisionsLines.join("\n")}`);

  const proceduresLines = procedures.map(
    (p) => `- Procédure: ${p.name} | But: ${p.purpose} | Étapes: ${p.steps}${provenance("procedure", p.id)}`,
  );
  if (proceduresLines.length) blocks.push(`# Procédures\n${proceduresLines.join("\n")}`);

  return blocks.join("\n\n");
}

async function markSuperseded(db: ReturnType<typeof createClient>): Promise<void> {
  const facts = await loadFacts(db);
  const decisions = await loadDecisions(db);
  if (facts.length) {
    await db.execute(
      `UPDATE semantic_memories SET status = 'superseded', updated_at = updated_at WHERE id IN (${facts
        .map(() => "?")
        .join(", ")})`,
      facts.map((f) => f.id),
    );
  }
  if (decisions.length) {
    await db.execute(
      `UPDATE decisions SET status = 'superseded', updated_at = updated_at WHERE id IN (${decisions
        .map(() => "?")
        .join(", ")})`,
      decisions.map((d) => d.id),
    );
  }
}

async function main(): Promise<void> {
  const { dryRun, resource } = parseArgs(process.argv.slice(2));
  const url = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
  const token = process.env.TURSO_AUTH_TOKEN;
  const db = createClient({ url, authToken: token });

  if (!(await hasTable(db, "semantic_memories"))) {
    console.log("No custom memory tables found — nothing to migrate.");
    return;
  }

  const facts = await loadFacts(db);
  const decisions = await loadDecisions(db);
  const procedures = await loadProcedures(db);

  console.log(
    `[migrate] loaded: ${facts.length} semantic memories, ${decisions.length} decisions, ${procedures.length} procedures`,
  );

  const workingMemory = buildWorkingMemory(facts, decisions, procedures);
  if (!workingMemory) {
    console.log("[migrate] nothing active to migrate.");
    return;
  }

  console.log(`[migrate] target working memory (resource: ${resource}, dry-run: ${dryRun}):`);
  console.log("----------------------------------------------------------------");
  console.log(workingMemory);
  console.log("----------------------------------------------------------------");

  if (!dryRun) {
    // Lazy import so `--dry-run` works without OmniRoute env vars.
    const { buildCompanionMemory } = await import("../src/mastra/agents/companion/memory");
    const memory = buildCompanionMemory();
    // Working memory is resource-scoped; the canonical thread for a resource
    // without explicit threads is the resource id itself.
    await memory.updateWorkingMemory({
      threadId: resource,
      resourceId: resource,
      workingMemory,
    });
    await markSuperseded(db);
    console.log(`[migrate] written for resource "${resource}" and old rows marked superseded.`);
  } else {
    console.log("[migrate] dry-run: nothing written.");
  }

  db.close();
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});