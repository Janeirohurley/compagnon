// Memory Workflow Tool - Execute tasks with memory-first workflow
import { agentMemoryWorkflow } from "../workflows/agent-memory-workflow";
import { z } from "zod";

export const memoryWorkflowTool = {
  id: "memory_workflow",
  name: "memory_workflow",
  description: "Execute a task using the memory-first workflow: retrieves context from Memory Agent, executes with Companion Agent, then stores new knowledge. Use this for any task that should benefit from existing knowledge and contribute learnings.",
  inputSchema: z.object({
    task: z.string().describe("The task to execute"),
    project: z.string().optional().describe("Project scope"),
    repository: z.string().optional().describe("Repository scope"),
  }),
  execute: async (input: { task: string; project?: string; repository?: string }) => {
    try {
      const run = await agentMemoryWorkflow.createRun();
      const result = await run.start({
        inputData: {
          task: input.task,
          project: input.project,
          repository: input.repository,
        },
      });

      if (result.status !== 'success') {
        return {
          success: false,
          error: `Workflow ${result.status}`,
          status: result.status,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = (result as any).result;
      return {
        success: true,
        context: output.context,
        result: output.result,
        memoriesStored: output.memoriesStored,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Workflow failed",
      };
    }
  },
};
