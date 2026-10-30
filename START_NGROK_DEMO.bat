@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start-ngrok-demo.ps1" %*
set "demoExitCode=%errorlevel%"
echo.
pause
exit /b %demoExitCode%
