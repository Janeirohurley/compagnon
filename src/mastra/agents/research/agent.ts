import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { webFetchTool } from "@mastra/core/tools";

import type { WorkspaceConfig } from "../../workspaces/types";
import { resolveWorkspaceModel } from "../../config/model-config";
import { resolveChatModel } from "../../providers/resolve";
import { researchInstructions } from "./research-instructions";
import { getMcpToolsForAgent } from "../../mcp";

export function createResearchAgent(cfg?: WorkspaceConfig): Agent {
  const companionModel = resolveChatModel(resolveWorkspaceModel(cfg?.model));

  return new Agent({
    id: "research",
    name: "Research Agent",
    description:
      "Research specialist. Delegates to this agent whenever the user asks for research, comparison of tools/libraries, current pricing/versions/state, verification of facts, or a sourced, evidence-backed report. Searches the web and GitHub, reads sources, cross-validates evidence, and returns a structured report with sources and explicit uncertainties.",
    model: companionModel,
    instructions: researchInstructions,
    memory: new Memory({
      options: {
        generateTitle: false,
      },
    }),
    tools: async () => ({
      // Declarative MCP tools for the research agent (web-search, github),
      // loaded lazily on each run so the workspace runtime can build the agent
      // without connecting any MCP server at construction time.
      ...(await getMcpToolsForAgent("research")),
      web_fetch: webFetchTool,
    }) as Record<string, any>,
  });
}