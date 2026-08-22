import {
    Complexity,
    TaskType,
  } from "../domain/enums";
  import type { PlanTask } from "../domain/types";
  
  const COMPLEXITY_ORDER: Complexity[] = [
    Complexity.TRIVIAL,
    Complexity.LOW,
    Complexity.MEDIUM,
    Complexity.HIGH,
    Complexity.VERY_HIGH,
  ];
  
  export interface ComplexityAssessment {
    complexity: Complexity;
    reasons: string[];
  }
  
  function raiseComplexity(
    current: Complexity,
    levels: number,
  ): Complexity {
    const index = COMPLEXITY_ORDER.indexOf(current);
    const nextIndex = Math.min(
      index + levels,
      COMPLEXITY_ORDER.length - 1,
    );
  
    return COMPLEXITY_ORDER[nextIndex];
  }
  
  /**
   * Provides a deterministic baseline complexity assessment.
   *
   * This is deliberately conservative. The Planner Agent may later
   * refine the result using semantic context.
   */
  export function estimateTaskComplexity(
    task: PlanTask,
  ): ComplexityAssessment {
    console.error("[PLANNER_TRACE] complexity-service.estimateTaskComplexity");
    let complexity = task.complexity;
    const reasons: string[] = [];
  
    if (task.dependencies.length >= 3) {
      complexity = raiseComplexity(complexity, 1);
      reasons.push(
        "The task has multiple dependencies.",
      );
    }
  
    if (task.resources.length >= 3) {
      complexity = raiseComplexity(complexity, 1);
      reasons.push(
        "The task requires multiple resources.",
      );
    }
  
    if (task.acceptanceCriteria.length >= 4) {
      complexity = raiseComplexity(complexity, 1);
      reasons.push(
        "The task has several acceptance criteria.",
      );
    }
  
    if (
      task.type === TaskType.MIGRATION ||
      task.type === TaskType.IMPLEMENTATION
    ) {
      complexity = raiseComplexity(complexity, 1);
      reasons.push(
        "The task modifies or introduces system behavior.",
      );
    }
  
    if (task.type === TaskType.VERIFICATION) {
      reasons.push(
        "Verification complexity depends on the scope of the implementation being validated.",
      );
    }
  
    return {
      complexity,
      reasons,
    };
  }