---
goal: Connect every UI page to real backend data, layer by layer
version: 1.0
date_created: 2026-09-10
owner: git-auto / user
status: 'Deprecated'
tags: ['feature', 'ui', 'data', 'backend']
---

# Introduction

> **Deprecated**: ce plan global a été rejeté par l'utilisateur (trop large). La
> page Tools & Plugins a été traitée en premier, séparément, dans
> `plan/feature-tools-dynamic-workspace-1.md`. Ce document ne doit pas servir de
> base pour l'ordre d'exécution des autres pages.

![Status: Deprecated](https://img.shields.io/badge/status-Deprecated-grey)

The UI (`/home/projets/ai/compagnon-ui`) is still almost entirely static: 11 pages and 3 components read mock data from `src/lib/data.ts`. The backend (`/home/projets/ai/compagnon`) already owns real data (conversations, workspaces, model providers, memory, connections, MCP servers, workflows, observations), but exposes only a fraction of it over HTTP.

This plan replaces the mocks page by page, **bottom-up**: first the data foundations on the backend (Phase 1-3), then the UI data layer (Phase 4), then the pages themselves (Phase 5-8), from the least dependent to the most aggregate. Each phase is independently shippable and leaves the app buildable and the existing tests green.

## 1. Requirements & Constraints

- **REQ-001**: Every page that becomes dynamic must stop importing the corresponding mock from `@/lib/data` and render data fetched from the backend, workspace-scoped via the existing `x-workspace-id` header (reuse `workspaceHeaders`).
- **REQ-002**: Pages that have no real backend source yet (missions steps, projects, tasks) must degrade to an explicit empty state with a "not yet available" explanation instead of fake data.
- **REQ-003**: Backend endpoints introduced by this plan must be declared in `server.apiRoutes` in `src/mastra/index.ts` (AGENTS.md).
- **REQ-004**: New stores must be workspace-scoped (`workspaceId` column, indexed, same pattern as `compagnon_connections` in `connection-store.ts`).
- **SEC-001**: No new endpoint may expose secrets (API keys, OAuth tokens, connection config values marked `secret`). Projections only (like `provider-routes.ts`).
- **CON-001**: Use the existing patterns: Hono-style route handlers returning `Response.json`, LibSQL via `@mastra/libsql`, `resolveWorkspaceFromRequest` for scoping.
- **CON-002**: UI must keep the current component-lib look (shadcn/ui) and layout; only data sourcing changes.
- **GUD-001**: One source of truth per domain: no page may resolve a workspace id or build its own API client (GUD-001 of workspace-resolve; reuse `@/lib/api.ts` + `@/lib/conversations.ts`).
- **GUD-002**: Deterministic validation per phase: backend `npx tsc --noEmit` + `npm test`, UI `npm run typecheck` + `npm run build`.
- **PAT-001**: UI data pattern: `useXData(workspaceId)` hook returning `{ data, loading, error, refresh }`, plus `Skeleton`/`EmptyState`/`ErrorState` primitives.
- **PAT-002**: Do not add comments unless a comment is required to explain a non-obvious invariant (repo convention is documentation-minded; keep them short).

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Activity feed foundation: a workspace-scoped store plus events recorded at existing touch points, exposed as `GET /activity`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `src/mastra/activity/activity-store.ts`: table `compagnon_activity` (id, workspace_id, type, title, detail, tool, project_id, task_id, event_at) with `recordActivity(workspaceId, event)` and `listActivity(workspaceId, { limit, type? })` helpers (LibSQL, same migration pattern as `connection-store.ts`). | | |
| TASK-002 | Record events at existing touch points: conversation created (/conversations POST), message persisted (chat stream finish in `chat-routes.ts`), approval decided (/chat/approvals), memory remember (/memory/remember), plan requested (/plan), connection upserted (/connections POST), provider created/deleted (`provider-routes.ts`). | | |
| TASK-003 | Add `GET /activity?type=&limit=` route in `src/mastra/routes/activity-routes.ts` (workspace-scoped), registered in `server.apiRoutes`. Returns `{ events: ActivityEvent[] }`. | | |
| TASK-004 | Tests `src/mastra/activity/tests/activity-routes.test.ts`: record + list scoping (two workspaces do not leak), type filter, secret-free shape. | | |

### Implementation Phase 2

- GOAL-002: Missions foundation: persist the output of the planner and the progression of plan execution so the app can list/read/approve real missions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Create `src/mastra/missions/mission-store.ts`: table `compagnon_missions` (mission: id, workspace_id, title, objective, project_id, status, plan_json, security_boundaries_json, allowed_tools_json, denied_actions_json, assigned_agents_json, progress, created_at, started_at, completed_at) and `compagnon_mission_steps` (id, mission_id, workspace_id, position, title, description, agent_type, tool, plugin, status, requires_approval, result, started_at, completed_at, duration_ms) with CRUD helpers. | | |
| TASK-006 | Persist on plan request: `POST /plan` (planner-routes.ts) saves the returned `ExecutionPlan` as a mission "planning" entry and returns the mission id. Steps map 1:1 to PlanTask. | | |
| TASK-007 | Update step status from execution: `planExtraTool` / `plan-executor-workflow` route the task id through; on completion update `compagnon_mission_steps`. Minimal plumbing: only update when a matching mission+task id exists (no failure on mismatch). | | |
| TASK-008 | Routes `src/mastra/routes/mission-routes.ts`: `GET /missions` (workspace list), `GET /missions/:id` (detail with steps), `PATCH /missions/:id/steps/:stepId` (status/approval). Registered in `server.apiRoutes`. | | |
| TASK-009 | Tests `src/mastra/missions/tests/mission-store.test.ts`: create/list/detail/update, workspace scoping, approval transition, secret-free projection. | | |

### Implementation Phase 3

- GOAL-003: Catalog foundation: listing endpoints for the registered agents, MCP tools, connections-derived plugins and registered workflows.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | `GET /agents` in `src/mastra/routes/catalog-routes.ts`: for each registered agent (from `mastra.agents` + `getWorkspaceRuntime`): id, name, description, model (providerId/modelId), enabled for the workspace, mcp servers (from `mcp.servers.json` + `enabled`), connection status (from `connection-store`). Projection only. | | |
| TASK-011 | `GET /tools`: union of MCP servers (`mcp.servers.json` projected: id, type, agents, enabled, requiredEnv metadata) + connected plugins (`listConnections`) with status. | | |
| TASK-012 | `GET /workflows`: registered workflows (names + descriptions from `mastra.workflows`) + recent runs from the storage layer (`MastraStorageWorkflowRun` via `companionStorage.getStore`), with step summaries when available. | | |
| TASK-013 | Register `catalog-routes.ts` in `server.apiRoutes`. Tests `src/mastra/routes/tests/catalog-routes.test.ts`: agents/tools/workflows shapes and scoping. | | |

### Implementation Phase 4

- GOAL-004: UI data layer: domain functions in `@/lib/api.ts`, a generic data hook, loading/error/empty primitives.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Extend `src/lib/api.ts` with: `listActivity(workspaceId?, type?)`, `listMissions`, `getMission`, `updateMissionStep`, `listAgents`, `listTools` (tools+plugins projection), `listWorkflows`, `getStructuredMemory(workspaceId?)`. Each workspace-scoped via `workspaceHeaders`. | | |
| TASK-015 | Add `src/lib/data-hooks.ts`: `useWorkspaceData<T>(fetcher: (workspaceId: string) => Promise<T>, workspaceId)` returning `{ data, loading, error, refresh }`, with AbortController-safe cancellation and no setState after unmount. | | |
| TASK-016 | Add `src/components/data/Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx` (+ optional `RefreshButton`) in shadcn style, reused by all pages. | | |
| TASK-017 | Remove from consumption the mock symbols progressively; introduce `src/lib/data.ts` deprecation note at the top once first page disconnects. | | |

### Implementation Phase 5

- GOAL-005: Pages Memory + Activity wired to real backend data.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | `Memory.tsx`: use `getStructuredMemory`; keep layer filter + search client-side; replace `PROJECTS` join with workspace name when project mapping is unknown; "Add entry" becomes disabled with empty-state hint. | | |
| TASK-019 | `Activity.tsx`: use `listActivity` with the type filter passed server-side and `refresh`; project badge resolves from a lightweight `listProjects`-free fallback (workspace/project name from mission link when present, otherwise static label). | | |
| TASK-020 | PR-checks: no more `MEMORY`/`ACTIVITY` mock import in these two pages; UI typecheck+build green. | | |

### Implementation Phase 6

- GOAL-006: Pages Tasks + Agents wired to real backend data (missions-derived tasks; agent catalog).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | `Tasks.tsx`: render tasks from missions (`getMission` steps) across missions; filters/status mapping from `TaskStatus`→mission step status; detail tab runs on mission step context. | | |
| TASK-022 | `Agents.tsx`: agents tab from `listAgents`; skills tab driven by an opt-in `GET /agents/:id/skills` (derived from agent instructions/description if not available → empty state); workspaces tab from existing `listWorkspaces`. | | |
| TASK-023 | KPI cards computed from real lists (active/disabled agents, running missions tasks). PR-checks: no `SUB_AGENTS`/`TASKS`/`SKILLS`/`WORKSPACES` mocks in these two pages. | | |

### Implementation Phase 7

- GOAL-007: Pages Tools + Workflows wired to real backend data.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | `Tools.tsx`: "MCP Tools" tab from `listTools` (status = connection status incl. `needs_config`); "Plugins" tab from connections + connection-providers; Connect dialog keeps its form but its source switches to `/connection-providers` + `/connections` POST. | | |
| TASK-025 | `Workflows.tsx`: from `listWorkflows`; step bars from run step data when available, otherwise a derived expand state; Pause/Resume become refresh-driven (no-op with hint when run control unsupported). | | |
| TASK-026 | PR-checks: no `TOOLS`/`PLUGINS`/`WORKFLOWS` mocks; ConnectDialog no longer imports `CONNECTOR_SCHEMAS`/`SSH_SERVERS`. | | |

### Implementation Phase 8

- GOAL-008: Pages Dashboard + Missions + Projects wired to the real data built in Phases 1-7.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-027 | `Missions.tsx`: from `listMissions`/`getMission`; "New mission" form calls `POST /plan` and refreshes; step approve/reject calls `PATCH /missions/:id/steps/:stepId`; KPIs from real counts. | | |
| TASK-028 | `Projects.tsx`: project list from missions grouped by project_id + workspace list with per-workspace counters; detail tabs reuse tasks/activity/workflows/memory from their own fetchers. | | |
| TASK-029 | `Dashboard.tsx`: agent status card from `listAgents` (+ running missions), active tasks from missions, activity feed from `listActivity`, approvals from pending mission steps (`awaiting_approval`). | | |
| TASK-030 | `QuickActions`/`CommandPalette`/`AppShell` stop importing mocks (`AGENT_STATE`, `APPROVALS`); final sweep `grep -r "@/lib/data" src/` returns only `src/lib/data.ts` itself. | | |

## 3. Alternatives

- **ALT-001**: Keep mocks and only re-shape them server-side ("fake API"). Rejected: user wants real data, and the backend owns the relevant domains.
- **ALT-002**: Rewrite pages one by one without a data layer first. Rejected: contradicts the chosen bottom-up strategy and duplicates loading/error logic 11 times.
- **ALT-003**: Persist every page domain (projects, issues, skills) as new storage tables. Rejected for now (REQ-002): only domains with a real producer are persisted; the rest degrade to empty states and can be added later per mission.

## 4. Dependencies

- **DEP-001**: `@mastra/libsql` (stores), `@mastra/core` (storage runs, agents), `mcp.servers.json`, `connection-store.ts` — all present.
- **DEP-002**: Planner output + `POST /plan` persists missions (Phase 2) — depends on Phase 1 tests pattern only.
- **DEP-003**: Page Phases 5-8 depend on UI data layer (Phase 4) being complete.

## 5. Files

- **FILE-001**: `src/mastra/activity/activity-store.ts` + `routes/activity-routes.ts` + `tests/` (Phase 1)
- **FILE-002**: `src/mastra/missions/mission-store.ts` + `routes/mission-routes.ts` + `tests/` (Phase 2)
- **FILE-003**: `src/mastra/routes/catalog-routes.ts` + `tests/` (Phase 3)
- **FILE-004**: `src/mastra/planner-routes.ts`, `src/mastra/tools/plan-executor-tool.ts`, `src/mastra/routes/chat-routes.ts`, `src/mastra/routes/memory-routes.ts`, `src/mastra/routes/connections-routes.ts`, `src/mastra/routes/provider-routes.ts` (event hooks, persist)
- **FILE-005**: `src/mastra/index.ts` (register new route arrays in `server.apiRoutes`)
- **FILE-006**: UI `src/lib/api.ts`, `src/lib/data-hooks.ts`, `src/components/data/*`
- **FILE-007**: UI `src/pages/{Memory,Activity,Tasks,Agents,Tools,Workflows,Dashboard,Missions,Projects}.tsx`, `src/components/CommandPalette.tsx`, `src/components/ConnectDialog.tsx`, `src/components/layout/AppShell.tsx`

## 6. Testing

- **TEST-001**: activity route tests (scoping, filter, projection) — TASK-004
- **TEST-002**: mission store + route tests (CRUD, scoping, approval) — TASK-009
- **TEST-003**: catalog route tests (agents/tools/workflows) — TASK-013
- **TEST-004**: Full backend suite green (`npm test`) and `npx tsc --noEmit` after every phase.
- **TEST-005**: UI `npm run typecheck` + `npm run build` green after every page phase; per-page grep asserts no `@/lib/data` import (TASK-020/023/026/030).

## 7. Risks & Assumptions

- **RISK-001**: Missions/tasks/projects pages depend on real planner usage; until missions exist in the DB they will render empty states. Mitigation: Mission step detail documented and seeded by `POST /plan` usage.
- **RISK-002**: Workflow run step data may be sparse/differ across Mastra versions. Mitigation: degrade gracefully (expandable step list only when `steps` present).
- **ASSUMPTION-001**: The user validates each phase before the next starts (pilot mode).
- **ASSUMPTION-002**: Existing `x-workspace-id` tenancy conventions remain unchanged.