// Single source of truth for resolving which workspace a request belongs to
// (TASK-003). Precedence: `x-workspace-id` header > body `workspaceId` >
// query `workspaceId` > `DEFAULT_WORKSPACE_ID`. No other module may resolve a
// workspace on its own (GUD-001).
import { DEFAULT_WORKSPACE_ID } from "./types";

export function pickWorkspaceId(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const v = typeof c === "string" ? c.trim() : null;
    if (v) return v;
  }
  return DEFAULT_WORKSPACE_ID;
}

/**
 * Resolve the workspaceId for an HTTP request. `c.req.header` / `c.req.query`
 * and the parsed body are Hono-convenience shaped; header wins over body, body
 * wins over query, query wins over the `default` fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveWorkspaceFromRequest(c: any, body?: Record<string, unknown>): string {
  const header = c?.req?.header?.("x-workspace-id");
  const bodyValue = body?.workspaceId;
  const queryValue = c?.req?.query?.("workspaceId");
  const resolved = pickWorkspaceId(header, typeof bodyValue === "string" ? bodyValue : undefined, queryValue);
  if (process.env.NODE_ENV !== "test") {
    // Best-effort debug trace. Resolution must happen before any storage access.
    console.debug(`[workspace] resolved "${resolved}" (header=${header ?? "-"}, body=${bodyValue ?? "-"}, query=${queryValue ?? "-"})`);
  }
  return resolved;
}

export { DEFAULT_WORKSPACE_ID } from "./types";