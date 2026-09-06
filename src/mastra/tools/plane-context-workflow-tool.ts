import { z } from "zod";

import { planeContextWorkflow } from "../workflows/plane-context-workflow";

export const planeContextWorkflowTool = {
  id: "plane_context_workflow",
  name: "plane_context_workflow",
  description: "Resolve the relevant Plane workspace and project automatically before listing tasks. Use this when the agent does not know the workspace identifier or project context yet.",
  inputSchema: z.object({
    workspaceHint: z.string().optional().describe("Workspace slug, name, or ID hint."),
    projectHint: z.string().optional().describe("Project name or ID hint inside the chosen workspace."),
    taskHint: z.string().optional().describe("Optional task keyword to filter project work items."),
  }),
  execute: async (input: {
    workspaceHint?: string;
    projectHint?: string;
    taskHint?: string;
  }) => {
    try {
      const run = await planeContextWorkflow.createRun();
      const result = await run.start({
        inputData: {
          workspaceHint: input.workspaceHint,
          projectHint: input.projectHint,
          taskHint: input.taskHint,
        },
      });

      if ((result as any)?.status !== "success") {
        return {
          success: false,
          status: (result as any)?.status ?? "failed",
          error: "Plane context workflow did not complete successfully.",
        };
      }

      return {
        success: true,
        ...(result as any).result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Plane context workflow failed.",
      };
    }
  },
};
