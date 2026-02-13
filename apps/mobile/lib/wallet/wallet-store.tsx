/**
 * WalletProvider — React context for wallet lifecycle.
 *
 * On mount: attempts to load an existing wallet from SecureStore.
 * Exposes create / reset / the current WalletSnapshot.
 */

import * as React from "react";

import {
  createWallet,
  loadWallet,
  resetWallet,
  type WalletSnapshot,
} from "./wallet";
import type { StarknetNetworkId } from "../starknet/networks";

type WalletStatus = "loading" | "none" | "ready";

type WalletContextValue = {
  status: WalletStatus;
  wallet: WalletSnapshot | null;
  create: (networkId?: StarknetNetworkId) => Promise<WalletSnapshot>;
  reset: () => Promise<void>;
};

const WalletContext = React.createContext<WalletContextValue | null>(null);

export function WalletProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<WalletStatus>("loading");
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await loadWallet();
      if (cancelled) return;
      if (snap) {
        setWallet(snap);
        setStatus("ready");
      } else {
        setStatus("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const create = React.useCallback(
    async (networkId: StarknetNetworkId = "sepolia") => {
      const snap = await createWallet(networkId);
      setWallet(snap);
      setStatus("ready");
      return snap;
    },
    [],
  );

  const reset = React.useCallback(async () => {
    await resetWallet();
    setWallet(null);
    setStatus("none");
  }, []);

  const value = React.useMemo<WalletContextValue>(
    () => ({ status, wallet, create, reset }),
    [status, wallet, create, reset],
  );

  return (
    <WalletContext.Provider value={value}>
      {props.children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = React.useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider />");
  return ctx;
}
