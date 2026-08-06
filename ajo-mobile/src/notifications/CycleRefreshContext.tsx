import React, { createContext, useCallback, useContext, useRef } from "react";

type CycleRefreshListener = (groupId: string) => void;

interface CycleRefreshContextValue {
  /** Subscribe to cycle-advanced events for a specific group. Returns an unsubscribe function. */
  subscribe: (listener: CycleRefreshListener) => () => void;
  /** Notify all listeners that a cycle has advanced for the given group. */
  notifyCycleAdvanced: (groupId: string) => void;
}

const CycleRefreshContext = createContext<CycleRefreshContextValue | null>(null);

/**
 * Provides a lightweight pub/sub mechanism for cycle-advanced events.
 *
 * When the server broadcasts a CYCLE_ADVANCED push notification, the
 * NotificationHandler receives it and calls `notifyCycleAdvanced(groupId)`.
 * Any screen subscribed to this context will be notified and can refresh
 * its data.
 *
 * This avoids the need for a full state management library while still
 * providing decoupled cross-screen communication.
 */
export function CycleRefreshProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<CycleRefreshListener>>(new Set());

  const subscribe = useCallback((listener: CycleRefreshListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const notifyCycleAdvanced = useCallback((groupId: string) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener(groupId);
      } catch (err) {
        console.error("[CycleRefresh] Listener error:", err);
      }
    });
  }, []);

  return (
    <CycleRefreshContext.Provider value={{ subscribe, notifyCycleAdvanced }}>
      {children}
    </CycleRefreshContext.Provider>
  );
}

export function useCycleRefresh(): CycleRefreshContextValue {
  const ctx = useContext(CycleRefreshContext);
  if (!ctx) {
    throw new Error("useCycleRefresh must be used within a CycleRefreshProvider");
  }
  return ctx;
}