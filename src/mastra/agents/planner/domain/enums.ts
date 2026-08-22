/**
 * Status of a task inside an execution plan.
 */
export const TaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type TaskStatus =
  (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Priority assigned to a plan task.
 */
export const TaskPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type TaskPriority =
  (typeof TaskPriority)[keyof typeof TaskPriority];

/**
 * Nature of work represented by a plan task.
 */
export const TaskType = {
  RESEARCH: "research",
  ANALYSIS: "analysis",
  IMPLEMENTATION: "implementation",
  CONFIGURATION: "configuration",
  MIGRATION: "migration",
  TESTING: "testing",
  VERIFICATION: "verification",
  DOCUMENTATION: "documentation",
} as const;

export type TaskType =
  (typeof TaskType)[keyof typeof TaskType];

/**
 * Relative complexity of a task.
 */
export const Complexity = {
  TRIVIAL: "trivial",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  VERY_HIGH: "very_high",
} as const;

export type Complexity =
  (typeof Complexity)[keyof typeof Complexity];

/**
 * Severity levels used for planning risks.
 */
export const RiskLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type RiskLevel =
  (typeof RiskLevel)[keyof typeof RiskLevel];

/**
 * Relationship between two plan tasks.
 */
export const DependencyType = {
  REQUIRED: "required",
  PREFERRED: "preferred",
  BLOCKING: "blocking",
} as const;

export type DependencyType =
  (typeof DependencyType)[keyof typeof DependencyType];

/**
 * Overall state of the planning operation.
 */
export const PlanningStatus = {
  READY: "ready",
  NEEDS_CLARIFICATION: "needs_clarification",
  BLOCKED: "blocked",
  INVALID: "invalid",
  OUT_OF_SCOPE: "out_of_scope",
} as const;

export type PlanningStatus =
  (typeof PlanningStatus)[keyof typeof PlanningStatus];