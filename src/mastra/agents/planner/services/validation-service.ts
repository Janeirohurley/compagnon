import type {
    ExecutionPlan,
  } from "../domain/types";
  import { analyzeDependencies } from "./dependency-service";
  
  export interface PlanValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
  }
  
  function validateUniqueIds(
    ids: string[],
    entityName: string,
  ): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
  
    for (const id of ids) {
      if (seen.has(id)) {
        duplicates.add(id);
      }
  
      seen.add(id);
    }
  
    return [...duplicates].map(
      (id) => `Duplicate ${entityName} id: ${id}`,
    );
  }
  
  function validateExecutionOrder(
    plan: ExecutionPlan,
    errors: string[],
  ): void {
    const taskIds = new Set(plan.tasks.map((task) => task.id));
    const orderedIds = plan.executionOrder.flat();
  
    for (const taskId of orderedIds) {
      if (!taskIds.has(taskId)) {
        errors.push(
          `Execution order references unknown task: ${taskId}`,
        );
      }
    }
  
    const duplicateErrors = validateUniqueIds(
      orderedIds,
      "execution-order task",
    );
  
    errors.push(...duplicateErrors);
  
    for (const task of plan.tasks) {
      if (!orderedIds.includes(task.id)) {
        errors.push(
          `Task ${task.id} is missing from execution order.`,
        );
      }
    }
  }
  
  function validateRisks(
    plan: ExecutionPlan,
    errors: string[],
  ): void {
    const taskIds = new Set(plan.tasks.map((task) => task.id));
  
    for (const risk of plan.risks) {
      if (
        risk.taskId &&
        !taskIds.has(risk.taskId)
      ) {
        errors.push(
          `Risk ${risk.id} references unknown task: ${risk.taskId}`,
        );
      }
    }
  }
  
  function validateExplicitDependencies(
    plan: ExecutionPlan,
    errors: string[],
  ): void {
    const taskIds = new Set(plan.tasks.map((task) => task.id));
  
    for (const dependency of plan.dependencies) {
      if (!taskIds.has(dependency.fromTaskId)) {
        errors.push(
          `Dependency ${dependency.fromTaskId} -> ${dependency.toTaskId} references an unknown source task.`,
        );
      }
  
      if (!taskIds.has(dependency.toTaskId)) {
        errors.push(
          `Dependency ${dependency.fromTaskId} -> ${dependency.toTaskId} references an unknown target task.`,
        );
      }
    }
  }
  
  function validateDependencyConsistency(
    plan: ExecutionPlan,
    errors: string[],
  ): void {
    const explicitDependencies = new Set(
      plan.dependencies.map(
        (dependency) =>
          `${dependency.fromTaskId}->${dependency.toTaskId}`,
      ),
    );
  
    for (const task of plan.tasks) {
      for (const dependencyId of task.dependencies) {
        const key = `${dependencyId}->${task.id}`;
  
        if (!explicitDependencies.has(key)) {
          errors.push(
            `Missing explicit dependency for ${dependencyId} -> ${task.id}.`,
          );
        }
      }
    }
  
    for (const dependency of plan.dependencies) {
      const targetTask = plan.tasks.find(
        (task) => task.id === dependency.toTaskId,
      );
  
      if (!targetTask) {
        continue;
      }
  
      if (
        !targetTask.dependencies.includes(
          dependency.fromTaskId,
        )
      ) {
        errors.push(
          `Dependency ${dependency.fromTaskId} -> ${dependency.toTaskId} is not declared on the target task.`,
        );
      }
    }
  }
  
  function validateAcceptanceCriteria(
    plan: ExecutionPlan,
    errors: string[],
    warnings: string[],
  ): void {
    for (const task of plan.tasks) {
      if (task.acceptanceCriteria.length === 0) {
        errors.push(
          `Task ${task.id} has no acceptance criteria.`,
        );
      }
    }
  
    if (plan.acceptanceCriteria.length === 0) {
      warnings.push(
        "The plan has no global acceptance criteria.",
      );
    }
  }
  
  function validateDependencyGraph(
    plan: ExecutionPlan,
    errors: string[],
  ): void {
    const result = analyzeDependencies(
      plan.tasks,
      plan.dependencies,
    );
  
    errors.push(...result.errors);
  
    if (errors.length > 0) {
      return;
    }
  
    const expectedOrder = result.executionOrder;
    const actualOrder = plan.executionOrder;
  
    if (
      JSON.stringify(expectedOrder) !==
      JSON.stringify(actualOrder)
    ) {
      errors.push(
        "Execution order does not match the dependency graph.",
      );
    }
  }
  
  function validateBasicPlan(
    plan: ExecutionPlan,
    errors: string[],
  ): void {
    if (!plan.id.trim()) {
      errors.push("Plan id cannot be empty.");
    }
  
    if (!plan.objective.trim()) {
      errors.push("Plan objective cannot be empty.");
    }
  
    if (plan.tasks.length === 0) {
      errors.push("Plan must contain at least one task.");
    }
  
    const duplicateTaskIds = validateUniqueIds(
      plan.tasks.map((task) => task.id),
      "task",
    );
  
    errors.push(...duplicateTaskIds);
  }
  
  export function validatePlan(
    plan: ExecutionPlan,
  ): PlanValidationResult {
    console.error("[PLANNER_TRACE] validation-service.validatePlan");
    const errors: string[] = [];
    const warnings: string[] = [];
  
    validateBasicPlan(plan, errors);
  
    if (errors.length === 0) {
      validateExplicitDependencies(plan, errors);
      validateDependencyConsistency(plan, errors);
      validateExecutionOrder(plan, errors);
      validateRisks(plan, errors);
      validateAcceptanceCriteria(
        plan,
        errors,
        warnings,
      );
  
      if (errors.length === 0) {
        validateDependencyGraph(plan, errors);
      }
    }
  
    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
    };
  }