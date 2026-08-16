import { z } from "zod";

export const getSchema = z.object({
  id: z.string(),
});

export type GetInput = z.infer<typeof getSchema>;
