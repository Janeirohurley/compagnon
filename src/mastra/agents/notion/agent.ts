import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import type { WorkspaceConfig } from "../../workspaces/types";
import { resolveWorkspaceModel } from "../../config/model-config";
import { resolveChatModel } from "../../providers/resolve";
import { notionInstructions } from "./notion-instructions";
import { getNotionMcpTools } from "./mcp-tools";
import { createNotionConnectTool, createNotionDisconnectTool } from "./tools";

export function createNotionAgent(cfg?: WorkspaceConfig, workspaceId: string = 'default'): Agent {
  const companionModel = resolveChatModel(resolveWorkspaceModel(cfg?.model));
  const notionConnectTool = createNotionConnectTool(workspaceId);
  const notionDisconnectTool = createNotionDisconnectTool(workspaceId);

  return new Agent({
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
    // The tools are a DynamicArgument function so they are re-resolved on every
    // agent run. Before the workspace is authorized this resolves to notion_connect
    // only (NOTION_NOT_CONNECTED); right after authorization it grows to the full
    // Notion MCP tool set without needing a server restart.
    tools: async () => ({
      notion_connect: notionConnectTool,
      notion_disconnect: notionDisconnectTool,
      ...(await getNotionMcpTools(workspaceId)),
    }) as Record<string, any>,
  });
}

// Warm the MCP tool cache in the background when the workspace is already
// authorized, so the first Notion request does not pay the connection cost.
// Best-effort: when there are no valid tokens it returns an empty set and
// connects nothing, so this never fails or blocks the boot.
void getNotionMcpTools('default').catch(() => undefined);