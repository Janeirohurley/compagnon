import type { PlanDependency, PlanTask } from "../domain/types";
import { DependencyType } from "../domain/enums";

export interface DependencyAnalysisResult {
  executionOrder: string[][];
  errors: string[];
}

function buildTaskMap(tasks: PlanTask[]): Map<string, PlanTask> {
  return new Map(tasks.map((task) => [task.id, task]));
}

function validateDependencies(
  tasks: PlanTask[],
  dependencies: PlanDependency[],
): string[] {
  const errors: string[] = [];
  const taskMap = buildTaskMap(tasks);

  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      if (!taskMap.has(dependencyId)) {
        errors.push(
          `Task ${task.id} references unknown dependency: ${dependencyId}`,
        );
      }

      if (dependencyId === task.id) {
        errors.push(`Task cannot depend on itself: ${task.id}`);
      }
    }
  }

  for (const dependency of dependencies) {
    if (!taskMap.has(dependency.fromTaskId)) {
      errors.push(`Unknown source task: ${dependency.fromTaskId}`);
    }

    if (!taskMap.has(dependency.toTaskId)) {
      errors.push(`Unknown target task: ${dependency.toTaskId}`);
    }

    if (dependency.fromTaskId === dependency.toTaskId) {
      errors.push(`Task cannot depend on itself: ${dependency.fromTaskId}`);
    }
  }

  return [...new Set(errors)];
}

function buildDependencyGraph(tasks: PlanTask[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const task of tasks) {
    graph.set(task.id, new Set());
  }

  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      const dependents = graph.get(dependencyId);

      if (dependents) {
        dependents.add(task.id);
      }
    }
  }

  return graph;
}

function buildIndegree(tasks: PlanTask[]): Map<string, number> {
  const indegree = new Map<string, number>();

  for (const task of tasks) {
    indegree.set(task.id, task.dependencies.length);
  }

  return indegree;
}

/**
 * Performs dependency analysis using Kahn's topological sorting algorithm.
 *
 * Tasks with the same dependency depth can be returned in the same
 * execution batch and may therefore be candidates for parallel execution.
 */
export function analyzeDependencies(
  tasks: PlanTask[],
  dependencies: PlanDependency[] = [],
): DependencyAnalysisResult {
  console.error("[PLANNER_TRACE] dependency-service.analyzeDependencies");
  const errors = validateDependencies(tasks, dependencies);

  if (errors.length > 0) {
    return {
      executionOrder: [],
      errors,
    };
  }

  const graph = buildDependencyGraph(tasks);
  const indegree = buildIndegree(tasks);

  const executionOrder: string[][] = [];

  let ready = tasks
    .filter((task) => (indegree.get(task.id) ?? 0) === 0)
    .map((task) => task.id);

  let processedCount = 0;

  while (ready.length > 0) {
    const currentBatch = [...ready];

    executionOrder.push(currentBatch);

    ready = [];

    for (const taskId of currentBatch) {
      processedCount++;

      const dependents = graph.get(taskId);

      if (!dependents) {
        continue;
      }

      for (const dependentId of dependents) {
        const currentIndegree = indegree.get(dependentId);

        if (currentIndegree === undefined) {
          continue;
        }

        const nextIndegree = currentIndegree - 1;

        indegree.set(dependentId, nextIndegree);

        if (nextIndegree === 0) {
          ready.push(dependentId);
        }
      }
    }
  }

  if (processedCount !== tasks.length) {
    return {
      executionOrder: [],
      errors: ["Circular dependency detected in the plan."],
    };
  }

  return {
    executionOrder,
    errors: [],
  };
}

/**
 * Converts task-level dependency declarations into explicit
 * PlanDependency objects.
 */
export function deriveDependencies(tasks: PlanTask[]): PlanDependency[] {
  console.error("[PLANNER_TRACE] dependency-service.deriveDependencies");
  const dependencies: PlanDependency[] = [];

  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      dependencies.push({
        fromTaskId: dependencyId,
        toTaskId: task.id,
        type: DependencyType.REQUIRED,
        reason: `Task ${task.id} requires task ${dependencyId} to be completed first.`,
      });
    }
  }

  return dependencies;
}
