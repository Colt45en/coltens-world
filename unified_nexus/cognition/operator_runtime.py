from __future__ import annotations

import asyncio
from typing import Any, Dict

from ..contracts import ToolFn, ToolSpec


class ToolRuntime:
    """
    Apps callable as tools.
    Nucleus triggers calls; Cognition executes with timeout.
    """

    def __init__(self) -> None:
        self._tools: dict[str, tuple[ToolSpec, ToolFn]] = {}

    def register(self, spec: ToolSpec, fn: ToolFn) -> None:
        self._tools[spec.name] = (spec, fn)

    def list_tools(self) -> list[ToolSpec]:
        return [spec for spec, _ in self._tools.values()]

    async def call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if name not in self._tools:
            return {"ok": False, "error": f"unknown_tool:{name}"}
        spec, fn = self._tools[name]
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(fn, args), timeout=spec.timeout_s
            )
        except asyncio.TimeoutError:
            return {"ok": False, "error": "tool_timeout"}
        except Exception as e:
            return {"ok": False, "error": f"tool_error:{type(e).__name__}:{e}"}
