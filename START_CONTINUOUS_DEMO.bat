@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-continuous-demo.ps1" %*
set "demoExitCode=%errorlevel%"
echo.
pause
exit /b %demoExitCode%
