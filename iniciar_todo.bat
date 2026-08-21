@echo off
setlocal
cd /d "%~dp0"
echo ======================================================
echo    INICIANDO SERVICIOS DE FUTURITY ATLAS (HTTPS)
echo ======================================================
wscript.exe iniciar_servicios_segundo_plano.vbs
echo.
echo Servidor Waitress (Puerto 5000) y Caddy HTTPS (Puertos 80 y 443)
echo han sido iniciados en segundo plano exitosamente.
echo.
echo URL de acceso: https://atlas.futurity.com.ec
echo ======================================================
timeout /t 3
