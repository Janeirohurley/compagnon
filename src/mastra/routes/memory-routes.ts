import { getCompanionMemory } from "../agents/companion/memory";
import { resolveMemoryIds } from "../agents/companion/memory-context";
import { memoryFindTool, memoryStoreTool } from "../agents/memory/tools";
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
      if (!query) return json({ results: [] });
      const result = await memoryFindTool.execute({ query });
      return json({
        results: result.context
          ? [{ type: 'context', context: result.context, count: result.count }]
          : [],
      });
    },
  },
  {
    path: '/memory/remember',
    method: 'POST' as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const result = await memoryStoreTool.execute({
        label: body.label || 'faits',
        content: body.value || body.content,
        subject: body.subject,
        resourceId: body.resourceId,
        userId: body.userId,
        threadId: body.threadId,
      });
      if (!result.success) return json({ memory: result }, 400);
      return json({ memory: result });
    },
  },
  {
    path: '/memory/list',
    method: 'GET' as const,
    handler: async (c: any) => {
      const ids = resolveMemoryIds({ resourceId: c.req.query('resourceId') });
      const memory = getCompanionMemory();
      const workingMemory = await memory.getWorkingMemory({
        threadId: ids.resourceId,
        resourceId: ids.resourceId,
      });
      return json({ memories: workingMemory ?? '' });
    },
  },
  // Workflow route - Execute task with memory-first workflow
  {
    path: '/memory/workflow',
    method: 'POST' as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { task, project, repository, resourceId } = body;

      if (!task) {
        return json({ error: 'task is required' }, 400);
      }

      try {
        // Create and run the workflow
        const run = await agentMemoryWorkflow.createRun();
        const result = await run.start({
          inputData: { task, project, repository, resourceId },
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