# Changelog

## [Unreleased] - Current Development

This section tracks changes not yet released.

### Added

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