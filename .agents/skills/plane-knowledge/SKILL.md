# Compagnon — Plane Knowledge

## Purpose

This skill defines how Compagnon understands and works with Plane when a real Plane integration is available.

This skill describes knowledge, rules, and expected behavior.

It does not itself provide access to Plane.

Actual access requires a real Plane capability such as an API tool, connector, or MCP integration.

---

## 1. Plane's role

Plane is treated as a work-management and project-planning system.

When connected, Plane may contain authoritative information about:

* projects;
* workspaces;
* issues;
* work items;
* states;
* priorities;
* labels;
* cycles;
* modules;
* assignees;
* comments;
* estimates;
* relationships;
* project-level organization.

Plane should primarily answer:

> What work exists, what work is officially planned, and what is its current tracked state?

Plane is therefore different from a documentation system and different from direct workspace observation.

---

## 2. Plane is not the source of everything

Compagnon must distinguish between different sources of truth.

```text
Plane
  ↓
Officially tracked work

Workspace
  ↓
Actual observable implementation state

Knowledge system
  ↓
Documentation and accumulated knowledge

Conversation
  ↓
Current user instructions and temporary context
```

Compagnon must not automatically treat information from one source as equivalent to another.

For example:

A Plane issue marked `Done` does not automatically prove that the implementation is actually present and working.

Likewise, code existing in the workspace does not automatically mean that the corresponding Plane issue is marked `Done`.

When relevant, Compagnon should verify both.

---

## 3. Plane as the planning authority

When a real Plane integration is available, Plane should be considered authoritative for the officially tracked state of work.

Compagnon must not invent:

* issue status;
* issue priority;
* assignee;
* cycle;
* project;
* completion state;
* backlog state;
* official task relationships.

If Plane reports a state, Compagnon should use that state rather than guessing.

---

## 4. Work lifecycle

The conceptual work lifecycle is:

```text
Backlog
   ↓
Todo
   ↓
In Progress
   ↓
Blocked
   ↓
Done
```

Other states such as `Cancelled` may also exist.

Compagnon must not assume that every Plane installation uses exactly these names.

The actual states exposed by the connected Plane instance take precedence.

---

## 5. Issues and work items

A Plane issue represents an officially tracked unit of work.

An issue may contain:

* title;
* description;
* state;
* priority;
* assignee;
* labels;
* cycle;
* module;
* comments;
* estimates;
* relations;
* metadata.

Compagnon must use the actual issue data returned by Plane.

It must not reconstruct missing information from assumptions.

---

## 6. Reading Plane

When the user asks about project work, Compagnon should determine whether Plane contains relevant information.

When Plane is connected, appropriate operations may include:

```text
Search workspace
Search project
List issues
Get issue
Read issue description
Read comments
Inspect issue state
Inspect project structure
```

Only operations actually exposed by the integration may be performed.

---

## 7. Searching

When searching Plane, Compagnon should prefer precise identifiers when available.

Useful identifiers may include:

* workspace;
* project;
* issue ID;
* issue identifier;
* cycle;
* module;
* assignee.

If an issue identifier is known, use it instead of relying on title matching.

If only a title is known, search for matching issues and verify the result before acting.

Do not assume that two similarly named issues are the same issue.

---

## 8. Project boundaries

Compagnon must understand the hierarchy:

```text
Workspace
   │
   └── Project
          │
          ├── Issues
          ├── Cycles
          ├── Modules
          └── Project configuration
```

Compagnon must not operate on a project merely because it has a similar name.

The actual project identity returned by Plane must be used.

---

## 9. Permissions

Plane permissions are authoritative.

Compagnon must respect:

* workspace permissions;
* project permissions;
* issue permissions;
* API scopes;
* user permissions;
* authentication boundaries.

If Plane refuses access to an object, Compagnon must report the access limitation.

It must not attempt to bypass the restriction through another endpoint, guessed identifier, or alternative authentication mechanism.

---

## 10. Creating work

When the user asks Compagnon to create a task in Plane, Compagnon should first determine the appropriate:

* workspace;
* project;
* title;
* description;
* state;
* priority;
* assignee;
* cycle;
* module;
* labels;

only where those fields are required or explicitly requested.

Compagnon should avoid inventing metadata.

If optional information is not known, it should leave it unspecified when the API permits this.

---

## 11. Updating work

Updating a Plane issue is a state-changing operation.

Before modifying an issue, Compagnon should establish:

```text
Target issue
+
Requested change
+
Expected result
```

If the active safety policy requires confirmation, confirmation must be obtained before execution.

Examples of updates include:

* changing state;
* changing priority;
* changing assignee;
* editing description;
* adding labels;
* assigning a cycle;
* adding a comment.

---

## 12. Comments

Comments are part of the official project record.

When adding a comment, Compagnon should:

* make the purpose clear;
* avoid presenting speculation as fact;
* distinguish observations from conclusions;
* avoid exposing secrets;
* avoid creating duplicate comments unnecessarily.

A comment should represent an intentional project communication, not internal reasoning.

---

## 13. Status transitions

A status transition should be based on evidence whenever Compagnon is responsible for determining the transition.

For example:

```text
Todo
  ↓
In Progress
```

may be justified when implementation work has actually started.

Similarly:

```text
In Progress
  ↓
Done
```

should not be performed merely because code was written.

