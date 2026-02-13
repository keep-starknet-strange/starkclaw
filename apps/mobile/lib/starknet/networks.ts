export type StarknetNetworkId = "sepolia" | "mainnet";

export type StarknetNetworkConfig = {
  id: StarknetNetworkId;
  name: string;
  rpcUrl: string;
  /** Additional RPC endpoints to try when the primary fails. */
  rpcFallbackUrls: string[];
  chainIdHex: string;
};

// Public RPC endpoints (no API key required).
export const STARKNET_NETWORKS: Record<StarknetNetworkId, StarknetNetworkConfig> =
  {
    sepolia: {
      id: "sepolia",
      name: "Sepolia",
      rpcUrl: "https://starknet-sepolia-rpc.publicnode.com",
      rpcFallbackUrls: [
        "https://free-rpc.nethermind.io/sepolia-juno/",
      ],
      chainIdHex: "0x534e5f5345504f4c4941", // SN_SEPOLIA
    },
    mainnet: {
      id: "mainnet",
      name: "Mainnet",
      rpcUrl: "https://starknet-rpc.publicnode.com",
      rpcFallbackUrls: [
        "https://free-rpc.nethermind.io/mainnet-juno/",
      ],
      chainIdHex: "0x534e5f4d41494e", // SN_MAIN
    },
  };

/**
 * Returns all RPC URLs for a network: primary first, then fallbacks.
 */
export function getAllRpcUrls(networkId: StarknetNetworkId): string[] {
  const net = STARKNET_NETWORKS[networkId];
  return [net.rpcUrl, ...net.rpcFallbackUrls];
}
