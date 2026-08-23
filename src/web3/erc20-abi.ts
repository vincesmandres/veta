import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
  "function transfer(address, uint256)",
]);

export const transferFunctionSignature = "0xa9059cbb";
