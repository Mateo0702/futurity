param([ValidateRange(1024,65535)][int]$Port = 8810)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.\.venv\Scripts\python.exe')) { throw 'Ejecute primero .\instalar.ps1' }
if (-not (Test-Path -LiteralPath '.\backend\futurity_tracker.db')) { throw 'Falta la base migrada.' }
if (-not (Test-Path -LiteralPath '.\backend\.env')) { throw 'Falta la configuracion privada.' }
Write-Host "Tracker: http://127.0.0.1:$Port/dashboard/ . Mantenga esta ventana abierta durante la prueba."
& '.\.venv\Scripts\python.exe' '.\run_server.py' --host 127.0.0.1 --port $Port
exit $LASTEXITCODE
