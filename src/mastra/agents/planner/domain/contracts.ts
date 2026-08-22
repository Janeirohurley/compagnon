import type { PlanningStatus } from "./enums";
import type { ExecutionPlan } from "./types";

export interface PlannerTaskInput {
  objective: string;
  context?: string;
  constraints?: string[];
}


export interface PlanningQuestion {
    question: string;
    why?: string;
    examples?: string[];
  }
  
export interface PlannerTaskResult {
    status: PlanningStatus;
  
    plan?: ExecutionPlan;
  
    questions?: PlanningQuestion[];
  
    blockers?: string[];
  
    warnings?: string[];
  
    confidence?: number;
  
    summary?: string;
  
    suggestedAgent?: string;
  }