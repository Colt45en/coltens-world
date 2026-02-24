/**
 * SystemStatusContext — Global state for service health
 *
 * Provides:
 * - status: SystemStatus (current health of WS + services)
 * - setStatus: update the status (called when services respond/fail)
 *
 * Usage:
 *   const { status, setStatus } = useSystemStatus();
 */

import React, { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_SYSTEM_STATUS } from "./systemStatus";

type SystemStatusState = typeof DEFAULT_SYSTEM_STATUS;

type Ctx = {
  status: SystemStatusState;
  setStatus: React.Dispatch<React.SetStateAction<SystemStatusState>>;
};

const SystemStatusContext = createContext<Ctx | null>(null);

export function SystemStatusProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<SystemStatusState>(DEFAULT_SYSTEM_STATUS);
  const value = useMemo(() => ({ status, setStatus }), [status]);

  return <SystemStatusContext.Provider value={value}>{children}</SystemStatusContext.Provider>;
}

export function useSystemStatus() {
  const ctx = useContext(SystemStatusContext);
  if (!ctx) throw new Error("useSystemStatus must be used within SystemStatusProvider");
  return ctx;
}
