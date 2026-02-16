import * as React from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useApp } from "@/lib/app/app-provider";
import { requireOwnerAuth } from "@/lib/security/owner-auth";
import { loadWallet, type WalletSnapshot } from "@/lib/wallet/wallet";
import { useSessionKeys } from "@/lib/policy/use-session-keys";
import {
  TARGET_PRESETS,
  MAX_ALLOWED_TARGETS,
  labelForAddress,
  type TargetPresetId,
} from "@/lib/policy/target-presets";
import { TOKENS } from "@/lib/starknet/tokens";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Badge } from "@/ui/badge";
import { Chip } from "@/ui/chip";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { formatUsd } from "@/ui/format";
import { Body, H1, H2, Muted } from "@/ui/typography";

/**
 * Validates a Starknet contract address.
 * Must be 0x-prefixed hex string with 40 hex chars (42 total).
 */
function isValidStarknetAddress(addr: string): boolean {
  const trimmed = addr.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
}

/** Convert string to number with fallback */
function toNumberOr(n: string, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/** Format hex address for display (e.g., 0x1234...abcd) */
function shortenHex(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (s.length <= 18) return s;
  if (!s.startsWith("0x")) return s.slice(0, 16) + "…";
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

/** Get token decimals for a given symbol */
function getTokenDecimals(symbol: string): number {
  const token = TOKENS.find(t => t.symbol === symbol);
  return token?.decimals ?? 18;
}

/** Format token amount (without USD prefix) */
function formatTokenAmount(amount: number, symbol: string): string {
  const decimals = getTokenDecimals(symbol);
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals <= 6 ? 2 : 4,
  });
  return `${formatted} ${symbol}`;
}

/** Parse decimal string to BigInt (e.g., "1.5" -> 1500000000000000000n for 18 decimals) */
function parseDecimalToBigInt(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  
  // Validate format: at most one dot, only digits
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return 0n;
  }
  
  try {
    const parts = trimmed.split(".");
    const integerPart = parts[0] || "0";
    const fractionalPart = parts[1] || "";
    
    // Validate parts contain only digits
    if (!/^\d+$/.test(integerPart) || (fractionalPart && !/^\d+$/.test(fractionalPart))) {
      return 0n;
    }
    
    // Pad fractional part to required decimals
    const paddedFraction = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
    
    return BigInt(integerPart) * 10n ** BigInt(decimals) + BigInt(paddedFraction);
  } catch {
    return 0n;
  }
}

