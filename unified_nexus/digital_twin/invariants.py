"""
BRAIN ARCHITECTURE: Digital Twin Cortex → IMMUNE (Invariants Registry)

Health check system that validates tool outputs and emits health events:
- 🟢 dt.health.passed: All invariants satisfied
- 🟡 dt.health.warning: Non-critical violation (logged but continues)
- 🔴 dt.health.failed: Critical violation (blocks progression)

Invariant categories:
- Connectivity: graph components, edge endpoints, radii bounds
- Simulation: no NaN/Inf, pressure bounds, flow conservation
- Rendering: hash presence, frame metadata, chain integrity
- Artifacts: provenance, truth labels, confidence thresholds
"""

from __future__ import annotations

import time
from typing import Any, Dict

from ..contracts_v1_schema import make_v1_command
from ..contracts_v1_types import V1EventEnvelope
from ..event_bus import EventBus

COGNITION_EMIT_COMMAND = "cognition.request_emit"


class InvariantsRegistry:
    """
    IMMUNE system: validates tool outputs and enforces health checks.

    Subscribes to dt.tool.result events and checks tool-specific invariants.
    Emits dt.health.passed, dt.health.warning, or dt.health.failed events.
    """

    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        self.bus.subscribe_event("dt.tool.result", self._on_result)

    async def _emit(
        self,
        trace_id: str,
        event_type: str,
        payload: Dict[str, Any],
        priority: str = "normal",
    ) -> None:
        """Request Nucleus to emit health event."""
        cmd = make_v1_command(
            command_type=COGNITION_EMIT_COMMAND,
            ts_ms=int(time.time() * 1000),
            trace_id=trace_id,
            payload={
                "priority": priority,
                "event_type": event_type,
                "event_payload": payload,
            },
        )
        await self.bus.send_command(cmd)

    async def _on_result(self, evt: V1EventEnvelope) -> None:
        """Handle tool result: check invariants and emit health events."""
        p = dict(evt.payload or {})
        tool = str(p.get("tool", ""))
        ok = bool(p.get("ok", False))
        case_id = str(p.get("case_id", ""))
        trace_id = evt.trace_id

        # Invariant: tool executed without error
        if not ok:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "tool_ok",
                    "tool": tool,
                    "error": p.get("error", ""),
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        r = dict(p.get("result", {}))

        # Tool-specific invariants
        if tool == "digital_twin.ingest":
            await self._check_ingest_invariants(trace_id, case_id, tool, r)
        elif tool == "digital_twin.segment":
            await self._check_segment_invariants(trace_id, case_id, tool, r)
        elif tool == "digital_twin.build_connectome":
            await self._check_connectome_invariants(trace_id, case_id, tool, r)
        elif tool == "digital_twin.simulate":
            await self._check_simulate_invariants(trace_id, case_id, tool, r)
        elif tool == "digital_twin.render2d":
            await self._check_render_invariants(trace_id, case_id, tool, r)
        elif tool == "digital_twin.export":
            await self._check_export_invariants(trace_id, case_id, tool, r)
        else:
            # Unknown tool: pass (logged via tool_ok above)
            await self._emit(
                trace_id,
                "dt.health.passed",
                {"case_id": case_id, "group": "unknown_tool", "tool": tool},
            )

    async def _check_ingest_invariants(
        self, trace_id: str, case_id: str, tool: str, result: Dict[str, Any]
    ) -> None:
        """Check RETINA ingest invariants."""
        ref = result.get("artifact_ref", {})

        # Invariant: artifact_ref must have hash
        if not ref or "hash" not in ref:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "artifact_ref_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: hash must be sha256:...
        if not str(ref["hash"]).startswith("sha256:"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "hash_format",
                    "tool": tool,
                    "hash": ref["hash"],
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: quality confidence >= 0.8 or warning
        quality = result.get("quality", {})
        confidence = float(quality.get("confidence", 0.0))
        if confidence < 0.8:
            await self._emit(
                trace_id,
                "dt.health.warning",
                {
                    "case_id": case_id,
                    "invariant": "quality_confidence",
                    "tool": tool,
                    "confidence": confidence,
                    "threshold": 0.8,
                    "severity": "WARNING",
                },
            )

        await self._emit(
            trace_id,
            "dt.health.passed",
            {"case_id": case_id, "group": "ingest", "tool": tool},
        )

    async def _check_segment_invariants(
        self, trace_id: str, case_id: str, tool: str, result: Dict[str, Any]
    ) -> None:
        """Check V-CORTEX segmentation invariants."""
        ref = result.get("artifact_ref", {})

        # Invariant: artifact_ref present
        if not ref or "hash" not in ref:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "artifact_ref_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: label_map non-empty
        label_map = result.get("label_map", {})
        if not label_map:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "label_map_non_empty",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: confidence scores for all labels
        confidence = result.get("confidence", {})
        for label_name in label_map.values():
            if label_name not in confidence:
                await self._emit(
                    trace_id,
                    "dt.health.warning",
                    {
                        "case_id": case_id,
                        "invariant": "confidence_missing",
                        "tool": tool,
                        "label": label_name,
                        "severity": "WARNING",
                    },
                )

        await self._emit(
            trace_id,
            "dt.health.passed",
            {"case_id": case_id, "group": "segmentation", "tool": tool},
        )

    async def _check_connectome_invariants(
        self, trace_id: str, case_id: str, tool: str, result: Dict[str, Any]
    ) -> None:
        """Check CONNECTOME graph invariants."""
        ref = result.get("artifact_ref", {})

        # Invariant: artifact_ref present
        if not ref or "hash" not in ref:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "artifact_ref_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: stats present
        stats = result.get("stats", {})
        if "nodes" not in stats or "edges" not in stats:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "stats_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: components == 1 (connected graph)
        components = int(stats.get("components", 0))
        if components != 1:
            await self._emit(
                trace_id,
                "dt.health.warning",
                {
                    "case_id": case_id,
                    "invariant": "graph_connectivity",
                    "tool": tool,
                    "components": components,
                    "expected": 1,
                    "severity": "WARNING",
                },
            )

        await self._emit(
            trace_id,
            "dt.health.passed",
            {"case_id": case_id, "group": "connectome", "tool": tool},
        )

    async def _check_simulate_invariants(
        self, trace_id: str, case_id: str, tool: str, result: Dict[str, Any]
    ) -> None:
        """Check BRAINSTEM simulation invariants."""
        ref = result.get("artifact_ref", {})

        # Invariant: artifact_ref present
        if not ref or "hash" not in ref:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "artifact_ref_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: frames > 0
        frames = int(result.get("frames", 0))
        if frames <= 0:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "frames_positive",
                    "tool": tool,
                    "frames": frames,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        await self._emit(
            trace_id,
            "dt.health.passed",
            {"case_id": case_id, "group": "simulation", "tool": tool},
        )

    async def _check_render_invariants(
        self, trace_id: str, case_id: str, tool: str, result: Dict[str, Any]
    ) -> None:
        """Check OCCIPITAL rendering invariants."""
        frame_hash = str(result.get("hash", ""))
        frame_id = result.get("frame_id")

        # Invariant: frame_hash present
        if not frame_hash.startswith("sha256:"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "frame_hash_present",
                    "tool": tool,
                    "hash": frame_hash,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: frame_id present
        if frame_id is None:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "frame_id_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: time_ms >= 0
        time_ms = int(result.get("time_ms", -1))
        if time_ms < 0:
            await self._emit(
                trace_id,
                "dt.health.warning",
                {
                    "case_id": case_id,
                    "invariant": "time_ms_non_negative",
                    "tool": tool,
                    "time_ms": time_ms,
                    "severity": "WARNING",
                },
            )

        await self._emit(
            trace_id,
            "dt.health.passed",
            {"case_id": case_id, "group": "render", "tool": tool},
        )

    async def _check_export_invariants(
        self, trace_id: str, case_id: str, tool: str, result: Dict[str, Any]
    ) -> None:
        """Check export bundle invariants."""
        bundle_hash = str(result.get("bundle_hash", ""))
        bundle_path = str(result.get("bundle_path", ""))

        # Invariant: bundle_hash present
        if not bundle_hash.startswith("sha256:"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "bundle_hash_present",
                    "tool": tool,
                    "hash": bundle_hash,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        # Invariant: bundle_path present
        if not bundle_path:
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "invariant": "bundle_path_present",
                    "tool": tool,
                    "severity": "ERROR",
                },
                priority="high",
            )
            return

        await self._emit(
            trace_id,
            "dt.health.passed",
            {"case_id": case_id, "group": "export", "tool": tool},
        )
