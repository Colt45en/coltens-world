"""
BRAIN ARCHITECTURE: Digital Twin Cortex → PREFRONTAL (Workflow Orchestrator)

Command handler + workflow runner that sequences the complete pipeline:
1. RETINA: Ingest DICOM → normalized volume
2. V-CORTEX: Segment volume → labeled anatomy
3. CONNECTOME: Build graph → topological model
4. BRAINSTEM: Simulate → hemodynamic timeline
5. OCCIPITAL: Render → 2D frame sequence (hash chained)
6. Export → deterministic bundle

Cognition waits for dt.tool.result events by call_id, enabling deterministic workflows.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict

from ..contracts_v1_schema import make_v1_command
from ..contracts_v1_types import V1EventEnvelope, V1CommandEnvelope
from ..event_bus import EventBus

COGNITION_EMIT_COMMAND = "cognition.request_emit"


class DigitalTwinCognition:
    """
    PREFRONTAL cortex: orchestrates Digital Twin reconstruction workflows.

    - Handles dt.case.reconstruct commands
    - Sequences tool calls (ingest → segment → connectome → simulate → render → export)
    - Waits for dt.tool.result by call_id
    - Emits progress events (dt.case.ingested, dt.segmentation.completed, etc.)
    """

    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        self._waiters: Dict[str, asyncio.Future[Dict[str, Any]]] = {}

        self.bus.subscribe_event("dt.tool.result", self._on_tool_result)
        self.bus.register_command_handler("dt.case.reconstruct", self._cmd_reconstruct)

    async def _on_tool_result(self, evt: V1EventEnvelope) -> None:
        """Handle tool result events: resolve waiting Futures."""
        p = dict(evt.payload or {})
        call_id = str(p.get("call_id", ""))
        fut = self._waiters.get(call_id)
        if fut is not None and not fut.done():
            fut.set_result(p)

    async def _await_call(
        self, call_id: str, timeout_s: float = 120.0
    ) -> Dict[str, Any]:
        """Wait for tool result by call_id."""
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self._waiters[call_id] = fut
        try:
            return await asyncio.wait_for(fut, timeout=timeout_s)
        finally:
            self._waiters.pop(call_id, None)

    async def _emit(
        self,
        trace_id: str,
        event_type: str,
        payload: Dict[str, Any],
        priority: str = "normal",
    ) -> None:
        """Request Nucleus to emit event."""
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

    async def _cmd_reconstruct(self, cmd: V1CommandEnvelope) -> Dict[str, object]:
        """
        Handle dt.case.reconstruct command: launch full pipeline in background.

        Payload:
            case_id: Case identifier
            dicom_path: Path to DICOM series
            systems: List of systems to reconstruct ["vascular", "skeletal"]
            duration_ms: Simulation duration
            fps: Target frame rate for rendering

        Returns:
            {"accepted": True, "case_id": case_id}
        """
        payload = dict(cmd.payload or {})
        case_id = str(payload["case_id"])
        dicom_path = str(payload.get("dicom_path", ""))
        systems = list(payload.get("systems", ["vascular"]))
        duration_ms = int(payload.get("duration_ms", 1000))
        fps = int(payload.get("fps", 30))

        # Launch pipeline in background
        asyncio.create_task(
            self._run_pipeline(
                trace_id=cmd.trace_id,
                case_id=case_id,
                dicom_path=dicom_path,
                systems=systems,
                duration_ms=duration_ms,
                fps=fps,
            )
        )

        return {"accepted": True, "case_id": case_id}

    async def _run_pipeline(
        self,
        *,
        trace_id: str,
        case_id: str,
        dicom_path: str,
        systems: list[str],
        duration_ms: int,
        fps: int,
    ) -> None:
        """
        Execute complete Digital Twin pipeline.

        Sequence:
        1. Ingest → case.volume
        2. Segment → labels.anatomy
        3. Build connectome → vascular.graph
        4. Simulate → sim.timeline
        5. Render frames (hash chained)
        6. Export → bundle.zip
        """
        await self._emit(
            trace_id,
            "dt.scenario.started",
            {"case_id": case_id, "scenario": "reconstruct_v1"},
        )

        # 1) RETINA: Ingest
        call_ingest = f"{case_id}:ingest"
        cmd = make_v1_command(
            command_type="nucleus.tool_call",
            ts_ms=int(time.time() * 1000),
            trace_id=trace_id,
            payload={
                "tool": "digital_twin.ingest",
                "args": {
                    "case_id": case_id,
                    "dicom_path": dicom_path,
                    "call_id": call_ingest,
                },
            },
        )
        await self.bus.send_command(cmd)

        r_ingest = await self._await_call(call_ingest)
        if not r_ingest.get("ok"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "stage": "ingest",
                    "error": r_ingest.get("error", ""),
                },
            )
            return

        volume_ref = r_ingest["result"]["artifact_ref"]
        volume_hash = volume_ref["hash"]
        await self._emit(
            trace_id, "dt.case.ingested", {"case_id": case_id, "volume_ref": volume_ref}
        )

        # 2) V-CORTEX: Segment
        call_seg = f"{case_id}:segment"
        cmd = make_v1_command(
            command_type="nucleus.tool_call",
            ts_ms=int(time.time() * 1000),
            trace_id=trace_id,
            payload={
                "tool": "digital_twin.segment",
                "args": {
                    "case_id": case_id,
                    "call_id": call_seg,
                    "volume_hash": volume_hash,
                    "target_labels": [
                        "aorta",
                        "carotid_left",
                        "carotid_right",
                        "heart_lv",
                    ],
                },
            },
        )
        await self.bus.send_command(cmd)

        r_seg = await self._await_call(call_seg)
        if not r_seg.get("ok"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "stage": "segment",
                    "error": r_seg.get("error", ""),
                },
            )
            return

        labels_ref = r_seg["result"]["artifact_ref"]
        labels_hash = labels_ref["hash"]
        await self._emit(
            trace_id,
            "dt.segmentation.completed",
            {"case_id": case_id, "labels_ref": labels_ref},
        )

        # 3) CONNECTOME: Build graph
        call_graph = f"{case_id}:connectome"
        cmd = make_v1_command(
            command_type="nucleus.tool_call",
            ts_ms=int(time.time() * 1000),
            trace_id=trace_id,
            payload={
                "tool": "digital_twin.build_connectome",
                "args": {
                    "case_id": case_id,
                    "call_id": call_graph,
                    "labels_hash": labels_hash,
                    "system": systems[0] if systems else "vascular",
                    "nodes": 96,
                },
            },
        )
        await self.bus.send_command(cmd)

        r_graph = await self._await_call(call_graph)
        if not r_graph.get("ok"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "stage": "connectome",
                    "error": r_graph.get("error", ""),
                },
            )
            return

        graph_ref = r_graph["result"]["artifact_ref"]
        await self._emit(
            trace_id,
            "dt.connectome.completed",
            {"case_id": case_id, "graph_ref": graph_ref},
        )

        # 4) BRAINSTEM: Simulate
        call_sim = f"{case_id}:simulate"
        cmd = make_v1_command(
            command_type="nucleus.tool_call",
            ts_ms=int(time.time() * 1000),
            trace_id=trace_id,
            payload={
                "tool": "digital_twin.simulate",
                "args": {
                    "case_id": case_id,
                    "call_id": call_sim,
                    "graph_hash": graph_ref["hash"],
                    "duration_ms": duration_ms,
                    "dt_ms": 16,
                    "heart_rate_bpm": 72,
                },
            },
        )
        await self.bus.send_command(cmd)

        r_sim = await self._await_call(call_sim)
        if not r_sim.get("ok"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "stage": "simulate",
                    "error": r_sim.get("error", ""),
                },
            )
            return

        sim_ref = r_sim["result"]["artifact_ref"]
        frames = int(r_sim["result"].get("frames", 0))
        await self._emit(
            trace_id,
            "dt.sim.completed",
            {"case_id": case_id, "sim_ref": sim_ref, "frames": frames},
        )

        # 5) OCCIPITAL: Render timeline (hash chained)
        prev_hash = ""
        total_frames = max(1, min(frames, int((duration_ms / 1000) * fps)))

        for i in range(total_frames):
            call_render = f"{case_id}:render:{i}"
            cmd = make_v1_command(
                command_type="nucleus.tool_call",
                ts_ms=int(time.time() * 1000),
                trace_id=trace_id,
                payload={
                    "tool": "digital_twin.render2d",
                    "args": {
                        "case_id": case_id,
                        "call_id": call_render,
                        "graph_ref": graph_ref,
                        "sim_ref": sim_ref,
                        "frame_id": i,
                        "time_ms": int(i * (1000 / max(fps, 1))),
                        "prev_hash": prev_hash,
                        "camera": {"type": "mip_vascular", "slice_z_mm": 120},
                        "overlays": ["vessels", "flow_arrows", "pressure_heatmap"],
                        "width": 1280,
                        "height": 720,
                    },
                },
            )
            await self.bus.send_command(cmd)

            r_frame = await self._await_call(call_render, timeout_s=60.0)
            if not r_frame.get("ok"):
                await self._emit(
                    trace_id,
                    "dt.health.failed",
                    {
                        "case_id": case_id,
                        "stage": "render",
                        "frame": i,
                        "error": r_frame.get("error", ""),
                    },
                )
                return

            prev_hash = r_frame["result"]["hash"]
            await self._emit(
                trace_id,
                "dt.render.frame_completed",
                {"case_id": case_id, **r_frame["result"]},
            )

        # 6) Export bundle
        call_export = f"{case_id}:export"
        cmd = make_v1_command(
            command_type="nucleus.tool_call",
            ts_ms=int(time.time() * 1000),
            trace_id=trace_id,
            payload={
                "tool": "digital_twin.export",
                "args": {"case_id": case_id, "call_id": call_export},
            },
        )
        await self.bus.send_command(cmd)

        r_exp = await self._await_call(call_export, timeout_s=60.0)
        if not r_exp.get("ok"):
            await self._emit(
                trace_id,
                "dt.health.failed",
                {
                    "case_id": case_id,
                    "stage": "export",
                    "error": r_exp.get("error", ""),
                },
            )
            return

        await self._emit(
            trace_id, "dt.export.completed", {"case_id": case_id, **r_exp["result"]}
        )
        await self._emit(
            trace_id,
            "dt.scenario.completed",
            {
                "case_id": case_id,
                "scenario": "reconstruct_v1",
                "bundle": r_exp["result"],
            },
        )
