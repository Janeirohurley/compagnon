/**
 * GitHub Agent configuration.
 *
 * Checks for required environment variables and provides
 * tool availability status.
 */

import { getDefaultChatRef, resolveChatModel } from "../../providers/resolve";

const companionModel = resolveChatModel(getDefaultChatRef());
import { githubInstructions } from "./github-instructions";

export interface GitHubConfig {
  tokenAvailable: boolean;
  mcpAvailable: boolean;
  degradeMode: boolean;
}

export function getGitHubConfig(): GitHubConfig {
  const tokenAvailable = !!process.env.GITHUB_TOKEN;
  const mcpAvailable = tokenAvailable;
  const degradeMode = !tokenAvailable;

  return {
    tokenAvailable,
    mcpAvailable,
    degradeMode,
  };
}

export function requireGitHubToken(): void {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "[GitHub Agent] GITHUB_TOKEN is not configured. " +
        "Set the GITHUB_TOKEN environment variable to use GitHub operations."
    );
  }
}

export default {
  getGitHubConfig,
  requireGitHubToken,
  instructions: githubInstructions,
  model: companionModel,
};
