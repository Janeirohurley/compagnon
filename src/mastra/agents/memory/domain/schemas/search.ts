import { z } from "zod";

export const searchSchema = z.object({
  query: z.string(),
  scope: z.enum(["global", "user", "organization", "project", "repository", "task"]).optional(),
  scopeId: z.string().optional(),
  project: z.string().optional(),
  repository: z.string().optional(),
  minConfidence: z.number().min(0).max(1).default(0),
  limit: z.number().min(1).max(100).default(10),
});

export type SearchInput = z.infer<typeof searchSchema>;
