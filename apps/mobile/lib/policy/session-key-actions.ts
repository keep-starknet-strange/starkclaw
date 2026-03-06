/**
 * session-key-actions — owner-gated session key management.
 *
 * Wraps on-chain operations with biometric auth + activity logging.
 */

import { requireOwnerAuth } from "../security/owner-auth";
import { appendActivity } from "../activity/activity";
import { loadOwnerPrivateKey } from "../wallet/wallet";
import type { WalletSnapshot } from "../wallet/wallet";
import {
  createLocalSessionKey,
  registerSessionKeyOnchain,
  revokeSessionKeyOnchain,
  emergencyRevokeAllOnchain,
  type StoredSessionKey,
} from "./session-keys";

export async function createAndRegisterSessionKey(params: {
  wallet: WalletSnapshot;
  tokenSymbol: string;
  tokenAddress: string;
  spendingLimit: bigint;
  validForSeconds: number;
  allowedContracts: string[];
}): Promise<{ session: StoredSessionKey; txHash: string }> {
  await requireOwnerAuth({ reason: "Create session key" });

  const pk = await loadOwnerPrivateKey();
  if (!pk) throw new Error("Owner private key not found.");

  // Keep behavior aligned with on-chain registration constraints to avoid
  // creating local session keys that cannot be registered.
  if (params.allowedContracts.length > 0) {
    throw new Error(
      "Contract-level restrictions are not supported by session-account API. " +
      "Only entrypoint selectors are enforced on-chain."
    );
  }
  if (params.spendingLimit !== 0n || params.tokenAddress !== "") {
    throw new Error(
      "Spending policy must be configured with set_spending_policy after session registration. " +
      "Use zero spendingLimit and empty tokenAddress for add_or_update_session_key."
    );
  }

  const session = await createLocalSessionKey({
    tokenSymbol: params.tokenSymbol,
    tokenAddress: params.tokenAddress,
    spendingLimit: params.spendingLimit,
    validForSeconds: params.validForSeconds,
    allowedContracts: params.allowedContracts,
  });

  const { txHash } = await registerSessionKeyOnchain({
    wallet: params.wallet,
    ownerPrivateKey: pk,
    session,
  });

  await appendActivity({
    networkId: params.wallet.networkId,
    kind: "add_or_update_session_key",
    summary: `Register session key for ${params.tokenSymbol} (entrypoint-only policy)`,
    txHash,
    status: "pending",
  });

  return { session, txHash };
}

export async function revokeSessionKey(params: {
  wallet: WalletSnapshot;
  sessionPublicKey: string;
}): Promise<{ txHash: string }> {
  await requireOwnerAuth({ reason: "Revoke session key" });

  const pk = await loadOwnerPrivateKey();
  if (!pk) throw new Error("Owner private key not found.");

  const { txHash } = await revokeSessionKeyOnchain({
    wallet: params.wallet,
    ownerPrivateKey: pk,
    sessionPublicKey: params.sessionPublicKey,
  });

  await appendActivity({
    networkId: params.wallet.networkId,
    kind: "revoke_session_key",
    summary: `Revoke session key ${params.sessionPublicKey.slice(0, 10)}…`,
    txHash,
    status: "pending",
  });

  return { txHash };
}

export async function emergencyRevokeAll(params: {
  wallet: WalletSnapshot;
}): Promise<{ txHash: string }> {
  await requireOwnerAuth({ reason: "Emergency revoke all session keys" });

  const pk = await loadOwnerPrivateKey();
  if (!pk) throw new Error("Owner private key not found.");

  const { txHash } = await emergencyRevokeAllOnchain({
    wallet: params.wallet,
    ownerPrivateKey: pk,
  });

  await appendActivity({
    networkId: params.wallet.networkId,
    kind: "emergency_revoke_all",
    summary: "Emergency revoke all session keys",
    txHash,
    status: "pending",
  });

  return { txHash };
}
