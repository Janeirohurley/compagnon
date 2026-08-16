import { z } from "zod";

export const recordEpisodeSchema = z.object({
  project: z.string().optional(),
  repository: z.string().optional(),
  task: z.string().optional(),
  trigger: z.string(),
  observations: z.array(z.string()),
  actions: z.array(z.string()),
  outcome: z.string(),
  success: z.boolean(),
  lessons: z.array(z.string()).optional(),
  toolsUsed: z.array(z.string()).optional(),
});

export type RecordEpisodeInput = z.infer<typeof recordEpisodeSchema>;
