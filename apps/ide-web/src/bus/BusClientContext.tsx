/**
 * WsBusClient Context & Hook
 *
 * Provides global bus client instance to React app.
 * (This allows components to access bus events globally)
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { WsBusClient } from "./wsBusClient";

// Global singleton
let globalBusClient: WsBusClient | null = null;

/**
 * Get or create global bus client singleton
 */
export function getOrCreateBusClient(): WsBusClient {
  if (!globalBusClient) {
    globalBusClient = new WsBusClient({
      url: "ws://localhost:3000",
      reconnectAttempts: 5,
      reconnectDelayMs: 1000,
    });

    // Try to connect but don't block
    globalBusClient.connect().catch((err) => {
      console.warn("[getOrCreateBusClient] Failed to connect:", err);
    });
  }

  return globalBusClient;
}

/**
 * Get bus client if already created and connected
 */
export function useMaybeBusClient(): WsBusClient | undefined {
  try {
    const client = getOrCreateBusClient();
    return client.isConnected ? client : undefined;
  } catch {
    return undefined;
  }
}

// Context for React components
const BusClientContext = createContext<WsBusClient | null>(null);

interface BusClientProviderProps {
  children: React.ReactNode;
}

/**
 * Provider to inject bus client into React tree
 */
export const BusClientProvider: React.FC<BusClientProviderProps> = ({ children }) => {
  const [client, setClient] = useState<WsBusClient | null>(null);

  useEffect(() => {
    const busClient = getOrCreateBusClient();
    setClient(busClient);
  }, []);

  return <BusClientContext.Provider value={client}>{children}</BusClientContext.Provider>;
};

/**
 * Hook to use bus client in components
 */
export const useBusClient = (): WsBusClient | null => {
  const client = useContext(BusClientContext);
  return client;
};
