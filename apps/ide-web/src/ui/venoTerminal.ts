import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import type { WsClient } from "../bus/wsClient";

import "xterm/css/xterm.css";

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let last = 0;
    let t: number | null = null;
    let pendingArgs: any[] | null = null;

    const run = () => {
        last = Date.now();
        t = null;
        if (pendingArgs) {
            fn(...pendingArgs);
            pendingArgs = null;
        }
    };

    return ((...args: any[]) => {
        const now = Date.now();
        const delta = now - last;
        if (delta >= ms) {
            last = now;
            fn(...args);
        } else {
            pendingArgs = args;
            if (t === null) {
                t = window.setTimeout(run, ms - delta);
            }
        }
    }) as T;
}

export function createVenoTerminal(ws: WsClient): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "panel";

    const title = document.createElement("div");
    title.className = "panelTitle";
    title.textContent = "Veno (Python PTY)";
    wrap.appendChild(title);

    const body = document.createElement("div");
    body.className = "panelBody";
    body.style.padding = "6px";

    const terminalDiv = document.createElement("div");
    terminalDiv.style.height = "100%";
    terminalDiv.style.width = "100%";
    terminalDiv.style.borderRadius = "10px";
    terminalDiv.style.overflow = "hidden";
    terminalDiv.style.border = "1px solid #1d1d2a";
    body.appendChild(terminalDiv);

    wrap.appendChild(body);

    const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalDiv);
    fit.fit();

    let ptyId: string | null = null;

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open Veno";
    openBtn.onclick = () => {
        fit.fit();
        ws.send("pty.open", { program: "veno", cols: term.cols, rows: term.rows });
    };

    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.gap = "8px";
    headerRow.style.marginBottom = "6px";
    headerRow.appendChild(openBtn);
    body.prepend(headerRow);

    term.onData((data) => {
        if (!ptyId) return;
        ws.send("pty.input", { ptyId, data });
    });

    const sendResize = throttle(() => {
        if (!ptyId) return;
        fit.fit();
        ws.send("pty.resize", { ptyId, cols: term.cols, rows: term.rows });
    }, 80);

    const ro = new ResizeObserver(() => sendResize());
    ro.observe(terminalDiv);

    // expose hooks
    (wrap as any).__veno_setPtyId = (id: string) => {
        ptyId = id;
        term.write("\r\n[veno] connected ✅ (resize enabled)\r\n");
        sendResize();
    };
    (wrap as any).__veno_onOutput = (id: string, data: string) => {
        if (!ptyId || id !== ptyId) return;
        term.write(data);
    };

    return wrap;
}
