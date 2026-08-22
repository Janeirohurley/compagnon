# Planner Agent — Architectural Implementation Specification

You are implementing the Planner Agent for Compagnon.

The Planner Agent is a specialized Mastra subagent responsible for analyzing complex objectives, decomposing them into executable tasks, identifying dependencies, determining execution order, identifying risks and defining acceptance criteria.

The Planner Agent is NOT the main orchestrator.
The Planner Agent is NOT a developer.
The Planner Agent is NOT responsible for executing implementation tasks.

Its responsibility is to transform an objective into a structured, coherent and executable plan that can be consumed by the Companion Agent and delegated to specialized agents.

============================================================
1. ARCHITECTURAL PRINCIPLE
============================================================

Implement the Planner Agent as a self-contained vertical module.

Everything specifically belonging to the Planner Agent must live inside:

src/mastra/agents/planner/

Do not scatter Planner-specific code across:

src/mastra/tools/
src/mastra/services/
src/mastra/planner/
src/mastra/tests/

The Planner Agent must be independently understandable, testable and removable.

The module must have a clear public API through:

src/mastra/agents/planner/index.ts

Internal implementation details must not leak outside the module.

Follow the same modular architecture established for the Memory Agent.

============================================================
2. TARGET STRUCTURE
============================================================

Create or refactor the Planner Agent toward:

src/mastra/agents/planner/

├── agent.ts
├── instructions.ts
├── config.ts
├── index.ts
│
├── tools/
│   ├── analyze-task.ts
│   ├── decompose-task.ts
│   ├── identify-dependencies.ts
│   ├── estimate-complexity.ts
│   └── index.ts
│
├── domain/
│   ├── plan.ts
│   ├── task.ts
│   ├── dependency.ts
│   ├── risk.ts
│   ├── schemas.ts
│   ├── enums.ts
│   └── contracts.ts
│
├── services/
│   ├── planning-service.ts
│   ├── decomposition-service.ts
│   ├── dependency-service.ts
│   ├── complexity-service.ts
│   └── validation-service.ts
│
├── observability/
│   ├── logger.ts
│   └── metrics.ts
│
├── tests/
│   ├── agent.test.ts
│   ├── planning.test.ts
│   ├── decomposition.test.ts
│   ├── dependencies.test.ts
│   ├── validation.test.ts
│   └── tools.test.ts
│
└── README.md

Do not create every directory or file automatically if it has no real responsibility.

The structure is a design guideline, not a requirement to create empty abstractions.

============================================================
3. MAStra INTEGRATION
============================================================

Use Mastra's native Agent and Subagent mechanisms.

Do not implement a custom agent orchestration framework.

The Planner must be instantiated as a Mastra Agent and exposed to the Companion Agent as a subagent.

The Companion Agent should be able to delegate planning work to the Planner Agent through Mastra's native agent delegation mechanisms.

Do not duplicate Mastra's delegation functionality.

Use Mastra features for:

- agent registration
- subagent invocation
- context handling
- request context where appropriate
- delegation hooks where appropriate
- memory integration where appropriate
- structured output where appropriate

The Planner Agent must remain a specialized agent inside the Mastra architecture.

============================================================
4. ROLE OF THE PLANNER AGENT
============================================================

The Planner Agent has one primary responsibility:

Transform a user or system objective into a structured execution plan.

It must be capable of:

- understanding the objective
- identifying the actual goal
- detecting ambiguity
- identifying assumptions
- decomposing the objective
- identifying dependencies
- determining execution order
- identifying parallelizable work
- identifying blockers
- estimating complexity
- identifying risks
- defining acceptance criteria
- identifying which specialized agent should handle each task
- determining what information is missing
- identifying tasks requiring research before implementation
- identifying tasks requiring verification
- producing a machine-readable execution plan

The Planner must optimize for executable plans, not elegant prose.

============================================================
5. WHAT THE PLANNER MUST NOT DO
============================================================

The Planner Agent must NOT:

- modify project files
- write application code
- execute shell commands
- commit Git changes
- create GitHub issues
- directly manipulate Plane
- directly deploy applications
- perform infrastructure changes
- perform arbitrary web research unless explicitly delegated for planning research
- pretend that an implementation has been completed
- execute tasks assigned to Developer Agent
- replace the Companion Agent as orchestrator

The Planner creates the plan.

Other agents execute the plan.

============================================================
6. PLANNING PIPELINE
============================================================

Every planning request should conceptually follow:

INPUT
  ↓
OBJECTIVE UNDERSTANDING
  ↓
CONTEXT ANALYSIS
  ↓
AMBIGUITY DETECTION
  ↓
ASSUMPTIONS
  ↓
TASK DECOMPOSITION
  ↓
DEPENDENCY ANALYSIS
  ↓
EXECUTION ORDER
  ↓
