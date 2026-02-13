# chore(#53): session-account migration audit + parity checks (no runtime changes)

## Summary

Adds migration audit documentation, parity script, CI workflow, and acceptance matrix for migrating from `agent-account` to upstream `session-account`. No contract or runtime edits.

## Out-of-Scope

- **No contract source code edits**
- **No edits to `apps/mobile/lib/starknet/session-signer.ts`**
- **No edits to transfer execution path**
- Docs/scripts/CI only

## Deliverables

1. `docs/security/SESSION_ACCOUNT_MIGRATION_AUDIT.md` — API delta, storage/event/signature assumptions, security touchpoints
2. `docs/security/PR43_PR44_REBASE_GUIDE.md` — Rebase checklist for PR #43 and #44 after #51/#53
3. `scripts/contracts/check-session-account-parity.sh` — Deterministic parity check (JSON output)
4. `.github/workflows/session-parity-audit.yml` — CI job for parity + docs lint
5. `docs/security/ACCEPTANCE_MATRIX_53.md` — Pass/fail matrix for migration completion

## Command Outputs

### Parity script (PASS)

```json
{
  "upstream_path": ".../starknet-agentic/contracts/session-account",
  "pass": true,
  "missing_files": [],
  "missing_symbols": [],
  "found_files": ["src/lib.cairo", "src/account.cairo", "src/spending_policy.cairo", "src/spending_policy/interface.cairo", "src/spending_policy/component.cairo", "Scarb.toml"],
  "found_symbols": ["add_or_update_session_key", "revoke_session_key", "get_session_data", "set_spending_policy", "get_spending_policy", "remove_spending_policy", "set_agent_id", "get_agent_id", "SessionData", "SpendingPolicy", "ISessionKeyManager", "ISessionSpendingPolicy"],
  "summary": "PASS"
}
```

### Docs check

```
Security docs OK
OK: docs/security/ACCEPTANCE_MATRIX_53.md
OK: docs/security/PR43_PR44_REBASE_GUIDE.md
OK: docs/security/PR_DESCRIPTION_53.md
OK: docs/security/SESSION_ACCOUNT_MIGRATION_AUDIT.md
```
