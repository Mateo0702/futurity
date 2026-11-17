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
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*sync_clientes_worker.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo.
echo Todos los servicios (Caddy, Waitress y Sync Worker) han sido detenidos.
echo ======================================================
timeout /t 3
