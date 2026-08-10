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