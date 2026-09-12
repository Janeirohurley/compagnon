export { createNotionConnectTool } from './connect';
export { createNotionDisconnectTool } from './disconnect';

/**
 * Tools index (stub for the Mastra fs-agents build). The Notion data tools are
 * loaded at runtime from the declarative MCP registry (mcp.servers.json) via
 * src/mastra/mcp/registry.ts; only the OAuth setup/teardown tools are local.
 */
const notionTools: Record<string, unknown> = {};

export default notionTools;