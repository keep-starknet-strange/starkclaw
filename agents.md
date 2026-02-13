<identity>
Multi-agent coordination for Starkclaw (agentic-native, fast iteration, frequent integration).
</identity>

<roles>
| Role | Owns | Does NOT |
| ---- | ---- | -------- |
| Coordinator | milestone selection, task breakdown, `STATUS.md` accuracy, integration | implement large features |
| Mobile Executor | Expo app UI/UX + storage + networking | change contract logic without coordination |
| Contracts Executor | Cairo contracts + tests + deploy scripts | modify mobile UX without coordination |
| Agent Runtime Executor | LLM adapter + tool runtime + audit log | change contract interfaces silently |
| Reviewer | correctness, security rails, regression checks | do initial implementation |
</roles>

<delegation>
For any work item:
1. Investigation (Coordinator): identify files, interfaces, acceptance checks, risks, and a minimal plan.
2. Execution (Executor): implement exactly the plan, keep changes small, surface blockers immediately.
3. Review (Reviewer): run checks, scan for security regressions, confirm acceptance criteria.
</delegation>

<task_states>
todo -> inprogress -> inreview -> done
blocked can be entered from any state when waiting on a decision/dependency
</task_states>

<parallelization>
SAFE to parallelize:
- `apps/mobile/**` work vs `contracts/**` work when interfaces are stable
- UI iteration while contracts tests run (different files)

MUST serialize:
- Any change that touches a shared interface (ABI, calldata shape, policy fields)
- Changes to `scripts/**` and CI pipelines

Conflict resolution:
1. Detect overlap early (rg for touched files).
2. Pause later task if it touches the same interface.
3. Land the interface change first with tests.
4. Rebase/adjust dependents and re-verify.
</parallelization>

<integration_protocol>
- Default to short-lived branches only when risk is high; otherwise commit directly to `main` for speed.
- Each milestone should land as a small series of commits aligned to acceptance criteria.
- After each push: update `STATUS.md` so another agent can pick up instantly.
</integration_protocol>

<escalation>
Escalate when:
- A decision affects public interfaces (policy model, signing stack, package manager)
- Security implications (key handling, injection/tool abuse, approval semantics)
- You cannot make progress without user-provided info (RPC URL, funding, API keys)

Format:
## Escalation: [Title]
**Blocker**: [...]
**Options**:
1. [...]
2. [...]
**Recommendation**: [...]
</escalation>
