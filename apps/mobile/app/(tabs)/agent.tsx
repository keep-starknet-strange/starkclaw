import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput } from "react-native";

import { Text, View } from "@/components/Themed";
import { appendActivity } from "@/lib/activity/activity";
import { executeTransfer, prepareTransferFromText, type TransferAction } from "@/lib/agent/transfer";
import { formatUnits } from "@/lib/starknet/balances";
import { isContractDeployed } from "@/lib/starknet/rpc";
import { TOKENS } from "@/lib/starknet/tokens";
import { loadWallet, type WalletSnapshot } from "@/lib/wallet/wallet";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function shorten(hex: string): string {
  if (hex.length <= 18) return hex;
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

function tokenDecimals(symbol: string): number {
  return TOKENS.find((t) => t.symbol === symbol)?.decimals ?? 18;
}

export default function AgentScreen() {
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const [deployed, setDeployed] = React.useState<boolean | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [pending, setPending] = React.useState<TransferAction | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const w = await loadWallet();
        if (cancelled) return;
        setWallet(w);
        if (!w) return;
        setDeployed(await isContractDeployed(w.rpcUrl, w.accountAddress));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSend = React.useCallback(async () => {
    if (!wallet) return;
    if (!deployed) return;

    const text = draft.trim();
    if (!text) return;

    setDraft("");
    setBusy(true);
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: "user", text }]);

    try {
      const action = await prepareTransferFromText({ wallet, text });
      const dec = tokenDecimals(action.tokenSymbol);
      const cap = formatUnits(BigInt(action.policy.spendingLimitBaseUnits), dec);
      const exp = new Date(action.policy.validUntil * 1000).toLocaleString();

      setPending(action);
      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          text: `Proposed transfer: ${action.amount} ${action.tokenSymbol} to ${shorten(
            action.to
          )}\nPolicy: cap ${cap} ${action.tokenSymbol} (expires ${exp})`,
        },
      ]);
    } catch (e) {
      setPending(null);
      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          text: e instanceof Error ? e.message : "Unknown error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [wallet, deployed, draft]);

  const onExecute = React.useCallback(async () => {
    if (!wallet || !pending) return;

    setBusy(true);
    try {
      const res = await executeTransfer({ wallet, action: pending });
      const status = res.executionStatus ?? "UNKNOWN";
      const isReverted = status.toUpperCase() === "REVERTED";
      await appendActivity({
        networkId: wallet.networkId,
        kind: "transfer",
        summary: `Transfer ${pending.amount} ${pending.tokenSymbol} to ${shorten(pending.to)}`,
        txHash: res.txHash,
        status: isReverted ? "reverted" : "succeeded",
        executionStatus: status,
        revertReason: isReverted ? res.revertReason : null,
      });
      if (status.toUpperCase() === "REVERTED") {
        setMessages((m) => [
          ...m,
          {
            id: `${Date.now()}-r`,
            role: "assistant",
            text: `Denied on-chain.\nReason: ${res.revertReason ?? "Transaction reverted"}\nTx: ${
              res.txHash
            }`,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            id: `${Date.now()}-s`,
            role: "assistant",
            text: `Submitted.\nExecution: ${status}\nTx: ${res.txHash}`,
          },
        ]);
      }
      setPending(null);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-e`,
          role: "assistant",
          text: e instanceof Error ? e.message : "Unknown error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [wallet, pending]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "700" }}>Agent</Text>
          <Text style={{ opacity: 0.7 }}>
            Try: <Text style={{ fontWeight: "700" }}>send 2 USDC to 0xabc...</Text>
          </Text>
        </View>

        {!wallet ? (
          <Text style={{ opacity: 0.7 }}>
            Create a wallet and deploy the account in the Home tab first.
          </Text>
        ) : deployed === false ? (
          <Text style={{ opacity: 0.7 }}>Deploy the account in Home before executing actions.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder='send 2 USDC to 0xabc...'
                autoCapitalize="none"
                editable={!busy}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.12)",
                  backgroundColor: "rgba(0,0,0,0.02)",
                }}
              />
              <Pressable
                disabled={busy || !draft.trim()}
                onPress={onSend}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: "#111",
                }}
              >
                <Text style={{ textAlign: "center", fontWeight: "700", color: "white" }}>
                  Ask Starkclaw
                </Text>
              </Pressable>
            </View>

            {pending ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.10)",
                  backgroundColor: "rgba(0,0,0,0.02)",
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: "700" }}>Preview</Text>
                <Text style={{ opacity: 0.8 }}>
                  {pending.amount} {pending.tokenSymbol} to {shorten(pending.to)}
                </Text>
                <Text style={{ fontSize: 12, opacity: 0.7 }}>
                  Session key: {shorten(pending.sessionPublicKey)}
                </Text>
                <Pressable
                  disabled={busy}
                  onPress={onExecute}
                  style={{
                    marginTop: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: "#111",
                  }}
                >
                  <Text style={{ textAlign: "center", fontWeight: "700", color: "white" }}>
                    Execute
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              {messages.length === 0 ? (
                <Text style={{ opacity: 0.7 }}>
                  No messages yet. Create a session key in Policies before executing transfers.
                </Text>
              ) : (
                messages.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "92%",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor:
                        m.role === "user" ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.04)",
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.08)",
                    }}
                  >
                    <Text selectable style={{ fontSize: 14 }}>
                      {m.text}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {busy ? <ActivityIndicator /> : null}
      </View>
    </ScrollView>
  );
}
