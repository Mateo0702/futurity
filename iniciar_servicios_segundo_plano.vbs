Set WshShell = CreateObject("WScript.Shell")
' Iniciar Servidor de Produccion (Waitress) de forma invisible
WshShell.Run "C:\Users\Operaciones\Documents\Futurity\futurity\run_prod.bat", 0, False

' Iniciar Servidor Seguro Caddy (HTTPS) de forma invisible
WshShell.Run "C:\Users\Operaciones\Documents\Futurity\futurity\run_caddy.bat", 0, False
