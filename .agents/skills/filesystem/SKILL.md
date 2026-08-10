# Filesystem — Compagnon

## Purpose

This skill defines how Compagnon should use the filesystem capabilities available through the connected filesystem provider.

The filesystem provider is an external capability exposed to Compagnon at runtime, such as an MCP filesystem server.

This skill defines behavior and operating rules. It does not implement filesystem operations and must not assume a specific filesystem implementation.

The runtime and filesystem provider determine which directories and operations are actually available.

---

## Capability Boundary

Compagnon may only operate on filesystem locations exposed by the active filesystem provider.

The existence of this skill does not grant filesystem access by itself.

The real filesystem capabilities come from the tools currently exposed to the agent.

Never assume access to:

* the host filesystem;
* the user's home directory;
* system directories;
* parent directories;
* sibling projects;
* mounted volumes;
* remote filesystems;
* directories mentioned in previous conversations.

If a path has not been established as accessible through an actual filesystem tool, do not assume that it is accessible.

---

## Workspace Discovery

When beginning work on an unfamiliar workspace:

1. Determine which filesystem capabilities are currently available.
2. Identify the accessible root or workspace directories.
3. Inspect the relevant directory structure before making assumptions about the project.
4. Locate project configuration and documentation when relevant.
5. Establish the actual project structure from filesystem observations.

Do not infer the workspace location from:

* the operating system;
* the current user's name;
* a previous session;
* an example path;
* a previous project;
* another agent;
* Orion or any other external application.

---

## Observation Before Action

Prefer observation before modification.

For a new task, inspect only what is necessary to establish the current state.

Typical read-only operations include:

* listing directories;
* reading files;
* inspecting directory trees;
* searching for files;
* obtaining file metadata;
* reading project configuration;
* inspecting documentation.

Base claims about the workspace on actual filesystem observations.

Never claim that a file, directory, configuration, implementation, or project structure exists without evidence from an available filesystem capability.

---

## Reading Files

When information is required from a file:

1. Verify that the path is accessible.
2. Read the file using the available filesystem capability.
3. Use the returned content as the source of truth.
4. Distinguish observed information from assumptions.

When a file is large, read only the relevant portions when the filesystem capability allows it.

Do not pretend to have read a file that was not actually accessed.

---

## Searching

When looking for an unknown file, symbol, configuration, implementation, or documentation:

* Prefer filesystem search capabilities when available.
* Search within the authorized workspace.
* Narrow the search when possible.
* Inspect search results before drawing conclusions.

Do not perform broad searches outside the authorized filesystem scope.

---

## Creating and Modifying Files

Filesystem write capabilities are potentially destructive.

Before creating or modifying a file:

1. Understand the requested change.
2. Verify the target path.
3. Inspect the existing file when it already exists.
4. Determine the intended modification.
5. Follow the active safety and confirmation policy.

Never overwrite an existing file merely because doing so appears convenient.

For an existing file, prefer a targeted edit over replacing the entire file when the available capabilities support targeted editing.

When a write requires human confirmation according to the active safety policy, describe the intended action before executing it and wait for explicit confirmation.

---

## Deleting Files

Deletion is destructive.

Before deleting anything:

1. Verify the exact target path.
2. Determine whether the target is a file or directory.
3. Explain what will be removed.
4. Follow the active safety policy.
5. Obtain explicit confirmation when required.

Never delete files as cleanup unless the user explicitly requested the cleanup or the action is otherwise authorized by the active policy.

Never delete an unknown file simply because it appears unused.

---

## Moving and Renaming

Treat move and rename operations as write operations.

Before performing them:

* verify the source;
* verify the destination;
* check whether the destination already exists when possible;
* consider whether references to the original path may be affected;
* follow the active safety and confirmation policy.

---

## Sensitive Files

Filesystem access may expose sensitive information.

Never intentionally expose, reproduce, or reveal:

* passwords;
* API keys;
* access tokens;
* private keys;
* authentication cookies;
* credentials;
* secret environment variables;
* other sensitive secrets.

If a sensitive file is encountered accidentally, do not reproduce its contents.

Use only the minimum information necessary to explain the situation.

---

## Tool and Provider Awareness

This skill describes filesystem behavior, not a fixed list of tools.

The actual available filesystem capabilities are determined at runtime.

Do not assume that a particular tool exists merely because another filesystem provider normally exposes it.

For example, do not assume the existence of:

* `read_file`;
* `write_file`;
* `edit_file`;
* `search_files`;
* `directory_tree`;

unless the active toolset actually exposes equivalent capabilities.

Use the tools that are actually available.

---

## MCP Awareness

When the filesystem is provided through MCP:

* MCP is the transport and capability interface.
* The MCP filesystem server provides the actual filesystem tools.
* This skill provides behavioral guidance for using those tools.
* The skill does not replace the MCP server.
* The skill does not create additional filesystem permissions.

Do not claim that an MCP capability exists unless it is actually exposed by the connected MCP server.

---

## Multi-Environment Behavior

Compagnon must remain independent of a specific operating system, username, project location, or machine.

Never hard-code or assume paths such as:

* `/home/...`;
* `/Users/...`;
* `C:\Users\...`;
* `/workspace/...`.

Paths must come from the active environment, filesystem provider, project configuration, or actual filesystem observations.

The same skill must work across different machines and workspace layouts.

---

## Project Awareness

The filesystem is a source of project evidence.

When investigating a project, use the filesystem to establish:

* project structure;
* source files;
* configuration;
* documentation;
* dependencies;
* scripts;
* relevant implementation details.

Do not invent project conventions.

If project documentation contradicts an assumption, prefer the observed project documentation and current implementation.

---

## Failure Handling

If a filesystem operation fails:

1. Report that the operation failed.
2. Preserve the actual error information necessary to understand the failure.
3. Do not claim that the operation succeeded.
4. Do not silently retry destructive operations.
5. Determine whether the failure is caused by:

   * an inaccessible path;
   * missing permissions;
   * a missing capability;
   * an invalid path;
   * a provider limitation;
   * another observable error.

If the required filesystem capability does not exist, state that it is unavailable rather than pretending it exists.

---

## Core Principles

Compagnon follows these principles when using the filesystem:

1. Observe before assuming.
2. Verify paths before acting.
3. Use only authorized filesystem locations.
4. Use only capabilities actually exposed by the runtime.
5. Prefer read-only inspection before modification.
6. Never expose secrets.
7. Require confirmation for actions covered by the active safety policy.
8. Never silently perform destructive cleanup.
9. Never invent files, directories, project structure, or filesystem capabilities.
10. Remain independent of any specific machine, operating system, user, or project path.

The filesystem provider gives Compagnon the ability to interact with files.

This skill defines how that ability should be used responsibly.
