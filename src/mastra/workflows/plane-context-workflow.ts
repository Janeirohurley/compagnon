import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { PlaneConfig, PlaneServiceImpl } from "../plane";

const resolveWorkspaceStep = createStep({
  id: "resolve-plane-workspace",
  description: "Selects the relevant Plane workspace using the configured default slug or a user-provided hint, then resolves the exact workspace identifier needed for project lookup.",
  inputSchema: z.object({
    workspaceHint: z.string().optional(),
    projectHint: z.string().optional(),
    taskHint: z.string().optional(),
  }),
  outputSchema: z.object({
    workspaceHint: z.string().optional(),
    workspace: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
    }).nullable(),
    workspaceMatch: z.enum(["configured", "resolved", "ambiguous", "not-found"]).default("not-found"),
    reason: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const config = new PlaneConfig({
      baseUrl: process.env.PLANE_BASE_URL || "https://api.plane.so/api/v1",
      apiKey: process.env.PLANE_API_KEY,
      workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
    });

    const workspaceHint = inputData.workspaceHint?.trim() || config.getWorkspaceSlug()?.trim();

    if (!workspaceHint) {
      return {
        workspaceHint: undefined,
        workspace: null,
        workspaceMatch: "not-found" as const,
        reason: "Plane requires an explicit workspace slug or hint. There is no global workspace-list endpoint in the current Plane API.",
      };
    }

    const workspaceMatch: "resolved" | "configured" = inputData.workspaceHint ? "resolved" : "configured";

    return {
      workspaceHint,
      workspace: {
        id: workspaceHint,
        name: workspaceHint,
        slug: workspaceHint,
        description: undefined,
      },
      workspaceMatch,
      reason: inputData.workspaceHint
        ? `Resolved workspace using hint "${workspaceHint}".`
        : `Used the configured Plane workspace slug "${workspaceHint}".`,
    };
  },
});

const resolveProjectStep = createStep({
  id: "resolve-plane-project",
  description: "Finds the target Plane project inside the resolved workspace, using a project hint or the workspace default context.",
  inputSchema: z.object({
    workspaceHint: z.string().optional(),
    workspace: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
    }).nullable(),
    workspaceMatch: z.enum(["configured", "resolved", "ambiguous", "not-found"]).default("not-found").optional(),
    projectHint: z.string().optional(),
    reason: z.string().optional(),
  }),
  outputSchema: z.object({
    workspaceHint: z.string().optional(),
    workspace: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
    }).nullable(),
    workspaceMatch: z.enum(["configured", "resolved", "ambiguous", "not-found"]).default("not-found"),
    projectHint: z.string().optional(),
    project: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      workspaceId: z.string().optional(),
    }).nullable(),
    projects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        status: z.string().optional(),
        workspaceId: z.string().optional(),
      })
    ).default([]),
    projectMatch: z.enum(["resolved", "not-found", "ambiguous"]).default("not-found"),
    reason: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.workspace) {
      return {
        workspaceHint: inputData.workspaceHint,
        workspace: null,
        workspaceMatch: (inputData.workspaceMatch ?? "not-found") as "configured" | "resolved" | "ambiguous" | "not-found",
        projectHint: inputData.projectHint,
        project: null,
        projects: [],
        projectMatch: "not-found" as const,
        reason: "Workspace context was not resolved, so project lookup cannot continue.",
      };
    }

    if (!inputData.workspace.slug) {
      return {
        workspaceHint: inputData.workspaceHint,
        workspace: inputData.workspace,
        workspaceMatch: (inputData.workspaceMatch ?? "not-found") as "configured" | "resolved" | "ambiguous" | "not-found",
        projectHint: inputData.projectHint,
        project: null,
        projects: [],
        projectMatch: "not-found" as const,
        reason: "Plane project lookup requires a resolved workspace slug. Without the exact workspace slug, the API cannot resolve the project list.",
      };
    }

    const config = new PlaneConfig({
      baseUrl: process.env.PLANE_BASE_URL || "https://api.plane.so/api/v1",
      apiKey: process.env.PLANE_API_KEY,
      workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
    });

    const service = new PlaneServiceImpl(config.getClient(), config);

    try {
      const response = await service.listProjects({
        workspaceId: inputData.workspace.id,
        search: inputData.projectHint,
        perPage: 20,
      });

      const projects = response.items.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        workspaceId: project.workspaceId,
      }));

      if (!projects.length) {
        return {
          workspaceHint: inputData.workspaceHint,
          workspace: inputData.workspace,
          workspaceMatch: (inputData.workspaceMatch ?? "not-found") as "configured" | "resolved" | "ambiguous" | "not-found",
          projectHint: inputData.projectHint,
          project: null,
          projects: [],
          projectMatch: "not-found" as const,
          reason: `No Plane projects were found in workspace "${inputData.workspace.name}".`,
        };
      }

      const projectHint = inputData.projectHint?.trim();
      const selected = projectHint
        ? projects.find((item) => item.id.toLowerCase() === projectHint.toLowerCase() || item.name.toLowerCase() === projectHint.toLowerCase()) ?? projects[0]
        : projects[0];

      const projectMatch = projectHint ? "resolved" : "resolved";

      return {
        workspaceHint: inputData.workspaceHint,
        workspace: inputData.workspace,
        workspaceMatch: (inputData.workspaceMatch ?? "not-found") as "configured" | "resolved" | "ambiguous" | "not-found",
        projectHint,
        project: selected,
        projects,
        projectMatch: projectMatch as "resolved" | "not-found" | "ambiguous",
        reason: projectHint
          ? `Project resolved using hint "${projectHint}".`
          : `Listed ${projects.length} project(s) in workspace "${inputData.workspace.name}". Select a specific project to drill into tasks.`,
      };
    } catch (error) {
      return {
        workspaceHint: inputData.workspaceHint,
        workspace: inputData.workspace,
        workspaceMatch: (inputData.workspaceMatch ?? "not-found") as "configured" | "resolved" | "ambiguous" | "not-found",
        projectHint: inputData.projectHint,
        project: null,
        projects: [],
        projectMatch: "not-found" as const,
        reason: error instanceof Error ? error.message : "Unable to resolve the project list.",
      };
    }
  },
});

