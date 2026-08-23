import { decodeFunctionData, formatUnits } from "viem";
import { erc20Abi, transferFunctionSignature } from "./erc20-abi";
import type { EvmTransactionSource } from "./transaction-schema";

export class Web3Error extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "Web3Error";
  }
}

export type DecodedTransfer = {
  sourceId: string;
  functionName: "transfer";
  tokenAddress: `0x${string}`;
  recipient: `0x${string}`;
  amountRaw: bigint;
  amountFormatted: string;
  asset: string;
};

export function decodeTransfer(source: EvmTransactionSource): DecodedTransfer {
  const selector = source.calldata.slice(0, 10).toLowerCase();

  if (selector !== transferFunctionSignature) {
    throw new Web3Error("UNSUPPORTED_FUNCTION", `Unsupported function selector: ${selector}`);
  }

  let decoded;
  try {
    decoded = decodeFunctionData({
      abi: erc20Abi,
      data: source.calldata,
    });
  } catch (error) {
    throw new Web3Error("MALFORMED_CALLDATA", error instanceof Error ? `Malformed calldata: ${error.message}` : "Malformed calldata");
  }

  const [recipient, amountRaw] = decoded.args ?? [];
  if (typeof recipient !== "string" || typeof amountRaw !== "bigint") {
    throw new Web3Error("MALFORMED_CALLDATA", "Malformed calldata: invalid decoded arguments");
  }

  return {
    sourceId: source.id,
    functionName: "transfer",
    tokenAddress: source.tokenAddress,
    recipient,
    amountRaw,
    amountFormatted: formatUnits(amountRaw, source.decimals),
    asset: source.symbol,
  };
}
