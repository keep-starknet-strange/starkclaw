# Starkclaw MVP Spec

Status: Draft v1 (2026-02-13)

## One-Liner

Starkclaw is a mobile personal agent that can execute Starknet transactions through on-chain enforced safety policies (session keys, spend caps, and allow/deny rules) so users can safely delegate financial actions.

## Product Goal

Deliver a fully working MVP that demonstrates, end-to-end, that:

- A user can chat with an agent to perform real on-chain actions on Starknet.
- The agent operates with a constrained credential (session key), not the master key.
- On-chain account logic enforces the safety policy even if the agent is manipulated.
- The mobile UX feels premium, fast, and trustworthy.

### MVP Demo Scenario (Must Work)

1. User creates a Starkclaw wallet on Starknet Sepolia (default) and funds it.
2. User configures a session key policy:
   - Spend cap for a chosen ERC-20 (example: USDC) per 24h.
   - Allowed targets for the session key (initially minimal, expanded later).
   - Expiry window.
3. User asks: "Send 2 USDC to 0xABC..."
4. Agent:
   - Checks balance.
   - Builds a transfer transaction.
   - Previews exactly what will happen.
   - Executes using the session key.
5. User asks: "Send 2000 USDC to 0xABC..." (over the cap).
6. Transaction fails on-chain with a policy error; app shows a clear denial reason and offers to adjust policy (requires owner approval).

## Non-Goals (MVP)

- No TEE runtime or remote attestation.
- No ZK proofs.
- No full DeFi coverage (swaps/lending/LP) in the first MVP cut.
- No production-grade on-device LLM (cloud model API is acceptable).
- No multi-device sync.
- No app store submission hardening beyond basic security hygiene.

## Target Users

- Crypto-native users who want to delegate small, bounded actions to an agent.
- Builders evaluating Starknet AA as a safety control plane for agent commerce.

## Core Principles

- On-chain policy enforcement is the source of truth.
- Session keys are the default execution credential.
- Owner key is for policy changes and emergency actions, not routine execution.
- Secrets never enter the LLM context.
- Every transaction is previewed with a deterministic, human-readable summary.
- Local-first by default: store chats, policies, and audit logs on device.

## System Overview

Starkclaw is three tightly scoped systems:

1. Mobile app (Expo) with:
   - Wallet and policy management UI
   - Agent chat UI
   - Activity log and safety controls
2. On-chain contracts (Starknet AA):
   - Agent account contract enforcing policies for session-key-signed txs
   - Optional factory contract for deployment and identity registration
3. Agent runtime:
   - Tool-based execution (balances, transfers, simulation, submit)
   - Strict validation, tool allowlists, and safe defaults

## UX Requirements

### Design Direction

- iOS-first "liquid glass" aesthetic: layered translucency, blur surfaces, crisp typography, subtle depth.
- Premium, calm, confident. No "terminal app" vibes.
- Obsessive consistency in spacing, typographic rhythm, and motion.

### Screens (MVP)

- Onboarding
  - Create wallet
  - Fund wallet (faucet instructions for Sepolia)
  - Create session key + policy
- Home
  - Portfolio overview (balances for a small token set)
  - Primary CTA: "Ask Starkclaw"
- Chat
  - Streaming assistant responses
  - Action cards for proposed transactions
  - Explicit "Execute" button for session-key actions
- Policies
  - List session keys (active/expired)
  - Create/revoke session key
  - Spend caps per token
  - Emergency revoke all
- Activity
  - Transaction history
  - Status tracking (pending, accepted, rejected)
  - Copy explorer link
- Settings
  - Network (Sepolia/Mainnet)
  - RPC endpoint
  - LLM provider configuration
  - Export logs

## Wallet and Key Model

### Keys

- Owner key:
  - Used to deploy the account and manage policies (register/revoke session keys, emergency revoke).
  - Stored in OS secure storage with biometric gating for signing operations.
- Session key(s):
  - Used by the agent to sign transactions within policy bounds.
  - Stored in OS secure storage without biometric gating (agent must function without constant prompts).
  - Designed to be disposable, revocable, and time-bounded.

### Account Type

- The wallet is a Starknet AA account contract that supports:
  - Standard owner signature validation
  - Session-key signature validation for constrained autonomy
  - Policy enforcement during execution for session-key transactions

Implementation baseline: fork/derive from `keep-starknet-strange/starknet-agentic` `contracts/agent-account`.

## On-Chain Safety Policy Model

### Policy Goals

