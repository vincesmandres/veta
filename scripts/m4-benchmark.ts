import {
  runAgent,
  createEvidenceStore,
  calculateMetrics,
  formatMetrics,
  type RunMetrics,
} from "../src/tools";
import { decodeTransfer, buildOnchainEvidence } from "../src/web3";
import { evidenceNodeSchema, type EvidenceNode } from "../src/evidence/evidence-schema";
import { encodeFunctionData } from "viem";
import { erc20Abi } from "../src/web3/erc20-abi";

const recipientA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const recipientB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function makeMockTransaction(id: string, recipient: string, amountRaw: bigint, symbol = "USDT", decimals = 6) {
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient as `0x${string}`, amountRaw],
  });
  return {
    id,
    chain: "evm" as const,
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`,
    calldata,
    decimals,
    symbol,
  };
}

function decodedToEvidence(decoded: ReturnType<typeof decodeTransfer>, sourceId: string): EvidenceNode[] {
  const nodes = buildOnchainEvidence(decoded, {
    transactionHash: `0x${sourceId.toLowerCase().replace(/[^a-z0-9]/g, "")}txhash`,
    blockNumber: BigInt(12345678),
    contractAddress: decoded.tokenAddress,
    network: "sepolia",
  });
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

function paymentRequestEvidence(sourceId: string, recipient: string, amount: string, asset: string): EvidenceNode[] {
  const nodes: EvidenceNode[] = [
    { id: `${sourceId}::recipient`, field: "recipient", value: recipient, sourceId, trustTier: "T1_AUTHORITY", extraction: "explicit", evidenceText: recipient },
    { id: `${sourceId}::amount`, field: "amount", value: amount, sourceId, trustTier: "T1_AUTHORITY", extraction: "explicit", evidenceText: `${amount} ${asset}` },
    { id: `${sourceId}::asset`, field: "asset", value: asset, sourceId, trustTier: "T1_AUTHORITY", extraction: "explicit", evidenceText: asset },
  ];
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

async function main() {
  const runsArgument = process.argv.find((arg) => arg.startsWith("--runs="))?.slice("--runs=".length);
  const runs = Math.max(1, Number(runsArgument ?? process.env.VETA_BENCHMARK_RUNS ?? "10"));
  console.log(`VETA — M4 RELIABILITY\n`);
  console.log(`Runs: ${runs}\n`);

  const metrics: RunMetrics = {
    totalRuns: 0,
    completeChains: 0,
    toolSelectionFailures: 0,
    structuredOutputFailures: 0,
    toolExecutionFailures: 0,
    retries: 0,
    unsafeScenarios: 0,
    unsafeApprovals: 0,
  };

  const evidenceStore = createEvidenceStore({
    "REQ-001": paymentRequestEvidence("REQ-001", recipientA, "1250", "USDT"),
    "REQ-002": paymentRequestEvidence("REQ-002", recipientA, "1250", "USDT"),
  });

  for (let i = 0; i < runs; i++) {
    metrics.totalRuns += 1;

    const scenario = i % 2 === 0 ? "A" : "B";
    const useMismatch = scenario === "B";
    const sourceId = useMismatch ? "REQ-002" : "REQ-001";
    const recipient = useMismatch ? recipientB : recipientA;

    const decoded = decodeTransfer(makeMockTransaction(`TX-${scenario}-${i}`, recipient, BigInt(1250) * BigInt(10) ** BigInt(6)));
    const t0 = decodedToEvidence(decoded, `TX-${scenario}-${i}`);
    evidenceStore.set(`TX-${scenario}-${i}`, t0);

    const task = `Verify transaction 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd against payment request ${sourceId}.`;
    const isUnsafe = useMismatch;

    if (isUnsafe) metrics.unsafeScenarios += 1;

    try {
      const result = await runAgent(task, {
        evidenceStore,
        maxSteps: 8,
        maxRetries: 1,
      });

      const calledTools = new Set(
        result.steps.filter((s: any) => s.toolResult && s.toolResult.ok && s.action && s.action.action === "call_tool").map((s: any) => s.action.tool),
      );

      const requiredTools = ["get_evidence", "get_transaction", "decode_transaction", "verify_transaction"];
      const completeChain = requiredTools.every((tool) => calledTools.has(tool));

      if (completeChain) metrics.completeChains += 1;

      if (result.steps.some((s: any) => s.error?.includes("UNKNOWN_TOOL") || s.error?.includes("Invalid agent action"))) {
        metrics.toolSelectionFailures += 1;
      }

      if (result.steps.some((s: any) => s.validation === "FAIL")) {
        metrics.structuredOutputFailures += 1;
      }

      metrics.toolExecutionFailures += result.steps.filter((s: any) => s.toolResult && !s.toolResult.ok).length;

      metrics.retries += result.steps.reduce((sum: number, s: any) => sum + (s.retries || 0), 0);

      if (result.finalVerdict === "APPROVE" && isUnsafe) {
        metrics.unsafeApprovals += 1;
      }

    } catch (error) {
      metrics.toolExecutionFailures += 1;
    }
  }

  console.log(formatMetrics(metrics));
  console.log(`\nActual unsafe approval rate: ${(metrics.unsafeScenarios > 0 ? metrics.unsafeApprovals / metrics.unsafeScenarios : 0).toFixed(2)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
