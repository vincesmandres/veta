import { z } from "zod";
import { evidenceNodeSchema } from "../evidence/evidence-schema";
import { evmTransactionSourceSchema } from "../web3/transaction-schema";

export const toolNameSchema = z.enum([
  "get_evidence",
  "get_transaction",
  "decode_transaction",
  "verify_transaction",
]);

export type ToolName = z.infer<typeof toolNameSchema>;

export const getEvidenceArgsSchema = z.object({
  sourceId: z.string().trim().min(1),
}).strict();

export const getTransactionArgsSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "txHash must be a 0x-prefixed 32-byte hex string"),
}).strict();

export const decodeTransactionArgsSchema = z.object({
  transaction: evmTransactionSourceSchema,
}).strict();

export const verifyTransactionArgsSchema = z.object({
  authorityEvidence: z.array(evidenceNodeSchema).min(1),
  onchainEvidence: z.array(evidenceNodeSchema).min(1),
}).strict();

export const toolCallSchema = z.object({
  action: z.literal("call_tool"),
  tool: toolNameSchema,
  arguments: z.record(z.string(), z.unknown()),
}).strict();

export const agentFinishSchema = z.object({
  action: z.literal("finish"),
  summary: z.string().optional(),
}).strict();

export const agentActionSchema = z.discriminatedUnion("action", [
  toolCallSchema,
  agentFinishSchema,
]);

export type ToolCall = z.infer<typeof toolCallSchema>;
export type AgentFinish = z.infer<typeof agentFinishSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string };

export type ExecutionStep = {
  step: number;
  action: AgentAction;
  validation: "PASS" | "FAIL";
  toolResult?: ToolResult<unknown>;
  error?: string;
  latencyMs: number;
  retries: number;
};
