# Changelog

## [Unreleased] - Current Development

This section tracks changes not yet released.

### Added

- **Notion Agent**: new `notion` specialist agent delegatable by the companion for knowledge, notes, decisions and procedure documentation.
  - `src/mastra/agents/notion/` : `agent.ts`, `notion-instructions.ts` (search-before-create, read-before-modify, conservative delete permissions, `never claim success unless the MCP confirms it`, Notion-specific error handling), `tools/connect.ts` (`notion_connect` interactive setup), `index.ts`.
  - **Notion MCP (OAuth)**: declarative `notion` server in `mcp.servers.json` (`https://mcp.notion.com/mcp`). No static token — the client drives the interactive OAuth flow via `@mastra/mcp` (`MCPOAuthClientProvider` + `OAuthStorage`) and persists tokens to `~/.compagnon/oauth/<serverId>.json`.
  - **Non-blocking boot**: `registry.ts` `hasValidTokens()` guard returns an empty tool set when Notion is not yet authorized, so the dev server boots without requiring a connection. `connectOAuthServer(serverId)` performs the one-time interactive flow.
  - **Memory preference**: doc backend is memoized as a `preference` (`subject="documentation-backend"`, `predicate="prefers"`, `value="outline"|"notion"`). New `services/preferences.ts` helpers `getPreference`/`setPreference` (supersedes an existing value on change); companion routes without re-asking.
  - **Routing**: `notion` added to `SPECIALIST_AGENTS` in `plan-executor-workflow.ts`, to companion subagents, and to the planner's roster.
  - **Tests**: `notion-agent`, `notion-routing`, and `preferences` suites (Vitest) — added to the `npm test` script.

- **Plan Executor**: new `plan-executor` workflow + `plan_executor` tool that execute a validated `ExecutionPlan` from the planner, task by task.
  - `src/mastra/workflows/plan-executor-workflow.ts` : 3 steps (`executor-prepare` → builds execution batches from `executionOrder` + orphan tasks; `executor-execute` → runs each batch/source, delegates every task to the companion agent, parses `{ output, acceptance[] }`, marks `completed`/`failed`, skips blocked or remaining tasks, honors `stopOnFirstFailure`; `executor-report` → returns `success | partial | blocked | failed` with per-task results and criteria evidence).
  - `src/mastra/tools/plan-executor-tool.ts` : `plan_executor` input `{ plan: ExecutionPlan, stopOnFirstFailure? }`, registered globally (like `memory_workflow`).
  - End-to-end verified against the dev server: 2-task dependency plan executed 2/2 with real filesystem operations and acceptance evidence.
- **Plane MCP entry**: optional `plane` server in `mcp.servers.json` (Access Token mode via `mcp-remote`, gated on `PLANE_API_KEY` / `PLANE_WORKSPACE_SLUG`). Disabled by default; assignable to any agent.
- **Plane switches to MCP**: the `plane` agent now uses the Plane MCP only. All native Plane tooling (typed service layer, `planeTools`, `planeContextWorkflowTool`) is disconnected from the companion and plane agents; the `src/mastra/plane/` module is kept on disk but no longer wired.
- **Declarative MCP Registry**: MCP servers are now configured in `mcp.servers.json` instead of hard-coded factories. Servers can be added/removed/enabled per agent by editing the JSON only.

  - New `src/mastra/mcp/config.ts`: registry types, loader, and `{{VAR}}` environment interpolation (with optional `{{VAR:default}}` fallback).
  - New `src/mastra/mcp/registry.ts`: single generic per-agent MCP loader `getMcpToolsForAgent(agentId)` with retry logic. Adding an MCP = editing the JSON only — no per-server retrieval function.
  - Removed hard-coded factories: `filesystem.ts`, `git.ts`, `ssh.ts`, `github.ts`, `outline.ts`, `github-tools.ts`, `outline-tools.ts`, `companion-config.ts`, and the per-agent wrappers `getCompanionMcpTools` / `getGithubMcpTools` / `getOutlineMcpTools`.

### Changed

- MCP `README` section documenting the JSON registry schema.
- `.env.example` now includes `COMPANION_GIT_REPOSITORY` and `COMPANION_MCP_CONFIG`.
- Pinned `@mastra/*` dependencies to exact versions (`@mastra/mcp` 1.16.0, `@mastra/ai-sdk` 1.8.0, `@mastra/editor` 0.13.13, `@ai-sdk/openai-compatible` 3.0.30, `zod` 4.4.3). `mastra build` re-installs the app into `.mastra/output` with npm and drift (e.g. `@mastra/mcp@1.17.3`) was incompatible with `@mastra/core@1.59.0` (`validateToolOutput` export error).
- `loadServerTools` now disconnects a failed `MCPClient` before retrying, preventing orphan subprocesses from writing to closed stdio pipes (fixes startup flakiness: "SdkError: Connection closed" / `EPIPE`).

- **Skills System**: Skill-based architecture for agent capabilities. Each skill defines specific behavior patterns the agent applies when appropriate.

  - `companion-foundation`: Core identity, self-knowledge, and operating principles
  - `workspace-observation`: Environment discovery and awareness
  - `knowledge-memory`: Persistent memory across sessions
  - `policy-safety`: Safety guidelines and guardrails
  - `master-communication`: Communication protocols
  - `planning-sync`: Task planning and synchronization
  - `filesystem`: File operations with boundary awareness
  - `git`: Git repository operations
  - `github`: GitHub API integration
  - `outline-knowledge`: Outline knowledge base connection
  - `plane-knowledge`: Plane project management connection
  - `remote-operations`: SSH remote execution
  - `workspace-observation`: Environment awareness

- **New Tools**: Added four tools exposed to the agent at runtime:

  - `companion-foundation-tool`: Loads companion foundational knowledge
  - `date-time-tool`: Returns current date and time
  - `project-file-tools`: Enhanced file operations (read, write, edit, search, list)
  - `ssh-command-tool`: SSH remote operations (run commands, SFTP, sessions)

- **MCP Integration**: Added MCP (Model Context Protocol) support for dynamic tool exposure

- **Example Skill Template**: Added `.agents/skills/example-skill/` as a template for creating new skills

### Changed

- Updated `.env.example` with new environment variables for SSH, Outline, and Omniroute
- Updated agent configuration in `src/mastra/agents/agent.ts` to include skills array
- Updated dependencies: `@mastra/editor`, `@mastra/mcp`, `@ai-sdk/provider`, `ai`, `zod`

### Fixed

- Improved filesystem boundary awareness in file operations
- Enhanced skill loading mechanism for better runtime integration

---

## [1.0.0] - 2024-01-01

Initial project setup.

### Added

- Basic agent configuration
- Mastra framework integration
- Initial project structure