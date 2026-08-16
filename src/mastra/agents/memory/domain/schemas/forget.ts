import { z } from "zod";

export const forgetSchema = z.object({
  id: z.string(),
});

export type ForgetInput = z.infer<typeof forgetSchema>;
