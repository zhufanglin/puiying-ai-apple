@echo off
title PuiYing Apple - Start

set "ROOT=%~dp0"

echo.
echo ============================================
echo   PuiYing AI - Apple Subsystem
echo   Local Dev Mode (SQLite)
echo ============================================
echo.

echo [1/2] Starting API backend (port 8000)...
start /b "" cmd /c "cd /d "%ROOT%apps\api" && .venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting Web frontend (port 3000)...
start /b "" cmd /c "cd /d "%ROOT%apps\web" && npm run dev"

echo.
echo ============================================
echo   Started!
echo.
echo   Frontend : http://localhost:3000
echo   API Docs : http://localhost:8000/docs
echo.
echo   Login   : admin / admin123
echo.
echo   Press Ctrl+C or close this window to stop
echo ============================================
echo.

pause
