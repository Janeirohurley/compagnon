// memory_find - semantic recall + working memory over the unified Mastra Memory.
import { z } from "zod";
import { resolveMemoryIds, retrieveContext } from "../../companion/memory-context";

export const memoryFindSchema = z.object({
  query: z.string().describe("Natural-language query to search memory for"),
  resourceId: z.string().optional().describe("Resource scope (defaults to userId or 'anonymous')"),
  userId: z.string().optional().describe("User id used as resourceId fallback"),
  threadId: z.string().optional().describe("Thread scope; defaults to the resource id"),
  limit: z.number().int().min(1).max(20).optional().describe("Max context messages to return"),
});

export const memoryFindTool = {
  name: "memory_find",
  description:
    "Finds relevant context in Compagnon memory: semantic recall over past messages plus the resource-scoped working memory (facts, preferences, decisions, procedures). Returns a compact markdown context section.",
  inputSchema: memoryFindSchema,
  execute: async (input: z.infer<typeof memoryFindSchema>) => {
    const ids = resolveMemoryIds(input);
    const context = await retrieveContext(input.query, ids);
    const count = (context.match(/^- /gm) || []).length;
    return {
      context,
      count,
      resourceId: ids.resourceId,
    };
  },
};