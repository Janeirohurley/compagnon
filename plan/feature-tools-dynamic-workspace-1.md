---
goal: Make the Tools & Plugins page dynamic, real and workspace-scoped
version: 1.0
date_created: 2026-09-10
owner: git-auto / user
status: 'Completed'
tags: ['feature', 'ui', 'tools', 'mcp', 'workspace']
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

The `Tools & Plugins` page (`compagnon-ui/src/pages/Tools.tsx`) still renders mock data. The MCP tools + plugins must become **dynamic**: real servers/plugins read from the backend, **scoped per workspace** (today MCP enabling is global via `mcp.servers.json`, not per workspace), and manageable via **enable/disable only** (no delete) — CRUD minus delete. This plan builds the per-workspace MCP settings store, the tools endpoints, the workspace-threaded MCP loading, and the dynamic page.

Root cause targeted: `config.servers.enabled` in `mcp.servers.json` is global; the sub-agent factories receive no `workspaceId`, so the MCP tool set cannot differ between workspaces.

## 1. Requirements & Constraints

- **REQ-001**: Per-workspace MCP tool list, persisted (enable/disable of a server in workspace A does not affect workspace B).
- **REQ-002**: No delete operation anywhere: `PATCH` toggles `enabled` only; `POST` creates a new workspace-scoped server (custom MCP server).
- **REQ-003**: The actual MCP loading path (registry) must honor the per-workspace enabled flag, not only display it.
- **REQ-003b**: Each workspace can own its **credentials**: per-workspace env + encrypted secrets for a server, stored in the config store, **winning over `process.env`** (a GitHub token for account A vs account B per workspace, editable dynamically).
- **REQ-005**: **OAuth servers (Notion) are per-workspace too**: each workspace connects its own account (own token file), with Connect/Disconnect buttons in the UI that trigger the same `notion_connect`/`notion_disconnect` flow the agent uses.
- **REQ-004**: Tools page reads real backend data with loading/error states; workspace switching re-fetches (reuse `getActiveWorkspaceId` + `compagnon:workspace-changed`).
- **SEC-001**: `GET /tools` must not return secrets (headers/args/env values of custom servers are config-only in UI, secrets stay server-side where flagged).
- **CON-001**: Follow existing patterns: Hono-style handlers, LibSQL store like `connection-store.ts`, routes registered in `server.apiRoutes` (AGENTS.md).
- **CON-002**: Keep shadcn/ui look; `Switch` already exists. No delete buttons.
- **GUD-001**: Every resolved workspace id goes through `resolveWorkspaceFromRequest` / UI `getActiveWorkspaceId`.
- **PAT-001**: UI data hook pattern returns `{ data, loading, error, refresh }`.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Backend: per-workspace MCP settings store, tools endpoints, and workspace-threaded MCP loading.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `src/mastra/mcp/mcp-store.ts`: table `compagnon_mcp_servers` (workspace_id, id, name, kind 'config'\|'custom', type 'url'\|'stdio', url, command, args_json, headers_json, agents_json, enabled, created_at, updated_at; PK(workspace_id, id)). Helpers: `provisionWorkspaceServers(workspaceId)` seeding the 8 `mcp.servers.json` entries per workspace (INSERT OR IGNORE), `listWorkspaceServers(workspaceId)`, `getEnabledServerIds(workspaceId)`, `setServerEnabled(workspaceId, id, enabled)`, `upsertServer(workspaceId, input)`. | ✅ [2026-09-10] | |
| TASK-002 | Create `src/mastra/routes/tools-routes.ts`: `GET /tools` → `{ servers, plugins }` (servers = listWorkspaceServers projection; plugins = `listConnections(workspaceId)` projection: id, name/provider, status, enabled, capabilities, updatedAt); `POST /tools/mcp` (create custom server); `PATCH /tools/mcp/:serverId` body `{ enabled }` (no delete); `PATCH /tools/plugins/:connectionId` body `{ enabled }` (add `setConnectionEnabled` helper in `connection-store.ts`). Registered in `server.apiRoutes`. | ✅ [2026-09-10] | |
| TASK-003 | Thread workspaceId through MCP loading: `getMcpToolsForAgent(workspaceId, agentId)` and `getMcpToolsForAgents(workspaceId, agentIds)` filter via `getEnabledServerIds(workspaceId)`; update sub-agent factories to `(cfg, workspaceId)` (`subagents.ts` passes `workspace.id`), `buildSubAgents(cfg, workspaceId)`, all agents (github/outline/notion/plane/research, mcp-tools.ts + agent.ts), and the companion closure `getMcpToolsForAgents(workspaceId, [...])`. | ✅ [2026-09-10] | |
| TASK-004 | Tests `src/mastra/mcp/tests/mcp-store.test.ts` + `src/mastra/routes/tests/tools-routes.test.ts`: provisioning, workspace isolation, enable/disable persistence, shape + secret-free, disabled server excluded from effective id list. | ✅ [2026-09-10] | |

