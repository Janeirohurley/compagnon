import { z } from "zod";

export const archiveStaleSchema = z.object({
  daysThreshold: z.number().min(30).default(90),
});

export type ArchiveStaleInput = z.infer<typeof archiveStaleSchema>;
