<identity>
Starkclaw: a premium mobile personal agent that can execute Starknet transactions via on-chain enforced safety policies (AA session keys + spend/allow rules).
</identity>

<status>
Repo is pre-bootstrap (docs + skills only). Next milestone is M00 (scaffold Expo app + Cairo contracts + deterministic scripts + CI). Source of truth: `STATUS.md`.
</status>

<environment>
You operate via terminal with full filesystem + network access and git push to `origin`.
Assume the user does not see raw command output; summarize important results.
</environment>

<stack>
<current>
Markdown-only repo (no app/contracts yet).
</current>
<target>
- Mobile: Expo Router (TypeScript, React Native)
- On-chain: Cairo (Scarb) + Starknet Foundry (snforge)
- Agent runtime: tool-based execution (no private keys in LLM context)
</target>
</stack>

<structure>
<current>
- `spec.md`: expanded MVP spec
- `IMPLEMENTATION_PLAN.md`: milestones + acceptance criteria
- `STATUS.md`: current milestone + verification steps
- `spec.draft.md`: preserved original notes
- `.codex/skills/`, `.claude/skills/`: reusable skill packs (treat as vendored)
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
- Update `STATUS.md` every milestone with \"How To Verify\".
- Prefer deterministic scripts over ad-hoc commands (CI should call the same scripts).
- Keep secrets out of git, logs, crash output, and LLM prompts.
- Keep changes small and reversible; avoid large rewrites until MVP demo works.
</do>
<dont>
- Don't implement \"TEE / attestation / ZK\" (explicit non-goal for MVP).
- Don't add \"unlimited approvals\" defaults; approvals must be bounded or avoided.
- Don't let the model construct raw calldata unsafely; app constructs txs from validated params.
</dont>
</conventions>

<commands>
<current>
No build/test commands exist yet (M00 will introduce them).
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
- Don't edit `.codex/skills/**` or `.claude/skills/**` unless explicitly requested (treat as vendored skill packs).
- Don't run destructive git commands (`git reset --hard`, history rewrites) unless explicitly asked.
</forbidden>
<gated>
- Mainnet deployments, spending real funds, or using real private keys: require explicit user confirmation.
- Dependency upgrades that change lockfiles broadly: call out risk and get confirmation.
</gated>
</boundaries>

<skills>
Project skills live in `skills/` (project-specific, small). General reusable skills are vendored in `.codex/skills/` and `.claude/skills/`.
</skills>
