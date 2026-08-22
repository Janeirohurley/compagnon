import { planeAgent } from "../agents/plane/agent";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const planeRoutes = [
  {
    path: "/plane",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { operation, project, projectId, parameters, context } = body ?? {};

      if (!operation) {
        return json({ error: "Missing required field: operation" }, 400);
      }

      const prompt = [
        `Execute the following Plane operation: ${operation}`,
        project ? `Project: ${project}` : "",
        projectId ? `Project ID: ${projectId}` : "",
        parameters ? `Parameters: ${JSON.stringify(parameters, null, 2)}` : "",
        context ? `Context: ${context}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const result = await planeAgent.generate([
        { role: "user", content: prompt },
      ]);

      return json({ status: "success", result: result.text });
    },
  },
  {
    path: "/plane/agent",
    method: "GET" as const,
    handler: async () => {
      return json({
        id: "plane",
        name: "Plane Agent",
        description:
          "Specialized agent for project management via Plane: work items, cycles, modules, advancement reports.",
        operations: [
          "list_projects",
          "get_project",
          "list_work_items",
          "get_work_item",
          "create_work_item",
          "update_work_item",
          "search_work_items",
          "list_cycles",
          "list_modules",
          "advancement_report",
          "detect_blockages",
        ],
      });
    },
  },
];
