@echo off
title Cassandra - audit_log_system
cd /d "%~dp0"
echo Cassandra 4.1.12 - Ubuntu WSL2 - 127.0.0.1:9042
echo Keyspace: audit_log_system
echo.
echo Useful commands to paste at the cqlsh prompt:
echo   DESCRIBE TABLES;
echo   SELECT * FROM services;
echo   SELECT username, full_name, role, status FROM users;
echo   SELECT service_name, log_time, level, action, message FROM audit_logs LIMIT 10;
echo   EXPAND ON;
echo.
echo Current tables:
powershell.exe -NoProfile -File "%~dp0scripts\cassandra-console.ps1" -Action tables
if errorlevel 1 (
  echo Start START_REAL_DEMO.bat first, then open this file again.
  pause
  exit /b 1
)
echo.
powershell.exe -NoProfile -File "%~dp0scripts\cassandra-console.ps1" -Action shell
pause
