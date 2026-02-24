import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./style.css";
import "./styles/neon-nexus.css";
import { SystemStatusProvider } from "./system/SystemStatusContext";
import { WorldRouter } from "./world/WorldRouter";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");

// Mount React with Router + System Status
const reactRoot = createRoot(root);
reactRoot.render(
  <React.StrictMode>
    <SystemStatusProvider>
      <BrowserRouter>
        <WorldRouter />
      </BrowserRouter>
    </SystemStatusProvider>
  </React.StrictMode>,
);

/*
// Original WebSocket IDE setup (preserved for reference)
import { WsClient } from "./bus/wsClient";
import { mountLayout } from "./ui/layout";

let venoPanel: HTMLElement | null = null;
let setPreviewStats: ((fps: number, frameMs: number) => void) | null = null;
let setLastFileChange: ((kind: string, p: string) => void) | null = null;
let simPanel: any = null;

const ws = new WsClient("ws://localhost:3000", {
  onWelcome: (env) => {
    const mounted = mountLayout(root, ws);
    venoPanel = mounted.venoPanel;
    setPreviewStats = mounted.setPreviewStats;
    setLastFileChange = mounted.setLastFileChange;
    simPanel = mounted.simPanel;
    console.log("[ide] welcome", env.payload);

    // Wire up sim panel buttons
    const btnStart = root.querySelector("#btn-start") as HTMLButtonElement;
    const btnStop = root.querySelector("#btn-stop") as HTMLButtonElement;
    const btnStatus = root.querySelector("#btn-status") as HTMLButtonElement;

    if (btnStart) {
      btnStart.addEventListener("click", () => {
        ws.send("ops.sim.start", { mode: "dev", port: 4010 });
      });
    }
    if (btnStop) {
      btnStop.addEventListener("click", () => {
        ws.send("ops.sim.stop", {});
      });
    }
    if (btnStatus) {
      btnStatus.addEventListener("click", () => {
        ws.send("ops.sim.status", {});
      });
    }
  },
  onFileChange: (kind, path) => {
    if (setLastFileChange) setLastFileChange(kind, path);
  },
  onPreviewStats: (fps, frameMs) => {
    if (setPreviewStats) setPreviewStats(fps, frameMs);
  },
});
*/