Relevant evidence may include:

* implementation completed;
* tests passing;
* required verification completed;
* requested behavior confirmed;
* user explicitly declaring completion.

The exact evidence requirement depends on the project's workflow and active policies.

---

## 14. Plane versus workspace state

Plane describes tracked work.

The workspace describes observable reality.

Compagnon should be able to detect discrepancies.

Example:

```text
Plane:
Issue = Done

Workspace:
Feature is incomplete
```

This should be reported as a discrepancy.

Compagnon must not silently change either source simply to make them agree.

Another example:

```text
Plane:
Issue = In Progress

Workspace:
Implementation appears complete
```

Compagnon may report that the tracked status appears behind the observable implementation state.

It must not automatically change Plane unless authorized to do so.

---

## 15. Plane versus documentation

Plane and a knowledge system have different responsibilities.

```text
Plane
  → What work is officially tracked?

Documentation
  → What do we know about the system?

Workspace
  → What actually exists?

Memory
  → What decisions and context should persist?
```

Compagnon should use the appropriate source for each question.

---

## 16. Planning from Plane

When asked:

> "What should I work on next?"

Compagnon should prefer actual Plane data when Plane is connected.

Relevant factors may include:

* issue state;
* priority;
* cycle;
* dependencies;
* blockers;
* assignment;
* project context.

Compagnon may reason about the work, but must distinguish:

```text
Plane says:
...

Compagnon recommends:
...
```

A recommendation is not an official Plane decision unless Plane was actually updated.

---

## 17. Blocked work

If a Plane issue is blocked, Compagnon should identify the blocking information when available.

A blocked issue should not be treated as ordinary `In Progress` work.

When appropriate, Compagnon may investigate the blocker using other available capabilities.

For example:

```text
Plane
  ↓
Issue blocked by configuration

Workspace
  ↓
Inspect configuration

Knowledge
  ↓
Check documented procedure

Result
  ↓
Determine possible resolution
```

The investigation does not automatically modify Plane.

---

## 18. Task completion

Compagnon must distinguish between:

```text
Implementation completed
```

and:

```text
Plane issue marked Done
```

These are separate events.

A task is not officially marked complete merely because Compagnon believes it is complete.

If a Plane update capability exists and authorization is provided, Compagnon may update the issue according to the applicable policy.

---

## 19. Synchronization

If Plane is connected, synchronization means actual communication with Plane.

Compagnon must not claim:

* "Plane is synchronized";
* "The task has been updated";
* "The issue is now Done";
* "The comment was added";

unless the corresponding operation actually succeeded.

If an operation fails, report the failure.

---

## 20. No fabricated Plane knowledge

Compagnon must never invent:

* project IDs;
* workspace IDs;
* issue IDs;
* issue URLs;
* states;
* comments;
* assignees;
* cycles;
* modules;
* permissions;
* synchronization results.

When information cannot be retrieved, say that it could not be verified.

---

## 21. Credentials

Plane credentials are configuration secrets.

Compagnon must never expose:

* API keys;
* tokens;
* passwords;
* authentication headers;
* private credentials.

If authentication fails, report that Plane authentication is unavailable or invalid without revealing the credential.

---

## 22. API limitations

Plane installations may expose different APIs, versions, permissions, or endpoints.

Compagnon must follow the actual connected integration.

This skill must never be interpreted as proof that every described operation is available.

For example, this skill may describe:

```text
create issue
update issue
add comment
```

but if the current integration only exposes:

```text
search issue
get issue
```

then Compagnon may only perform the latter operations.

---

## 23. User-provided Plane information

If the user provides Plane information directly in the conversation, Compagnon may use it as user-provided information.

However, it should distinguish:

```text
User provided:
"The issue is Done."

Plane verified:
Issue state = Done
```

These are not equivalent sources.

If verification is possible and important, Compagnon should verify against Plane.

---

## 24. Working with multiple projects

When multiple Plane projects are available, Compagnon must establish the correct project before acting.

Never select a project solely because:

* its name looks similar;
* it was used previously;
* it appears first in a search result.

Use available identifiers and contextual evidence.

If ambiguity remains and acting would affect project state, ask for clarification.

---

## 25. Reporting Plane information

When reporting Plane information, Compagnon should prioritize concise, useful information.

For example:

```text
Issue: Implement authentication
Project: Companion
State: In Progress
Priority: High
Assignee: ...
```

When useful, include the source or issue identifier.

Do not overwhelm the user with raw API responses unless requested.

---

## 26. Relationship with Compagnon's autonomy

Plane does not control Compagnon's entire behavior.

Plane controls the officially tracked work state.

Compagnon may still:

* investigate problems;
* inspect the workspace;
* consult documentation;
* reason about solutions;
* propose improvements;
* identify discrepancies;
* prepare changes;
* request authorization;
* perform authorized work.

Plane provides the planning context, not the entirety of Compagnon's intelligence.

---

## 27. Core principle

The foundational rule of Plane Knowledge is:

> **Plane is the source of truth for officially tracked work, but not automatically for the actual state of the system.**

Compagnon should therefore combine:

```text
Plane
  → tracked work

Workspace
  → observable reality

Knowledge
  → documented understanding

Memory
  → persistent context

User
  → current intent and authorization
```

Compagnon must preserve the distinction between these sources at all times.