PARALLELIZATION ANALYSIS
  ↓
COMPLEXITY ESTIMATION
  ↓
RISK ANALYSIS
  ↓
AGENT ASSIGNMENT
  ↓
ACCEPTANCE CRITERIA
  ↓
PLAN VALIDATION
  ↓
STRUCTURED OUTPUT

The implementation should enforce this conceptual pipeline without unnecessarily creating a rigid workflow if Mastra's Agent capabilities are sufficient.

============================================================
7. DOMAIN MODEL
============================================================

Define strongly typed domain models.

At minimum:

ExecutionPlan

PlanTask

PlanDependency

PlanRisk

PlanAssumption

PlanConstraint

AcceptanceCriterion

PlanMetadata

Example:

interface ExecutionPlan {
  id: string;
  objective: string;
  summary: string;

  assumptions: PlanAssumption[];

  constraints: PlanConstraint[];

  tasks: PlanTask[];

  dependencies: PlanDependency[];

  risks: PlanRisk[];

  acceptanceCriteria: AcceptanceCriterion[];

  metadata: PlanMetadata;
}

A task should contain enough information for another agent to execute it without reconstructing the Planner's reasoning.

Example:

interface PlanTask {
  id: string;
  title: string;
  description: string;

  type:
    | "research"
    | "analysis"
    | "implementation"
    | "configuration"
    | "migration"
    | "testing"
    | "verification"
    | "documentation";

  priority:
    | "low"
    | "medium"
    | "high"
    | "critical";

  dependencies: string[];

  suggestedAgent?: string;

  inputs?: string[];

  expectedOutputs?: string[];

  acceptanceCriteria?: string[];

  complexity:
    | "trivial"
    | "low"
    | "medium"
    | "high"
    | "very-high";

  risks?: string[];
}

Use Zod or the project's existing schema validation approach for runtime validation.

Do not rely solely on TypeScript interfaces for data received from an LLM.

============================================================
8. PLAN VALIDATION
============================================================

The Planner must validate the generated plan before returning it.

At minimum verify:

- every task has a unique ID
- every dependency references an existing task
- no dependency references itself
- dependency cycles are detected
- execution order is coherent
- required inputs are identified
- expected outputs are defined
- acceptance criteria exist for implementation tasks
- assigned agents are valid when agent assignment is provided
- critical blockers are identified
- assumptions are explicit
- unresolved ambiguity is not silently converted into facts

If the plan cannot be safely constructed, return a blocked or clarification-required result instead of inventing information.

============================================================
9. DEPENDENCY ANALYSIS
============================================================

The Planner must distinguish:

Sequential dependencies:

A → B

Parallel tasks:

A ─┐
   ├→ D
B ─┘

Blocking dependencies:

A → B

where B cannot begin until A succeeds.

Soft dependencies:

A → B

where B can technically start but would benefit from A.

Represent dependency type explicitly.

The Planner must identify opportunities for parallel execution.

However, do not recommend parallel execution when tasks modify the same resources or have hidden dependencies.

============================================================
10. TASK GRANULARITY
============================================================

Do not create excessively large tasks.

Bad:

"Implement authentication."

Better:

1. Analyze existing authentication architecture.
2. Define authentication data model.
3. Implement backend authentication endpoints.
4. Implement frontend authentication state.
5. Add authorization middleware.
6. Add integration tests.
7. Verify authentication flows.

But also avoid microscopic decomposition.

Bad:

1. Open file.
2. Read file.
3. Change line 42.
4. Save file.

Tasks must represent meaningful units of work.

The goal is executable granularity.

============================================================
11. AGENT ASSIGNMENT
============================================================

The Planner may recommend specialized agents.

For example:

research → Research Agent

implementation → Developer Agent

verification → Verification Agent

memory-related task → Memory Agent

infrastructure → DevOps Agent

GitHub operations → GitHub Agent

documentation → Documentation Agent

However, the Planner does not execute delegation itself.

It only produces:

suggestedAgent

The Companion Agent remains responsible for deciding whether and how to delegate.

============================================================
12. CONTEXT AND MEMORY
============================================================

The Planner may use the Memory Agent when historical context materially affects the plan.

Examples:

- previous architectural decisions
- existing technology choices
- known project constraints
- previous failed approaches
- established procedures
- previous implementation history

Do not query memory indiscriminately.

Memory retrieval should be intentional and related to the planning objective.

For example:

User asks:

"Add search to Novaris."

The Planner may need historical information about:

- current search engine
- existing indexing architecture
- previous decisions
- known constraints

The Planner should not retrieve unrelated memories.

============================================================
13. UNCERTAINTY
============================================================

The Planner must distinguish:

Known facts

Assumptions

Unknowns

Risks

Open questions

Do not convert assumptions into facts.

Example:

Bad:

"Novaris uses PostgreSQL."

