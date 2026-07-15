@echo off
setlocal
cd /d "%~dp0"
echo Starting TONA Agent Studio...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 18+ first.
  pause
  exit /b 1
)
start "TONA Agent Studio Server" /min node server.js
timeout /t 2 /nobreak >nul
start http://localhost:7357
exit /b 0

