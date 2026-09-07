import { notionAgent } from "../agents/notion/agent";
import { getNotionConfig } from "../agents/notion/config";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const notionRoutes = [
  {
    path: "/notion",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { operation, parameters, context } = body ?? {};

      if (!operation) {
        return json({ error: "Missing required field: operation" }, 400);
      }

      const prompt = [
        `Execute the following Notion operation: ${operation}`,
        parameters ? `Parameters: ${JSON.stringify(parameters, null, 2)}` : "",
        context ? `Context: ${context}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const result = await notionAgent.generate([{ role: "user", content: prompt }]);

      return json({ status: "success", result: result.text });
    },
  },
  {
    path: "/notion/agent",
    method: "GET" as const,
    handler: async () => {
      return json({
        id: "notion",
        name: "Notion Agent",
        description:
          "Specialized agent for the user's Notion workspace: search, read, create, update and organize pages and database entries via the Notion MCP.",
        operations: [
          "search",
          "read",
          "create",
          "update",
          "delete",
          "archive",
          "list",
          "query_database",
          "create_database_entry",
          "move",
          "connect",
          "generate_summary",
        ],
        connection: getNotionConfig(),
      });
    },
  },
];