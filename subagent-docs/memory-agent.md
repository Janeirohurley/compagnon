# Compagnon — Implement the Memory Agent

## Role

You are implementing the first specialized sub-agent of Compagnon: the **Memory Agent**.

Compagnon currently has memory capabilities based primarily on conversation/thread history, but it does not yet have a dedicated agent responsible for persistent, structured, reusable memory.

Your task is to introduce a production-oriented `Memory Agent` without destabilizing the existing Compagnon architecture.

Do not implement the other sub-agents yet.

The only objective of this task is to design and integrate the Memory Agent cleanly so that it becomes the dedicated specialist responsible for Compagnon's persistent memory.

---

# 1. First inspect the existing system

Before modifying anything, inspect the existing Compagnon repository thoroughly.

Identify:

* current Mastra configuration;
* existing agents;
* existing tools;
* existing memory implementation;
* `@mastra/memory` configuration;
* current storage/database configuration;
* current project structure;
* existing skills;
* existing prompts;
* existing MCP integrations;
* existing filesystem/project tools;
* existing environment configuration;
* existing tests;
* existing TypeScript/JavaScript conventions.

Do not assume that the architecture described in this prompt already exists.

Adapt the implementation to the repository's actual architecture.

Do not introduce a second architecture when an existing abstraction can be extended cleanly.

---

# 2. Objective

Create a dedicated specialized agent:

```text
Memory Agent
```

Its responsibility is to manage Compagnon's persistent knowledge.

The Memory Agent must be responsible for:

* retrieving relevant memories;
* storing durable memories;
* updating memories;
* forgetting memories;
* recording experiences;
* recording architectural decisions;
* managing procedures;
* extracting candidate memories;
* verifying memories;
* detecting stale memories;
* consolidating repeated experiences into procedures;
* providing relevant context to the Main Agent;
* protecting memory quality.

The Memory Agent is not a general-purpose assistant.

It must not independently perform application development, deployment, GitHub operations, web research, or unrelated tasks.

---

# 3. Core principle

The Memory Agent must follow this principle:

> Memory is not a transcript archive.

Do not store everything.

A piece of information should become persistent memory only when it has meaningful future value, is explicitly requested by the user, or is necessary to preserve an important project state, decision, experience, constraint, or procedure.

The Memory Agent must distinguish between:

```text
temporary conversation
        ↓
candidate knowledge
        ↓
validation
        ↓
persistent memory
```

---

# 4. Memory types

Implement support for these four primary memory types.

## Semantic Memory

Durable facts and project knowledge.

Examples:

```text
Novaris uses PostgreSQL.
Compagnon uses Mastra.
The project uses pnpm.
The repository uses a specific architecture.
```

Semantic memory answers:

> What is known to be true?

---

## Episode Memory

Important experiences and outcomes.

Example:

```text
Problem:
Plane API returned 504.

Actions:
Inspected Nginx.
Inspected Docker health.
Inspected API logs.

Result:
API service was unhealthy and required recovery.

Lesson:
Check API health before modifying frontend configuration.
```

Episode memory answers:

> What happened before?

---

## Procedure Memory

Reusable methods learned from successful or repeated experiences.

Example:

```text
Procedure:
Diagnose HTTP 504.

Steps:
1. inspect reverse proxy logs
2. inspect upstream connectivity
3. inspect service health
4. inspect application logs
5. apply correction
6. verify endpoint
```

Procedure memory answers:

> How should this be done?

---

## Decision Memory

Important architectural or operational decisions.

A decision should preserve:

```text
decision
context
alternatives
rationale
consequences
status
source
date
```

Decision memory answers:

> Why was this decision made?

---

# 5. Memory scope

Every persistent memory must have a scope.

At minimum support:

```text
global
organization
project
repository
task
```

Prefer the most specific scope during retrieval.

For example:

```text
repository
    >
project
    >
organization
    >
global
```

A repository-specific fact must not automatically become a global fact.

---

# 6. Provenance

Every important memory must preserve provenance.

A memory should be able to answer:

```text
Where did this information come from?
```

Possible sources:

```text
user
conversation
repository
file
tool
agent
configuration
```

Example:

```text
Memory:
Novaris uses Typesense.

Source:
repository

Reference:
novaris/config/search.ts

Confidence:
0.96
```

