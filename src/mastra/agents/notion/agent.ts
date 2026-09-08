import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { notionInstructions } from "./notion-instructions";
import { getNotionMcpTools } from "./mcp-tools";
import { notionConnectTool } from "./tools";

// The tools are a DynamicArgument function so they are re-resolved on every
// agent run. Before the workspace is authorized this resolves to notion_connect
// only (NOTION_NOT_CONNECTED); right after authorization it grows to the full
// Notion MCP tool set without needing a server restart.
export const notionAgent = new Agent({
  id: "notion",
  name: "Notion Agent",
  description:
    "Compagnon's Notion Agent. Manages the user's Notion workspace via the Notion MCP: search, read, create, update and organize pages and database entries, avoid duplication, and keep the knowledge base coherent.",
  model: companionModel,
  instructions: notionInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  tools: async () => ({
    notion_connect: notionConnectTool,
    ...(await getNotionMcpTools()),
  }) as Record<string, any>,
});

// Warm the MCP tool cache in the background when the workspace is already
// authorized, so the first Notion request does not pay the connection cost.
// Best-effort: when there are no valid tokens it returns an empty set and
// connects nothing, so this never fails or blocks the boot.
void getNotionMcpTools().catch(() => undefined);
