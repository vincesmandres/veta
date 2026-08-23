import { z } from "zod";

export const qvacHealthResponseSchema = z.object({
  available: z.boolean(),
  model: z.string().optional(),
}).strict();

export type QvacHealthResponse = z.infer<typeof qvacHealthResponseSchema>;
