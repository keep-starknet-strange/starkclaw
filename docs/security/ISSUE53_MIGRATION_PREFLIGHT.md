# Issue #53 Migration Preflight (agent-account -> session-account)

Last verified: 2026-02-14 UTC
Issue: https://github.com/keep-starknet-strange/starkclaw/issues/53

## Objective
Execute the contract lineage migration with minimum security regression risk:
- remove Starkclaw runtime dependency on legacy `contracts/agent-account`,
- move mobile contract calls to `session-account` API shape,
- preserve remote signer (`SISNA`) execution path behavior.

## Current Drift Snapshot

### Legacy contract lineage still active
- `contracts/agent-account/**`
- `scripts/contracts/declare-agent-account`
- `apps/mobile/scripts/declare-agent-account.mjs`
- `apps/mobile/lib/starknet/contracts.ts` (pinned class hash comment references agent-account)

### Mobile/API call sites that assume old entrypoints
- `apps/mobile/lib/policy/session-keys.ts`
  - uses `register_session_key` entrypoint in calldata flow
- `apps/mobile/lib/starknet/paymaster.ts`
  - includes `register_session_key` in method references
- docs/spec files still use `AgentAccount` terminology and deploy flow

### Already prepared migration context
- `docs/security/SESSION_ACCOUNT_MIGRATION_MAP.md`
  - includes old->new method mapping and acceptance matrix

## Security-Critical Invariants (Do Not Regress)
1. Session signatures remain explicit 4-felt shape: `[pubkey,r,s,valid_until]`.
2. No runtime fallback from hardened remote signer path to weaker auth path.
3. Policy-denied and auth/replay failures remain deterministic in UX.
4. Spending policy limits are enforced by contract path used in production.

## Cutover Plan (Recommended Sequence)

1. Contract import + compile gates
- Introduce `contracts/session-account/**` lineage from `starknet-agentic` main (post #227).
- Keep legacy contract folder temporarily to avoid hard break during staged migration.
- Pass Cairo build/tests for new workspace before mobile rewiring.

2. Deploy/artifact path migration
- Add `declare-session-account` script path (parallel to existing declare script).
- Wire class-hash references in mobile runtime/config to session-account artifacts.

3. Mobile policy API remap
- Replace old session registration call path with:
  - `add_or_update_session_key(...)`
  - spending policy setters/removers/getters
- Keep UX semantics stable while remapping calldata generation.

4. End-to-end deny-path validation
- Verify over-limit transfer fails as expected on live/test flow.
- Verify session revoke path still blocks subsequent execution.

5. Decommission legacy references
- Remove `agent-account` deploy/docs references only after migration checks are green.

## Test Gate Before Merge

From repo root:

```bash
./scripts/contracts/test
./scripts/app/check
./scripts/test/signer-client.sh
npm --prefix apps/mobile test -- --run lib/agent-runtime/tools/__tests__/core-tools.runtime.test.ts
```

Plus targeted migration tests (must be present in PR):
- session register/update/revoke with new entrypoints,
- spending policy set/get/remove and denial behavior,
- live execution path still returns correlation chain (`mobileActionId`, `signerRequestId`, `txHash`).

## PR Scoping Rules for #53
1. Keep signer transport/auth changes out of this PR (already tracked in #54 stream).
2. Keep observability correlation work out of this PR (tracked in #55).
3. Avoid docs-only sweep in same contract migration PR; use follow-up cleanup PR.

## Reviewer Checklist
1. No remaining runtime call to `register_session_key`.
2. No deploy script defaults pointing to legacy `agent-account`.
3. Session/account class hash wiring points to session-account artifacts.
4. Live-mode transfer path still deterministic on policy deny and auth/replay failures.
