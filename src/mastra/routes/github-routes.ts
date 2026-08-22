import { githubAgent } from "../agents/github/agent";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const githubRoutes = [
  {
    path: "/github",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();

      const { operation, repository, parameters, context } = body ?? {};

      if (!operation) {
        return json(
          { error: "Missing required field: operation" },
          400,
        );
      }

      const prompt = [
        `Execute the following GitHub operation: ${operation}`,
        repository ? `Repository: ${repository}` : "",
        parameters ? `Parameters: ${JSON.stringify(parameters, null, 2)}` : "",
        context ? `Context: ${context}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const result = await githubAgent.generate([
        { role: "user", content: prompt },
      ]);

      return json({
        status: "success",
        result: result.text,
      });
    },
  },
  {
    path: "/github/agent",
    method: "GET" as const,
    handler: async () => {
      return json({
        id: "github",
        name: "GitHub Agent",
        description:
          "Specialized agent for GitHub operations: issues, pull requests, code search, repository inspection.",
        operations: [
          "create_issue",
          "update_issue",
          "list_issues",
          "get_issue",
          "comment_issue",
          "list_prs",
          "get_pr",
          "create_pr",
          "merge_pr",
          "search_code",
          "get_file",
          "list_branches",
          "list_commits",
          "repo_analysis",
        ],
      });
    },
  },
];
