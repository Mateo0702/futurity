import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__) + '/..'))
from db_config import get_db_connection

def update():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Verificar si la columna ya existe para evitar errores
        cursor.execute("SHOW COLUMNS FROM usuarios_callcenter LIKE 'session_token'")
        if cursor.fetchone():
            print("La columna session_token ya existe.")
        else:
            cursor.execute("ALTER TABLE usuarios_callcenter ADD COLUMN session_token VARCHAR(64) DEFAULT NULL;")
            conn.commit()
            print("Columna añadida con éxito.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    update()
