// Plan Executor Workflow - executes a planner plan batch by batch with progressive validation
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { planeAgent } from "../agents/plane";
import { outlineAgent } from "../agents/outline";
import { notionAgent } from "../agents/notion";
import { githubAgent } from "../agents/github";
import { memoryAgent } from "../agents/memory";
import { researchAgent, runResearch, formatResearchSummary } from "../agents/research";
import type { ResearchResult } from "../agents/research/domain/types";
import { executionPlanSchema } from "../agents/planner/domain/schemas";
import type { ExecutionPlan } from "../agents/planner/domain/types";

// ---------------------------------------------------------------------------
// Agent routing
// ---------------------------------------------------------------------------

interface ExecutorAgent {
  generate: (
    prompt: string,
    options?: {
      structuredOutput?: {
        schema: z.ZodTypeAny;
        jsonPromptInjection?: "auto" | "system" | "inline" | boolean;
      };
    },
  ) => Promise<{ text?: string; object?: unknown }>;
}

const SPECIALIST_AGENTS: Record<string, { agent: ExecutorAgent; id: string }> = {
  plane: { agent: planeAgent, id: "plane" },
  outline: { agent: outlineAgent, id: "outline" },
  documentation: { agent: outlineAgent, id: "outline" },
  notion: { agent: notionAgent, id: "notion" },
  github: { agent: githubAgent, id: "github" },
  memory: { agent: memoryAgent, id: "memory" },
  research: { agent: researchAgent, id: "research" },
};

let _companionAgent: ExecutorAgent | null = null;
async function getCompanionAgent(): Promise<ExecutorAgent> {
  if (!_companionAgent) {
    const { companionAgent } = await import("../agents/companion/agent");
    _companionAgent = companionAgent;
  }
  return _companionAgent;
}

/**
 * Maps a planner suggestedAgent to the canonical executing agent id.
 * Pure and exported for testing. Unknown entries fall back to "companion".
 */
export function resolveSuggestedAgentId(suggestedAgent?: string): string {
  const suggested = (suggestedAgent ?? "companion").toLowerCase().trim();
  return SPECIALIST_AGENTS[suggested]?.id ?? "companion";
}

interface ResolvedAgent {
  id: string;
  getAgent: () => Promise<ExecutorAgent>;
}

function resolveTaskAgent(
  task: ExecutionPlan["tasks"][number],
): ResolvedAgent {
  const suggested = (task.suggestedAgent ?? "companion").toLowerCase().trim();
  const specialist = SPECIALIST_AGENTS[suggested];

  if (specialist) {
    return { id: specialist.id, getAgent: () => Promise.resolve(specialist.agent) };
  }

  return { id: "companion", getAgent: getCompanionAgent };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const acceptanceResultSchema = z.object({
  criterion: z.string(),
  met: z.boolean(),
  evidence: z.string(),
});

export const taskExecutionResultSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  status: z.enum(["completed", "failed", "skipped"]),
  output: z.string(),
  acceptance: z.array(acceptanceResultSchema),
  error: z.string().optional(),
  agent: z.string().optional(),
});

export type TaskExecutionResult = z.infer<typeof taskExecutionResultSchema>;

const executorOptionsSchema = z.object({
  stopOnFirstFailure: z.boolean().optional().default(false),
});

const planResultSchema = z.enum(["success", "partial", "blocked", "failed"]);

const workflowInputSchema = z.object({
  plan: executionPlanSchema,
  options: executorOptionsSchema,
});

const prepareOutputSchema = z.object({
  plan: executionPlanSchema,
  batches: z.array(z.array(z.string())),
  stopOnFirstFailure: z.boolean(),
});

const executeOutputSchema = z.object({
  plan: executionPlanSchema,
  results: z.array(taskExecutionResultSchema),
  completedIds: z.array(z.string()),
  failedIds: z.array(z.string()),
  skippedIds: z.array(z.string()),
  stopped: z.boolean(),
});

