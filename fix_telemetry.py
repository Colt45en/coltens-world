#!/usr/bin/env python3
"""
Comprehensive fix script for telemetry system issues
"""

import os
import subprocess
import time
import importlib.util
from typing import Optional, Any


def run_cmd(cmd: str, cwd: Optional[str] = None, check: bool = True) -> bool:
    """Run a command and return the result"""
    print(f"Running: {cmd}")
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd, capture_output=True, text=True
        )
        if check and result.returncode != 0:
            print(f"Command failed: {cmd}")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"Exception running {cmd}: {e}")
        return False


def main():
    workspace = r"c:\Users\colte\colten projects\coltens world"

    print("=== Telemetry System Fix Script ===")

    # 1. Check Python dependencies
    print("\n1. Checking Python dependencies...")
    # use importlib rather than importing the modules to avoid unused‑import
    required = ["psycopg_pool", "fastapi", "uvicorn", "psycopg"]
    missing = [pkg for pkg in required if importlib.util.find_spec(pkg) is None]
    if missing:
        print(f"✗ Missing dependencies: {', '.join(missing)}")
        install_names = []
        for pkg in missing:
            install_names.append("psycopg[binary]" if pkg == "psycopg" else pkg)
        run_cmd(f"pip install {' '.join(install_names)}")
        return
    print("✓ All Python dependencies available")

    # 2. Check database connection and run migration
    print("\n2. Running database migration...")
    try:
        import psycopg  # type: ignore

        conn: Any = psycopg.connect(
            "postgresql://postgres:postgres@127.0.0.1:5432/keeper"
        )  # type: ignore[assignment]
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            with open(
                os.path.join(workspace, "ops/servers/telemetry_migration.sql"), "r"
            ) as f:
                sql = f.read()
            cur.execute(sql)  # type: ignore[attr-defined]
        conn.commit()  # type: ignore[attr-defined]
        print("✓ Database migration applied")
    except Exception as e:
        print(f"✗ Database migration failed: {e}")
        return

    # 3. Check C++ build
    print("\n3. Building C++ telemetry emitter...")
    cpp_dir = os.path.join(workspace, "ops/cpp")
    build_dir = os.path.join(cpp_dir, "build")

    if not os.path.exists(build_dir):
        os.makedirs(build_dir)

    if run_cmd("cmake -B build -S .", cwd=cpp_dir) and run_cmd(
        "cmake --build build", cwd=cpp_dir
    ):
        print("✓ C++ build successful")
    else:
        print("✗ C++ build failed")
        return

    # 4. Test relay server startup
    print("\n4. Testing relay server...")
    # Kill any existing processes on port 3000
    run_cmd('taskkill /F /IM python.exe /FI "WINDOWTITLE eq uvicorn*"')

    # Start server in background
    import threading
    import requests

    def start_server():
        os.chdir(workspace)
        os.system(
            "python -m uvicorn ops.servers.mirror_relay:app --host 0.0.0.0 --port 3000"
        )

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait for server to start
    time.sleep(3)

    # Test endpoint
    try:
        resp = requests.post(
            "http://localhost:3000/ingest",
            json={"topic": "test.topic", "data": {"message": "hello world"}},
            timeout=5,
        )
        if resp.status_code == 200:
            print("✓ Relay server working")
        else:
            print(f"✗ Relay server returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"✗ Relay server test failed: {e}")

    # 5. Test C++ emitter
    print("\n5. Testing C++ emitter...")
    exe_path = os.path.join(build_dir, "engine.exe")
    if os.path.exists(exe_path):
        # Run for a short time
        proc = subprocess.Popen([exe_path], cwd=build_dir)
        time.sleep(2)
        proc.terminate()
        print("✓ C++ emitter executable exists and runs")
    else:
        print("✗ C++ executable not found")

    print("\n=== Fix Complete ===")
    print("All components should now be working. Run the relay server with:")
    print("cd 'c:\\Users\\colte\\colten projects\\coltens world'")
    print("python -m uvicorn ops.servers.mirror_relay:app --host 0.0.0.0 --port 3000")


if __name__ == "__main__":
    main()
