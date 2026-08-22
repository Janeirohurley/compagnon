import {
    Complexity,
    TaskPriority,
    TaskStatus,
    TaskType,
  } from "../domain/enums";
  import type { PlanTask } from "../domain/types";
  
  function createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  
  export interface DecompositionContext {
    objective: string;
    context?: string;
    constraints?: string[];
  }
  
  /**
   * Creates a deterministic baseline decomposition.
   *
   * This service deliberately does not use an LLM yet.
   * It provides a safe structural baseline that will later be enriched
   * by the Planner Agent.
   */
  export function decomposeObjective(
    input: DecompositionContext,
  ): PlanTask[] {
    console.error("[PLANNER_TRACE] decomposition-service.decomposeObjective");
    const objective = input.objective.trim();
  
    if (!objective) {
      throw new Error("Cannot decompose an empty objective.");
    }
  
    const analysisTaskId = createId("task");
    const implementationTaskId = createId("task");
    const testingTaskId = createId("task");
  
    const tasks: PlanTask[] = [
      {
        id: analysisTaskId,
        title: "Analyze the objective and current system",
        description:
          "Inspect the existing architecture, relevant components, constraints, and dependencies required to accomplish the objective.",
        type: TaskType.ANALYSIS,
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        complexity: Complexity.MEDIUM,
        dependencies: [],
        resources: [],
        expectedOutputs: [
          "Validated understanding of the objective",
          "Relevant architecture and implementation constraints",
          "Identified affected components",
        ],
        acceptanceCriteria: [
          "The existing system relevant to the objective is understood.",
          "Important constraints are documented.",
          "Affected components are identified.",
        ],
        estimatedEffort: 1,
        risks: [],
      },
  
      {
        id: implementationTaskId,
        title: "Implement the planned change",
        description:
          `Implement the required changes necessary to achieve the objective: ${objective}`,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        complexity: Complexity.HIGH,
        dependencies: [analysisTaskId],
        resources: [],
        expectedOutputs: [
          "Implemented functionality",
          "Updated project components",
        ],
        acceptanceCriteria: [
          "The implementation satisfies the defined objective.",
          "Existing functionality is not unnecessarily broken.",
        ],
        estimatedEffort: 3,
        risks: [],
      },
  
      {
        id: testingTaskId,
        title: "Test and verify the implementation",
        description:
          "Validate the implementation against the objective, constraints, and acceptance criteria.",
        type: TaskType.TESTING,
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        complexity: Complexity.MEDIUM,
        dependencies: [implementationTaskId],
        resources: [],
        expectedOutputs: [
          "Test results",
          "Verification of acceptance criteria",
        ],
        acceptanceCriteria: [
          "Relevant tests pass.",
          "The implementation satisfies the acceptance criteria.",
          "No critical regression is detected.",
        ],
        estimatedEffort: 1,
        risks: [],
      },
    ];
  
    return tasks;
  }