import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GlassPanel, NeonButton } from "../ui/neon";
import { getAppById } from "../world/AppRegistry";
import { EnvelopeSchema, type BusEnvelope } from "@world-engine/protocol";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3017",
  "http://127.0.0.1:3017",
];

const ALLOWED_MESSAGE_TYPES = new Set([
  "preview.input.move",
  "preview.input.action",
  "preview.ping",
  "preview.diagnostics",
]);

export function IFrameAppPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const listenerBoundRef = useRef(false);
  const app = useMemo(() => (id ? getAppById(id) : null), [id]);

  useEffect(() => {
    if (app?.kind === "route" && app.path) {
      navigate(app.path, { replace: true });
    }
  }, [app, navigate]);

  const allowedOrigins = useMemo(() => {
    const envValue = (import.meta.env.VITE_IFRAME_ALLOWED_ORIGINS ?? "") as string;
    const fromEnv = envValue
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const merged = new Set<string>([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]);

    if (app?.url) {
      try {
        merged.add(new URL(app.url).origin);
      } catch {
        // ignore invalid URL in registry
      }
    }

    return merged;
  }, [app?.url]);

  useEffect(() => {
    if (listenerBoundRef.current) {
      return;
    }

    const handler = (evt: MessageEvent) => {
      if (!allowedOrigins.has(evt.origin)) {
        console.warn(`[iframe ${id}] Rejected message from disallowed origin: ${evt.origin}`);
        return;
      }

      if (evt.source !== iframeRef.current?.contentWindow) {
        console.warn(`[iframe ${id}] Message source mismatch`);
        return;
      }

      const parsed = EnvelopeSchema.safeParse(evt.data);
      if (!parsed.success) {
        console.warn(`[iframe ${id}] Rejected message with invalid envelope shape`);
        return;
      }

      const envelope = parsed.data as BusEnvelope<string, unknown>;
      const msgType = envelope.type;
      if (typeof msgType !== "string" || !ALLOWED_MESSAGE_TYPES.has(msgType)) {
        console.warn(`[iframe ${id}] Rejected disallowed message type: ${String(msgType)}`);
        return;
      }

      try {
        if (msgType === "preview.input.move") {
          const payload = envelope.payload as { x?: unknown; y?: unknown };
          if (typeof payload?.x !== "number" || typeof payload?.y !== "number") {
            throw new TypeError("Invalid move payload");
          }
        }

        if (msgType === "preview.input.action") {
          const payload = envelope.payload as { action?: unknown };
          if (typeof payload?.action !== "string") {
            throw new TypeError("Invalid action payload");
          }
        }
      } catch (err) {
        console.warn(`[iframe ${id}] Message validation failed:`, err);
        return;
      }

      globalThis.dispatchEvent(new CustomEvent("ide.iframe.message", { detail: envelope }));
      console.log(`[iframe ${id}] Accepted message type: ${msgType}`);
    };

    listenerBoundRef.current = true;
    globalThis.addEventListener("message", handler);
    return () => {
      listenerBoundRef.current = false;
      globalThis.removeEventListener("message", handler);
    };
  }, [allowedOrigins, id]);

  if (app?.kind === "route" && app.path) {
    return (
      <GlassPanel className="rounded-2xl p-5 max-w-3xl mx-auto">
        <div className="font-bold">Redirecting…</div>
        <div className="text-white/60 mt-1 text-sm">This app is registered as an internal route.</div>
      </GlassPanel>
    );
  }

  if (app?.kind !== "iframe" || !app?.url) {
    return (
      <GlassPanel className="rounded-2xl p-5 max-w-3xl mx-auto">
        <div className="font-bold">App not found</div>
        <div className="text-white/60 mt-1 text-sm">No iframe app registered for: {id}</div>
        <div className="mt-4">
          <NeonButton variant="ghost" onClick={() => navigate("/")}>
            Back
          </NeonButton>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <GlassPanel className="rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-bold tracking-wide">{app.name}</div>
          <div className="text-white/60 text-sm">{app.url}</div>
        </div>
        <div className="flex gap-2">
          <NeonButton variant="ghost" onClick={() => navigate("/")}>
            Launcher
          </NeonButton>
          <NeonButton onClick={() => globalThis.open(app.url, "_blank", "noopener,noreferrer")}>
            Open New Tab
          </NeonButton>
        </div>
      </GlassPanel>

      <div className="mt-4 glass-panel rounded-2xl overflow-hidden h-[75vh]">
        <iframe
          ref={iframeRef}
          src={app.url}
          title={app.name}
          className="w-full h-full"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
        />
      </div>

      <div className="text-xs text-white/45 mt-3 px-1">
        If the iframe is blank, that app likely blocks embedding (X-Frame-Options / CSP). In that
        case use "Open New Tab" or proxy it. postMessage security uses strict origin and type
        allowlists.
      </div>
    </div>
  );
}
