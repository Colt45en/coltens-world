#!/usr/bin/env python3
"""
Digital Twin Cortex - Test Runner

Automated test script for complete DICOM reconstruction pipeline:
1. Starts the Digital Twin Brain (EventBus + Nucleus + ToolRuntime + Cognition)
2. Sends dt.case.reconstruct command
3. Monitors progress events
4. Validates final bundle

Usage:
    python test_runner.py /path/to/dicom_folder case_id_001

Options:
    --quality-threshold FLOAT    Minimum quality confidence (default: 0.8)
    --timeout SECONDS           Max time to wait for completion (default: 300)
    --export-png                Also export PNG slices
    --export-nifti FILE         Also export NIfTI volume
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import Optional, TypedDict

from ..contracts_v1_schema import V1EventEnvelope

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("test_runner")


class ProgressDict(TypedDict):
    """Type definition for progress tracking dictionary"""
    case_ingested: bool
    segmentation_completed: bool
    connectome_completed: bool
    simulation_completed: bool
    render_frames: int
    export_ready: bool
    health_warnings: list[str]
    health_errors: list[str]


async def run_reconstruction_test(
    dicom_path: str,
    case_id: str,
    quality_threshold: float = 0.8,
    timeout: int = 300,
    export_png: bool = False,
    export_nifti: Optional[str] = None,
) -> bool:
    """
    Run complete reconstruction pipeline test.

    Returns:
        True if successful, False otherwise
    """
    try:
        from ..contracts_v1_schema import make_v1_command
        from ..nucleus.nucleus import NucleusConfig
        from .brain_boot import DigitalTwinBrain
    except ImportError as e:
        logger.error(f"Failed to import Digital Twin modules: {e}")
        logger.error("Make sure you're running from the workspace root")
        return False

    logger.info("=" * 80)
    logger.info("Digital Twin Cortex - Reconstruction Test")
    logger.info("=" * 80)
    logger.info(f"Case ID: {case_id}")
    logger.info(f"DICOM Path: {dicom_path}")
    logger.info(f"Quality Threshold: {quality_threshold}")
    logger.info(f"Timeout: {timeout}s")
    logger.info("=" * 80)

    # Validate input
    dicom_path_obj = Path(dicom_path)
    if not dicom_path_obj.exists():
        logger.error(f"DICOM path does not exist: {dicom_path}")
        return False

    # Initialize brain components
    logger.info("Initializing Digital Twin Brain...")
    runtime_dir = Path("runtime")
    runtime_dir.mkdir(exist_ok=True, parents=True)

    brain = DigitalTwinBrain(
        runtime_dir=runtime_dir,
        nucleus_cfg=NucleusConfig(
            tick_interval_s=0.5,
            brain_run_interval_s=2.0,
            tool_timeout_s=60.0,
        ),
    )

    # Progress tracking
    progress: ProgressDict = {
        "case_ingested": False,
        "segmentation_completed": False,
        "connectome_completed": False,
        "simulation_completed": False,
        "render_frames": 0,
        "export_ready": False,
        "health_warnings": [],
        "health_errors": [],
    }

    async def on_progress(evt: V1EventEnvelope) -> None:
        """Track progress events"""
        event_type = evt["event_type"]
        payload: dict = evt.get("payload", {}) if isinstance(evt, dict) else {}

        if event_type == "dt.case.ingested":
            progress["case_ingested"] = True
            logger.info(f"✅ Ingest complete: {payload.get('quality', {}).get('confidence', 0):.2f} confidence")

        elif event_type == "dt.segmentation.completed":
            progress["segmentation_completed"] = True
            logger.info(f"✅ Segmentation complete: {len(payload.get('label_map', {}) or {})} organs")

        elif event_type == "dt.connectome.completed":
            progress["connectome_completed"] = True
            stats: dict = payload.get("stats", {}) or {}
            logger.info(f"✅ Connectome complete: {stats.get('nodes', 0)} nodes, {stats.get('edges', 0)} edges")

        elif event_type == "dt.simulation.completed":
            progress["simulation_completed"] = True
            logger.info(f"✅ Simulation complete: {payload.get('frames', 0)} frames")

        elif event_type == "dt.render.frame":
            progress["render_frames"] += 1
            frame_id = payload.get("frame_id", 0)
            if progress["render_frames"] % 10 == 0:
                logger.info(f"🎨 Rendering: frame {frame_id}")

        elif event_type == "dt.case.export_ready":
            progress["export_ready"] = True
            bundle_hash = payload.get("bundle_hash", "")
            logger.info(f"✅ Export complete: {bundle_hash}")

        elif event_type == "dt.health.warning":
            warning = payload.get("invariant", "unknown")
            progress["health_warnings"].append(warning)
            logger.warning(f"⚠️  Health warning: {warning}")

        elif event_type == "dt.health.failed":
            error = payload.get("invariant", "unknown")
            progress["health_errors"].append(error)
            logger.error(f"❌ Health check failed: {error}")

    # Subscribe to events
    brain.bus.subscribe_event("dt.case.ingested", on_progress)
    brain.bus.subscribe_event("dt.segmentation.completed", on_progress)
    brain.bus.subscribe_event("dt.connectome.completed", on_progress)
    brain.bus.subscribe_event("dt.simulation.completed", on_progress)
    brain.bus.subscribe_event("dt.render.frame", on_progress)
    brain.bus.subscribe_event("dt.case.export_ready", on_progress)
    brain.bus.subscribe_event("dt.health.warning", on_progress)
    brain.bus.subscribe_event("dt.health.failed", on_progress)

    # Start brain in background
    asyncio.create_task(brain.start())
    await asyncio.sleep(1.0)  # Let brain initialize

    # Send reconstruction command
    logger.info("Sending dt.case.reconstruct command...")
    cmd = make_v1_command(
        command_type="dt.case.reconstruct",
        ts_ms=int(time.time() * 1000),
        trace_id=f"trace_{case_id}",
        payload={
            "case_id": case_id,
            "dicom_path": str(dicom_path),
            "quality_threshold": quality_threshold,
        },
    )

    try:
        result = await asyncio.wait_for(
            brain.bus.send_command(cmd),
            timeout=5.0
        )
        logger.info(f"Command accepted: {result}")
    except asyncio.TimeoutError:
        logger.error("Command timed out")
        brain.shutdown()
        return False

    # Wait for completion with timeout
    logger.info(f"Waiting for reconstruction to complete (timeout: {timeout}s)...")
    start_time = time.time()

    while time.time() - start_time < timeout:
        if progress["export_ready"]:
            logger.info("🎉 Reconstruction complete!")
            break

        if progress["health_errors"]:
            logger.error(f"Reconstruction failed: {progress['health_errors']}")
            brain.shutdown()
            return False

        await asyncio.sleep(1.0)
    else:
        logger.error(f"Reconstruction timed out after {timeout}s")
        brain.shutdown()
        return False

    # Shutdown brain
    brain.shutdown()
    await asyncio.sleep(0.5)

    # Summary
    logger.info("=" * 80)
    logger.info("Test Summary:")
    logger.info(f"  Case Ingested: {'✅' if progress['case_ingested'] else '❌'}")
    logger.info(f"  Segmentation: {'✅' if progress['segmentation_completed'] else '❌'}")
    logger.info(f"  Connectome: {'✅' if progress['connectome_completed'] else '❌'}")
    logger.info(f"  Simulation: {'✅' if progress['simulation_completed'] else '❌'}")
    logger.info(f"  Render Frames: {progress['render_frames']}")
    logger.info(f"  Export Ready: {'✅' if progress['export_ready'] else '❌'}")
    logger.info(f"  Health Warnings: {len(progress['health_warnings'])}")
    logger.info(f"  Health Errors: {len(progress['health_errors'])}")
    logger.info("=" * 80)

    # Optional exports
    if export_png:
        logger.info("Exporting PNG slices...")
        try:
            from . import dicom_toolkit as dcm
            png_dir = runtime_dir / f"{case_id}_png"
            dcm.export_png(dicom_path, str(png_dir), None)
            logger.info(f"✅ PNG slices exported: {png_dir}")
        except Exception as e:
            logger.warning(f"PNG export failed: {e}")

    if export_nifti:
        logger.info("Exporting NIfTI volume...")
        try:
            from . import dicom_toolkit as dcm
            dcm.export_nifti(dicom_path, export_nifti)
            logger.info(f"✅ NIfTI volume exported: {export_nifti}")
        except Exception as e:
            logger.warning(f"NIfTI export failed: {e}")

    # Check artifacts
    artifacts_dir = runtime_dir / "artifacts" / case_id
    if artifacts_dir.exists():
        logger.info(f"Artifacts stored in: {artifacts_dir}")
        bundle_dir = artifacts_dir / "bundle"
        if bundle_dir.exists():
            bundles = list(bundle_dir.glob("*.zip"))
            if bundles:
                logger.info(f"Final bundle: {bundles[0]}")

    success = (
        progress["case_ingested"]
        and progress["segmentation_completed"]
        and progress["connectome_completed"]
        and progress["simulation_completed"]
        and progress["export_ready"]
        and len(progress["health_errors"]) == 0
    )

    if success:
        logger.info("✅ TEST PASSED")
    else:
        logger.error("❌ TEST FAILED")

    return success


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Digital Twin Cortex - Reconstruction Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("dicom_path", help="Path to DICOM series directory")
    parser.add_argument("case_id", help="Case identifier")
    parser.add_argument(
        "--quality-threshold",
        type=float,
        default=0.8,
        help="Minimum quality confidence (default: 0.8)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Max time to wait for completion in seconds (default: 300)",
    )
    parser.add_argument(
        "--export-png",
        action="store_true",
        help="Also export PNG slices (for visualization)",
    )
    parser.add_argument(
        "--export-nifti",
        metavar="FILE",
        help="Also export NIfTI volume to specified file",
    )

    args = parser.parse_args()

    success = asyncio.run(
        run_reconstruction_test(
            dicom_path=args.dicom_path,
            case_id=args.case_id,
            quality_threshold=args.quality_threshold,
            timeout=args.timeout,
            export_png=args.export_png,
            export_nifti=args.export_nifti,
        )
    )

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
