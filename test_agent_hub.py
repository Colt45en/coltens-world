#!/usr/bin/env python3
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportUnknownLambdaType=false, reportMissingParameterType=false
"""
AgentHub Smoke Test (CI-grade)
Tests hub health + Python tools + TypeScript tools + hub.self_test.

Usage:
  python test_agent_hub.py
  python test_agent_hub.py --base-url http://127.0.0.1:3001 --wait-seconds 20
  python test_agent_hub.py --json-out smoketest_results.json

Exit code:
  0 = all pass
  1 = one or more failed
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from dataclasses import asdict, dataclass
from typing import Any, Awaitable, Callable

import httpx


@dataclass
class TestResult:
    name: str
    ok: bool
    ms: int
    error: str | None = None


class TestFailure(RuntimeError):
    pass


def _pretty_json(obj: Any) -> str:
    try:
        return json.dumps(obj, indent=2, sort_keys=True)
    except Exception:
        return str(obj)


async def _request_json(
    client: Any,
    method: str,
    url: str,
    *,
    json_body: dict[str, Any] | None = None,
    timeout_s: float = 5.0,
) -> tuple[int, dict[str, Any], str]:
    try:
        response = await client.request(method, url, json=json_body, timeout=timeout_s)
    except Exception as error:
        raise TestFailure(f"Request failed: {method} {url} :: {error}") from error

    raw = response.text
    try:
        data = response.json()
        if not isinstance(data, dict):
            data = {"_value": data}
    except Exception:
        data = {}

    return response.status_code, data, raw


async def wait_for_health(client: Any, base_url: str, wait_seconds: int) -> None:
    deadline = time.monotonic() + wait_seconds
    last_err: str | None = None

    while time.monotonic() < deadline:
        try:
            code, data, raw = await _request_json(
                client, "GET", f"{base_url}/health", timeout_s=2.0
            )
            if code == 200 and data.get("ok") is True:
                return
            last_err = f"Unexpected health response: status={code} body={raw[:500]}"
        except Exception as error:
            last_err = str(error)

        await asyncio.sleep(0.5)

    raise TestFailure(
        f"Services not ready after {wait_seconds}s. Last error: {last_err}"
    )


async def tool_execute(
    client: Any,
    base_url: str,
    action: dict[str, Any],
    trace_id: str,
    session_id: str,
    timeout_s: float,
) -> dict[str, Any]:
    payload = {"action": action, "trace_id": trace_id, "session_id": session_id}
    code, data, raw = await _request_json(
        client,
        "POST",
        f"{base_url}/tool/execute",
        json_body=payload,
        timeout_s=timeout_s,
    )

    if code != 200:
        raise TestFailure(
            "tool/execute returned non-200\n"
            f"status={code}\n"
            f"payload={_pretty_json(payload)}\n"
            f"body={raw[:2000]}"
        )

    if data.get("success") is not True:
        raise TestFailure(
            "tool/execute indicated failure\n"
            f"payload={_pretty_json(payload)}\n"
            f"response={_pretty_json(data)}"
        )

    return data


async def test_hub_health(client: Any, base_url: str) -> None:
    code, data, raw = await _request_json(
        client, "GET", f"{base_url}/health", timeout_s=2.0
    )
    if code != 200:
        raise TestFailure(f"/health non-200: status={code} body={raw[:2000]}")
    if data.get("ok") is not True:
        raise TestFailure(f"/health ok!=true: response={_pretty_json(data)}")


async def test_py_tools(client: Any, base_url: str) -> None:
    data = await tool_execute(
        client,
        base_url,
        action={"kind": "py.echo", "msg": "hello"},
        trace_id="t_py_1",
        session_id="s_py_1",
        timeout_s=2.5,
    )
    if "result" not in data:
        raise TestFailure(f"py.echo missing result: response={_pretty_json(data)}")

    data = await tool_execute(
        client,
        base_url,
        action={"kind": "py.sha256", "text": "hello"},
        trace_id="t_py_2",
        session_id="s_py_2",
        timeout_s=2.5,
    )
    result = data.get("result", {})
    if not isinstance(result, dict) or "sha256" not in result:
        raise TestFailure(f"py.sha256 missing sha256: response={_pretty_json(data)}")


async def test_ts_tools(client: Any, base_url: str) -> None:
    data = await tool_execute(
        client,
        base_url,
        action={"kind": "ts.uppercase", "text": "hello"},
        trace_id="t_ts_1",
        session_id="s_ts_1",
        timeout_s=2.5,
    )
    result = data.get("result", {})
    if not isinstance(result, dict) or result.get("text") != "HELLO":
        raise TestFailure(
            f"ts.uppercase unexpected result: response={_pretty_json(data)}"
        )


async def test_self_test(client: Any, base_url: str) -> None:
    data = await tool_execute(
        client,
        base_url,
        action={"kind": "hub.self_test"},
        trace_id="t_hub_1",
        session_id="s_hub_1",
        timeout_s=6.0,
    )
    result = data.get("result", {})
    if not isinstance(result, dict):
        raise TestFailure(
            f"hub.self_test result not object: response={_pretty_json(data)}"
        )

    for key in ("hub", "python", "typescript"):
        obj = result.get(key)
        if not isinstance(obj, dict) or obj.get("ok") is not True:
            raise TestFailure(
                f"hub.self_test {key}.ok != true: result={_pretty_json(result)}"
            )


async def run_one(name: str, fn: Callable[[], Awaitable[None]]) -> TestResult:
    start = time.perf_counter()
    try:
        await fn()
        ms = int((time.perf_counter() - start) * 1000)
        return TestResult(name=name, ok=True, ms=ms)
    except Exception as error:
        ms = int((time.perf_counter() - start) * 1000)
        return TestResult(name=name, ok=False, ms=ms, error=str(error))


def _print_results(results: list[TestResult]) -> None:
    print("\n" + "=" * 70)
    print("📊 Test Results")
    print("=" * 70)
    for result in results:
        status = "✓ PASS" if result.ok else "✗ FAIL"
        tail = f" ({result.ms}ms)"
        print(f"{status:10} {result.name}{tail}")
        if not result.ok and result.error:
            print("  ---")
            for line in result.error.splitlines():
                print(f"  {line}")
            print("  ---")
    print("=" * 70 + "\n")


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url", default="http://127.0.0.1:3001", help="AgentHub base URL"
    )
    parser.add_argument(
        "--wait-seconds", type=int, default=12, help="Max seconds to wait for /health"
    )
    parser.add_argument(
        "--json-out", default=None, help="Write JSON results to this file"
    )
    parser.add_argument(
        "--fail-fast", action="store_true", help="Stop after first failure"
    )
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("🧪 AgentHub Smoke Test")
    print("=" * 70 + "\n")
    print(f"Base URL: {args.base_url}")
    print(f"Wait:     {args.wait_seconds}s\n")

    async with httpx.AsyncClient() as client:
        print("⏳ Waiting for services to be ready...")
        await wait_for_health(client, args.base_url, args.wait_seconds)
        print("✓ Services ready\n")

        results: list[TestResult] = []

        async def run(name: str, coro_fn: Callable[[], Awaitable[None]]):
            result = await run_one(name, coro_fn)
            results.append(result)
            if args.fail_fast and not result.ok:
                _print_results(results)
                if args.json_out:
                    with open(args.json_out, "w", encoding="utf-8") as file:
                        json.dump(
                            [asdict(x) for x in results], file, indent=2, sort_keys=True
                        )
                raise SystemExit(1)

        await run("Hub Health", lambda: test_hub_health(client, args.base_url))
        await run("Python Tools", lambda: test_py_tools(client, args.base_url))
        await run("TypeScript Tools", lambda: test_ts_tools(client, args.base_url))
        await run("Self-Test", lambda: test_self_test(client, args.base_url))

        _print_results(results)

        if args.json_out:
            with open(args.json_out, "w", encoding="utf-8") as file:
                json.dump([asdict(x) for x in results], file, indent=2, sort_keys=True)
            print(f"Wrote JSON results to: {args.json_out}\n")

        all_passed = all(result.ok for result in results)
        return 0 if all_passed else 1


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nInterrupted.")
        raise SystemExit(130)
