import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  getPlaneConnection,
  planeNeedsConnectionResult,
  planeRequest,
} from "../../../connections/plane-provider";

/**
 * Tool: Detect blocked work items in a Plane project.
 */
export const planeBlockageTool = createTool({
  id: "plane_detect_blockages",
  description:
    "Detect blocked or stalled work items in a Plane project. Identifies items stuck in progress, items with blocker labels, and items with no recent updates.",
  inputSchema: z.object({
    projectId: z.string().describe("Plane project UUID."),
    connectionId: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ projectId, connectionId }) => {
    const plane = await getPlaneConnection(connectionId);
    if (!plane) return planeNeedsConnectionResult();

    const base = `/api/v1/workspaces/${encodeURIComponent(plane.workspaceSlug)}`;
    const result = await planeRequest(
      "GET",
      `${base}/projects/${projectId}/work-items/?per_page=100`,
      undefined,
      connectionId,
    );

    if (!result.success) return result;

    const issues = (result.data?.results ?? result.data ?? []) as Array<Record<string, unknown>>;
    const now = new Date();

    const blockages: Array<{
      identifier: string;
      name: string;
      state: string;
      reason: string;
      daysStalled: number;
      priority: string;
    }> = [];

    for (const issue of issues) {
      const stateGroup = (issue.state_detail as Record<string, unknown>)?.group as string
        ?? (issue.state as string) ?? "unknown";
      const labels = (issue.labels_list as string[]) ?? [];
      const updatedAt = new Date(issue.updated_at as string);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      let reason: string | null = null;

      // Check for blocker labels
      if (labels.some((l) => l.toLowerCase().includes("block") || l.toLowerCase().includes("blocked"))) {
        reason = "Has blocker label";
      }
      // Check for items stalled in progress (>7 days)
      else if ((stateGroup === "in_progress" || stateGroup === "started") && daysSinceUpdate > 7) {
        reason = `Stalled for ${daysSinceUpdate} days in progress`;
      }
      // Check for high-priority items in backlog
      else if (stateGroup === "backlog" && (issue.priority === "urgent" || issue.priority === "high")) {
        reason = "High priority but still in backlog";
      }

      if (reason) {
        blockages.push({
          identifier: issue.identifier as string,
          name: issue.name as string,
          state: stateGroup,
          reason,
          daysStalled: daysSinceUpdate,
          priority: issue.priority as string,
        });
      }
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    blockages.sort((a, b) => (priorityOrder[a.priority] ?? 5) - (priorityOrder[b.priority] ?? 5));

    return {
      success: true,
      data: {
        total: issues.length,
        blocked: blockages.length,
        blockages,
        summary: blockages.length === 0
          ? "No blockages detected."
          : `${blockages.length} work item(s) blocked or stalled.`,
      },
    };
  },
});

// Default export for Mastra fs-agent build process
export default planeBlockageTool;
