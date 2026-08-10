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
import { agent } from "./agents/agent";
import { startScheduleTool, stopScheduleTool } from "./tools/schedule-tools";
import { MastraEditor } from "@mastra/editor";


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
  agents: { agent },
  tools: { startScheduleTool, stopScheduleTool },
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
});
