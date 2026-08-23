import { mkdirSync, writeFileSync } from "node:fs";
import { runAgent, createEvidenceStore, calculateMetrics, formatMetrics, type RunMetrics } from "../src/tools";
import { buildOnchainEvidence, decodeTransfer } from "../src/web3";
import { evidenceNodeSchema, type EvidenceNode } from "../src/evidence/evidence-schema";
import { encodeFunctionData } from "viem";
import { erc20Abi } from "../src/web3/erc20-abi";

const TX_HASH = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const TOKEN_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`;
const RECIPIENT_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECIPIENT_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

type Scenario = "SAFE_MATCH" | "RECIPIENT_MISMATCH" | "MISSING_EVIDENCE" | "INCOMPLETE";

function authority(sourceId: string, recipient: string): EvidenceNode[] {
  const nodes: EvidenceNode[] = [
    { id: `${sourceId}::recipient`, field: "recipient", value: recipient, sourceId, trustTier: "T1_AUTHORITY", extraction: "explicit", evidenceText: recipient },
    { id: `${sourceId}::amount`, field: "amount", value: "1250", sourceId, trustTier: "T1_AUTHORITY", extraction: "explicit", evidenceText: "1250 USDT" },
    { id: `${sourceId}::asset`, field: "asset", value: "USDT", sourceId, trustTier: "T1_AUTHORITY", extraction: "explicit", evidenceText: "USDT" },
  ];
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

function source(id: string, recipient: string) {
  return {
    id,
    chain: "evm" as const,
    tokenAddress: TOKEN_ADDRESS,
    calldata: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient as `0x${string}`, BigInt(1250) * BigInt(10) ** BigInt(6)] }),
    decimals: 6,
    symbol: "USDT",
  };
}

function rpcTransaction(transaction: ReturnType<typeof source>) {
  return { hash: TX_HASH, to: transaction.tokenAddress, input: transaction.calldata, value: BigInt(0), blockNumber: BigInt(12345678) };
}

function onchainEvidence(transaction: ReturnType<typeof source>, sourceId: string): EvidenceNode[] {
  const decoded = decodeTransfer(transaction);
  const nodes = buildOnchainEvidence(decoded, { transactionHash: TX_HASH, blockNumber: BigInt(12345678), contractAddress: TOKEN_ADDRESS, network: "sepolia" });
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

function scenarioAt(index: number): Scenario {
  return (["SAFE_MATCH", "RECIPIENT_MISMATCH", "MISSING_EVIDENCE", "INCOMPLETE"] as Scenario[])[index % 4];
}

function expectedVerdict(scenario: Scenario): "APPROVE" | "BLOCK" | "REVIEW" {
  if (scenario === "SAFE_MATCH") return "APPROVE";
  if (scenario === "RECIPIENT_MISMATCH") return "BLOCK";
  return "REVIEW";
}

function incrementFailure(metrics: RunMetrics, category: string): void {
  metrics.failureCategories[category] = (metrics.failureCategories[category] ?? 0) + 1;
}

async function main() {
  const argument = process.argv.find((arg) => arg.startsWith("--runs="))?.slice("--runs=".length);
  const runs = Math.max(1, Number(argument ?? process.env.VETA_BENCHMARK_RUNS ?? "10"));
  const metrics: RunMetrics = {
    totalRuns: 0,
    qvacActionResponses: 0,
    validStructuredActions: 0,
    completeChains: 0,
    toolSelectionFailures: 0,
    structuredOutputFailures: 0,
    toolExecutionFailures: 0,
    retries: 0,
    verdictCases: 0,
    correctVerdicts: 0,
    unsafeScenarios: 0,
    unsafeApprovals: 0,
    failureCategories: {},
  };
  const scenarioCounts: Record<string, number> = {};
  const runResults: Array<Record<string, unknown>> = [];

  console.log("VETA — M4 REAL QVAC RELIABILITY\n");
  console.log(`Model: ${process.env.VETA_QVAC_MODEL ?? "veta-local"}`);
  console.log(`Runs: ${runs}\n`);

  for (let index = 0; index < runs; index += 1) {
    const scenario = scenarioAt(index);
    const mismatch = scenario === "RECIPIENT_MISMATCH";
    const recipient = mismatch ? RECIPIENT_B : RECIPIENT_A;
    const sourceId = scenario === "MISSING_EVIDENCE" ? "REQ-MISSING" : "REQ-001";
    const transactionSource = source(`TX-${index}`, recipient);
    const t0 = onchainEvidence(transactionSource, `TX-${index}`);
    const evidenceStore = createEvidenceStore(scenario === "MISSING_EVIDENCE" ? {} : { [sourceId]: authority(sourceId, RECIPIENT_A), [`TX-${index}`]: t0 });
    const task = `Verify transaction ${TX_HASH} against payment request ${sourceId}. Known token metadata: USDT, decimals 6.`;
    const result = await runAgent(task, {
      evidenceStore,
      rpcUrl: scenario === "SAFE_MATCH" || scenario === "RECIPIENT_MISMATCH" ? "http://controlled-local-rpc" : undefined,
      transactionClient: scenario === "SAFE_MATCH" || scenario === "RECIPIENT_MISMATCH" ? { getTransaction: async () => rpcTransaction(transactionSource) } : undefined,
      maxSteps: 8,
      maxRetries: 1,
    });

    metrics.totalRuns += 1;
    scenarioCounts[scenario] = (scenarioCounts[scenario] ?? 0) + 1;
    metrics.qvacActionResponses += result.steps.length;
    metrics.validStructuredActions += result.steps.filter((step) => step.validation === "PASS").length;
    metrics.structuredOutputFailures += result.steps.filter((step) => step.validation === "FAIL").length;
    metrics.toolExecutionFailures += result.steps.filter((step) => step.toolResult && !step.toolResult.ok).length;
    metrics.retries += Math.max(0, ...result.steps.map((step) => step.retries));

    const calledTools = new Set<string>(result.steps.filter((step) => step.toolResult?.ok && step.action.action === "call_tool").map((step) => step.action.action === "call_tool" ? step.action.tool : ""));
    if (["get_evidence", "get_transaction", "decode_transaction", "verify_transaction"].every((tool) => calledTools.has(tool))) metrics.completeChains += 1;
    if (result.steps.some((step) => step.error?.includes("Invalid agent action") || step.error?.includes("UNKNOWN_TOOL"))) {
      metrics.toolSelectionFailures += 1;
      incrementFailure(metrics, "invalid_tool_action");
    }
    for (const step of result.steps) {
      if (step.error?.includes("MALFORMED_JSON")) incrementFailure(metrics, "malformed_json");
      else if (step.error?.includes("QVAC_EMPTY_RESPONSE")) incrementFailure(metrics, "empty_response");
      else if (step.error?.includes("SCHEMA_VALIDATION_FAILED") || step.error?.includes("Invalid agent action")) incrementFailure(metrics, "schema_validation");
      if (step.toolResult && !step.toolResult.ok) incrementFailure(metrics, step.toolResult.error);
    }
    if (result.steps.some((step) => step.action.action === "finish") && !result.verificationPerformed) incrementFailure(metrics, "early_finish_or_incomplete");

    const unsafe = scenario !== "SAFE_MATCH";
    if (unsafe) metrics.unsafeScenarios += 1;
    metrics.verdictCases += 1;
    if (result.finalVerdict === expectedVerdict(scenario)) metrics.correctVerdicts += 1;
    if (unsafe && result.finalVerdict === "APPROVE") metrics.unsafeApprovals += 1;

    runResults.push({ index: index + 1, scenario, expectedVerdict: expectedVerdict(scenario), observedVerdict: result.finalVerdict, reason: result.reason, completeChain: ["get_evidence", "get_transaction", "decode_transaction", "verify_transaction"].every((tool) => calledTools.has(tool)), steps: result.steps.length, retries: Math.max(0, ...result.steps.map((step) => step.retries)) });
  }

  const rates = calculateMetrics(metrics);
  console.log(formatMetrics(metrics));
  console.log(`Scenario counts: ${JSON.stringify(scenarioCounts)}`);
  console.log(`Failure categories: ${JSON.stringify(metrics.failureCategories)}`);

  const artifact = {
    timestamp: new Date().toISOString(),
    model: process.env.VETA_QVAC_MODEL ?? "veta-local",
    endpoint: process.env.VETA_QVAC_URL ?? "http://127.0.0.1:11434/v1",
    runs,
    scenarioCounts,
    metrics,
    rates,
    results: runResults,
  };
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/m4-reliability.json", JSON.stringify(artifact, null, 2));
  console.log("Artifact: artifacts/m4-reliability.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
