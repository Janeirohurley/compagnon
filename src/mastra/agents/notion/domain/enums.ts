/**
 * Operations supported by the Notion Agent.
 */
export const NotionOperation = {
  SEARCH: "search",
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  ARCHIVE: "archive",
  LIST: "list",
  QUERY_DATABASE: "query_database",
  CREATE_DATABASE_ENTRY: "create_database_entry",
  MOVE: "move",
  CONNECT: "connect",
  GENERATE_SUMMARY: "generate_summary",
} as const;

export type NotionOperation = (typeof NotionOperation)[keyof typeof NotionOperation];

/**
 * Notion Agent result status.
 */
export const NotionStatus = {
  SUCCESS: "success",
  PARTIAL: "partial",
  FAILED: "failed",
  BLOCKED: "blocked",
  NEEDS_CLARIFICATION: "needs_clarification",
} as const;

export type NotionStatus = (typeof NotionStatus)[keyof typeof NotionStatus];

/**
 * Error codes the Notion Agent reports back to Compagnon. These mirror the
 * codes documented in the agent's system instructions; they are labels, not a
 * substitute for the MCP's own error objects.
 */
export const NotionErrorCode = {
  NOT_CONNECTED: "NOTION_NOT_CONNECTED",
  PERMISSION_DENIED: "NOTION_PERMISSION_DENIED",
  RESOURCE_NOT_FOUND: "NOTION_RESOURCE_NOT_FOUND",
  RATE_LIMITED: "NOTION_RATE_LIMITED",
  MCP_UNAVAILABLE: "NOTION_MCP_UNAVAILABLE",
  OPERATION_FAILED: "NOTION_OPERATION_FAILED",
} as const;

export type NotionErrorCode = (typeof NotionErrorCode)[keyof typeof NotionErrorCode];