@echo off
setlocal
cd /d "%~dp0"
echo Iniciando servidor seguro Caddy (HTTPS)...
caddy.exe run --config Caddyfile
