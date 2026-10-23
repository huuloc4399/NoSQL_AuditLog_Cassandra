@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\check-demo-logs.ps1"
pause
