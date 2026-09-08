// memory_forget - removes a labeled block (or a single keyed line) from working memory.
import { z } from "zod";
import { getCompanionMemory } from "../../companion/memory";
import { resolveMemoryIds } from "../../companion/memory-context";

const LABEL_HEADING = {
  faits: "Faits",
  preferences: "Préférences",
  decisions: "Décisions",
  procedures: "Procédures",
} as const;

export const memoryForgetSchema = z.object({
  label: z.enum(["faits", "preferences", "decisions", "procedures"]).describe("Working-memory block to clear"),
  key: z.string().optional().describe("When set, only the `- key: ...` line is removed"),
  resourceId: z.string().optional().describe("Resource scope (defaults to userId or 'anonymous')"),
  userId: z.string().optional().describe("User id used as resourceId fallback"),
  threadId: z.string().optional().describe("Thread scope; defaults to the resource id"),
});

export function forgetBlock(wm: string, title: string, key?: string): string {
  const heading = `# ${title}`;
  const lines = wm.length ? wm.split("\n") : [];
  const idx = lines.findIndex((l) => l === heading);
  if (idx === -1) return wm;

  const kept: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (line === heading) {
      inBlock = true;
      continue;
    }
    if (inBlock && line.startsWith("#")) {
      inBlock = false;
    }
    if (inBlock) {
      if (key && line.startsWith(`- ${key}:`)) continue;
      if (!key) continue;
    }
    if (line === heading) continue;
    kept.push(line);
  }

  let next = kept.join("\n").trim();
  if (next) next += "\n";
  return next;
}

export const memoryForgetTool = {
  name: "memory_forget",
  description:
    "Forgets memory: removes the whole labeled working-memory block (faits | preferences | decisions | procedures), or a single keyed line within it when `key` is provided.",
  inputSchema: memoryForgetSchema,
  execute: async (input: z.infer<typeof memoryForgetSchema>) => {
    const ids = resolveMemoryIds(input);
    const memory = getCompanionMemory();
    const contextThreadId = ids.threadId || ids.resourceId;

    const current = await memory.getWorkingMemory({
      threadId: contextThreadId,
      resourceId: ids.resourceId,
    });

    const next = forgetBlock(current ?? "", LABEL_HEADING[input.label], input.key);

    if (next !== (current ?? "")) {
      await memory.updateWorkingMemory({
        threadId: contextThreadId,
        resourceId: ids.resourceId,
        workingMemory: next,
      });
    }

    return {
      success: true,
      label: input.label,
      key: input.key,
      removed: next !== (current ?? ""),
      resourceId: ids.resourceId,
    };
  },
};