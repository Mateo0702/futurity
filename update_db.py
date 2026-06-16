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

        # Verificar si primer_ingreso existe en usuarios_callcenter
        cursor.execute("SHOW COLUMNS FROM usuarios_callcenter LIKE 'primer_ingreso'")
        if cursor.fetchone():
            print("La columna primer_ingreso ya existe en usuarios_callcenter.")
        else:
            cursor.execute("ALTER TABLE usuarios_callcenter ADD COLUMN primer_ingreso TINYINT(1) DEFAULT 1;")
            conn.commit()
            print("Columna primer_ingreso añadida con éxito.")

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

        # Verificar y agregar columnas de encuesta en visitas_tecnicas
        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'encuesta_rapidez'")
        if cursor.fetchone():
            print("La columna encuesta_rapidez ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN encuesta_rapidez INT DEFAULT NULL;")
            conn.commit()
            print("Columna encuesta_rapidez añadida con éxito.")

        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'encuesta_atencion'")
        if cursor.fetchone():
            print("La columna encuesta_atencion ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN encuesta_atencion INT DEFAULT NULL;")
            conn.commit()
            print("Columna encuesta_atencion añadida con éxito.")

        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'encuesta_explicacion'")
        if cursor.fetchone():
            print("La columna encuesta_explicacion ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN encuesta_explicacion INT DEFAULT NULL;")
            conn.commit()
            print("Columna encuesta_explicacion añadida con éxito.")

        # Columnas para Foto de Equipos y Firma de Cliente
        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'foto_equipos'")
        if cursor.fetchone():
            print("La columna foto_equipos ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN foto_equipos VARCHAR(255) DEFAULT NULL;")
            conn.commit()
            print("Columna foto_equipos añadida con éxito.")

        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'foto_equipos_2'")
        if cursor.fetchone():
            print("La columna foto_equipos_2 ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN foto_equipos_2 VARCHAR(255) DEFAULT NULL;")
            conn.commit()
            print("Columna foto_equipos_2 añadida con éxito.")

        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'firma_cliente'")
        if cursor.fetchone():
            print("La columna firma_cliente ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN firma_cliente VARCHAR(255) DEFAULT NULL;")
            conn.commit()
            print("Columna firma_cliente añadida con éxito.")

        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'equipos_juntos'")
        if cursor.fetchone():
            print("La columna equipos_juntos ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN equipos_juntos TINYINT(1) DEFAULT 1;")
            conn.commit()
            print("Columna equipos_juntos añadida con éxito.")

        # Verificar y agregar latitud en visitas_tecnicas
        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'latitud'")
        if cursor.fetchone():
            print("La columna latitud ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN latitud DOUBLE DEFAULT NULL;")
            conn.commit()
            print("Columna latitud añadida con éxito.")

        # Verificar y agregar longitud en visitas_tecnicas
        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'longitud'")
        if cursor.fetchone():
            print("La columna longitud ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN longitud DOUBLE DEFAULT NULL;")
            conn.commit()
            print("Columna longitud añadida con éxito.")
            
        # Verificar y agregar columnas para fotos extras opcionales (1 a 4)
        for idx in range(1, 5):
            col_name = f"foto_extra_{idx}"
            cursor.execute(f"SHOW COLUMNS FROM visitas_tecnicas LIKE '{col_name}'")
            if cursor.fetchone():
                print(f"La columna {col_name} ya existe en visitas_tecnicas.")
            else:
                cursor.execute(f"ALTER TABLE visitas_tecnicas ADD COLUMN {col_name} VARCHAR(255) DEFAULT NULL;")
                conn.commit()
                print(f"Columna {col_name} añadida con éxito.")
            
        # Verificar y agregar latitud_inicio en visitas_tecnicas
        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'latitud_inicio'")
        if cursor.fetchone():
            print("La columna latitud_inicio ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN latitud_inicio DOUBLE DEFAULT NULL;")
            conn.commit()
            print("Columna latitud_inicio añadida con éxito.")

        # Verificar y agregar longitud_inicio en visitas_tecnicas
        cursor.execute("SHOW COLUMNS FROM visitas_tecnicas LIKE 'longitud_inicio'")
        if cursor.fetchone():
            print("La columna longitud_inicio ya existe en visitas_tecnicas.")
        else:
            cursor.execute("ALTER TABLE visitas_tecnicas ADD COLUMN longitud_inicio DOUBLE DEFAULT NULL;")
            conn.commit()
            print("Columna longitud_inicio añadida con éxito.")
            
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    update()
