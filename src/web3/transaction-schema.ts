import { z } from "zod";
import { isAddress, isHex } from "viem";

const hexSchema = z.string().refine((value): value is `0x${string}` => isHex(value), {
  message: "value must be a valid hex string prefixed with 0x",
});

const addressSchema = z.string().refine((value): value is `0x${string}` => isAddress(value), {
  message: "value must be a valid EVM address",
});

export const evmTransactionSourceSchema = z.object({
  id: z.string().trim().min(1),
  chain: z.literal("evm"),
  tokenAddress: addressSchema,
  calldata: hexSchema,
  decimals: z.number().int().nonnegative(),
  symbol: z.string().trim().min(1),
}).strict();

export type EvmTransactionSource = z.infer<typeof evmTransactionSourceSchema>;