export default function PoliciesScreen() {
  const t = useAppTheme();
  const { state, actions, mode } = useApp();
  const isLive = mode === "live";

  const [dailyText, setDailyText] = React.useState(String(state.policy.dailySpendCapUsd));
  const [perTxText, setPerTxText] = React.useState(String(state.policy.perTxCapUsd));
  const [newRecipient, setNewRecipient] = React.useState("");

  // Live mode: load wallet and session keys
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const sessionKeysResult = useSessionKeys(isLive ? wallet : null);

  // Load wallet on mount for live mode
  React.useEffect(() => {
    if (isLive) {
      loadWallet().then(setWallet);
    }
  }, [isLive]);

  // ── Create Session Key state ──
  const [showCreateKey, setShowCreateKey] = React.useState(false);
  const [newKeyToken, setNewKeyToken] = React.useState("ETH");
  const [newKeySpendLimit, setNewKeySpendLimit] = React.useState("100");
  const [newKeyExpiry, setNewKeyExpiry] = React.useState("86400"); // 24 hours in seconds

  // ── Allowed Apps state ──
  // Initialize from persisted policy state, default to transfers (wildcard)
  const [selectedPreset, setSelectedPreset] = React.useState<TargetPresetId>(
    state.policy.allowedTargetsPreset || "transfers"
  );
  const [customTargets, setCustomTargets] = React.useState<string[]>(
    state.policy.allowedTargetsPreset === "custom" ? state.policy.allowedTargets : []
  );
  const [newTarget, setNewTarget] = React.useState("");

  const resolvedTargets = React.useMemo(() => {
    if (selectedPreset === "custom") return customTargets;
    const preset = TARGET_PRESETS.find((p) => p.id === selectedPreset);
    if (!preset) return [];
    const network = state.account.environment === "mainnet" ? "mainnet" : "sepolia";
    return preset.resolve(network as "mainnet" | "sepolia");
  }, [selectedPreset, customTargets, state.account.environment]);

  const onAddCustomTarget = React.useCallback(async () => {
    await haptic("tap");
    const trimmed = newTarget.trim();
    if (!trimmed) return;
    
    // Validate address format
    if (!isValidStarknetAddress(trimmed)) {
      actions.triggerAlert(
        "Invalid Address",
        "Please enter a valid Starknet address (0x + 40 hex characters).",
        "warn"
      );
      return;
    }
    
    if (customTargets.length >= MAX_ALLOWED_TARGETS) return;
    if (customTargets.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
    setCustomTargets((prev) => [...prev, trimmed]);
    setNewTarget("");
  }, [newTarget, customTargets, actions]);

  const onRemoveCustomTarget = React.useCallback(async (addr: string) => {
    await haptic("warn");
    setCustomTargets((prev) => prev.filter((a) => a !== addr));
  }, []);

  const onSaveCaps = React.useCallback(async () => {
    await haptic("tap");
    actions.updateSpendCaps(
      toNumberOr(dailyText, state.policy.dailySpendCapUsd),
      toNumberOr(perTxText, state.policy.perTxCapUsd)
    );
  }, [actions, dailyText, perTxText, state.policy.dailySpendCapUsd, state.policy.perTxCapUsd]);

  const onAddRecipient = React.useCallback(async () => {
    await haptic("tap");
    const trimmed = newRecipient.trim();
    if (!trimmed) return;
    actions.addAllowlistedRecipient(trimmed);
    setNewRecipient("");
  }, [actions, newRecipient]);

  /** Create session key and register it on-chain */
  const onCreateSessionKey = React.useCallback(async () => {
    if (!wallet) {
      actions.triggerAlert("No Wallet", "Please create a wallet first in live mode.", "warn");
      return;
    }

    await haptic("tap");
    
    const token = TOKENS.find(t => t.symbol === newKeyToken);
    if (!token) {
      actions.triggerAlert("Invalid Token", "Please select a valid token.", "warn");
      return;
    }

    const spendLimit = parseDecimalToBigInt(newKeySpendLimit, token.decimals);
    if (spendLimit <= 0n) {
      actions.triggerAlert("Invalid Limit", "Please enter a valid positive amount.", "warn");
      return;
    }
    
    const expirySeconds = Number(newKeyExpiry);
    if (!Number.isInteger(expirySeconds) || expirySeconds <= 0) {
      actions.triggerAlert("Invalid Expiry", "Please enter a valid expiry in seconds.", "warn");
      return;
    }
    
    const targets = resolvedTargets;

    const result = await sessionKeysResult.create({
      tokenSymbol: newKeyToken,
      tokenAddress: token.addressByNetwork[wallet.networkId],
      spendingLimit: spendLimit,
      validForSeconds: expirySeconds,
      allowedContracts: targets,
    });

    if (result) {
      actions.triggerAlert(
        "Session Key Created",
        `Key created. TX: ${shortenHex(result.txHash)}`,
        "info"
      );
      setShowCreateKey(false);
    } else {
      actions.triggerAlert(
        "Session Key Failed",
        sessionKeysResult.error || "Failed to create session key.",
        "danger"
      );
    }
  }, [wallet, newKeyToken, newKeySpendLimit, newKeyExpiry, resolvedTargets, sessionKeysResult, actions]);

  /** Revoke a single session key on-chain */
  const onRevokeKey = React.useCallback(async (publicKey: string) => {
    if (!wallet) return;
    
    await haptic("warn");
    
    const result = await sessionKeysResult.revoke(publicKey);
    
    if (result) {
      actions.triggerAlert(
        "Session Key Revoked",
        `Key revoked. TX: ${shortenHex(result.txHash)}`,
        "info"
      );
    } else {
      actions.triggerAlert(
        "Revoke Failed",
        sessionKeysResult.error || "Failed to revoke session key.",
        "danger"
      );
    }
  }, [wallet, sessionKeysResult, actions]);

  /** Emergency revoke all session keys - requires owner authentication */
  const onEmergencyRevokeAll = React.useCallback(async () => {
    if (!wallet) return;
    
    try {
      await requireOwnerAuth({ reason: "Emergency revoke all session keys" });
    } catch {
      actions.triggerAlert("Auth Failed", "Owner authentication required.", "warn");
      return;
    }

    await haptic("warn");
    
    const result = await sessionKeysResult.revokeAll();
    
    if (result) {
      actions.triggerAlert(
        "Emergency Revoke",
        `All keys revoked. TX: ${shortenHex(result.txHash)}`,
        "danger"
      );
    } else {
      actions.triggerAlert(
        "Emergency Revoke Failed",
        sessionKeysResult.error || "Failed to revoke all keys.",
        "danger"
      );
    }
  }, [wallet, sessionKeysResult, actions]);

  /** Save allowed targets configuration (preset selection) */
  const onSaveConfiguration = React.useCallback(async () => {
    await haptic("tap");
    actions.setAllowedTargets(resolvedTargets, selectedPreset);
    const targetCount = resolvedTargets.length;
    const presetName = TARGET_PRESETS.find(p => p.id === selectedPreset)?.label ?? "Custom";
    actions.triggerAlert(
      "Configuration Saved",
      `Default targets set to "${presetName}" (${targetCount === 0 ? "any contract" : `${targetCount} contract(s)`})`,
      "info"
    );
  }, [actions, resolvedTargets, selectedPreset]);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
        <Row>
          <View>
            <Muted>Policies</Muted>
            <H1>Define the boundaries</H1>
          </View>
          {isLive && <Badge label="Live" tone="good" />}
        </Row>
      </Animated.View>

      {/* Live Mode: Session Keys Card */}
      {isLive && (
        <Animated.View entering={FadeInDown.delay(40).duration(420)}>
          <GlassCard>
            <View style={{ gap: 12 }}>
              <Row>
                <H2>Session Keys</H2>
                <Muted>{sessionKeysResult.keys.filter(k => !k.revokedAt).length} active</Muted>
              </Row>

              {/* Session Keys List */}
              {sessionKeysResult.keys.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {sessionKeysResult.keys.map((key) => (
                    <View key={key.key} style={{ 
                      padding: 10, 
                      borderRadius: t.radius.md,
                      backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                      opacity: key.revokedAt ? 0.5 : 1,
                    }}>
                      <Row>
                        <View style={{ gap: 2 }}>
                          <Body style={{ fontFamily: t.font.bodyMedium, fontSize: 13 }}>
                            {key.tokenSymbol} • {key.revokedAt ? "(Revoked)" : formatTokenAmount(Number(key.spendingLimit) / (10 ** getTokenDecimals(key.tokenSymbol)), key.tokenSymbol)}
                          </Body>
                          <Muted style={{ fontSize: 11 }}>
                            {shortenHex(key.key)} • {key.onchainValid === null ? "Checking..." : key.onchainValid ? "Valid" : "Invalid"}
                          </Muted>
                        </View>
                        <Pressable
                          onPress={() => onRevokeKey(key.key)}
                          disabled={!!key.revokedAt || sessionKeysResult.status === "revoking"}
                          style={({ pressed }) => ({
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: key.revokedAt ? "rgba(128,128,128,0.30)" : "rgba(255,69,58,0.30)",
                            backgroundColor: key.revokedAt ? "rgba(128,128,128,0.10)" : "rgba(255,69,58,0.10)",
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Body style={{ fontFamily: t.font.bodyMedium, fontSize: 12, color: key.revokedAt ? t.colors.muted : t.colors.bad }}>
                            {key.revokedAt ? "Revoked" : "Revoke"}
                          </Body>
                        </Pressable>
                      </Row>
                    </View>
                  ))}
                </View>
              ) : (
                <Muted>No session keys. Create one to allow agent actions.</Muted>
              )}

              {/* Create New Key Button */}
              {!showCreateKey ? (
                <PrimaryButton
                  label="Create Session Key"
                  onPress={() => setShowCreateKey(true)}
                />
              ) : (
                <View style={{ gap: 10 }}>
                  <Muted>New Session Key:</Muted>
                  
                  {/* Token selector */}
                  <View style={{ gap: 4 }}>
                    <Muted style={{ fontSize: 12 }}>Token</Muted>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {TOKENS.map(token => (
                        <Chip
                          key={token.symbol}
                          label={token.symbol}
                          selected={newKeyToken === token.symbol}
                          onPress={() => setNewKeyToken(token.symbol)}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Spend limit */}
                  <TextInput
                    value={newKeySpendLimit}
                    onChangeText={setNewKeySpendLimit}
                    keyboardType="decimal-pad"
                    placeholder="Spend limit (token amount)"
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: t.radius.md,
                      borderWidth: 1,
                      borderColor: t.colors.glassBorder,
                      backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                      color: t.colors.text,
                      fontFamily: t.font.body,
                    }}
                  />

                  {/* Expiry */}
                  <TextInput
                    value={newKeyExpiry}
                    onChangeText={setNewKeyExpiry}
                    keyboardType="number-pad"
                    placeholder="Expiry (seconds)"
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: t.radius.md,
                      borderWidth: 1,
                      borderColor: t.colors.glassBorder,
                      backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                      color: t.colors.text,
                      fontFamily: t.font.body,
                    }}
                  />
                  <Muted style={{ fontSize: 11 }}>86400 = 24 hours</Muted>

                  <Row style={{ gap: 10 }}>
                    <PrimaryButton
                      label="Create"
                      onPress={onCreateSessionKey}
                      disabled={sessionKeysResult.status === "creating"}
                    />
                    <GhostButton
                      label="Cancel"
                      onPress={() => setShowCreateKey(false)}
                    />
                  </Row>
                </View>
              )}

              {/* Emergency Revoke All */}
              {sessionKeysResult.keys.length > 0 && (
                <Pressable
                  onPress={onEmergencyRevokeAll}
                  disabled={sessionKeysResult.status === "emergency"}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: t.radius.md,
                    borderWidth: 1,
                    borderColor: "rgba(255,69,58,0.40)",
                    backgroundColor: "rgba(255,69,58,0.10)",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.bad, textAlign: "center" }}>
                    🚨 Emergency Revoke All
                  </Body>
                </Pressable>
              )}
            </View>
          </GlassCard>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(80).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Spend caps</H2>
              <Muted>{formatUsd(state.policy.dailySpendCapUsd)}/day</Muted>
            </Row>

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Daily</Muted>
                <Muted>$ / day</Muted>
              </Row>
              <TextInput
                value={dailyText}
                onChangeText={setDailyText}
                keyboardType="decimal-pad"
                placeholder="250"
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
              <QuickChips values={[100, 250, 500, 1000]} onPick={(v) => setDailyText(String(v))} />
            </View>

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Per transaction</Muted>
                <Muted>$ / tx</Muted>
              </Row>
              <TextInput
                value={perTxText}
                onChangeText={setPerTxText}
                keyboardType="decimal-pad"
                placeholder="75"
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
              <QuickChips values={[25, 50, 75, 150]} onPick={(v) => setPerTxText(String(v))} />
            </View>

            <Row style={{ gap: 10 }}>
              <PrimaryButton label="Save caps" onPress={onSaveCaps} style={{ flex: 1 }} />
              <GhostButton
                label="Reset"
                onPress={async () => {
                  await haptic("warn");
                  setDailyText(String(state.policy.dailySpendCapUsd));
                  setPerTxText(String(state.policy.perTxCapUsd));
                }}
                style={{ flex: 1 }}
              />
            </Row>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Recipients</H2>
              <Muted>{state.policy.allowlistedRecipients.length} allowlisted</Muted>
            </Row>

            <View style={{ gap: 10 }}>
              <TextInput
                value={newRecipient}
                onChangeText={setNewRecipient}
                placeholder="Add allowlisted address (mock)"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                autoCapitalize="none"
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                  color: t.colors.text,
                  fontFamily: t.font.body,
                  fontSize: 15,
                }}
              />
              <PrimaryButton label="Add recipient" onPress={onAddRecipient} disabled={!newRecipient.trim()} />
            </View>

            <View style={{ gap: 10 }}>
              {state.policy.allowlistedRecipients.map((r) => (
                <Row key={r}>
                  <Body selectable style={{ fontFamily: t.font.mono, color: t.colors.muted }}>
                    {r}
                  </Body>
                  <Pressable
                    onPress={async () => {
                      await haptic("warn");
                      actions.removeAllowlistedRecipient(r);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "rgba(255,69,58,0.30)",
                      backgroundColor: "rgba(255,69,58,0.10)",
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.bad }}>Remove</Body>
                  </Pressable>
                </Row>
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Contracts</H2>
              <Muted style={{ textTransform: "capitalize" }}>{state.policy.contractAllowlistMode.replace("-", " ")}</Muted>
            </Row>
            <Segment
              value={state.policy.contractAllowlistMode}
              onChange={(v) => actions.setContractMode(v)}
              items={[
                { id: "trusted-only", label: "Trusted-only", caption: "Block unknown contracts." },
                { id: "warn", label: "Warn", caption: "Allow, but alert first." },
                { id: "open", label: "Open", caption: "Fast, higher risk." },
              ]}
            />
          </View>
        </GlassCard>
      </Animated.View>

      {/* Allowed Apps Card - Session Key Multi-Target Presets */}
      <Animated.View entering={FadeInDown.delay(200).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Allowed Apps</H2>
              <Muted>
                {resolvedTargets.length === 0
                  ? "Any contract"
                  : `${resolvedTargets.length} contract${resolvedTargets.length === 1 ? "" : "s"}`}
              </Muted>
            </Row>

            {/* Preset Selector */}
            <View style={{ gap: 8 }}>
              {TARGET_PRESETS.map((preset) => {
                const selected = selectedPreset === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={async () => {
                      await haptic("tap");
                      setSelectedPreset(preset.id);
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <LinearGradient
                      colors={
                        selected
                          ? t.scheme === "dark"
                            ? ["rgba(90,169,255,0.38)", "rgba(106,228,215,0.26)"]
                            : ["rgba(36,87,255,0.28)", "rgba(14,142,166,0.18)"]
                          : t.scheme === "dark"
                            ? ["rgba(255,255,255,0.20)", "rgba(255,255,255,0.08)"]
                            : ["rgba(255,255,255,0.92)", "rgba(8,18,32,0.10)"]
                      }
                      start={{ x: 0.1, y: 0.0 }}
                      end={{ x: 0.9, y: 1 }}
                      style={{ borderRadius: t.radius.lg, borderCurve: "continuous", padding: 1 }}
                    >
                      <View
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: t.radius.lg - 1,
                          borderCurve: "continuous",
                          borderWidth: 1,
                          borderColor: t.colors.glassBorder,
                          backgroundColor: selected
                            ? t.scheme === "dark"
                              ? "rgba(90,169,255,0.12)"
                              : "rgba(36,87,255,0.10)"
                            : t.scheme === "dark"
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(255,255,255,0.60)",
                        }}
                      >
                        <Row>
                          <Body style={{ fontFamily: t.font.bodyMedium }}>{preset.label}</Body>
                          {selected ? (
                            <AppIcon ios="checkmark.circle.fill" fa="check-circle" color={t.colors.text} size={18} />
                          ) : null}
                        </Row>
                        <Muted>{preset.description}</Muted>
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Targets - only show when Custom is selected */}
            {selectedPreset === "custom" && (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={newTarget}
                  onChangeText={setNewTarget}
                  placeholder="Add contract address (0x...)"
                  placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                  autoCapitalize="none"
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: t.radius.md,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: t.colors.glassBorder,
                    backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                    color: t.colors.text,
                    fontFamily: t.font.mono,
                    fontSize: 14,
                  }}
                />
                <PrimaryButton
                  label="Add Target"
                  onPress={onAddCustomTarget}
                  disabled={!newTarget.trim() || customTargets.length >= MAX_ALLOWED_TARGETS}
                />
                <Muted>{customTargets.length}/{MAX_ALLOWED_TARGETS} slots used</Muted>

                {/* Custom targets list */}
                <View style={{ gap: 8 }}>
                  {customTargets.map((addr) => (
                    <Row key={addr}>
                      <Body selectable style={{ fontFamily: t.font.mono, fontSize: 13 }} numberOfLines={1}>
                        {addr}
                      </Body>
                      <Pressable
                        onPress={async () => {
                          await haptic("warn");
                          onRemoveCustomTarget(addr);
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: "rgba(255,69,58,0.30)",
                          backgroundColor: "rgba(255,69,58,0.10)",
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Body style={{ fontFamily: t.font.bodyMedium, fontSize: 12, color: t.colors.bad }}>
                          Remove
                        </Body>
                      </Pressable>
                    </Row>
                  ))}
                </View>
              </View>
            )}

            {/* Resolved targets preview - show for non-custom presets */}
            {selectedPreset !== "custom" && resolvedTargets.length > 0 && (
              <View style={{ gap: 6 }}>
                <Muted>Allowed contracts:</Muted>
                {resolvedTargets.map((addr, idx) => {
                  const network = state.account.environment === "mainnet" ? "mainnet" : "sepolia";
                  const label = labelForAddress(addr, network);
                  return (
                    <Row key={idx}>
                      <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.accent }}>{label}</Body>
                      <Body selectable style={{ fontFamily: t.font.mono, fontSize: 11, color: t.colors.muted }}>
                        {addr.slice(0, 10)}…{addr.slice(-6)}
                      </Body>
                    </Row>
                  );
                })}
              </View>
            )}

            {/* Save button - saves the selected preset for session key creation */}
            <Row style={{ gap: 10, marginTop: 8 }}>
              <PrimaryButton
                label="Save Configuration"
                onPress={onSaveConfiguration}
                style={{ flex: 1 }}
              />
            </Row>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Emergency lockdown</H2>
              <Switch
                value={state.policy.emergencyLockdown}
                onValueChange={async (v) => {
                  try {
                    await requireOwnerAuth({ reason: "Toggle emergency lockdown" });
                  } catch (e) {
                    await haptic("warn");
                    actions.triggerAlert(
                      "Lockdown not changed",
                      e instanceof Error ? e.message : "Owner confirmation failed.",
                      "warn"
                    );
                    return;
                  }
                  await haptic("warn");
                  actions.setEmergencyLockdown(v);
                }}
                trackColor={{ false: t.scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(11,18,32,0.16)", true: "rgba(255,69,58,0.55)" }}
                thumbColor="#FFFFFF"
              />
            </Row>
            <Muted>
              When enabled, Starkclaw will block all agent actions, even if they would normally be allowed.
            </Muted>
          </View>
        </GlassCard>
      </Animated.View>
    </AppScreen>
  );
}

function QuickChips(props: { values: number[]; onPick: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {props.values.map((v) => (
        <Chip
          key={v}
          label={`$${v}`}
          onPress={async () => {
            await haptic("tap");
            props.onPick(v);
          }}
        />
      ))}
    </View>
  );
}

function Segment<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; caption: string }[];
}) {
  const t = useAppTheme();
  return (
    <View style={{ gap: 10 }}>
      {props.items.map((it) => {
        const selected = it.id === props.value;
        const borderA = selected
          ? t.scheme === "dark"
            ? "rgba(90,169,255,0.38)"
            : "rgba(36,87,255,0.28)"
          : t.scheme === "dark"
            ? "rgba(255,255,255,0.20)"
            : "rgba(255,255,255,0.92)";
        const borderB = selected
          ? t.scheme === "dark"
            ? "rgba(106,228,215,0.26)"
            : "rgba(14,142,166,0.18)"
          : t.scheme === "dark"
            ? "rgba(255,255,255,0.08)"
            : "rgba(8,18,32,0.10)";
        const fill = selected
          ? t.scheme === "dark"
            ? "rgba(90,169,255,0.12)"
            : "rgba(36,87,255,0.10)"
          : t.scheme === "dark"
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.60)";

        return (
          <Pressable
            key={it.id}
            onPress={async () => {
              await haptic("tap");
              props.onChange(it.id);
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <LinearGradient
              colors={[borderA, borderB]}
              start={{ x: 0.1, y: 0.0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ borderRadius: t.radius.lg, borderCurve: "continuous", padding: 1 }}
            >
              <View
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.lg - 1,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: fill,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Row>
                    <Body style={{ fontFamily: t.font.bodyMedium }}>{it.label}</Body>
                    {selected ? <AppIcon ios="checkmark.circle.fill" fa="check-circle" color={t.colors.text} size={18} /> : null}
                  </Row>
                  <Muted>{it.caption}</Muted>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}