### Implementation Phase 2

- GOAL-002: UI: dynamic Tools & Plugins page wired to the real endpoints.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Extend `src/lib/api.ts`: types `McpToolServer`/`ToolPlugin`, `listTools(workspaceId)`, `setMcpServerEnabled(serverId, enabled, workspaceId)`, `createMcpServer(input, workspaceId)`, `setPluginEnabled(connectionId, enabled, workspaceId)` — all via `workspaceHeaders`. | ✅ [2026-09-10] | |
| TASK-006 | Rewrite `src/pages/Tools.tsx`: fetch via `listTools` keyed on active workspace (listener `compagnon:workspace-changed`), loading/error/empty states (Skeleton/Empty/error banner), MCP Tools tab real servers with **Switch** enable/disable (no delete) + "Add server" dialog (name + type + url/command) posting to `POST /tools/mcp`, Plugins tab real connections with **Switch** enable/disable. KPIs computed from the fetched lists. | ✅ [2026-09-10] | |
| TASK-007 | PR-check sweep: `src/pages/Tools.tsx` no longer imports from `@/lib/data`; UI `npm run typecheck` + `npm run build`; backend `npx tsc --noEmit` + `npm test`. | ✅ [2026-09-10] | |

### Implementation Phase 1b (per-workspace credentials)

- GOAL-001b: Backend + UI carry per-workspace env/secret overrides that win over `process.env` (REQ-003b), fully dynamic.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | `config.ts`: `resolveEnv`/`interpolate`/`expandArgs`/`buildArgs`/`mapEnv` accept an optional `overrides` map used **before** `process.env`. | ✅ [2026-09-10] | |
| TASK-009 | `mcp-store.ts`: add `env_json` + `encrypted_secrets_json` columns (+ ALTER migration), expose `env`/`secretKeys` in the projection, add `updateServerConfig` (merge env, merge secrets; `""` removes a secret), `getWorkspaceServerSecrets`, `getWorkspaceServerSettings`, `upsertServer` accepts env/secrets. | ✅ [2026-09-10] | |
| TASK-010 | `registry.ts`: `buildServerDefinition`/`loadServerTools` take overrides; config + custom loads pass the workspace row's env+decrypted secrets as overrides (`toConfig` also carries `env` for custom spawn env). | ✅ [2026-09-10] | |
| TASK-011 | `tools-routes.ts`: `GET /tools` exposes `env` + `secretKeys` (never secret values); `PATCH /tools/mcp/:serverId` accepts `{ enabled?, config?: { name,url,command,args,agents,env,secrets } }`; `POST /tools/mcp` accepts `env`/`secrets`. | ✅ [2026-09-10] | |
| TASK-012 | Tests: `config.test.ts` (overrides beat process.env), mcp-store (secrets stored encrypted, not leaked, per-workspace, `""` deletes), tools-routes (PATCH config per-workspace, no leak). | ✅ [2026-09-10] | |

### Implementation Phase 2b (UI credentials editor)

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | `api.ts`: `McpToolServer.env`/`secretKeys`, `McpServerInput.env`/`secrets`, `McpServerPatch`, `updateMcpServer(serverId, patch)`. | ✅ [2026-09-10] | |
| TASK-014 | `Tools.tsx`: per-server **Configure** dialog — URL/command + env rows + masked secrets rows (encrypted), remove row ⇒ deletes secret (via `""`), `secretKeys` badges on cards, wire into `Tools()`. | ✅ [2026-09-10] | |
| TASK-015 | PR-check sweep again (tsc, 158 backend tests, UI typecheck + build). | ✅ [2026-09-10] | |

