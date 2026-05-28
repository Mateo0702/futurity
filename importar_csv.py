import os
import mysql.connector
import pandas as pd

def importar_excel_a_base():
    # 1. Nombre del archivo de Excel en la carpeta del proyecto
    archivo_excel = "base_clientes.xlsx"
    
    # Verificamos físicamente si el archivo existe antes de lanzar el proceso
    if not os.path.exists(archivo_excel):
        print(f"❌ Error: No se encontró el archivo '{archivo_excel}' en esta carpeta.")
        print("Asegúrate de que el nombre sea idéntico y esté en el mismo directorio.")
        return

    # 2. Configuración de credenciales de tu MySQL
    config_db = {
        'host': 'localhost',
        'user': 'root',       # Ajusta si manejas otro usuario
        'password': 'Sama/2001',       # Ajusta tu contraseña si tienes
        'database': 'optimizador_rutas'
    }

    print(f"⏳ Leyendo los datos de '{archivo_excel}'...")
    
    try:
        # 3. Cargar el Excel a memoria usando Pandas
        # (Ajustamos los nombres de las columnas para que coincidan con la estructura de tu Excel)
        df = pd.read_excel(archivo_excel)
        
        # Limpiamos espacios en blanco vacíos en los nombres de las columnas por si acaso
        df.columns = df.columns.str.strip()
        
        print(f"📊 Archivo leído con éxito. Se encontraron {len(df)} clientes listos para migrar.")
        print("🔌 Conectando a MySQL...")
        
        # 4. Establecer conexión con la base de datos
        conexion = mysql.connector.connect(**config_db)
        cursor = conexion.cursor()

        # 5. Consulta SQL con 'ON DUPLICATE KEY UPDATE'
        # Esto es un seguro de vida: si vuelves a correr el script, no se va a caer por "contrato duplicado",
        # sino que va a actualizar los teléfonos o la zona si es que cambiaron en el Excel.
        query_insert = """
            INSERT INTO directorio_clientes (
                contrato, fecha_instalacion, nombre_cliente, zona, telefono1, telefono2
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                fecha_instalacion = VALUES(fecha_instalacion),
                nombre_cliente = VALUES(nombre_cliente),
                zona = VALUES(zona),
                telefono1 = VALUES(telefono1),
                telefono2 = VALUES(telefono2);
        """

        print("🚀 Iniciando la inyección masiva en la base de datos...")
        
        contador_insertados = 0
        
        # 6. Iterar fila por fila el DataFrame de Pandas
        for index, fila in df.iterrows():
            # Mapeo exacto haciendo match con los nombres reales de las columnas en tu Excel
            datos_cliente = (
                str(fila['# Contrato']).strip(),
                str(fila['Fecha Instalacion']).strip() if pd.notna(fila['Fecha Instalacion']) else None,
                str(fila['Cliente']).strip().upper(),
                str(fila['Zona']).strip().upper() if pd.notna(fila['Zona']) else None,
                str(fila['Telefono1']).strip() if pd.notna(fila['Telefono1']) else None,
                str(fila['Telefono2']).strip() if pd.notna(fila['Telefono2']) else None
            )
            
            cursor.execute(query_insert, datos_cliente)
            contador_insertados += 1

        # 7. Confirmamos los cambios de golpe en la base de datos (Commit)
        conexion.commit()
        print(f"🏆 ¡Éxito absoluto! Se procesaron y guardaron {contador_insertados} clientes en 'directorio_clientes'.")

    except mysql.connector.Error as err:
        print(f"❌ Error crítico de MySQL durante la carga: {err}")
    except Exception as e:
        print(f"❌ Ocurrió un error inesperado al procesar el Excel: {e}")
    finally:
        # 8. Cerramos las compuertas limpiamente
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            print("🔌 Conexión a la base de datos cerrada de forma segura.")

if __name__ == "__main__":
    importar_excel_a_base()