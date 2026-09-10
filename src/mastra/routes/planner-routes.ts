import { runPlanner } from "../agents/planner";
import { resolveWorkspaceFromRequest } from "../workspaces/resolve";
import { getWorkspaceRuntime } from "../workspaces/runtime";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const plannerRoutes = [
  {
    path: '/plan',
    method: 'POST' as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const objective = body.objective;

      if (!objective || typeof objective !== 'string') {
        return json({ error: 'objective (string) is required' }, 400);
      }

      // Phase 2: agent instance comes from the workspace runtime.
      const workspaceId = resolveWorkspaceFromRequest(c, body);

      try {
        const runtime = await getWorkspaceRuntime(workspaceId);
        const plannerAgent = runtime.agents.planner;
        if (!plannerAgent) {
          return json({ error: `Planner agent is not enabled for workspace '${workspaceId}'` }, 404);
        }
        const result = await runPlanner(plannerAgent, {
          objective,
          context: body.context,
          constraints: Array.isArray(body.constraints)
            ? body.constraints
            : [],
        });
        return json({ result });
      } catch (error) {
        return json(
          {
            error: 'Planner execution failed',
            details: String(error),
          },
          500,
        );
      }
    },
  },
];