Do not fabricate provenance.

If provenance is unknown, explicitly mark it as unknown.

---

# 7. Confidence

Persistent memories must have a confidence value.

Use evidence-based confidence.

Suggested interpretation:

```text
0.95 - 1.00 = highly reliable
0.80 - 0.94 = reliable
0.60 - 0.79 = probable
0.40 - 0.59 = uncertain
< 0.40       = weak
```

Do not treat LLM confidence as evidence.

Confidence must be based on the source and validation.

---

# 8. Tools

Implement the Memory Agent with these tools, adapting the exact implementation to the existing codebase.

## Core CRUD

```text
memory_search
memory_remember
memory_get
memory_list
memory_update
memory_forget
```

## Context retrieval

```text
memory_retrieve_context
```

This is a high-level operation.

It should receive the current task context and return the most relevant memories across the supported memory types.

It should not simply perform a raw vector search.

It should consider:

```text
task
project
repository
scope
keywords
semantic similarity
confidence
recency
memory type
relevance
```

---

## Experiences

```text
memory_record_episode
```

Used to record meaningful experiences after task execution.

---

## Decisions

```text
memory_record_decision
```

Used to preserve architectural and operational decisions.

---

## Procedures

```text
memory_get_procedure
memory_update_procedure
```

Used to retrieve and improve reusable procedures.

---

## Validation and learning

```text
memory_verify
memory_extract_facts
memory_consolidate
memory_find_stale
memory_archive_stale
```

These tools must not blindly mutate memory.

The Memory Agent must validate before changing persistent knowledge.

---

# 9. Tool responsibility boundaries

Do not give the Memory Agent unrestricted access to every Compagnon tool.

The Memory Agent should primarily operate on memory.

It may read source material when required for memory verification, but it should not become a general coding or DevOps agent.

Do not give it unnecessary permissions.

The intended architecture is:

```text
Main Agent
    ↓
Memory Agent
    ↓
Memory subsystem
```

not:

```text
Memory Agent
    ↓
all Compagnon tools
```

---

# 10. Memory retrieval behavior

When the Main Agent starts a meaningful task, it should be able to delegate:

```text
Retrieve relevant memory for this task.
```

The Memory Agent should:

1. identify the task context;
2. identify project/repository;
3. determine relevant scope;
4. search semantic memories;
5. search previous episodes;
6. search procedures;
7. search decisions;
8. rank the results;
9. remove duplicates;
10. detect relevant conflicts;
11. return a compact context package.

Example result:

```ts
{
  semantic: [...],
  episodes: [...],
  procedures: [...],
  decisions: [...],
  conflicts: [...],
  warnings: [...]
}
```

Do not return thousands of memories.

Return only the information useful for the current task.

---

# 11. Memory creation behavior

When the Main Agent delegates a candidate memory:

```text
remember this information
```

the Memory Agent must evaluate:

```text
Is it durable?
Is it useful in the future?
Is it project-specific?
Is it already known?
Does it conflict with existing knowledge?
Is the source trustworthy?
Should it replace an existing memory?
```

Then:

```text
create
update
reject
merge
or mark as conflict
```

Do not blindly create a new record.

---

# 12. Explicit user memory requests

If the user explicitly says:

```text
remember this
save this
keep this in memory
don't forget this
remember this project convention
```

the Memory Agent must treat the request as a strong persistence signal.

However, classify the memory correctly.

Do not put an architectural decision into generic semantic memory if it should be represented as a Decision Memory.

---

# 13. Duplicate detection

Before creating a persistent memory, search for semantically equivalent existing memories.

Example:

Existing:

```text
Novaris uses Typesense.
```

New:

```text
The Novaris search system is based on Typesense.
```

These should not create two independent memories.

Merge or update the existing memory.

Preserve useful provenance.

---

# 14. Conflict detection

Never silently overwrite contradictory knowledge.

Example:

Existing:

```text
Novaris uses Typesense.
```

New:

```text
Novaris uses OpenSearch.
```

The Memory Agent must detect the conflict.

Possible result:

```ts
{
  type: "conflict",
  existingMemory: "...",
  candidateMemory: "...",
  reason: "...",
  status: "pending"
}
```

Resolve conflicts using evidence.

Preferred authority:

