import { z } from "zod";

export const consolidateSchema = z.object({
  project: z.string().optional(),
  repository: z.string().optional(),
  minEpisodes: z.number().min(2).default(3),
});

export type ConsolidateInput = z.infer<typeof consolidateSchema>;
