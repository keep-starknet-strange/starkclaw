# PR #43 and #44 Rebase Guide

**Context:** After [#51](https://github.com/keep-starknet-strange/starkclaw/issues/51) and [#53](https://github.com/keep-starknet-strange/starkclaw/issues/53) land, PR #43 and #44 will need to be rebased. This guide provides a concrete checklist and file-level mapping.

---

## Prerequisites

- #51 merged (contract migration to session-account)
- #53 merged (audit docs, parity script, CI)
- PR #43 and #44 branches rebased onto `main` after both

---

## File-Level Mapping and Expected Conflicts

### PR #43 (Contract Migration)

| File | Expected conflicts | Resolution notes |
|------|--------------------|-------------------|
| `contracts/agent-account/Scarb.toml` | Package rename to `session_account` | Align with upstream `session-account` Scarb.toml |
| `contracts/agent-account/src/lib.cairo` | Module layout change | `account`, `spending_policy` instead of `agent_account`, `session_key` |
| `contracts/agent-account/src/agent_account.cairo` | **Replaced** | Use upstream `account.cairo` |
| `contracts/agent-account/src/session_key.cairo` | **Removed** | Logic in `account.cairo` + `spending_policy/` |
| `contracts/agent-account/src/interfaces.cairo` | **Removed** | Interfaces in `account.cairo`, `spending_policy/interface.cairo` |
| `contracts/agent-account/src/agent_account_factory.cairo` | May conflict | Factory may need updates for new constructor args |
| `contracts/agent-account/src/mock_*.cairo` | Low | Keep if tests depend |
| `contracts/agent-account/tests/*.cairo` | High | Rewrite for `SessionData`, `add_or_update_session_key`, `set_spending_policy` |

### PR #44 (Mobile / App)

| File | Expected conflicts | Resolution notes |
|------|--------------------|-------------------|
| `apps/mobile/lib/policy/session-keys.ts` | High | `registerSessionKeyOnchain`: new calldata for `add_or_update_session_key` + `set_spending_policy` |
| `apps/mobile/lib/starknet/session-signer.ts` | **DO NOT EDIT** | Signature format change (3→4 felts) deferred to separate PR |
| `apps/mobile/lib/starknet/paymaster.ts` | Low | Entrypoint names: `add_or_update_session_key` vs `register_session_key` |
| `apps/mobile/lib/activity/activity.ts` | Low | Activity kinds may need new names |
| `apps/mobile/lib/identity/erc8004.ts` | Medium | `get_agent_id` returns `felt252` not `(ContractAddress, u256)` |
| `apps/mobile/scripts/declare-agent-account.mjs` | Low | Class name / artifact path changes |

---

## Rebase Checklist

### Before Rebase

- [ ] Fetch latest `main`: `git fetch origin main`
- [ ] Note current base commit of PR #43 and #44
- [ ] Run parity script: `./scripts/contracts/check-session-account-parity.sh` (from #53)

### Rebase PR #43

1. [ ] `git checkout <pr43-branch>`
2. [ ] `git rebase origin/main`
3. [ ] Resolve conflicts in `contracts/agent-account/` per table above
4. [ ] Run `scarb build` and `snforge test` in `contracts/agent-account`
5. [ ] Verify parity script passes: `./scripts/contracts/check-session-account-parity.sh`

### Rebase PR #44

1. [ ] `git checkout <pr44-branch>`
2. [ ] `git rebase origin/main` (or onto rebased #43 if stacked)
3. [ ] Resolve conflicts in `apps/mobile/lib/policy/session-keys.ts`
4. [ ] Update `registerSessionKeyOnchain` calldata:
   - [ ] `add_or_update_session_key(session_key, valid_until, max_calls, allowed_entrypoints[])`
   - [ ] Optional: `set_spending_policy(session_key, token, max_per_call, max_per_window, window_seconds)`
5. [ ] Update `isSessionKeyValidOnchain` to use `get_session_data` if `is_session_key_valid` removed
6. [ ] Run `npm run check` (or equivalent) in `apps/mobile`
7. [ ] Run full CI: `./scripts/check`

### After Rebase

- [ ] Push with `--force-with-lease`
- [ ] Re-request review
- [ ] Verify CI passes (including `session-parity-audit` job from #53)

---

## Conflict Resolution Tips

1. **Session registration:** Old passes `SessionPolicy` struct; upstream passes `valid_until`, `max_calls`, `allowed_entrypoints[]`. Map `valid_until` from policy, `max_calls` from a default or config, `allowed_entrypoints` from `allowed_contract` (single selector or empty for "any").
2. **Spending:** Old policy has `spending_limit`, `spending_token`. Upstream uses `set_spending_policy`. Call it in a separate invoke or batch after `add_or_update_session_key`.
3. **Agent ID:** Old `(registry, u256)` → upstream `felt252`. Encode or hash if registry binding is needed.
