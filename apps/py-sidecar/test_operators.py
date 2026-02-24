"""
Brain Operator System - Integration Test

Demonstrates:
1. Listing operators
2. Validating requests
3. Executing patch operator
4. Executing simulate_world_tick operator
5. Viewing execution logs
"""

import json
import asyncio
from pathlib import Path

from operators import (
    get_registry,
)


async def test_patch_operator():
    """Test prompt.operator.patch"""
    print("\n" + "="*70)
    print("TEST 1: Patch Operator (Code Generation)")
    print("="*70)

    registry = get_registry()

    # Load example payload
    payload_path = Path(__file__).parent / "examples" / "patch_request.json"
    if not payload_path.exists():
        print(f"⚠️  Example payload not found: {payload_path}")
        return

    with open(payload_path, 'r') as f:
        payload = json.load(f)

    print(f"📋 Payload: file_path={payload['file_path']}")
    print(f"   Instruction: {payload['instruction'][:60]}...")

    response = await registry.execute(
        operator_name="prompt.operator.patch",
        trace_id="test_patch_001",
        payload=payload,
        timeout_ms=30000,
        deterministic=True,
    )

    print("\n📊 Result:")
    print(f"   Status: {response.status}")
    print(f"   Execution time: {response.execution_time_ms}ms")

    if response.status == "success":
        diff = response.result.get("diff", "")
        print("\n✅ Generated diff (first 500 chars):")
        print(diff[:500])
        if response.deterministic_hash:
            print(f"\n🔐 Hash: {response.deterministic_hash[:16]}...")
    else:
        print(f"❌ Error: {response.error}")


async def test_simulate_world_tick_operator():
    """Test prompt.operator.simulate_world_tick"""
    print("\n" + "="*70)
    print("TEST 2: Simulate World Tick Operator")
    print("="*70)

    registry = get_registry()

    # Load example payload
    payload_path = Path(__file__).parent / "examples" / "simulate_tick_request.json"
    if not payload_path.exists():
        print(f"⚠️  Example payload not found: {payload_path}")
        return

    with open(payload_path, 'r') as f:
        payload = json.load(f)

    print(f"📋 Payload: tick_number={payload['tick_number']}, entities={len(payload['world_state']['entities'])}")
    print(f"   Instruction: {payload['instruction'][:60]}...")

    response = await registry.execute(
        operator_name="prompt.operator.simulate_world_tick",
        trace_id="test_tick_001",
        payload=payload,
        timeout_ms=30000,
        deterministic=True,
    )

    print("\n📊 Result:")
    print(f"   Status: {response.status}")
    print(f"   Execution time: {response.execution_time_ms}ms")

    if response.status == "success":
        deltas = response.result.get("entity_deltas", [])
        print(f"✅ Generated {len(deltas)} entity deltas")
        for delta in deltas[:2]:  # Show first 2
            print(f"   - {delta.get('entity_id')}: dx={delta.get('dx'):.3f}, dy={delta.get('dy'):.3f}")

        if response.deterministic_hash:
            print(f"\n🔐 Hash: {response.deterministic_hash[:16]}...")
    else:
        print(f"❌ Error: {response.error}")


def test_list_operators():
    """Test listing operators"""
    print("\n" + "="*70)
    print("TEST 0: List Operators")
    print("="*70)

    registry = get_registry()
    operators = registry.list_operators()

    print(f"✅ Registered operators: {len(operators)}")
    for op in operators:
        print(f"   - {op}")


def test_validate_request():
    """Test request validation"""
    print("\n" + "="*70)
    print("TEST 1b: Validate Request")
    print("="*70)

    registry = get_registry()

    # Valid request
    valid_payload = {
        "file_path": "test.ts",
        "instruction": "add a function",
        "current_content": "// test",
    }
    valid, msg = registry.validate_request("prompt.operator.patch", valid_payload)
    print(f"✅ Valid patch request: {valid}")

    # Invalid request (missing fields)
    invalid_payload = {"file_path": "test.ts"}
    valid, msg = registry.validate_request("prompt.operator.patch", invalid_payload)
    print(f"❌ Invalid patch request: valid={valid}, message={msg}")

    # Nonexistent operator
    valid, msg = registry.validate_request("nonexistent.operator", {})
    print(f"❌ Nonexistent operator: valid={valid}, message={msg}")


def test_execution_logs():
    """Test accessing execution logs"""
    print("\n" + "="*70)
    print("TEST 3: Execution Logs")
    print("="*70)

    registry = get_registry()

    if not registry.execution_log:
        print("📜 No executions logged yet")
    else:
        recent = registry.execution_log[-3:]
        print(f"📜 Recent executions (last {len(recent)}):")
        for log in recent:
            print(f"   - {log['operator_name']}: {log['status']} ({log['execution_time_ms']}ms)")


async def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("BRAIN OPERATOR SYSTEM - INTEGRATION TEST")
    print("="*70)

    # Test listing
    test_list_operators()
    test_validate_request()

    # Test operators (requires OpenAI API key)
    print("\n⚠️  Skipping operator execution tests (requires OPENAI_API_KEY)")
    print("   To run live tests:")
    print("   1. Set OPENAI_API_KEY environment variable")
    print("   2. Uncomment operator tests below")
    # await test_patch_operator()
    # await test_simulate_world_tick_operator()

    # Test logs
    test_execution_logs()

    print("\n" + "="*70)
    print("✅ INTEGRATION TEST COMPLETE")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
