# Acceptance Matrix — Migration #53

**Issue:** [#53](https://github.com/keep-starknet-strange/starkclaw/issues/53)  
**Scope:** Audit prep only. No contract or runtime edits.

---

## Pass/Fail Matrix for Migration Completion

| Category | Criterion | Status | Notes |
|----------|-----------|--------|-------|
| **Contract** | Parity script passes | ⬜ | `./scripts/contracts/check-session-account-parity.sh` |
| **Contract** | Upstream files present | ⬜ | `lib.cairo`, `account.cairo`, `spending_policy/`, `Scarb.toml` |
| **Contract** | Expected symbols found | ⬜ | `add_or_update_session_key`, `set_spending_policy`, etc. |
| **Mobile policy flow** | Session registration calldata | ⬜ | Migrate from `register_session_key(key, policy)` to `add_or_update_session_key` + `set_spending_policy` |
| **Mobile policy flow** | Validity check | ⬜ | Replace `is_session_key_valid` with `get_session_data` logic |
| **Mobile policy flow** | Revoke / emergency revoke | ⬜ | `revoke_session_key` unchanged; `emergency_revoke_all` N/A upstream |
| **Denial behavior** | Admin selector blocklist | ⬜ | `set_agent_id`, `upgrade`, etc. denied for session keys |
| **Denial behavior** | Spending over limit | ⬜ | Assert in `check_and_update_spending` |
| **Denial behavior** | Invalid/expired session | ⬜ | `__validate__` returns 0 |
| **Observability** | Events | ⬜ | `SessionKeyAdded`, `SessionKeyRevoked`, `SpendingPolicySet`, `SpendingPolicyRemoved` |
| **CI** | `session-parity-audit` job | ⬜ | Parity script + docs check pass |
| **Docs** | Migration audit | ⬜ | `SESSION_ACCOUNT_MIGRATION_AUDIT.md` |
| **Docs** | Rebase guide | ⬜ | `PR43_PR44_REBASE_GUIDE.md` |

---

## #53 Deliverables (This PR)

| Deliverable | Path | Status |
|-------------|------|--------|
| Migration audit | `docs/security/SESSION_ACCOUNT_MIGRATION_AUDIT.md` | ⬜ |
| Rebase guide | `docs/security/PR43_PR44_REBASE_GUIDE.md` | ⬜ |
| Parity script | `scripts/contracts/check-session-account-parity.sh` | ⬜ |
| CI workflow | `.github/workflows/session-parity-audit.yml` | ⬜ |
| Acceptance matrix | `docs/security/ACCEPTANCE_MATRIX_53.md` | ⬜ |

---

## Out-of-Scope (#53)

- Contract source code edits
- `apps/mobile/lib/starknet/session-signer.ts`
- Transfer execution path
- Runtime behavior changes
