# Starkclaw

On-chain safety rails for agentic commerce on Starknet.

Starkclaw is a mobile reference implementation of a simple idea:

**Don't give an AI your wallet. Give it a _session key_ with hard limits, and enforce those limits on-chain.**

When you let an "agent" sign transactions, prompt-injection isn't a UX problem anymore. It's a custody problem.
Starknet account abstraction gives us the primitives to put the rules where the money lives: inside the account contract.

This repo exists to make that concrete, fast: a working vertical slice you can run, fork, and build on.

## Send Your Agent

Starkclaw follows the [BYOA (Bring Your Own Agent)](./BYOA.md) protocol: a decentralized coordination system where AI agents collaborate through GitHub issues, labels, and PRs without knowing each other.

**Give your AI coding agent this single instruction:**

> Clone https://github.com/keep-starknet-strange/starkclaw, read BYOA.md, and execute the protocol. You are an OpenClaw agent.

That's it. The agent will self-identify, claim issues, open PRs, review other agents' work, and coordinate through GitHub.
No setup. No onboarding. No external tooling beyond `gh`.

Works with Claude Code, Codex, Cursor, or any agent that can run GitHub CLI workflows.

## What Works Today

**Current app mode: Demo (UI-only, fully mocked).**

The mobile app currently runs in **demo mode** with premium UX:
- Onboarding flow (agent setup, account creation)
- Transfer/trading preview + confirmations with policy checks (mocked)
- Policy editor (caps, allowlists, emergency lockdown)
- Alerts + inbox + activity timeline
- Agent proposals (approve/reject) with clear context

**No RPC calls, no wallets, no contract interaction yet.**
The UI is production-grade; backend wiring is in progress ([#2](https://github.com/keep-starknet-strange/starkclaw/issues/2)).

## What's Being Built (Live Mode)

The building blocks for **live Starknet execution** exist in `apps/mobile/lib/` but are still being wired to full user flows:

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

The point is not "the AI behaved".
The point is "the AI _couldn't_ misbehave outside the policy, even if it tried".

## What This Is Not (Yet)

- Not audited
- Not wired end-to-end for live Starknet execution (demo-first)
- Not wired to a production LLM provider by default (agent UX currently deterministic/mocked)
- Not production-ready for mainnet funds

## How It Works (No Hand-Waving)

Starkclaw uses Starknet session-account lineage (canonical source: `keep-starknet-strange/starknet-agentic/contracts/session-account`) with a split key model:

- **Owner key (master)**:
  - Deploys the account
  - Registers / revokes session keys
  - Emergency revokes all session keys
- **Session key (delegated)**:
  - Signs transactions with a policy attached on-chain
  - Is disposable, time-bounded, and revocable

On-chain enforcement (in `__execute__`) includes:

- `allowed_contract` (v1): session key calls must target the allowed contract (or zero-address = any)
- `spending_limit` + 24h window (v1): value-moving ERC-20 selectors are debited on-chain
  - Includes `transfer`, `approve`, `increase_allowance` variants to block approval-bypass patterns

Signature convention:

- Owner tx signature: `[r, s]`
- Session key tx signature: `[session_key_pubkey, r, s, valid_until]`

The policy is the source of truth. The "agent" UI is just a safer way to produce intents.

## Security Stack (Defense in Depth)

Starkclaw does not rely on one guardrail. It composes independent controls:

1. On-chain authority boundaries (owner vs delegated key capabilities)
2. On-chain policy enforcement (targets, windows, spending rules)
3. Signature-level binding and strict malformed-response rejection
4. Remote signer hardening in SISNA mode (authenticated requests, strict validation, TLS pinning)
5. Integration integrity checks (session-account parity checks + deterministic CI gates)

Practical result:

- If a prompt is manipulated, execution is still bounded by contract policy
- If app-layer logic is buggy, on-chain checks still constrain spending behavior
- If delegated key path is compromised, scope + revocation limit blast radius

This is the core power of the stack: **bounded, enforceable authority across layers**, not trust in model behavior.

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

### Contract Tests

```bash
./scripts/contracts/test
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
- `STARKNET_RPC_URL` is optional
- You need a funded deployer account for fees
- `UPSTREAM_SESSION_ACCOUNT_PATH` is optional to override source location
- `EXPECTED_SESSION_ACCOUNT_CLASS_HASH` is pinned by default; declare fails on mismatch
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

## Connected Repositories

Starkclaw is part of a multi-repo system. Key integration surfaces:

1. [`keep-starknet-strange/starknet-agentic`](https://github.com/keep-starknet-strange/starknet-agentic)
   - Canonical `session-account` lineage source
   - Consumed through:
     - `./scripts/contracts/check-session-account-parity.sh`
     - `./scripts/contracts/declare-session-account`
     - `UPSTREAM_SESSION_ACCOUNT_PATH`

2. [`omarespejel/SISNA`](https://github.com/omarespejel/SISNA)
   - Remote signer boundary for session-key signing flows
   - Consumed through:
     - `apps/mobile/lib/signer/**`
     - `keyring-proxy-signer.ts` request auth + strict response checks
     - transport hardening (TLS pinning + runtime guards)
   - Production key-custody note:
     - SISNA currently requires explicit
       `KEYRING_ALLOW_INSECURE_IN_PROCESS_KEYS_IN_PRODUCTION=true`
       when running with in-process keys in production.
     - This is a temporary explicit-risk guard until external KMS/HSM
       signer backend mode is available.

Integration rule of thumb:

- Upstream contract/API changes must be reflected in parity checks, signer adapters, and mobile execution wiring before release.

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

- `STATUS.md` is the single source of truth for what's next and how to verify
- `./scripts/check` is the contract between local dev and CI
- Changes should land as small vertical slices with frequent commits
- Secrets never belong in commits, logs, or prompts

If you want to contribute with AI assistance, start with `BYOA.md`, `CLAUDE.md`, and `agents.md`.

## Versioning and Release Policy

- Changelog: `CHANGELOG.md`
- Versioning policy: `VERSIONING.md`

Until `1.0.0`, releases are pre-1.0 semantic and include explicit security callouts in release notes.

## Contributing

If you're excited by "agents that can spend, but only within guardrails", we want you here.

High-leverage contributions:

- LLM provider adapter + streaming chat (keeping keys out of model context)
- Better policy UX (multi-target allowlists, selector allowlists)
- Devnet-first onboarding (lower friction than Sepolia declare/deploy)
- UI polish (premium "trustworthy wallet" feel)
- Security hardening + tests

Workflow:

1. Pick an issue (or open one with a crisp problem statement)
2. Keep PRs small and runnable
3. Run `./scripts/check` before opening a PR
4. Update `STATUS.md` when you change the verification story

## Security

This is experimental software.

- Do not use mainnet funds
- Do not assume the contract or app is hardened against real adversaries
- The core security claim is _bounded authority_ via on-chain policy, not "the agent is safe"

If you find a vulnerability, report it responsibly via [SECURITY.md](./SECURITY.md).

## Acknowledgements

- Canonical AA safety-rails lineage: `keep-starknet-strange/starknet-agentic/contracts/session-account`
- Starknet.js for transaction building and signing

## License

MIT. See `LICENSE`.
