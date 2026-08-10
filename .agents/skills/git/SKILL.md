---

name: git
description: Use this skill when working with Git repositories through the available Git MCP server, including repository inspection, history, branches, diffs, commits, and authorized repository operations.
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Git

Use this skill when Compagnon needs to inspect or operate on a Git repository through the connected Git MCP server.

This skill defines how Git should be used. It does not itself provide Git access.

The actual Git capabilities available to Compagnon are determined by the MCP tools exposed by the connected Git server.

## Use Cases

* Inspect the current Git repository state.
* Check the current branch.
* Inspect staged and unstaged changes.
* Read diffs.
* Inspect commit history.
* Inspect individual commits.
* List branches and tags.
* Inspect repository remotes.
* Investigate when and how a file changed.
* Understand the current development state of a repository.
* Create commits when explicitly requested and authorized.
* Create or switch branches when explicitly requested and safe.
* Compare local Git state with GitHub when GitHub MCP is also available.
* Investigate repository problems before proposing implementation changes.

## Capability Boundary

This skill does not create Git access.

Git access exists only when Git MCP tools are actually available to the agent.

Never assume that installing this skill provides:

* Git access;
* shell access;
* filesystem access;
* GitHub access;
* repository access;
* push access;
* commit access.

Use only the Git tools actually exposed by the MCP server.

If the required operation is unavailable, state that it is unavailable instead of inventing another tool.

## Repository Configuration

Do not hard-code repository-specific configuration in this skill.

Never assume:

* repository path;
* repository name;
* branch name;
* Git remote;
* GitHub organization;
* GitHub account;
* machine;
* username;
* authentication method.

The repository is selected by the Git MCP configuration.

The current repository state must be discovered through the available tools.

## Source Of Truth

For Git repository state, prefer current Git tool results over:

* conversation memory;
* previous responses;
* assumptions;
* documentation;
* cached information.

A previous observation may no longer represent the current repository state.

When accuracy matters, inspect the repository again.

## Investigation Flow

When entering an unfamiliar Git task:

1. Identify the repository exposed by the Git MCP.
2. Inspect the current branch.
3. Inspect the working-tree status.
4. Inspect staged changes.
5. Inspect unstaged changes.
6. Inspect relevant diffs.
7. Inspect recent commits when historical context is necessary.
8. Only then form conclusions or propose actions.

Do not perform modifications simply because a repository appears to be in an unexpected state.

## Git State

Keep these concepts separate:

* working tree;
* index/staging area;
* current branch;
* local commits;
* remote-tracking branches;
* remote repository.

For example:

A clean working tree does not mean that the branch is synchronized with its remote.

A local commit does not mean that it has been pushed.

A local branch does not mean that the corresponding remote branch exists.

Verify each state independently when relevant.

## Evidence

When reporting repository information, distinguish:

### Observed

Information directly returned by Git tools.

### User-provided

Information explicitly provided by the user.

### Historical

Information established by repository history.

### Assumption

Information that has not yet been verified.

Do not present assumptions as facts.

Example:

> The current branch is `feature/companion`.

This can be stated after observing the branch.

Do not automatically conclude:

> `feature/companion` is the branch currently being worked on by the user.

That requires additional evidence.

## Diff Analysis

When the user asks what changed:

1. Determine whether the changes are staged or unstaged.
2. Inspect the relevant diff.
3. Identify affected files.
4. Explain the actual changes.
5. Avoid attributing changes to Compagnon unless that is known.

Do not rewrite or discard changes while investigating them.

## User Changes

Never assume that uncommitted changes belong to Compagnon.

They may have been created by:

* the user;
* another developer;
* another agent;
* an IDE;
* automation;
* another process.

Preserve unrelated work.

Do not use reset, clean, restore, checkout, or similar operations merely to obtain a clean working tree.

## Commit Workflow

When the user explicitly requests a commit:

1. Inspect the repository state.
2. Inspect the staged changes.
3. Determine what will be committed.
4. Identify unrelated changes.
5. Confirm the requested scope.
6. Apply the active safety policy.
7. Create the commit.
8. Verify that the commit was created successfully.

Do not create a commit just because changes look complete.

Do not include unrelated changes.

Do not fabricate commit messages.

The commit message should accurately describe the actual change.

## Branch Workflow

Before creating or switching branches:

1. Inspect the current branch.
2. Inspect working-tree status.
3. Determine whether uncommitted changes exist.
4. Determine whether the operation could affect those changes.
5. Follow the active safety policy.

Never silently switch the user's working context.

