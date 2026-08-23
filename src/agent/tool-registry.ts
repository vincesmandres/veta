import type { EvidenceNode } from "../evidence/evidence-schema";
import { getOnchainTransaction, type RawOnchainTransaction } from "../web3/get-onchain-transaction";
import { decodeTransfer } from "../web3/decode-transfer";
import { runSafetyKernel } from "../safety/safety-kernel";
import {
  decodeTransactionArgsSchema,
  getEvidenceArgsSchema,
  getTransactionArgsSchema,
  verifyTransactionArgsSchema,
  type ToolName,
  type ToolResult,
} from "./action-schema";

export type EvidenceStore = Map<string, EvidenceNode[]>;

export function createEvidenceStore(entries: Record<string, EvidenceNode[]> = {}): EvidenceStore {
  const store = new Map<string, EvidenceNode[]>();
  for (const [sourceId, nodes] of Object.entries(entries)) store.set(sourceId, nodes);
  return store;
}

export async function executeTool(
  tool: ToolName,
  arguments_: Record<string, unknown>,
  context: { evidenceStore: EvidenceStore; rpcUrl?: string; transactionClient?: any },
): Promise<ToolResult<unknown>> {
  try {
    switch (tool) {
      case "get_evidence": {
        const { sourceId } = getEvidenceArgsSchema.parse(arguments_);
        const evidence = Array.from(context.evidenceStore.values()).find((nodes) => nodes.some((node) => node.sourceId.toLowerCase() === sourceId.toLowerCase()));
        if (!evidence) return { ok: false, error: "SOURCE_NOT_FOUND", message: `Evidence source ${sourceId} not found` };
        return { ok: true, data: { sourceId, evidence } };
      }
      case "get_transaction": {
        const { txHash } = getTransactionArgsSchema.parse(arguments_);
        if (!context.rpcUrl) return { ok: false, error: "RPC_UNAVAILABLE", message: "VETA_RPC_URL is not configured" };
        const transaction = await getOnchainTransaction(txHash, context.rpcUrl, context.transactionClient);
        return { ok: true, data: transaction };
      }
      case "decode_transaction": {
        const { transaction } = decodeTransactionArgsSchema.parse(arguments_);
        const decoded = decodeTransfer(transaction);
        return {
          ok: true,
          data: {
            functionName: decoded.functionName,
            recipient: decoded.recipient,
            amountRaw: decoded.amountRaw.toString(),
            amountFormatted: decoded.amountFormatted,
            asset: decoded.asset,
          },
        };
      }
      case "verify_transaction": {
        const { authorityEvidence, onchainEvidence } = verifyTransactionArgsSchema.parse(arguments_);
        const result = runSafetyKernel([...authorityEvidence, ...onchainEvidence]);
        return { ok: true, data: result };
      }
    }
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const typed = error as Error & { code: string };
      return { ok: false, error: typed.code, message: typed.message };
    }
    return { ok: false, error: "TOOL_EXECUTION_FAILED", message: error instanceof Error ? error.message : "Tool execution failed" };
  }
}
