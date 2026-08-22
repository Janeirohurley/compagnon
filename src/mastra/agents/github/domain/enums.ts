/**
 * Operations supported by the GitHub Agent.
 */
export const GitHubOperation = {
  CREATE_ISSUE: "create_issue",
  UPDATE_ISSUE: "update_issue",
  LIST_ISSUES: "list_issues",
  GET_ISSUE: "get_issue",
  COMMENT_ISSUE: "comment_issue",
  LIST_PRS: "list_prs",
  GET_PR: "get_pr",
  CREATE_PR: "create_pr",
  MERGE_PR: "merge_pr",
  SEARCH_CODE: "search_code",
  GET_FILE: "get_file",
  LIST_BRANCHES: "list_branches",
  LIST_COMMITS: "list_commits",
  REPO_ANALYSIS: "repo_analysis",
} as const;

export type GitHubOperation =
  (typeof GitHubOperation)[keyof typeof GitHubOperation];

/**
 * GitHub issue states.
 */
export const IssueState = {
  OPEN: "open",
  CLOSED: "closed",
  ALL: "all",
} as const;

export type IssueState = (typeof IssueState)[keyof typeof IssueState];

/**
 * GitHub pull request states.
 */
export const PRState = {
  OPEN: "open",
  CLOSED: "closed",
  MERGED: "merged",
  ALL: "all",
} as const;

export type PRState = (typeof PRState)[keyof typeof PRState];

/**
 * Sort order for list operations.
 */
export const SortOrder = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/**
 * Status of a GitHub Agent operation result.
 */
export const GitHubStatus = {
  SUCCESS: "success",
  PARTIAL: "partial",
  FAILED: "failed",
  BLOCKED: "blocked",
  NEEDS_CLARIFICATION: "needs_clarification",
} as const;

export type GitHubStatus = (typeof GitHubStatus)[keyof typeof GitHubStatus];
