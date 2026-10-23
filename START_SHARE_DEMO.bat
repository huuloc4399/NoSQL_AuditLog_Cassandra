@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start-share-demo.ps1"
pause
