"""
Brain Operator CLI Commands

Commands:
  brain:ops          List registered operators
  brain:validate     Validate operator request
  brain:run          Execute operator
  brain:logs         View recent operator executions
"""

import json
import sys
import asyncio
import argparse

from operators import (
    get_registry,
    MemoryContext,
)


def cmd_list_operators(args):
    """brain:ops - List registered operators."""
    registry = get_registry()
    operators = registry.list_operators()

    print("📋 Registered Operators:")
    for op in operators:
        status = "✅" if op in registry.operators else "❌"
        print(f"  {status} {op}")
    print(f"\nTotal: {len(operators)}")


def cmd_validate(args):
    """brain:validate <operator_name> <payload.json>"""
    if not args.operator or not args.payload:
        print("❌ Usage: brain:validate <operator_name> <payload_file.json>")
        return

    try:
        with open(args.payload, 'r') as f:
            payload = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load payload: {e}")
        return

    registry = get_registry()
    valid, message = registry.validate_request(args.operator, payload)

    if valid:
        print(f"✅ Operator '{args.operator}' request is valid")
        print(f"   Payload size: {len(json.dumps(payload))} bytes")
    else:
        print(f"❌ Validation failed: {message}")
        sys.exit(1)


def cmd_run(args):
    """brain:run <operator_name> <payload.json> [--memory=memory.json] [--timeout=30000]"""
    if not args.operator or not args.payload:
        print("❌ Usage: brain:run <operator_name> <payload_file.json>")
        return

    # Load payload
    try:
        with open(args.payload, 'r') as f:
            payload = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load payload: {e}")
        return

    # Load optional memory context
    memory_context = None
    if args.memory:
        try:
            with open(args.memory, 'r') as f:
                mem_data = json.load(f)
                memory_context = MemoryContext(
                    facts=mem_data.get("facts", []),
                    vectors=mem_data.get("vectors", []),
                    summary=mem_data.get("summary", ""),
                )
        except Exception as e:
            print(f"⚠️  Failed to load memory context: {e}")

    # Execute
    registry = get_registry()
    timeout_ms = args.timeout or 30000

    print(f"🚀 Executing operator: {args.operator}")
    print(f"   Timeout: {timeout_ms}ms")
    print(f"   Payload size: {len(json.dumps(payload))} bytes")

    # Run async context
    try:
        response = asyncio.run(registry.execute(
            operator_name=args.operator,
            trace_id=args.trace_id or f"{args.operator}:cli",
            payload=payload,
            memory_context=memory_context,
            timeout_ms=timeout_ms,
            deterministic=True,
        ))

        print("\n📊 Result:")
        print(f"   Status: {response.status}")
        print(f"   Execution time: {response.execution_time_ms}ms")

        if response.status == "success":
            print("   ✅ Output:")
            print(json.dumps(response.result, indent=2))

            if response.memory_writes:
                print(f"\n💾 Memory writes: {len(response.memory_writes)}")
                for w in response.memory_writes:
                    print(f"   - {w.key} (TTL: {w.ttl_seconds}s)")
        else:
            print(f"   ❌ Error: {response.error}")

        if response.deterministic_hash:
            print(f"\n🔐 Deterministic hash: {response.deterministic_hash[:16]}...")

    except Exception as e:
        print(f"❌ Execution failed: {e}")
        sys.exit(1)


def cmd_logs(args):
    """brain:logs [--limit=N]"""
    registry = get_registry()
    limit = args.limit or 20

    logs = registry.execution_log[-limit:]

    print(f"📜 Recent operator executions (last {len(logs)}):")
    print()

    for i, log in enumerate(logs, 1):
        status_icon = "✅" if log["status"] == "success" else "❌" if log["status"] == "execution_error" else "⏱️"
        print(f"{i}. {status_icon} {log['operator_name']}")
        print(f"   Status: {log['status']} ({log['execution_time_ms']}ms)")
        print(f"   Trace: {log['trace_id'][:16]}...")
        print(f"   Time: {log['timestamp']}")
        print()

    print(f"Total operations: {len(registry.execution_log)}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="World Engine Brain Operator CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # brain:ops
    ops_parser = subparsers.add_parser("ops", help="List registered operators")
    ops_parser.set_defaults(func=cmd_list_operators)

    # brain:validate
    validate_parser = subparsers.add_parser("validate", help="Validate operator request")
    validate_parser.add_argument("operator", help="Operator name")
    validate_parser.add_argument("payload", help="Payload JSON file")
    validate_parser.set_defaults(func=cmd_validate)

    # brain:run
    run_parser = subparsers.add_parser("run", help="Execute operator")
    run_parser.add_argument("operator", help="Operator name")
    run_parser.add_argument("payload", help="Payload JSON file")
    run_parser.add_argument("--trace-id", help="Trace ID (optional)")
    run_parser.add_argument("--memory", help="Memory context JSON file (optional)")
    run_parser.add_argument("--timeout", type=int, help="Timeout in milliseconds (default 30000)")
    run_parser.set_defaults(func=cmd_run)

    # brain:logs
    logs_parser = subparsers.add_parser("logs", help="View execution logs")
    logs_parser.add_argument("--limit", type=int, default=20, help="Number of logs to show")
    logs_parser.set_defaults(func=cmd_logs)

    args = parser.parse_args()

    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
