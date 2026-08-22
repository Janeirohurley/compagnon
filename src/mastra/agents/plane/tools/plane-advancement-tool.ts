import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  getPlaneConnection,
  planeNeedsConnectionResult,
  planeRequest,
} from "../../../connections/plane-provider";

/**
 * Tool: Get a full advancement report for a Plane project.
 */
export const planeAdvancementTool = createTool({
  id: "plane_get_advancement",
  description:
    "Generate a comprehensive advancement report for a Plane project. Includes work item counts by state, completion rate, active cycle, modules, and blockages.",
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

    // Fetch work items, cycles, and modules in parallel
    const [issuesResult, cyclesResult, modulesResult] = await Promise.all([
      planeRequest("GET", `${base}/projects/${projectId}/work-items/?per_page=100`, undefined, connectionId),
      planeRequest("GET", `${base}/projects/${projectId}/cycles/?per_page=20`, undefined, connectionId),
      planeRequest("GET", `${base}/projects/${projectId}/modules/?per_page=20`, undefined, connectionId),
    ]);

    if (!issuesResult.success) return issuesResult;

    const issues = (issuesResult.data?.results ?? issuesResult.data ?? []) as Array<Record<string, unknown>>;
    const cycles = (cyclesResult.data?.results ?? cyclesResult.data ?? []) as Array<Record<string, unknown>>;
    const modules = (modulesResult.data?.results ?? modulesResult.data ?? []) as Array<Record<string, unknown>>;

    // Count by state
    const stateCount: Record<string, number> = {};
    for (const issue of issues) {
      const state = (issue.state_detail as Record<string, unknown>)?.group as string
        ?? (issue.state as string) ?? "unknown";
      stateCount[state] = (stateCount[state] ?? 0) + 1;
    }

    const total = issues.length;
    const completed = stateCount["done"] ?? stateCount["completed"] ?? 0;
    const inProgress = stateCount["in_progress"] ?? stateCount["started"] ?? 0;
    const todo = stateCount["todo"] ?? 0;
    const backlog = stateCount["backlog"] ?? 0;
    const cancelled = stateCount["cancelled"] ?? 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Active cycle
    const activeCycle = cycles.find(
      (c) => c.status === "active" || c.cycle_status === "active"
    ) ?? null;

    // Blockages: items stuck in in_progress for a long time or with blockers
    const blockages = issues
      .filter((i) => {
        const state = (i.state_detail as Record<string, unknown>)?.group as string ?? i.state as string;
        return state === "in_progress" || state === "started";
      })
      .filter((i) => {
        const labels = (i.labels_list as string[]) ?? [];
        return labels.some((l) => l.toLowerCase().includes("block") || l.toLowerCase().includes("blocked"));
      })
      .map((i) => ({
        identifier: i.identifier as string,
        name: i.name as string,
        reason: "Labeled as blocked",
        priority: i.priority as string,
      }));

    // Recent completions (last 5)
    const recentCompletions = issues
      .filter((i) => {
        const state = (i.state_detail as Record<string, unknown>)?.group as string ?? i.state as string;
        return state === "done" || state === "completed";
      })
      .sort((a, b) => new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime())
      .slice(0, 5)
      .map((i) => ({
        identifier: i.identifier as string,
        name: i.name as string,
        updatedAt: i.updated_at as string,
      }));

    // Recommendations
    const recommendations: string[] = [];
    if (completionRate < 30) {
      recommendations.push("Completion rate is low — consider prioritizing tasks.");
    }
    if (blockages.length > 0) {
      recommendations.push(`${blockages.length} work item(s) are blocked — review and unblock.`);
    }
    if (inProgress > total * 0.4) {
      recommendations.push("Too many items in progress — consider focusing on fewer tasks.");
    }
    if (backlog > total * 0.5) {
      recommendations.push("Large backlog — consider triaging and prioritizing.");
    }

    return {
      success: true,
      data: {
        total,
        completed,
        inProgress,
        todo,
        backlog,
        cancelled,
        blocked: blockages.length,
        completionRate,
        activeCycle: activeCycle
          ? {
              id: activeCycle.id as string,
              name: activeCycle.name as string,
              startDate: activeCycle.start_date as string,
              endDate: activeCycle.end_date as string,
            }
          : null,
        cycles: cycles.map((c) => ({
          id: c.id as string,
          name: c.name as string,
          status: c.status ?? c.cycle_status as string,
        })),
        modules: modules.map((m) => ({
          id: m.id as string,
          name: m.name as string,
          description: m.description as string,
        })),
        blockages,
        recentCompletions,
        recommendations,
      },
    };
  },
});

// Default export for Mastra fs-agent build process
export default planeAdvancementTool;
