# Compagnon

Autonomous AI development agent that understands, observes, and improves its working environment.

## What is Compagnon?

Compagnon is an AI agent built on the Mastra framework. It uses a skill-based architecture where each skill defines specific behavior patterns. The agent discovers available tools at runtime and applies skills accordingly.

## Technology Stack

- **Framework**: Mastra v1.57.0
- **Language**: TypeScript
- **AI Provider**: OpenAI or compatible (Omniroute)
- **Validation**: Zod 4.4.3

## Skills Architecture

The agent uses these skills to define its behavior:

| Skill | Purpose |
|-------|---------|
| `companion-foundation` | Core identity, self-knowledge, and operating principles |
| `workspace-observation` | Environment discovery and awareness |
| `knowledge-memory` | Persistent memory across sessions |
| `policy-safety` | Safety guidelines and guardrails |
| `master-communication` | Communication protocols |
| `planning-sync` | Task planning and synchronization |
| `filesystem` | File operations with boundary awareness |
| `git` | Git repository operations |
| `github` | GitHub API integration |
| `outline-knowledge` | Outline knowledge base connection |
| `plane-knowledge` | Plane project management connection |
| `remote-operations` | SSH remote execution |

## Installation

```bash
pnpm install
cp .env.example .env
```

Configure your API keys in `.env`.

## Usage

```bash
pnpm dev
```

## Project Structure

```
.
├── .agents/skills/     # Skill definitions
├── src/mastra/         # Agent configuration
├── CHANGELOG.md        # Change history
└── README.md           # This file
```

## Adding a New Skill

Create a skill in `.agents/skills/<skill-name>/`:

1. `skill.yaml` - Configuration and triggers
2. `SKILL.md` - Behavior documentation

See `.agents/skills/example-skill/` for a template.

## License

MIT

