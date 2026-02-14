import * as Crypto from "expo-crypto";
import { ec, hash } from "starknet";

import { SESSION_ACCOUNT_CLASS_HASH } from "../starknet/contracts";
import { STARKNET_NETWORKS, type StarknetNetworkId } from "../starknet/networks";
import { secureDelete, secureGet, secureSet } from "../storage/secure-store";

const OWNER_PRIVATE_KEY_ID = "starkclaw.owner_pk.v1";
const NETWORK_ID = "starkclaw.network_id.v1";
const DEPLOY_TX_HASH_ID = "starkclaw.deploy_tx_hash.v1";

export type WalletSnapshot = {
  networkId: StarknetNetworkId;
  rpcUrl: string;
  chainIdHex: string;
  ownerPublicKey: string;
  accountAddress: string;
};

export async function loadOwnerPrivateKey(): Promise<string | null> {
  return secureGet(OWNER_PRIVATE_KEY_ID);
}

export async function loadDeployTxHash(): Promise<string | null> {
  return secureGet(DEPLOY_TX_HASH_ID);
}

export async function saveDeployTxHash(txHash: string): Promise<void> {
  await secureSet(DEPLOY_TX_HASH_ID, txHash);
}

function normalizePrivateKey(bytes: Uint8Array): string {
  const scalar = ec.starkCurve.utils.normPrivateKeyToScalar(bytes);
  return `0x${scalar.toString(16).padStart(64, "0")}`;
}

function computeAccountAddress(ownerPublicKey: string): string {
  const salt = ownerPublicKey;
  const constructorCalldata = [ownerPublicKey, "0x0"];
  return hash.calculateContractAddressFromHash(
    salt,
    SESSION_ACCOUNT_CLASS_HASH,
    constructorCalldata,
    0
  );
}

export async function loadWallet(): Promise<WalletSnapshot | null> {
  const pk = await secureGet(OWNER_PRIVATE_KEY_ID);
  if (!pk) return null;

  const networkId = ((await secureGet(NETWORK_ID)) ?? "sepolia") as StarknetNetworkId;
  const network = STARKNET_NETWORKS[networkId] ?? STARKNET_NETWORKS.sepolia;

  const ownerPublicKey = ec.starkCurve.getStarkKey(pk);
  const accountAddress = computeAccountAddress(ownerPublicKey);

  return {
    networkId: network.id,
    rpcUrl: network.rpcUrl,
    chainIdHex: network.chainIdHex,
    ownerPublicKey,
    accountAddress,
  };
}

export async function createWallet(
  networkId: StarknetNetworkId = "sepolia"
): Promise<WalletSnapshot> {
  const network = STARKNET_NETWORKS[networkId];

  const bytes = await Crypto.getRandomBytesAsync(32);
  const pk = normalizePrivateKey(bytes);

  await secureSet(OWNER_PRIVATE_KEY_ID, pk);
  await secureSet(NETWORK_ID, networkId);

  const ownerPublicKey = ec.starkCurve.getStarkKey(pk);
  const accountAddress = computeAccountAddress(ownerPublicKey);

  return {
    networkId,
    rpcUrl: network.rpcUrl,
    chainIdHex: network.chainIdHex,
    ownerPublicKey,
    accountAddress,
  };
}

export async function resetWallet(): Promise<void> {
  await secureDelete(OWNER_PRIVATE_KEY_ID);
  await secureDelete(NETWORK_ID);
  await secureDelete(DEPLOY_TX_HASH_ID);
}
