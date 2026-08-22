import type { GitHubParameters, GitHubAgentResult } from "../domain/types";

/**
 * Build MCP tool call parameters for a search operation.
 */
export function buildSearchParams(
  repository: string,
  params: GitHubParameters,
): { tool: string; args: Record<string, unknown> } {
  const [owner, repo] = repository.split("/");

  return {
    tool: "search_code",
    args: {
      owner,
      repo,
      query: params.query ?? "",
      page: params.page ?? 1,
      per_page: params.perPage ?? 30,
    },
  };
}

/**
 * Validate search parameters.
 */
export function validateSearchParams(params: GitHubParameters): string[] {
  const errors: string[] = [];

  if (!params.query) {
    errors.push('Search operation requires a query.');
  }

  return errors;
}

/**
 * Format a search result into a structured summary.
 */
export function formatSearchResult(raw: unknown): GitHubAgentResult {
  const data = raw as Record<string, unknown>;
  const items = (data.items ?? []) as unknown[];

  return {
    status: "success",
    operation: "search_code",
    result: data,
    summary: `Found ${items.length} result(s) for code search.`,
    suggestions: items.length > 0 ? ["Review matched files for relevance."] : [],
  };
}
