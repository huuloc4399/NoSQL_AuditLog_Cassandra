@echo off
chcp 65001 >nul
title DUNG HE THONG AUDIT LOG
color 0C

echo ========================================================
echo             DUNG TOAN BO HE THONG AUDIT LOG
echo ========================================================
echo.

echo [1/2] Dang dong cac cua so Backend va Frontend...
taskkill /F /FI "WINDOWTITLE eq AuditLog-Backend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq AuditLog-Frontend*" 2>nul

echo [2/2] Dang tam dung container Cassandra...
cd /d "D:\NoSQL10\audit-log-system"
docker compose stop

echo.
echo ========================================================
echo     DA DUNG HE THONG AN TOAN! DU LIEU DUOC LUU DAY DU.
echo ========================================================
timeout /t 3 >nul
