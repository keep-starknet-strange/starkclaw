import * as React from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { useDemo } from "@/lib/demo/demo-store";
import { GhostButton, IconButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Badge } from "@/ui/badge";
import { Chip } from "@/ui/chip";
import { Divider } from "@/ui/divider";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { formatUsd } from "@/ui/format";
import { Body, H1, H2, Muted } from "@/ui/typography";

type Sym = "ETH" | "USDC" | "STRK";

function toNumberOr(n: string, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default function TradeScreen() {
  const t = useAppTheme();
  const { state, actions } = useDemo();

  const [from, setFrom] = React.useState<Sym>("STRK");
  const [to, setTo] = React.useState<Sym>("USDC");
  const [amountText, setAmountText] = React.useState("80");
  const [slippageText, setSlippageText] = React.useState("0.50");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const fromAsset = state.portfolio.balances.find((b) => b.symbol === from);
  const toAsset = state.portfolio.balances.find((b) => b.symbol === to);

  const amount = clamp(toNumberOr(amountText, 0), 0, 1_000_000);
  const slippage = clamp(toNumberOr(slippageText, 0.5), 0, 5);
  const fromUsd = (fromAsset?.usdPrice ?? 0) * amount;
  const feeUsd = fromUsd * 0.0025;
  const recvUsd = Math.max(0, fromUsd - feeUsd);
  const recvAmount = (toAsset?.usdPrice ?? 1) > 0 ? recvUsd / (toAsset?.usdPrice ?? 1) : 0;

  const perTxCap = state.policy.perTxCapUsd;
  const blocked =
    state.policy.emergencyLockdown || from === to || !fromAsset || !toAsset || amount <= 0 || fromUsd > perTxCap;

  const reason = state.policy.emergencyLockdown
    ? "Emergency lockdown is enabled."
    : from === to
      ? "Pick two different assets."
      : !fromAsset || !toAsset
        ? "Missing asset data."
        : amount <= 0
          ? "Enter an amount."
          : fromUsd > perTxCap
            ? `Exceeds per-tx cap (${formatUsd(perTxCap)}).`
            : null;

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
        <Muted>Trade simulator</Muted>
        <H1>Preview a swap</H1>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(420)}>
        <GlassCard>
          <View style={{ gap: 14 }}>
            <Row>
              <H2>Swap</H2>
              <Badge label={blocked ? "Policy check" : "Allowed"} tone={blocked ? "warn" : "good"} />
            </Row>

            <View style={{ gap: 10 }}>
              <TokenRow label="From" value={from} onPick={setFrom} disabled={false} />
              <TokenRow label="To" value={to} onPick={setTo} disabled={false} />
            </View>

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Amount</Muted>
                <Muted>{fromAsset ? `${formatUsd(fromAsset.usdPrice)} / ${fromAsset.symbol}` : ""}</Muted>
              </Row>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                  color: t.colors.text,
                  fontFamily: t.font.bodyMedium,
                  fontSize: 18,
                  fontVariant: ["tabular-nums"],
                }}
              />
            </View>

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Max slippage</Muted>
                <Muted>%</Muted>
              </Row>
              <TextInput
                value={slippageText}
                onChangeText={setSlippageText}
                keyboardType="decimal-pad"
                placeholder="0.50"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                  color: t.colors.text,
                  fontFamily: t.font.bodyMedium,
                  fontSize: 18,
                  fontVariant: ["tabular-nums"],
                }}
              />
            </View>

            <Divider />

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Estimated receive</Muted>
                <Body style={{ fontFamily: t.font.bodyMedium, fontVariant: ["tabular-nums"] }}>
                  {recvAmount.toLocaleString(undefined, { maximumFractionDigits: to === "USDC" ? 2 : 4 })} {to}
                </Body>
              </Row>
              <Row>
                <Muted>Fee (mock)</Muted>
                <Muted style={{ fontVariant: ["tabular-nums"] }}>{formatUsd(feeUsd)}</Muted>
              </Row>
              <Row>
                <Muted>Per-tx cap</Muted>
                <Muted style={{ fontVariant: ["tabular-nums"] }}>{formatUsd(perTxCap)}</Muted>
              </Row>
              {reason ? <Muted style={{ color: t.colors.warn }}>{reason}</Muted> : null}
            </View>

            <PrimaryButton
              label="Preview"
              onPress={async () => {
                await haptic("tap");
                if (blocked) {
                  actions.triggerAlert("Trade blocked", reason ?? "Policy denied this trade preview.", "warn");
                  return;
                }
                setPreviewOpen(true);
              }}
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <Pressable
          onPress={() => setPreviewOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end", padding: 18 }}
        >
          <Pressable onPress={() => {}} style={{}}>
            <Animated.View entering={FadeInUp.duration(260)}>
              <GlassCard padding={16} intensity={t.scheme === "dark" ? 18 : 60}>
                <View style={{ gap: 12 }}>
                  <Row>
                    <H2>Trade preview</H2>
                    <IconButton
                      onPress={async () => {
                        await haptic("tap");
                        setPreviewOpen(false);
                      }}
                      size="sm"
                      icon={<AppIcon ios="xmark" fa="times" color={t.colors.text} size={18} />}
                    />
                  </Row>

                  <View style={{ gap: 6 }}>
                    <Body style={{ fontFamily: t.font.bodySemibold, fontSize: 18 }}>
                      {amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {from} →{" "}
                      {recvAmount.toLocaleString(undefined, { maximumFractionDigits: to === "USDC" ? 2 : 4 })} {to}
                    </Body>
                    <Muted>
                      Max slippage {slippage.toFixed(2)}% • Fee {formatUsd(feeUsd)} • Within caps
                    </Muted>
                  </View>

                  <Divider />

                  <View style={{ gap: 10 }}>
                    <Row>
                      <Muted>Policy</Muted>
                      <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.good }}>Allowed</Body>
                    </Row>
                    <Row>
                      <Muted>Contract trust</Muted>
                      <Muted style={{ textTransform: "capitalize" }}>{state.policy.contractAllowlistMode.replace("-", " ")}</Muted>
                    </Row>
                  </View>

                  <PrimaryButton
                    label="Simulate execution"
                    onPress={async () => {
                      await haptic("success");
                      actions.simulateTrade({ from, to, amount });
                      setPreviewOpen(false);
                    }}
                  />
                  <GhostButton
                    label="Cancel"
                    onPress={async () => {
                      await haptic("tap");
                      setPreviewOpen(false);
                    }}
                  />
                </View>
              </GlassCard>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

function TokenRow(props: { label: string; value: Sym; onPick: (s: Sym) => void; disabled: boolean }) {
  const tokens: Sym[] = ["ETH", "USDC", "STRK"];
  return (
    <View style={{ gap: 8 }}>
      <Row>
        <Muted>{props.label}</Muted>
        <Muted>Asset</Muted>
      </Row>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tokens.map((s) => {
          const selected = s === props.value;
          return (
            <Chip
              key={s}
              label={s}
              selected={selected}
              tone="accent"
              onPress={
                props.disabled
                  ? undefined
                  : async () => {
                      await haptic("tap");
                      props.onPick(s);
                    }
              }
            />
          );
        })}
      </View>
    </View>
  );
}
