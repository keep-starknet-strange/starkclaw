import type { StarknetNetworkId } from "./networks";

export function txExplorerUrl(networkId: StarknetNetworkId, txHash: string): string {
  const clean = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  if (networkId === "sepolia") return `https://sepolia.starkscan.co/tx/${clean}`;
  return `https://starkscan.co/tx/${clean}`;
}

export function addressExplorerUrl(networkId: StarknetNetworkId, address: string): string {
  const clean = address.startsWith("0x") ? address : `0x${address}`;
  if (networkId === "sepolia") return `https://sepolia.starkscan.co/contract/${clean}`;
  return `https://starkscan.co/contract/${clean}`;
}

