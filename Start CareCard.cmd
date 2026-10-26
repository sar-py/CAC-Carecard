@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer from nodejs.org, then try again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3000 in your browser.
node Server\server.js
pause
