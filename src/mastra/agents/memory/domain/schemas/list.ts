import { z } from "zod";

export const listSchema = z.object({
  scope: z.enum(["global", "user", "organization", "project", "repository", "task"]).optional(),
  scopeId: z.string().optional(),
  project: z.string().optional(),
  repository: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

export type ListInput = z.infer<typeof listSchema>;
