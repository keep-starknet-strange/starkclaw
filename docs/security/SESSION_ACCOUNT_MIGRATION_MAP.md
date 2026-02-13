# Session Account Migration Map

**Issue:** #53 (migration context for #54)
**Date:** 2026-02-13
**Status:** Planning document

## Overview

This document maps the old `agent-account` API to the new `session-account` API, identifying breaking points from PR #44 and #43, and defining the acceptance test matrix for post-migration validation.

## API Mapping

### Account Creation

| Old (`agent-account`) | New (`session-account`) | Breaking? |
|---|---|---|
| `AgentAccount.deploy(owner_pubkey)` | `SessionAccount.deploy(owner_pubkey)` | ✅ Name change |
| Constructor args: `(felt252)` | Constructor args: `(felt252)` | ✅ Compatible |
| Class hash: `0x...old` | Class hash: `0x...new` | ✅ Different class |

**Migration Action:** Update deployment scripts to use new class hash and contract name.

### Session Key Management

| Old (`agent-account`) | New (`session-account`) | Breaking? |
|---|---|---|---|
| `add_session_key(pubkey, valid_until, allowed_methods)` | `add_or_update_session_key(pubkey, valid_until, max_calls, allowed_entrypoints)` | ✅ Signature change |
| `remove_session_key(pubkey)` | `remove_session_key(pubkey)` | ✅ Compatible |
| `is_valid_session(pubkey)` | `get_session_data(pubkey) -> SessionData` | ✅ Return type change |

**Breaking Points:**
- `add_session_key` renamed to `add_or_update_session_key`
- `allowed_methods` → `allowed_entrypoints` (Array<selector>)
- Added `max_calls` parameter for session call limit
- `is_valid_session` → `get_session_data` (richer return type)

**Migration Action:**
1. Update all `add_session_key` calls to `add_or_update_session_key`
2. Add `max_calls` parameter (suggest: 100 for most cases)
3. Convert `allowed_methods` array to `allowed_entrypoints` (selector format)
4. Replace `is_valid_session` checks with `get_session_data` and inspect `SessionData.valid_until`

### Spending Policy (NEW in `session-account`)

| Old (`agent-account`) | New (`session-account`) | Breaking? |
|---|---|---|
| ❌ Not available | `set_spending_policy(session_key, token, max_per_call, max_per_window, window_seconds)` | ✅ New feature |
| ❌ Not available | `get_spending_policy(session_key, token) -> SpendingPolicy` | ✅ New feature |
| ❌ Not available | `remove_spending_policy(session_key, token)` | ✅ New feature |

**Migration Action:**
1. Identify all session keys that need spending limits
2. Call `set_spending_policy` after `add_or_update_session_key`
3. Update UI to display current spending state via `get_spending_policy`

### Execution

| Old (`agent-account`) | New (`session-account`) | Breaking? |
|---|---|---|---|
| `__execute__(calls: Array<Call>)` | `__execute__(calls: Array<Call>)` | ✅ Signature compatible |
| No spending enforcement | Spending policy enforced BEFORE execution | ✅ Behavioral change |
| Failed calls revert entire tx | Failed calls return empty span | ✅ Error handling change |

**Breaking Points:**
- Spending policy is now enforced in `__execute__` if policy exists
- Failed calls no longer revert (return empty span instead)
- Must check on-chain state to verify transfer success

