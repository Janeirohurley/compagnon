/**
 * Research Agent configuration.
 *
 * Follows the same pattern as the github/outline/notion agents: reports which
 * capabilities are available from the environment so the agent can degrade
 * gracefully instead of failing hard.
 */
import { companionModel } from "../../providers/omniroute";
import { researchInstructions } from "./research-instructions";

export interface ResearchConfig {
  searchAvailable: boolean;
  fetchAvailable: boolean;
  githubAvailable: boolean;
  degradeMode: boolean;
}

/**
 * Search availability tracks the declarative web-search MCP server: it is only
 * loaded when its required environment (e.g. BRAVE_API_KEY) is present. GitHub
 * research reuses the GitHub MCP server (loaded when GITHUB_TOKEN is set).
 * Fetching is always available via Mastra's built-in webFetchTool.
 */
export function getResearchConfig(): ResearchConfig {
  const searchAvailable = !!process.env.BRAVE_API_KEY;
  const fetchAvailable = true;
  const githubAvailable = !!process.env.GITHUB_TOKEN;
  const degradeMode = !searchAvailable;

  return {
    searchAvailable,
    fetchAvailable,
    githubAvailable,
    degradeMode,
  };
}

export default {
  getResearchConfig,
  instructions: researchInstructions,
  model: companionModel,
};