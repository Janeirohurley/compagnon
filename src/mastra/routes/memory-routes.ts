import { memoryManager } from "../agents/memory/services/memory-manager";
import { agentMemoryWorkflow } from "../workflows/agent-memory-workflow";

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
  // Workflow route - Execute task with memory-first workflow
  {
    path: '/memory/workflow',
    method: 'POST' as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { task, project, repository } = body;

      if (!task) {
        return json({ error: 'task is required' }, 400);
      }

      try {
        // Create and run the workflow
        const run = await agentMemoryWorkflow.createRun();
        const result = await run.start({
          inputData: { task, project, repository },
        });

        if (result.status !== 'success') {
          return json({
            success: false,
            status: result.status,
            error: result.status === 'failed' ? (result as any).error?.message : 'Workflow did not complete',
          }, 500);
        }

        return json({
          success: true,
          status: result.status,
          result: (result as any).result,
        });
      } catch (error) {
        return json({
          error: error instanceof Error ? error.message : 'Workflow failed',
        }, 500);
      }
    },
  },
];
