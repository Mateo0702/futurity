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
taskkill /F /FI "WINDOWTITLE eq Futurity Atlas - Sincronizador Base Central*" >nul 2>&1
wmic process where "commandline like '%%sync_clientes_worker.py%%'" delete >nul 2>&1
echo.
echo Todos los servicios (Caddy, Waitress y Sincronizador) han sido detenidos.
echo ======================================================
timeout /t 3
