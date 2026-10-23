@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\stop-real-demo.ps1"
pause
