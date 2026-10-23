@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\stop-share-demo.ps1"
pause
