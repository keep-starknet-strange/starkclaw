# Starkclaw Mobile App

This is the Expo (React Native) app that showcases Starkclaw’s end-to-end UX.

Right now it is **UI-only** and **fully mocked** (no RPC calls, no wallets, no contract interaction). The goal is to demo:

- Premium onboarding (agent setup + “account creation”)
- Trading preview + confirmations + policy checks (mocked)
- Policy editor (caps, allowlists, contract trust, emergency lockdown)
- Alerts + inbox + activity timeline
- Agent proposals (approve/reject) with clear context

The product story lives in the repo root `README.md`. This file is for people hacking on the app.

## Stack

- Expo SDK 54 + Expo Router
- TypeScript
- UI: `expo-blur`, `expo-linear-gradient`, `expo-image`, `expo-haptics`
- Fonts: `@expo-google-fonts/instrument-sans`, `@expo-google-fonts/playwrite-nz-basic`
- Demo persistence: `expo-secure-store`
- Router typed routes: generated via `scripts/generate-typed-routes.cjs` (runs before `npm run typecheck`)

## Run

From repo root:

```bash
./scripts/app/dev
```

Or from this folder:

```bash
npm ci
npm run dev
```

## Checks

From repo root:

```bash
./scripts/check
```

Or from this folder:

```bash
npm run lint
npm run typecheck
```

## App Tour (Where To Look)

Onboarding:

- `app/(onboarding)/welcome.tsx`
- `app/(onboarding)/profile.tsx`
- `app/(onboarding)/limits.tsx`
- `app/(onboarding)/alerts.tsx`
- `app/(onboarding)/ready.tsx`

Tabs:

- Home: `app/(tabs)/index.tsx`
- Trade: `app/(tabs)/trade.tsx`
- Agent: `app/(tabs)/agent.tsx`
- Policies: `app/(tabs)/policies.tsx`
- Inbox: `app/(tabs)/inbox.tsx`

Demo state (mocked):

- Store + actions: `lib/demo/demo-store.tsx`
- Fixtures + types: `lib/demo/demo-state.ts`

UI system:

- Theme tokens: `ui/app-theme.ts`
- Background: `ui/app-background.tsx`
- Glass surfaces: `ui/glass-card.tsx`
- Buttons: `ui/buttons.tsx`
- Typography: `ui/typography.tsx`

## Security Notes

- This app currently runs in **demo mode** (mocked state).
- Do not put private keys or real secrets in issues/screenshots/logs.
