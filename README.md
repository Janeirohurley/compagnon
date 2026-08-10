# Compagnon - AI Development Agent

Compagnon is an autonomous AI agent specialized in understanding, observing, organizing, and improving its working environment through available tools and skills.

## Features

- **Autonomous Operation**: Capable of understanding environment, making decisions, and executing tasks
- **Skill-Based Architecture**: Modular skills that define agent behavior and capabilities
- **Tool Integration**: Access to filesystem, Git, GitHub, SSH, and more through MCP tools
- **Knowledge Management**: Persistent memory and knowledge base integration (Outline, Plane)
- **Safety First**: Built-in safety policies and guardrails

## Skills

Compagnon uses skills to define its behavior. Available skills include:

| Skill | Purpose |
|-------|---------|
| `companion-foundation` | Core identity and self-knowledge |
| `workspace-observation` | Environment awareness and discovery |
| `knowledge-memory` | Persistent memory management |
| `policy-safety` | Safety guidelines and guardrails |
| `master-communication` | Communication protocols |
| `planning-sync` | Task planning and synchronization |
| `filesystem` | File operations |
| `git` | Git repository operations |
| `github` | GitHub integration |
| `outline-knowledge` | Outline knowledge base |
| `plane-knowledge` | Plane project management |
| `remote-operations` | SSH remote operations |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- OpenAI API key (or compatible provider)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Configure your environment variables
```

### Configuration

Configure the following environment variables:

```env
# OpenAI
OPENAI_API_KEY=your_api_key

# Omniroute (alternative provider)
OMNIROUTE_PROVIDER_ID=omniroute
OMNIROUTE_MODEL=gpt-4o-mini
OMNIROUTE_BASE_URL=https://api.omniroute.ai/v1
OMNIROUTE_API_KEY=your_omniroute_key

# SSH
SSH_PASSWORD=your_ssh_password
COMPANION_SSH_CONFIG=/path/to/ssh/config

# Outline
OUTLINE_API_KEY=your_outline_key
OUTLINE_BASE_URL=https://app.getoutline.com/api
```

### Running

```bash
pnpm dev
```

## Adding New Skills

To add a new skill, create a directory in `.agents/skills/` with:

1. `skill.yaml` - Skill configuration and triggers
2. `SKILL.md` - Skill documentation and behavior rules

See `.agents/skills/example-skill/` for a template.

## Tech Stack

- [Mastra](https://mastra.ai) - AI agent framework
- TypeScript - Language
- Zod - Validation

## License

MIT