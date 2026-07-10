import os
from dotenv import load_dotenv
from app import app
from waitress import serve

# Cargar variables de entorno del archivo .env
load_dotenv()

if __name__ == '__main__':
    # Obtener el puerto desde las variables de entorno, o usar 5000 por defecto
    port = int(os.environ.get('PORT', 5000))
    
    print(f"Iniciando servidor de producción Waitress en http://0.0.0.0:{port}")
    print("Aceptando conexiones externas en todas las interfaces de red de esta máquina...")
    
    # Iniciar el servidor Waitress
    # host='0.0.0.0' expone el servidor a la red local y al exterior (si la IP es pública o está ruteada)
    serve(app, host='0.0.0.0', port=port, threads=8)
