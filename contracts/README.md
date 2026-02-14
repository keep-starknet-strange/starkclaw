# Starkclaw Contracts

This folder contains the on-chain “safety rails” that make Starkclaw meaningful.

If the app UI and the agent logic are compromised, the contracts are still the final gatekeeper for what can execute.

## Packages

- Canonical production lineage: `session-account` from `starknet-agentic`

## What The Account Enforces (MVP)

The canonical session-account path supports two signer modes:

- **Owner signature**: unrestricted account execution
- **Session key signature**: restricted execution (policy enforced in `__execute__`)

Session key policy fields (see upstream session-account interfaces):

- `valid_after`, `valid_until`
- `spending_token`, `spending_limit` (24h rolling window)
- `allowed_contract` (v1: single allowed target; `0` means “any”)

To prevent common bypasses, the spending limiter debits not just `transfer`, but also approval-like selectors
(`approve`, `increase_allowance`, `increaseAllowance`) so a session key can’t escape via unlimited approvals.

## Run Tests

From repo root:

```bash
./scripts/contracts/test
```

Legacy package tests (migration/debug only):

```bash
cd agent-account
scarb build
snforge test
```

## Deploy / Declare (Sepolia)

Canonical production declare path (session-account lineage):

```bash
STARKNET_DEPLOYER_ADDRESS=0x... \
STARKNET_DEPLOYER_PRIVATE_KEY=0x... \
./scripts/contracts/declare-session-account
```

Optional override for upstream source location:

```bash
UPSTREAM_SESSION_ACCOUNT_PATH=/abs/path/to/contracts/session-account \
STARKNET_DEPLOYER_ADDRESS=0x... \
STARKNET_DEPLOYER_PRIVATE_KEY=0x... \
./scripts/contracts/declare-session-account
```

Optional override for expected class hash pinning:

```bash
EXPECTED_SESSION_ACCOUNT_CLASS_HASH=0x... \
./scripts/contracts/declare-session-account
```

Legacy fallback (migration/debug only, explicitly gated):

```bash
ALLOW_LEGACY_AGENT_ACCOUNT=1 ./scripts/contracts/declare-agent-account
```

If you change canonical session-account code:

1. Rebuild and re-declare the class on Sepolia.
2. Update the pinned hash in `apps/mobile/lib/starknet/contracts.ts`.

## Safety Notes

- Experimental contracts. Not audited.
- Don’t deploy to mainnet with real funds.
- Review any change to `__validate__` / `__execute__` like it’s a wallet implementation, because it is.
