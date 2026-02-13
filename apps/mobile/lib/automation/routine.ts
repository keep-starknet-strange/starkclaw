/**
 * routine — Typed routine definitions with policy constraints.
 *
 * Every routine declares its risk level, required permissions, and
 * execution bounds. Only "low" risk routines can run automatically;
 * anything else requires explicit user confirmation.
 */

import { secureGet, secureSet } from "../storage/secure-store";

const ROUTINES_STATE_ID = "starkclaw.automation.state.v1";

// ── Types ───────────────────────────────────────────────────────────

export type RoutineRisk = "low" | "medium" | "high";

export type RoutineDefinition = {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this routine does. */
  description: string;
  /** Risk classification. Only "low" can auto-execute. */
  risk: RoutineRisk;
  /** Minimum interval between runs (seconds). */
  intervalSec: number;
  /** Maximum execution time before abort (ms). */
  timeoutMs: number;
  /** The async function to execute. Returns a human-readable summary. */
  execute: () => Promise<string>;
};

export type RoutineState = {
  id: string;
  enabled: boolean;
  lastRunAt: number | null; // unix seconds
  lastResult: string | null;
  lastError: string | null;
  runCount: number;
};

export type RoutineEntry = {
  definition: RoutineDefinition;
  state: RoutineState;
};

// ── Persistence ─────────────────────────────────────────────────────

async function loadStates(): Promise<Record<string, RoutineState>> {
  const raw = await secureGet(ROUTINES_STATE_ID);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, RoutineState>;
  } catch {
    return {};
  }
}

async function saveStates(states: Record<string, RoutineState>): Promise<void> {
  await secureSet(ROUTINES_STATE_ID, JSON.stringify(states));
}

export async function getRoutineState(id: string): Promise<RoutineState> {
  const states = await loadStates();
  return (
    states[id] ?? {
      id,
      enabled: false,
      lastRunAt: null,
      lastResult: null,
      lastError: null,
      runCount: 0,
    }
  );
}

export async function setRoutineEnabled(id: string, enabled: boolean): Promise<void> {
  const states = await loadStates();
  const current = states[id] ?? {
    id,
    enabled: false,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
    runCount: 0,
  };
  states[id] = { ...current, enabled };
  await saveStates(states);
}

export async function recordRoutineRun(
  id: string,
  result: string | null,
  error: string | null,
): Promise<void> {
  const states = await loadStates();
  const current = states[id] ?? {
    id,
    enabled: true,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
    runCount: 0,
  };
  states[id] = {
    ...current,
    lastRunAt: Math.floor(Date.now() / 1000),
    lastResult: result,
    lastError: error,
    runCount: current.runCount + 1,
  };
  await saveStates(states);
}

export async function disableAllRoutines(): Promise<void> {
  const states = await loadStates();
  for (const id of Object.keys(states)) {
    states[id] = { ...states[id], enabled: false };
  }
  await saveStates(states);
}
