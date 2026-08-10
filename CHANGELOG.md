# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Skills System**: Added comprehensive skill-based architecture for agent capabilities
  - `companion-foundation`: Core identity and self-knowledge
  - `workspace-observation`: Environment awareness and discovery
  - `knowledge-memory`: Persistent memory and knowledge management
  - `policy-safety`: Safety guidelines and guardrails
  - `master-communication`: Communication protocols
  - `planning-sync`: Task planning and synchronization
  - `filesystem`: File operations with boundary awareness
  - `git`: Git repository operations
  - `github`: GitHub integration
  - `outline-knowledge`: Outline knowledge base integration
  - `plane-knowledge`: Plane project management integration
  - `remote-operations`: SSH and remote command execution
  - `planning-sync`: Planning synchronization
  - `policy-safety`: Safety policies

- **New Tools**:
  - `companion-foundation-tool`: Load companion foundational knowledge
  - `date-time-tool`: Get current date and time
  - `project-file-tools`: Enhanced file operations
  - `ssh-command-tool`: SSH remote operations

- **MCP Integration**: Added MCP (Model Context Protocol) support
- **Example Skill Template**: Added template for creating new skills

### Changed
- Updated `.env.example` with new configuration variables
- Enhanced agent configuration with skills array
- Updated dependencies (`@mastra/editor`, `@mastra/mcp`, `ai`)

### Fixed
- Improved filesystem boundary awareness
- Enhanced skill loading mechanism

## [1.0.0] - 2024-01-01

### Added
- Initial project setup
- Basic agent configuration
- Mastra framework integration