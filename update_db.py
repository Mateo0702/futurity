import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__) + '/..'))
from db_config import get_db_connection

def update():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Verificar si session_token existe en usuarios_callcenter
        cursor.execute("SHOW COLUMNS FROM usuarios_callcenter LIKE 'session_token'")
        if cursor.fetchone():
            print("La columna session_token ya existe en usuarios_callcenter.")
        else:
            cursor.execute("ALTER TABLE usuarios_callcenter ADD COLUMN session_token VARCHAR(64) DEFAULT NULL;")
            conn.commit()
            print("Columna session_token añadida con éxito.")

        # Verificar y agregar alerta_panico en tecnicos
        cursor.execute("SHOW COLUMNS FROM tecnicos LIKE 'alerta_panico'")
        if cursor.fetchone():
            print("La columna alerta_panico ya existe en tecnicos.")
        else:
            cursor.execute("ALTER TABLE tecnicos ADD COLUMN alerta_panico TINYINT(1) DEFAULT 0;")
            conn.commit()
            print("Columna alerta_panico añadida con éxito.")

        # Verificar y agregar mensaje_panico en tecnicos
        cursor.execute("SHOW COLUMNS FROM tecnicos LIKE 'mensaje_panico'")
        if cursor.fetchone():
            print("La columna mensaje_panico ya existe en tecnicos.")
        else:
            cursor.execute("ALTER TABLE tecnicos ADD COLUMN mensaje_panico VARCHAR(255) DEFAULT NULL;")
            conn.commit()
            print("Columna mensaje_panico añadida con éxito.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    update()
