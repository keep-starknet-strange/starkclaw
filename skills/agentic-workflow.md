---
name: agentic-workflow
triggers: ["milestone", "agentic", "bootstrap", "STATUS.md", "scripts/check", "commit and push"]
---

# Agentic Workflow (Starkclaw)

<purpose>
Ship the MVP by iterating in small, verifiable vertical slices with frequent commits and pushes.
</purpose>

<procedure>
1. Read `STATUS.md` and pick the current milestone acceptance criteria.
2. Make the smallest change set that produces a runnable artifact.
3. Add or update a deterministic script so the artifact can be verified non-interactively.
4. Run verification locally; fix until green.
5. Update `STATUS.md`:
   - what changed
   - how to verify (exact commands)
   - any new env vars (names only, no values)
6. Commit with tight scope; push to `origin/main`.
</procedure>

<patterns>
<do>
- Prefer `scripts/**` as the canonical interface for CI and for future agents.
- Keep commit boundaries aligned to milestone deliverables (one deliverable per commit).
- When adding deps, justify them and keep the dependency surface small.
</do>
<dont>
- Don't leave "manual steps" undocumented; if it's needed, put it in `STATUS.md`.
- Don't merge interface changes without updating all dependents and tests.
</dont>
</patterns>

<troubleshooting>
- If you can't verify something without secrets, create a "no-secrets" smoke test that still validates wiring.
- If a step requires interactive CLI, wrap it in a script with non-interactive flags or document a fallback.
</troubleshooting>
