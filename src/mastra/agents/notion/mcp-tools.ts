import { getMcpToolsForAgent, hasValidOAuthTokens } from "../../mcp";

const caches = new Map<string, Record<string, unknown> | null>();
const loadings = new Map<string, Promise<Record<string, unknown>> | null>();

/**
 * Dynamic Notion MCP tool accessor, keyed per workspace.
 *
 * The Notion agent must expose the remote MCP tools the moment the workspace is
 * authorized, without requiring a server restart. Module-level evaluation of
 * the tools at boot would produce an empty set on first connect (no tokens yet)
 * that the running agent can never grow.
 *
 * To solve this the agent configures its `tool` set as a DynamicArgument
 * function that re-resolves on every run through this accessor. The accessor
 * memoizes the loaded tool map per workspace and returns an empty map while
 * that workspace is not authorized, so the agent degrades to the
 * notion_connect-only behavior.
 */
export async function getNotionMcpTools(workspaceId: string = 'default'): Promise<Record<string, unknown>> {
  if (caches.has(workspaceId) && caches.get(workspaceId)) return caches.get(workspaceId)!;
  const loading = loadings.get(workspaceId);
  if (loading) return loading;

  const pending = (async (): Promise<Record<string, unknown>> => {
    try {
      const connected = await hasValidOAuthTokens(workspaceId, "notion");
      if (!connected) return {};

      const tools = (await getMcpToolsForAgent(workspaceId, "notion")) ?? {};
      caches.set(workspaceId, tools);
      return tools;
    } finally {
      loadings.set(workspaceId, null);
    }
  })();

  loadings.set(workspaceId, pending);
  return pending;
}

/**
 * Pre-seed the memoized tool map with a freshly loaded set. Used by the
 * notion_connect tool right after a successful authorization so the tools are
 * available to the agent on the very next resolution (no reconnection).
 */
export function seedNotionMcpTools(workspaceId: string, tools: Record<string, unknown>): void {
  caches.set(workspaceId, tools);
  loadings.set(workspaceId, null);
}

/**
 * Drop the memoized tool map. Used after disconnecting so Notion tools stop
 * being offered to the agent on subsequent resolutions.
 */
export function resetNotionMcpTools(workspaceId: string): void {
  caches.set(workspaceId, null);
  loadings.set(workspaceId, null);
}