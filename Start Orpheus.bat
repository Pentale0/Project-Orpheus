@echo off
title Project Orpheus
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
start "" http://127.0.0.1:4173/
node server.js
pause