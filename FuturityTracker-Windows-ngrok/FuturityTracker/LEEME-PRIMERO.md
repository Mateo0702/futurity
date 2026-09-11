# Futurity Tracker: prueba en Windows 11 mediante ngrok

Este paquete contiene una COPIA de la base del piloto, incluidos dispositivos, perfiles, historial y hashes de credenciales. backend/.env conserva la credencial de administracion actual. Transfiera el ZIP solo al administrador por un medio privado. No lo publique en una web, repositorio o carpeta servida por ngrok. No necesita copiar Android Studio ni reinstalar el APK.

## 1. Acordar una URL propia

El administrador debe asignar un endpoint HTTPS exclusivo de Tracker, encaminado a http://127.0.0.1:8810 en este Windows. Puede ser un dominio de ngrok: no exige un subdominio futurity.com.ec.

No redirigir el dominio que sirve Atlas hacia Tracker. No sustituir la configuracion de ngrok existente, no usar pooling para mezclar servicios distintos y no detener los tuneles actuales. Si el plan solo ofrece un dominio y ya esta ocupado, el administrador debe resolver la disponibilidad de otro endpoint/dominio o preparar un proxy por rutas. El despliegue por rutas no esta incluido en este paquete y requiere comprobar el prefijo en la app y la web antes de utilizarlo.

## 2. Copiar e instalar

