/**
 * Sim Panel: Start/Stop sim server + show status + display snapshots
 */

export type SimPanelSetters = {
    setSimStatus: (s: string) => void;
    setSimPort: (port: number | null) => void;
    appendSimLog: (line: string) => void;
    clearSimLog: () => void;
    showSnapshot: (tick: number, entityCount: number) => void;
};

export function mountSimPanel(
    container: HTMLElement
): SimPanelSetters {
    container.innerHTML = `
    <div class="sim-section">
      <h3>Sim Server</h3>
      <div class="sim-status">
        <span id="status-badge" class="badge badge-idle">idle</span>
        <span id="port-display" class="port-display"></span>
      </div>
      <div class="sim-controls">
        <button id="btn-start" class="btn btn-primary">Start (dev)</button>
        <button id="btn-stop" class="btn btn-secondary" disabled>Stop</button>
        <button id="btn-status" class="btn btn-tertiary">Status</button>
      </div>
      <div class="sim-info">
        <div id="snapshot-info" class="snapshot-info"></div>
      </div>
      <div class="sim-log" id="sim-log"></div>
    </div>
  `;

    const statusBadge = container.querySelector("#status-badge") as HTMLElement;
    const portDisplay = container.querySelector("#port-display") as HTMLElement;
    const btnStart = container.querySelector("#btn-start") as HTMLButtonElement;
    const btnStop = container.querySelector("#btn-stop") as HTMLButtonElement;
    const btnStatus = container.querySelector("#btn-status") as HTMLButtonElement;
    const snapshotInfo = container.querySelector("#snapshot-info") as HTMLElement;
    const logBox = container.querySelector("#sim-log") as HTMLElement;

    let currentPort: number | null = null;

    return {
        setSimStatus(s: string) {
            if (s.includes("running")) {
                statusBadge.textContent = "running";
                statusBadge.className = "badge badge-running";
                btnStart.disabled = true;
                btnStop.disabled = false;
            } else if (s.includes("ok")) {
                statusBadge.textContent = "ok";
                statusBadge.className = "badge badge-ok";
                btnStart.disabled = false;
                btnStop.disabled = true;
            } else if (s.includes("fail")) {
                statusBadge.textContent = "fail";
                statusBadge.className = "badge badge-fail";
                btnStart.disabled = false;
                btnStop.disabled = true;
            } else {
                statusBadge.textContent = "idle";
                statusBadge.className = "badge badge-idle";
                btnStart.disabled = false;
                btnStop.disabled = true;
            }
        },

        setSimPort(port: number | null) {
            currentPort = port;
            if (port) {
                portDisplay.textContent = `[ws://localhost:${port}]`;
                portDisplay.style.display = "inline";
            } else {
                portDisplay.style.display = "none";
            }
        },

        appendSimLog(line: string) {
            const logItem = document.createElement("div");
            logItem.className = "log-line";
            logItem.textContent = line;
            logBox.appendChild(logItem);
            logBox.scrollTop = logBox.scrollHeight;
        },

        clearSimLog() {
            logBox.innerHTML = "";
        },

        showSnapshot(tick: number, entityCount: number) {
            snapshotInfo.textContent = `Tick: ${tick}, Entities: ${entityCount}`;
        },
    };
}
