/**
 * use-automation — React hook for managing background routines.
 *
 * Starts the heartbeat loop on mount, exposes routine entries with
 * enable/disable toggles and a global pause. All state is auditable
 * (last run time, result, error, run count).
 */

import * as React from "react";

import {
  type RoutineEntry,
  setRoutineEnabled,
  disableAllRoutines,
} from "./routine";
import {
  getRegisteredRoutines,
  startHeartbeat,
  stopHeartbeat,
  isHeartbeatRunning,
  onHeartbeatUpdate,
} from "./heartbeat";

export type UseAutomationResult = {
  /** Whether the heartbeat loop is running. */
  active: boolean;
  /** All registered routines with their current state. */
  entries: RoutineEntry[];
  /** Start the heartbeat loop. */
  start: () => void;
  /** Stop the heartbeat loop (pause). */
  pause: () => void;
  /** Toggle a specific routine on/off. */
  toggle: (routineId: string, enabled: boolean) => Promise<void>;
  /** Emergency: disable all routines and stop the loop. */
  disableAll: () => Promise<void>;
};

export function useAutomation(): UseAutomationResult {
  const [active, setActive] = React.useState(isHeartbeatRunning);
  const [entries, setEntries] = React.useState<RoutineEntry[]>([]);

  // Subscribe to heartbeat updates.
  React.useEffect(() => {
    const unsub = onHeartbeatUpdate((updated) => {
      setEntries(updated);
    });
    return unsub;
  }, []);

  // Sync initial entries.
  React.useEffect(() => {
    const defs = getRegisteredRoutines();
    if (defs.length > 0 && entries.length === 0) {
      // Will be populated on first heartbeat tick.
    }
  }, [entries.length]);

  const start = React.useCallback(() => {
    startHeartbeat();
    setActive(true);
  }, []);

  const pause = React.useCallback(() => {
    stopHeartbeat();
    setActive(false);
  }, []);

  const toggle = React.useCallback(
    async (routineId: string, enabled: boolean) => {
      await setRoutineEnabled(routineId, enabled);
      setEntries((prev) =>
        prev.map((e) =>
          e.definition.id === routineId
            ? { ...e, state: { ...e.state, enabled } }
            : e,
        ),
      );
    },
    [],
  );

  const disableAllFn = React.useCallback(async () => {
    stopHeartbeat();
    await disableAllRoutines();
    setActive(false);
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        state: { ...e.state, enabled: false },
      })),
    );
  }, []);

  return {
    active,
    entries,
    start,
    pause,
    toggle,
    disableAll: disableAllFn,
  };
}
