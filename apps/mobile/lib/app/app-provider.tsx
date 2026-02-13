/**
 * AppProvider — root provider that selects between demo and live backends.
 *
 * Consumers call `useApp()` which returns the same state/actions interface
 * regardless of mode. The mode is persisted to SecureStore.
 */

import * as React from "react";

import { DemoProvider, useDemo } from "@/lib/demo/demo-store";
import { secureGet, secureSet } from "@/lib/storage/secure-store";

import { useLiveBackend } from "./live-backend";
import type { AppContextValue, AppMode } from "./types";

const MODE_STORAGE_KEY = "starkclaw.app_mode";

const AppContext = React.createContext<AppContextValue | null>(null);

// ---------------------------------------------------------------------------
// Demo bridge — renders DemoProvider and bridges to AppContextValue
// ---------------------------------------------------------------------------

function DemoBridge(props: {
  children: React.ReactNode;
  mode: AppMode;
  setMode: (m: AppMode) => void;
}) {
  return (
    <DemoProvider>
      <DemoBridgeInner mode={props.mode} setMode={props.setMode}>
        {props.children}
      </DemoBridgeInner>
    </DemoProvider>
  );
}

function DemoBridgeInner(props: {
  children: React.ReactNode;
  mode: AppMode;
  setMode: (m: AppMode) => void;
}) {
  const demo = useDemo();
  const value = React.useMemo<AppContextValue>(
    () => ({
      bootStatus: demo.bootStatus,
      state: demo.state,
      actions: demo.actions,
      mode: props.mode,
      setMode: props.setMode,
    }),
    [demo.bootStatus, demo.state, demo.actions, props.mode, props.setMode]
  );
  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Live bridge — uses useLiveBackend and bridges to AppContextValue
// ---------------------------------------------------------------------------

function LiveBridge(props: {
  children: React.ReactNode;
  mode: AppMode;
  setMode: (m: AppMode) => void;
}) {
  const live = useLiveBackend();
  const value = React.useMemo<AppContextValue>(
    () => ({
      bootStatus: live.bootStatus,
      state: live.state,
      actions: live.actions,
      mode: props.mode,
      setMode: props.setMode,
    }),
    [live.bootStatus, live.state, live.actions, props.mode, props.setMode]
  );
  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// AppProvider — public root provider
// ---------------------------------------------------------------------------

export function AppProvider(props: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<AppMode>("demo");
  const [modeLoaded, setModeLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await secureGet(MODE_STORAGE_KEY);
      if (cancelled) return;
      if (stored === "live") setModeState("live");
      setModeLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = React.useCallback((m: AppMode) => {
    setModeState(m);
    secureSet(MODE_STORAGE_KEY, m).catch(() => {});
  }, []);

  // Wait until we know which mode to render to avoid flicker.
  if (!modeLoaded) return null;

  if (mode === "live") {
    return (
      <LiveBridge mode={mode} setMode={setMode}>
        {props.children}
      </LiveBridge>
    );
  }

  return (
    <DemoBridge mode={mode} setMode={setMode}>
      {props.children}
    </DemoBridge>
  );
}

// ---------------------------------------------------------------------------
// useApp — the single hook all screens import
// ---------------------------------------------------------------------------

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider />");
  return ctx;
}
