Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Operaciones\Documents\Futurity\futurity"

' Iniciar Servidor de Produccion (Waitress) de forma invisible
WshShell.Run "cmd.exe /c run_prod.bat", 0, False

' Iniciar Servidor Seguro Caddy (HTTPS) de forma invisible
WshShell.Run "cmd.exe /c run_caddy.bat", 0, False
