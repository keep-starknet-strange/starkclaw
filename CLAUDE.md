<identity>
Starkclaw: a premium mobile personal agent that can execute Starknet transactions via on-chain enforced safety policies (AA session keys + spend/allow rules).
</identity>

<status>
Repo is bootstrapped (Expo app + Cairo contracts sanity package + deterministic scripts + CI). Next milestone: M01 import Starknet AA Agent Account contract + tests. Source of truth: `STATUS.md`.
</status>

<environment>
You operate via terminal with full filesystem + network access and git push to `origin`.
Assume the user does not see raw command output; summarize important results.
</environment>

<stack>
<current>
- Mobile: Expo SDK 54 + Expo Router (TypeScript, React Native)
- Contracts: Cairo via Scarb + Starknet Foundry (snforge/sncast)
</current>
<target>
- Mobile: Expo Router (TypeScript, React Native)
- On-chain: Cairo (Scarb) + Starknet Foundry (snforge)
- Agent runtime: tool-based execution (no private keys in LLM context)
</target>
</stack>

<structure>
<current>
- `apps/mobile/`: Expo app (Expo Router tabs template; will be replaced by Starkclaw UI)
- `contracts/sanity/`: Cairo sanity package (smoke tests for toolchain wiring)
- `scripts/`: canonical commands used by CI
- `.github/workflows/ci.yml`: CI entrypoint (runs `./scripts/check`)
- `spec.md`: expanded MVP spec
- `IMPLEMENTATION_PLAN.md`: milestones + acceptance criteria
- `STATUS.md`: current milestone + verification steps
- `spec.draft.md`: preserved original notes
- `.claude/skills/`: reusable skill packs (treat as vendored)
- `.codex` -> `.claude`: symlink (single source of truth is `.claude`)
</current>
<target_m00_plus>
- `apps/mobile/`: Expo app
- `contracts/`: Cairo contracts + tests + deploy scripts
- `packages/`: shared TS packages (agent runtime, starknet utils)
- `scripts/`: deterministic check/dev commands used by CI
</target_m00_plus>
</structure>

<conventions>
<do>
- Work in vertical slices; each slice ends in a runnable artifact + checks + commit + push.
- Update `STATUS.md` every milestone with "How To Verify".
- Prefer deterministic scripts over ad-hoc commands (CI should call the same scripts).
- Keep secrets out of git, logs, crash output, and LLM prompts.
- Keep changes small and reversible; avoid large rewrites until MVP demo works.
</do>
<dont>
- Don't implement "TEE / attestation / ZK" (explicit non-goal for MVP).
- Don't add "unlimited approvals" defaults; approvals must be bounded or avoided.
- Don't let the model construct raw calldata unsafely; app constructs txs from validated params.
</dont>
</conventions>

<commands>
<current>
| Task | Command | Notes |
| ---- | ------- | ----- |
| Check all | `./scripts/check` | runs mobile lint/typecheck + contracts tests |
| App dev | `./scripts/app/dev` | `expo start` |
| Contracts test | `./scripts/contracts/test` | scarb + snforge |
</current>
<planned_m00>
| Task | Command | Notes |
| ---- | ------- | ----- |
| Check all | `./scripts/check` | lint + typecheck + unit + contracts |
| App dev | `./scripts/app/dev` | starts Expo |
| Contracts test | `./scripts/contracts/test` | scarb + snforge |
| Contracts deploy | `./scripts/contracts/deploy sepolia` | requires env + funded deployer |
</planned_m00>
</commands>

<workflows>
<milestone_execution>
1. Read current milestone in `STATUS.md`.
2. Implement smallest end-to-end slice that satisfies acceptance criteria.
3. Add/extend scripts so verification is one command.
4. Run checks locally; fix until green.
5. Update `STATUS.md` with exact verification steps and any new env vars.
6. Commit with a tight scope; push to `origin/main`.
</milestone_execution>
</workflows>

<boundaries>
<forbidden>
- Never commit secrets: `.env*`, `**/*keystore*`, `**/*mnemonic*`, `**/*private_key*`, `**/*.pem`, `**/*.key`.
- Don't edit `.claude/skills/**` unless explicitly requested (treat as vendored skill packs). (`.codex` is a symlink.)
- Don't run destructive git commands (`git reset --hard`, history rewrites) unless explicitly asked.
</forbidden>
<gated>
- Mainnet deployments, spending real funds, or using real private keys: require explicit user confirmation.
- Dependency upgrades that change lockfiles broadly: call out risk and get confirmation.
</gated>
</boundaries>

<skills>
Use the standard skill packs in `.claude/skills/**/SKILL.md`. `.codex` is a symlink for compatibility; do not duplicate skills across both trees.
</skills>
