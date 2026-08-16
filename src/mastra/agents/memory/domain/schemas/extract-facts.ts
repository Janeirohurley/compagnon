import { z } from "zod";

export const extractFactsSchema = z.object({
  text: z.string(),
  scope: z.enum(["global", "user", "organization", "project", "repository", "task"]).default("global"),
  scopeId: z.string().optional(),
});

export type ExtractFactsInput = z.infer<typeof extractFactsSchema>;