Branch deletion is destructive and requires explicit authorization.

## Remote Operations

Treat operations affecting remotes as potentially higher risk.

Examples:

* push;
* force push;
* remote configuration;
* remote branch deletion;
* remote tag deletion.

Before a state-changing remote operation:

1. Identify the repository.
2. Identify the remote.
3. Identify the target branch or reference.
4. Explain the operation.
5. Apply the active safety policy.
6. Obtain required confirmation.
7. Execute the operation.
8. Verify the result.

Never force-push unless explicitly requested and authorized.

Never delete a remote branch or tag without explicit authorization.

## Destructive Operations

Treat the following as destructive or potentially destructive:

* `reset` operations that discard changes;
* `clean`;
* restoring files over local changes;
* deleting branches;
* deleting tags;
* history rewriting;
* force pushes;
* operations that overwrite existing work.

Before performing such an operation:

1. Explain exactly what will be affected.
2. Explain potential data loss.
3. Identify the repository and references.
4. Request explicit confirmation.
5. Execute only after confirmation.

If the effect of an operation is uncertain, treat it as destructive.

## Git And GitHub

Git MCP and GitHub MCP are separate capabilities.

Git MCP:

* local repository;
* local branches;
* local commits;
* local working tree;
* local diffs;
* local Git history.

GitHub MCP:

* GitHub repositories;
* pull requests;
* GitHub issues;
* remote branches;
* GitHub metadata;
* GitHub-specific operations.

Do not use Git MCP to claim that something happened on GitHub.

Do not use GitHub MCP to claim that the local working tree has changed.

When both are available, compare their states when necessary.

## Git And Filesystem

Git MCP and Filesystem MCP are also separate capabilities.

Filesystem MCP provides file operations.

Git MCP provides repository operations.

Use the appropriate capability for the task.

For example:

* read a file → Filesystem MCP;
* inspect whether the file is tracked → Git MCP;
* inspect changes to the file → Git MCP;
* modify the file → Filesystem MCP;
* commit the modification → Git MCP.

Do not assume that one MCP automatically provides the capabilities of another.

## History

Use Git history when the user asks questions such as:

* When was this changed?
* What changed in this commit?
* Who introduced this change?
* How did this file evolve?
* What was the previous implementation?
* Which commits affected this component?

Prefer actual commit diffs over commit messages when determining what code changed.

Do not infer undocumented architectural reasoning from commit history.

## Repository Investigation Before Coding

When Compagnon is asked to modify a repository, Git information can provide useful context before implementation.

Inspect:

* current branch;
* current changes;
* recent relevant commits;
* existing work affecting the requested area.

Do not overwrite or revert existing work merely because it conflicts with the requested implementation.

Preserve the user's current state and adapt the implementation to it when possible.

## Git And Project Memory

Git history is evidence about repository changes.

Git history is not equivalent to project memory.

Git does not automatically contain:

* architectural decisions;
* reasons for decisions;
* user preferences;
* undocumented conventions;
* discussions;
* future plans;
* external project context.

Use project documentation, memory skills, Outline, or other available knowledge sources when those questions require information beyond Git.

## Security

Never expose:

* Git credentials;
* access tokens;
* passwords;
* private SSH keys;
* credential files;
* authentication headers;
* secret environment variables.

Never place credentials in:

* commits;
* commit messages;
* source files;
* examples;
* logs;
* generated documentation.

If sensitive information appears in Git output, suppress the secret value and report only the relevant non-sensitive information.

## Error Handling

If a Git MCP operation fails:

1. State that the operation failed.
2. Report relevant non-sensitive error information.
3. Explain the likely category of failure when it can be determined.
4. Do not claim that the operation succeeded.
5. Do not automatically perform a different destructive operation.
6. Do not bypass the active safety policy.

If the required Git MCP tool does not exist, state that the capability is unavailable.

## Documentation And External Sources

When the exact behavior of the connected Git MCP implementation matters, inspect its current documentation or repository before inventing tool names, arguments, or behavior.

Do not assume that two different Git MCP implementations expose identical tools.

The MCP server's currently exposed tools take precedence over examples in this document.

## Operating Model

For Git work, follow:

Observe → Understand → Verify → Plan → Confirm when required → Act → Verify result.

Avoid:

Guess → Act.

## Final Rule

This skill provides operational knowledge about Git.

It does not grant Git capabilities.

The connected Git MCP server is the source of truth for the available Git operations.

Only use tools that actually exist.

Never invent Git tools, arguments, repository state, branches, commits, remotes, or synchronization state.
