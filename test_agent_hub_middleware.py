from __future__ import annotations

import asyncio

import agent_hub_server as hub
import httpx
import pytest


async def _send_oversized_request() -> httpx.Response:
    transport = httpx.ASGITransport(app=hub.app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        oversized_body = b"{" + (b"a" * 64) + b"}"
        return await client.post(
            "/tool/execute",
            content=oversized_body,
            headers={
                "content-type": "application/json",
                "content-length": str(len(oversized_body)),
            },
        )


def test_body_size_middleware_rejects_content_length_over_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(hub, "MAX_BODY_BYTES", 16)
    response = asyncio.run(_send_oversized_request())

    assert response.status_code == 413
    payload = response.json()
    assert payload["success"] is False
    assert payload["code"] == "BAD_ARGS"
    assert payload["error"] == "Request too large"