const reportOutputSchema = z.object({
  status: planResultSchema,
  summary: z.string(),
  completed: z.number(),
  failed: z.number(),
  skipped: z.number(),
  total: z.number(),
  stopped: z.boolean(),
  results: z.array(taskExecutionResultSchema),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParse(value: string): unknown {
  try {
    JSON.parse(value);
    return value;
  } catch {
    return null;
  }
}

function extractJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = tryParse(trimmed);
  if (direct !== null) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (tryParse(inner) !== null) return inner;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    if (tryParse(slice) !== null) return slice;
  }

  return null;
}

function extractTextFromResponse(response: unknown): string {
  const resp = response as {
    text?: unknown;
  };

  if (typeof resp === "string") return resp;
  if (typeof resp?.text === "string") return resp.text;
  if (typeof resp?.text === "function") {
    const text = (resp.text as () => unknown)();
    if (text && typeof (text as { then?: unknown }).then === "function") {
      return "[Async response, falling back to empty result]";
    }
    return String(text);
  }
  return String(resp?.text ?? JSON.stringify(resp ?? ""));
}

function buildTaskPrompt(plan: ExecutionPlan, task: ExecutionPlan["tasks"][number]): string {
  const context = plan.context ? `CONTEXT:\n${plan.context}\n\n` : "";

  const acceptanceList = task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const routedAgent = (task.suggestedAgent ?? "companion").toLowerCase().trim();

  return `You are the agent assigned to execute ONE task from a validated execution plan. Complete ONLY this task.

PLAN OBJECTIVE: ${plan.objective}
PLAN SUMMARY: ${plan.summary}
${context}TASK TO EXECUTE:
- Title: ${task.title}
- Description: ${task.description}
- Type: ${task.type}
- Priority: ${task.priority}
- Complexity: ${task.complexity}
- Resources: ${task.resources.join(", ") || "none"}
- Expected outputs: ${task.expectedOutputs.join(", ") || "none"}
- Assigned to you because: ${routedAgent}
- Risks to watch: ${task.risks.join("; ") || "none"}

ACCEPTANCE CRITERIA (you MUST satisfy all of them):
${acceptanceList}

EXECUTE the task now using ONLY the tools strictly necessary for this specific task (for example, read a file, run a search, write to a specific location).
Do NOT use memory_search, memory_remember, memory_update, memory_forget, memory_hooks, memory_record_episode, memory_record_decision, or any memory tool.
Do NOT delegate to any subagent.
Do NOT call plan_executor, request_plan, memory_workflow, or any planning/delegation tool.
Do NOT ask for confirmation.
Once the task is done, respond with the JSON contract below.

When finished, respond with EXACTLY ONE JSON object and nothing else (no markdown fences):

{
  "output": "concise summary of what was actually done/produced",
  "acceptance": [
    { "criterion": "exact text of acceptance criterion 1", "met": true, "evidence": "how the criterion was satisfied" },
    { "criterion": "exact text of acceptance criterion 2", "met": false, "evidence": "what is still missing" }
  ]
}

Each acceptance entry must map 1:1 to the acceptance criteria listed above.`;
}

interface AcceptanceResult {
  criterion: string;
  met: boolean;
  evidence: string;
}

const taskExecutionReportSchema = z.object({
  output: z.string(),
  acceptance: z.array(acceptanceResultSchema),
});

interface ParsedReport {
  ok: true;
  output: string;
  acceptance: AcceptanceResult[];
}

async function runSingleTaskAttempt(
  prompt: string,
  agent: ExecutorAgent,
): Promise<{ kind: "ok"; report: ParsedReport } | { kind: "fail"; reason: string; text: string }> {
  const response = await agent.generate(prompt, {
    structuredOutput: {
      schema: taskExecutionReportSchema,
      jsonPromptInjection: "auto",
    },
  });

  const object = response?.object;
  if (object && typeof object === "object") {
    const schemaResult = taskExecutionReportSchema.safeParse(object);
    if (schemaResult.success) {
      return {
        kind: "ok",
        report: {
          ok: true,
          output: schemaResult.data.output,
          acceptance: schemaResult.data.acceptance,
        },
      };
    }
  }

  const text = extractTextFromResponse(response);
  const report = parseExecutionReport(text);
  if (report.ok) {
    return { kind: "ok", report };
  }

  return { kind: "fail", reason: report.reason, text };
}

