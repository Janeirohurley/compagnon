// memory_store - appends a durable entry to a labeled working-memory block.
// SEC-001: content is rejected (not stored) when it matches a secret pattern.
import { z } from "zod";
import { getCompanionMemory } from "../../companion/memory";
import { resolveMemoryIds, sanitizeForMemory } from "../../companion/memory-context";

const LABEL_HEADING = {
  faits: "Faits",
  preferences: "Préférences",
  decisions: "Décisions",
  procedures: "Procédures",
} as const;

export type MemoryLabel = keyof typeof LABEL_HEADING;

export const memoryStoreSchema = z.object({
  label: z.enum(["faits", "preferences", "decisions", "procedures"]).describe("Working-memory block to store into"),
  content: z.string().min(1).max(2000).describe("Content to persist"),
  subject: z.string().optional().describe("Optional key/subject for the entry"),
  resourceId: z.string().optional().describe("Resource scope (defaults to userId or 'anonymous')"),
  userId: z.string().optional().describe("User id used as resourceId fallback"),
  threadId: z.string().optional().describe("Thread scope; defaults to the resource id"),
});

export function upsertBlockLine(wm: string, title: string, line: string): string {
  const heading = `# ${title}`;
  const lines = wm.length ? wm.split("\n") : [];
  const idx = lines.findIndex((l) => l === heading);

  if (idx === -1) {
    const block = `${heading}\n${line}`;
    return lines.length ? `${wm}\n\n${block}` : block;
  }

  const filtered = lines.filter((l) => l !== line);
  let insertAt = idx + 1;
  while (
    insertAt < filtered.length &&
    filtered[insertAt].trim() &&
    !filtered[insertAt].startsWith("#")
  ) {
    insertAt++;
  }
  filtered.splice(insertAt, 0, line);
  return filtered.join("\n");
}

export const memoryStoreTool = {
  name: "memory_store",
  description:
    "Stores a durable entry into the resource-scoped working memory under a labeled block (faits | preferences | decisions | procedures). Rejects secrets. The store is explicit: only persist information worth remembering.",
  inputSchema: memoryStoreSchema,
  execute: async (input: z.infer<typeof memoryStoreSchema>) => {
    if (sanitizeForMemory(input.content) === null) {
      return { success: false, error: "content rejected: secret pattern detected" };
    }

    const ids = resolveMemoryIds(input);
    const memory = getCompanionMemory();
    const contextThreadId = ids.threadId || ids.resourceId;

    const current = await memory.getWorkingMemory({
      threadId: contextThreadId,
      resourceId: ids.resourceId,
    });

    const line = input.subject ? `- ${input.subject}: ${input.content}` : `- ${input.content}`;
    const next = upsertBlockLine(current ?? "", LABEL_HEADING[input.label], line);

    await memory.updateWorkingMemory({
      threadId: contextThreadId,
      resourceId: ids.resourceId,
      workingMemory: next,
    });

    return { success: true, label: input.label, content: line, resourceId: ids.resourceId };
  },
};