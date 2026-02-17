# AgentAccount (Legacy Starknet AA Package)

This package is kept for compatibility, debugging, and migration workflows.
The canonical production lineage for Starkclaw is `session-account` from
`keep-starknet-strange/starknet-agentic`.

It is designed around a simple constraint:

**The agent should never hold the owner key.**

Instead, the user registers one or more session keys with explicit limits, and the contract enforces those limits
in `__execute__` during transaction execution.

## Status

- Default production path: upstream `session-account` lineage.
- This package: legacy fallback only.
- Use only when explicitly required for debug/migration work.

## Policy Model (MVP)

See `src/interfaces.cairo`:

- `valid_after`, `valid_until`
- `spending_token`, `spending_limit` (24h rolling window)
- `allowed_contract` (v1: single allowed target; `0` means “any”)

Spending is debited for value-moving ERC-20 selectors:

- `transfer`
- `approve`
- `increase_allowance`
- `increaseAllowance`

This blocks “approval bypass” patterns where a session key sets an unlimited allowance and a colluder drains funds.

Signature convention (see `src/agent_account.cairo`):

- Owner tx signature: `[r, s]`
- Session tx signature: `[session_key_pubkey, r, s]`

## Build + Test

```bash
scarb build
snforge test
```

From repo root you can also run `./scripts/contracts/test`.

## Sepolia Declaration (Legacy, Explicitly Gated)

If you need this legacy package path, declaration is explicitly gated.

From repo root:

```bash
ALLOW_LEGACY_AGENT_ACCOUNT=1 \
STARKNET_DEPLOYER_ADDRESS=0x... \
STARKNET_DEPLOYER_PRIVATE_KEY=0x... \
./scripts/contracts/declare-agent-account
```

For canonical production declarations, use:

```bash
./scripts/contracts/declare-session-account
```

## Safety Notes

- Experimental. Not audited.
- Treat changes to `__validate__` / `__execute__` as security-critical.
