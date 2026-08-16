import { z } from "zod";

export const updateSchema = z.object({
  id: z.string(),
  value: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: z.enum(["active", "stale", "deprecated", "superseded", "archived"]).optional(),
});

export type UpdateInput = z.infer<typeof updateSchema>;
