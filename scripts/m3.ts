import {
  buildOnchainEvidence,
  decodeTransfer,
  evmTransactionSourceSchema,
  erc20Abi,
} from "../src/web3";
import { evidenceNodeSchema, type EvidenceNode } from "../src/evidence/evidence-schema";
import { runSafetyKernel, explainVerdict } from "../src/safety";
import { encodeFunctionData } from "viem";

const tokenUSDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const tokenOther = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const addressA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const addressB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function makeTransaction(
  id: string,
  recipient: string,
  amountRaw: bigint,
  token: string,
  symbol: string,
  decimals: number,
) {
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient as `0x${string}`, amountRaw],
  });
  return evmTransactionSourceSchema.parse({
    id,
    chain: "evm",
    tokenAddress: token,
    calldata,
    decimals,
    symbol,
  });
}

function paymentRequestEvidence(id: string, recipient: string, amount: string, asset: string): EvidenceNode[] {
  const fields: Array<{ field: "recipient" | "amount" | "asset"; value: string; text: string }> = [
    { field: "recipient", value: recipient, text: recipient },
    { field: "amount", value: amount, text: `${amount} ${asset}` },
    { field: "asset", value: asset, text: asset },
  ];
  const nodes = fields.map((entry) => ({
    id: `${id}::${entry.field}`,
    field: entry.field,
    value: entry.value,
    sourceId: id,
    trustTier: "T1_AUTHORITY" as const,
    extraction: "explicit" as const,
    evidenceText: entry.text,
  }));
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

function onchainEvidence(transactionId: string, recipient: string, amountRaw: bigint, symbol: string, decimals: number, token = tokenUSDT): EvidenceNode[] {
  const decoded = decodeTransfer(makeTransaction(transactionId, recipient, amountRaw, token, symbol, decimals));
  const nodes = buildOnchainEvidence(decoded);
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

function evaluateCase(label: string, evidence: EvidenceNode[]) {
  const result = runSafetyKernel(evidence);
  console.log(label);
  console.log(explainVerdict(result));
  console.log("");
  return result;
}

console.log("VETA — M3 DETERMINISTIC SAFETY KERNEL\n");

const amount = BigInt(1250) * (BigInt(10) ** BigInt(6));

// Case A: Perfect Match
const caseA = evaluateCase("CASE A — Perfect Match", [
  ...paymentRequestEvidence("REQ-001", addressA, "1250", "USDT"),
  ...onchainEvidence("TX-001", addressA, amount, "USDT", 6),
]);
if (caseA.verdict !== "APPROVE") {
  throw new Error(`Case A expected APPROVE, got ${caseA.verdict}`);
}

// Case B: Recipient Mutation
const caseB = evaluateCase("CASE B — Recipient Mutation", [
  ...paymentRequestEvidence("REQ-002", addressA, "1250", "USDT"),
  ...onchainEvidence("TX-002", addressB, amount, "USDT", 6),
]);
if (caseB.verdict !== "BLOCK") {
  throw new Error(`Case B expected BLOCK, got ${caseB.verdict}`);
}

// Case C: Amount Mutation
const caseC = evaluateCase("CASE C — Amount Mutation", [
  ...paymentRequestEvidence("REQ-003", addressA, "1250", "USDT"),
  ...onchainEvidence("TX-003", addressA, amount * BigInt(10), "USDT", 6),
]);
if (caseC.verdict !== "BLOCK") {
  throw new Error(`Case C expected BLOCK, got ${caseC.verdict}`);
}

// Case D: Asset Mutation
const decodedOther = decodeTransfer(makeTransaction("TX-004", addressA, BigInt(1250) * (BigInt(10) ** BigInt(18)), tokenOther, "UNI", 18));
const evidenceOther = buildOnchainEvidence(decodedOther);
evidenceOther.forEach((node) => evidenceNodeSchema.parse(node));
const resultD = runSafetyKernel([
  ...paymentRequestEvidence("REQ-004", addressA, "1250", "USDT"),
  ...evidenceOther,
]);
console.log("CASE D — Asset Mutation");
console.log(explainVerdict(resultD));
console.log("");
if (resultD.verdict !== "BLOCK") {
  throw new Error(`Case D expected BLOCK, got ${resultD.verdict}`);
}

// Case E: Missing authoritative evidence
const caseE = evaluateCase("CASE E — Missing Authoritative Evidence", [
  ...onchainEvidence("TX-005", addressA, amount, "USDT", 6),
]);
if (caseE.verdict !== "REVIEW") {
  throw new Error(`Case E expected REVIEW, got ${caseE.verdict}`);
}

console.log("ALL REQUIRED CASES PASS\n");
