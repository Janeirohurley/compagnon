// Shared factory for a tenant-scoped RequestContext (Phase 1).
//
// Mirrors the pattern chat-routes builds for /chat and /chat/approvals: the
// reserved `mastra__threadId` / `mastra__resourceId` keys (message history,
// working memory) plus the structured `MastraMemory` value (observational
// memory). Pass the result as the `requestContext` option of any agent /
// workflow / tool call.
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/request-context";

const MASTRA_MEMORY_KEY = "MastraMemory";

export function buildWorkspaceRequestContext(resourceId: string, threadId?: string): RequestContext {
  const id = threadId || resourceId;
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_THREAD_ID_KEY, id);
  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  requestContext.set(MASTRA_MEMORY_KEY, { thread: { id }, resourceId });
  return requestContext;
}