import type { OutlineOperation, OutlineStatus } from "./enums";

/**
 * Input contract for delegating a task to the Outline Agent.
 */
export interface OutlineTaskInput {
  operation: OutlineOperation;
  parameters?: Record<string, unknown>;
  context?: string;
}

/**
 * Output contract from the Outline Agent.
 */
export interface OutlineTaskResult {
  status: OutlineStatus;
  operation: OutlineOperation;
  result?: unknown;
  summary: string;
  errors?: string[];
  suggestions?: string[];
}
