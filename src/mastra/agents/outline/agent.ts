import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import type { WorkspaceConfig } from "../../workspaces/types";
import { resolveWorkspaceModel } from "../../config/model-config";
import { resolveChatModel } from "../../providers/resolve";
import { outlineInstructions } from "./outline-instructions";
import { getMcpToolsForAgent } from "../../mcp";

export function createOutlineAgent(cfg?: WorkspaceConfig): Agent {
  const companionModel = resolveChatModel(resolveWorkspaceModel(cfg?.model));

  return new Agent({
    id: "outline",
    name: "Outline Agent",
    description:
      "Compagnon's Outline Agent. Manages documentation and knowledge base via Outline: search, read, create, update documents, manage collections, and publish knowledge from Memory.",
    model: companionModel,
    instructions: outlineInstructions,
    memory: new Memory({
      options: {
        generateTitle: false,
      },
    }),
    tools: async () => ({
      ...(await getMcpToolsForAgent("outline")),
    }) as Record<string, any>,
  });
}