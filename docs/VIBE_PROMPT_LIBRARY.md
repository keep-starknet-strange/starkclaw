# Starkclaw Vibe Prompt Library (10 Ready Prompts)

Each prompt below is copy-paste ready as-is for this repository.

## 1) Live Backend Core Wiring (Issue #2)
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/spec.md, /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/IMPLEMENTATION_PLAN.md, /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/STATUS.md, and /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/agents.md before changing code.

Goal: replace live backend stubs with real wallet+balance behavior for the existing AppState shape.

Implement:
- In /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/app/live-backend.tsx, wire real actions for:
  - completeOnboarding: create/load wallet using /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/wallet/wallet.ts
  - reset: also clear wallet/session-related secure state where appropriate
  - setEmergencyLockdown/updateSpendCaps/setAllowedTargets: persist meaningful live state and append activity records
- Add helper(s) to refresh live balances using:
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/starknet/tokens.ts
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/starknet/balances.ts
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/starknet/rpc.ts
- Keep AppState compatible with existing UI screens (no screen-level breaking changes).

Acceptance criteria:
- Live mode no longer emits "[live] ... not yet implemented" for core onboarding/policy actions.
- On live mode onboarding completion, account address is deterministic and persisted.
- Live balances load for ETH/USDC/STRK and survive app restart.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run

Output format:
- Root cause / gap summary
- Files changed
- Acceptance criteria check (pass/fail)
- Exact command results
```

## 2) Policies Tab -> Real Session Key Flows
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read spec.md and TATUS.md first.

Goal: wire Policies UI to real session-key lifecycle in live mode while keeping demo mode untouched.

Implement:
- In /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/app/(tabs)/policies.tsx:
  - Detect app mode via useApp().mode.
  - In live mode, use /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/policy/use-session-keys.ts.
  - Add UI actions to create session key, revoke a single key, and emergency revoke all.
  - Reuse current target preset model from /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/policy/target-presets.ts for allowedContracts.
- Ensure owner auth is respected through existing action wrappers in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/policy/session-key-actions.ts.
- Surface user-safe errors and success alerts in the existing inbox/alert UX.

Acceptance criteria:
- Live mode can create/register a session key and display it in Policies.
- Live mode can revoke one key and emergency revoke all.
- Demo mode behavior is unchanged.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/policy

Output format:
- Changed files
- Demo vs live behavior matrix
- Command outputs
```

## 3) Agent Tab -> Real Transfer Execution in Live Mode
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/spec.md, /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/STATUS.md, and /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/agent/transfer.ts first.

Goal: in live mode, make Agent tab execute real transfer lifecycle (prepare -> preview -> execute -> denial guidance).

Implement:
- In /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/app/(tabs)/agent.tsx, integrate /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/agent/use-transfer.ts when mode is live.
- Parse user input from composer using current transfer grammar in prepareTransferFromText.
- Render deterministic preview card before execution (token, amount, recipient, cap/valid-until context).
- On execute, show tx hash + explorer link and denial guidance from classifyRevertReason.
- Keep demo behavior untouched when mode is demo.

Acceptance criteria:
- Live mode can prepare and execute `send <amount> <token> to 0x...` requests.
- Over-cap path shows clear denied guidance.
- Activity log entry includes tx metadata.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/agent

Output format:
- UX states implemented
- Files changed
- Commands and results
```

## 4) Trade Tab -> AVNU Swap Wiring (Bounded Approval)
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/spec.md sections on non-goals/M08 and inspect:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/defi/use-swap.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/defi/swap.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/app/(tabs)/trade.tsx

Goal: keep demo mode as-is, and enable live-mode quote+swap flow on Trade tab.

Implement:
- In live mode, call useSwap quote/confirm flow from Trade screen.
- Replace mock preview math with real quote fields from SwapPreview.
- Display explicit safety text: approval is bounded to exact sellAmount.
- On success, append and show tx hash; on error, show safe user message.

Acceptance criteria:
- Live mode produces AVNU quote preview and can submit swap transaction.
- No unlimited approval logic introduced.
- Demo mode still uses current simulated behavior.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/defi

Output format:
- Safety invariants checklist
- Files changed
- Command results
```

## 5) Activity + Status Tracker Hardening
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/activity/activity.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/starknet/rpc.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/app/(tabs)/inbox.tsx

Goal: make activity entries transition from pending to final status automatically in live mode.

Implement:
- Add a tx status poller module (or hook) that checks pending tx hashes and updates:
  - status
  - executionStatus
  - revertReason
- Reuse existing updateActivityByTxHash.
- Integrate poller into app lifecycle so it runs while app is foregrounded.
- Show status badges in inbox activity rows.

Acceptance criteria:
- Pending tx entries eventually become succeeded/reverted/unknown.
- Revert reason is preserved and visible.
- No polling in demo mode.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/activity

