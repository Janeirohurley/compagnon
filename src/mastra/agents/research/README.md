# Research Agent

Specialized sub-agent for research, verification, and evidence-backed
reporting within the Compagnon system.

## Overview

The Research Agent is a Mastra sub-agent that performs multi-pass, sourced
research: it plans the investigation, searches the web and GitHub, reads
sources, extracts evidence, cross-validates claims, detects contradictions,
and synthesizes a structured, evidence-backed report. It is invoked by the
Compagnon Agent (via the `research_request` tool) or by the plan executor
(for planner tasks routed to `research`).

When any customer asks a question for which the agent does not have a perfect
source, or where a company should be transparent about its actual stance, the
agent must research instead of guessing. It never fabricates information,
sources, or quotes — and it discloses uncertainty explicitly.

## Architecture

The LLM agent does the actual searching and reasoning, but a deterministic
**runtime** (`runResearch`) enforces structure and bounds:

```
request → understand & classify depth → plan → [search → source discovery →
reading → evidence extraction → gap detection]⁺ → cross-validation →
synthesis → validated structured report
```

The runtime enforces, in a deterministic and testable way:

- hard iteration / search / read / time budgets,
- stop conditions (completed, limit, timeout, blocked, failed, no tools),
- structured JSON contracts at every phase,
- the `ResearchErrorCode` error vocabulary,
- observability events (`[RESEARCH_TRACE]` logs).

Depth is classified deterministically (quick / standard / deep) from the
question and maps to per-depth budgets; both can be overridden per request or
by environment variables.

## Evidence model

- **Claim** → **Evidence** → **Source**. Every important claim is backed by
  one or more consulted sources; sources are never fabricated.
- **Source hierarchy**: official documentation → official repository →
  primary source → official announcement → academic → technical publication →
  community discussion → search summaries.
- **Contradictions**: when sources disagree, both sides are recorded and the
  conflict is investigated (version/date/edition/tier). Unresolved
  contradictions surface in the report.
- **Confidence** is categorical (high/medium/low) and derived from the
  authority of the best supporting source and the number of corroborating
  sources, with a documented `confidenceBasis`.

## Services

| Service | Purpose |
|---------|---------|
| `depth-classifier` | Deterministic depth + freshness inference |
| `planning` | Plan prompt builder, budget-bounded plan clamps |
| `evidence` | State merge, confidence derivation, stop-reason selection, digests |
| `limits` | Budget resolution (defaults → env → per-run overrides) |

## Tools

The Research Agent receives tools via the declarative MCP registry
(`mcp.servers.json`):

- `web-search` — Brave search MCP (requires `BRAVE_API_KEY`; skipped when
  unset, degrading the agent to fetch + GitHub only).
- `github` — GitHub MCP, shared with the GitHub Agent (requires `GITHUB_TOKEN`).
- `web_fetch` — built-in `@mastra/core/tools` webFetchTool for reading sources
  (no API key required).

## Configuration

| Environment variable | Purpose |
|----------------------|---------|
| `BRAVE_API_KEY` | Enables the web search tool |
| `GITHUB_TOKEN` | Enables the GitHub MCP server |
| `RESEARCH_TRACE_DISABLED` | `true` disables `[RESEARCH_TRACE]` logs |
| `RESEARCH_MAX_ITERATIONS` | Override max passes (default per depth) |
| `RESEARCH_MAX_SEARCHES` | Override max searches |
| `RESEARCH_MAX_READS` | Override max source reads |
| `RESEARCH_MAX_RUNTIME_MS` | Override max runtime (ms) |

Default budgets per depth: quick `{1, 2, 3, 60s}`, standard `{3, 6, 8, 180s}`,
deep `{5, 12, 16, 300s}`.

## API Routes

- `POST /research` — Run research on a validated request; returns the
  structured `ResearchResult`.
- `GET /research/config` — Current capability/config status (search, fetch,
  github availability, degrade mode).

## Files

```
src/mastra/agents/research/
├── agent.ts                # Agent Mastra definition
├── config.ts               # Capability/degrade configuration
├── research-instructions.ts# System prompt
├── index.ts                # Entry point
├── README.md               # This file
├── domain/
│   ├── contracts.ts        # Runtime/task contracts, ResearchAgentLike
│   ├── enums.ts            # Depth, stop reason, status, error codes, hierarchy
│   ├── schemas.ts          # Zod validation schemas (request, pass, plan, synthesis, result)
│   └── types.ts            # Derived types + DEFAULT_LIMITS
├── services/
│   ├── depth-classifier.ts # Depth & freshness heuristics
│   ├── planning.ts         # Plan prompt + clampPlan
│   ├── evidence.ts         # mergeState, deriveConfidence, digests
│   └── limits.ts           # Budget resolution
├── runtime/
│   └── research-runtime.ts # runResearch orchestration loop
└── tests/                  # Vitest suite (runtime, services, registration)
```

## Testing

Run the research suite alone:

```sh
npx vitest run src/mastra/agents/research/tests
```

The runtime tests use a fake `ResearchAgentLike` double, so no API keys,
network, or real LLM calls are required.