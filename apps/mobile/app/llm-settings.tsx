import * as React from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { secureDelete, secureGet, secureSet } from "@/lib/storage/secure-store";
import { GhostButton, IconButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Chip } from "@/ui/chip";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

// Storage keys — must match lib/agent-runtime/provider-store.ts
const KEY_PROVIDER_CONFIG = "starkclaw.provider_config.v1";
const KEY_API_KEY = "starkclaw.llm_api_key.v1";

type ProviderOption = { id: string; name: string };
const PROVIDERS: ProviderOption[] = [{ id: "openai", name: "OpenAI" }];

export default function LlmSettingsScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [providerId, setProviderId] = React.useState("openai");
  const [modelId, setModelId] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Load persisted config on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [configRaw, keyRaw] = await Promise.all([
        secureGet(KEY_PROVIDER_CONFIG),
        secureGet(KEY_API_KEY),
      ]);
      if (cancelled) return;

      if (configRaw) {
        try {
          const parsed = JSON.parse(configRaw);
          if (parsed.providerId) setProviderId(parsed.providerId);
          if (parsed.modelId) setModelId(parsed.modelId);
        } catch {
          // Ignore parse errors.
        }
      }
      if (keyRaw) setApiKey(keyRaw);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = React.useCallback(async () => {
    await haptic("tap");
    await Promise.all([
      secureSet(KEY_PROVIDER_CONFIG, JSON.stringify({ providerId, modelId })),
      apiKey.trim()
        ? secureSet(KEY_API_KEY, apiKey.trim())
        : secureDelete(KEY_API_KEY),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [providerId, modelId, apiKey]);

  const onClearKey = React.useCallback(async () => {
    await haptic("warn");
    setApiKey("");
    await secureDelete(KEY_API_KEY);
  }, []);

  if (loading) return null;

  return (
    <AppScreen>
      <Row>
        <View style={{ gap: 4 }}>
          <Muted>Agent runtime</Muted>
          <H1>LLM Settings</H1>
        </View>
        <IconButton
          onPress={async () => {
            await haptic("tap");
            router.back();
          }}
          icon={<AppIcon ios="xmark" fa="times" color={t.colors.text} size={18} />}
        />
      </Row>

      <GlassCard>
        <View style={{ gap: 12 }}>
          <H2>Provider</H2>
          <Muted>Select your LLM provider. Bring your own API key.</Muted>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {PROVIDERS.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={providerId === p.id}
                tone="accent"
                onPress={async () => {
                  await haptic("tap");
                  setProviderId(p.id);
                }}
              />
            ))}
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: 12 }}>
          <H2>Model</H2>
          <Muted>Optional. Leave blank for provider default.</Muted>
          <TextInput
            value={modelId}
            onChangeText={setModelId}
            placeholder="e.g. gpt-4o-mini"
            placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
            autoCapitalize="none"
            autoCorrect={false}
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
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: 12 }}>
          <Row>
            <H2>API Key</H2>
            <Chip
              label={showKey ? "Hide" : "Show"}
              onPress={async () => {
                await haptic("tap");
                setShowKey((v) => !v);
              }}
            />
          </Row>
          <Muted>Stored securely on-device. Never logged, exported, or sent to our servers.</Muted>
          <TextInput
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-..."
            placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
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
          {apiKey ? (
            <GhostButton label="Clear key" onPress={onClearKey} />
          ) : null}
        </View>
      </GlassCard>

      <PrimaryButton
        label={saved ? "Saved" : "Save settings"}
        onPress={onSave}
        disabled={saved}
      />

      <GlassCard>
        <View style={{ gap: 8 }}>
          <H2>Security</H2>
          <View style={{ gap: 4 }}>
            <Body style={{ fontFamily: t.font.bodyMedium }}>On-device only</Body>
            <Muted>Your API key is encrypted in the device keychain via SecureStore. It is never included in audit exports, logs, or error reports.</Muted>
          </View>
        </View>
      </GlassCard>
    </AppScreen>
  );
}
