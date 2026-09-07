/**
 * Research planning helpers.
 *
 * The plan itself is produced by the Research Agent (LLM) under a strict JSON
 * contract; these helpers build the planning prompt and keep the resulting
 * plan bounded so a single request cannot blow up the budget.
 */
import { ResearchDepth } from "../domain/enums";
import type { ResearchPlan, ResearchRequest } from "../domain/types";

export function buildPlanningPrompt(
  request: ResearchRequest,
  depth: ResearchDepth,
  freshness: string,
): string {
  return `You are Compagnon's Research Agent. Produce a research plan for the question below.

RESEARCH QUESTION:
${request.question}

REQUEST CONTEXT:
${[
  request.objective ? `Objective: ${request.objective}` : null,
  request.scope ? `Scope: ${request.scope}` : null,
  request.expectedOutput
    ? `Expected output: ${request.expectedOutput}`
    : null,
  request.freshnessRequirement
    ? `Freshness requirement: ${request.freshnessRequirement}`
    : null,
]
  .filter(Boolean)
  .join("\n")}
${request.preferredSources?.length ? `Preferred sources: ${request.preferredSources.join(", ")}` : ""}
${request.excludedSources?.length ? `Excluded sources: ${request.excludedSources.join(", ")}` : ""}
${request.constraints?.length ? `Constraints:\n${request.constraints.map((c) => `- ${c}`).join("\n")}` : ""}

RESEARCH DEPTH: ${depth}
- quick: 1 research pass, minimal source reading, short answer.
- standard: plan the research, gather multiple sources, cross-check, then report.
- deep: multi-pass research; additional targeted searches when gaps remain;
  verify important claims, detect contradictions, map evidence, then report.

FRESHNESS: ${freshness}

PLANNING RULES:
1. Break the question into the important sub-questions that must be answered.
2. List concrete research steps. Each step has a clear intent, suggested search
   queries (become progressively more specific), and the tools to use:
   - web_search: general/current information, discovery, news, pricing.
   - web_fetch: read the actual source once discovered (docs, pages).
   - github: open-source projects — repositories, releases, licenses, activity.
   - documentation: official documentation / package registry.
3. Keep ${depth === ResearchDepth.QUICK ? "1" : depth === ResearchDepth.STANDARD ? "2-4" : "3-6"} steps.
4. Do not include irrelevant or duplicate steps.
5. Respect excluded sources and preferred sources.

Return the plan as JSON.`;
}

/** Cap the size of a plan to protect context and budget. */
export function clampPlan(plan: ResearchPlan, maxSteps: number): ResearchPlan {
  return {
    ...plan,
    steps: plan.steps.slice(0, maxSteps).map((step) => ({
      ...step,
      queries: step.queries.slice(0, 3),
      tools: step.tools.slice(0, 4),
    })),
    subQuestions: plan.subQuestions.slice(0, 8),
  };
}

export const MAX_PLAN_STEPS: Record<ResearchDepth, number> = {
  [ResearchDepth.QUICK]: 1,
  [ResearchDepth.STANDARD]: 4,
  [ResearchDepth.DEEP]: 6,
};