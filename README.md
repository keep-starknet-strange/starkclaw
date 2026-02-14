# Starkclaw

On-chain safety rails for agentic commerce on Starknet.

Starkclaw is a mobile reference implementation of a simple idea:

**Don’t give an AI your wallet. Give it a *session key* with hard limits, and enforce those limits on-chain.**

When you let an “agent” sign transactions, prompt-injection isn’t a UX problem anymore. It’s a custody problem.
Starknet account abstraction gives us the primitives to put the rules where the money lives: inside the account contract.

This repo exists to make that concrete, fast: a working vertical slice you can run, fork, and build on.

## Send Your Agent

StarkClaw follows the [BYOA (Bring Your Own Agent)](./BYOA.md) protocol — a decentralized coordination system where AI agents collaborate through GitHub issues, labels, and PRs without knowing each other.

**Give your AI coding agent this single instruction:**

> Clone https://github.com/keep-starknet-strange/starkclaw, read BYOA.md, and execute the protocol. You are an OpenClaw agent.

That's it. The agent will self-identify, claim issues, open PRs, review other agents' work, and coordinate — all through GitHub. No setup, no onboarding, no external tools.

Works with Claude Code, Codex, Cursor, or any agent that can run `gh` commands.

## What Works Today

**Current app mode: Demo (UI-only, fully mocked).**

The mobile app currently runs in **demo mode** with premium UX:
- Onboarding flow (agent setup, account creation)
- Transfer/trading preview + confirmations with policy checks (mocked)
- Policy editor (caps, allowlists, emergency lockdown)
- Alerts + inbox + activity timeline
- Agent proposals (approve/reject) with clear context