Instalar Python 3.12 de 64 bits con su lanzador py (https://www.python.org/downloads/windows/). Descomprimir la carpeta FuturityTracker en C:\FuturityTracker o en otra carpeta propia acordada, fuera de Atlas y fuera de carpetas de red/OneDrive.

En PowerShell:

```powershell
Set-Location -LiteralPath 'C:\FuturityTracker'
.\instalar.ps1
.\arrancar.ps1
```

Si Windows bloquea scripts, pedir al administrador que aplique su procedimiento aprobado. No cambiar la politica global del servidor para esta prueba. Se puede ejecutar manualmente lo que hacen los scripts:

```powershell
Set-Location -LiteralPath 'C:\FuturityTracker'
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe .\verificar_copia.py
.\.venv\Scripts\python.exe .\run_server.py --host 127.0.0.1 --port 8810
```

Verificar la copia antes del PRIMER arranque y antes de editar .env: despues de cambiar la clave o recibir ubicaciones, los archivos ya no coinciden con el manifiesto original. Para los siguientes arranques solo utilizar arrancar.ps1.

ADMIN_TOKEN admite un minimo de 12 caracteres. Para cambiarlo despues de la verificacion, editar solamente su valor en backend/.env, guardar y reiniciar solo Tracker. No cambia las credenciales de los PMT. El generador sigue creando claves largas por defecto.

Si el puerto esta ocupado, no detener el proceso que lo usa: acordar otro puerto y usar arrancar.ps1 -Port NUMERO, modificando tambien el destino de ngrok.

## 3. Comprobar localmente

Abrir http://127.0.0.1:8810/health: debe mostrar status ok.
Abrir http://127.0.0.1:8810/dashboard/ e ingresar la credencial de administracion habitual. Tambien se encuentra como ADMIN_TOKEN en backend/.env; ese archivo se consulta localmente y nunca se comparte en capturas.
Comprobar los dispositivos y el historial existentes. Es normal que se vean desconectados hasta que los PMT apunten al nuevo servidor. Si la lista esta vacia, parar y revisar la base utilizada; no registrar todos los dispositivos de nuevo.

## 4. Publicar solo el servicio Tracker

Con ngrok instalado y autenticado por el administrador, y solo si la URL asignada esta libre y corresponde a Tracker, ejecutar en otra ventana:

```powershell
ngrok http http://127.0.0.1:8810 --url https://DOMINIO-ASIGNADO-PARA-TRACKER
```

Reemplazar el dominio de ejemplo por el REAL de la cuenta. Si se ejecuta desde una carpeta que contiene ngrok.exe pero no esta en PATH, usar .\ngrok.exe. El administrador puede incorporar el endpoint al agente existente segun la version de su configuracion; este paquete no reemplaza ni modifica ese archivo.

Mantener el login propio de Tracker. No colocar un login interactivo de Google/OAuth ni Basic Auth delante de toda la API: la app Android utiliza su credencial Bearer y no puede completar ese login. Revisar con el administrador la captura de trafico de ngrok para no conservar credenciales o coordenadas innecesariamente.

Desde otra red, comprobar https://DOMINIO-ASIGNADO-PARA-TRACKER/health y /dashboard/. En planes gratuitos puede aparecer Visit Site antes de abrir la web; las llamadas programaticas a la API no deberian requerir ese paso.

## 5. Conectar un PMT

Usar como servidor https://DOMINIO-ASIGNADO-PARA-TRACKER/ (sin /dashboard/ ni /api/v1/).

ATENCION: el APK actual pide introducir una credencial al cambiar manualmente de servidor. Puede ingresar LA MISMA credencial del dispositivo: la base migrada sigue validandola. El backend conserva su hash, no permite recuperar el texto original.

Si no conserva esa credencial en texto, utilizar Test DPC > Set application restrictions para com.futurity.tracker y establecer SOLO server_url con la nueva URL. Mantener las otras restricciones existentes; no agregar device_token vacio ni tracking_enabled=false. El codigo del APK utiliza la credencial local cuando la clave device_token no esta presente. Si ya hay una credencial gestionada, conservarla. Reabrir Tracker y verificar que muestra la URL correcta. Si la pantalla de Test DPC no permite conservar/omitir esas claves, revisar su configuracion antes de guardarla.

No borrar datos ni reinstalar la app y no regenerar tokens para realizar esta prueba. Verificar con datos moviles ubicaciones nuevas, el historial anterior y sincronizacion sin conexion. Despues cambiar los demas PMT.

## 6. Prueba y corte definitivo son diferentes

Consultar MANIFIESTO.json para la fecha del respaldo. Una copia creada hoy NO incluye los registros que el servidor LAN reciba despues. Este paquete permite preparar y probar el destino.

Para el corte definitivo: detener solo Tracker LAN, crear un paquete nuevo mediante preparar_paquete_tracker.py en el PC original y repetir la restauracion en una carpeta nueva del destino. Mantener las apps registrando sin conexion durante ese intervalo. No sobrescribir una base que ya recibio datos exclusivos del servidor nuevo: respaldarla y reconciliar esos datos antes de sustituirla. Evitar que distintos PMT continuen escribiendo en dos servidores separados.

Para regenerar el paquete, desde el PC original ejecutar el script preparar_paquete_tracker.py con el Python del entorno .venv original. Siempre crea una entrega nueva; no elimina entregas anteriores ni modifica la base de origen.

## 7. Duracion y operacion posterior

Durante esta prueba, mantener Windows encendido, conectado y sin suspension, y mantener activos Tracker y ngrok. Esto es un arranque manual; no instala tareas ni servicios. Antes de dejarlo funcionando sin supervision, el administrador debe configurar inicio automatico, recuperacion tras fallos y copias consistentes de SQLite, con una prueba de restauracion.

Comprobar el plan ngrok: a la fecha de preparacion la documentacion gratuita indica un dominio de desarrollo y 20.000 solicitudes HTTP por mes. La web consulta cada 10 segundos; un navegador abierto ocho horas consume aproximadamente 2.880 consultas de listado, ademas del trafico de los PMT y otras acciones. Es adecuado comprobar cupos antes de una prueba prolongada.

Fuentes oficiales:
- https://ngrok.com/docs/gateway/agent/cli
- https://ngrok.com/docs/gateway/agent/config/v3
- https://ngrok.com/docs/pricing-limits/free-plan-limits

No se ha publicado este paquete ni se ha configurado el servidor remoto. Se debe verificar el funcionamiento real del tunel desde una red externa.
