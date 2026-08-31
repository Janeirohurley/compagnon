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
import { planeTools } from "./plane";

import { startScheduleTool, stopScheduleTool } from "./tools/schedule-tools";
import { memoryWorkflowTool } from "./tools/memory-workflow-tool";
import { MastraEditor } from "@mastra/editor";
import { chatRoute } from "@mastra/ai-sdk";
import { connectionsRoutes } from "./routes/connections-routes";
import { memoryRoutes } from "./routes/memory-routes";
import { plannerRoutes } from "./routes/planner-routes";
import { githubRoutes } from "./routes/github-routes";
import { outlineRoutes } from "./routes/outline-routes";
import { agentMemoryWorkflow } from "./workflows/agent-memory-workflow";
import { planeContextWorkflow } from "./workflows/plane-context-workflow";
import { planeContextWorkflowTool } from "./tools/plane-context-workflow-tool";

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
  agents: { agent, planner: plannerAgent, plane: planeAgent },
  tools: { startScheduleTool, stopScheduleTool, memoryWorkflowTool, plane_context_workflow: planeContextWorkflowTool, ...planeTools },
  workflows: { agentMemoryWorkflow, planeContextWorkflow },
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
      ...connectionsRoutes,
      ...memoryRoutes,
      ...plannerRoutes,
      ...githubRoutes,
      ...outlineRoutes,
    ],
  },
});
