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
            
        # Crear tabla recordatorios_bloqueos si no existe
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recordatorios_bloqueos (
                id_recordatorio INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(150) NOT NULL,
                descripcion TEXT,
                tipo VARCHAR(50) NOT NULL, -- 'RECORDATORIO_TECNICO', 'BLOQUEO_GENERAL', 'REUNION', 'INVENTARIO'
                fecha DATE NOT NULL,
                hora_inicio TIME DEFAULT NULL,
                hora_fin TIME DEFAULT NULL,
                tecnico_id INT DEFAULT NULL,
                creado_por VARCHAR(100) NOT NULL,
                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                activo BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id_tecnico) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        conn.commit()
        print("Tabla recordatorios_bloqueos verificada/creada con éxito.")

        # --- ACTUALIZACIÓN DE TABLA MATERIALES Y SIEMBRA DE CATÁLOGO ---
        # 1. Ampliar nombre_material a VARCHAR(255)
        try:
            cursor.execute("ALTER TABLE materiales MODIFY COLUMN nombre_material VARCHAR(255) NOT NULL;")
            conn.commit()
        except Exception as e:
            print(f"Nota en modify nombre_material: {e}")

        # 2. Agregar codigo_material
        cursor.execute("SHOW COLUMNS FROM materiales LIKE 'codigo_material'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE materiales ADD COLUMN codigo_material VARCHAR(50) DEFAULT NULL;")
            conn.commit()
            print("Columna codigo_material añadida con éxito.")

        # 3. Agregar categoria
        cursor.execute("SHOW COLUMNS FROM materiales LIKE 'categoria'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE materiales ADD COLUMN categoria VARCHAR(50) DEFAULT 'GENERAL';")
            conn.commit()
            print("Columna categoria añadida con éxito.")

        # 4. Agregar stock_minimo
        cursor.execute("SHOW COLUMNS FROM materiales LIKE 'stock_minimo'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE materiales ADD COLUMN stock_minimo INT DEFAULT 0;")
            conn.commit()
            print("Columna stock_minimo añadida con éxito.")

        # 5. Agregar activo
        cursor.execute("SHOW COLUMNS FROM materiales LIKE 'activo'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE materiales ADD COLUMN activo TINYINT(1) DEFAULT 1;")
            conn.commit()
            print("Columna activo añadida con éxito.")

        # Catálogo de Productos entregado por el usuario
        catalogo_oficial = [
            ("AMA0001", "AMARRAS INSTALACIONES", "UNIDADES", "AMARRAS", 50),
            ("BAS0001", "BASES PARA ANTENAS DE RADIO", "UNIDADES", "ACCESORIOS", 5),
            ("CAB0002", "CABLE DE FIBRA OPTICA DE 2HILOS", "METROS", "CABLES", 100),
            ("CAB0015", "CABLE DE FIBRA OPTICA DE 1HILO", "METROS", "CABLES", 100),
            ("CAB0003", "CABLE RG6", "METROS", "CABLES", 100),
            ("CAB0005", "CABLE UTP", "METROS", "CABLES", 100),
            ("CAN0002", "CANDADO", "UNIDADES", "ACCESORIOS", 2),
            ("CIN0001", "CINTA AISLANTE", "UNIDADES", "ACCESORIOS", 10),
            ("CLA0001", "CLAVOS", "UNIDADES", "ACCESORIOS", 100),
            ("CON0008V", "CONECTOR MECANICO SC/APC", "UNIDADES", "CONECTORES", 50),
            ("CON0008Z", "CONECTOR MECANICO SC/UPC", "UNIDADES", "CONECTORES", 50),
            ("CON0004", "CONECTORES RG6", "UNIDADES", "CONECTORES", 50),
            ("CON0003", "CONECTORES UTP", "UNIDADES", "CONECTORES", 50),
            ("GRA0001", "GRAPAS", "UNIDADES", "ACCESORIOS", 200),
            ("LIM0001", "LIMPIADOR DE ADAPTADOR OPTICO", "UNIDADES", "HERRAMIENTAS", 2),
            ("MIM0001", "MINI MANGA PARA FIBRA DROP", "UNIDADES", "ACCESORIOS", 10),
            ("PAT0001", "PATCH CORD FIBRA OPTICA SC/APC - SC/UPC", "UNIDADES", "CABLES", 10),
            ("PAT0003", "PATCH CORD FIBRA OPTICA SC/APC - SC/APC", "UNIDADES", "CABLES", 10),
            ("PIG0001", "PIGTAIL 1.5 MT SC/APC", "UNIDADES", "CABLES", 10),
            ("ROS0001", "CAJA ROSETA", "UNIDADES", "CAJAS", 15),
            ("SPL0001", "SPLITTER COAXIAL DE 2 VIAS", "UNIDADES", "SPLITTERS", 10),
            ("SPL0002", "SPLITTER COAXIAL DE 3 VIAS", "UNIDADES", "SPLITTERS", 10),
            ("TUB0002", "TUBILLO PARA FUSION", "UNIDADES", "ACCESORIOS", 100),
            ("UNI0005", "UNIONES PARA FIBRA OPTICA VERDE", "UNIDADES", "CONECTORES", 20),
            ("UNI0004", "UNIONES RG6", "UNIDADES", "CONECTORES", 20),
            ("CAB0013X", "CABLE UTP GALVANIZADO 6", "METROS", "CABLES", 100),
            ("TOM0002", "TOMACORRIENTE SOBREPUESTO", "UNIDADES", "ELECTRICIDAD", 5),
            ("CAB0013", "CABLE GEMELO", "METROS", "CABLES", 100),
            ("SPL0003", "SPLITTER OPTICO 1X2 SC-APC", "UNIDADES", "SPLITTERS", 10),
            ("UNI0006", "UNION OPTICA AZUL USADA", "UNIDADES", "CONECTORES", 20),
            ("CON0019", "CONECTOR RJ45 HEMBRA CAT.5e", "UNIDADES", "CONECTORES", 20),
            ("BRS0001", "BARRAS DE SILICON", "UNIDADES", "ACCESORIOS", 20),
            ("CJP0001", "CAJA PLASTICA EXTERIOR", "UNIDADES", "CAJAS", 5),
            ("CAN0004", "CANALETA", "UNIDADES", "ACCESORIOS", 20),
            ("CON0020", "CONECTOR RJ45 CAT.6", "UNIDADES", "CONECTORES", 50),
            ("BRO0003", "BROCA 5/32", "UNIDADES", "HERRAMIENTAS", 2),
            ("BRO0002", "BROCA 1/8", "UNIDADES", "HERRAMIENTAS", 2),
            ("TAC0001", "TACO FISCHER #6", "UNIDADES", "ACCESORIOS", 100),
            ("TOROOO1", "TORNILLO TRIPLE PLATO DE 1*8", "UNIDADES", "ACCESORIOS", 100),
            ("TOM0002B", "TOMACORRIENTE UNIVERSAL", "UNIDADES", "ELECTRICIDAD", 5),
            ("CAB0014", "CABLE UTP CAT 5E PARA EXTERIOR CON GEL", "METROS", "CABLES", 100),
            ("HERR0002", "HERRAJE TIPO A", "UNIDADES", "ACCESORIOS", 20),
            ("PRF0001", "PREFORMADO 7X30", "UNIDADES", "ACCESORIOS", 20),
            ("CAB0008", "CABLE DE FIBRA OPTICA DE 6H", "METROS", "CABLES", 100),
        ]

        for codigo, nombre, unidad, cat, stk_min in catalogo_oficial:
            cursor.execute("SELECT id_material FROM materiales WHERE codigo_material = %s OR nombre_material = %s", (codigo, nombre))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                    UPDATE materiales 
                    SET codigo_material = %s, nombre_material = %s, unidad_medida = %s, categoria = %s, stock_minimo = %s, activo = 1
                    WHERE id_material = %s
                """, (codigo, nombre, unidad, cat, stk_min, row[0] if isinstance(row, tuple) else row['id_material']))
            else:
                cursor.execute("""
                    INSERT INTO materiales (codigo_material, nombre_material, unidad_medida, categoria, stock_minimo, stock_bodega, activo)
                    VALUES (%s, %s, %s, %s, %s, 0, 1)
                """, (codigo, nombre, unidad, cat, stk_min))
        conn.commit()
        print("Catálogo oficial de productos importado/actualizado con éxito.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    update()