**Migration Action:**
1. Add spending policy checks before calling `__execute__`
2. Verify on-chain token balance after transfers (don't trust empty span = success)
3. Handle `SpendingPolicy::exceeds_per_call` and `exceeds_window` errors gracefully

### Signature Format (SEPARATE STREAM - #51)

| Old (`agent-account`) | New (`session-account`) | Breaking? |
|---|---|---|---|
| Signature format: TBD | Signature format: TBD | ⚠️ Owned by #51 |
| `is_valid_signature(...)` | `is_valid_signature(...)` | ⚠️ Under review in #51 |

**Out of Scope:** This migration map does NOT cover signature changes (handled separately in #51).

---

## Breaking Points from PR #44 and #43

### PR #44 Breaking Points

**Reference:** https://github.com/keep-starknet-strange/starkclaw/pull/44

1. **Contract Class Hash Changed**
   - Old: `0x...` (agent-account)
   - New: `0x4c1adc7ae850ce40188692488816042114f055c32b61270f775c98163a69f77` (session-account)
   - **Impact:** All deployment scripts must update class hash
   - **Test:** Verify deployment succeeds with new class hash

2. **Session Key Add Method Renamed**
   - Old: `add_session_key(pubkey, valid_until, allowed_methods)`
   - New: `add_or_update_session_key(pubkey, valid_until, max_calls, allowed_entrypoints)`
   - **Impact:** All session key registration code must update
   - **Test:** Verify session keys can be added with new method

3. **Spending Policy Introduced**
   - **Impact:** Transfer calls may now fail with policy errors
   - **Test:** Verify policy enforcement works correctly

### PR #43 Breaking Points

**Reference:** https://github.com/keep-starknet-strange/starkclaw/pull/43

1. **Error Handling in __execute__**
   - Old: Failed calls revert entire transaction
   - New: Failed calls return empty span (silent failure)
   - **Impact:** Apps must verify on-chain state after transfers
   - **Test:** Verify transfer success via token balance, not return value

2. **Admin Blocklist Expanded**
   - Old: 13 selectors blocked for session keys
   - New: 15 selectors blocked (added `set_spending_policy`, `remove_spending_policy`)
   - **Impact:** Session keys cannot modify their own spending limits
   - **Test:** Verify session keys are rejected when trying to call policy functions

---

## Acceptance Test Matrix

After migration, the following tests MUST pass before deployment:

### 1. Account Deployment

| Test | Old Behavior | New Behavior | Status |
|---|---|---|---|
| Deploy with owner pubkey | ✅ Succeeds | ✅ Must succeed | ⏳ Pending |
| Owner can call all functions | ✅ Allowed | ✅ Must allow | ⏳ Pending |
| Verify contract class hash | Old class hash | New class hash | ⏳ Pending |

### 2. Session Key Management

| Test | Old Behavior | New Behavior | Status |
|---|---|---|---|
| Add session key (old method) | ✅ Succeeds | ❌ Method not found | ⏳ Pending |
| Add session key (new method) | ❌ Method not found | ✅ Must succeed | ⏳ Pending |
| Query session data | Returns bool | Returns `SessionData` struct | ⏳ Pending |
| Remove session key | ✅ Succeeds | ✅ Must succeed | ⏳ Pending |
| Expired session key rejected | ✅ Rejected | ✅ Must reject | ⏳ Pending |
| Max calls enforcement | ❌ Not enforced | ✅ Must enforce | ⏳ Pending |

### 3. Spending Policy

| Test | Old Behavior | New Behavior | Status |
|---|---|---|---|
| Set spending policy | ❌ Function not available | ✅ Must succeed | ⏳ Pending |
| Get spending policy | ❌ Function not available | ✅ Must return policy | ⏳ Pending |
| Transfer exceeds per-call limit | ✅ Allowed | ❌ Must be rejected | ⏳ Pending |
| Transfer exceeds window limit | ✅ Allowed | ❌ Must be rejected | ⏳ Pending |
| Multiple transfers accumulate | N/A | ✅ Must track cumulative | ⏳ Pending |
| Window reset after 24h | N/A | ✅ Must reset | ⏳ Pending |
| Remove spending policy | ❌ Function not available | ✅ Must succeed | ⏳ Pending |

### 4. Execution & Error Handling

| Test | Old Behavior | New Behavior | Status |
|---|---|---|---|
| Successful transfer | ✅ Succeeds, returns data | ✅ Must succeed, returns data | ⏳ Pending |
| Failed transfer (old) | ❌ Reverts entire tx | N/A | ⏳ Pending |
| Failed transfer (new) | N/A | ✅ Returns empty span (no revert) | ⏳ Pending |
| Verify via token balance | Manual check | ✅ Must verify on-chain | ⏳ Pending |

### 5. Admin Blocklist

| Test | Old Behavior | New Behavior | Status |
|---|---|---|---|
| Session key calls `transfer` | ✅ Allowed | ✅ Must allow | ⏳ Pending |
| Session key calls `set_public_key` | ❌ Blocked | ❌ Must block | ⏳ Pending |
| Session key calls `set_spending_policy` | N/A | ❌ Must block | ⏳ Pending |
| Session key calls `remove_spending_policy` | N/A | ❌ Must block | ⏳ Pending |

### 6. Signature Validation (PENDING #51)

| Test | Old Behavior | New Behavior | Status |
|---|---|---|---|
| Valid owner signature | ✅ Accepted | ⏳ TBD in #51 | ⏳ Pending #51 |
| Valid session signature | ✅ Accepted | ⏳ TBD in #51 | ⏳ Pending #51 |
| Invalid signature | ❌ Rejected | ⏳ TBD in #51 | ⏳ Pending #51 |

---

## Migration Checklist

### Pre-Migration

- [ ] Review all code using `agent-account` contract
- [ ] Identify session key registration points
- [ ] Identify transfer execution points
- [ ] Plan spending policy configuration
- [ ] Update deployment scripts with new class hash

### Migration

- [ ] Deploy new `session-account` contract to testnet
- [ ] Migrate session key registration to `add_or_update_session_key`
- [ ] Add spending policy setup for all session keys
- [ ] Update transfer execution to handle silent failures
- [ ] Add on-chain balance verification after transfers
- [ ] Update UI to display spending policy state

### Post-Migration Validation

- [ ] Run all acceptance tests (see matrix above)
- [ ] Verify E2E transfer flow with session keys
- [ ] Verify spending policy enforcement
- [ ] Verify admin blocklist prevents policy bypass
- [ ] Load test: 100 tx/hour sustained
- [ ] Monitor for errors in production

### Documentation

- [ ] Update API docs with new method signatures
- [ ] Document spending policy configuration examples
- [ ] Document error handling changes (silent failures)
- [ ] Update mobile app integration guide
- [ ] Create runbook for common migration errors

---

## Common Migration Errors

### Error 1: "Method not found: add_session_key"

**Cause:** Using old session key method name

**Fix:**
```diff
- account.add_session_key(pubkey, valid_until, allowed_methods)
+ account.add_or_update_session_key(pubkey, valid_until, max_calls, allowed_entrypoints)
```

### Error 2: "Transaction exceeds per-call limit"

**Cause:** Spending policy is now enforced

**Fix:**
1. Check current policy: `account.get_spending_policy(session_key, token)`
2. Either reduce transfer amount OR increase policy limit
3. Update policy if needed: `account.set_spending_policy(...)`

### Error 3: "Transfer succeeded but balance unchanged"

**Cause:** Silent failure (returns empty span instead of reverting)

**Fix:**
1. Always verify on-chain balance after transfers
2. Don't trust empty return value as success indicator
3. Implement retry logic if balance verification fails

### Error 4: "Session key cannot modify spending policy"

**Cause:** Admin blocklist now includes policy functions

**Fix:**
- Use owner account to set/modify spending policies
- Session keys can only execute within their policy limits

---

## Integration Timeline

1. **#54 (this PR):** Signer client groundwork (no execution wiring)
2. **#51:** Signature format migration (separate stream)
3. **#53:** Full session-account migration + execution wiring
4. **Post-migration:** Acceptance testing + production rollout

---

## References

- Issue #54: SISNA signer client groundwork
- Issue #53: Session account migration context
- Issue #51: Signature migration (separate stream)
- PR #44: Session account breaking changes
- PR #43: Error handling changes
- ChipiPay v33: Original spending policy implementation
- Sepolia deployment: `0x036e668d4db063df913fa3d7c553753671f7f61fb70bc8f0509073e8bf7cccd9`

---

**Status:** 🟡 Planning phase - tests pending migration implementation

**Next Actions:**
1. Complete #54 (signer client groundwork)
2. Wait for #51 (signature migration)
3. Execute migration per this map
4. Run acceptance tests
5. Deploy to production
