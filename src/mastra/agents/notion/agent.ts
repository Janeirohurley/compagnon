import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { companionModel } from "../../providers/omniroute";
import { notionInstructions } from "./notion-instructions";
import { getMcpToolsForAgent } from "../../mcp";
import { notionConnectTool } from "./tools";

// Load MCP Notion tools at startup. OAuth servers only expose tools once the
// workspace has been connected (see the notion_connect tool); until then this
// is empty and the agent reports NOTION_NOT_CONNECTED.
const mcpTools = await getMcpToolsForAgent("notion");

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
  tools: {
    notion_connect: notionConnectTool,
    ...mcpTools,
  } as Record<string, any>,
});
