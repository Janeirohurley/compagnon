import { memoryManager } from "../services/memory-manager";
import { archiveStaleSchema, type ArchiveStaleInput } from "../domain/schemas/archive-stale";

export const memoryArchiveStaleTool = {
  name: "memory_archive_stale",
  description: "Archive memories that have not been used for a long time.",
  inputSchema: archiveStaleSchema,
  execute: async (input: ArchiveStaleInput) => {
    const archived = await memoryManager.archiveStaleMemories(input.daysThreshold);
    return { success: true, archived };
  },
};
