import { z } from "zod";

export const retrieveContextSchema = z.object({
  query: z.string(),
  project: z.string().optional(),
  repository: z.string().optional(),
  limit: z.number().min(1).max(20).default(5),
});

export type RetrieveContextInput = z.infer<typeof retrieveContextSchema>;
