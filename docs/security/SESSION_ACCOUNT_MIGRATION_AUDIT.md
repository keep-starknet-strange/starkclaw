# Session Account Migration Audit

**Issue:** [#53](https://github.com/keep-starknet-strange/starkclaw/issues/53)  
**Upstream:** [starknet-agentic/contracts/session-account](https://github.com/keep-starknet-strange/starknet-agentic/tree/main/contracts/session-account)  
**Scope:** Docs/scripts/CI only. No contract or runtime edits.

---

## 1. API Delta: Old `agent-account` vs Upstream `session-account`

### 1.1 Session Key Management

| Aspect | Old (agent-account) | Upstream (session-account) |
|--------|---------------------|---------------------------|
| **Register** | `register_session_key(key, policy: SessionPolicy)` | `add_or_update_session_key(session_key, valid_until, max_calls, allowed_entrypoints[])` |
| **Revoke** | `revoke_session_key(key)` | `revoke_session_key(session_key)` |
| **Query policy** | `get_session_key_policy(key) -> SessionPolicy` | `get_session_data(session_key) -> SessionData` |
| **Validity check** | `is_session_key_valid(key) -> bool` | Implicit via `get_session_data` (valid_until, calls_used, max_calls) |

### 1.2 Policy / Data Structures

**Old `SessionPolicy`:**
```cairo
struct SessionPolicy {
    valid_after: u64,
    valid_until: u64,
    spending_limit: u256,
    spending_token: ContractAddress,
    allowed_contract: ContractAddress,
}
```

**Upstream `SessionData`:**
```cairo
struct SessionData {
    valid_until: u64,
    max_calls: u32,
    calls_used: u32,
    allowed_entrypoints_len: u32,
}
```

**Upstream spending policy (separate component):**
- `set_spending_policy(session_key, token, max_per_call, max_per_window, window_seconds)`
- `get_spending_policy(session_key, token) -> SpendingPolicy`
- `remove_spending_policy(session_key, token)`

### 1.3 Agent Identity

| Aspect | Old | Upstream |
|-------|-----|----------|
| **Set** | `set_agent_id(registry: ContractAddress, agent_id: u256)` | `set_agent_id(agent_id: felt252)` |
| **Get** | `get_agent_id() -> (ContractAddress, u256)` | `get_agent_id() -> felt252` |
| **Factory init** | `init_agent_id_from_factory(registry, agent_id)` | N/A (single felt) |

### 1.4 Removed / Replaced in Upstream

| Old | Upstream equivalent |
|-----|---------------------|
| `validate_session_key_call(key, target)` | Selector whitelist in `_is_session_allowed_for_calls` |
| `use_session_key_allowance(key, token, amount)` | `check_and_update_spending` in `__execute__` |
| `emergency_revoke_all()` | N/A (not in upstream; may need custom) |
| `get_active_session_key_count()` | N/A (iterate or track externally) |
| `schedule_upgrade`, `execute_upgrade`, `cancel_upgrade`, `get_upgrade_info`, `set_upgrade_delay` | `upgrade(new_class_hash)` via UpgradeableComponent (no timelock) |

### 1.5 New in Upstream

| Entrypoint | Purpose |
|------------|---------|
| `get_session_allowed_entrypoints_len(session_key)` | Length of whitelist |
| `get_session_allowed_entrypoint_at(session_key, index)` | Whitelist lookup |
| `compute_session_message_hash(calls, valid_until)` | Owner-only hash for off-chain signing |
| `get_contract_info()` | Returns version string |
| `get_snip9_version()` | Returns 2 |
| `register_interfaces()` | SRC-5 interface registration |
| `execute_from_outside_v2` (SNIP-9) | Outside execution (paymaster) |
| `set_spending_policy`, `get_spending_policy`, `remove_spending_policy` | Per-token spending caps |

---

## 2. Storage / Event / Signature Assumptions Delta

### 2.1 Storage

| Old | Upstream |
|-----|----------|
| `session_keys: Map<felt252, SessionPolicy>` (in component) | `session_keys: Map<felt252, SessionData>` |
| `session_entrypoints: Map<(felt252, u32), felt252>` | Same (selector whitelist) |
| `spending_used`, `spending_period_start` per (key, token) | `SpendingPolicyComponent.policies: Map<(felt252, ContractAddress), SpendingPolicy>` |
| `agent_registry`, `agent_id` (separate) | `agent_id: felt252` (single) |
| `active_session_keys`, `session_key_count`, `session_key_index` | N/A |
| `factory`, `pending_upgrade`, `upgrade_scheduled_at`, `upgrade_delay` | `upgradeable` component (no timelock) |

### 2.2 Events

| Old | Upstream |
|-----|----------|
| `SessionKeyRegistered { key, valid_after, valid_until }` | `SessionKeyAdded { session_key, valid_until, max_calls }` |
| `SessionKeyRevoked { key }` | `SessionKeyRevoked { session_key }` |
| `AgentIdSet { registry, agent_id }` | `AgentIdSet { agent_id }` |
| `EmergencyRevoked`, `UpgradeScheduled`, etc. | N/A |
| N/A | `SpendingPolicySet`, `SpendingPolicyRemoved` |

### 2.3 Signature Convention

| Signer | Old | Upstream |
|--------|-----|----------|
| **Owner** | `[r, s]` (2 felts) | `[r, s]` (2 felts) |
| **Session key** | `[session_key, r, s]` (3 felts) | `[session_pubkey, r, s, valid_until]` (4 felts) |

**Critical:** Upstream binds `valid_until` in the signature. The signer must include it; the contract validates it against stored session data.

**Message hash (upstream):** Poseidon of `[account_address, chain_id, nonce, valid_until, ...calls]`. Old agent-account used tx_hash directly for ECDSA.

---

## 3. Security Implications and Required Code Touchpoints

### 3.1 Mobile / Policy Flow

| Touchpoint | File(s) | Change |
|------------|---------|--------|
| **Session registration calldata** | `apps/mobile/lib/policy/session-keys.ts` | Replace `register_session_key(key, policy)` with `add_or_update_session_key(key, valid_until, max_calls, allowed_entrypoints[])` |
| **Spending policy** | Same + new flows | Call `set_spending_policy` after adding session key (separate tx or batched) |
| **Session signer** | `apps/mobile/lib/starknet/session-signer.ts` | **DO NOT EDIT** per #53 scope; document that signature format must change to 4 felts |
| **Validity check** | `session-keys.ts` `isSessionKeyValidOnchain` | Replace `is_session_key_valid` with logic using `get_session_data` |

### 3.2 Transfer Execution Path

| Touchpoint | Change |
|------------|--------|
| **Transfer flow** | **DO NOT EDIT** per #53 scope. Document that upstream enforces spending via `SpendingPolicyComponent` in `__execute__`. |

### 3.3 Denial Behavior

| Scenario | Old | Upstream |
|----------|-----|----------|
| Admin selector (e.g. `set_agent_id`) | Not explicitly blocklisted | Blocklisted in `_is_session_allowed_for_calls` |
| Spending over limit | Assert in `check_and_update_spending` | Same, in `SpendingPolicyComponent` |
| Invalid session / expired | Assert in `__validate__` | Return 0 in `__validate__` (no revert message) |
| Selector not in whitelist | `allowed_contract` + implicit | Explicit `allowed_entrypoints` whitelist |

### 3.4 Observability

| Aspect | Old | Upstream |
|--------|-----|----------|
| **Events** | `SessionKeyRegistered`, `SessionKeyRevoked` | `SessionKeyAdded`, `SessionKeyRevoked`, `SpendingPolicySet`, `SpendingPolicyRemoved` |
| **Indexing** | Different event shapes | Update indexers for new event names and fields |

---

## 4. Out-of-Scope (No Edits in #53)

- Contract source code (`contracts/agent-account/**`)
- `apps/mobile/lib/starknet/session-signer.ts`
- Transfer execution path
- Any runtime behavior changes

---

## 5. Verification (Auditor Checklist)

1. **Parity script:** `./scripts/contracts/check-session-account-parity.sh` — must pass with valid upstream path.
2. **TDD tests:** `./scripts/contracts/test-parity-audit.sh` — all tests must pass.
3. **Cross-check:** Compare §1–§3 above against `starknet-agentic/contracts/session-account` source.
4. **CI:** `.github/workflows/session-parity-audit.yml` runs parity + TDD tests on push/PR.
