import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput } from "react-native";

import { Text, View } from "@/components/Themed";
import { appendActivity } from "@/lib/activity/activity";
import { requireOwnerAuth } from "@/lib/security/owner-auth";
import {
  createLocalSessionKey,
  emergencyRevokeAllOnchain,
  isSessionKeyValidOnchain,
  listSessionKeys,
  registerSessionKeyOnchain,
  revokeSessionKeyOnchain,
  type StoredSessionKey,
} from "@/lib/policy/session-keys";
import { formatUnits } from "@/lib/starknet/balances";
import { isContractDeployed } from "@/lib/starknet/rpc";
import { TOKENS, type StarknetTokenSymbol } from "@/lib/starknet/tokens";
import { parseUnits } from "@/lib/starknet/units";
import { loadOwnerPrivateKey, loadWallet, type WalletSnapshot } from "@/lib/wallet/wallet";

type KeyValidity = boolean | null;

function shorten(hex: string): string {
  if (hex.length <= 18) return hex;
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

function tokenBySymbol(sym: StarknetTokenSymbol) {
  const t = TOKENS.find((x) => x.symbol === sym);
  if (!t) throw new Error(`Unknown token: ${sym}`);
  return t;
}

export default function PoliciesScreen() {
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const [deployed, setDeployed] = React.useState<boolean | null>(null);
  const [keys, setKeys] = React.useState<StoredSessionKey[]>([]);
  const [validity, setValidity] = React.useState<Record<string, KeyValidity>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [tokenSymbol, setTokenSymbol] = React.useState<StarknetTokenSymbol>("USDC");
  const [capInput, setCapInput] = React.useState("10");
  const [hoursInput, setHoursInput] = React.useState("24");

  const refresh = React.useCallback(async (w: WalletSnapshot) => {
    setError(null);
    const isDeployed = await isContractDeployed(w.rpcUrl, w.accountAddress);
    setDeployed(isDeployed);

    const list = await listSessionKeys();
    setKeys(list);

    const map: Record<string, KeyValidity> = {};
    for (const k of list) {
      try {
        map[k.key] = await isSessionKeyValidOnchain({
          rpcUrl: w.rpcUrl,
          accountAddress: w.accountAddress,
          sessionPublicKey: k.key,
        });
      } catch {
        map[k.key] = null;
      }
    }
    setValidity(map);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const w = await loadWallet();
        if (cancelled) return;
        setWallet(w);
        if (w) await refresh(w);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const onCreate = React.useCallback(async () => {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      const token = tokenBySymbol(tokenSymbol);
      const tokenAddress = token.addressByNetwork[wallet.networkId];
      const spendingLimit = parseUnits(capInput, token.decimals);
      const hours = Number(hoursInput);
      if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid expiry hours");

      const session = await createLocalSessionKey({
        tokenSymbol: token.symbol,
        tokenAddress,
        spendingLimit,
        validForSeconds: Math.floor(hours * 3600),
        allowedContract: tokenAddress,
      });

      await requireOwnerAuth({ reason: "Register session key policy" });
      const ownerPrivateKey = await loadOwnerPrivateKey();
      if (!ownerPrivateKey) throw new Error("Missing owner key");

      const { txHash } = await registerSessionKeyOnchain({ wallet, ownerPrivateKey, session });
      await appendActivity({
        networkId: wallet.networkId,
        kind: "register_session_key",
        summary: `Register session key (${session.tokenSymbol})`,
        txHash,
        status: "succeeded",
      });
      await refresh(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [wallet, tokenSymbol, capInput, hoursInput, refresh]);

  const onRevoke = React.useCallback(
    async (sessionPublicKey: string) => {
      if (!wallet) return;
      setBusy(true);
      setError(null);
      try {
        await requireOwnerAuth({ reason: "Revoke session key" });
        const ownerPrivateKey = await loadOwnerPrivateKey();
        if (!ownerPrivateKey) throw new Error("Missing owner key");
        const { txHash } = await revokeSessionKeyOnchain({ wallet, ownerPrivateKey, sessionPublicKey });
        await appendActivity({
          networkId: wallet.networkId,
          kind: "revoke_session_key",
          summary: `Revoke session key (${shorten(sessionPublicKey)})`,
          txHash,
          status: "succeeded",
        });
        await refresh(wallet);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setBusy(false);
      }
    },
    [wallet, refresh]
  );

  const onEmergencyRevoke = React.useCallback(async () => {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      await requireOwnerAuth({ reason: "Emergency revoke all session keys" });
      const ownerPrivateKey = await loadOwnerPrivateKey();
      if (!ownerPrivateKey) throw new Error("Missing owner key");
      const { txHash } = await emergencyRevokeAllOnchain({ wallet, ownerPrivateKey });
      await appendActivity({
        networkId: wallet.networkId,
        kind: "emergency_revoke_all",
        summary: "Emergency revoke all session keys",
        txHash,
        status: "succeeded",
      });
      await refresh(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [wallet, refresh]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <View style={{ padding: 20, gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "700" }}>Policies</Text>
          <Text style={{ opacity: 0.7 }}>
            Session keys sign transactions with on-chain enforced caps and allow rules.
          </Text>
        </View>

        {error ? (
          <Text selectable style={{ color: "#ff3b30" }}>
            {error}
          </Text>
        ) : null}

        {!wallet ? (
          <Text style={{ opacity: 0.7 }}>
            Create a wallet and deploy the account in the Home tab first.
          </Text>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, opacity: 0.7 }}>Account</Text>
              <Text selectable style={{ fontSize: 14 }}>
                {wallet.accountAddress}
              </Text>
              <Text style={{ fontSize: 12, opacity: 0.7 }}>
                {deployed === null ? "Checking deployment…" : deployed ? "Deployed" : "Not deployed"}
              </Text>
            </View>

            {!deployed ? (
              <Text style={{ opacity: 0.7 }}>
                Deploy the account in Home before registering session keys.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: "700" }}>Create Session Key</Text>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, opacity: 0.7 }}>Token</Text>
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    {TOKENS.map((t) => (
                      <Pressable
                        key={t.symbol}
                        disabled={busy}
                        onPress={() => setTokenSymbol(t.symbol)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor:
                            tokenSymbol === t.symbol ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.12)",
                          backgroundColor:
                            tokenSymbol === t.symbol ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)",
                        }}
                      >
                        <Text style={{ fontWeight: "600" }}>{t.symbol}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, opacity: 0.7 }}>Spend Cap (per 24h)</Text>
                  <TextInput
                    value={capInput}
                    onChangeText={setCapInput}
                    placeholder="10"
                    keyboardType="decimal-pad"
                    editable={!busy}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.12)",
                      backgroundColor: "rgba(0,0,0,0.02)",
                    }}
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, opacity: 0.7 }}>Expiry (hours)</Text>
                  <TextInput
                    value={hoursInput}
                    onChangeText={setHoursInput}
                    placeholder="24"
                    keyboardType="number-pad"
                    editable={!busy}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.12)",
                      backgroundColor: "rgba(0,0,0,0.02)",
                    }}
                  />
                </View>

                <Pressable
                  disabled={busy}
                  onPress={onCreate}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: "#111",
                  }}
                >
                  <Text style={{ textAlign: "center", fontWeight: "700", color: "white" }}>
                    Create + Register
                  </Text>
                </Pressable>

                <Pressable
                  disabled={busy || keys.length === 0}
                  onPress={onEmergencyRevoke}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(255,59,48,0.35)",
                    backgroundColor: "rgba(255,59,48,0.08)",
                  }}
                >
                  <Text style={{ textAlign: "center", fontWeight: "700", color: "#ff3b30" }}>
                    Emergency Revoke All
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "700" }}>Session Keys</Text>
                <Pressable disabled={busy || !wallet} onPress={() => wallet && refresh(wallet)}>
                  <Text style={{ fontWeight: "700" }}>Refresh</Text>
                </Pressable>
              </View>

              {keys.length === 0 ? (
                <Text style={{ opacity: 0.7 }}>No session keys yet.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {keys.map((k) => {
                    const token = TOKENS.find((t) => t.symbol === (k.tokenSymbol as StarknetTokenSymbol));
                    const decimals = token?.decimals ?? 18;
                    const cap = formatUnits(BigInt(k.spendingLimit), decimals);
                    const status = validity[k.key];
                    const statusText =
                      status === null ? "Unknown" : status ? "Valid" : "Invalid";

                    return (
                      <View
                        key={k.key}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "rgba(0,0,0,0.10)",
                          backgroundColor: "rgba(0,0,0,0.02)",
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontWeight: "700" }}>{shorten(k.key)}</Text>
                        <Text style={{ opacity: 0.7 }}>
                          Cap: {cap} {k.tokenSymbol} | Expires:{" "}
                          {new Date(k.validUntil * 1000).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 12, opacity: 0.7 }}>
                          On-chain: {statusText}
                          {k.revokedAt ? ` | Revoked` : ""}
                        </Text>
                        {k.lastTxHash ? (
                          <Text selectable style={{ fontSize: 12, opacity: 0.7 }}>
                            Last tx: {shorten(k.lastTxHash)}
                          </Text>
                        ) : null}

                        <Pressable
                          disabled={busy || !!k.revokedAt}
                          onPress={() => onRevoke(k.key)}
                          style={{
                            marginTop: 4,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "rgba(255,59,48,0.35)",
                            backgroundColor: "rgba(255,59,48,0.08)",
                          }}
                        >
                          <Text style={{ textAlign: "center", fontWeight: "700", color: "#ff3b30" }}>
                            Revoke
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {busy ? <ActivityIndicator /> : null}
      </View>
    </ScrollView>
  );
}