```text
current verified project state
    >
explicit current user statement
    >
repository configuration
    >
authoritative documentation
    >
tool observation
    >
old memory
    >
agent inference
```

Do not use old memory as proof of current state.

---

# 15. Verification

The Memory Agent must support verification.

Example:

Stored memory:

```text
Novaris uses Typesense.
```

Current repository configuration:

```text
SEARCH_ENGINE=OPENSEARCH
```

The Memory Agent must be able to recognize that the stored memory is outdated.

It should update the lifecycle:

```text
old memory:
superseded

new memory:
active
```

Preserve historical information where appropriate.

---

# 16. Stale memory

Implement stale-memory detection.

A memory may become stale because:

* project configuration changed;
* repository changed;
* technology was migrated;
* a decision was superseded;
* the memory has not been verified for a long time;
* newer authoritative evidence contradicts it.

Do not automatically delete stale memories.

Prefer lifecycle states:

```text
active
stale
superseded
deprecated
archived
```

---

# 17. Episode consolidation

The Memory Agent should eventually recognize repeated experiences.

Example:

```text
Episode 1:
Docker unhealthy → inspect healthcheck → recover service

Episode 2:
Docker unhealthy → inspect healthcheck → recover service

Episode 3:
Docker unhealthy → inspect healthcheck → recover service
```

These may be consolidated into:

```text
Procedure:
Diagnose unhealthy Docker containers.
```

The original episodes should remain available when historically relevant.

Do not create procedures from one isolated unsuccessful attempt.

Prefer repeated successful patterns or strongly validated methods.

---

# 18. Procedure quality

A procedure must not simply be a summary of a conversation.

It should contain:

```text
name
purpose
prerequisites
steps
expected results
failure modes
success rate
confidence
source episodes
last updated
```

Procedures should improve when new evidence is available.

---

# 19. Memory extraction

`memory_extract_facts` should identify candidate durable information from a task or interaction.

It should classify candidates into:

```text
semantic
episode
procedure
decision
temporary
```

Reject:

```text
casual conversation
temporary observations
raw logs
duplicate facts
unverified assumptions
LLM speculation
secrets
```

Never persist:

```text
API keys
passwords
tokens
session cookies
private keys
credentials
```

Sensitive values must be redacted before persistence.

---

# 20. Forgetting

When the user explicitly asks:

```text
forget this
remove this memory
this is no longer true
```

the Memory Agent must invalidate the relevant memory.

Do not simply remove it from search results while keeping it active.

Use the appropriate lifecycle state:

```text
archived
superseded
deleted
```

depending on the existing persistence architecture.

---

# 21. Main Agent integration

Do not replace the Main Agent.

The Main Agent remains the orchestrator.

The relationship should be:

```text
User
 ↓
Main Agent
 ↓
"Do I need memory?"
 ↓
Memory Agent
 ↓
relevant context
 ↓
Main Agent
 ↓
task execution
 ↓
result
 ↓
Memory Agent
 ↓
learn / update / consolidate
```

The Memory Agent should never take over the Main Agent's general responsibilities.

---

# 22. Delegation contract

Create a clear structured contract between the Main Agent and Memory Agent.

Example:

```ts
type MemoryTask = {
  taskId: string

  operation:
    | "retrieve"
    | "remember"
    | "update"
    | "forget"
    | "record_episode"
    | "record_decision"
    | "get_procedure"
    | "verify"
    | "consolidate"

  objective: string

  scope?: {
    project?: string
    repository?: string
    task?: string
  }

  context?: unknown

  expectedOutput?: string
}
```

The Memory Agent should return:

```ts
type MemoryTaskResult = {
  taskId: string

  status:
    | "success"
    | "partial"
    | "failed"
    | "blocked"

  memories?: unknown[]
  conflicts?: unknown[]
  procedures?: unknown[]
  warnings?: string[]

  summary: string

  confidence: number
}
```

Adapt these interfaces to existing project conventions.

---

# 23. Memory Agent system prompt

Create a dedicated system prompt for the Memory Agent.

The prompt must establish:

