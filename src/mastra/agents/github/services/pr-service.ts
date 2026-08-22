import type { GitHubParameters, GitHubAgentResult } from "../domain/types";
import type { GitHubOperation } from "../domain/enums";

/**
 * Build MCP tool call parameters for a PR operation.
 */
export function buildPRParams(
  operation: GitHubOperation,
  repository: string,
  params: GitHubParameters,
): { tool: string; args: Record<string, unknown> } {
  const [owner, repo] = repository.split("/");

  switch (operation) {
    case "list_prs":
      return {
        tool: "list_pull_requests",
        args: {
          owner,
          repo,
          state: params.state ?? "open",
          page: params.page ?? 1,
          per_page: params.perPage ?? 30,
          sort: params.sort,
          direction: params.direction,
        },
      };

    case "get_pr":
      return {
        tool: "get_pull_request",
        args: {
          owner,
          repo,
          pull_number: params.prNumber ?? 0,
        },
      };

    case "create_pr":
      return {
        tool: "create_pull_request",
        args: {
          owner,
          repo,
          title: params.title ?? "Untitled PR",
          body: params.body ?? "",
          head: params.branch ?? "",
          base: params.baseBranch ?? "main",
        },
      };

    case "merge_pr":
      return {
        tool: "merge_pull_request",
        args: {
          owner,
          repo,
          pull_number: params.prNumber ?? 0,
        },
      };

    default:
      return { tool: "list_pull_requests", args: { owner, repo } };
  }
}

/**
 * Validate PR operation parameters.
 */
export function validatePRParams(
  operation: GitHubOperation,
  params: GitHubParameters,
): string[] {
  const errors: string[] = [];

  if (["get_pr", "merge_pr"].includes(operation) && !params.prNumber) {
    errors.push(`Operation "${operation}" requires a prNumber.`);
  }

  if (operation === "create_pr") {
    if (!params.title) errors.push('Operation "create_pr" requires a title.');
    if (!params.branch) errors.push('Operation "create_pr" requires a branch (head).');
  }

  return errors;
}

/**
 * Format a PR result into a structured summary.
 */
export function formatPRResult(
  operation: GitHubOperation,
  raw: unknown,
): GitHubAgentResult {
  const data = raw as Record<string, unknown>;

  switch (operation) {
    case "list_prs": {
      const prs = (data as unknown) as unknown[];
      return {
        status: "success",
        operation,
        result: prs,
        summary: `Listed ${prs.length} pull request(s).`,
        suggestions: prs.length > 0 ? ["Review open PRs for review/merge."] : [],
      };
    }

    case "get_pr": {
      const pr = data as Record<string, unknown>;
      return {
        status: "success",
        operation,
        result: pr,
        summary: `PR #${pr.number}: "${pr.title}" (${pr.state})`,
        memoryRecommendations: [
          `Record PR #${pr.number} state and review status.`,
        ],
      };
    }

    case "create_pr": {
      const pr = data as Record<string, unknown>;
      return {
        status: "success",
        operation,
        result: pr,
        summary: `PR #${pr.number} created: "${pr.title}"`,
        memoryRecommendations: [
          `Record PR #${pr.number} creation for project tracking.`,
        ],
        suggestions: ["Request code review."],
      };
    }

    case "merge_pr": {
      return {
        status: "success",
        operation,
        result: data,
        summary: "Pull request merged successfully.",
        memoryRecommendations: ["Record PR merge in project history."],
        suggestions: ["Verify deployment status."],
      };
    }

    default:
      return {
        status: "success",
        operation,
        result: data,
        summary: `PR operation "${operation}" completed.`,
      };
  }
}
