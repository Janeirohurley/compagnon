// Memory Maintenance Workflow - periodic hygiene over the unified memory.
// (a) re-reads the resource working memory, (b) merges/dedupes lines per label,
// (c) re-applies sanitizeForMemory (drops secrets), (d) prunes empty threads so
// their vector embeddings are cleaned up by deleteThread.
//
// Pure helpers are exported for tests; the workflow step only orchestrates the
// unified Memory facade (no custom schema, no direct DB access).
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getCompanionMemory } from "../agents/companion/memory";
import { resolveMemoryIds, sanitizeForMemory } from "../agents/companion/memory-context";

export const MAINTENANCE_HEADINGS = [
  "Faits",
  "Préférences",
  "Décisions",
  "Procédures",
] as const;

/**
 * Merges and dedupes a working-memory document: identical lines within a
 * labeled block collapse to their first occurrence; lines whose content fails
 * sanitizeForMemory are dropped (counted). Heading case/accents are normalized
 * ("# faits" → "# Faits"). Pure and exported for testing.
 */
export function normalizeWorkingMemory(wm: string): {
  normalized: string;
  deduped: number;
  removedSecrets: number;
  changed: boolean;
} {
  const lines = wm.length ? wm.split("\n") : [];
  const seen = new Set<string>();
  const out: string[] = [];
  let deduped = 0;
  let removedSecrets = 0;

  const canonicalHeading = (title: string): string | null => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lower = normalize(title.trim());
    const match = MAINTENANCE_HEADINGS.find((h) => normalize(h) === lower);
    return match ?? null;
  };

  for (const line of lines) {
    const heading = line.trim().startsWith("#") ? line.trim().slice(1).trim() : null;
    const canon = heading ? canonicalHeading(heading) : null;

    if (canon) {
      out.push(`# ${canon}`);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (sanitizeForMemory(trimmed) === null) {
      removedSecrets++;
      continue;
    }

    if (seen.has(trimmed)) {
      deduped++;
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }

  const normalized = out.join("\n").trim();
  return {
    normalized: normalized.length ? `${normalized}\n` : "",
    deduped,
    removedSecrets,
    changed: normalized !== wm.trim(),
  };
}

const maintenanceInputSchema = z.object({
  resourceId: z.string().optional().describe("Resource to maintain (defaults to 'anonymous')"),
  userId: z.string().optional().describe("User id used as resourceId fallback"),
  threadId: z.string().optional().describe("Thread scope; defaults to the resource id"),
});

const maintenanceOutputSchema = z.object({
  resourceId: z.string(),
  blocks: z.array(z.string()),
  deduped: z.number(),
  removedSecrets: z.number(),
  normalized: z.boolean(),
  pruneDeletedThreads: z.number(),
});

const maintenanceStep = createStep({
  id: "memory-maintenance",
  description:
    "Cleans the unified memory of a resource: dedupes labeled working-memory blocks, drops secret-pattern lines, and prunes empty threads so their vectors are deleted.",
  inputSchema: maintenanceInputSchema,
  outputSchema: maintenanceOutputSchema,
  execute: async ({ inputData }) => {
    const ids = resolveMemoryIds(inputData);
    const resourceId = ids.resourceId;
    const contextThreadId = inputData.threadId || resourceId;

    const memory = getCompanionMemory();

    const wm = (await memory.getWorkingMemory({ threadId: contextThreadId, resourceId })) ?? "";

    const { normalized, deduped, removedSecrets, changed } = normalizeWorkingMemory(wm);

    if (changed) {
      await memory.updateWorkingMemory({
        threadId: contextThreadId,
        resourceId,
        workingMemory: normalized,
      });
    }

    let pruned = 0;
    try {
      const threads = await memory.listThreads({ filter: { resourceId } });
      for (const thread of threads.threads) {
        const threadId = thread.id;
        const threadWm = await memory.getWorkingMemory({ threadId, resourceId });
        if (threadWm) continue;

        const { total } = await memory.recall({
          threadId,
          resourceId,
          perPage: 1,
        });
        if (total === 0) {
          await memory.deleteThread(threadId);
          pruned++;
        }
      }
    } catch (error) {
      console.error("Memory maintenance: thread pruning failed:", error);
    }

    return {
      resourceId,
      blocks: [...MAINTENANCE_HEADINGS],
      deduped,
      removedSecrets,
      normalized: changed,
      pruneDeletedThreads: pruned,
    };
  },
});

export const memoryMaintenanceWorkflow = createWorkflow({
  id: "memory-maintenance",
  description:
    "Maintains the unified memory: dedupes and sanitizes the resource working memory, prunes empty threads (vector cleanup), keeping the memory canonical and leak-free.",
  inputSchema: maintenanceInputSchema,
  outputSchema: maintenanceOutputSchema,
})
  .then(maintenanceStep)
  .commit();

export const maintenanceStepId = "memory-maintenance";