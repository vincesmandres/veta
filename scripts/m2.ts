import { encodeFunctionData } from "viem";
import { erc20Abi } from "../src/web3/erc20-abi";
import { decodeTransfer, evmTransactionSourceSchema, buildOnchainEvidence } from "../src/web3";

const tokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const recipientA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const recipientB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const usdtDecimals = BigInt(6);

function makeTransaction(source: { id: string; recipient: string; amountRaw: bigint; symbol?: string }) {
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [source.recipient as `0x${string}`, source.amountRaw],
  });
  return evmTransactionSourceSchema.parse({
    id: source.id,
    chain: "evm",
    tokenAddress,
    calldata,
    decimals: 6,
    symbol: source.symbol ?? "USDT",
  });
}

const fixtures = [
  {
    label: "Fixture A — valid transfer",
    transaction: makeTransaction({ id: "TX-001", recipient: recipientA, amountRaw: BigInt(1250) * (BigInt(10) ** usdtDecimals) }),
  },
  {
    label: "Fixture B — different recipient",
    transaction: makeTransaction({ id: "TX-002", recipient: recipientB, amountRaw: BigInt(1250) * (BigInt(10) ** usdtDecimals) }),
  },
  {
    label: "Fixture C — different amount",
    transaction: makeTransaction({ id: "TX-003", recipient: recipientA, amountRaw: BigInt(12500) * (BigInt(10) ** usdtDecimals) }),
  },
];

console.log("VETA - M2 EVM REALITY\n");

for (const fixture of fixtures) {
  console.log(`${fixture.label}`);
  console.log(`Transaction\n${fixture.transaction.id}\n`);
  console.log(`Function\ntransfer(address,uint256)\n`);
  console.log(`Raw calldata\n${fixture.transaction.calldata}\n`);

  const decoded = decodeTransfer(fixture.transaction);
  const evidence = buildOnchainEvidence(decoded);

  console.log(`Decoded recipient\n${decoded.recipient}`);
  console.log(`Decoded amountRaw\n${decoded.amountRaw.toString()}`);
  console.log(`Decoded amount\n${decoded.amountFormatted} ${decoded.asset}\n`);

  console.log("Evidence");
  for (const node of evidence) {
    console.log(`${node.field}\ntrust: ${node.trustTier}\n`);
  }
  console.log("VALIDATION: PASS\n");
}

console.log("Invalid input checks\n");

try {
  decodeTransfer(evmTransactionSourceSchema.parse({
    id: "TX-BAD-1",
    chain: "evm",
    tokenAddress,
    calldata: "0x1234",
    decimals: 6,
    symbol: "USDT",
  }));
  console.log("MALFORMED: FAIL");
} catch (error) {
  console.log(`MALFORMED: ${error instanceof Error ? error.message : "unknown error"}`);
}

try {
  decodeTransfer(evmTransactionSourceSchema.parse({
    id: "TX-BAD-2",
    chain: "evm",
    tokenAddress,
    calldata: "0x095ea7b3000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000000000000000000000000000000000000000000000000000002710",
    decimals: 6,
    symbol: "USDT",
  }));
  console.log("UNSUPPORTED: FAIL");
} catch (error) {
  console.log(`UNSUPPORTED: ${error instanceof Error ? error.message : "unknown error"}`);
}
