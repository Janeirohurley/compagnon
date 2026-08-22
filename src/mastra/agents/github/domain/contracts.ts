import type { GitHubOperation, GitHubStatus } from "./enums";

/**
 * Input contract for delegating a task to the GitHub Agent.
 */
export interface GitHubTaskInput {
  operation: GitHubOperation;
  repository?: string;
  parameters: Record<string, unknown>;
  context?: string;
}

/**
 * Output contract from the GitHub Agent.
 */
export interface GitHubTaskResult {
  status: GitHubStatus;
  operation: GitHubOperation;
  result?: unknown;
  summary: string;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
}
