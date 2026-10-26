@echo off
title Eliminar Servicio Cloudflared - Futurity Atlas
echo ============================================================
echo   ELIMINANDO SERVICIO Y EJECUTABLE OBSOLETO DE CLOUDFLARED
echo ============================================================
echo 1. Deteniendo servicio Cloudflared...
net stop Cloudflared
echo.
echo 2. Eliminando servicio Cloudflared de Windows...
sc delete Cloudflared
echo.
echo 3. Forzando cierre del proceso si queda residente...
taskkill /F /IM cloudflared-windows-amd64.exe >nul 2>&1
echo.
echo 4. Eliminando archivo ejecutable...
if exist "%~dp0cloudflared-windows-amd64.exe" (
    del /F /Q "%~dp0cloudflared-windows-amd64.exe"
    echo [EXITO] Archivo cloudflared-windows-amd64.exe eliminado correctamente.
) else (
    echo [INFO] El archivo no existe o ya fue eliminado.
)
echo.
echo ============================================================
echo PROCESO COMPLETADO
echo ============================================================
timeout /t 5
