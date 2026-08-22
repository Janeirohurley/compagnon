import type { GitHubParameters, GitHubAgentResult } from "../domain/types";

/**
 * Build MCP tool call parameters for repo analysis.
 *
 * Analysis is done by gathering multiple data points:
 * - File tree (get_file_contents at root)
 * - Branches (list_branches)
 * - Recent commits (list_commits)
 * - Open issues (list_issues)
 *
 * This function returns the first call to make; the orchestrator
 * chains the remaining calls.
 */
export function buildAnalysisCalls(
  repository: string,
  _params?: GitHubParameters,
): Array<{ tool: string; args: Record<string, unknown> }> {
  const [owner, repo] = repository.split("/");

  return [
    {
      tool: "get_file_contents",
      args: { owner, repo, path: "." },
    },
    {
      tool: "list_branches",
      args: { owner, repo, per_page: 10 },
    },
    {
      tool: "list_commits",
      args: { owner, repo, per_page: 5 },
    },
    {
      tool: "list_issues",
      args: { owner, repo, state: "open", per_page: 10 },
    },
  ];
}

/**
 * Format analysis results into a structured overview.
 */
export function formatAnalysisResult(
  files: unknown,
  branches: unknown,
  commits: unknown,
  issues: unknown,
): GitHubAgentResult {
  const branchList = branches as unknown[];
  const commitList = commits as unknown[];
  const issueList = issues as unknown[];

  const summary = [
    `Repository analysis:`,
    `- ${branchList.length} branch(es)`,
    `- ${commitList.length} recent commit(s)`,
    `- ${issueList.length} open issue(s)`,
  ].join("\n");

  return {
    status: "success",
    operation: "repo_analysis",
    result: {
      files,
      branches: branchList,
      commits: commitList,
      issues: issueList,
    },
    summary,
    memoryRecommendations: [
      "Store repository analysis snapshot for trend tracking.",
    ],
    suggestions: [
      "Compare with previous analysis to detect changes.",
      "Review open issues for priority.",
    ],
  };
}
