/**
 * BootRedirect — Restore previous session on boot
 *
 * If `enabled`, navigates to last visited path (if not already there).
 * Silently no-ops if we're already on a non-root route.
 *
 * Usage: <BootRedirect enabled={true} /> on your root/launcher page
 */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bumpBoot, loadAppState } from "./appState";

export function BootRedirect({ enabled }: { enabled: boolean }) {
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    bumpBoot();
    if (!enabled) return;

    const params = new URLSearchParams(location.search);
    if (params.get("home") === "1") {
      return;
    }

    const s = loadAppState();
    // Only redirect if we have a saved path and we're on root
    if (s.lastPath && s.lastPath !== "/") {
      nav(s.lastPath, { replace: true });
    }
  }, [enabled, nav, location.search]);

  return null;
}
