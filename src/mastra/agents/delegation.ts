// Delegation contract between Main Agent and Memory Agent

export type MemoryOperation = 
  | "retrieve"
  | "remember"
  | "update"
  | "forget"
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

// Build delegation prompt for the Memory Agent
export function buildMemoryDelegationPrompt(task: MemoryTask): string {
  const { operation, objective, scope, context } = task;

  let prompt = `Memory Task #${task.taskId}\n`;
  prompt += `Operation: ${operation}\n`;
  prompt += `Objective: ${objective}\n`;

  if (scope) {
    prompt += `\nScope:\n`;
    if (scope.project) prompt += `- Project: ${scope.project}\n`;
    if (scope.repository) prompt += `- Repository: ${scope.repository}\n`;
    if (scope.task) prompt += `- Task: ${scope.task}\n`;
  }

  if (context) {
    prompt += `\nContext:\n${JSON.stringify(context, null, 2)}\n`;
  }

  prompt += `\nExecute this memory operation and return the result in this format:\n`;
  prompt += `{
  "status": "success" | "partial" | "failed" | "blocked",
  "memories": [...],
  "conflicts": [...],
  "summary": "brief description of what was done",
  "confidence": 0.0-1.0,
  "warnings": ["any warnings"]
}`;

  return prompt;
}

// Parse Memory Agent response
export function parseMemoryTaskResult(response: string): MemoryTaskResult {
  try {
    const parsed = JSON.parse(response);
    return {
      taskId: parsed.taskId || "unknown",
      status: parsed.status || "failed",
      memories: parsed.memories,
      conflicts: parsed.conflicts,
      procedures: parsed.procedures,
      decisions: parsed.decisions,
      episodes: parsed.episodes,
      warnings: parsed.warnings,
      summary: parsed.summary || "",
      confidence: parsed.confidence || 0.5,
    };
  } catch {
    return {
      taskId: "parse-error",
      status: "failed",
      summary: "Failed to parse Memory Agent response",
      confidence: 0,
    };
  }
}
