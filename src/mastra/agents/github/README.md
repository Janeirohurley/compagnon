# GitHub Agent

Specialized sub-agent for all GitHub operations within the Compagnon system.

## Overview

The GitHub Agent is a Mastra sub-agent that handles GitHub API operations on behalf of the main Compagnon agent. It provides structured, validated access to GitHub repositories, issues, pull requests, code search, and repository analysis.

## Architecture

```
┌─────────────────────────────────────────┐
│           COMPAGNON (Main Agent)         │
│                                          │
│  "Crée une issue pour le bug d'auth"    │
│  "Qu'est-ce qui a changé sur novaris?"  │
├────────────────┬─────────────────────────┤
│                │ DÉLÉGATION              │
│                ▼                         │
│  ┌──────────────────────────┐           │
│  │      GITHUB AGENT        │           │
│  │                          │           │
│  │  12 tools Mastra:        │           │
│  │  • github_list_issues    │           │
│  │  • github_get_issue      │           │
│  │  • github_create_issue   │           │
│  │  • github_update_issue   │           │
│  │  • github_comment_issue  │           │
│  │  • github_list_prs       │           │
│  │  • github_get_pr         │           │
│  │  • github_create_pr      │           │
│  │  • github_repo_info      │           │
│  │  • github_list_branches  │           │
│  │  • github_list_commits   │           │
│  │  • github_search_code    │           │
│  └──────────────────────────┘           │
└─────────────────────────────────────────┘
```

## Supported Operations

| Operation | Description | Approval Required |
|-----------|-------------|-------------------|
| `list_issues` | List issues for a repository | No |
| `get_issue` | Get issue details by number | No |
| `create_issue` | Create a new issue | Yes |
| `update_issue` | Update an existing issue | Yes |
| `comment_issue` | Add a comment to an issue | No |
| `list_prs` | List pull requests | No |
| `get_pr` | Get PR details by number | No |
| `create_pr` | Create a new pull request | Yes |
| `repo_info` | Get repository information | No |
| `list_branches` | List repository branches | No |
| `list_commits` | List recent commits | No |
| `search_code` | Search code in a repository | No |

## Configuration

### Environment Variables

- `GITHUB_TOKEN` — Required. GitHub personal access token.

### Usage

The GitHub Agent is automatically registered as a sub-agent of the Companion agent. It is invoked via Mastra delegation when the Companion determines a task requires GitHub operations.

## Files

```
src/mastra/agents/github/
├── agent.ts              # Agent Mastra definition
├── config.ts             # Configuration and token validation
├── github-instructions.ts # System prompt
├── index.ts              # Entry point
├── README.md             # This file
├── domain/
│   ├── contracts.ts      # Delegation contracts
│   ├── enums.ts          # Operation and status enums
│   ├── schemas.ts        # Zod validation schemas
│   └── types.ts          # TypeScript types
├── services/
│   ├── analysis-service.ts  # Repo analysis helpers
│   ├── index.ts             # Services index
│   ├── issue-service.ts     # Issue operation helpers
│   ├── pr-service.ts        # PR operation helpers
│   ├── repo-service.ts      # Repository operation helpers
│   └── search-service.ts    # Search operation helpers
└── tools/
    ├── github-tools.ts   # Mastra tools (12 tools)
    └── index.ts          # Tools index
```

## API Routes

- `POST /github` — Invoke the GitHub Agent
- `GET /github/agent` — Get agent info and supported operations
