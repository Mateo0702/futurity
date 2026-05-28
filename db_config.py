import mysql.connector
from mysql.connector import Error

# Credenciales centralizadas
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Sama/2001',
    'database': 'optimizador_rutas'
}

def get_db_connection():
    """Crea y devuelve una conexión a la base de datos."""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            return connection
    except Error as e:
        print(f"Error al conectar a MySQL: {e}")
        return None