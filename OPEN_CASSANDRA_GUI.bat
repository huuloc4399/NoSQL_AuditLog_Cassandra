@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\open-cassandra-gui.ps1"
if errorlevel 1 pause
