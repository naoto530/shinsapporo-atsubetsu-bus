@echo off
cd /d "%~dp0"
set "PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY=python"
echo Starting preview server...
echo.
echo URL: http://127.0.0.1:5173/
echo Close this window to stop the server.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173/'" >nul 2>nul
"%PY%" "preview_server.py" 5173
pause
