// HTTP routes exposing the workspace registry (used by the UI in Phase 3).
import { createWorkspace, listWorkspaces, getWorkspace } from "../workspaces/store";
import { dropWorkspaceRuntime } from "../workspaces/runtime";
import { resolveWorkspaceFromRequest } from "../workspaces/resolve";
import { DEFAULT_WORKSPACE_ID } from "../workspaces/types";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const workspaceRoutes = [
  {
    path: "/workspaces",
    method: "GET" as const,
    handler: async () => {
      return json({ workspaces: await listWorkspaces() });
    },
  },
  {
    path: "/workspaces/:id",
    method: "GET" as const,
    handler: async (c: any) => {
      const id = c.req.param("id") || DEFAULT_WORKSPACE_ID;
      const w = await getWorkspace(id);
      return w ? json({ workspace: w }) : json({ error: "Workspace not found." }, 404);
    },
  },
  {
    path: "/workspaces",
    method: "POST" as const,
    handler: async (c: any) => {
      try {
        const body = await c.req.json();
        if (!body.name || typeof body.name !== "string") {
          return json({ error: "name (string) is required" }, 400);
        }
        const id = resolveWorkspaceFromRequest(c, body);
        const workspace = await createWorkspace({
          id,
          name: body.name,
          slug: body.slug || id,
          config: body.config,
        });
        // The workspace config may differ from any previously built runtime
        // (e.g. re-creating "default"): drop it so the next resolution picks
        // up the new enabledAgents/model.
        dropWorkspaceRuntime(id);
        return json({ workspace }, 201);
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Workspace creation failed." },
          400,
        );
      }
    },
  },
];