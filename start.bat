@echo off
title GramSeva Health - Application Startup
echo =====================================================================
echo                GramSeva Health Application Launcher
echo =====================================================================

:: Change directory to where the batch file is located
cd /d "%~dp0"

echo [1/4] Starting Core AI Triage Server (Port 8000)...
start "GramSeva Triage Server (Port 8000)" cmd /k "python backend\server.py"

echo [2/4] Starting Chest X-Ray CNN Server (Port 8001)...
start "GramSeva Chest X-Ray CNN Server (Port 8001)" cmd /k "python backend\train_chest_xray_server.py"

echo [3/4] Starting Vite React Frontend...
start "GramSeva Frontend Dev Server" cmd /k "cd frontend && npm run dev"

echo [4/4] Opening browser to http://localhost:5173...
:: Wait 3 seconds for Vite server to boot up
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo =====================================================================
echo Startup complete! You can close this launcher window.
echo Individual servers are running in the newly opened terminal windows.
echo =====================================================================
pause
