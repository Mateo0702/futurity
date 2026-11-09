@echo off
setlocal
cd /d "%~dp0"
title Futurity Atlas - Sincronizador Base Central
echo ======================================================
echo   INICIANDO WORKER DE SINCRONIZACION CON BASE CENTRAL
echo ======================================================
.venv\Scripts\python.exe sync_clientes_worker.py
pause

