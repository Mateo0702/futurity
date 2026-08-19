@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo   FUTURITY ATLAS - EJECUTOR DE RESPALDOS DIARIOS
echo ===================================================
echo Iniciando proceso a las: %date% %time%
.venv\Scripts\python.exe backup_manager.py
echo.
echo Proceso finalizado.
endlocal
