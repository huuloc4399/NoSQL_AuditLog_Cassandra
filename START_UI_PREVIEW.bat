@echo off
setlocal
cd /d "%~dp0DeTai10_Nhom07_AuditLog_Cassandra\audit-log-system\frontend"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo AuditFlow demo: http://127.0.0.1:5173
echo Admin: admin / admin123
echo User:  user  / user12345
echo Demo data is stored only in your browser. Press Ctrl+C to stop.
call npm.cmd run demo -- --port 5173 --strictPort
pause
