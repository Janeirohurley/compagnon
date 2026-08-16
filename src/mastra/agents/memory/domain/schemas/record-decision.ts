import { z } from "zod";

export const recordDecisionSchema = z.object({
  project: z.string().optional(),
  repository: z.string().optional(),
  title: z.string(),
  context: z.string(),
  alternatives: z.array(z.string()),
  decision: z.string(),
  rationale: z.string(),
});

export type RecordDecisionInput = z.infer<typeof recordDecisionSchema>;
