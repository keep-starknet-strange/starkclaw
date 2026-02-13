# Starkclaw

On-chain safety rails for agentic commerce on Starknet.

Starkclaw is a mobile reference implementation of a simple idea:

**Don’t give an AI your wallet. Give it a *session key* with hard limits, and enforce those limits on-chain.**

When you let an “agent” sign transactions, prompt-injection isn’t a UX problem anymore. It’s a custody problem.
Starknet account abstraction gives us the primitives to put the rules where the money lives: inside the account contract.

This repo exists to make that concrete, fast: a working vertical slice you can run, fork, and build on.

## What Works Today (MVP)

- Mobile wallet that generates a deterministic Starknet account address (fund-first, deploy-later).
- Deploy the AA account from the app (Sepolia).
- Create and register on-chain session key policies from the app:
  - Expiry window (`valid_after`, `valid_until`)
  - Per-24h spend cap (`spending_token`, `spending_limit`)
  - Allowed contract (v1 is intentionally narrow; enough for constrained token transfers)
- “Agent” screen that:
  - Proposes a transfer with a deterministic preview card
  - Executes via the session key signature format enforced by the account contract
  - Demonstrates **on-chain denial** when over the cap (not a prompt-level rule)
- Activity log + explorer links.

What this MVP is not (yet):

- Not audited.
- Not wired to a real LLM provider yet (the agent UI is intentionally deterministic right now).
- Not production-ready for mainnet funds.

## The Demo In One Minute

1. Create a wallet.
2. Fund its deterministic address.
3. Deploy the account contract.
4. Register a session key policy (example: 10 USDC / 24h, expires in 24h).
5. Ask the agent to send 2 USDC and execute it.
6. Ask the agent to send 2000 USDC and watch the chain reject it.

The point is not “the AI behaved”.
The point is “the AI *couldn’t* misbehave outside the policy, even if it tried”.

## How It Works (No Hand-Waving)

Starkclaw uses a custom Starknet account contract (`contracts/agent-account`) with a split key model:

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
- Session key tx signature: `[session_key_pubkey, r, s]`

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

## Running The Sepolia Demo

### One-Time: Declare The Account Class

The AA account class must be declared on Sepolia before anyone can deploy instances of it.

```bash
STARKNET_DEPLOYER_ADDRESS=0x... \
STARKNET_DEPLOYER_PRIVATE_KEY=0x... \
./scripts/contracts/declare-agent-account
```

Notes:

- `STARKNET_RPC_URL` is optional (defaults to publicnode Sepolia).
- You need a funded deployer account for fees.

### In The App

1. Home: `Create Wallet`
2. Home: `Faucet` (fund the displayed address)
3. Home: `Refresh` until ETH balance is non-zero
4. Home: `Deploy Account`
5. Policies: `Create + Register` a session key (start with ETH/STRK if USDC is unavailable)
6. Agent:
   - `send 1 ETH to 0x...`
   - `Execute`
7. Denial test:
   - Create a policy with a tiny cap
   - Ask to send over the cap
   - Confirm you get an on-chain denial (and it shows in Activity)

The authoritative runbook is in `STATUS.md`.

## Repo Layout

- `apps/mobile/`: Expo app (Expo Router)
- `contracts/agent-account/`: Cairo account contract + tests (the “safety rails”)
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

## Security Notes

This is experimental software.

- Do not use mainnet funds.
- Do not assume the contract or app is hardened against real adversaries.
- The core security claim is *bounded authority* via on-chain policy, not “the agent is safe”.

If you find a vulnerability, please open a responsible disclosure issue with minimal exploit detail.

## Acknowledgements

- The AA safety-rails baseline is derived from `keep-starknet-strange/starknet-agentic` (vendored into `contracts/agent-account`).
- Starknet.js for transaction building and signing.

## License

MIT. See `LICENSE`.
