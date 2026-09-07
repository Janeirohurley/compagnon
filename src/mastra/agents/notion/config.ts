import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { companionModel } from "../../providers/omniroute";
import { notionInstructions } from "./notion-instructions";

export interface NotionConfig {
  /** Whether OAuth tokens for the "notion" server have been persisted. */
  connected: boolean;
  oauthTokensPresent: boolean;
  redirectUrl: string;
  /** When the workspace is not connected, the agent degrades to the notion_connect setup tool only. */
  degradeMode: boolean;
}

const DEFAULT_REDIRECT_URL = "http://127.0.0.1:5533/oauth/callback";

/**
 * Reports the connection state for the Notion MCP server.
 *
 * Notion uses interactive OAuth (no static token), so "connected" is derived
 * from the persisted token file that src/mastra/mcp/registry.ts writes to
 * ~/.compagnon/oauth/notion.json after a successful authorization. This is a
 * best-effort proxy; the registry itself is the source of truth at startup.
 */
export function getNotionConfig(): NotionConfig {
  const tokenFile = join(homedir(), ".compagnon", "oauth", "notion.json");
  const oauthTokensPresent = existsSync(tokenFile);
  const redirectUrl = process.env.NOTION_OAUTH_REDIRECT_URL ?? DEFAULT_REDIRECT_URL;

  return {
    connected: oauthTokensPresent,
    oauthTokensPresent,
    redirectUrl,
    degradeMode: !oauthTokensPresent,
  };
}

/**
 * Throws when the Notion workspace is not connected. Used by callers that need
 * the Notion MCP tools to be available (as opposed to the degrade mode that
 * only exposes the notion_connect setup tool).
 */
export function requireNotionConfig(): void {
  if (!getNotionConfig().connected) {
    throw new Error(
      "[Notion Agent] Notion is not connected yet. Run the notion_connect tool (notion_connect) to authorize the workspace via OAuth.",
    );
  }
}

export default {
  getNotionConfig,
  requireNotionConfig,
  instructions: notionInstructions,
  model: companionModel,
};