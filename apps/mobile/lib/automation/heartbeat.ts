/**
 * heartbeat — Foreground heartbeat loop for safe routine execution.
 *
 * Runs registered routines at their configured intervals. Only executes
 * when the app is in the foreground. Respects policy: only "low" risk
 * routines auto-execute; others are skipped with an audit note.
 */

import {
  type RoutineDefinition,
  type RoutineEntry,
  getRoutineState,
  recordRoutineRun,
} from "./routine";

// ── Registry ────────────────────────────────────────────────────────

const registry: RoutineDefinition[] = [];

export function registerRoutine(def: RoutineDefinition): void {
  if (registry.some((r) => r.id === def.id)) return;
  registry.push(def);
}

export function getRegisteredRoutines(): RoutineDefinition[] {
  return [...registry];
}

// ── Heartbeat loop ──────────────────────────────────────────────────

let loopTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

const TICK_INTERVAL_MS = 30_000; // Check every 30s.

export type HeartbeatListener = (entries: RoutineEntry[]) => void;

const listeners = new Set<HeartbeatListener>();

export function onHeartbeatUpdate(fn: HeartbeatListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const entries: RoutineEntry[] = [];

    for (const def of registry) {
      const state = await getRoutineState(def.id);
      entries.push({ definition: def, state });

      if (!state.enabled) continue;

      // Policy gate: only low-risk routines auto-execute.
      if (def.risk !== "low") {
        await recordRoutineRun(
          def.id,
          null,
          `Skipped: risk "${def.risk}" requires manual confirmation.`,
        );
        continue;
      }

      // Interval check.
      if (state.lastRunAt && nowSec() - state.lastRunAt < def.intervalSec) {
        continue;
      }

      // Execute with timeout.
      try {
        const result = await Promise.race([
          def.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Routine timed out")), def.timeoutMs),
          ),
        ]);
        await recordRoutineRun(def.id, result, null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Routine failed";
        await recordRoutineRun(def.id, null, msg);
      }
    }

    // Refresh states after runs.
    const updated: RoutineEntry[] = [];
    for (const def of registry) {
      const state = await getRoutineState(def.id);
      updated.push({ definition: def, state });
    }

    for (const fn of listeners) {
      try {
        fn(updated);
      } catch {
        // Listener errors don't break the loop.
      }
    }
  } finally {
    running = false;
  }
}

export function startHeartbeat(): void {
  if (loopTimer) return;
  // Run immediately, then on interval.
  tick();
  loopTimer = setInterval(tick, TICK_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

export function isHeartbeatRunning(): boolean {
  return loopTimer !== null;
}