### Implementation Phase 2c (per-workspace OAuth — Notion)

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | `registry.ts`: OAuth token store is per workspace (`~/.compagnon/oauth/<ws>/<server>.json`, legacy fallback for `default`); `buildOAuthProvider`/`buildServerDefinition`/`loadServerTools`/`connectOAuthServer`/`disconnectOAuthServer`/`hasValidOAuthTokens` all take `workspaceId`. | ✅ [2026-09-10] | |
| TASK-017 | Notion per-workspace: `connect.ts`/`disconnect.ts` become `createNotionConnectTool(ws)`/`createNotionDisconnectTool(ws)` factories; `mcp-tools.ts` tool cache keyed per workspace; agent builds tools with its `workspaceId`. | ✅ [2026-09-10] | |
| TASK-018 | Routes: `POST /tools/mcp/:id/connect` (runs OAuth flow, enables server) and `POST /tools/mcp/:id/disconnect` (revokes workspace tokens); `GET /tools` adds `auth` + per-workspace `authorized` flags. | ✅ [2026-09-10] | |
| TASK-019 | UI: `Connect`/`Disconnect` button on OAuth server cards (authorization badge + pending states), `connectMcpOAuth`/`disconnectMcpOAuth` API calls. | ✅ [2026-09-10] | |
| TASK-020 | Tests: tools-routes (auth/authorized projection, connect rejects unknown/non-OAuth, disconnect no-op), notion agent/integration (per-workspace factories + `(ws, 'notion')` calls); tsc + full suite green. | ✅ [2026-09-10] | |

## 3. Alternatives

- **ALT-001**: Keep global `mcp.servers.json` `enabled` and only mirror it in the UI. Rejected: does not satisfy per-workspace scoping (REQ-001/003).
- **ALT-002**: Full CRUD (update + delete) on servers. Rejected by user: enable/disable only, no delete (REQ-002).
- **ALT-003**: Build it into the broad 8-phase plan for all pages. Rejected by user (too large, not focused); the Tools page is a standalone deliverable.

## 4. Dependencies

- **DEP-001**: `connection-store.ts` (workspace scoping, `updateConnectionStatus`) — extend with `setConnectionEnabled`.
- **DEP-002**: `registry.ts` tool-loading path and sub-agent factories accept `workspaceId` (TASK-003).
- **DEP-003**: UI owns the workspace switcher in `AppShell.tsx` (`x-workspace-id`); Tools page reuses it.
- **DEP-004**: `config/crypto.ts` AES-256-GCM `encryptObject`/`decryptObject` for per-workspace MCP secrets (same as connections/providers).
- **DEP-005**: `config.ts` override threading is source-compatible: callers without overrides keep `process.env` behaviour (optional param).

## 5. Files

- **FILE-001**: `src/mastra/mcp/mcp-store.ts` (new)
- **FILE-002**: `src/mastra/routes/tools-routes.ts` (new)
- **FILE-003**: `src/mastra/connections/connection-store.ts` (add `setConnectionEnabled`)
- **FILE-004**: `src/mastra/mcp/registry.ts` + `src/mastra/mcp/index.ts` (workspaceId params)
- **FILE-005**: `src/mastra/workspaces/subagents.ts` + `src/mastra/agents/{github,outline,notion,plane,research,companion}/**` (factories accept workspaceId)
- **FILE-006**: `src/mastra/index.ts` (register `toolsRoutes`)
- **FILE-007**: UI `src/lib/api.ts`, `src/pages/Tools.tsx`
- **FILE-008**: Tests: `src/mastra/mcp/tests/mcp-store.test.ts`, `src/mastra/routes/tests/tools-routes.test.ts`

## 6. Testing

- **TEST-001**: mcp-store tests (provisioning, isolation, toggle persistence) — TASK-004
- **TEST-002**: tools-routes tests (shape, secret-free, no-delete capability, scoping) — TASK-004
- **TEST-003**: Backend `npm test` + `npx tsc --noEmit` green — TASK-007/015
- **TEST-004**: UI typecheck + build; grep asserts Tools.tsx has no `@/lib/data` import — TASK-007
- **TEST-005**: config override resolution (workspace secret beats process.env) — TASK-012
- **TEST-006**: secret storage round-trip (encrypted, never in GET /tools, per-workspace, `""` clears) — TASK-012

## 7. Risks & Assumptions

- **RISK-001**: Connection provider registry is empty (`connection-providers.ts` `{}`), so the Plugins tab is only real once connections exist. Mitigation: render real rows from `compagnon_connections` and a clear empty state when none.
- **ASSUMPTION-001**: The per-workspace default seed keeps `mcp.servers.json` as the declarative source of truth (edits there still apply to new workspaces via provisioning).
- **ASSUMPTION-002**: No delete of servers/plugins is acceptable; re-enable is the revert path.
- **ASSUMPTION-003**: Effective variable resolution = workspace stored env/secret > `process.env`; OAuth MCP auth flows stay global per server (token file) and are out of scope of per-workspace storage.
- **RISK-002**: `requiredEnv` servers (git, github, web-search, outline, plane) stay shown but disabled-with-reason when their env is absent, so the user knows why they are off rather than wondering.