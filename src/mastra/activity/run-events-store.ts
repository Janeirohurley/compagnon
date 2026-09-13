// Raw agent-movement persistence (feature-activity).
//
// The chat / approval SSE streams carry AI SDK v5 UI-message chunks
// (tool-input-start, tool-input-delta, tool-output-available, tool-output-error,
// start-step, finish-step, text-*, data-*, approval, error, ...). Each chunk is
// normalized into a compact event row and appended to the thread's run log so
// the UI can replay exactly what the agent did, even after the turn is over.
import { createClient, type Client } from "@libsql/client";

export type RunEventKind =
  | "start"
  | "step"
  | "reasoning"
  | "tool-input"
  | "tool-output"
  | "tool-agent"
  | "approval"
  | "compaction"
  | "text"
  | "finish"
  | "error"
  | "other";

/** One raw movement of the agent, tree-shaken from a stream chunk. */
export type RunEventInput = {
  threadId: string;
  resourceId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  runId?: string | null;
  kind: RunEventKind;
  step?: number | null;
  toolCallId?: string | null;
  toolName?: string | null;
  /** The original SSE chunk, kept verbatim ("tout brut"). */
  data: unknown;
  createdAt?: string;
};

export type RunEvent = Required<Pick<RunEventInput, "threadId">> &
  RunEventInput & {
    id: string;
    createdAt: string;
  };

const DB_URL = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

function newClient(): Client {
  return createClient({ url: DB_URL, authToken: DB_TOKEN || undefined });
}

let db: Client | undefined;
let initialized: Promise<void> | undefined;

function instance(): Client {
  db ??= newClient();
  return db;
}

async function ready(): Promise<void> {
  initialized ??= (async () => {
    await instance().execute(`
      CREATE TABLE IF NOT EXISTS compagnon_run_events (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        resource_id TEXT,
        workspace_id TEXT,
        project_id TEXT,
        run_id TEXT,
        kind TEXT NOT NULL,
        step INTEGER,
        tool_call_id TEXT,
        tool_name TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await instance().execute(
      "CREATE INDEX IF NOT EXISTS idx_run_events_thread ON compagnon_run_events (thread_id, created_at)",
    );
  })();
  await initialized;
}

function rowToRunEvent(row: Record<string, unknown>): RunEvent {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    resourceId: row.resource_id == null ? null : String(row.resource_id),
    workspaceId: row.workspace_id == null ? null : String(row.workspace_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    runId: row.run_id == null ? null : String(row.run_id),
    kind: String(row.kind) as RunEventKind,
    step: row.step == null ? null : Number(row.step),
    toolCallId: row.tool_call_id == null ? null : String(row.tool_call_id),
    toolName: row.tool_name == null ? null : String(row.tool_name),
    data: parseData(row.data),
    createdAt: String(row.created_at),
  };
}

function parseData(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function appendRunEvents(events: RunEventInput[]): Promise<number> {
  if (events.length === 0) return 0;
  await ready();
  const rows = events.map((e) => ({
    id: globalThis.crypto.randomUUID(),
    threadId: e.threadId,
    resourceId: e.resourceId ?? null,
    workspaceId: e.workspaceId ?? null,
    projectId: e.projectId ?? null,
    runId: e.runId ?? null,
    kind: e.kind,
    step: e.step ?? null,
    toolCallId: e.toolCallId ?? null,
    toolName: e.toolName ?? null,
    data: JSON.stringify(e.data),
    createdAt: e.createdAt ?? new Date().toISOString(),
  }));
  await instance().batch(
    rows.map((r) => ({
      sql: `INSERT INTO compagnon_run_events
        (id, thread_id, resource_id, workspace_id, project_id, run_id, kind, step, tool_call_id, tool_name, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        r.threadId,
        r.resourceId,
        r.workspaceId,
        r.projectId,
        r.runId,
        r.kind,
        r.step,
        r.toolCallId,
        r.toolName,
        r.data,
        r.createdAt,
      ],
    })),
  );
  return rows.length;
}

export async function listRunEvents(threadId: string): Promise<RunEvent[]> {
  await ready();
  const result = await instance().execute(
    "SELECT * FROM compagnon_run_events WHERE thread_id = ? ORDER BY created_at ASC, rowid ASC",
    [threadId],
  );
  return (result.rows as Record<string, unknown>[]).map(rowToRunEvent);
}

export async function deleteRunEventsForThread(threadId: string): Promise<void> {
  await ready();
  await instance().execute("DELETE FROM compagnon_run_events WHERE thread_id = ?", [threadId]);
}

const KIND_BY_TYPE: Record<string, RunEventKind> = {
  start: "start",
  "start-step": "step",
  "finish-step": "step",
  "reasoning-start": "reasoning",
  "reasoning-delta": "reasoning",
  "reasoning-end": "reasoning",
  "tool-input-start": "tool-input",
  "tool-input-delta": "tool-input",
  "tool-input-available": "tool-input",
  "tool-input-end": "tool-input",
  "tool-output-available": "tool-output",
  "tool-output-delta": "tool-output",
  "tool-output-end": "tool-output",
  "tool-output-denied": "tool-output",
  "tool-output-error": "tool-output",
  "tool-call-approval": "approval",
  "data-tool-call-approval": "approval",
  compaction: "compaction",
  "compaction_delta": "compaction",
  "data-om-status": "other",
  "text-start": "text",
  "text-delta": "text",
  "text-end": "text",
  finish: "finish",
  error: "error",
};

/**
 * Normalize one SSE chunk into a persistable run event. Returns null for
 * frames without a type (never expected) or for protocol noise we don't want
 * to retain.
 */
export function toRunEventInput(
  chunk: unknown,
  meta: { threadId: string; resourceId?: string | null; workspaceId?: string | null; projectId?: string | null },
): RunEventInput | null {
  if (!chunk || typeof chunk !== "object") return null;
  const c = chunk as Record<string, unknown>;
  const type = c.type;
  if (typeof type !== "string") return null;

  const kind = KIND_BY_TYPE[type] ?? "other";
  const toolCallId = typeof c.toolCallId === "string" ? c.toolCallId : null;
  const toolName =
    typeof c.toolName === "string"
      ? c.toolName
      : typeof (c.toolInputStart as Record<string, unknown> | undefined)?.toolName === "string"
        ? String((c.toolInputStart as Record<string, unknown>).toolName)
        : null;
  const step =
    typeof c.step === "number"
      ? c.step
      : typeof (c.toolInputStart as Record<string, unknown> | undefined)?.step === "number"
        ? Number((c.toolInputStart as Record<string, unknown>).step)
        : null;

  return {
    threadId: meta.threadId,
    resourceId: meta.resourceId ?? null,
    workspaceId: meta.workspaceId ?? null,
    projectId: meta.projectId ?? null,
    kind,
    step,
    toolCallId,
    toolName,
    data: c,
  };
}