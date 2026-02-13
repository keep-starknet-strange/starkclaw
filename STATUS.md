# Starkclaw Status

Last updated: 2026-02-13

## Current Milestone

M03: Deploy Starkclaw Account From Mobile

## Completed

- Expanded spec written in `spec.md`.
- Implementation plan and milestones written in `IMPLEMENTATION_PLAN.md`.
- Original draft preserved in `spec.draft.md`.
- M00 bootstrap: Expo app scaffold + Cairo sanity package + deterministic scripts + CI.
- M01 baseline safety rails: vendored `contracts/agent-account` and wired into `scripts/contracts/test`.
- M02 wallet core: deterministic account address + RPC reads (balances, chain id).

## In Progress

- M03: Deploy account from mobile (Sepolia)

## Next Up

1. Add a Policies screen: create/register/revoke session keys with on-chain policy (M04).
2. Add Agent chat + tool runtime with transfer preview cards (M05).
3. End-to-end constrained transfer demo + denial UX (M06).

## How To Verify

- Repo checks: `./scripts/check`
- Mobile dev server: `./scripts/app/dev`
- Contracts tests: `./scripts/contracts/test`

Manual MVP smoke (Sepolia):

1. Open the app.
2. Tap `Create Wallet`.
3. Tap `Faucet` and fund the displayed account address with Sepolia ETH.
4. Back in the app, tap `Refresh` until ETH balance is non-zero.
5. Tap `Deploy Account` and wait for confirmation.
