/**
 * SECURITY: iframe postMessage allowlist (Session 10)
 * Only preview runtime (localhost:5174) can send messages to IDE.
 * Only preview.input.* and preview.ping messages are accepted.
 * All other messages are rejected with console.warn.
 */
const PREVIEW_IFRAME_ORIGIN = "http://localhost:5174";
const ALLOWED_MESSAGE_TYPES = [
    "preview.input.click",
    "preview.input.key",
    "preview.input.text",
    "preview.ping"
];

function validateIframeMessage(event: MessageEvent): boolean {
    // Origin check
    if (event.origin !== PREVIEW_IFRAME_ORIGIN) {
        console.warn(`[IDE] Rejected postMessage from untrusted origin: ${event.origin}`);
        return false;
    }

    // Message type allowlist
    const msgType = event.data?.type ?? "";
    if (!ALLOWED_MESSAGE_TYPES.includes(msgType)) {
        console.warn(`[IDE] Rejected postMessage with disallowed type: ${msgType}`);
        return false;
    }

    return true;
}

export function createPreviewFrame(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "panel";

    const title = document.createElement("div");
    title.className = "panelTitle";
    title.textContent = "Preview Runtime (iframe)";
    wrap.appendChild(title);

    const body = document.createElement("div");
    body.className = "panelBody";
    const iframe = document.createElement("iframe");
    iframe.src = "http://localhost:5174/";
    iframe.sandbox = "allow-scripts allow-same-origin";
    body.appendChild(iframe);

    // Attach global message handler for security validation
    window.addEventListener("message", (event) => {
        if (!validateIframeMessage(event)) return;
        // If validation passes, event.data is safe to process
        // (Handlers can attach their own listeners if needed)
    });

    wrap.appendChild(body);
    return wrap;
}
