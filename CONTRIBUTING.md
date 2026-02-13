# Contributing to Starkclaw

Starkclaw is a reference implementation for **on-chain safety rails** + a **premium mobile UX** for agentic commerce.
Contributions are welcome, but we keep a high bar: small vertical slices, deterministic checks, and security-first changes.

## Before You Start

- Read `README.md` for the product story and current state.
- For agentic-native workflows and repo boundaries, read `CLAUDE.md` and `agents.md`.

## What We Want Help With

- Mobile UX polish (glass, motion, typography, flows) while staying calm and trustworthy.
- Agent UX: proposal cards, approvals, explanations, and “why blocked” experiences (mocked or real).
- Contracts: more expressive policies (multiple targets, selector allowlists), test coverage, and hardening.
- Tooling: deterministic scripts, CI improvements, reproducible demo flows.

If you’re unsure, open an issue with:
- Problem statement (1-2 sentences)
- Expected outcome (what “done” looks like)
- Scope boundaries (what’s explicitly NOT included)

## Repo Dev Commands

These are the canonical commands used by CI:

- Check everything: `./scripts/check`
- Mobile only (lint + typecheck): `./scripts/app/check`
- Contracts tests: `./scripts/contracts/test`
- Mobile dev server: `./scripts/app/dev`

## Local Setup

### Prereqs

- Node.js (CI uses Node 20)
- Expo tooling (Expo Go is the fastest loop)
- Contracts tooling (for `./scripts/check`):
  - Scarb
  - Starknet Foundry (`snforge`, `sncast`)

### Install

```bash
npm ci --prefix apps/mobile
```

### Run The Mobile App

```bash
./scripts/app/dev
```

## Contribution Standards

### 1. Keep Changes Small and Shippable

Prefer “vertical slice” PRs:
- one user-facing improvement
- checks green
- commit messages scoped (example: `mobile: ...`, `contracts: ...`, `docs: ...`)

### 2. Don’t Break The Deterministic Check Contract

`./scripts/check` must stay:
- deterministic
- runnable without secrets
- the same command CI uses

If you add a new tool or step, wire it through `scripts/**` and update docs.

### 3. Never Commit Secrets

Do not commit or paste into issues:
- `.env*`, mnemonics, private keys, keystores
- production addresses with private context
- screenshots containing secrets

If you need secrets locally, keep them out of git and out of logs.

### 4. Security-Critical Areas

Treat changes under `contracts/**` like a wallet implementation:
- add tests for every behavior change
- prefer explicit allowlists and bounded authority
- be conservative about interface/ABI changes

### 5. UI/UX Bar (Mobile)

We’re aiming for calm, lucid, Apple-grade polish:
- typography must not clip (use correct `lineHeight`)
- spacing must be consistent and touch targets >= 44pt
- motion is subtle and meaningful (avoid gimmicks)
- glass surfaces should be layered and readable

Include screenshots or a short screen recording for UI PRs when possible.

## Working With AI Agents (Agentic-Native)

This repo is intentionally designed so agents can contribute without chaos.
If you use an AI assistant:

- Keep context small; link to files instead of pasting large blobs.
- Run checks locally (`./scripts/check`) before requesting review.
- Update `STATUS.md` when you change the verification story or “what works”.
- Avoid touching shared interfaces (policy fields, calldata shapes) without calling it out clearly in the PR description.

## PR Checklist

- [ ] `./scripts/check` passes
- [ ] No secrets added
- [ ] UI changes: screenshots/video attached (when relevant)
- [ ] Contracts changes: tests added/updated
- [ ] Docs updated if behavior or commands changed

Thanks for helping push agentic commerce toward bounded authority instead of blind trust.

