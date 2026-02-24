/**
 * Example: Integrating IDE Storage into main.tsx
 * Copy-paste this pattern into your app startup
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { storage } from "@/utils/storage";
import App from "./App";

async function initializeApp() {
  // 1. Initialize storage (load from localStorage, run migrations, etc.)
  try {
    await storage.initialize();
    console.log("✅ Storage initialized");
  } catch (error) {
    console.error("❌ Storage init failed:", error);
    // App will still work with defaults
  }

  // 2. Optional: Setup global debug access
  if (import.meta.env.DEV) {
    (window as any).__ideStorage = storage;
    console.log("💾 Storage available at window.__ideStorage");
  }

  // 3. Render app
  const root = document.getElementById("root");
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

// Start the app
initializeApp().catch((err) => {
  console.error("🔥 App startup failed:", err);
});
