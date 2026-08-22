
/**
 * This module provides services for building and finalizing execution plans
 * based on a given objective, context, and constraints. It ensures that the
 * generated plans are structurally valid and adhere to specified requirements.
 *
 * The services in this module are deterministic, focusing on structural
 * consistency and validation. The Planner Agent will later use LLM reasoning
 * to enrich or refine the plan.
 *
 * @module planning-service
 */
import {
    TaskType,
    Complexity,
    TaskStatus,
  } from "../domain/enums";
  import type {
    AcceptanceCriterion,
    ExecutionPlan,
    PlanAssumption,
    PlanConstraint,
    PlanRisk,
    PlanTask,
  } from "../domain/types";
  import type {
    PlannerTaskInput,
    PlannerTaskResult,
  } from "../domain/contracts";
  
  import {
    decomposeObjective,
  } from "./decomposition-service";
  
  import {
    deriveDependencies,
    analyzeDependencies,
  } from "./dependency-service";
  
  import {
    estimateTaskComplexity,
  } from "./complexity-service";
  
  import {
    validatePlan,
  } from "./validation-service";
  /**   * Generates a unique identifier for a given prefix.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  function createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
 /**   * Normalizes a list of constraints by trimming whitespace and
   * filtering out empty strings.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */ 
  function normalizeConstraints(
    constraints: string[] | undefined,
  ): PlanConstraint[] {
    return (constraints ?? [])
      .map((constraint) => constraint.trim())
      .filter(Boolean)
      .map((description) => ({
        id: createId("constraint"),
        description,
      }));
  }
  /**
   * Creates a list of default assumptions based on the provided input.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  function createDefaultAssumptions(
    input: PlannerTaskInput,
  ): PlanAssumption[] {
    const assumptions: PlanAssumption[] = [];
  
    if (!input.context?.trim()) {
      assumptions.push({
        id: createId("assumption"),
        description:
          "The current project context must be inspected before implementation-specific decisions are made.",
        confidence: 0.85,
      });
    }
  
    return assumptions;
  }
  /**
   * Creates a list of global acceptance criteria for the execution plan.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  function createGlobalAcceptanceCriteria(): AcceptanceCriterion[] {
    return [
      {
        id: createId("acceptance"),
        description:
          "The final implementation satisfies the original objective.",
      },
      {
        id: createId("acceptance"),
        description:
          "All applicable project constraints are respected.",
      },
      {
        id: createId("acceptance"),
        description:
          "Relevant validation and testing requirements pass.",
      },
    ];
  }
  /**
   * Creates a list of global risks based on the provided tasks.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  function createGlobalRisks(
    tasks: PlanTask[],
  ): PlanRisk[] {
    const analysisTask = tasks.find(
      (task) => task.type === TaskType.ANALYSIS,
    );
  
    return [
      {
        id: createId("risk"),
        taskId: analysisTask?.id,
        description:
          "Insufficient understanding of the existing system may lead to incorrect implementation decisions.",
        likelihood: "medium",
        impact: "high",
        mitigation:
          "Inspect the current repository, architecture, configuration, and relevant dependencies before implementation.",
      },
    ];
  }
  /**
   * Applies complexity estimates to a list of tasks.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  function applyComplexityEstimates(
    tasks: PlanTask[],
  ): PlanTask[] {
    return tasks.map((task) => {
      const assessment = estimateTaskComplexity(task);
  
      return {
        ...task,
        complexity: assessment.complexity,
      };
    });
  }

  /**
   * Builds a summary of the execution plan, including the number of tasks
   * and their types.
   */
  
  function buildSummary(
    objective: string,
    tasks: PlanTask[],
  ): string {
    const counts = new Map<TaskType, number>();
  
    for (const task of tasks) {
      counts.set(
        task.type,
        (counts.get(task.type) ?? 0) + 1,
      );
    }
  
    const taskSummary = [...counts.entries()]
      .map(([type, count]) => `${count} ${type}`)
      .join(", ");
  
    return `Plan for "${objective}" containing ${tasks.length} tasks (${taskSummary}).`;
  }
  
  /**
   * Builds a structurally valid execution plan from an objective.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  export function buildExecutionPlan(
    input: PlannerTaskInput,
  ): PlannerTaskResult {
    console.error("[PLANNER_TRACE] planning-service.buildExecutionPlan");
    const objective = input.objective.trim();
  
    if (!objective) {
      return {
        status: "invalid",
        blockers: [
          "Planner objective cannot be empty.",
        ],
        confidence: 1,
      };
    }
  
    let tasks = decomposeObjective({
      objective,
      context: input.context,
      constraints: input.constraints,
    });
  
    tasks = applyComplexityEstimates(tasks);
  
    const dependencies = deriveDependencies(tasks);
  
    const dependencyAnalysis = analyzeDependencies(
      tasks,
      dependencies,
    );
  
    if (dependencyAnalysis.errors.length > 0) {
      return {
        status: "invalid",
        blockers: dependencyAnalysis.errors,
        confidence: 1,
      };
    }
  
    const plan: ExecutionPlan = {
      id: createId("plan"),
  
      objective,
  
      context: input.context?.trim() || undefined,
  
      constraints: normalizeConstraints(
        input.constraints,
      ),
  
      assumptions: createDefaultAssumptions(input),
  
      tasks,
  
      dependencies,
  
      executionOrder:
        dependencyAnalysis.executionOrder,
  
      risks: createGlobalRisks(tasks),
  
      acceptanceCriteria:
        createGlobalAcceptanceCriteria(),
  
      summary: buildSummary(
        objective,
        tasks,
      ),
  
      metadata: {
        plannerVersion: "1.0.0",
        createdBy: "planning-service",
      },
  
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  
    const validation = validatePlan(plan);
  
    if (!validation.valid) {
      return {
        status: "invalid",
        blockers: validation.errors,
        warnings: validation.warnings,
        confidence: 1,
      };
    }
  
    return {
      status: "ready",
      plan,
      warnings: validation.warnings,
      confidence: 0.9,
    };
  }
/**
 * Materializes a list of task drafts into actual task objects.
 * @param drafts - The list of task drafts to materialize.
 * @returns The list of materialized tasks.
 */
  interface PlanTaskDraft {
    title: string;
    description: string;
    type: TaskType;
    priority: PlanTask["priority"];
    resources: string[];
    expectedOutputs: string[];
    acceptanceCriteria: string[];
    suggestedAgent?: string;
    risks: string[];
  }
  /**
   * Materializes a list of task drafts into actual task objects.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
  function materializeTaskDrafts(
    drafts: PlanTaskDraft[],
  ): PlanTask[] {
    return drafts.map((draft) => ({
      id: createId("task"),
  
      title: draft.title,
      description: draft.description,
  
      type: draft.type,
  
      status: TaskStatus.PENDING,
      priority: draft.priority,
      complexity: Complexity.MEDIUM,
  
      dependencies: [],
  
      resources: draft.resources,
  
      expectedOutputs: draft.expectedOutputs,
  
      acceptanceCriteria: draft.acceptanceCriteria,
  
      suggestedAgent: draft.suggestedAgent,
  
      risks: draft.risks,
    }));
  }

/**
   * Finalizes an execution plan by validating the proposed tasks and
   * ensuring that the plan is structurally sound.
   *
   * This service is deterministic. The Planner Agent will later use
   * LLM reasoning to enrich or refine the plan, while this service
   * remains responsible for structural consistency and validation.
   */
