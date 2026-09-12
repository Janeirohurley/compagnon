import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import type { WorkspaceConfig } from "../../workspaces/types";
import { resolveWorkspaceModel } from "../../config/model-config";
import { resolveChatModel } from "../../providers/resolve";
import { getMcpToolsForAgent } from "../../mcp";
import { planeInstructions } from "./plane-instructions";

export function createPlaneAgent(cfg?: WorkspaceConfig, workspaceId: string = 'default'): Agent {
  const companionModel = resolveChatModel(resolveWorkspaceModel(cfg?.model));

  return new Agent({
    id: "plane",
    name: "Plane Agent",
    description:
      "Compagnon's Plane specialist. Handles workspaces, projects, work items, cycles, modules, comments, and relations through the Plane MCP server.",
    model: companionModel,
    instructions: planeInstructions,
    memory: new Memory({
      options: {
        generateTitle: false,
      },
    }),
    // MCP host tools are loaded lazily on each run (no top-level await): the
    // runtime only builds agents whose workspace has them enabled.
    tools: async () => ({
      ...(await getMcpToolsForAgent(workspaceId, "plane")),
    }) as Record<string, any>,
  });
}