import type { WsClient } from "../bus/wsClient";
import { createPreviewFrame } from "./previewFrame";
import { mountSimPanel, type SimPanelSetters } from "./simPanel";
import { createVenoTerminal } from "./venoTerminal";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
}

export function mountLayout(root: HTMLElement, ws: WsClient): {
    venoPanel: HTMLElement;
    setPreviewStats: (fps: number, frameMs: number) => void;
    setLastFileChange: (kind: string, p: string) => void;
    simPanel: SimPanelSetters;
} {
    root.innerHTML = "";

    const header = el("div", "header");
    header.innerHTML = `<strong>🌍 World Engine IDE</strong><span style="color:#8f8fa7">WS + iframe + Veno PTY + Sim Server</span>`;
    root.appendChild(header);

    const main = el("div", "main");

    const left = el("div", "splitCol");

    const venoPanel = createVenoTerminal(ws);
    left.appendChild(venoPanel);

    // Sim panel
    const simPanelContainer = el("div", "panel");
    const simPanelSetters = mountSimPanel(simPanelContainer);
    left.appendChild(simPanelContainer);

    // System panel
    const sys = el("div", "panel");
    const sysTitle = el("div", "panelTitle");
    sysTitle.textContent = "System";
    const sysBody = el("div", "panelBody");
    sysBody.style.padding = "12px";
    sysBody.style.color = "#bdbdd1";
    sysBody.style.fontSize = "13px";
    sysBody.style.lineHeight = "1.6";

    const lineWs = el("div");
    lineWs.innerHTML = `• Nucleus WS: <code>ws://localhost:3000</code>`;
    const linePrev = el("div");
    linePrev.innerHTML = `• Preview iframe: <code>http://localhost:5174</code>`;

    const stats = el("div");
    stats.style.marginTop = "10px";
    stats.innerHTML = `• Preview stats: <code id="we_fps">—</code> fps, <code id="we_frame">—</code> ms`;

    const files = el("div");
    files.style.marginTop = "10px";
    files.innerHTML = `• Last file change: <code id="we_file">—</code>`;

    const note = el("div");
    note.style.marginTop = "10px";
    note.style.color = "#9aa";
    note.textContent = "Open Veno → terminal runs inside the browser via PTY streaming (with live resize).";

    sysBody.appendChild(lineWs);
    sysBody.appendChild(linePrev);
    sysBody.appendChild(stats);
    sysBody.appendChild(files);
    sysBody.appendChild(note);

    sys.appendChild(sysTitle);
    sys.appendChild(sysBody);
    left.appendChild(sys);

    const right = createPreviewFrame();

    main.appendChild(left);
    main.appendChild(right);

    root.appendChild(main);

    const fpsEl = sysBody.querySelector("#we_fps") as HTMLElement;
    const frameEl = sysBody.querySelector("#we_frame") as HTMLElement;
    const fileEl = sysBody.querySelector("#we_file") as HTMLElement;

    return {
        venoPanel,
        setPreviewStats: (fps, frameMs) => {
            fpsEl.textContent = String(fps);
            frameEl.textContent = String(frameMs);
        },
        setLastFileChange: (kind, p) => {
            fileEl.textContent = `${kind} ${p}`;
        },
        simPanel: simPanelSetters
    };
}