export function finalizeExecutionPlan(
  input: PlannerTaskInput,
  proposedTasks: PlanTaskDraft[],
): PlannerTaskResult {
  console.error("[PLANNER_TRACE] planning-service.finalizeExecutionPlan");
  const objective = input.objective.trim();

  if (!objective) {
    return {
      status: "invalid",
      blockers: ["Planner objective cannot be empty."],
      confidence: 1,
    };
  }

  if (proposedTasks.length === 0) {
    return {
      status: "invalid",
      blockers: ["Planner proposed no tasks."],
      confidence: 1,
    };
  }

  let tasks = materializeTaskDrafts(proposedTasks);

  tasks = applyComplexityEstimates(tasks);

  const dependencies = deriveDependencies(tasks);

  const dependencyAnalysis = analyzeDependencies(
    tasks,
    dependencies,
  );

  if (dependencyAnalysis.errors.length > 0) {
    return {
      status: "invalid",
      blockers: dependencyAnalysis.errors,
      confidence: 1,
    };
  }

  const plan: ExecutionPlan = {
    id: createId("plan"),

    objective,

    context: input.context?.trim() || undefined,

    constraints: normalizeConstraints(
      input.constraints,
    ),

    assumptions: createDefaultAssumptions(input),

    tasks,

    dependencies,

    executionOrder:
      dependencyAnalysis.executionOrder,

    risks: createGlobalRisks(tasks),

    acceptanceCriteria:
      createGlobalAcceptanceCriteria(),

    summary: buildSummary(
      objective,
      tasks,
    ),

    metadata: {
      plannerVersion: "1.0.0",
      createdBy: "planning-service",
    },

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validation = validatePlan(plan);

  if (!validation.valid) {
    return {
      status: "invalid",
      blockers: validation.errors,
      warnings: validation.warnings,
      confidence: 1,
    };
  }

  return {
    status: "ready",
    plan,
    warnings: validation.warnings,
    confidence: 0.9,
  };
}