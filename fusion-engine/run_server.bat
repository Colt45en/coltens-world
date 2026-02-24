@echo off
cd /d "%~dp0python"
python -m uvicorn fusion_server:app --host 127.0.0.1 --port 3000 --reload