- Prevent unlimited approvals or uncontrolled transfers.
- Restrict where the agent can send calls (contract allowlist).
- Ensure policies are enforceable on-chain, not just "best effort" in prompts.

### MVP Policy (v1)

- Time bounds:
  - `valid_after`, `valid_until`
- Spend cap per 24h period for a single token:
  - `spending_token`, `spending_limit`
- Allowed targets:
  - v1 supports a minimal allowlist strategy sufficient for transfers.

Note: The upstream `agent-account` policy shape includes a single `allowed_contract`. That is sufficient for single-call token transfers, but insufficient for multi-call DeFi flows that require touching token and router contracts in one transaction. This informs milestone ordering.

### Post-MVP Policy (v1.1+)

- Multi-target allowlist:
  - Allow a bounded set of contract addresses per session key.
- Optional function selector allowlist:
  - Allow specific selectors per contract for higher precision.
- Denylist:
  - Global blocked targets that always fail for session keys.
- Approval safety:
  - Optional cap on `approve` amounts and/or allowlist of approved spenders.

## Agent Runtime Architecture

### Execution Model

- The LLM produces tool calls, not raw transaction calldata.
- Tools are deterministic, schema-validated functions implemented locally in the app.
- The app, not the model, constructs and signs the transaction.
- The model never sees private keys or raw secrets.

### Tooling (MVP)

Read tools:

- `starknet_get_balances(address, tokens[])`
- `starknet_get_nonce(address)`
- `starknet_estimate_fee(calls[])`
- `starknet_simulate(calls[])`
- `policy_get_session_keys()`
- `policy_get_limits()`

Write tools:

- `policy_register_session_key(policy)`
- `policy_revoke_session_key(keyId)`
- `policy_emergency_revoke_all()`
- `starknet_transfer(token, to, amount)`

The agent can propose policy changes, but execution requires owner-gated confirmation.

### Prompt Injection and Tool Abuse Defense (MVP)

- Strict tool allowlist and input schema validation.
- Endpoint allowlist for any HTTP calls (RPC, token metadata, swap quote APIs).
- Never render untrusted external content as authoritative instructions.
- Separate system prompt for "planner" vs "executor" modes:
  - Planner: propose steps and ask for missing data.
  - Executor: only emit tool calls against whitelisted tools and validated params.

## Transaction Lifecycle

1. Intent capture: user request in chat.
2. Plan: agent proposes a concrete action (transfer) with parameters.
3. Preflight:
   - Resolve token metadata (address, decimals).
   - Check local policy intent (fast fail if obviously impossible).
   - Build calls array.
   - Simulate and estimate fees.
4. Preview:
   - Show: token, amount, recipient, max fee, policy used, why allowed.
5. Execute:
   - Sign with session key.
   - Submit to RPC.
6. Track:
   - Poll for status.
   - Persist activity + receipt locally.

## Data and Storage

Secrets:

- Owner private key (secure storage, biometric gated)
- Session private keys (secure storage)
- LLM API key (if user-provided, secure storage)

Non-secrets:

- Wallet metadata: network, account address, class hash
- Session key metadata: policy, createdAt, expiresAt, revokedAt
- Chat history
- Tool execution audit log
- Tx history (hash, calls summary, status)

## Networking

RPC:

- Starknet JSON-RPC provider URL is configurable per network.
- Default to a reputable provider; allow user override.
- Validate chain id at startup and on each tx submission.

Token metadata:

- Start with a minimal static set (ETH, STRK, USDC, USDT).
- Expand via AVNU token list/SDK in later milestones.

LLM:

- MVP supports direct-to-provider calls with a user-provided key, or a hosted proxy API route.
- Provider must be pluggable behind a simple interface.

## Security Requirements

- No private keys in logs, crash reports, or LLM prompts.
- Owner actions must require explicit confirmation and biometric auth.
- Session key policy must be shown clearly at creation time and when used.
- Emergency revoke is always accessible within 2 taps from the main UI.
- All external requests must have timeouts, retries, and clear error messages.

## Open Questions (To Resolve Early)

- Starknet signing stack inside Expo Hermes:
  - Validate whether `starknet.js` works directly, or adopt a RN-focused signing implementation.
  - Evaluate `@starknet/react-native-sdk` (and confirm signature scheme compatibility with the chosen account contract).
- Best on-chain design for multi-target allowlists that stays cheap and simple.
- Best default RPC provider for Sepolia + Mainnet with predictable rate limits.

## Milestones Reference

See `IMPLEMENTATION_PLAN.md` for the agentic-native implementation plan and milestone acceptance criteria.
