import os
import glob
import mysql.connector
import pandas as pd
from datetime import datetime, date, time
import re

# Importamos la función de normalización del proyecto
from utils import normalizar_horario_texto

def clean_excel_columns(df):
    """
    Sanitiza los nombres de las columnas limpiando tildes y caracteres especiales.
    """
    cols = []
    for c in df.iloc[0].values:
        val = str(c).strip().upper()
        # Limpiar caracteres comunes
        val = val.replace('Nº', 'N').replace('N°', 'N')
        val = val.replace('TÉCNICOS', 'TECNICOS').replace('TCNICOS', 'TECNICOS')
        val = val.replace('RECIBIDO EN COORDINACIÓN', 'RECIBIDO EN COORDINACION')
        val = val.replace('RECIBIDO EN COORDINACIN', 'RECIBIDO EN COORDINACION')
        cols.append(val)
    return cols

def importar_visitas_diarias():
    # 1. Configuración de credenciales de la BD
    config_db = {
        'host': 'localhost',
        'user': 'root',
        'password': 'Sama/2001',
        'database': 'optimizador_rutas'
    }

    # 2. Carpeta de descargas del usuario donde están los archivos del Drive
    downloads_dir = r"C:\Users\mateo\Downloads"
    pattern = os.path.join(downloads_dir, "INSTALACIONES*.xlsx")
    files = glob.glob(pattern)

    if not files:
        print(f"No se encontraron archivos que coincidan con 'INSTALACIONES*.xlsx' en {downloads_dir}")
        return

    print(f"Se encontraron {len(files)} archivos para procesar:")
    for f in files:
        print(f" - {os.path.basename(f)}")

    # Conectar a la base de datos
    print("\nConectando a la base de datos MySQL...")
    try:
        conexion = mysql.connector.connect(**config_db)
        cursor = conexion.cursor(dictionary=True)
    except Exception as e:
        print(f"Error de conexión a la base de datos: {e}")
        return

    total_procesados = 0
    total_insertados = 0
    total_duplicados = 0

    try:
        for filepath in files:
            filename = os.path.basename(filepath)
            print(f"\n--- Procesando archivo: {filename} ---")
            
            # Cargar el Excel sin cabeceras
            df = pd.read_excel(filepath, header=None)
            
            # Mapear las columnas sanitizadas
            headers = clean_excel_columns(df)
            print("Cabeceras detectadas:", headers)
            
            # Crear un nuevo dataframe a partir de la fila 1 con los nombres sanitizados
            df_data = df.iloc[1:].copy()
            df_data.columns = headers
            
            # Filtrar filas vacías (donde contrato y cliente sean nulos)
            df_data = df_data.dropna(subset=['CONTRATO N', 'CLIENTE'], how='all')
            
            print(f"Total de registros a evaluar en este archivo: {len(df_data)}")
            
            for index, row in df_data.iterrows():
                # --- PARSEO DE FECHA ---
                fecha_val = row.get('FECHA')
                if pd.isna(fecha_val):
                    continue
                
                try:
                    fecha_dt = pd.to_datetime(fecha_val)
                    fecha_prog = fecha_dt.date().isoformat()
                    mes = fecha_dt.month
                    ano = fecha_dt.year
                except Exception as e:
                    print(f"Fila {index}: Error al parsear fecha '{fecha_val}': {e}")
                    continue
                
                # Filtrar solo meses de mayo (5) y junio (6) del año 2026
                if ano != 2026 or mes not in [5, 6]:
                    continue
                
                # --- PARSEO DE HORA ---
                hora_val = row.get('HORA')
                hora_prog = None
                if pd.notna(hora_val):
                    try:
                        if isinstance(hora_val, time):
                            hora_prog = hora_val.isoformat()
                        elif isinstance(hora_val, datetime):
                            hora_prog = hora_val.time().isoformat()
                        else:
                            hora_prog = str(hora_val).strip()
                    except:
                        pass
                
                # --- CONTRATO ---
                contrato = str(row.get('CONTRATO N', '')).strip()
                if contrato.endswith('.0') or contrato.endswith(',0'):
                    contrato = contrato[:-2]
                if contrato in ['', 'nan', 'NAN', 'None', 'NONE']:
                    contrato = None
                else:
                    contrato = contrato[:20]
                
                # --- CLIENTE ---
                cliente = str(row.get('CLIENTE', '')).strip().upper()
                if not cliente or cliente in ['NAN', 'NONE']:
                    cliente = "SIN NOMBRE"
                cliente = cliente[:150]
                
                # --- SERVICIO / PRODUCTO / TIPO INSTALACION ---
                servicio = str(row.get('SERVICIO A REALIZAR', '')).strip().upper()[:50] if pd.notna(row.get('SERVICIO A REALIZAR')) else 'INSTALACION'
                producto = str(row.get('PRODUCTO', '')).strip().upper()[:50] if pd.notna(row.get('PRODUCTO')) else None
                tipo_instalacion = str(row.get('NORMAL / DUCTOS', '')).strip().upper()[:50] if pd.notna(row.get('NORMAL / DUCTOS')) else None
                vendedor = str(row.get('VENDEDOR', '')).strip().upper()[:100] if pd.notna(row.get('VENDEDOR')) else None
                
                recibido_coordinacion_raw = row.get('RECIBIDO EN COORDINACION')
                recibido_coordinacion = None
                if pd.notna(recibido_coordinacion_raw):
                    try:
                        recibido_coordinacion = pd.to_datetime(recibido_coordinacion_raw).strftime('%Y-%m-%d %H:%M:%S')
                    except:
                        pass
                
                # --- TECNICOS (PRINCIPAL Y APOYO) ---
                tecnicos_raw = str(row.get('TECNICOS', '')).strip()
                tecnico_principal = None
                tecnico_apoyo = None
                
                if pd.notna(row.get('TECNICOS')) and tecnicos_raw not in ['', 'nan', 'NAN', 'None', 'NONE']:
                    if '/' in tecnicos_raw:
                        parts = [p.strip().upper() for p in tecnicos_raw.split('/')]
                        tecnico_principal = parts[0][:100]
                        if len(parts) > 1:
                            tecnico_apoyo = parts[1][:100]
                    else:
                        tecnico_principal = tecnicos_raw.upper()[:100]
                
                # --- SECTOR / ZONA / TELEFONOS ---
                sector = str(row.get('SECTOR', '')).strip().upper()[:100] if pd.notna(row.get('SECTOR')) else None
                
                # Consultar directorio_clientes para rescatar teléfonos y zona de forma automática
                telefonos = None
                direccion = sector
                if contrato:
                    cursor.execute("SELECT telefono1, telefono2, zona FROM directorio_clientes WHERE contrato = %s", (contrato,))
                    cliente_db = cursor.fetchone()
                    if cliente_db:
                        t1 = str(cliente_db['telefono1']).strip() if cliente_db['telefono1'] else ""
                        if t1.endswith('.0') or t1.endswith(',0'): t1 = t1[:-2]
                        if t1.lower() in ['nan', 'none']: t1 = ""
                        
                        t2 = str(cliente_db['telefono2']).strip() if cliente_db['telefono2'] else ""
                        if t2.endswith('.0') or t2.endswith(',0'): t2 = t2[:-2]
                        if t2.lower() in ['nan', 'none']: t2 = ""
                        
                        if t1:
                            telefonos = t1
                            if t2 and t2 != t1:
                                telefonos += f" / {t2}"
                        elif t2:
                            telefonos = t2
                        
                        zona = cliente_db['zona']
                        if zona and sector and zona.upper() != sector.upper():
                            direccion = f"{sector} ({zona})"
                
                # --- EMPRESA ---
                empresa = "SERVICABLE"
                if contrato and (contrato.upper().endswith('F') or contrato.upper().endswith('G')):
                    empresa = "FIBRACOM"
                
                # --- HORARIOS PARA EL OPTIMIZADOR ---
                preferencia_horaria = hora_prog if hora_prog else "Todo el día"
                ventana_inicio, ventana_fin = normalizar_horario_texto(preferencia_horaria)
                
                # --- ESTADO Y PRIORIDAD ---
                estado = "FINALIZADA"  # Como son visitas pasadas de mayo/junio, se importan como finalizadas
                prioridad = "MEDIA"
                creado_por = "Importado"
                
                # Fecha y hora de registro combinada
                fecha_registro = datetime.combine(fecha_dt.date(), time.min)
                
                # --- VERIFICACIÓN DE DUPLICADOS ---
                cursor.execute("""
                    SELECT COUNT(*) as c FROM visitas_tecnicas 
                    WHERE contrato = %s AND fecha_programada = %s AND es_instalacion = 1
                """, (contrato, fecha_prog))
                if cursor.fetchone()['c'] > 0:
                    total_duplicados += 1
                    continue
                
                # --- INSERCIÓN ---
                query_insert = """
                    INSERT INTO visitas_tecnicas (
                        creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_programada, preferencia_horaria, 
                        prioridad, empresa, contrato, cliente, telefonos, sector, direccion, 
                        servicio, estado, es_instalacion, producto, tipo_instalacion, vendedor, recibido_coordinacion,
                        ventana_inicio_min, ventana_fin_min
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                valores = (
                    creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_prog, preferencia_horaria,
                    prioridad, empresa, contrato, cliente, telefonos, sector, direccion,
                    servicio, estado, 1, producto, tipo_instalacion, vendedor, recibido_coordinacion,
                    ventana_inicio, ventana_fin
                )
                
                cursor.execute(query_insert, valores)
                total_insertados += 1
                total_procesados += 1
                
            conexion.commit()
            print(f"Archivo finalizado. Insertados: {total_insertados}, Duplicados omitidos: {total_duplicados}")
            
    except Exception as e:
        conexion.rollback()
        print(f"Error durante la importación: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conexion.close()
        print("\nConexión a MySQL cerrada de forma segura.")
        print(f"=== RESULTADO GENERAL ===")
        print(f"Total visitas importadas (Mayo/Junio): {total_insertados}")
        print(f"Total duplicados omitidos: {total_duplicados}")

if __name__ == '__main__':
    importar_visitas_diarias()