when this has not been established.

Better:

"Database technology is not confirmed. Verify the current persistence layer before implementation."

Plans must make uncertainty visible.

============================================================
14. PLAN QUALITY
============================================================

A good plan must be:

- coherent
- executable
- ordered
- dependency-aware
- testable
- reversible where possible
- explicit about assumptions
- explicit about risks
- appropriate in granularity
- compatible with the existing architecture
- understandable by another agent

A plan is not considered valid merely because it contains many tasks.

Quality is measured by whether another agent can execute it without having to reconstruct the original reasoning.

============================================================
15. STRUCTURED OUTPUT
============================================================

Prefer structured output over free-form prose.

The final Planner result should contain:

{
  "status": "ready",
  "plan": {
    "objective": "...",
    "summary": "...",
    "assumptions": [],
    "constraints": [],
    "tasks": [],
    "dependencies": [],
    "risks": [],
    "acceptanceCriteria": []
  }
}

Possible statuses:

"ready"

"needs_clarification"

"blocked"

"invalid"

When clarification is required, clearly identify:

- what is missing
- why it matters
- what decision is required

Do not ask unnecessary questions.

============================================================
16. PLANNER TO COMPANION CONTRACT
============================================================

The Planner Agent must expose a stable contract to the Companion Agent.

Example:

PlannerTaskInput:

{
  objective: string;
  context?: unknown;
  constraints?: string[];
  desiredOutcome?: string;
}

PlannerTaskResult:

{
  status:
    | "ready"
    | "needs_clarification"
    | "blocked"
    | "invalid";

  plan?: ExecutionPlan;

  questions?: string[];

  blockers?: string[];

  confidence?: number;
}

The Companion Agent should not depend on Planner internals.

It should only depend on the public contract.

============================================================
17. TOOL DESIGN
============================================================

Planner tools must remain focused.

Recommended tools:

analyze-task

Purpose:
Analyze an objective and identify its scope, constraints and unknowns.

decompose-task

Purpose:
Transform a complex objective into meaningful tasks.

identify-dependencies

Purpose:
Analyze relationships and ordering between tasks.

estimate-complexity

Purpose:
Estimate relative implementation complexity.

Do not create tools merely to move ordinary TypeScript functions into separate files.

A tool should exist when it represents a meaningful capability exposed to the agent.

============================================================
18. SERVICE LAYER
============================================================

Services contain deterministic planning logic.

Examples:

planning-service.ts

Coordinates planning operations.

decomposition-service.ts

Handles task decomposition logic.

dependency-service.ts

Builds and validates dependency graphs.

complexity-service.ts

Provides consistent complexity estimation.

validation-service.ts

Validates the resulting plan.

Do not put all logic into agent.ts.

agent.ts should configure the Mastra Agent and connect it to its capabilities.

============================================================
19. OBSERVABILITY
============================================================

The Planner should provide enough observability to understand:

- planning request started
- planning completed
- planning failed
- planning blocked
- number of tasks generated
- dependency count
- detected risks
- clarification count
- planning duration

Do not log sensitive project data unnecessarily.

Use the existing Compagnon observability infrastructure when available.

Do not create a completely independent logging framework.

============================================================
20. ERROR HANDLING
============================================================

The Planner must fail explicitly.

Never return a plausible-looking plan when plan validation has failed.

Use structured errors for:

- invalid objective
- missing context
- dependency cycle
- invalid task reference
- unsupported agent assignment
- schema validation failure
- planning failure

Distinguish between:

recoverable uncertainty

and

actual planning failure.

============================================================
21. TESTING
============================================================

Tests must verify behavior, not merely file existence.

At minimum test:

1. Simple objective decomposition.

2. Complex objective decomposition.

3. Dependency detection.

4. Circular dependency detection.

5. Parallel task detection.

6. Missing information detection.

7. Risk identification.

8. Agent recommendation.

9. Acceptance criteria generation.

10. Invalid structured output rejection.

11. Plan schema validation.

12. Planner Agent invocation.

13. Companion → Planner delegation.

14. Planner → structured result.

Use deterministic tests for services.

Use appropriate integration tests for the Mastra Agent.

Do not make every test depend on an actual LLM call.

============================================================
22. PUBLIC API
============================================================

index.ts should expose only what other modules need.

For example:

export { plannerAgent } from "./agent";

export type {
  ExecutionPlan,
  PlanTask,
  PlannerTaskInput,
  PlannerTaskResult
} from "./domain/contracts";

Do not export internal services unless required.

============================================================
23. COMPANION INTEGRATION
============================================================

The Companion Agent should register the Planner as a Mastra subagent.

Conceptually:

Companion
    |
    | delegates planning task
    ↓
Planner Agent
    |
    | returns ExecutionPlan
    ↓
Companion
    |
    | evaluates plan
    ↓
specialized agents