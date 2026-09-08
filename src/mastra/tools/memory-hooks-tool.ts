// Memory Hooks Tool - thin native wrapper around the unified Mastra memory.
// Actions: find (semantic recall + working memory context), store (labeled
// working-memory block, secrets rejected), forget (labeled block / keyed line).
// The old decorative retrieve, regex fact extraction and free-JSON execution
// paths were removed (plan TASK-007/TASK-013).
import { z } from "zod";
import { memoryFindTool, memoryStoreTool, memoryForgetTool } from "../agents/memory/tools";

const memoryHooksSchema = z.object({
  action: z.enum(["retrieve", "store", "forget"]),
  query: z.string().optional().describe("Search query (retrieve)"),
  label: z.enum(["faits", "preferences", "decisions", "procedures"]).optional().describe("Working-memory block (store/forget)"),
  content: z.string().optional().describe("Content to store (store)"),
  subject: z.string().optional().describe("Optional key for the entry (store)"),
  key: z.string().optional().describe("Keyed line to remove (forget)"),
  resourceId: z.string().optional().describe("Resource scope"),
  userId: z.string().optional().describe("User id used as resourceId fallback"),
  threadId: z.string().optional().describe("Thread scope"),
});

export const memoryHooksTool = {
  name: "memory_hooks",
  description:
    "Explicit memory operations on Compagnon's unified memory: retrieve relevant context (semantic recall + working memory), store a durable entry into a labeled block, or forget a labeled block.",
  inputSchema: memoryHooksSchema,
  execute: async (input: z.infer<typeof memoryHooksSchema>) => {
    const common = {
      resourceId: input.resourceId,
      userId: input.userId,
      threadId: input.threadId,
    };

    switch (input.action) {
      case "retrieve": {
        if (!input.query) return { success: false, error: "query required" };
        const result = await memoryFindTool.execute({ query: input.query, ...common });
        return { success: true, action: "retrieve", context: result.context, count: result.count };
      }

      case "store": {
        if (!input.content) return { success: false, error: "content required" };
        if (!input.label) return { success: false, error: "label required" };
        const result = await memoryStoreTool.execute({
          label: input.label,
          content: input.content,
          subject: input.subject,
          ...common,
        });
        return result;
      }

      case "forget": {
        if (!input.label) return { success: false, error: "label required" };
        const result = await memoryForgetTool.execute({
          label: input.label,
          key: input.key,
          ...common,
        });
        return result;
      }

      default:
        return { success: false, error: "Unknown action" };
    }
  },
};