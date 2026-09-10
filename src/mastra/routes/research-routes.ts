import { runResearch, researchRequestSchema } from "../agents/research";
import { getResearchConfig } from "../agents/research/config";
import { resolveWorkspaceFromRequest } from "../workspaces/resolve";
import { getWorkspaceRuntime } from "../workspaces/runtime";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const researchRoutes = [
  {
    path: '/research',
    method: 'POST' as const,
    handler: async (c: any) => {
      const body = await c.req.json();

      const parsed = researchRequestSchema.safeParse(body);
      if (!parsed.success) {
        return json(
          {
            error: 'Invalid research request: ' +
              parsed.error.issues
                .slice(0, 3)
                .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                .join(' | '),
          },
          400,
        );
      }

      try {
        // Phase 2: agent instance comes from the workspace runtime.
        const workspaceId = resolveWorkspaceFromRequest(c, body);
        const runtime = await getWorkspaceRuntime(workspaceId);
        const researchAgent = runtime.agents.research;
        if (!researchAgent) {
          return json({ error: `Research agent is not enabled for workspace '${workspaceId}'` }, 404);
        }
        const result = await runResearch(researchAgent, parsed.data, {
          depth: parsed.data.depth,
        });
        return json({ result });
      } catch (error) {
        return json(
          {
            error: 'Research execution failed',
            details: String(error),
          },
          500,
        );
      }
    },
  },
  {
    path: '/research/config',
    method: 'GET' as const,
    handler: async () => {
      return json({ config: getResearchConfig() });
    },
  },
];