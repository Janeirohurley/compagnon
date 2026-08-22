/**
 * Operations supported by the Outline Agent.
 */
export const OutlineOperation = {
  SEARCH: "search",
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST_DOCUMENTS: "list_documents",
  LIST_COLLECTIONS: "list_collections",
  PUBLISH_FROM_MEMORY: "publish_from_memory",
  GENERATE_SUMMARY: "generate_summary",
} as const;

export type OutlineOperation = (typeof OutlineOperation)[keyof typeof OutlineOperation];

/**
 * Outline Agent result status.
 */
export const OutlineStatus = {
  SUCCESS: "success",
  PARTIAL: "partial",
  FAILED: "failed",
  BLOCKED: "blocked",
  NEEDS_CLARIFICATION: "needs_clarification",
} as const;

export type OutlineStatus = (typeof OutlineStatus)[keyof typeof OutlineStatus];
