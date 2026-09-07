// Plan Executor Tool - Execute a validated planning result task by task
import { planExecutorWorkflow } from "../workflows/plan-executor-workflow";
import { executionPlanSchema } from "../agents/planner/domain/schemas";
import { z } from "zod";

export const planExecutorTool = {
  id: "plan_executor",
  name: "plan_executor",
  description:
    "Execute a validated execution plan from the planner. Runs the task batches in dependency order, routes each task to its assigned agent (companion, plane, outline, github, memory per the plan's suggestedAgent), validates each task against its acceptance criteria as it goes, updates statuses (completed/failed/skipped), and returns a structured report. Use this only with a plan whose planner output status is 'ready' (the plan object includes tasks, dependencies, executionOrder, and acceptanceCriteria).",
  inputSchema: z.object({
    plan: executionPlanSchema.describe(
      "The validated ExecutionPlan object as returned by the planner agent (status 'ready')."
    ),
    stopOnFirstFailure: z
      .boolean()
      .optional()
      .describe("Stop execution after the first failed task. Default: false (continue and report failures)."),
  }),
  execute: async (input: {
    plan: unknown;
    stopOnFirstFailure?: boolean;
  }) => {
    try {
      const run = await planExecutorWorkflow.createRun();
      const result = await run.start({
        inputData: {
          plan: input.plan as z.infer<typeof executionPlanSchema>,
          options: { stopOnFirstFailure: input.stopOnFirstFailure ?? false },
        },
      });

      if (result.status !== "success") {
        return {
          success: false,
          status: result.status,
          error: `Workflow finished with status '${result.status}'`,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = (result as any).result;
      return {
        success: true,
        status: output.status,
        summary: output.summary,
        completed: output.completed,
        failed: output.failed,
        skipped: output.skipped,
        total: output.total,
        stopped: output.stopped,
        results: output.results,
      };
    } catch (error) {
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Plan execution failed",
      };
    }
  },
};