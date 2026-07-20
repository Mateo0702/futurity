import os
import subprocess
import sys
from dotenv import load_dotenv
from app import app
from waitress import serve

# Cargar variables de entorno del archivo .env
load_dotenv()

def liberar_puerto(puerto):
    """Busca y finaliza cualquier proceso que esté ocupando el puerto indicado en Windows."""
    try:
        # Ejecutar netstat para listar conexiones y buscar el puerto
        result = subprocess.run("netstat -ano", shell=True, capture_output=True, text=True)
        pids_a_matar = set()
        mi_pid = os.getpid()

        for line in result.stdout.splitlines():
            # Buscar líneas que tengan el puerto (ej: :5000) y estado "LISTENING"
            if f":{puerto}" in line:
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid_str = parts[-1]
                    if pid_str.isdigit():
                        pid = int(pid_str)
                        if pid != mi_pid:
                            pids_a_matar.add(pid)

        for pid in pids_a_matar:
            print(f"[Puerto {puerto}] Finalizando proceso fantasma anterior (PID: {pid})...")
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"Advertencia al liberar puerto {puerto}: {e}")

if __name__ == '__main__':
    # Obtener el puerto desde las variables de entorno, o usar 5000 por defecto
    port = int(os.environ.get('PORT', 5000))
    
    # Liberar el puerto de forma automática para evitar bloqueos
    liberar_puerto(port)
    
    print(f"Iniciando servidor de producción Waitress en http://0.0.0.0:{port}")
    print("Aceptando conexiones externas en todas las interfaces de red de esta máquina...")
    
    # Iniciar el servidor Waitress
    # host='0.0.0.0' expone el servidor a la red local y al exterior (si la IP es pública o está ruteada)
    serve(app, host='0.0.0.0', port=port, threads=8)
