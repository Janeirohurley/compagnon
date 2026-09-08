// Memory Maintenance Tool - triggers the memory hygiene workflow on demand.
import { memoryMaintenanceWorkflow } from "../workflows/memory-maintenance-workflow";
import { z } from "zod";

export const memoryMaintenanceTool = {
  id: "memory_maintenance",
  name: "memory_maintenance",
  description:
    "Runs memory hygiene on a resource: dedupes labeled working-memory blocks, drops secret-pattern lines, and prunes empty threads so their vector embeddings are deleted. Use sparingly (also runs on a daily schedule when MEMORY_MAINTENANCE_CRON is set).",
  inputSchema: z.object({
    resourceId: z.string().optional().describe("Resource to maintain (defaults to 'anonymous')"),
    userId: z.string().optional().describe("User id used as resourceId fallback"),
    threadId: z.string().optional().describe("Thread scope; defaults to the resource id"),
  }),
  execute: async (input: {
    resourceId?: string;
    userId?: string;
    threadId?: string;
  }) => {
    try {
      const run = await memoryMaintenanceWorkflow.createRun();
      const result = await run.start({
        inputData: { resourceId: input.resourceId, userId: input.userId, threadId: input.threadId },
      });

      if (result.status !== "success") {
        return {
          success: false,
          status: result.status,
          error: result.status === "failed" ? (result as any).error?.message : "Maintenance did not complete",
        };
      }

      const output = (result as any).result;
      return {
        success: true,
        resourceId: output.resourceId,
        deduped: output.deduped,
        removedSecrets: output.removedSecrets,
        normalized: output.normalized,
        prunedThreads: output.pruneDeletedThreads,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Maintenance failed",
      };
    }
  },
};