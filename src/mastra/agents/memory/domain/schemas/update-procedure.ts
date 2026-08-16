import { z } from "zod";

export const updateProcedureSchema = z.object({
  id: z.string(),
  purpose: z.string().optional(),
  steps: z.array(z.object({
    order: z.number(),
    action: z.string(),
  })).optional(),
});

export type UpdateProcedureInput = z.infer<typeof updateProcedureSchema>;
