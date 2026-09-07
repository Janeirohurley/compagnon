// Request Plan Tool - lets the Compagnon obtain a validated execution plan from the planner
import { z } from "zod";
import { plannerAgent } from "../agents/planner";
import { planningResultSchema } from "../agents/planner/domain/schemas";

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
  const resp = response as { text?: unknown };

  if (typeof resp === "string") return resp;
  if (typeof resp?.text === "string") return resp.text;
  if (typeof resp?.text === "function") {
    const text = (resp.text as () => unknown)();
    if (text && typeof (text as { then?: unknown }).then === "function") {
      return "[Async response]";
    }
    return String(text);
  }
  return String(resp?.text ?? JSON.stringify(resp ?? ""));
}

function buildPlannerPrompt(input: {
  request: string;
  context?: string;
  constraints?: string[];
}): string {
  const sections: string[] = [];

  sections.push(
    `Plan the following objective so that the Compagnon orchestrator can execute it task by task.`,
  );

  sections.push(`OBJECTIVE:
${input.request}`);

  if (input.context) {
    sections.push(`CONTEXT:
${input.context}`);
  }

  if (input.constraints && input.constraints.length > 0) {
    sections.push(
      `CONSTRAINTS:
${input.constraints.map((c) => `- ${c}`).join("\n")}`,
    );
  }

  sections.push(
    `AGENT ROUTING:
The plan executor will route each task to one of these agents. Pick the best suggestedAgent for every task:
- companion: general-purpose implementation, writing content, filesystem, git, SSH, analysis, verification, devops, security fixes. Default fallback.
- research: research, comparison, fact-checking, current state (pricing/versions), sourced and evidence-backed reports. Use for several research tasks.
- plane: Plane workspaces, projects, work items, cycles, modules, comments, relations.
- outline: documentation and knowledge base — search, read, create, update documents, manage collections, publish content.
- github: GitHub issues, pull requests, code search, repository analysis.
- memory: persistent memory operations.

Use a specialized agent only when the task clearly belongs to it. Otherwise default to "companion".`,
  );

  sections.push(
    `Take into account task dependencies, an executionOrder with one batch per sequential step (tasks in the same batch are independent), risks, and per-task acceptance criteria that are objectively verifiable. Do not plan work the companion cannot possibly perform with its tools.`,
  );

  return sections.join("\n\n");
}

export const requestPlanTool = {
  id: "request_plan",
  name: "request_plan",
  description:
    "Obtain a validated execution plan from the Planner subagent for a complex objective. Use BEFORE executing any multi-step, multi-agent request (e.g. 'document the Plane project and publish the doc to Outline'). Returns the structured plan (tasks, dependencies, executionOrder, acceptance criteria) together with a ready / needs_clarification / blocked / out_of_scope / invalid status. When status is ready, pass the returned plan object directly to the plan_executor tool to run it.",
  inputSchema: z.object({
    request: z
      .string()
      .min(1)
      .describe("The objective to plan, as stated by the user (or refined)."),
    context: z
      .string()
      .optional()
      .describe("Relevant context: project state, repository, environment, gathered facts."),
    constraints: z
      .array(z.string())
      .optional()
      .describe("Hard constraints the plan must respect (safety, scope, do-not-do items)."),
  }),
  execute: async (input: {
    request: string;
    context?: string;
    constraints?: string[];
  }) => {
    try {
      const prompt = buildPlannerPrompt(input);
      const response = await plannerAgent.generate(prompt);
      const text = extractTextFromResponse(response);

      const json = extractJsonBlock(text);
      if (!json) {
        return {
          planning: true,
          status: "error",
          error: "Planner response did not contain a JSON result.",
          raw: text,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return {
          planning: true,
          status: "error",
          error: "Planner response JSON could not be parsed.",
          raw: text,
        };
      }

      const result = planningResultSchema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join(" | ");
        return {
          planning: true,
          status: "invalid",
          error: `Planner result failed validation: ${issues}`,
          raw: text,
        };
      }

      const data = result.data;
      if (data.status === "ready") {
        return {
          planning: true,
          status: "ready",
          summary: data.summary,
          confidence: data.confidence,
          warnings: data.warnings,
          plan: data.plan,
        };
      }

      return {
        planning: true,
        status: data.status,
        summary: data.summary,
        confidence: data.confidence,
        warnings: data.warnings,
        questions: "questions" in data ? data.questions : undefined,
        blockers: "blockers" in data ? data.blockers : undefined,
        suggestedAgent: "suggestedAgent" in data ? data.suggestedAgent : undefined,
      };
    } catch (error) {
      return {
        planning: true,
        status: "error",
        error: error instanceof Error ? error.message : "Could not reach the planner.",
      };
    }
  },
};