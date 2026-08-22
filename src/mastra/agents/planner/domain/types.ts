import type {
    Complexity,
    DependencyType,
    RiskLevel,
    TaskPriority,
    TaskStatus,
    TaskType,
  } from "./enums";
  
  /**
   * A meaningful unit of work inside an execution plan.
   */
  export interface PlanTask {
    id: string;
    title: string;
    description: string;
  
    type: TaskType;
  
    status: TaskStatus;
    priority: TaskPriority;
    complexity: Complexity;
  
    dependencies: string[];
  
    resources: string[];
  
    expectedOutputs: string[];
  
    acceptanceCriteria: string[];
  
    suggestedAgent?: string;
  
    estimatedEffort?: number;
  
    risks: string[];
  }
  
  /**
   * Explicit relationship between two tasks.
   */
  export interface PlanDependency {
    fromTaskId: string;
    toTaskId: string;
    type: DependencyType;
    reason: string;
  }
  
  /**
   * Risk associated with a plan or a specific task.
   */
  export interface PlanRisk {
    id: string;
    taskId?: string;
  
    description: string;
  
    likelihood: RiskLevel;
    impact: RiskLevel;
  
    mitigation: string;
  }
  
  /**
   * Assumption made while constructing a plan.
   *
   * Assumptions must never be silently treated as verified facts.
   */
  export interface PlanAssumption {
    id: string;
    description: string;
    confidence: number;
  }
  
  /**
   * Constraint that the plan must respect.
   */
  export interface PlanConstraint {
    id: string;
    description: string;
  }
  
  /**
   * Criterion used to determine whether the planned objective
   * has been successfully completed.
   */
  export interface AcceptanceCriterion {
    id: string;
    description: string;
  }
  
  /**
   * Metadata describing how and when the plan was generated.
   */
  export interface PlanMetadata {
    plannerVersion?: string;
    createdBy?: string;
  }
  
  /**
   * Complete execution plan produced by the Planner Agent.
   */
  export interface ExecutionPlan {
    id: string;
  
    objective: string;
  
    context?: string;
  
    constraints: PlanConstraint[];
  
    assumptions: PlanAssumption[];
  
    tasks: PlanTask[];
  
    dependencies: PlanDependency[];
  
    executionOrder: string[][];
  
    risks: PlanRisk[];
  
    acceptanceCriteria: AcceptanceCriterion[];
  
    summary: string;
  
    metadata?: PlanMetadata;
  
    createdAt: string;
  
    updatedAt: string;
  }