@echo off
setlocal
cd /d "%~dp0"
echo Starting TONA on http://localhost:7357 ...
start "TONA Agent Studio Server" /min node server.js
timeout /t 2 /nobreak >nul
echo Starting Cloudflare quick tunnel for http://localhost:7357 ...
echo Keep the tunnel window running while Feishu uses the callback.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:7357
