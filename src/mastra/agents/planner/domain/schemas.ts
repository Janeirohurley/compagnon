import { z } from "zod";
/** * This file defines the Zod schemas for the planning domain, including tasks, dependencies, risks, assumptions, constraints, acceptance criteria, and execution plans.
 * The schemas are used to validate the structure and content of planning-related data, ensuring that it adheres to the expected format and constraints.
 * The schemas also provide a basis for generating TypeScript types that can be used throughout the application for type safety and code completion.
 */
import {
  Complexity,
  DependencyType,
  PlanningStatus,
  RiskLevel,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "./enums";
/** * Represents the status of a planning result.
 * The status indicates whether the planner has successfully generated a plan, requires clarification, is blocked, is invalid, or is out of scope.
 */
export const taskStatusSchema = z.enum([
  TaskStatus.PENDING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.SKIPPED,
]);
/** * Represents the priority assigned to a plan task.
 * Each level indicates the urgency and importance of completing the task.
 */
export const taskPrioritySchema = z.enum([
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
  TaskPriority.CRITICAL,
]);
/** * Represents the nature of work represented by a plan task.
 * Each type indicates the kind of activity that needs to be performed to complete the task.
 */
export const taskTypeSchema = z.enum([
  TaskType.RESEARCH,
  TaskType.ANALYSIS,
  TaskType.IMPLEMENTATION,
  TaskType.CONFIGURATION,
  TaskType.MIGRATION,
  TaskType.TESTING,
  TaskType.VERIFICATION,
  TaskType.DOCUMENTATION,
]);
/** * Represents the relative complexity of a task.
 * Each level indicates the expected difficulty and effort required to complete the task.
 */
export const complexitySchema = z.enum([
  Complexity.TRIVIAL,
  Complexity.LOW,
  Complexity.MEDIUM,
  Complexity.HIGH,
  Complexity.VERY_HIGH,
]);
/** * Represents the severity levels used for planning risks.
 * Each level indicates the potential impact of a risk on the execution plan.
 */
export const riskLevelSchema = z.enum([
  RiskLevel.LOW,
  RiskLevel.MEDIUM,
  RiskLevel.HIGH,
]);
/** * Represents the type of dependency between two tasks in the execution plan.
 * Dependencies indicate that one task must be completed before another can begin, or that one task is preferred over another.
 * Each dependency has a type and a reason explaining why the dependency exists.
 */

export const dependencyTypeSchema = z.enum([
  DependencyType.REQUIRED,
  DependencyType.PREFERRED,
  DependencyType.BLOCKING,
]);
/** * Represents the status of a planning result.
 * The status indicates whether the planner has successfully generated a plan, requires clarification, is blocked, is invalid, or is out of scope.
 */
export const planningStatusSchema = z.enum([
  PlanningStatus.READY,
  PlanningStatus.NEEDS_CLARIFICATION,
  PlanningStatus.BLOCKED,
  PlanningStatus.INVALID,
  PlanningStatus.OUT_OF_SCOPE,
]);
/** * Represents a meaningful unit of work inside an execution plan.
 * Each task has a unique identifier, title, description, type, status, priority, complexity, and associated dependencies, resources, expected outputs, acceptance criteria, and risks.
 * Optional fields include a suggested agent and estimated effort for completing the task.
 */
export const planTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),

  type: taskTypeSchema,

  status: taskStatusSchema,
  priority: taskPrioritySchema,
  complexity: complexitySchema,

  dependencies: z.array(z.string().min(1)),

  resources: z.array(z.string().min(1)),

  expectedOutputs: z.array(z.string().min(1)),

  acceptanceCriteria: z.array(z.string().min(1)),

  suggestedAgent: z.string().min(1).optional(),

  estimatedEffort: z.number().positive().optional(),

  risks: z.array(z.string().min(1)),
}).strict();
/** * Represents an explicit relationship between two tasks in the execution plan.
 * Dependencies indicate that one task must be completed before another can begin, or that one task is preferred over another.
 * Each dependency has a type and a reason explaining why the dependency exists.
 */
export const planDependencySchema = z.object({
  fromTaskId: z.string().min(1),
  toTaskId: z.string().min(1),
  type: dependencyTypeSchema,
  reason: z.string().min(1),
}).strict();
/** * Represents a risk associated with a plan or a specific task.
 * Risks are potential events or conditions that may negatively impact the success of the plan.
 * Each risk has an associated likelihood and impact, as well as a mitigation strategy to reduce its effect.
 */
export const planRiskSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1).optional(),

  description: z.string().min(1),

  likelihood: riskLevelSchema,
  impact: riskLevelSchema,

  mitigation: z.string().min(1),
}).strict();


/** * Represents an assumption made during the planning process.
 * Assumptions are conditions that are believed to be true for the purpose of creating the execution plan.
 * They may affect the feasibility and success of the plan, and should be validated during execution.
 */
export const planAssumptionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),

  confidence: z.number().min(0).max(1),
}).strict();
/**
 * Represents a constraint that must be satisfied for the execution plan to be valid.
 * Constraints may include limitations on resources, time, budget, or other factors that affect the feasibility of the plan.
 */
export const planConstraintSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
}).strict();

/**
 * Represents an acceptance criterion for the execution plan.
 * This criterion defines the conditions that must be met for the plan to be considered successful.
 */
export const acceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
}).strict();
/**
 * Represents metadata about the execution plan, such as the version of the planner that generated it and the user who created it.
 * This information can be useful for tracking changes and understanding the context in which the plan was created.
 */
