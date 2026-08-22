import { z } from "zod";

import type { Agent } from "@mastra/core/agent";

import type {
  PlannerTaskInput,
  PlannerTaskResult,
} from "../domain/contracts";
import { finalizeExecutionPlan } from "../services/planning-service";
import {
  plannerProposalSchema,
} from "../domain/proposal-schemas";
import { planningResultSchema } from "../domain/schemas";
import { unwrapNestedPlan } from "./planner-output-processor";

const nestedPlanEnvelopeSchema = z
  .object({
    status: z.string(),
    plan: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const tolerantProposalSchema = z.union([
  plannerProposalSchema,
  nestedPlanEnvelopeSchema,
]);

export async function runPlanner(
  planner: Agent,
  input: PlannerTaskInput,
): Promise<PlannerTaskResult> {
  let raw: unknown;

  try {
    const result = await planner.generate(
      [
        {
          role: "user",
          content: [
            "Turn the objective below into an execution plan.",
            "All structuring decisions are provided in the payload.",
            "Only return needs_clarification if choosing differently would",
            "materially change the nature of the plan. Discoverable details",
            "(stack, files, existing mechanisms) must become analysis tasks,",
            "not questions. If the objective is actionable, answer ready.",
            "",
            JSON.stringify(
              {
                objective: input.objective,
                context: input.context,
                constraints: input.constraints ?? [],
              },
              null,
              2,
            ),
          ].join("\n"),
        },
      ],
      {
        structuredOutput: {
          schema: tolerantProposalSchema,
        },
      },
    );

    raw = result.object;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[PLANNER_TRACE] runtime: planner.generate() failed → ${message}`
    );
    return {
      status: "invalid",
      blockers: [`Planner agent failed to produce a response: ${message}`],
      confidence: 1,
    };
  }

  const flatCheck = plannerProposalSchema.safeParse(raw);
  let proposal: z.infer<typeof plannerProposalSchema> | undefined =
    flatCheck.success ? flatCheck.data : undefined;

  if (!proposal) {
    const unwrapped = unwrapNestedPlan(raw);
    const nestedCheck = plannerProposalSchema.safeParse(unwrapped);
    if (nestedCheck.success) {
      proposal = nestedCheck.data;
    }
  }

  if (!proposal) {
    return {
      status: "invalid",
      blockers: ["Planner returned a result that matches no known shape."],
      confidence: 1,
    };
  }

  if (proposal.status !== "ready") {
    const nonReadyResult = {
      status: proposal.status,
      summary: proposal.summary,
      ...(proposal.status === "needs_clarification"
        ? { questions: proposal.questions }
        : {}),
      ...(proposal.status === "blocked" || proposal.status === "invalid"
        ? { blockers: proposal.blockers }
        : {}),
      ...(proposal.status === "out_of_scope"
        ? { suggestedAgent: proposal.suggestedAgent }
        : {}),
    };

    const resultCheck = planningResultSchema.safeParse(nonReadyResult);
    if (!resultCheck.success) {
      const issues = resultCheck.error.issues
        .slice(0, 5)
        .map(
          (issue) =>
            `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        )
        .join(" | ");
      console.error(
        `[PLANNER_TRACE] runtime: planningResultSchema validation failed (${proposal.status}) → ${issues}`
      );
    } else {
      console.error(
        `[PLANNER_TRACE] runtime: planningResultSchema validation passed (status=${proposal.status})`
      );
    }

    return nonReadyResult;
  }

  const planResult = finalizeExecutionPlan(
    {
      objective: input.objective,
      context: proposal.context ?? input.context,
      constraints: proposal.constraints.length
        ? proposal.constraints
        : input.constraints,
    },
    proposal.tasks,
  );

  // Validate the final result against planningResultSchema
  const resultCheck = planningResultSchema.safeParse(planResult);
  if (!resultCheck.success) {
    const issues = resultCheck.error.issues
      .slice(0, 5)
      .map(
        (issue) =>
          `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join(" | ");
    console.error(
      `[PLANNER_TRACE] runtime: planningResultSchema validation failed → ${issues}`
    );
  } else {
    console.error(
      `[PLANNER_TRACE] runtime: planningResultSchema validation passed (status=${planResult.status})`
    );
  }

  return planResult;
}