```text
You are Compagnon's Memory Agent.

Your responsibility is persistent knowledge management.

You do not act as the general assistant.

You do not implement application features unless explicitly required for
memory infrastructure.

You do not perform unrelated DevOps, GitHub, research, or coding tasks.

Your job is to retrieve, validate, store, update, organize and protect
Compagnon's persistent knowledge.

Memory is not a transcript archive.

Do not store temporary conversational noise.

Do not fabricate memories.

Do not fabricate provenance.

Do not silently overwrite conflicting knowledge.

Prefer verified current state over stale historical memory.

Preserve important architectural decisions and their rationale.

Record meaningful experiences and outcomes.

Identify reusable procedures from repeated validated experiences.

Protect secrets and sensitive credentials from persistent storage.

When uncertain, return uncertainty instead of inventing certainty.

When a memory conflicts with current evidence, report the conflict and
prefer authoritative current evidence.

Keep retrieved context concise and relevant to the requesting agent.
```

The actual final prompt should be implemented in the project's existing prompt/agent architecture rather than duplicated in multiple locations.

---

# 24. Storage architecture

Before choosing a new database, inspect the existing persistence layer.

If the existing architecture already provides suitable storage, extend it rather than creating unnecessary infrastructure.

The persistent memory model should support at least:

```text
memories
memory sources / provenance
episodes
procedures
decisions
conflicts
memory lifecycle
confidence
timestamps
embeddings when required
```

Vector search should be treated as a retrieval mechanism.

Do not use embeddings as the complete memory model.

---

# 25. Do not over-engineer the first implementation

Implement the minimum production foundation first.

The first implementation must prioritize:

```text
Memory Agent
Semantic Memory
Episode Memory
Decision Memory
Procedure Memory foundation
Memory retrieval
Memory persistence
Provenance
Confidence
Conflict detection
Main Agent integration
```

Advanced consolidation, sophisticated decay algorithms, complex ranking models, and automated background jobs can be introduced after the foundation is stable.

Do not create unnecessary infrastructure just to satisfy this prompt.

---

# 26. Tests

Add tests for the Memory Agent.

At minimum:

```text
explicit memory request → stored

temporary conversation → not stored

duplicate memory → merged

contradictory memory → conflict detected

verified new state → old memory superseded

forget request → memory invalidated

secret detected → not persisted

relevant task → relevant memory retrieved

irrelevant task → irrelevant memory excluded

successful repeated experiences → procedure candidate
```

Use the repository's existing test framework.

Do not introduce another testing framework unless necessary.

---

# 27. Observability

Add basic observability around memory operations.

Useful events:

```text
memory.retrieved
memory.created
memory.updated
memory.deleted
memory.archived
memory.conflict.detected
memory.verification.completed
memory.consolidated
memory.extraction.rejected
```

Do not log secret values.

Use the existing project logging infrastructure if available.

Do not introduce a new observability stack unless required.

---

# 28. Definition of done

The Memory Agent is complete when the following workflow works:

```text
User:
"Remember that Novaris uses Typesense."

Main Agent
    ↓
Memory Agent
    ↓
Decision:
persistent semantic memory
    ↓
stored with provenance and confidence
```

Later:

```text
User:
"Implement search in Novaris."

Main Agent
    ↓
Memory Agent
    ↓
retrieves:
Novaris → Typesense
    ↓
Main Agent
    ↓
implementation
```

Later:

```text
Repository:
OpenSearch is now configured.
```

The Memory Agent:

```text
detects conflict
    ↓
verifies current state
    ↓
marks old memory superseded
    ↓
stores new state
```

Then:

```text
User:
"What search engine are we using?"
```

The Main Agent retrieves the current memory rather than blindly repeating the historical Typesense information.

---

# 29. Important implementation constraint

Do not implement the Planner Agent, Coding Agent, DevOps Agent, GitHub Agent, Research Agent, Security Agent, or Verification Agent as part of this task.

Only create the infrastructure necessary for the Memory Agent and its integration with the existing Main Agent.

The architecture must however remain extensible so that future specialists can be added without redesigning the Memory Agent.

---

# 30. Final deliverables

When implementation is complete, provide:

1. The files created.
2. The files modified.
3. The Memory Agent architecture.
4. The tools implemented.
5. The storage model.
6. The Main Agent ↔ Memory Agent delegation flow.
7. The tests added.
8. Any migration or environment-variable requirements.
9. Any limitations that remain.
10. A concise example showing the Memory Agent working end-to-end.

Do not claim completion until the implementation has been inspected and the relevant tests have been executed.
