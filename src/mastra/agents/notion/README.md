# Notion Agent

Specialized sub-agent of Compagnon for the user's **Notion** workspace: search,
read, create, update and organize pages and database entries.

## Rôle

The Notion Agent is the sole owner of everything Notion inside the Compagnon
system. It is **not** an orchestrator, **not** the planner, and **not** a
general-purpose agent. It acts only when Compagnon (or the plan executor)
delegates a Notion operation to it, and it reports results back to Compagnon.

## Responsabilités

- search pages and content
- read a page
- create a page
- update a page / add content
- organize pages (move, reorder, structure)
- work with databases / data sources when the MCP exposes the capability
- create / update database entries
- retrieve existing information **before** creating new content (anti-duplication)
- summarize / extract information from Notion
- search → read → understand → update for destructive or significant changes
- never decide global planning; it only materializes information in Notion

## MCP utilisé

The agent uses the **official hosted Notion MCP** (`https://mcp.notion.com/mcp`),
declared in `mcp.servers.json` for the `notion` agent. Tools are loaded
automatically from the MCP at startup through `getMcpToolsForAgent("notion")`
(`src/mastra/mcp/registry.ts`) — the agent never re-implements the Notion API.
The MCP's current tool surface (auto-discovered) includes `notion-search`,
`notion-ai-search`, `notion-search-skills`, `notion-fetch`, `notion-create-pages`,
`notion-update-page`, `notion-move-pages`, `notion-query-data-sources`,
`notion-create-database`, `notion-create-comment`, `notion-get-comments`,
`notion-get-users`, `notion-get-teams`, session tools and more. Not every tool
is available on every plan; the agent inspects what is actually exposed and
reports honestly when a capability is missing.

## Comment Compagnon le délègue

Compagnon has a **MANDATORY ROUTING** rule (see
`src/mastra/instructions/companion-instructions.ts`): every Notion operation is
delegated to the `notion` subagent — never attempted directly.

Trigger examples:

```text
"Dans Notion…"
"Ajoute dans mon Notion…"
"Documente cela dans Notion…"
"Recherche dans mon workspace Notion…"
"Crée une page Notion…"
"Mets à jour ma documentation Notion…"
"Organise mes pages Notion…"
```

Delegation is also semantic: a documentation request like
"Documente cette décision dans mon espace de connaissance" is routed to Notion
when Notion is the user's documented backend (preference `documentation-backend`,
memoized in memory). The plan executor routes planner tasks with
`suggestedAgent: "notion"` to this agent as well.

## Architecture

```text
COMPAGNON (orchestrator)
        │  delegation
        ▼
  NOTION AGENT
        │  MCP tools
        ▼
  Notion MCP (https://mcp.notion.com/mcp)
        │
        ▼
  Notion Cloud
```

## Configuration nécessaire

- **Notion MCP** — declared in `mcp.servers.json` as a remote HTTP server using
  **OAuth** (no static token needed).
- **`NOTION_OAUTH_REDIRECT_URL`** — optional; OAuth callback URL
  (default `http://127.0.0.1:5533/oauth/callback`).

### Connecting Notion (first use)

1. Start Compagnon (`npm run dev`).
2. Ask Compagnon to "connect Notion", or call the agent's `notion_connect` tool.
   This drives the interactive OAuth flow (a URL is printed; open it in a
   browser and authorize).
3. Tokens are persisted to `~/.compagnon/oauth/notion.json` (outside the repo,
   never committed). Later boots load the Notion tools automatically.

If Notion is **not** connected, the server is skipped at boot (non-blocking) and
the agent degrades to just the `notion_connect` setup tool.

## Limites

- Only manipulates resources the MCP grants access to; it never bypasses MCP
  permissions.
- It does **not** auto-sync with Outline: Outline and Notion are separate
  backends, and content is only copied across when explicitly asked.
- Destructive operations (`delete`, `archive`, bulk update/delete) require
  verified context; ambiguous reorganization requests are not executed blindly.
- It never claims an operation succeeded unless the MCP confirmed it.