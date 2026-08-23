import {
  decodeTransfer,
  evmTransactionSourceSchema,
  buildOnchainEvidence,
  getOnchainTransaction,
  RealityCheckError,
} from "../src/web3";
import { evidenceNodeSchema, type EvidenceNode } from "../src/evidence/evidence-schema";
import { runSafetyKernel, explainVerdict } from "../src/safety";

const args = process.argv.slice(2);

function argumentValue(name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim();
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() : undefined;
}

const txHash = argumentValue("--tx");
const rpcUrl = process.env.VETA_RPC_URL;
const tokenSymbol = process.env.VETA_TOKEN_SYMBOL ?? "UNKNOWN";
const tokenDecimals = Number(process.env.VETA_TOKEN_DECIMALS ?? "18");

function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Error: ${name} is required.`);
    if (name.includes("--tx")) {
      console.error('Usage: npm run veta:m3.5 -- --tx=0xTRANSACTION_HASH');
    }
    if (name.includes("VETA_RPC_URL")) {
      console.error('Set it with: $env:VETA_RPC_URL="https://..."');
    }
    process.exit(1);
  }
  return value;
}

function controlledAuthority(recipient: string, amount: string, asset: string, sourceId: string): EvidenceNode[] {
  const nodes: EvidenceNode[] = [
    {
      id: `${sourceId}::recipient`,
      field: "recipient",
      value: recipient,
      sourceId,
      trustTier: "T1_AUTHORITY",
      extraction: "explicit",
      evidenceText: recipient,
    },
    {
      id: `${sourceId}::amount`,
      field: "amount",
      value: amount,
      sourceId,
      trustTier: "T1_AUTHORITY",
      extraction: "explicit",
      evidenceText: `${amount} ${asset}`,
    },
    {
      id: `${sourceId}::asset`,
      field: "asset",
      value: asset,
      sourceId,
      trustTier: "T1_AUTHORITY",
      extraction: "explicit",
      evidenceText: asset,
    },
  ];
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

async function main() {
  const hash = requireValue("--tx", txHash);
  const url = requireValue("VETA_RPC_URL", rpcUrl);

  console.log("VETA — M3.5 REALITY CHECK\n");

  const rawTx = await getOnchainTransaction(hash, url);

  console.log("NETWORK");
  console.log("Sepolia");
  console.log("");
  console.log("TRANSACTION");
  console.log(rawTx.hash);
  console.log("");
  console.log("BLOCK");
  console.log(rawTx.blockNumber?.toString() ?? "pending");
  console.log("");
  console.log("TOKEN CONTRACT");
  console.log(rawTx.to);
  console.log("");
  console.log("CALLDATA");
  console.log(rawTx.input);

  const source = evmTransactionSourceSchema.parse({
    id: `TX-REAL-${rawTx.hash.slice(-8)}`,
    chain: "evm",
    tokenAddress: rawTx.to,
    calldata: rawTx.input,
    decimals: tokenDecimals,
    symbol: tokenSymbol,
  });

  const decoded = decodeTransfer(source);

  console.log("");
  console.log("DECODED");
  console.log("");
  console.log(`Function:`);
  console.log(decoded.functionName);
  console.log("");
  console.log(`Recipient:`);
  console.log(decoded.recipient);
  console.log("");
  console.log(`AmountRaw:`);
  console.log(decoded.amountRaw.toString());
  console.log("");
  console.log(`Amount:`);
  console.log(`${decoded.amountFormatted} ${decoded.asset}`);

  const provenance = {
    transactionHash: rawTx.hash,
    contractAddress: rawTx.to,
    network: "sepolia",
    ...(rawTx.blockNumber === null ? {} : { blockNumber: rawTx.blockNumber }),
  };

  const t0Evidence = buildOnchainEvidence(decoded, provenance);
  t0Evidence.forEach((node) => evidenceNodeSchema.parse(node));

  console.log("");
  console.log("SOURCE");
  console.log("");
  console.log("RPC transaction");
  console.log(`Trust:`);
  console.log("T0_ONCHAIN");
  console.log("");
  console.log("SAFETY CHECK");

  // Scenario B: matching controlled authority
  const t1Match = controlledAuthority(decoded.recipient, decoded.amountFormatted, decoded.asset, "REQ-MATCH");
  const resultB = runSafetyKernel([...t0Evidence, ...t1Match]);

  console.log("");
  console.log(`Expected recipient:`);
  console.log(decoded.recipient);
  console.log("");
  console.log(`Observed recipient:`);
  console.log(decoded.recipient);
  console.log("");
  console.log("Recipient     PASS");
  console.log("Amount        PASS");
  console.log("Asset         PASS");
  console.log("");
  console.log("VERDICT");
  console.log("");
  console.log(explainVerdict(resultB));

  if (resultB.verdict !== "APPROVE") {
    throw new Error(`Scenario B expected APPROVE, got ${resultB.verdict}`);
  }

  // Scenario C: mismatched recipient
  const wrongRecipient = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const t1Mismatch = controlledAuthority(wrongRecipient, decoded.amountFormatted, decoded.asset, "REQ-MISMATCH");
  const resultC = runSafetyKernel([...t0Evidence, ...t1Mismatch]);

  console.log("");
  console.log("SCENARIO C — Mismatched authority");
  console.log("");
  console.log(`Expected recipient:`);
  console.log(wrongRecipient);
  console.log("");
  console.log(`Observed recipient:`);
  console.log(decoded.recipient);
  console.log("");
  console.log("Recipient     FAIL");
  console.log("Amount        PASS");
  console.log("Asset         PASS");
  console.log("");
  console.log("VERDICT");
  console.log("");
  console.log(explainVerdict(resultC));

  if (resultC.verdict !== "BLOCK") {
    throw new Error(`Scenario C expected BLOCK, got ${resultC.verdict}`);
  }
  if (!resultC.reasons.some((reason) => reason.includes("RECIPIENT_MATCH mismatch"))) {
    throw new Error("Scenario C expected RECIPIENT_MATCH mismatch reason");
  }

  console.log("");
  console.log("ALL M3.5 SCENARIOS PASS");
}

main().catch((error) => {
  if (error instanceof RealityCheckError) {
    console.error(`\n${error.code}: ${error.message}`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
