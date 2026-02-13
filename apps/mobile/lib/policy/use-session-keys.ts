/**
 * use-session-keys — React hook for session key lifecycle management.
 *
 * Surfaces local session keys, on-chain validity, and mutation actions
 * (create, revoke, emergency revoke-all). All mutations gate on owner auth
 * via session-key-actions.ts.
 */

import * as React from "react";

import type { WalletSnapshot } from "../wallet/wallet";
import {
  listSessionKeys,
  isSessionKeyValidOnchain,
  type StoredSessionKey,
} from "./session-keys";
import {
  createAndRegisterSessionKey,
  revokeSessionKey,
  emergencyRevokeAll,
} from "./session-key-actions";

export type SessionKeyEntry = StoredSessionKey & {
  /** On-chain validity (null = not yet checked). */
  onchainValid: boolean | null;
};

export type SessionKeysStatus =
  | "loading"
  | "ready"
  | "creating"
  | "revoking"
  | "emergency"
  | "error";

export type SessionKeysResult = {
  status: SessionKeysStatus;
  keys: SessionKeyEntry[];
  error: string | null;

  /** Reload the local key list + on-chain status. */
  refresh: () => void;

  /** Create a new session key and register it on-chain. */
  create: (params: {
    tokenSymbol: string;
    tokenAddress: string;
    spendingLimit: bigint;
    validForSeconds: number;
    allowedContract: string;
  }) => Promise<{ txHash: string } | null>;

  /** Revoke a single session key on-chain. */
  revoke: (sessionPublicKey: string) => Promise<{ txHash: string } | null>;

  /** Emergency revoke all session keys on-chain. */
  revokeAll: () => Promise<{ txHash: string } | null>;
};

export function useSessionKeys(
  wallet: WalletSnapshot | null,
): SessionKeysResult {
  const [status, setStatus] = React.useState<SessionKeysStatus>("loading");
  const [keys, setKeys] = React.useState<SessionKeyEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++loadRef.current;
    try {
      const local = await listSessionKeys();

      const entries: SessionKeyEntry[] = local.map((k) => ({
        ...k,
        onchainValid: null,
      }));

      if (id !== loadRef.current) return;
      setKeys(entries);
      setStatus("ready");
      setError(null);

      // Check on-chain validity in background for non-revoked keys.
      if (!wallet) return;

      const active = entries.filter((k) => !k.revokedAt && k.registeredAt);
      const results = await Promise.allSettled(
        active.map((k) =>
          isSessionKeyValidOnchain({
            rpcUrl: wallet.rpcUrl,
            accountAddress: wallet.accountAddress,
            sessionPublicKey: k.key,
          }),
        ),
      );

      if (id !== loadRef.current) return;

      setKeys((prev) => {
        const updated = [...prev];
        for (let i = 0; i < active.length; i++) {
          const r = results[i];
          const idx = updated.findIndex((k) => k.key === active[i].key);
          if (idx >= 0 && r.status === "fulfilled") {
            updated[idx] = { ...updated[idx], onchainValid: r.value };
          }
        }
        return updated;
      });
    } catch (e) {
      if (id !== loadRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load session keys");
      setStatus("error");
    }
  }, [wallet]);

  React.useEffect(() => {
    load();
  }, [load]);

  const create = React.useCallback(
    async (params: {
      tokenSymbol: string;
      tokenAddress: string;
      spendingLimit: bigint;
      validForSeconds: number;
      allowedContract: string;
    }): Promise<{ txHash: string } | null> => {
      if (!wallet) return null;
      setStatus("creating");
      setError(null);
      try {
        const { txHash } = await createAndRegisterSessionKey({
          wallet,
          ...params,
        });
        await load();
        return { txHash };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Create failed";
        setError(msg);
        setStatus("error");
        return null;
      }
    },
    [wallet, load],
  );

  const revoke = React.useCallback(
    async (
      sessionPublicKey: string,
    ): Promise<{ txHash: string } | null> => {
      if (!wallet) return null;
      setStatus("revoking");
      setError(null);
      try {
        const { txHash } = await revokeSessionKey({
          wallet,
          sessionPublicKey,
        });
        await load();
        return { txHash };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Revoke failed";
        setError(msg);
        setStatus("error");
        return null;
      }
    },
    [wallet, load],
  );

  const revokeAllFn = React.useCallback(async (): Promise<{
    txHash: string;
  } | null> => {
    if (!wallet) return null;
    setStatus("emergency");
    setError(null);
    try {
      const { txHash } = await emergencyRevokeAll({ wallet });
      await load();
      return { txHash };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Emergency revoke failed";
      setError(msg);
      setStatus("error");
      return null;
    }
  }, [wallet, load]);

  return {
    status,
    keys,
    error,
    refresh: load,
    create,
    revoke,
    revokeAll: revokeAllFn,
  };
}
