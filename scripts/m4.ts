import {
  runAgent,
  createEvidenceStore,
  formatTrace,
  type OrchestratorResult,
} from "../src/tools";
import { buildOnchainEvidence, decodeTransfer, type DecodedTransfer } from "../src/web3";
import { evidenceNodeSchema, type EvidenceNode } from "../src/evidence/evidence-schema";
import { encodeFunctionData } from "viem";
import { erc20Abi } from "../src/web3/erc20-abi";

const recipientA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const recipientB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TX_HASH = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const TOKEN_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`;

function makeMockTransaction(id: string, recipient: string, amountRaw: bigint, symbol = "USDT", decimals = 6) {
  const calldata = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient as `0x${string}`, amountRaw] });
  return { id, chain: "evm" as const, tokenAddress: TOKEN_ADDRESS, calldata, decimals, symbol };
}

function makeRpcTransaction(source: ReturnType<typeof makeMockTransaction>) {
  return { hash: TX_HASH, to: source.tokenAddress, input: source.calldata, value: BigInt(0), blockNumber: BigInt(12345678), status: undefined };
}

function makeUnsupportedSource() {
  return { id: "TX-UNSUPPORTED", chain: "evm" as const, tokenAddress: TOKEN_ADDRESS, calldata: "0x12345678" as `0x${string}`, decimals: 6, symbol: "USDT" };
}

function decodedToEvidence(decoded: DecodedTransfer, sourceId: string): EvidenceNode[] {
  const nodes = buildOnchainEvidence(decoded, {
    transactionHash: TX_HASH,
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

function mockRpcClient(transaction?: any, failure = false) {
  return {
    getTransaction: async () => {
      if (failure) throw new Error("RPC unavailable");
      return transaction;
    },
  };
}

let qvacCallCount = 0;
function mockQvac(actions: unknown[]) {
  return () => actions[Math.min(qvacCallCount++, actions.length - 1)];
}

async function runScenario(label: string, task: string, evidenceStore: ReturnType<typeof createEvidenceStore>, actions: unknown[], rpc?: { transaction?: any; failure?: boolean }): Promise<OrchestratorResult> {
  console.log(`\n${label}\n`);
  qvacCallCount = 0;
  const result = await runAgent(task, {
    evidenceStore,
    rpcUrl: rpc ? "http://mock" : undefined,
    transactionClient: rpc ? mockRpcClient(rpc.transaction, rpc.failure) : undefined,
    mockQvacAction: mockQvac(actions),
  });
  console.log(formatTrace(result.steps));
  console.log(`FINAL VERDICT: ${result.finalVerdict}`);
  console.log(`REASON: ${result.reason}`);
  console.log(`UNSAFE APPROVAL: ${result.unsafeApproval ? "YES" : "NO"}`);
  return result;
}

async function main() {
  console.log("VETA — M4 TOOL RELIABILITY\n");
  const amountRaw = BigInt(1250) * BigInt(10) ** BigInt(6);
  const sourceA = makeMockTransaction("TX-A", recipientA, amountRaw);
  const decodedA = decodeTransfer(sourceA);
  const t0A = decodedToEvidence(decodedA, "TX-A");
  const evidenceA = createEvidenceStore({
    "REQ-001": paymentRequestEvidence("REQ-001", recipientA, "1250", "USDT"),
    "TX-A": t0A,
  });

  const completeActions = [
    { action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-001" } },
    { action: "call_tool", tool: "get_transaction", arguments: { txHash: TX_HASH } },
    { action: "call_tool", tool: "decode_transaction", arguments: { transaction: sourceA } },
    { action: "call_tool", tool: "verify_transaction", arguments: { authorityEvidence: evidenceA.get("REQ-001"), onchainEvidence: t0A } },
    { action: "finish", summary: "Verification complete" },
  ];
  const scenarioA = await runScenario("SCENARIO A — Valid workflow", `Verify transaction ${TX_HASH} against payment request REQ-001.`, evidenceA, completeActions, { transaction: makeRpcTransaction(sourceA) });
  if (scenarioA.finalVerdict !== "APPROVE") throw new Error(`Scenario A expected APPROVE, got ${scenarioA.finalVerdict}`);

  const sourceB = makeMockTransaction("TX-B", recipientB, amountRaw);
  const decodedB = decodeTransfer(sourceB);
  const t0B = decodedToEvidence(decodedB, "TX-B");
  const evidenceB = createEvidenceStore({ "REQ-002": paymentRequestEvidence("REQ-002", recipientA, "1250", "USDT"), "TX-B": t0B });
  const scenarioB = await runScenario("SCENARIO B — Recipient mismatch", `Verify transaction ${TX_HASH} against payment request REQ-002.`, evidenceB, [
    { action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-002" } },
    { action: "call_tool", tool: "get_transaction", arguments: { txHash: TX_HASH } },
    { action: "call_tool", tool: "decode_transaction", arguments: { transaction: sourceB } },
    { action: "call_tool", tool: "verify_transaction", arguments: { authorityEvidence: evidenceB.get("REQ-002"), onchainEvidence: t0B } },
    { action: "finish", summary: "Verification complete" },
  ], { transaction: makeRpcTransaction(sourceB) });
  if (scenarioB.finalVerdict !== "BLOCK") throw new Error(`Scenario B expected BLOCK, got ${scenarioB.finalVerdict}`);

  const scenarioC = await runScenario("SCENARIO C — Missing evidence", `Verify transaction ${TX_HASH} against REQ-MISSING.`, createEvidenceStore(), [
    { action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-MISSING" } },
    { action: "finish", summary: "Evidence missing" },
  ]);
  if (scenarioC.finalVerdict !== "REVIEW") throw new Error(`Scenario C expected REVIEW, got ${scenarioC.finalVerdict}`);

  const scenarioD = await runScenario("SCENARIO D — RPC failure", `Verify transaction ${TX_HASH} against REQ-001.`, evidenceA, [
    { action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-001" } },
    { action: "call_tool", tool: "get_transaction", arguments: { txHash: TX_HASH } },
    { action: "finish", summary: "RPC failed" },
  ], { failure: true });
  if (scenarioD.finalVerdict !== "REVIEW") throw new Error(`Scenario D expected REVIEW, got ${scenarioD.finalVerdict}`);

  const unsupportedSource = makeUnsupportedSource();
  const scenarioE = await runScenario("SCENARIO E — Unsupported transaction", `Verify transaction ${TX_HASH} against REQ-001.`, evidenceA, [
    { action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-001" } },
    { action: "call_tool", tool: "get_transaction", arguments: { txHash: TX_HASH } },
    { action: "call_tool", tool: "decode_transaction", arguments: { transaction: unsupportedSource } },
    { action: "finish", summary: "Unsupported" },
  ], { transaction: makeRpcTransaction(sourceA) });
  if (scenarioE.finalVerdict !== "REVIEW") throw new Error(`Scenario E expected REVIEW, got ${scenarioE.finalVerdict}`);

  const scenarioF = await runScenario("SCENARIO F — Invalid model tool call", `Verify transaction ${TX_HASH} against REQ-001.`, evidenceA, [
    { action: "call_tool", tool: "unknown_tool", arguments: {} },
    { action: "finish", summary: "Invalid tool" },
  ]);
  if (scenarioF.finalVerdict !== "REVIEW") throw new Error(`Scenario F expected REVIEW, got ${scenarioF.finalVerdict}`);

  const scenarioG = await runScenario("SCENARIO G — Missing required step", `Verify transaction ${TX_HASH} against REQ-001.`, evidenceA, [
    { action: "finish", summary: "Done" },
  ]);
  if (scenarioG.finalVerdict !== "REVIEW") throw new Error(`Scenario G expected REVIEW, got ${scenarioG.finalVerdict}`);

  console.log("\nALL M4 SCENARIOS PASS\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
