// Project scope resolution (feature-projects).
//
// Mirrors the workspace resolution (`workspaces/resolve.ts`): an HTTP request
// targets either the whole workspace (global session, no project id) or a
// specific project of that workspace (project-scoped session). Precedence:
// `x-project-id` header > body `projectId` > query `projectId` > none. The
// value is only an identifier lookup here; ownership validation happens when
// the scoped companion is built (`projects/runtime.ts`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveProjectFromRequest(c: any, body?: Record<string, unknown>): string | null {
  const header = c?.req?.header?.("x-project-id");
  const bodyValue = body?.projectId;
  const queryValue = c?.req?.query?.("projectId");

  for (const candidate of [header, typeof bodyValue === "string" ? bodyValue : undefined, queryValue]) {
    const v = typeof candidate === "string" ? candidate.trim() : "";
    if (v) return v;
  }

  return null;
}