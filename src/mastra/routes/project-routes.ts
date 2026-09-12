// Project routes (feature-projects).
//
// Projects are workspace-scoped (children of a workspace). Every request
// resolves its workspace from the usual `x-workspace-id` header (body/query
// fallback) so the CRUD never leaks across workspaces.
import {
  createProject,
  getProject,
  listProjects,
  removeProject,
  updateProject,
  type ProjectPatch,
  type ProjectStatus,
} from "../projects/project-store";
import { dropProjectCompanion } from "../projects/runtime";
import { resolveWorkspaceFromRequest } from "../workspaces/resolve";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

const ALLOWED_STATUSES: ProjectStatus[] = ["active", "paused", "archived"];

export const projectRoutes = [
  {
    path: "/projects",
    method: "GET" as const,
    handler: async (c: any) => {
      const workspaceId = resolveWorkspaceFromRequest(c);
      return json({ projects: await listProjects(workspaceId) });
    },
  },
  {
    path: "/projects/:id",
    method: "GET" as const,
    handler: async (c: any) => {
      const project = await getProject(c.req.param("id"));
      return project ? json({ project }) : json({ error: "Project not found." }, 404);
    },
  },
  {
    path: "/projects",
    method: "POST" as const,
    handler: async (c: any) => {
      try {
        const body = await c.req.json();
        if (!body.name || typeof body.name !== "string") {
          return json({ error: "name (string) is required" }, 400);
        }
        if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
          return json({ error: `status must be one of ${ALLOWED_STATUSES.join(", ")}` }, 400);
        }
        const workspaceId = resolveWorkspaceFromRequest(c, body);
        const project = await createProject({
          workspaceId,
          name: body.name,
          slug: typeof body.slug === "string" ? body.slug : undefined,
          description: typeof body.description === "string" ? body.description : undefined,
          projectPath: typeof body.projectPath === "string" ? body.projectPath : undefined,
          status: body.status,
        });
        return json({ project }, 201);
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Project creation failed." },
          400,
        );
      }
    },
  },
  {
    path: "/projects/:id",
    method: "PATCH" as const,
    handler: async (c: any) => {
      try {
        const body = (await c.req.json()) as ProjectPatch;
        if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
          return json({ error: `status must be one of ${ALLOWED_STATUSES.join(", ")}` }, 400);
        }
        const patch: ProjectPatch = {
          name: typeof body.name === "string" ? body.name : undefined,
          slug: typeof body.slug === "string" ? body.slug : undefined,
          description: typeof body.description === "string" ? body.description : undefined,
          projectPath: typeof body.projectPath === "string" ? body.projectPath : undefined,
          status: body.status,
        };
        const project = await updateProject(c.req.param("id"), patch);
        if (!project) {
          return json({ error: "Project not found." }, 404);
        }
        // A project_path change must not keep serving the previous confinement.
        dropProjectCompanion(project.workspaceId, project.id);
        return json({ project });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Project update failed." },
          400,
        );
      }
    },
  },
  {
    path: "/projects/:id",
    method: "DELETE" as const,
    handler: async (c: any) => {
      const id = c.req.param("id");
      const project = await getProject(id);
      const removed = await removeProject(id);
      if (removed && project) {
        // Never resurrect a deleted project's companion (it could still serve
        // an in-flight resume with the old root).
        dropProjectCompanion(project.workspaceId, project.id);
      }
      return removed ? json({ ok: true }) : json({ error: "Project not found." }, 404);
    },
  },
];