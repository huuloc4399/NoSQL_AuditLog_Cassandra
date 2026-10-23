@echo off
chcp 65001 >nul
title KHOI DONG HE THONG AUDIT LOG - APACHE CASSANDRA
color 0A

echo ========================================================
echo       HE THONG GIAM SAT AUDIT LOG - APACHE CASSANDRA
echo                   KHOI DONG TU DONG 1-CLICK
echo ========================================================
echo.

echo [1/4] Kiem tra Docker Desktop...
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I /N "Docker Desktop.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo       Docker Desktop dang mo.
) else (
    echo       Dang mo Docker Desktop...
    start "" "D:\Docker\Docker\Docker Desktop.exe"
    echo       Dang doi Docker Engine khoi dong...
)

:WAIT_DOCKER
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if "%ERRORLEVEL%" NEQ "0" (
    echo       Dang cho Docker Engine san sang...
    goto WAIT_DOCKER
)
echo       Docker da san sang!
echo.

echo [2/4] Khoi dong CSDL Apache Cassandra...
cd /d "D:\NoSQL10\audit-log-system"
docker compose up -d
echo.

echo [3/4] Khoi dong Backend API (Port 5000)...
start "AuditLog-Backend" cmd /k "cd /d D:\NoSQL10\audit-log-system\backend && npm run dev"
timeout /t 3 /nobreak >nul

echo [4/4] Khoi dong Frontend Dashboard (Port 5173)...
start "AuditLog-Frontend" cmd /k "cd /d D:\NoSQL10\audit-log-system\frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo     HOAN TAT! DANG MO GIAO DIEN TREN TRINH DUYET...
echo     Link he thong: http://localhost:5173
echo ========================================================
start http://localhost:5173
