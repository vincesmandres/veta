import { z } from "zod";

export const paymentIntentSchema = z.object({
  operation: z.literal("payment"),
  invoiceId: z.string().trim().min(1).nullable(),
  amount: z.number().finite().positive(),
  asset: z.string().trim().min(1),
  counterparty: z.string().trim().min(1),
}).strict();

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