function parseExecutionReport(text: string): { ok: false; reason: string } | ParsedReport {
  const json = extractJsonBlock(text);
  if (!json) {
    return { ok: false, reason: "Agent response did not contain a JSON result." };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "Agent response JSON could not be parsed." };
  }

  const output =
    typeof parsed.output === "string"
      ? parsed.output
      : parsed.output
        ? String(JSON.stringify(parsed.output))
        : "";

  const acceptance: AcceptanceResult[] = Array.isArray(parsed.acceptance)
    ? parsed.acceptance
        .map((a) => {
          if (typeof a !== "object" || a === null) return null;
          const item = a as Record<string, unknown>;
          const criterion = String(item.criterion ?? "").trim();
          if (!criterion) return null;
          return {
            criterion,
            met: Boolean(item.met),
            evidence: String(item.evidence ?? "").trim(),
          };
        })
        .filter((a): a is AcceptanceResult => a !== null)
    : [];

  if (acceptance.length === 0) {
    return {
      ok: false,
      reason: "Agent response did not validate the acceptance criteria (acceptance array missing or empty).",
    };
  }

  return { ok: true, output, acceptance };
}

async function runAgentTask(
  prompt: string,
  agent: ExecutorAgent,
): Promise<
  | { ok: true; output: string; acceptance: AcceptanceResult[] }
  | { ok: false; error: string }
