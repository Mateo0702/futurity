$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.\backend\futurity_tracker.db')) { throw 'Falta la base migrada. No se creara una vacia.' }
if (-not (Test-Path -LiteralPath '.\backend\.env')) { throw 'Falta la configuracion privada del paquete.' }
& py -3.12 --version
if ($LASTEXITCODE -ne 0) { throw 'Instale Python 3.12 de 64 bits con su lanzador py.' }
if (-not (Test-Path -LiteralPath '.\.venv\Scripts\python.exe')) {
    & py -3.12 -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno de Python.' }
}
& '.\.venv\Scripts\python.exe' -m pip install --disable-pip-version-check -r '.\backend\requirements.txt'
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias. Conserve el mensaje de error.' }
& '.\.venv\Scripts\python.exe' '.\verificar_copia.py'
if ($LASTEXITCODE -ne 0) { throw 'La verificacion de la copia fallo.' }
Write-Host 'Instalacion terminada. Ejecute .\arrancar.ps1'