Output format:
- Polling strategy summary
- Files changed
- Command outputs
```

## 6) Audit Export UX End-to-End (Issue #17)
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/activity/audit-export.ts and related tests.

Goal: add an in-app export action for audit bundle JSON from Inbox/Settings.

Implement:
- Add an "Export audit JSON" action in either:
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/app/(tabs)/inbox.tsx
  - or /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/app/modal.tsx
- Build bundle using:
  - buildDemoAuditBundle in demo mode
  - buildLiveAuditBundle in live mode
- Serialize via serializeAuditBundle and provide UX action to copy/share/save (use Expo-compatible APIs already in project deps; do not add risky new deps).
- Guarantee no secrets are exported.

Acceptance criteria:
- User can export readable JSON in both modes.
- Export includes correlation fields (mobileActionId/signerRequestId) for live activity when present.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/activity/__tests__/audit-export-correlation.test.ts

Output format:
- Export UX path
- Redaction guarantees
- Commands and results
```

## 7) RPC Error Mapping Integration Pass (Issue #18 follow-through)
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/starknet/rpc.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/agent/transfer.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/policy/session-keys.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/defi/swap.ts

Goal: normalize user-facing network/on-chain errors across transfer, policy, and swap flows.

Implement:
- Route raw RPC errors through classifyRpcError before presenting UI messages.
- Ensure user messages are actionable and non-technical.
- Preserve raw technical detail only in internal logs/audit fields where needed.
- Add focused tests for timeout, rate limit, policy revert, contract not found.

Acceptance criteria:
- UI gets consistent error copy for identical failure classes.
- No secret leakage in error surfaces.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/starknet lib/agent lib/policy lib/defi

Output format:
- Error mapping table (before -> after)
- Files changed
- Command outputs
```

## 8) Remote Signer Security Regression Review + Fixes
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Act as Reviewer first, then patch.

Scope:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/signer/runtime-config.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/signer/keyring-proxy-signer.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/signer/pinning.ts
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/spec/interop-version.json

Tasks:
1. Identify concrete security gaps (auth replay, signature shape validation, transport hardening, pinning fail-open risk).
2. Implement minimal high-confidence fixes.
3. Add/adjust tests under /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile/lib/signer/__tests__.

Acceptance criteria:
- Signature envelope enforcement remains strict and test-covered.
- Production remote mode fails closed on insecure transport/pinning misconfig.
- No regression to local test/dev workflow.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/test/signer-client.sh
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run lib/signer

Output format:
- Findings first (severity ordered with file:line)
- Fixes applied
- Test evidence
```

## 9) Session-Account Migration Cleanup (No Silent Interface Drift)
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Read these first:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/docs/security/SESSION_ACCOUNT_MIGRATION_AUDIT.md
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/docs/security/SESSION_ACCOUNT_MIGRATION_MAP.md
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/docs/security/ISSUE53_MIGRATION_PREFLIGHT.md

Goal: remove remaining runtime/docs ambiguity between legacy agent-account and canonical session-account.

Implement:
- Audit and patch any remaining mobile references that assume old entrypoints or old validity semantics.
- Ensure policy/session docs and comments align with current code behavior.
- Keep legacy declare path gated, do not delete migration fallback scripts.
- Update STATUS.md verification notes if behavior changed.

Acceptance criteria:
- Parity scripts pass and docs match runtime behavior.
- No accidental ABI/calldata drift introduced.

Run and report:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/contracts/check-session-account-parity.sh
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/contracts/test-parity-audit.sh
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check

Output format:
- Drift list found and resolved
- Files changed
- Command results
```

## 10) Release Readiness Sweep (Single PR Finisher)
```text
Work in /Users/khairalllah/Desktop/Projects/Starknet/starkclaw.
Do a release-readiness sweep for current mainline state (demo + live foundations).

Tasks:
- Run the full deterministic check contract.
- Fix any lint/type/test failures in tracked source files only.
- Ensure no debug logs, TODO placeholders, or dead code in touched modules.
- Verify docs consistency among:
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/README.md
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/STATUS.md
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/spec.md
  - /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/IMPLEMENTATION_PLAN.md
- If checks are blocked by environment/network restrictions, report exact blocker and continue with all non-blocked checks.

Mandatory commands:
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/app/check
- npm --prefix /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/apps/mobile test -- --run
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/contracts/test
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/contracts/check-session-account-parity.sh
- /Users/khairalllah/Desktop/Projects/Starknet/starkclaw/scripts/contracts/test-parity-audit.sh

Output format:
- Final release-readiness verdict: PASS / BLOCKED
- Findings list (bugs, regressions, test gaps)
- Files changed
- Command-by-command results
```
