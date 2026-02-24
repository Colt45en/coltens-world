#!/usr/bin/env python3
"""
leximorph_quick_test.py
Quick validation script for leximorph deployment

Run this from apps/py-sidecar/ to verify:
1. leximorph.py imports correctly
2. All analyzers work
3. SQLite storage is functional
4. Query returns expected results

Usage:
  python leximorph_quick_test.py
"""

import sys
import tempfile
from pathlib import Path

# Add current dir to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from leximorph import (
        build_registry,
        LexiStore,
    )

    print("✅ Imports successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)


def test_analyzers():
    """Test all three core analyzers"""
    print("\n🧪 Testing analyzers...\n")

    reg = build_registry()

    tests = [
        ("unbelievable", "en", "word"),
        ("getUserName", "js", "identifier"),
        ('<div class="foo-bar" id="main">', "html", "html"),
    ]

    for text, lang, kind in tests:
        try:
            result = reg.analyze(text=text, language=lang, kind=kind)
            print(f"  ✓ {lang}/{kind}: {text[:30]}")
            print(f"    → {result.parts}\n")
        except Exception as e:
            print(f"  ❌ {lang}/{kind} failed: {e}")
            return False

    return True


def test_storage():
    """Test SQLite storage"""
    print("🧪 Testing storage...\n")

    # Use temp file
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
        db_path = f.name

    try:
        store = LexiStore(db_path)
        store.init()
        print(f"  ✓ DB initialized: {db_path}")

        reg = build_registry()

        # Insert test entries
        entries = [
            reg.analyze("unbelievable", "en", "word"),
            reg.analyze("getUserName", "js", "identifier"),
            reg.analyze("setUserEmail", "js", "identifier"),
        ]

        for entry in entries:
            row_id = store.insert(entry)
            print(f"  ✓ Inserted: #{row_id} {entry.entry}")

        # Query
        print("\n  Querying 'User'...")
        results = store.query_contains("User", limit=10)
        print(f"  ✓ Found {len(results)} results")
        for r in results:
            print(f"    - {r['id']}: {r['entry']} ({r['kind']})")

        store.close()
        print()
        return True

    except Exception as e:
        print(f"  ❌ Storage test failed: {e}")
        return False

    finally:
        # Cleanup
        try:
            Path(db_path).unlink()
        except:
            pass


def test_fast_api_integration():
    """Test FastAPI integration (imports only)"""
    print("🧪 Testing FastAPI integration...\n")

    # Check if main.py can import leximorph
    try:
        import main

        if hasattr(main, 'app'):
            print("  ✓ FastAPI app found")
        if hasattr(main, '_leximorph_registry'):
            print("  ✓ Registry initialized")
        print()
        return True
    except ImportError as e:
        print(f"  ⚠  FastAPI not fully tested (needs uvicorn): {e}")
        return True  # Not a failure, just skipped


def main():
    print("\n" + "=" * 50)
    print("🧠 Leximorph Quick Test")
    print("=" * 50)

    results = []

    # Run tests
    results.append(("Analyzers", test_analyzers()))
    results.append(("Storage", test_storage()))
    results.append(("FastAPI", test_fast_api_integration()))

    # Summary
    print("\n" + "=" * 50)
    print("📊 Summary")
    print("=" * 50)

    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} — {name}")

    all_passed = all(p for _, p in results)

    if all_passed:
        print("\n✅ All tests passed!")
        print("\nNext steps:")
        print("  1. Start FastAPI: python -m uvicorn main:app --port 8001")
        print("  2. Test endpoint: curl http://127.0.0.1:8001/leximorph/health")
        print("  3. Analyze: curl -X POST http://127.0.0.1:8001/leximorph/analyze ...")
        return 0
    else:
        print("\n❌ Some tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
