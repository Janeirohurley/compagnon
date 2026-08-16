import { memoryManager } from "../services/memory-manager";
import { recordEpisodeSchema, type RecordEpisodeInput } from "../domain/schemas/record-episode";

export const memoryRecordEpisodeTool = {
  name: "memory_record_episode",
  description: "Record a task execution episode for learning.",
  inputSchema: recordEpisodeSchema,
  execute: async (input: RecordEpisodeInput) => {
    const episode = await memoryManager.recordEpisode(input);
    return { success: true, episode };
  },
};
