import { memoryManager } from "../memory/manager";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const memoryRoutes = [
  {
    path: '/memory/search',
    method: 'GET' as const,
    handler: async (c: any) => {
      const query = c.req.query('q') || '';
      const results = await memoryManager.search({ query, limit: 10 });
      return json({ results });
    },
  },
  {
    path: '/memory/remember',
    method: 'POST' as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const memory = await memoryManager.remember({
        scope: body.scope || 'global',
        subject: body.subject,
        predicate: body.predicate,
        value: body.value,
        confidence: body.confidence || 0.8,
        source: { type: 'user' },
      });
      return json({ memory });
    },
  },
  {
    path: '/memory/list',
    method: 'GET' as const,
    handler: async (c: any) => {
      const memories = await memoryManager.listMemories();
      return json({ memories });
    },
  },
];
