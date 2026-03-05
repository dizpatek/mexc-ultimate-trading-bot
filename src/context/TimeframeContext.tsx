"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";

export type Timeframe = "1m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1M";

interface TimeframeContextValue {
  /** The global timeframe selected in the sidebar */
  timeframe: Timeframe;
  /** Set the global timeframe */
  setTimeframe: (tf: Timeframe) => void;
  /** Human-readable label for the current timeframe */
  label: string;
  /** Whether all modules are locked to the global timeframe */
  locked: boolean;
  /** Toggle the lock state */
  toggleLock: () => void;
}

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1m": "1 Minute",
  "15m": "15 Minutes",
  "1h": "1 Hour",
  "4h": "4 Hours",
  "1d": "1 Day",
  "1w": "1 Week",
  "1M": "1 Month",
};

const TimeframeContext = createContext<TimeframeContextValue | undefined>(
  undefined,
);

export const TimeframeProvider = ({
  children,
  defaultTimeframe = "4h",
}: {
  children: ReactNode;
  defaultTimeframe?: Timeframe;
}) => {
  const [timeframe, setTimeframeState] = useState<Timeframe>(defaultTimeframe);
  const [locked, setLocked] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Initial load from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("matrix_timeframe");
    if (cached) setTimeframeState(cached as Timeframe);

    const cachedLocked = localStorage.getItem("matrix_timeframe_locked");
    if (cachedLocked !== null) setLocked(cachedLocked === "true");

    setIsMounted(true);
  }, []);

  // Sync localStorage whenever states change (without API overhead)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("matrix_timeframe", timeframe);
      localStorage.setItem("matrix_timeframe_locked", String(locked));
    }
  }, [timeframe, locked, isMounted]);

  const setTimeframe = useCallback((tf: Timeframe) => {
    setTimeframeState(tf);
  }, []);

  const toggleLock = useCallback(() => {
    setLocked((prev) => !prev);
  }, []);

  const contextValue = useMemo(
    () => ({
      timeframe,
      setTimeframe,
      label: TIMEFRAME_LABELS[timeframe],
      locked,
      toggleLock,
    }),
    [timeframe, setTimeframe, locked, toggleLock],
  );

  return (
    <TimeframeContext.Provider value={contextValue}>
      {children}
    </TimeframeContext.Provider>
  );
};

export const useTimeframe = (): TimeframeContextValue => {
  const context = useContext(TimeframeContext);
  if (!context) {
    throw new Error("useTimeframe must be used within a TimeframeProvider");
  }
  return context;
};

/**
 * Hook for modules that have their own local timeframe.
 * When locked=true, returns the global timeframe and a stable no-op setter.
 * When locked=false, returns the local timeframe and its setter.
 */
export const useModuleTimeframe = (
  defaultLocal: string = "1h",
): [string, (tf: string) => void] => {
  const { timeframe: globalTf, locked } = useTimeframe();
  const [localTf, setLocalTf] = useState<string>(defaultLocal);

  // Synchronize local state with global state when locked.
  // We use a small delay to avoid ESLint rules against synchronous
  // state updates inside effects, while avoiding render-phase updates.
  useEffect(() => {
    if (locked) {
      const timer = setTimeout(() => setLocalTf(globalTf), 0);
      return () => clearTimeout(timer);
    }
  }, [locked, globalTf]);

  // Stable no-op setter to avoid unnecessary re-renders when locked
  const noopSetter = useCallback(() => {}, []);

  const effectiveTf = locked ? globalTf : localTf;
  const effectiveSetter = locked ? noopSetter : setLocalTf;

  return [effectiveTf, effectiveSetter];
};

export { TIMEFRAME_LABELS };
