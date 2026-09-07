import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { webFetchTool } from "@mastra/core/tools";

import { companionModel } from "../../providers/omniroute";
import { researchInstructions } from "./research-instructions";
import { getMcpToolsForAgent } from "../../mcp";

// Load declarative MCP tools for the research agent (web-search, github).
const mcpTools = await getMcpToolsForAgent("research");

export const researchAgent = new Agent({
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
  tools: {
    ...mcpTools,
    web_fetch: webFetchTool,
  } as Record<string, any>,
});