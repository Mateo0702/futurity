import os
import subprocess
from dotenv import load_dotenv
from app import app

# Cargar variables de entorno del archivo .env
load_dotenv()

def liberar_puerto(puerto):
    """Busca y finaliza cualquier proceso que esté ocupando el puerto indicado en Windows."""
    try:
        result = subprocess.run("netstat -ano", shell=True, capture_output=True, text=True)
        pids_a_matar = set()
        mi_pid = os.getpid()

        for line in result.stdout.splitlines():
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
    port = int(os.environ.get('PORT', 5000))
    
    # Liberar el puerto de forma automática para evitar bloqueos
    # Solo en el proceso padre (evita que el reloader mate a su propio padre)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        liberar_puerto(port)
    
    print(f"Iniciando servidor de desarrollo Flask con Autoreload en http://0.0.0.0:{port}")
    # Ejecutar en modo debug con reload
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=True)
