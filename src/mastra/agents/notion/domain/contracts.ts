import type { NotionOperation, NotionStatus, NotionErrorCode } from "./enums";

/**
 * Input contract for delegating a task to the Notion Agent.
 */
export interface NotionTaskInput {
  operation: NotionOperation;
  parameters?: Record<string, unknown>;
  context?: string;
}

/**
 * Output contract from the Notion Agent.
 */
export interface NotionTaskResult {
  status: NotionStatus;
  operation: NotionOperation;
  result?: unknown;
  summary: string;
  errors?: { code: NotionErrorCode; message: string }[];
  warnings?: string[];
  suggestions?: string[];
}