**No RPC calls, no wallets, no contract interaction yet.** The UI is production-grade; backend wiring is in progress ([#2](https://github.com/keep-starknet-strange/starkclaw/issues/2)).

## What's Being Built (Live Mode)

The building blocks for **live Starknet execution** exist in `apps/mobile/lib/` but aren't wired to the UI:

- Starknet RPC client with retry/fallback
- Wallet lifecycle (deterministic address, secure storage, deploy flow)
- Session key policy management (create/register/revoke)
- Agent transfer execution with on-chain policy enforcement
- Activity logging with explorer links

**Target MVP** (when live mode is wired):
- Mobile wallet generates deterministic Starknet account address (fund-first, deploy-later)
- Deploy AA account from app (Sepolia)
- Create/register on-chain session key policies:
  - Expiry window (`valid_after`, `valid_until`)
  - Per-24h spend cap (`spending_token`, `spending_limit`)
  - Allowed contract (v1: narrow scope for constrained transfers)
- Agent screen:
  - Proposes transfers with deterministic preview
  - Executes via session key signature enforced by account contract
  - Demonstrates **on-chain denial** when over cap (not prompt-level rule)
- Activity log + explorer links

The point is not "the AI behaved."
The point is "the AI *couldn't* misbehave outside the policy, even if it tried."

## What This Is Not (Yet)

- Not audited
- Not wired to live Starknet execution (demo mode only, see [#2](https://github.com/keep-starknet-strange/starkclaw/issues/2))
- Not wired to a real LLM provider (agent UI is deterministic/mocked)
- Not production-ready for mainnet funds

## How It Works (No Hand-Waving)

Starkclaw uses Starknet session-account lineage (canonical source: `keep-starknet-strange/starknet-agentic/contracts/session-account`) with a split key model:

- **Owner key (master)**:
  - Deploys the account.
  - Registers / revokes session keys.
  - Emergency revokes all session keys.
- **Session key (delegated)**:
  - Signs transactions with a policy attached on-chain.
  - Is disposable, time-bounded, and revocable.

On-chain enforcement (in `__execute__`) includes:

- `allowed_contract` (v1): session key calls must target the allowed contract (or zero-address = any).
- `spending_limit` + 24h window (v1): value-moving ERC-20 selectors are debited on-chain.
  - Includes `transfer`, `approve`, `increase_allowance` variants to block “approval bypass” attacks.

Signature convention:

- Owner tx signature: `[r, s]`
- Session key tx signature: `[session_key_pubkey, r, s, valid_until]`

The policy is the source of truth. The “agent” UI is just a safer way to produce intents.

## Quickstart

### Prereqs

- Node.js + npm
- Expo Go (fastest iteration)
- Cairo tooling (for contracts):
  - Scarb (`scarb`)
  - Starknet Foundry (`snforge`, `sncast`)

### Install

```bash
npm ci --prefix apps/mobile
```

### Run

```bash
./scripts/app/dev
```

### Check (CI Equivalent)

```bash
./scripts/check
```

## Running Live Mode (When Available)

**Note:** The app currently runs in demo mode only. Live Starknet execution is being wired in [#2](https://github.com/keep-starknet-strange/starkclaw/issues/2).

Once live mode is available, the flow will be:

### One-Time: Declare The Account Class

Canonical path (session-account lineage from `starknet-agentic`):

```bash
STARKNET_DEPLOYER_ADDRESS=0x... \
STARKNET_DEPLOYER_PRIVATE_KEY=0x... \
./scripts/contracts/declare-session-account
```

Notes:
- `STARKNET_RPC_URL` is optional (defaults to publicnode Sepolia)
- You need a funded deployer account for fees
- `UPSTREAM_SESSION_ACCOUNT_PATH` is optional to override source location
- `EXPECTED_SESSION_ACCOUNT_CLASS_HASH` is optional but pinned by default; declare fails on mismatch
- Existing wallets without persisted class-hash metadata remain on legacy hash addressing (no silent remap)

Legacy fallback (migration/debug only, explicitly gated):

```bash
ALLOW_LEGACY_AGENT_ACCOUNT=1 ./scripts/contracts/declare-agent-account
```

### In The App (Planned)

1. Switch to Live mode in Settings
2. Home: `Create Wallet`
3. Home: `Faucet` (fund the displayed address)
4. Home: `Refresh` until ETH balance is non-zero
5. Home: `Deploy Account`
6. Policies: `Create + Register` a session key
7. Agent: Ask to send tokens and execute
8. Denial test: Set a tiny cap, try to exceed it, confirm on-chain denial

See `STATUS.md` for current progress.

## Repo Layout

- `apps/mobile/`: Expo app (Expo Router)
- `contracts/`: Starknet account-contract tooling/docs
- `scripts/`: deterministic commands (CI calls these)
- `spec.md`: product spec
- `IMPLEMENTATION_PLAN.md`: milestone plan
- `STATUS.md`: current state + verification steps
- `CLAUDE.md`, `agents.md`, `.claude/skills/**`: agentic-native context and skills

## Agentic-Native Development (Yes, On Purpose)

This repository is structured so AI agents can work effectively without making the project unreviewable:

- `STATUS.md` is the single source of truth for “what’s next” and “how to verify”.
- `./scripts/check` is the contract between local dev and CI.
- Changes should land as small vertical slices with frequent commits.
- Secrets never belong in commits, logs, or prompts.

If you want to contribute with AI assistance, start with `CLAUDE.md` and `agents.md`.

## Contributing

If you’re excited by “agents that can spend, but only within guardrails”, we want you here.

High-leverage contributions:

- LLM provider adapter + streaming chat (keeping keys out of model context)
- Better policy UX (multi-target allowlists, selector allowlists)
- Devnet-first onboarding (lower friction than Sepolia declare/deploy)
- UI polish (premium “trustworthy wallet” feel)
- Security hardening + tests

Workflow:

1. Pick an issue (or open one with a crisp problem statement).
2. Keep PRs small and runnable.
3. Run `./scripts/check` before opening a PR.
4. Update `STATUS.md` when you change the verification story.

## Security

This is experimental software.

- Do not use mainnet funds.
- Do not assume the contract or app is hardened against real adversaries.
- The core security claim is *bounded authority* via on-chain policy, not "the agent is safe".

If you find a vulnerability, please report it responsibly. See [SECURITY.md](./SECURITY.md) for reporting guidelines.

## Acknowledgements

- Canonical AA safety-rails lineage is `keep-starknet-strange/starknet-agentic/contracts/session-account`.
- Starknet.js for transaction building and signing.

## License

MIT. See `LICENSE`.
