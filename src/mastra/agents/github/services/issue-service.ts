import type { GitHubParameters, GitHubAgentResult } from "../domain/types";
import type { GitHubOperation } from "../domain/enums";

/**
 * Build the MCP tool call parameters for an issue operation.
 */
export function buildIssueParams(
  operation: GitHubOperation,
  repository: string,
  params: GitHubParameters,
): { tool: string; args: Record<string, unknown> } {
  const [owner, repo] = repository.split("/");

  switch (operation) {
    case "list_issues":
      return {
        tool: "list_issues",
        args: {
          owner,
          repo,
          state: params.state ?? "open",
          page: params.page ?? 1,
          per_page: params.perPage ?? 30,
          sort: params.sort,
          direction: params.direction,
          labels: params.labels?.join(","),
          assignee: params.assignees?.[0],
        },
      };

    case "get_issue":
      if (!params.issueNumber) {
        return { tool: "get_issue", args: { owner, repo, issue_number: -1 } };
      }
      return {
        tool: "get_issue",
        args: { owner, repo, issue_number: params.issueNumber },
      };

    case "create_issue":
      return {
        tool: "create_issue",
        args: {
          owner,
          repo,
          title: params.title ?? "Untitled Issue",
          body: params.body ?? "",
          labels: params.labels,
          assignees: params.assignees,
        },
      };

    case "update_issue":
      return {
        tool: "update_issue",
        args: {
          owner,
          repo,
          issue_number: params.issueNumber ?? 0,
          title: params.title,
          body: params.body,
          state: params.state,
          labels: params.labels,
          assignees: params.assignees,
        },
      };

    case "comment_issue":
      return {
        tool: "add_comment",
        args: {
          owner,
          repo,
          issue_number: params.issueNumber ?? 0,
          body: params.body ?? "",
        },
      };

    default:
      return { tool: "list_issues", args: { owner, repo } };
  }
}

/**
 * Validate issue operation parameters.
 */
export function validateIssueParams(
  operation: GitHubOperation,
  params: GitHubParameters,
): string[] {
  const errors: string[] = [];

  if (
    ["get_issue", "update_issue", "comment_issue"].includes(operation) &&
    !params.issueNumber
  ) {
    errors.push(`Operation "${operation}" requires an issueNumber.`);
  }

  if (operation === "create_issue" && !params.title) {
    errors.push('Operation "create_issue" requires a title.');
  }

  return errors;
}

/**
 * Format an issue result into a structured summary.
 */
export function formatIssueResult(
  operation: GitHubOperation,
  raw: unknown,
): GitHubAgentResult {
  const data = raw as Record<string, unknown>;

  switch (operation) {
    case "list_issues": {
      const issues = (data as unknown) as unknown[];
      return {
        status: "success",
        operation,
        result: issues,
        summary: `Listed ${issues.length} issue(s).`,
        suggestions: issues.length > 0 ? ["Review open issues for priority."] : [],
      };
    }

    case "get_issue": {
      const issue = data as Record<string, unknown>;
      return {
        status: "success",
        operation,
        result: issue,
        summary: `Issue #${issue.number}: "${issue.title}" (${issue.state})`,
        memoryRecommendations: [
          `Record issue #${issue.number} state and context.`,
        ],
      };
    }

    case "create_issue": {
      const issue = data as Record<string, unknown>;
      return {
        status: "success",
        operation,
        result: issue,
        summary: `Issue #${issue.number} created: "${issue.title}"`,
        memoryRecommendations: [
          `Record creation of issue #${issue.number} for project tracking.`,
        ],
        suggestions: ["Monitor issue for responses."],
      };
    }

    case "update_issue": {
      const issue = data as Record<string, unknown>;
      return {
        status: "success",
        operation,
        result: issue,
        summary: `Issue #${issue.number} updated.`,
        memoryRecommendations: ["Record issue update in project history."],
      };
    }

    case "comment_issue": {
      return {
        status: "success",
        operation,
        result: data,
        summary: "Comment added to issue.",
        memoryRecommendations: ["Record comment for conversation history."],
      };
    }

    default:
      return {
        status: "success",
        operation,
        result: data,
        summary: `Issue operation "${operation}" completed.`,
      };
  }
}