export const planMetadataSchema = z.object({
  plannerVersion: z.string().min(1).optional(),
  createdBy: z.string().min(1).optional(),
}).strict();

/**
 * Represents a complete execution plan generated by the planner.
 * The plan includes tasks, dependencies, risks, assumptions, constraints, and acceptance criteria.
 * It also provides a summary and metadata about the plan.
 */

export const executionPlanSchema = z.object({
  id: z.string().min(1),

  objective: z.string().min(1),

  context: z.string().optional(),

  constraints: z.array(planConstraintSchema),

  assumptions: z.array(planAssumptionSchema),
  tasks: z.array(planTaskSchema).min(1),

  dependencies: z.array(planDependencySchema),

  /*
   * Each inner array represents one executable batch.
   * Tasks inside the same batch may run in parallel
   * when their dependencies allow it.
   */
  executionOrder: z.array(
    z.array(z.string().min(1)).min(1),
  ),

  risks: z.array(planRiskSchema),

  acceptanceCriteria: z.array(acceptanceCriterionSchema),

  summary: z.string().min(1),

  metadata: planMetadataSchema.optional(),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
}).strict();

/**
 * Represents a question that the planner has about the objective or context.
 * The question may include an explanation of why it is being asked and examples to clarify the intent.
 */

export const planningQuestionSchema = z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    why: z.string().min(1).optional(),
    examples: z.array(z.string().min(1)).optional(),
  }).strict();

  /**
   * Represents a planning result that is ready to be executed.
   * This status indicates that the planner has successfully generated a valid plan for the given objective and context.
   * The result includes the complete execution plan, along with an optional summary, confidence level, and warnings.
   * No questions, blockers, or suggested agent will be provided in this case.
   */
  
  const readyPlanningResultSchema = z.object({
    status: z.literal(PlanningStatus.READY),
  
    plan: executionPlanSchema,
  
    summary: z.string().min(1).optional(),
  
    confidence: z.number().min(0).max(1).optional(),
  
    warnings: z.array(z.string().min(1)).optional(),
  
    questions: z.never().optional(),
    blockers: z.never().optional(),
    suggestedAgent: z.never().optional(),
  }).strict();

  /**
   * Represents a planning result that requires clarification before proceeding.
   * This status indicates that the planner cannot provide a valid plan for the given objective and context.
   * The result includes a list of questions that need to be answered, along with a summary and optional confidence level and warnings.
   * No plan, blockers, or suggested agent will be provided in this case.
   */
  
  const clarificationPlanningResultSchema = z.object({
    status: z.literal(PlanningStatus.NEEDS_CLARIFICATION),
  
    questions: z.array(planningQuestionSchema).min(1),
  
    summary: z.string().min(1),
  
    confidence: z.number().min(0).max(1).optional(),
  
    warnings: z.array(z.string().min(1)).optional(),
   
    plan: z.never().optional(),
    blockers: z.never().optional(),
    suggestedAgent: z.never().optional(),
  }).strict();
  /** 
   * Represents a planning result that is blocked due to unresolved issues or dependencies.
   * This status indicates that the planner cannot provide a valid plan for the given objective and context.
   * The result may include a summary, confidence level, warnings, and blockers to help the user understand the situation.
   * No plan, questions, or suggested agent will be provided in this case.
   */
  
  const blockedPlanningResultSchema = z.object({
    status: z.literal(PlanningStatus.BLOCKED),
  
    blockers: z.array(z.string().min(1)).min(1),
  
    summary: z.string().min(1),
  
    confidence: z.number().min(0).max(1).optional(),
  
    warnings: z.array(z.string().min(1)).optional(),
  
    plan: z.never().optional(),
    questions: z.never().optional(),
    suggestedAgent: z.never().optional(),
  }).strict();
  /**
   * Represents a planning result that is invalid due to conflicting constraints or other issues.
   * This status indicates that the planner cannot provide a valid plan for the given objective and context.
   * The result may include a summary, confidence level, warnings, and blockers to help the user understand the situation.
   * No plan, questions, or suggested agent will be provided in this case.
   */
  
  const invalidPlanningResultSchema = z.object({
    status: z.literal(PlanningStatus.INVALID),
  
    blockers: z.array(z.string().min(1)).min(1),
  
    summary: z.string().min(1),
  
    warnings: z.array(z.string().min(1)).optional(),
  
    confidence: z.number().min(0).max(1).optional(),
  
    plan: z.never().optional(),
    questions: z.never().optional(),
    suggestedAgent: z.never().optional(),
  }).strict();


  /**
   * Represents a planning result that is out of scope for the current planner.
   * This status indicates that the planner cannot provide a valid plan for the given objective and context.
   * The result may include a summary, suggested agent, confidence level, and warnings to help the user understand the situation.
   * No plan, questions, or blockers will be provided in this case.
   */
  
  const outOfScopePlanningResultSchema = z.object({
    status: z.literal(PlanningStatus.OUT_OF_SCOPE),
  
    summary: z.string().min(1),
  
    suggestedAgent: z.string().min(1).optional(),
  
    confidence: z.number().min(0).max(1).optional(),
  
    warnings: z.array(z.string().min(1)).optional(),
  
    plan: z.never().optional(),
    questions: z.never().optional(),
    blockers: z.never().optional(),
  }).strict();
  
  export const planningResultSchema = z.discriminatedUnion("status", [
    readyPlanningResultSchema,
    clarificationPlanningResultSchema,
    blockedPlanningResultSchema,
    invalidPlanningResultSchema,
    outOfScopePlanningResultSchema,
  ]);