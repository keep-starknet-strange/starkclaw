import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Text, View } from "@/components/Themed";
import { listActivity, type ActivityItem } from "@/lib/activity/activity";
import { txExplorerUrl } from "@/lib/starknet/explorer";
import { loadWallet, type WalletSnapshot } from "@/lib/wallet/wallet";

function shorten(hex: string): string {
  if (hex.length <= 18) return hex;
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

function formatTime(sec: number): string {
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}

export default function ActivityScreen() {
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    const list = await listActivity();
    setItems(list);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const w = await loadWallet();
        if (cancelled) return;
        setWallet(w);
        await refresh();
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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "700" }}>Activity</Text>
          <Pressable disabled={busy} onPress={refresh}>
            <Text style={{ fontWeight: "700" }}>Refresh</Text>
          </Pressable>
        </View>

        {error ? (
          <Text selectable style={{ color: "#ff3b30" }}>
            {error}
          </Text>
        ) : null}

        {items.length === 0 ? (
          <Text style={{ opacity: 0.7 }}>
            No activity yet. Deploy, register a session key, then execute a transfer.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((it) => (
              <View
                key={it.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.10)",
                  backgroundColor: "rgba(0,0,0,0.02)",
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: "700" }}>{it.summary}</Text>
                <Text style={{ fontSize: 12, opacity: 0.7 }}>
                  {formatTime(it.createdAt)} | {it.kind} | {it.status}
                </Text>
                {it.txHash ? (
                  <Text selectable style={{ fontSize: 12, opacity: 0.7 }}>
                    Tx: {shorten(it.txHash)}
                  </Text>
                ) : null}
                {it.revertReason ? (
                  <Text selectable style={{ fontSize: 12, color: "#ff3b30" }}>
                    {it.revertReason}
                  </Text>
                ) : null}

                {wallet && it.txHash ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => WebBrowser.openBrowserAsync(txExplorerUrl(wallet.networkId, it.txHash!))}
                    style={{
                      marginTop: 4,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.12)",
                      backgroundColor: "rgba(0,0,0,0.03)",
                    }}
                  >
                    <Text style={{ textAlign: "center", fontWeight: "700" }}>Open Explorer</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {busy ? <ActivityIndicator /> : null}
      </View>
    </ScrollView>
  );
}

