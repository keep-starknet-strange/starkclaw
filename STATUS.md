# Starkclaw Status

Last updated: 2026-02-13

## Current Milestone

M09 (Subset): Audit Export + Hardening

## Completed

- Expanded spec written in `spec.md`.
- Implementation plan and milestones written in `IMPLEMENTATION_PLAN.md`.
- Original draft preserved in `spec.draft.md`.
- M00 bootstrap: Expo app scaffold + Cairo sanity package + deterministic scripts + CI.
- M01 baseline safety rails: vendored `contracts/agent-account` and wired into `scripts/contracts/test`.
- M02 wallet core: deterministic account address + RPC reads (balances, chain id).
- M03 deploy from mobile: funding UX + deploy account transaction flow.
- M04 policy UI: create/register/revoke session keys with on-chain policy.
- M05 agent v0: chat-like UI with deterministic transfer planning + explicit execute button.
- M06 constrained transfer: session-key transfers + on-chain denial UX + Activity screen.

## In Progress

- M09 (subset): lightweight audit export (JSON) + error hardening

## Next Up

1. Add lightweight audit log export (JSON) from `Activity` (M09 subset).
2. Hardening: clearer RPC error surfaces + RPC fallback list (M09 subset).

## How To Verify

- Repo checks: `./scripts/check`
- Mobile dev server: `./scripts/app/dev`
- Contracts tests: `./scripts/contracts/test`

Manual MVP smoke (Sepolia):

0. One-time setup: declare the `AgentAccount` class on Sepolia (required before any user can deploy):
   - Export env vars:
     - `STARKNET_RPC_URL` (optional, defaults to publicnode Sepolia)
     - `STARKNET_DEPLOYER_ADDRESS`
     - `STARKNET_DEPLOYER_PRIVATE_KEY`
   - Run: `./scripts/contracts/declare-agent-account`
1. Open the app.
2. Tap `Create Wallet`.
3. Tap `Faucet` and fund the displayed account address with Sepolia ETH.
4. Back in the app, tap `Refresh` until ETH balance is non-zero.
5. Tap `Deploy Account` and wait for confirmation.
6. Go to `Policies`:
   - Create + register a session key for a token (start with ETH/STRK if USDC is unavailable).
   - Revoke it (or emergency revoke all) and confirm it shows invalid on-chain after refresh.
7. Go to `Agent`:
   - Ask: `send 1 ETH to 0x...` (or STRK/USDC matching your session key policy).
   - Tap `Execute`.
   - For denial test: set a small cap in `Policies`, then ask to send an amount over the cap and confirm it is denied on-chain.
