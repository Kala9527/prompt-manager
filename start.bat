@echo off
setlocal

title prompt-manager
cd /d "%~dp0"

echo ========================================
echo Starting prompt-manager
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js was not found.
  echo Please install Node.js first, then run this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm was not found.
  echo Please check your Node.js installation.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [Error] package.json was not found.
  echo Please put this file in the project root directory.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependencies were not found. Running npm install...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [Error] npm install failed.
    pause
    exit /b 1
  )
  echo.
)

echo Dev server URL: http://127.0.0.1:5180
if defined OPENAI_CHAT_COMPLETIONS_URL (
  echo Proxy target: %OPENAI_CHAT_COMPLETIONS_URL%
) else (
  echo Proxy target: http://127.0.0.1:8008/v1/chat/completions
)
if defined OPENAI_MODEL (
  echo Default model: %OPENAI_MODEL%
) else (
  echo Default model: deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
)
echo Keep this window open while using the app.
echo.

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5180'" >nul 2>nul

call npm run dev
if errorlevel 1 (
  echo.
  echo [Error] Failed to start the dev server.
  echo Check whether port 5180 is already in use.
  echo.
  pause
  exit /b 1
)

pause
