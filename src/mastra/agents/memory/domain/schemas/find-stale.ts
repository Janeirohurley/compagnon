import { z } from "zod";

export const findStaleSchema = z.object({
  daysThreshold: z.number().min(7).default(30),
});

export type FindStaleInput = z.infer<typeof findStaleSchema>;
