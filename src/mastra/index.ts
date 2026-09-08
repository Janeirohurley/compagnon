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
import { agent } from "./agents/companion/agent";
import { plannerAgent } from "./agents/planner";
import { planeAgent } from "./agents/plane";
import { outlineAgent } from "./agents/outline";
import { notionAgent } from "./agents/notion";
import { githubAgent } from "./agents/github";
import { memoryAgent } from "./agents/memory";
import { researchAgent } from "./agents/research";

import { startScheduleTool, stopScheduleTool } from "./tools/schedule-tools";
import { memoryWorkflowTool } from "./tools/memory-workflow-tool";
import { planExecutorTool } from "./tools/plan-executor-tool";
import { requestPlanTool } from "./tools/request-plan-tool";
import { researchRequestTool } from "./tools/research-request-tool";
import { MastraEditor } from "@mastra/editor";
import { chatRoute } from "@mastra/ai-sdk";
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

export const mastra = new Mastra({
  agents: { agent, planner: plannerAgent, plane: planeAgent, outline: outlineAgent, notion: notionAgent, github: githubAgent, memory: memoryAgent, research: researchAgent },
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
    apiRoutes: [
      chatRoute({
        path: "/chat",
        agent: "companion",
      }),
      chatRoute({
        path: "/chat/plane",
        agent: "plane",
      }),
      chatRoute({
        path: "/chat/notion",
        agent: "notion",
      }),
      ...connectionsRoutes,
      ...memoryRoutes,
      ...plannerRoutes,
      ...githubRoutes,
      ...outlineRoutes,
      ...notionRoutes,
      ...researchRoutes,
    ],
  },
});

// Daily memory maintenance (TASK-019): when MEMORY_MAINTENANCE_CRON is set
// (documented in .env.example, e.g. "0 3 * * *" UTC), register the workflow
// schedule at boot. Best-effort: boot must not fail on schedule collisions.
const maintenanceCron = process.env.MEMORY_MAINTENANCE_CRON;
if (maintenanceCron) {
  try {
    await mastra.schedules.create({
      id: "memory-maintenance",
      workflowId: "memory-maintenance",
      cron: maintenanceCron,
      timezone: "UTC",
      inputData: { resourceId: "anonymous" },
    });
  } catch (error) {
    console.warn("memory-maintenance schedule not registered:", error);
  }
}
