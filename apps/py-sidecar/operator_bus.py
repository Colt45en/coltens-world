"""
Operator Bus Integration

Emits operator execution results to globalBus as BusEnvelopeV1.

Connects operator.executed events from sidecar back to:
- Nucleus router handlers (can react to operator results)
- IDE WS clients (can display progress)
- Memory system (persist operator artifacts)
"""

from typing import Optional, Dict, Any
from datetime import datetime

# When integrated with main bus, import from:
# from apps/py-sidecar/bus_client.py (HTTP client to nucleus)


class OperatorBusEmitter:
    """Emits operator results to globalBus."""

    def __init__(self, nucleus_url: str = "http://localhost:3000"):
        """
        Initialize emitter.

        Args:
            nucleus_url: URL to Nucleus bus endpoint
        """
        self.nucleus_url = nucleus_url
        self.enabled = True

    async def emit_operator_started(
        self,
        operator_id: str,
        operator_name: str,
        trace_id: str,
        timeout_ms: int,
    ) -> bool:
        """
        Emit operator.started event.

        Returns:
            True if emission succeeded, False otherwise
        """
        if not self.enabled:
            return False

        payload = {
            "operator_id": operator_id,
            "operator_name": operator_name,
            "trace_id": trace_id,
            "timeout_ms": timeout_ms,
        }

        return await self._emit_to_bus(
            event_type="operator.started",
            trace_id=trace_id,
            payload=payload,
        )

    async def emit_operator_progress(
        self,
        operator_id: str,
        operator_name: str,
        trace_id: str,
        progress_percent: float,
        message: Optional[str] = None,
    ) -> bool:
        """
        Emit operator.progress event.

        Returns:
            True if emission succeeded, False otherwise
        """
        if not self.enabled:
            return False

        payload = {
            "operator_id": operator_id,
            "operator_name": operator_name,
            "trace_id": trace_id,
            "progress_percent": min(100, max(0, progress_percent)),
            "message": message or "",
        }

        return await self._emit_to_bus(
            event_type="operator.progress",
            trace_id=trace_id,
            payload=payload,
        )

    async def emit_operator_executed(
        self,
        operator_id: str,
        operator_name: str,
        trace_id: str,
        status: str,
        result: Optional[Dict[str, Any]],
        error: Optional[Dict[str, Any]],
        memory_writes: list,
        execution_time_ms: int,
        deterministic_hash: Optional[str],
    ) -> bool:
        """
        Emit operator.executed event (main result).

        Returns:
            True if emission succeeded, False otherwise
        """
        if not self.enabled:
            return False

        # Build memory_writes array
        memory_writes_serialized = [
            {
                "key": w.key,
                "value": w.value,
                "ttl_seconds": w.ttl_seconds,
            }
            for w in memory_writes
        ]

        payload = {
            "operator_id": operator_id,
            "operator_name": operator_name,
            "trace_id": trace_id,
            "status": status,
            "result": result or {},
            "error": error,
            "memory_writes": memory_writes_serialized,
            "execution_time_ms": execution_time_ms,
            "deterministic_hash": deterministic_hash,
        }

        return await self._emit_to_bus(
            event_type="operator.executed",
            trace_id=trace_id,
            payload=payload,
        )

    async def _emit_to_bus(
        self,
        event_type: str,
        trace_id: str,
        payload: Dict[str, Any],
    ) -> bool:
        """
        Internal: Emit to globalBus via HTTP.

        The route /bus/event expects:
        {
            "type": "operator.executed",
            "payload": {...}
        }

        Returns:
            True if HTTP succeeded, False otherwise
        """
        try:
            import aiohttp

            # Build BusEnvelopeV1 format
            event = {
                "type": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "trace_id": trace_id,
                "payload": payload,
            }

            # Try to POST to Nucleus bus endpoint
            # (in production, this would be /bus/event or /publish)
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.nucleus_url}/bus/event",
                    json=event,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    return resp.status in [200, 202]

        except Exception as e:
            # Log but don't fail -- bus emission is informational
            print(f"⚠️  Bus emission failed: {str(e)}")
            return False


# Global emitter instance
_emitter: Optional[OperatorBusEmitter] = None


def get_emitter(nucleus_url: str = "http://localhost:3000") -> OperatorBusEmitter:
    """Get or create global operator bus emitter."""
    global _emitter
    if _emitter is None:
        _emitter = OperatorBusEmitter(nucleus_url)
    return _emitter


def disable_emitter():
    """Disable bus emissions (for testing)."""
    global _emitter
    if _emitter:
        _emitter.enabled = False
