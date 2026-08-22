import type { PlaneOperation, PlaneStatus } from "./enums";

/**
 * Input contract for delegating a task to the Plane Agent.
 */
export interface PlaneTaskInput {
  operation: PlaneOperation;
  project?: string;
  projectId?: string;
  parameters?: Record<string, unknown>;
  context?: string;
}

/**
 * Output contract from the Plane Agent.
 */
export interface PlaneTaskResult {
  status: PlaneStatus;
  operation: PlaneOperation;
  result?: unknown;
  summary: string;
  errors?: string[];
  suggestions?: string[];
}
