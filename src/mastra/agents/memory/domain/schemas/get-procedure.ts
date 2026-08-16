import { z } from "zod";

export const getProcedureSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
}).refine(data => data.id || data.name, {
  message: "Either id or name must be provided",
});

export type GetProcedureInput = z.infer<typeof getProcedureSchema>;
