@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start-real-demo.ps1"
if errorlevel 1 pause
