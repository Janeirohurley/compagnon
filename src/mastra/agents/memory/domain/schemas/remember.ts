import { z } from "zod";

export const rememberSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1).default(0.8),
  sourceType: z.enum(["user", "conversation", "file", "repository", "tool", "agent"]).default("conversation"),
  project: z.string().optional(),
  repository: z.string().optional(),
});

export type RememberInput = z.infer<typeof rememberSchema>;
