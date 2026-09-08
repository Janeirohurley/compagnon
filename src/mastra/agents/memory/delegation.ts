// Delegation contract between the Main Agent / plan executor and the Memory Agent.
// The Memory Agent is instructed to use its native tools (memory_find/store/forget)
// and to answer in a strict two-line format (STATUS + SUMMARY). No free-form JSON.
export type MemoryOperation =
  | "find"
  | "store"
  | "forget"
  | "retrieve"
  | "remember"
  | "update"
  | "record_episode"
  | "record_decision"
  | "get_procedure"
  | "verify"
  | "consolidate"
  | "extract";

export interface MemoryTaskScope {
  project?: string;
  repository?: string;
  task?: string;
}

export interface MemoryTask {
  taskId: string;
  operation: MemoryOperation;
  objective: string;
  scope?: MemoryTaskScope;
  context?: unknown;
  expectedOutput?: string;
}

export interface MemoryTaskResult {
  taskId: string;
  status: "success" | "partial" | "failed" | "blocked";
  memories?: unknown[];
  conflicts?: unknown[];
  procedures?: unknown[];
  decisions?: unknown[];
  episodes?: unknown[];
  warnings?: string[];
  summary: string;
  confidence: number;
}

type NativeOperation = "find" | "store" | "forget";

const OPERATION_TO_NATIVE: Record<MemoryOperation, NativeOperation> = {
  find: "find",
  retrieve: "find",
  get_procedure: "find",
  verify: "find",
  store: "store",
  remember: "store",
  update: "store",
  record_episode: "store",
  record_decision: "store",
  extract: "store",
  consolidate: "store",
  forget: "forget",
};

const NATIVE_TASK_NOTES: Record<NativeOperation, string> = {
  find: "Search relevant context and report what is actually found.",
  store: "Persist the durable information into the appropriate labeled block.",
  forget: "Remove the requested memory (whole labeled block or a keyed line).",
};

// Build delegation prompt for the Memory Agent (typed tool + strict answer format)
export function buildMemoryDelegationPrompt(task: MemoryTask): string {
  const { operation, objective, scope, context } = task;
  const native = OPERATION_TO_NATIVE[operation] ?? "store";

  let prompt = `Memory Task #${task.taskId}\n`;
  prompt += `Objective: ${objective}\n`;
  prompt += `Operation: memory_${native}\n`;

  if (scope) {
    prompt += `\nScope:\n`;
    if (scope.project) prompt += `- Project: ${scope.project}\n`;
    if (scope.repository) prompt += `- Repository: ${scope.repository}\n`;
    if (scope.task) prompt += `- Task: ${scope.task}\n`;
  }

  if (context) {
    prompt += `\nContext:\n${JSON.stringify(context)}\n`;
  }

  if (task.expectedOutput) {
    prompt += `\nExpected output: ${task.expectedOutput}\n`;
  }

  prompt += `\n${NATIVE_TASK_NOTES[native]}\n`;
  prompt += `\nRespond with EXACTLY two lines and nothing else (no JSON, no fences):\n`;
  prompt += `STATUS: success | partial | failed | blocked\n`;
  prompt += `SUMMARY: <one concise line describing what was done / found>`;

  return prompt;
}

// Parse the memory agent's strict STATUS/SUMMARY answer - never JSON.
export function parseMemoryTaskResult(response: string): MemoryTaskResult {
  const statusMatch = response.match(/STATUS:\s*(success|partial|failed|blocked)/i);
  const summaryMatch = response.match(/SUMMARY:\s*(.+)/i);
  const status = statusMatch?.[1]?.toLowerCase() as
    | "success"
    | "partial"
    | "failed"
    | "blocked"
    | undefined;

  if (!status) {
    return {
      taskId: "parse-error",
      status: "failed",
      summary: response.substring(0, 200),
      confidence: 0,
    };
  }

  return {
    taskId: "unknown",
    status,
    summary: summaryMatch?.[1]?.trim().substring(0, 500) || "No summary provided.",
    confidence: status === "success" ? 1 : status === "partial" ? 0.6 : 0,
  };
}