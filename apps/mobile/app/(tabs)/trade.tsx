import * as React from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { useApp } from "@/lib/app/app-provider";
import { loadWallet, type WalletSnapshot } from "@/lib/wallet/wallet";
import { useSwap } from "@/lib/defi/use-swap";
import { TOKENS } from "@/lib/starknet/tokens";
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

function shortenHex(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (s.length <= 18) return s;
  if (!s.startsWith("0x")) return s.slice(0, 16) + "…";
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

/**
 * Parse amount text to base units (BigInt) without IEEE-754 precision loss.
 * Validates: non-empty, non-negative, at most maxDecimals fractional digits.
 */
function parseAmountToBigInt(amountText: string, decimals: number): bigint | null {
  const trimmed = amountText.trim();
  if (!trimmed) return null;
  
  // Check for valid number format
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  if (trimmed === ".") return null;
  
  const parts = trimmed.split(".");
  const integerPart = parts[0] || "0";
  const fractionalPart = parts[1] || "";
  
  // Check fractional digits limit
  if (fractionalPart.length > decimals) return null;
  
  // Pad fractional part to required decimals
  const paddedFraction = fractionalPart.padEnd(decimals, "0");
  
  // Combine and convert to BigInt (remove leading zeros)
  const combined = integerPart + paddedFraction;
  const trimmedCombined = combined.replace(/^0+/, "") || "0";
  
  return BigInt(trimmedCombined);
}

export default function TradeScreen() {
  const t = useAppTheme();
  const { state, actions, mode } = useApp();
  const isLive = mode === "live";

  // Live mode: load wallet and swap hook
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const [inFlightAction, setInFlightAction] = React.useState<"quote" | "confirm" | null>(null);
  const swap = useSwap(isLive ? wallet : null);

  // Load wallet on mount for live mode with proper cleanup
  React.useEffect(() => {
    if (!isLive) {
      setWallet(null);
      setInFlightAction(null);
      return;
    }

    let mounted = true;
    loadWallet()
      .then((result) => {
        if (mounted) setWallet(result);
      })
      .catch((err) => {
        if (mounted) {
          actions.triggerAlert("Failed to Load Wallet", err?.message ?? "Unknown error", "warn");
        }
      });

    return () => {
      mounted = false;
    };
  }, [isLive, actions]);

  const [from, setFrom] = React.useState<Sym>("STRK");
  const [to, setTo] = React.useState<Sym>("USDC");
  const [amountText, setAmountText] = React.useState("80");
  const [slippageText, setSlippageText] = React.useState("0.50");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const fromAsset = state.portfolio.balances.find((b) => b.symbol === from);
  const toAsset = state.portfolio.balances.find((b) => b.symbol === to);

  // Demo mode calculations
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

  // React to swap state changes (avoids stale closure)
  React.useEffect(() => {
    if (!inFlightAction) return;

    if (inFlightAction === "quote") {
      if (swap.error) {
        actions.triggerAlert("Quote Failed", swap.error, "warn");
        setInFlightAction(null);
      } else if (swap.phase === "preview") {
        setPreviewOpen(true);
        setInFlightAction(null);
      }
    } else if (inFlightAction === "confirm") {
      // Only clear state after swap reaches terminal state
      if (swap.error || swap.phase === "done") {
        setPreviewOpen(false);
        if (swap.error) {
          actions.triggerAlert("Swap Failed", swap.error, "danger");
        } else if (swap.result) {
          actions.triggerAlert(
            "Swap Submitted",
            `TX: ${shortenHex(swap.result.txHash)}`,
            "info"
          );
        }
        setInFlightAction(null);
      }
    }
  }, [inFlightAction, swap.phase, swap.error, swap.result, actions]);

  // Live mode quote handler
  const handlePreview = React.useCallback(async () => {
    // Policy check ALWAYS runs first - before demo/live split
    if (blocked) {
      actions.triggerAlert("Trade blocked", reason ?? "Policy denied this trade preview.", "warn");
      return;
    }

    if (!isLive) {
      // Demo mode - allowed by policy
      setPreviewOpen(true);
      return;
    }

    if (!wallet) {
      actions.triggerAlert("Wallet Not Ready", "Live wallet is still loading. Try again in a moment.", "warn");
      return;
    }

    // Live mode - get real quote
    const sellToken = TOKENS.find((t) => t.symbol === from);
    const buyToken = TOKENS.find((t) => t.symbol === to);
    if (!sellToken || !buyToken) {
      actions.triggerAlert("Invalid Token", "Token not found.", "warn");
      return;
    }

    // Parse amount to base units without IEEE-754 precision loss
    const sellAmount = parseAmountToBigInt(amountText, sellToken.decimals);
    if (sellAmount === null || sellAmount <= 0n) {
      actions.triggerAlert("Invalid Amount", "Enter a valid amount.", "warn");
      return;
    }

    await haptic("tap");
    setInFlightAction("quote");
    await swap.quote({
      sellToken,
      buyToken,
      sellAmount,
      slippage: slippage / 100,
    });
    // State handling done in useEffect
  }, [isLive, wallet, from, to, amountText, slippage, blocked, reason, actions, swap]);

  // Live mode execute handler
  const handleExecute = React.useCallback(async () => {
    // Policy check ALWAYS runs first - before demo/live split
    if (blocked) {
      actions.triggerAlert("Trade blocked", reason ?? "Policy denied this trade.", "warn");
      setPreviewOpen(false);
      return;
    }

    if (!isLive) {
      // Demo mode - allowed by policy
      await haptic("success");
      actions.simulateTrade({ from, to, amount });
      setPreviewOpen(false);
      return;
    }

    if (!wallet) {
      actions.triggerAlert("Wallet Not Ready", "Live wallet is still loading. Try again in a moment.", "warn");
      return;
    }

    // Live mode - execute swap
    setInFlightAction("confirm");
    try {
      await swap.confirm();
    } catch (err) {
      // Handle synchronous errors that bypass the hook's internal error handling.
      // Clear inFlightAction to avoid getting stuck, and let the useEffect
      // handle any error state that was set by the hook.
      setInFlightAction(null);
      const errorMessage = err instanceof Error ? err.message : "Swap failed";
      actions.triggerAlert("Swap Failed", errorMessage, "danger");
    }
    // State handling done in useEffect
  }, [isLive, wallet, from, to, amount, blocked, reason, actions, swap]);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
        <Row>
          <View style={{ gap: 4 }}>
            <Muted>Trade simulator</Muted>
            <H1>Preview a swap</H1>
          </View>
          {isLive && <Badge label="Live" tone="good" />}
        </Row>
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
              label={isLive && wallet ? "Get Quote" : "Preview"}
              disabled={swap.phase === "quoting" || (isLive && !wallet)}
              onPress={handlePreview}
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

                  {/* Show live quote or demo preview */}
                  <View style={{ gap: 6 }}>
                    {isLive && swap.preview ? (
                      // Live mode: show real AVNU quote
                      <>
                        <Body style={{ fontFamily: t.font.bodySemibold, fontSize: 18 }}>
                          {swap.preview.sellAmountFormatted} {swap.preview.sellToken.symbol} →{" "}
                          {swap.preview.buyAmountFormatted} {swap.preview.buyToken.symbol}
                        </Body>
                        <Muted>
                          Min: {swap.preview.minReceivedFormatted} • Slippage {swap.preview.slippagePct.toFixed(2)}% • Gas ~{swap.preview.gasFeeFormatted}
                        </Muted>
                        <Muted>Route: {swap.preview.routeSummary}</Muted>
                      </>
                    ) : (
                      // Demo mode: show mock preview
                      <>
                        <Body style={{ fontFamily: t.font.bodySemibold, fontSize: 18 }}>
                          {amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {from} →{" "}
                          {recvAmount.toLocaleString(undefined, { maximumFractionDigits: to === "USDC" ? 2 : 4 })} {to}
                        </Body>
                        <Muted>
                          Max slippage {slippage.toFixed(2)}% • Fee {formatUsd(feeUsd)} • Within caps
                        </Muted>
                      </>
                    )}
                  </View>

                  <Divider />

                  {/* Bounded approval safety text - always shown in live mode */}
                  {isLive && (
                    <View style={{ 
                      padding: 8, 
                      borderRadius: t.radius.sm, 
                      backgroundColor: "rgba(48,209,88,0.10)",
                      borderWidth: 1,
                      borderColor: "rgba(48,209,88,0.25)"
                    }}>
                      <Muted style={{ fontSize: 12, color: t.colors.good }}>
                        🔒 Approval is bounded to exact sell amount. Never unlimited.
                      </Muted>
                    </View>
                  )}

                  <View style={{ gap: 10 }}>
                    <Row>
                      <Muted>Policy</Muted>
                      <Body style={{ fontFamily: t.font.bodyMedium, color: blocked ? t.colors.warn : t.colors.good }}>
                        {blocked ? "Denied" : "Allowed"}
                      </Body>
                    </Row>
                    <Row>
                      <Muted>Contract trust</Muted>
                      <Muted style={{ textTransform: "capitalize" }}>{state.policy.contractAllowlistMode.replace("-", " ")}</Muted>
                    </Row>
                  </View>

                  <PrimaryButton
                    label={isLive ? (swap.phase === "executing" ? "Swapping..." : "Execute Swap") : "Simulate execution"}
                    disabled={swap.phase === "executing" || (isLive && !wallet)}
                    onPress={handleExecute}
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
