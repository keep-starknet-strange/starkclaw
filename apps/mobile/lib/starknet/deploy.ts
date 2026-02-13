/**
 * deploy — deploys the AgentAccount contract for a wallet.
 *
 * Uses DEPLOY_ACCOUNT_v3 via starknet.js. The address must already
 * have enough ETH/STRK to cover gas (fund-first, deploy-later).
 */

import { Account, hash } from "starknet";

import { AGENT_ACCOUNT_CLASS_HASH } from "./contracts";
import { getErc20Balance } from "./balances";
import { isContractDeployed } from "./rpc";
import { TOKENS } from "./tokens";
import type { StarknetNetworkId } from "./networks";
import type { WalletSnapshot } from "../wallet/wallet";
import { loadOwnerPrivateKey, saveDeployTxHash } from "../wallet/wallet";
import { appendActivity } from "../activity/activity";

export type DeployCheckResult =
  | { canDeploy: false; reason: string }
  | { canDeploy: true };

/**
 * Check whether the account has enough funds and is not yet deployed.
 */
export async function checkDeployReadiness(
  wallet: WalletSnapshot,
): Promise<DeployCheckResult> {
  const deployed = await isContractDeployed(wallet.rpcUrl, wallet.accountAddress);
  if (deployed) {
    return { canDeploy: false, reason: "Account is already deployed." };
  }

  // Check ETH and STRK balance — need at least one for gas.
  const ethToken = TOKENS.find((t) => t.symbol === "ETH")!;
  const strkToken = TOKENS.find((t) => t.symbol === "STRK")!;

  const ethBalance = await getErc20Balance(
    wallet.rpcUrl,
    ethToken.addressByNetwork[wallet.networkId],
    wallet.accountAddress,
  );
  const strkBalance = await getErc20Balance(
    wallet.rpcUrl,
    strkToken.addressByNetwork[wallet.networkId],
    wallet.accountAddress,
  );

  // Require at least 0.001 ETH or 0.1 STRK for deployment gas.
  const hasEth = ethBalance >= 1_000_000_000_000_000n; // 0.001 ETH
  const hasStrk = strkBalance >= 100_000_000_000_000_000n; // 0.1 STRK

  if (!hasEth && !hasStrk) {
    return {
      canDeploy: false,
      reason: "Account needs funding. Send at least 0.001 ETH or 0.1 STRK to the address first.",
    };
  }

  return { canDeploy: true };
}

/**
 * Deploy the AgentAccount contract.
 * Returns the deploy tx hash.
 */
export async function deployAgentAccount(
  wallet: WalletSnapshot,
): Promise<string> {
  const pk = await loadOwnerPrivateKey();
  if (!pk) throw new Error("Owner private key not found in SecureStore.");

  const constructorCalldata = [wallet.ownerPublicKey, "0x0"];

  const account = new Account({
    provider: { nodeUrl: wallet.rpcUrl },
    address: wallet.accountAddress,
    signer: pk,
  });

  const deployResult = await account.deployAccount({
    classHash: AGENT_ACCOUNT_CLASS_HASH,
    constructorCalldata,
    addressSalt: wallet.ownerPublicKey,
  });

  const txHash = deployResult.transaction_hash;
  await saveDeployTxHash(txHash);

  await appendActivity({
    networkId: wallet.networkId,
    kind: "deploy_account",
    summary: `Deploy AgentAccount to ${wallet.accountAddress.slice(0, 10)}…`,
    txHash,
    status: "pending",
  });

  return txHash;
}
