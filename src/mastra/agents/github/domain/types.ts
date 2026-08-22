import type { GitHubOperation, GitHubStatus, IssueState, PRState } from "./enums";

/**
 * Parameters for GitHub operations.
 */
export interface GitHubParameters {
  issueNumber?: number;
  title?: string;
  body?: string;
  state?: IssueState | PRState;
  labels?: string[];
  assignees?: string[];
  prNumber?: number;
  branch?: string;
  baseBranch?: string;
  filePath?: string;
  query?: string;
  page?: number;
  perPage?: number;
  sort?: string;
  direction?: "asc" | "desc";
}

/**
 * Input for the GitHub Agent.
 */
export interface GitHubAgentInput {
  operation: GitHubOperation;
  repository?: string; // "owner/repo"
  parameters: GitHubParameters;
  context?: string;
  memoryContext?: unknown;
}

/**
 * Result of a GitHub Agent operation.
 */
export interface GitHubAgentResult {
  status: GitHubStatus;
  operation: GitHubOperation;
  result?: unknown;
  summary: string;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
  memoryRecommendations?: string[];
}

/**
 * GitHub issue data.
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: string;
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

/**
 * GitHub pull request data.
 */
export interface GitHubPullRequest {
  number: number;
  title: string;
  body?: string;
  state: string;
  head: string;
  base: string;
  merged: boolean;
  createdAt: string;
  updatedAt: string;
  url: string;
}

/**
 * GitHub repository info.
 */
export interface GitHubRepoInfo {
  name: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  language?: string;
  stars: number;
  forks: number;
  openIssues: number;
  url: string;
}

/**
 * GitHub code search result.
 */
export interface GitHubCodeSearchResult {
  file: string;
  path: string;
  repository: string;
  url: string;
  textMatches?: string[];
}

/**
 * GitHub commit data.
 */
export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}
