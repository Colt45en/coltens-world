"""
BRAIN ARCHITECTURE: Digital Twin Cortex → Bootstrap

Brain boot sequence that wires EventBus + Nucleus + ToolRuntime + Cognition + IMMUNE.

Usage:
    python -m unified_nexus.digital_twin.brain_boot

This starts the complete Digital Twin Cortex system:
- EventBus: split-channel event distribution (events + commands)
- Nucleus: orchestration lane with deterministic sequencing
- ToolRuntime: serial tool execution with result correlation
- DigitalTwinCognition: PREFRONTAL workflow orchestrator
- InvariantsRegistry: IMMUNE health checks
- ArtifactStore: HIPPOCAMPUS deterministic storage

Flow:
1. User sends dt.case.reconstruct command → Cognition
2. Cognition sequences pipeline: ingest → segment → connectome → simulate → render → export
3. Each stage: cognition.request_emit → Nucleus emits nucleus.tool_call → ToolRuntime executes → nucleus.tool_result → Cognition waits
4. InvariantsRegistry validates all dt.tool.result events
5. Final bundle: runtime/artifacts/<case_id>/bundle.<hash>.zip
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

from ..event_bus import EventBus
from ..nucleus.nucleus import Nucleus, NucleusConfig
from ..tool_runtime import ToolRuntime
from .artifacts import ArtifactStore
from .cognition import DigitalTwinCognition
from .invariants import InvariantsRegistry
from .tools import build_tools

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("brain_boot")


class DigitalTwinBrain:
    """
    Complete Digital Twin Cortex system.

    Combines all BRAIN layers into a single runnable system:
    - RETINA (ingest)
    - V-CORTEX (segment)
    - CONNECTOME (build_connectome)
    - BRAINSTEM (simulate)
    - OCCIPITAL (render2d)
    - HIPPOCAMPUS (ArtifactStore)
    - PREFRONTAL (DigitalTwinCognition)
    - IMMUNE (InvariantsRegistry)
    """

    def __init__(
        self,
        runtime_dir: Optional[Path] = None,
        nucleus_cfg: Optional[NucleusConfig] = None,
    ) -> None:
        self.runtime_dir = runtime_dir or Path("runtime")
        self.runtime_dir.mkdir(exist_ok=True, parents=True)

        # EventBus: split-channel event distribution
        self.bus = EventBus(max_event_q=10000, max_cmd_q=1000)

        # Nucleus: orchestration lane with deterministic sequencing
        self.nucleus = Nucleus(self.bus, cfg=nucleus_cfg)

        # ArtifactStore: HIPPOCAMPUS deterministic storage
        artifacts_dir = self.runtime_dir / "artifacts"
        artifacts_dir.mkdir(exist_ok=True, parents=True)
        self.store = ArtifactStore(root=str(artifacts_dir))

        # Digital Twin tools: RETINA + V-CORTEX + CONNECTOME + BRAINSTEM + OCCIPITAL
        dt_tools = build_tools(self.store)

        # ToolRuntime: serial tool execution
        self.tool_runtime = ToolRuntime(self.bus, tools=dt_tools, max_queue=1000)

        # DigitalTwinCognition: PREFRONTAL workflow orchestrator
        self.cognition = DigitalTwinCognition(self.bus)

        # InvariantsRegistry: IMMUNE health checks
        self.invariants = InvariantsRegistry(self.bus)

        logger.info("Digital Twin Brain initialized")
        logger.info(f"  Runtime dir: {self.runtime_dir.absolute()}")
        logger.info(f"  Artifacts dir: {artifacts_dir.absolute()}")
        logger.info(f"  Tools: {len(dt_tools)}")

    async def start(self) -> None:
        """
        Start the Digital Twin Brain system.

        Launches:
        - Nucleus (with EventBus + Scheduler)
        - ToolRuntime (serial tool executor)
        """
        logger.info("Starting Digital Twin Brain...")

        # Start tool runtime loop
        tool_task = asyncio.create_task(
            self.tool_runtime.run_forever(stop_event=self.nucleus.stop_event),
            name="tool_runtime",
        )

        # Start nucleus (includes EventBus + Scheduler)
        nucleus_task = asyncio.create_task(
            self.nucleus.start(),
            name="nucleus",
        )

        logger.info("Digital Twin Brain running")
        logger.info("  Send dt.case.reconstruct command to start reconstruction")
        logger.info("  Press Ctrl+C to shutdown")

        try:
            # Wait for either task to complete (or exception)
            done, pending = await asyncio.wait(
                {nucleus_task, tool_task},
                return_when=asyncio.FIRST_EXCEPTION,
            )

            # Propagate exceptions
            for t in done:
                exc = t.exception()
                if exc is not None:
                    logger.error(f"Task {t.get_name()} failed: {exc}", exc_info=exc)
                    self.shutdown()
                    raise exc

            # If one task ended cleanly, stop the other
            self.shutdown()
            await asyncio.gather(*pending, return_exceptions=True)

        except KeyboardInterrupt:
            logger.info("Shutdown requested (Ctrl+C)")
            self.shutdown()
            await asyncio.gather(nucleus_task, tool_task, return_exceptions=True)

        finally:
            await self.aclose()

    def shutdown(self) -> None:
        """Request graceful shutdown."""
        logger.info("Shutting down Digital Twin Brain...")
        self.nucleus.shutdown()

    async def aclose(self) -> None:
        """Clean shutdown hook."""
        await self.nucleus.aclose()
        logger.info("Digital Twin Brain shutdown complete")


async def main() -> None:
    """Main entry point for Digital Twin Cortex."""
    brain = DigitalTwinBrain(
        runtime_dir=Path("runtime"),
        nucleus_cfg=NucleusConfig(
            tick_interval_s=0.5,
            brain_run_interval_s=2.0,
            tool_timeout_s=30.0,  # Longer timeout for medical imaging tools
        ),
    )

    await brain.start()


if __name__ == "__main__":
    asyncio.run(main())
