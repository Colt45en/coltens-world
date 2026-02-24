import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton } from "../ui/neon";
import React from "react";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto">
      <GlassPanel className="rounded-2xl p-6">
        <div className="font-bold text-lg">404 — Lost in the grid</div>
        <div className="text-white/60 mt-2">That route doesn't exist in this world.</div>
        <div className="mt-4">
          <NeonButton onClick={() => navigate("/")}>Back to Launcher</NeonButton>
        </div>
      </GlassPanel>
    </div>
  );
}