const resolveTasksStep = createStep({
  id: "resolve-plane-tasks",
  description: "Lists the work items in the selected project so the workflow can expose the likely task context without requiring the caller to know the exact identifiers manually.",
  inputSchema: z.object({
    workspaceHint: z.string().optional(),
    workspace: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
    }).nullable(),
    workspaceMatch: z.enum(["configured", "resolved", "ambiguous", "not-found"]).default("not-found"),
    projectHint: z.string().optional(),
    project: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      workspaceId: z.string().optional(),
    }).nullable(),
    projectMatch: z.enum(["resolved", "not-found", "ambiguous"]).default("not-found"),
    reason: z.string().optional(),
    taskHint: z.string().optional(),
  }),
  outputSchema: z.object({
    tasks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string().optional(),
        projectId: z.string().optional(),
      })
    ),
    reason: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.workspace || !inputData.project) {
      return {
        tasks: [],
        reason: "Workspace or project context was not resolved. Plane requires an explicit workspace slug and project identifier before tasks can be listed.",
      };
    }

    const config = new PlaneConfig({
      baseUrl: process.env.PLANE_BASE_URL || "https://api.plane.so/api/v1",
      apiKey: process.env.PLANE_API_KEY,
      workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
    });

    const service = new PlaneServiceImpl(config.getClient(), config);

    try {
      const response = await service.listWorkItems({
        projectId: inputData.project.id,
        search: inputData.taskHint,
        perPage: 25,
      });

      const tasks = response.items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        projectId: item.projectId ?? inputData.project?.id,
      }));

      if (!tasks.length) {
        return {
          tasks: [],
          reason: inputData.taskHint
            ? `No Plane work items matching "${inputData.taskHint}" were found in project "${inputData.project.name}".`
            : `No Plane work items were found in project "${inputData.project.name}".`,
        };
      }

      return {
        tasks,
        reason: inputData.taskHint
          ? `Listed ${tasks.length} work item(s) matching "${inputData.taskHint}" in project "${inputData.project.name}".`
          : `Listed ${tasks.length} work item(s) in project "${inputData.project.name}".`,
      };
    } catch (error) {
      return {
        tasks: [],
        reason: error instanceof Error ? error.message : "Unable to list Plane work items for the resolved project.",
      };
    }
  },
});

export const planeContextWorkflow = createWorkflow({
  id: "plane-context-workflow",
  description: "Resolves the relevant Plane workspace and project before listing tasks, so an agent can operate without manually knowing the workspace identifiers.",
  inputSchema: z.object({
    workspaceHint: z.string().optional(),
    projectHint: z.string().optional(),
    taskHint: z.string().optional(),
  }),
  outputSchema: z.object({
    workspace: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
    }).nullable(),
    project: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      workspaceId: z.string().optional(),
    }).nullable(),
    tasks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string().optional(),
        projectId: z.string().optional(),
      })
    ),
    workspaceMatch: z.enum(["configured", "resolved", "ambiguous", "not-found"]).default("not-found"),
    projectMatch: z.enum(["resolved", "not-found", "ambiguous"]).default("not-found"),
    reason: z.string().optional(),
  }),
})
  .then(resolveWorkspaceStep)
  .then(resolveProjectStep)
  .then(resolveTasksStep)
  .commit();
