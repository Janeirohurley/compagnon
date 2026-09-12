import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from "@mastra/core/storage";
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from "@mastra/observability";
import { getWorkspaceRuntime } from "./workspaces/runtime";
import { DEFAULT_WORKSPACE_ID } from "./workspaces/types";

import { startScheduleTool, stopScheduleTool } from "./tools/schedule-tools";
import { memoryWorkflowTool } from "./tools/memory-workflow-tool";
import { planExecutorTool } from "./tools/plan-executor-tool";
import { requestPlanTool } from "./tools/request-plan-tool";
import { researchRequestTool } from "./tools/research-request-tool";
import { MastraEditor } from "@mastra/editor";
import { chatRoute } from "@mastra/ai-sdk";
import { chatRoutes } from "./routes/chat-routes";
import { connectionsRoutes } from "./routes/connections-routes";
import { memoryRoutes } from "./routes/memory-routes";
import { plannerRoutes } from "./routes/planner-routes";
import { githubRoutes } from "./routes/github-routes";
import { outlineRoutes } from "./routes/outline-routes";
import { notionRoutes } from "./routes/notion-routes";
import { researchRoutes } from "./routes/research-routes";
import { agentMemoryWorkflow } from "./workflows/agent-memory-workflow";
import { planExecutorWorkflow } from "./workflows/plan-executor-workflow";
import { memoryMaintenanceWorkflow } from "./workflows/memory-maintenance-workflow";
import { memoryMaintenanceTool } from "./tools/memory-maintenance-tool";
import { toolsRoutes } from "./routes/tools-routes";
import { workspaceRoutes } from "./routes/workspace-routes";
import { projectRoutes } from "./routes/project-routes";
import { providerRoutes } from "./routes/provider-routes";
import { registerMemoryMaintenanceSchedules } from "./workspaces/schedules";
import { refreshProviderCache } from "./providers/resolve";

// const originalFetch = globalThis.fetch;
// globalThis.fetch = async (input, init) => {
//   const url = typeof input === 'string' ? input : input.toString();
//   if (url.includes('20128')) {
//     console.log('--- REQUÊTE SORTANTE VERS OMNIROUTE ---');
//     console.log(init?.body);
//     console.log('----------------------------------------');
//   }
//   return originalFetch(input, init);
// };

// Resolve the default workspace runtime once: the companion plus its enabled
// sub-agents are the agents served by this instance (Registration keys are the
// ones /chat agentId looks up — companion by id "companion" — kept stable from
// the singleton era so clients and ai-sdk routes keep working unchanged).
const defaultRuntime = await getWorkspaceRuntime(DEFAULT_WORKSPACE_ID);

export const mastra = new Mastra({
  agents: {
    agent: defaultRuntime.companion,
    planner: defaultRuntime.agents.planner,
    plane: defaultRuntime.agents.plane,
    outline: defaultRuntime.agents.outline,
    notion: defaultRuntime.agents.notion,
    github: defaultRuntime.agents.github,
    memory: defaultRuntime.agents.memory,
    research: defaultRuntime.agents.research,
  },
  tools: { startScheduleTool, stopScheduleTool, memoryWorkflowTool, memoryMaintenanceTool, planExecutorTool, requestPlanTool, researchRequestTool },
  workflows: { agentMemoryWorkflow, planExecutorWorkflow, memoryMaintenanceWorkflow },
  storage: new MastraCompositeStore({
    id: "composite-storage",
    default: new LibSQLStore({
      id: "mastra-storage",
      url: process.env.TURSO_DATABASE_URL || "file:./mastra.db",
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
    domains: {
      observability: await new DuckDBStore().getStore("observability"),
    },
  }),
  editor: new MastraEditor(),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    // The UI lives on a different origin (Vite) and scopes every request with
    // the x-workspace-id header; the framework default allow-list does not
    // include it, so all multi-workspace calls from the browser fail their
    // preflight. Keep the defaults and add our tenancy header.
    cors: {
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "A2A-Version",
        "x-mastra-client-type",
        "x-mastra-dev-playground",
        "x-workspace-id",
      ],
      exposeHeaders: ["Content-Length", "X-Requested-With"],
      credentials: false,
    },
    apiRoutes: [
      ...chatRoutes,
      ...workspaceRoutes,
      ...projectRoutes,
      ...providerRoutes,
      chatRoute({
        path: "/chat/plane",
        agent: "plane",
      }),
      chatRoute({
        path: "/chat/notion",
        agent: "notion",
      }),
      ...connectionsRoutes,
      ...toolsRoutes,
      ...memoryRoutes,
      ...plannerRoutes,
      ...githubRoutes,
      ...outlineRoutes,
      ...notionRoutes,
      ...researchRoutes,
    ],
  },
});

// Hydrate the provider registry cache at boot so factory-style resolution
// (Phase 2) picks up registry defaults instead of the env fallback.
await refreshProviderCache().catch((error) => {
  console.warn("Provider registry cache refresh failed:", error);
});

// Daily memory maintenance (TASK-009): when MEMORY_MAINTENANCE_CRON is set
// (documented in .env.example, e.g. "0 3 * * *" UTC), register the workflow
// schedule per workspace at boot. Best-effort: boot must not fail on schedule
// collisions or an unreadable workspace registry.
const maintenanceCron = process.env.MEMORY_MAINTENANCE_CRON;
if (maintenanceCron) {
  try {
    await registerMemoryMaintenanceSchedules(mastra, maintenanceCron);
  } catch (error) {
    console.warn("memory-maintenance schedule iteration not registered:", error);
  }
}
