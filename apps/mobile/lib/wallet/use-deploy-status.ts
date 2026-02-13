/**
 * useDeployStatus — tracks deploy lifecycle for the current wallet.
 *
 * States: loading → needs-funding → ready → deploying → deployed
 */

import * as React from "react";

import { isContractDeployed } from "../starknet/rpc";
import { checkDeployReadiness, deployAgentAccount } from "../starknet/deploy";
import { loadDeployTxHash } from "./wallet";
import type { WalletSnapshot } from "./wallet";

export type DeployPhase = "loading" | "needs-funding" | "ready" | "deploying" | "deployed";

type DeployStatusResult = {
  phase: DeployPhase;
  fundingMessage: string | null;
  deployTxHash: string | null;
  error: string | null;
  checkFunding: () => void;
  deploy: () => Promise<void>;
};

export function useDeployStatus(wallet: WalletSnapshot | null): DeployStatusResult {
  const [phase, setPhase] = React.useState<DeployPhase>("loading");
  const [fundingMessage, setFundingMessage] = React.useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const checkFunding = React.useCallback(() => setTick((n) => n + 1), []);

  // Initial check: is account already deployed? If not, check funding.
  React.useEffect(() => {
    if (!wallet) {
      setPhase("loading");
      return;
    }

    let cancelled = false;
    setPhase("loading");
    setError(null);

    (async () => {
      // First check if we have a saved deploy tx hash.
      const savedTxHash = await loadDeployTxHash();
      if (savedTxHash && !cancelled) {
        setDeployTxHash(savedTxHash);
      }

      // Check if already deployed.
      const deployed = await isContractDeployed(wallet.rpcUrl, wallet.accountAddress);
      if (cancelled) return;

      if (deployed) {
        setPhase("deployed");
        return;
      }

      // Check funding.
      const result = await checkDeployReadiness(wallet);
      if (cancelled) return;

      if (result.canDeploy) {
        setPhase("ready");
        setFundingMessage(null);
      } else {
        setPhase("needs-funding");
        setFundingMessage(result.reason);
      }
    })().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Failed to check deploy status.");
      setPhase("needs-funding");
    });

    return () => { cancelled = true; };
  }, [wallet, tick]);

  const deploy = React.useCallback(async () => {
    if (!wallet) return;
    setPhase("deploying");
    setError(null);

    try {
      const txHash = await deployAgentAccount(wallet);
      setDeployTxHash(txHash);
      // After deploy tx is sent, switch to deployed (optimistic).
      // The tx-tracker will poll for finality.
      setPhase("deployed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed.";
      setError(msg);
      setPhase("ready"); // Allow retry.
    }
  }, [wallet]);

  return { phase, fundingMessage, deployTxHash, error, checkFunding, deploy };
}
