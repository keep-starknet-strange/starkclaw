## What changed

Hard-cut mobile session signing behavior to SNIP-12 v2 only and remove v1 fallback branches in typed-data/signer metadata paths.

Cross-repo coordination note:
- This PR is one leg of a boundary change and must ship with:
  - `keep-starknet-strange/starknet-agentic` (contract-side strict v2 verification/hash)
  - `omarespejel/SISNA` (backend signer-side strict v2 hash + metadata)

Closes keep-starknet-strange/starknet-agentic#254

## How to verify

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run test:signer -- --run
```

Executed evidence:
1. `npm run typecheck` -> pass.
2. `npm run lint` -> pass.
3. `npm run test -- --run` -> `18` files passed, `238` tests passed, `1` skipped (`live-sepolia-remote.e2e`).
4. `npm run test:signer -- --run` -> `9` files passed, `166` tests passed.

## Risk notes

1. Breaking behavior change: v1 fallback removed in mobile signer paths.
2. Dependency coherence fixes included:
   - `react-dom` aligned to `19.1.0`
   - `react-native-worklets` aligned to `0.7.3` (peer range for reanimated)
   - lint/toolchain resolver hardening for Expo+TS
3. Rollout plan:
   - Merge with paired SISNA + starknet-agentic PRs only.
4. Rollback plan:
   - Revert this PR if any boundary mismatch emerges.

## Security checklist

- [x] No secrets, keys, or mnemonics in code or logs
- [x] No `unsafe` blocks without justification
- [x] ERC-20 interactions check return values (if applicable)
- [x] Session key validation cannot be bypassed (if applicable)
- [x] Spending limits cannot overflow or underflow (if applicable)
