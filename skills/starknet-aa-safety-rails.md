---
name: starknet-aa-safety-rails
triggers: ["session key", "spend cap", "allowlist", "agent account", "policy", "Cairo", "snforge", "scarb"]
---

# Starknet AA Safety Rails (Starkclaw)

<purpose>
Implement and integrate an AA account that enforces safety policies on-chain so the agent can only act within bounded permissions.
</purpose>

<baseline>
Start from `keep-starknet-strange/starknet-agentic` `contracts/agent-account`:
- SessionPolicy fields: `valid_after`, `valid_until`, `spending_limit`, `spending_token`, `allowed_contract`
- Session tx signature format (upstream): `[session_key_pubkey, r, s]`
- Enforcement happens in `__execute__` (contract allow + spending selector debit)
</baseline>

<procedure>
1. Vendor/import the baseline contract into `contracts/` with its tests.
2. Keep the MVP policy minimal (enough for ERC-20 transfer constraints).
3. Ensure the mobile signing stack can produce the exact signature format expected by the contract.
4. Add contract tests for:
   - allowed target enforcement
   - spend cap exceed denial
   - key expiry/revocation denial
5. Only then extend policy for multi-target allowlists (post-MVP milestone).
</procedure>

<patterns>
<do>
- Enforce safety on-chain; off-chain checks are for UX only.
- Prefer bounded approvals (or avoid approvals) in MVP.
- Treat any “unlimited approve” path as a security bug unless explicitly required and policy-bounded.
</do>
<dont>
- Don’t change policy field semantics without updating mobile UI, signing, and tests together.
- Don’t rely on prompt instructions for safety; assume the model can be manipulated.
</dont>
</patterns>

<troubleshooting>
- If signatures fail: verify hash calculation, chain id, tx version, and signature element ordering.
- If policy enforcement fails unexpectedly: inspect selectors treated as “spending selectors” in the contract and confirm calldata layout.
</troubleshooting>

