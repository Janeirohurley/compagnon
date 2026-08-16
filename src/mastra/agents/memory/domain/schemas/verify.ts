import { z } from "zod";

export const verifySchema = z.object({
  id: z.string(),
  verifiedValue: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export type VerifyInput = z.infer<typeof verifySchema>;
