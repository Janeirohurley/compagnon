import { outlineAgent } from "../agents/outline/agent";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const outlineRoutes = [
  {
    path: "/outline",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { operation, parameters, context } = body ?? {};

      if (!operation) {
        return json({ error: "Missing required field: operation" }, 400);
      }

      const prompt = [
        `Execute the following Outline operation: ${operation}`,
        parameters ? `Parameters: ${JSON.stringify(parameters, null, 2)}` : "",
        context ? `Context: ${context}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const result = await outlineAgent.generate([
        { role: "user", content: prompt },
      ]);

      return json({ status: "success", result: result.text });
    },
  },
  {
    path: "/outline/agent",
    method: "GET" as const,
    handler: async () => {
      return json({
        id: "outline",
        name: "Outline Agent",
        description:
          "Specialized agent for documentation and knowledge base via Outline: search, create, update documents, manage collections.",
        operations: [
          "search",
          "read",
          "create",
          "update",
          "delete",
          "list_documents",
          "list_collections",
          "publish_from_memory",
          "generate_summary",
        ],
      });
    },
  },
];
