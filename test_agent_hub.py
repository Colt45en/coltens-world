#!/usr/bin/env python
"""
AgentHub Smoke Test
Tests both Python and TypeScript backends
"""
import asyncio
import json
import subprocess
import sys
import time

import httpx


async def test_hub_health():
    """Test hub health endpoint"""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://127.0.0.1:3001/health", timeout=2)
            assert r.status_code == 200
            data = r.json()
            assert data.get("ok") is True
            print("✓ Hub health check passed")
            return True
    except Exception as e:
        print(f"✗ Hub health check failed: {e}")
        return False


async def test_py_tools():
    """Test Python tools"""
    try:
        async with httpx.AsyncClient() as client:
            # Test py.echo
            r = await client.post(
                "http://127.0.0.1:3001/tool/execute",
                json={"action": {"kind": "py.echo", "msg": "hello"}, "trace_id": "t1", "session_id": "s1"},
                timeout=2,
            )
            assert r.status_code == 200
            data = r.json()
            assert data.get("success") is True
            print("✓ py.echo passed")

            # Test py.sha256
            r = await client.post(
                "http://127.0.0.1:3001/tool/execute",
                json={"action": {"kind": "py.sha256", "text": "hello"}, "trace_id": "t2", "session_id": "s2"},
                timeout=2,
            )
            assert r.status_code == 200
            data = r.json()
            assert data.get("success") is True
            assert "sha256" in data.get("result", {})
            print("✓ py.sha256 passed")

            return True
    except Exception as e:
        print(f"✗ Python tools test failed: {e}")
        return False


async def test_ts_tools():
    """Test TypeScript tools via hub"""
    try:
        async with httpx.AsyncClient() as client:
            # Test ts.uppercase
            r = await client.post(
                "http://127.0.0.1:3001/tool/execute",
                json={"action": {"kind": "ts.uppercase", "text": "hello"}, "trace_id": "t3", "session_id": "s3"},
                timeout=2,
            )
            assert r.status_code == 200
            data = r.json()
            assert data.get("success") is True
            assert data.get("result", {}).get("text") == "HELLO"
            print("✓ ts.uppercase passed")

            return True
    except Exception as e:
        print(f"✗ TypeScript tools test failed: {e}")
        return False


async def test_self_test():
    """Test hub.self_test (diagnostics)"""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "http://127.0.0.1:3001/tool/execute",
                json={"action": {"kind": "hub.self_test"}, "trace_id": "t4", "session_id": "s4"},
                timeout=5,
            )
            assert r.status_code == 200
            data = r.json()
            assert data.get("success") is True
            result = data.get("result", {})
            assert result.get("hub", {}).get("ok") is True
            assert result.get("python", {}).get("ok") is True
            assert result.get("typescript", {}).get("ok") is True
            print("✓ hub.self_test passed (both backends ok)")
            return True
    except Exception as e:
        print(f"✗ Self-test failed: {e}")
        return False


async def main():
    print("\n" + "=" * 70)
    print("🧪 AgentHub Smoke Test")
    print("=" * 70 + "\n")

    # Give servers time to start
    print("⏳ Waiting for services to be ready...")
    for attempt in range(10):
        try:
            async with httpx.AsyncClient() as client:
                await client.get("http://127.0.0.1:3001/health", timeout=1)
            break
        except:
            if attempt < 9:
                await asyncio.sleep(1)
            else:
                print("✗ Services not ready after 10 seconds")
                sys.exit(1)

    results = []
    results.append(("Hub Health", await test_hub_health()))
    results.append(("Python Tools", await test_py_tools()))
    results.append(("TypeScript Tools", await test_ts_tools()))
    results.append(("Self-Test", await test_self_test()))

    print("\n" + "=" * 70)
    print("📊 Test Results")
    print("=" * 70)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status:10} {name}")

    all_passed = all(p for _, p in results)
    print("=" * 70 + "\n")
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
