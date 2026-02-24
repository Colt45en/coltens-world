@echo off
setlocal enabledelayedexpansion

REM Start TS agent (:3002)
start "TS Agent (3002)" cmd /k "node ts_agent_server.js"

REM Start Python AgentHub (:3001)
start "AgentHub (3001)" cmd /k "python agent_hub_server.py"

echo.
echo ==============================================================================
echo AgentHub started:
echo   TS Agent:   http://127.0.0.1:3002/health
echo   AgentHub:   http://127.0.0.1:3001/health
echo   Self-Test:  curl -X POST http://127.0.0.1:3001/tool/execute ^
echo              -d "{**action**:{**kind**:**hub.self_test**},...}"
echo ==============================================================================
echo.

endlocal
