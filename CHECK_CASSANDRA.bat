@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\cassandra-console.ps1" -Action status
pause
