@echo off
setlocal
cd /d "%~dp0"
echo Iniciando servidor de produccion Futurity Atlas...
.venv\Scripts\python.exe run_prod.py
