import type { GitHubParameters, GitHubAgentResult } from "../domain/types";
import type { GitHubOperation } from "../domain/enums";

/**
 * Build MCP tool call parameters for a repo operation.
 */
export function buildRepoParams(
  operation: GitHubOperation,
  repository: string,
  params: GitHubParameters,
): { tool: string; args: Record<string, unknown> } {
  const [owner, repo] = repository.split("/");

  switch (operation) {
    case "get_file":
      return {
        tool: "get_file_contents",
        args: {
          owner,
          repo,
          path: params.filePath ?? "",
        },
      };

    case "list_branches":
      return {
        tool: "list_branches",
        args: {
          owner,
          repo,
          page: params.page ?? 1,
          per_page: params.perPage ?? 30,
        },
      };

    case "list_commits":
      return {
        tool: "list_commits",
        args: {
          owner,
          repo,
          page: params.page ?? 1,
          per_page: params.perPage ?? 30,
          sha: params.branch,
        },
      };

    case "repo_analysis":
      return {
        tool: "get_file_contents",
        args: {
          owner,
          repo,
          path: ".",
        },
      };

    default:
      return {
        tool: "get_file_contents",
        args: { owner, repo, path: "." },
      };
  }
}

/**
 * Validate repo operation parameters.
 */
export function validateRepoParams(
  operation: GitHubOperation,
  params: GitHubParameters,
): string[] {
  const errors: string[] = [];

  if (operation === "get_file" && !params.filePath) {
    errors.push('Operation "get_file" requires a filePath.');
  }

  return errors;
}

/**
 * Format a repo result into a structured summary.
 */
export function formatRepoResult(
  operation: GitHubOperation,
  raw: unknown,
): GitHubAgentResult {
  const data = raw as Record<string, unknown>;

  switch (operation) {
    case "get_file": {
      const file = data as Record<string, unknown>;
      return {
        status: "success",
        operation,
        result: file,
        summary: `Retrieved file: ${file.name ?? "unknown"}`,
        suggestions: [],
      };
    }

    case "list_branches": {
      const branches = (data as unknown) as unknown[];
      return {
        status: "success",
        operation,
        result: branches,
        summary: `Listed ${branches.length} branch(es).`,
        suggestions: [],
      };
    }

    case "list_commits": {
      const commits = (data as unknown) as unknown[];
      return {
        status: "success",
        operation,
        result: commits,
        summary: `Listed ${commits.length} commit(s).`,
        memoryRecommendations: [
          "Record recent commits for project history.",
        ],
      };
    }

    case "repo_analysis": {
      return {
        status: "success",
        operation,
        result: data,
        summary: "Repository analysis completed.",
        memoryRecommendations: ["Store repository analysis snapshot."],
      };
    }

    default:
      return {
        status: "success",
        operation,
        result: data,
        summary: `Repo operation "${operation}" completed.`,
      };
  }
}
