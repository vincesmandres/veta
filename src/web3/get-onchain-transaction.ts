import { isHex } from "viem";
import { transferFunctionSignature } from "./erc20-abi";
import { createViemPublicClient, type VetaPublicClient } from "./public-client";

export class RealityCheckError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "RealityCheckError";
  }
}

export type RawOnchainTransaction = {
  hash: string;
  to: string;
  input: `0x${string}`;
  value: bigint;
  blockNumber: bigint | null;
  status?: string;
};

export async function getOnchainTransaction(
  hash: string,
  rpcUrl: string,
  client?: VetaPublicClient,
): Promise<RawOnchainTransaction> {
  if (!isHex(hash) || hash.length !== 66) {
    throw new RealityCheckError("INVALID_TX_HASH", "Transaction hash must be a 0x-prefixed 32-byte hex string");
  }

  const publicClient = client ?? createViemPublicClient(rpcUrl);

  let tx;
  try {
    tx = await publicClient.getTransaction({ hash: hash as `0x${string}` });
  } catch (error) {
    throw new RealityCheckError(
      "RPC_UNAVAILABLE",
      error instanceof Error ? error.message : "RPC request failed",
    );
  }

  if (!tx) {
    throw new RealityCheckError("TX_NOT_FOUND", "Transaction not found");
  }

  if (!tx.to) {
    throw new RealityCheckError("NO_TRANSACTION_TARGET", "Transaction has no target address");
  }

  if (!tx.input || tx.input === "0x") {
    throw new RealityCheckError("EMPTY_CALLDATA", "Transaction has empty calldata");
  }

  const selector = tx.input.slice(0, 10).toLowerCase();
  if (selector !== transferFunctionSignature) {
    throw new RealityCheckError("UNSUPPORTED_FUNCTION", `Unsupported function selector: ${selector}`);
  }

  return {
    hash: tx.hash,
    to: tx.to,
    input: tx.input,
    value: tx.value,
    blockNumber: tx.blockNumber,
    status: undefined,
  };
}
