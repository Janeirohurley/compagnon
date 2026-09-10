// Per-workspace memory-maintenance schedules (Phase 3, TEST-007).
//
// Registered at boot when MEMORY_MAINTENANCE_CRON is set: one schedule per
// workspace, each running the memory-maintenance workflow with
// `inputData.resourceId = workspace.id` so the workflow scopes its memory
// operations to that workspace.
import type { Mastra } from "@mastra/core/mastra";
import { listWorkspaces } from "./store";

export async function registerMemoryMaintenanceSchedules(mastra: Mastra, cron: string): Promise<void> {
  const workspaces = await listWorkspaces();
  for (const workspace of workspaces) {
    try {
      await mastra.schedules.create({
        id: `memory-maintenance-${workspace.id}`,
        workflowId: "memory-maintenance",
        cron,
        timezone: "UTC",
        inputData: { resourceId: workspace.id },
      });
    } catch (error) {
      console.warn(`memory-maintenance schedule for workspace "${workspace.id}" not registered:`, error);
    }
  }
}