@echo off
setlocal
echo ======================================================
echo    DETENIENDO SERVICIOS DE FUTURITY ATLAS
echo ======================================================
taskkill /F /IM caddy.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":7565" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo.
echo Todos los servicios (Caddy y Waitress) han sido detenidos.
echo ======================================================
timeout /t 3
