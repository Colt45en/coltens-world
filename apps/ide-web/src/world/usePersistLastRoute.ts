/**
 * usePersistLastRoute — Automatically track navigation
 *
 * Drop this in any layout component to save route on every navigation.
 * Works transparently with React Router.
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setLastPath } from "./appState";

export function usePersistLastRoute(appId?: string) {
    const loc = useLocation();

    useEffect(() => {
        const path = loc.pathname + loc.search + loc.hash;
        setLastPath(path, appId);
    }, [loc.pathname, loc.search, loc.hash, appId]);
}
