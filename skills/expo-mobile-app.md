---
name: expo-mobile-app
triggers: ["Expo", "Expo Router", "React Native", "UI", "screen", "onboarding", "chat", "glass"]
---

# Expo Mobile App (Starkclaw)

<purpose>
Build a premium-feeling Expo app that makes safety rails legible: policies are visible, confirmations are explicit, and failures are explained clearly.
</purpose>

<prerequisites>
- Follow the product requirements in `spec.md`.
- Use general UI/networking skill packs in `.codex/skills/` and `.claude/skills/` when applicable (don't duplicate them here).
</prerequisites>

<procedure>
1. Implement screens in the MVP order from `spec.md` (onboarding -> home -> chat -> policies -> activity).
2. Treat every on-chain action as a lifecycle:
   intent -> preflight (simulate/estimate) -> preview -> execute -> track.
3. Make owner-gated actions require explicit confirmation and biometric auth.
4. Persist: wallet metadata, policy metadata, activity log, chat history (no secrets).
</procedure>

<patterns>
<do>
- Always show a deterministic transaction preview card before execution.
- Make "Emergency revoke all" reachable within 2 taps from the main UI.
- Keep network calls behind a thin client with timeouts/retries and typed errors.
</do>
<dont>
- Don't put private keys, seed phrases, or raw secrets into component state, logs, or error toasts.
- Don't create UI that implies safety without actual on-chain enforcement.
</dont>
</patterns>
