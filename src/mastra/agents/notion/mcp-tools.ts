import { getMcpToolsForAgent, hasValidOAuthTokens } from "../../mcp";

let cache: Record<string, unknown> | null = null;
let loading: Promise<Record<string, unknown>> | null = null;

/**
 * Dynamic Notion MCP tool accessor.
 *
 * The Notion agent must expose the remote MCP tools the moment the workspace is
 * authorized, without requiring a server restart. Module-level evaluation of
 * the tools at boot would produce an empty set on first connect (no tokens yet)
 * that the running agent can never grow.
 *
 * To solve this the agent configures its `tool` set as a DynamicArgument
 * function that re-resolves on every run through this accessor. The accessor
 * memoizes the loaded tool map and returns an empty map while the workspace is
 * not authorized, so the agent degrades to the notion_connect-only behavior.
 */
export async function getNotionMcpTools(): Promise<Record<string, unknown>> {
  if (cache) return cache;
  if (loading) return loading;

  loading = (async (): Promise<Record<string, unknown>> => {
    try {
      const connected = await hasValidOAuthTokens("notion");
      if (!connected) return {};

      cache = (await getMcpToolsForAgent("notion")) ?? {};
      return cache;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/**
 * Pre-seed the memoized tool map with a freshly loaded set. Used by the
 * notion_connect tool right after a successful authorization so the tools are
 * available to the agent on the very next resolution (no reconnection).
 */
export function seedNotionMcpTools(tools: Record<string, unknown>): void {
  cache = tools;
  loading = null;
}