<!-- tree-generator:start -->
```text
compagnon/
|-- .agents/
|   `-- skills/
|       |-- commit-message/
|       |   `-- SKILL.md
|       |-- commit-message-storyteller/
|       |   |-- references/
|       |   |   `-- conventional-commits-guide.md
|       |   `-- SKILL.md
|       |-- companion-foundation/
|       |   `-- SKILL.md
|       |-- create-implementation-plan/
|       |   `-- SKILL.md
|       |-- create-readme/
|       |   `-- SKILL.md
|       |-- developer/
|       |   `-- SKILL.md
|       |-- doc-and-modernize/
|       |   |-- references/
|       |   |   |-- copilot-instructions.template.md
|       |   |   `-- migration-hazards.md
|       |   `-- SKILL.md
|       |-- documentation/
|       |   `-- SKILL.md
|       |-- documentation-writer/
|       |   `-- SKILL.md
|       |-- draw-io-diagram-generator/
|       |   |-- assets/
|       |   |   `-- templates/
|       |   |       |-- architecture.drawio
|       |   |       |-- er-diagram.drawio
|       |   |       |-- flowchart.drawio
|       |   |       |-- sequence.drawio
|       |   |       `-- uml-class.drawio
|       |   |-- references/
|       |   |   |-- drawio-xml-schema.md
|       |   |   |-- shape-libraries.md
|       |   |   `-- style-reference.md
|       |   |-- scripts/
|       |   |   |-- .gitignore
|       |   |   |-- add-shape.py
|       |   |   |-- README.md
|       |   |   `-- validate-drawio.py
|       |   `-- SKILL.md
|       |-- drawio/
|       |   |-- scripts/
|       |   |   |-- drawio-to-png.mjs
|       |   |   `-- package.json
|       |   `-- SKILL.md
|       |-- example-skill/
|       |   |-- SKILL.md
|       |   `-- skill.yaml
|       |-- filesystem/
|       |   `-- SKILL.md
|       |-- git/
|       |   `-- SKILL.md
|       |-- git-commit/
|       |   `-- SKILL.md
|       |-- git-flow-branch-creator/
|       |   `-- SKILL.md
|       |-- github/
|       |-- github-issue-query/
|       |   |-- query-issues.sh
|       |   `-- SKILL.md
|       |-- github-issues/
|       |   |-- references/
|       |   |   |-- dependencies.md
|       |   |   |-- images.md
|       |   |   |-- issue-fields.md
|       |   |   |-- issue-types.md
|       |   |   |-- projects.md
|       |   |   |-- search.md
|       |   |   |-- sub-issues.md
|       |   |   `-- templates.md
|       |   `-- SKILL.md
|       |-- github-labels-query/
|       |   |-- query-labels.sh
|       |   `-- SKILL.md
|       |-- github-mcp-server/
|       |   `-- SKILL.md
|       |-- knowledge-memory/
|       |   `-- SKILL.md
|       |-- markdown-to-html/
|       |   |-- references/
|       |   |   |-- basic-markdown-to-html.md
|       |   |   |-- basic-markdown.md
|       |   |   |-- code-blocks-to-html.md
|       |   |   |-- code-blocks.md
|       |   |   |-- collapsed-sections-to-html.md
|       |   |   |-- collapsed-sections.md
|       |   |   |-- gomarkdown.md
|       |   |   |-- hugo.md
|       |   |   |-- jekyll.md
|       |   |   |-- marked.md
|       |   |   |-- pandoc.md
|       |   |   |-- tables-to-html.md
|       |   |   |-- tables.md
|       |   |   |-- writing-mathematical-expressions-to-html.md
|       |   |   `-- writing-mathematical-expressions.md
|       |   `-- SKILL.md
|       |-- master-communication/
|       |   `-- SKILL.md
|       |-- mastra/
|       |   |-- references/
|       |   |   |-- common-errors.md
|       |   |   |-- core-concepts.md
|       |   |   |-- create-mastra.md
|       |   |   |-- embedded-docs.md
|       |   |   |-- mastra-api.md
|       |   |   |-- migration-guide.md
|       |   |   |-- model-selection.md
|       |   |   |-- remote-docs.md
|       |   |   `-- trace-intelligence.md
|       |   |-- scripts/
|       |   |   `-- provider-registry.mjs
|       |   `-- SKILL.md
|       |-- mcp-implementation-security-review/
|       |   `-- SKILL.md
|       |-- mcp-security-audit/
|       |   `-- SKILL.md
|       |-- outline-knowledge/
|       |   `-- SKILL.md
|       |-- plane-knowledge/
|       |   `-- SKILL.md
|       |-- planning-sync/
|       |   `-- SKILL.md
|       |-- policy-safety/
|       |   `-- SKILL.md
|       |-- readme-blueprint-generator/
|       |   `-- SKILL.md
|       |-- remote-operations/
|       |   `-- SKILL.md
|       `-- workspace-observation/
|           `-- SKILL.md
|-- .tree-generator.json
|-- src/
|   `-- mastra/
|       |-- agents/
|       |   |-- agent.ts
|       |   |-- delegation.ts
|       |   `-- memory-agent.ts
|       |-- config/
|       |   |-- companion-config.ts
|       |   `-- model-config.ts
|       |-- connections/
|       |   |-- connection-providers.ts
|       |   |-- connection-store.ts
|       |   `-- plane-provider.ts
|       |-- instructions/
|       |   `-- companion-instructions.ts
|       |-- mcp/
|       |   |-- filesystem.ts
|       |   |-- git.ts
|       |   |-- github.ts
|       |   |-- index.ts
|       |   |-- outline.ts
|       |   |-- plane.ts
|       |   `-- ssh.ts
|       |-- memory/
|       |   |-- db/
|       |   |   |-- client.ts
|       |   |   `-- schema.ts
|       |   |-- hooks/
|       |   |   `-- index.ts
|       |   |-- manager/
|       |   |   `-- index.ts
|       |   |-- tools/
|       |   |   `-- index.ts
|       |   |-- types/
|       |   |   `-- index.ts
|       |   |-- consolidation.ts
|       |   `-- observability.ts
|       |-- models/
|       |-- routes/
|       |   |-- connections-routes.ts
|       |   `-- memory-routes.ts
|       |-- tools/
|       |   |-- outline/
|       |   |-- plane/
|       |   |-- shell/
|       |   |-- ssh/
|       |   |-- web/
|       |   |-- workspace/
|       |   |-- companion-foundation-tool.ts
|       |   |-- date-time-tool.ts
|       |   |-- index.ts
|       |   |-- plane-api-tools.ts
|       |   |-- project-file-tools.ts
|       |   |-- schedule-tools.ts
|       |   `-- ssh-command-tool.ts
|       |-- workflows/
|       `-- index.ts
|-- .env.example
|-- .gitignore
|-- AGENTS.md
|-- CHANGELOG.md
|-- MEMORY_SYSTEM.md
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
|-- README.md
|-- skills-lock.json
`-- tsconfig.json
```
<!-- tree-generator:end -->