> {
  let lastText = "";
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await runSingleTaskAttempt(prompt, agent);

      if (result.kind === "ok") {
        return result.report;
      }

      lastText = result.text;

      if (attempt === 1) {
        prompt += `\n\n⚠ CRITICAL: Your previous response was NOT accepted: ${result.reason}\n
You MUST NOT call any tool, memory function, subagent delegation, or any other operation.
You MUST respond DIRECTLY with EXACTLY ONE JSON object and nothing else (no prose, no markdown fences):
{
  "output": "concise summary of what was actually done/produced",
  "acceptance": [
    { "criterion": "exact text of acceptance criterion 1", "met": true, "evidence": "how the criterion was satisfied" },
    { "criterion": "exact text of acceptance criterion 2", "met": false, "evidence": "what is still missing" }
  ]
}`;
      }
    }
    return {
      ok: false,
      error: `Agent response did not contain a valid JSON execution report after retry. Sample: ${lastText.slice(0, 300)}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Task execution failed.",
    };
  }
}

/**
 * Executes a research task through the Research Agent's own runtime instead of
 * the generic agent prompt. The research agent is not a generic executor: it
 * produces its structured reports via the bounded runResearch loop. This maps
 * the resulting ResearchResult onto the executor's {output, acceptance}
 * contract so a research task can be validated like any other.
 */
async function runResearchTask(
  task: ExecutionPlan["tasks"][number],
  plan: ExecutionPlan,
): Promise<
  | { ok: true; output: string; acceptance: AcceptanceResult[] }
  | { ok: false; error: string }
> {
  const question = [task.title, task.description].filter(Boolean).join(" — ");

  const request = {
    question,
    objective: plan.objective,
    context: plan.context,
    constraints: plan.constraints.map((c) => c.description),
    expectedOutput: task.expectedOutputs.join("; ") || undefined,
  };

  try {
    const result = await runResearch(researchAgent, request);
    return mapResearchResultToReport(result, task);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Research task execution failed.",
    };
  }
}

/**
 * Maps a ResearchResult onto the executor's report contract. Pure and exported
 * for testing. success/partial satisfy the acceptance criteria (partial keeps
 * its caveats in the output); blocked/failed produce a failed task.
 */
export function mapResearchResultToReport(
  result: ResearchResult,
  task: ExecutionPlan["tasks"][number],
):
  | { ok: true; output: string; acceptance: AcceptanceResult[] }
  | { ok: false; error: string } {
  const output = formatResearchSummary(result);

  if (result.status === "success" || result.status === "partial") {
    const acceptance: AcceptanceResult[] = task.acceptanceCriteria.map(
      (criterion) => ({
        criterion,
        met: true,
        evidence: `Research ${result.status}: ${output.slice(0, 500)}`,
      }),
    );
    return { ok: true, output, acceptance };
  }

  return {
    ok: false,
    error:
      result.errors?.[0] ?? `Research task ended with status ${result.status}.`,
  };
}

// ---------------------------------------------------------------------------
// Step 1 - prepare
// ---------------------------------------------------------------------------

const prepareStep = createStep({
  id: "executor-prepare",
  description:
    "Validates the plan and orders its tasks into the execution batches defined by the planner (falling back to dependency-safe batches when executionOrder is incomplete).",
  inputSchema: workflowInputSchema,
  outputSchema: prepareOutputSchema,
  execute: async ({ inputData }) => {
    const plan = inputData.plan;
    const taskIds = new Set(plan.tasks.map((task) => task.id));
    const seen = new Set<string>();
    const batches: string[][] = [];

    for (const batch of plan.executionOrder ?? []) {
      const ids = batch.filter((id) => taskIds.has(id) && !seen.has(id));
      if (ids.length) {
        batches.push(ids);
        ids.forEach((id) => seen.add(id));
      }
    }

    const orphans = plan.tasks.map((task) => task.id).filter((id) => !seen.has(id));
    if (orphans.length) batches.push(orphans);

    return {
      plan,
      batches,
      stopOnFirstFailure: inputData.options.stopOnFirstFailure ?? false,
    };
  },
});

// ---------------------------------------------------------------------------
// Step 2 - execute
// ---------------------------------------------------------------------------

const executeStep = createStep({
  id: "executor-execute",
  description:
    "Executes each batch in order. For every task it routes to the assigned agent (companion, plane, outline, notion, github, memory, research based on the plan's suggestedAgent) and validates the acceptance criteria from that agent's own report, marking tasks completed/failed/skipped. Tasks whose dependencies failed are skipped. If stopOnFirstFailure is set, execution halts after the first failure.",
  inputSchema: prepareOutputSchema,
  outputSchema: executeOutputSchema,
  execute: async ({ inputData }) => {
    const plan = inputData.plan;
    const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
    const results: TaskExecutionResult[] = [];
    const completedIds: string[] = [];
    const failedIds: string[] = [];
    const skippedIds: string[] = [];
    let stopped = false;

    for (const batch of inputData.batches) {
      if (stopped) break;

      for (const taskId of batch) {
        if (stopped) break;

        const task = taskById.get(taskId);
        if (!task) continue;

        const blockingFailures = task.dependencies.filter(
          (dep) => failedIds.includes(dep) || skippedIds.includes(dep),
        );

        if (blockingFailures.length > 0) {
          results.push({
            taskId,
            title: task.title,
            status: "skipped",
            output: "",
            acceptance: [],
            error: `Blocked by failed dependency: ${blockingFailures.join(", ")}`,
            agent: resolveTaskAgent(task).id,
          });
          skippedIds.push(taskId);
          continue;
        }

        const { id: agentId, getAgent } = resolveTaskAgent(task);

        let agentResult:
          | { ok: true; output: string; acceptance: AcceptanceResult[] }
          | { ok: false; error: string };

        if (agentId === "research") {
          agentResult = await runResearchTask(task, plan);
        } else {
          const agent = await getAgent();
          const prompt = buildTaskPrompt(plan, task);
          agentResult = await runAgentTask(prompt, agent);
        }

        if (!agentResult.ok) {
          results.push({
            taskId,
            title: task.title,
            status: "failed",
            output: "",
            acceptance: [],
            error: agentResult.error,
            agent: agentId,
          });
          failedIds.push(taskId);
        } else if (agentResult.acceptance.every((entry) => entry.met)) {
          results.push({
            taskId,
            title: task.title,
            status: "completed",
            output: agentResult.output,
            acceptance: agentResult.acceptance,
            agent: agentId,
          });
          completedIds.push(taskId);
        } else {
          const unmet = agentResult.acceptance
            .filter((entry) => !entry.met)
            .map((entry) => entry.criterion);
          results.push({
            taskId,
            title: task.title,
            status: "failed",
            output: agentResult.output,
            acceptance: agentResult.acceptance,
            error: `Unmet acceptance criteria: ${unmet.join(" | ")}`,
            agent: agentId,
          });
          failedIds.push(taskId);
        }

        if (inputData.stopOnFirstFailure && failedIds.length > 0) {
          stopped = true;
        }
      }
    }

    if (stopped) {
      const processed = new Set([...completedIds, ...failedIds, ...skippedIds]);
      for (const task of plan.tasks) {
        if (!processed.has(task.id)) skippedIds.push(task.id);
      }
    }

    return {
      plan,
      results,
      completedIds,
      failedIds,
      skippedIds,
      stopped,
    };
  },
});

// ---------------------------------------------------------------------------
// Step 3 - report
// ---------------------------------------------------------------------------

const reportStep = createStep({
  id: "executor-report",
  description:
    "Aggregates the per-task outcomes into a single plan status: success, partial, blocked (critical failure or stopped), or failed.",
  inputSchema: executeOutputSchema,
  outputSchema: reportOutputSchema,
  execute: async ({ inputData }) => {
    const plan = inputData.plan;
    const failedTasks = plan.tasks.filter((task) => inputData.failedIds.includes(task.id));
    const hasCriticalFailure = failedTasks.some((task) => task.priority === "critical");

    let status: z.infer<typeof planResultSchema>;
    if (inputData.stopped) {
      status = "blocked";
    } else if (inputData.failedIds.length === 0) {
      status = "success";
    } else if (hasCriticalFailure) {
      status = "blocked";
    } else if (inputData.completedIds.length > 0) {
      status = "partial";
    } else {
      status = "failed";
    }

    const total = plan.tasks.length;
    const completed = inputData.completedIds.length;
    const failed = inputData.failedIds.length;
    const skipped = inputData.skippedIds.length;

    let summary: string;
    switch (status) {
      case "success":
        summary = `All ${completed}/${total} tasks completed. Objective: ${plan.objective}`;
        break;
      case "partial":
        summary = `${completed}/${total} tasks completed, ${failed} failed, ${skipped} skipped. Objective: ${plan.objective}`;
        break;
      case "blocked":
        summary = `Execution ${inputData.stopped ? "stopped" : "blocked by critical failure"}: ${completed}/${total} completed, ${failed} failed, ${skipped} skipped. Objective: ${plan.objective}`;
        break;
      default:
        summary = `Execution failed: ${completed}/${total} completed, ${failed} failed, ${skipped} skipped. Objective: ${plan.objective}`;
    }

    return {
      status,
      summary,
      completed,
      failed,
      skipped,
      total,
      stopped: inputData.stopped,
      results: inputData.results,
    };
  },
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const planExecutorWorkflow = createWorkflow({
  id: "plan-executor",
  description:
    "Executes a validated plan produced by the Planner Agent: runs the task batches in dependency order, routes each task to the assigned agent (companion, plane, outline, notion, github, memory, research), validates each task against its acceptance criteria as it goes, updates task statuses, and returns a structured execution report.",
  inputSchema: workflowInputSchema,
  outputSchema: reportOutputSchema,
})
  .then(prepareStep)
  .then(executeStep)
  .then(reportStep)
  .commit();

export const executorStepIds = {
  PREPARE: "executor-prepare",
  EXECUTE: "executor-execute",
  REPORT: "executor-report",
} as const;