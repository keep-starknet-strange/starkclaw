# Starkclaw Status

Last updated: 2026-02-13

## Current Milestone

M09 (Subset): Audit Export + Hardening

## Completed

**App mode: Demo (UI-only, fully mocked). Live execution building blocks exist but aren't wired to UI yet (see [#2](https://github.com/keep-starknet-strange/starkclaw/issues/2)).**

- Expanded spec written in `spec.md`.
- Implementation plan and milestones written in `IMPLEMENTATION_PLAN.md`.
- M00 bootstrap: Expo app scaffold + Cairo contracts workspace + deterministic scripts + CI.
- M01 baseline safety rails: session-account lineage integration and deterministic contract checks wired into `scripts/contracts/test`.
- M02 wallet libs: deterministic account address + RPC client with retry/fallback (exists in `apps/mobile/lib/starknet/`, not wired to UI).
- M03 deploy libs: funding UX + deploy account transaction flow (exists in `apps/mobile/lib/wallet/`, not wired to UI).
- M04 policy libs: create/register/revoke session keys (exists in `apps/mobile/lib/policy/`, not wired to UI).
- M05 agent libs: transfer planning + execution (exists in `apps/mobile/lib/agent/`, not wired to UI).
- M06 activity libs: session-key transfers + on-chain denial UX + activity logging (exists in `apps/mobile/lib/activity/`, not wired to UI).
- **Premium demo mode UI:** Full onboarding flow + tabs (Home, Trade, Agent, Policies, Inbox) with mocked state (`apps/mobile/lib/demo/`).

## In Progress

- M09 (subset): lightweight audit export (JSON) + error hardening

## Next Up (Priority Order)

1. **P0:** Wire live/demo mode backend abstraction ([#2](https://github.com/keep-starknet-strange/starkclaw/issues/2)) — this unblocks live Starknet execution.
2. **P1:** Add lightweight audit log export (JSON) from Activity ([#17](https://github.com/keep-starknet-strange/starkclaw/issues/17)).
3. **P1:** Add RPC hardening (retry/fallback/user-safe errors) — in review ([#18](https://github.com/keep-starknet-strange/starkclaw/issues/18), PR [#28](https://github.com/keep-starknet-strange/starkclaw/pull/28)).

## How To Verify

### Automated Checks
```bash
./scripts/check        # Runs mobile lint + typecheck + contracts tests
./scripts/app/dev      # Start Expo dev server
./scripts/contracts/test  # Run Cairo contract tests
```

### Demo Mode (Current)
1. Run `./scripts/app/dev`
2. Open app in Expo Go
3. Complete onboarding flow
4. Navigate tabs: Home → Trade → Agent → Policies → Inbox
5. Verify premium UI renders correctly with mocked state

### Live Mode (When Wired, See [#2](https://github.com/keep-starknet-strange/starkclaw/issues/2))

**One-time setup:** Declare canonical session-account class on Sepolia:
```bash
STARKNET_DEPLOYER_ADDRESS=0x... \
STARKNET_DEPLOYER_PRIVATE_KEY=0x... \
./scripts/contracts/declare-session-account
```

**Manual smoke test:**
1. Switch to Live mode in Settings
2. Create wallet
3. Fund address via faucet, refresh until ETH appears
4. Deploy account
5. Create session key policy in Policies tab
6. Execute transfer via Agent tab
7. Denial test: Set low cap, try to exceed it, verify on-chain denial
