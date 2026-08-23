import { createPublicClient, http, type PublicClientConfig } from "viem";
import { sepolia } from "viem/chains";

export type VetaChain = typeof sepolia;

export function createViemPublicClient(rpcUrl: string, chain: VetaChain = sepolia) {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  } as PublicClientConfig);
}

export type VetaPublicClient = ReturnType<typeof createViemPublicClient>;
