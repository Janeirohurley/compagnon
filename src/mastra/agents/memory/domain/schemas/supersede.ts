import { z } from "zod";

export const supersedeSchema = z.object({
  id: z.string().uuid("Invalid memory ID"),
  scope: z.enum(["global", "user", "organization", "project", "repository", "task"]),
  scopeId: z.string().optional(),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceType: z.enum(["user", "conversation", "file", "repository", "tool", "agent"]),
});

export type SupersedeInput = z.infer<typeof supersedeSchema>;
