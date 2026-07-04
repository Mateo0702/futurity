import os
import mysql.connector
import pandas as pd
from datetime import datetime, date, time

def importar_atenciones():
    # 1. Nombre del archivo de Excel
    archivo_excel = "CLIENTES ATENDIDOS DIARIAMENTE.xlsx"
    if not os.path.exists(archivo_excel):
        archivo_excel = "atenciones_diarias.xlsx"
    
    if not os.path.exists(archivo_excel):
        print(f"Error: No se encontró el archivo '{archivo_excel}' en esta carpeta.")
        print("Por favor, guarda tu archivo de Excel de atenciones con el nombre 'CLIENTES ATENDIDOS DIARIAMENTE.xlsx' o 'atenciones_diarias.xlsx' en este mismo directorio.")
        return

    # 2. Configuración de credenciales de la BD
    config_db = {
        'host': 'localhost',
        'user': 'root',
        'password': 'Sama/2001',
        'database': 'optimizador_rutas'
    }

    print(f"Leyendo los datos de '{archivo_excel}'...")
    
    try:
        # Cargar Excel sin cabeceras
        df = pd.read_excel(archivo_excel, header=None)
        
        # Omitir fila de cabecera si detectamos palabras clave en la primera fila
        start_idx = 0
        first_row_vals = [str(v).lower() for v in df.iloc[0].values]
        if any(h in first_row_vals for h in ["fecha", "hora", "cont", "nombre", "agente"]):
            start_idx = 1
            print("Cabecera detectada y omitida de la importación.")

        print(f"Archivo leído con éxito. Se encontraron {len(df) - start_idx} registros listos para procesar.")
        
        # --- PREPROCESAMIENTO DE DATOS ---
        print("Preprocesando datos (resolviendo celdas de agentes agrupadas e interpolando fechas inválidas)...")
        
        # 1. Rellenar hacia adelante el Agente (Col 13)
        df[13] = df[13].ffill()
        
        # 2. Rellenar hacia adelante la columna de Fecha (Col 0)
        df[0] = df[0].ffill()
        
        # 3. Limpiar columna de fechas (Col 0) convirtiendo nulos, inválidos y fechas con año < 2000 (1890/1899)
        # a NaT, para luego aplicar ffill() y bfill() y asociarlas con las fechas más cercanas de su puesto
        cleaned_dates = []
        for idx in range(len(df)):
            val = df.iloc[idx][0]
            cleaned_dt = None
            if pd.notna(val):
                try:
                    if isinstance(val, (datetime, date)):
                        cleaned_dt = val
                    else:
                        cleaned_dt = pd.to_datetime(val)
                    
                    if cleaned_dt.year < 2000:
                        cleaned_dt = None
                except:
                    cleaned_dt = None
            cleaned_dates.append(cleaned_dt)
            
        df[0] = pd.to_datetime(cleaned_dates)
        df[0] = df[0].ffill().bfill()
        
        print("Conectando a MySQL...")
        conexion = mysql.connector.connect(**config_db)
        cursor = conexion.cursor()

        # Limpiar registros previamente importados el día de hoy para evitar duplicados
        print("Limpiando importación previa de atenciones realizada el día de hoy para evitar duplicidad...")
        cursor.execute("DELETE FROM atenciones WHERE DATE(fecha_registro) = CURDATE()")
        print(f"Limpieza completada. Se eliminaron {cursor.rowcount} registros anteriores.")

        # Cargar registros existentes en memoria para evitar duplicados de otros días
        print("Cargando registros existentes en memoria para evitar duplicados...")
        existing_records = set()
        cursor.execute("SELECT fecha, hora, contrato, cliente, agente, accion FROM atenciones")
        from datetime import timedelta
        for row in cursor.fetchall():
            f_db = row[0].isoformat() if row[0] else None
            h_db = row[1]
            h_str = None
            if h_db is not None:
                if isinstance(h_db, timedelta):
                    total_seconds = int(h_db.total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    seconds = total_seconds % 60
                    h_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                elif hasattr(h_db, 'strftime'):
                    h_str = h_db.strftime('%H:%M:%S')
                else:
                    h_str = str(h_db)
            
            c_db = row[2]
            cl_db = row[3]
            ag_db = row[4]
            ac_db = row[5]
            
            existing_records.add((
                f_db,
                h_str,
                c_db.strip() if c_db else None,
                cl_db.strip().upper() if cl_db else None,
                ag_db.strip() if ag_db else None,
                ac_db.strip().upper() if ac_db else None
            ))
        print(f"Se cargaron {len(existing_records)} registros únicos existentes.")

        query_insert = """
            INSERT INTO atenciones (
                fecha, hora, fecha_hora, contrato, cliente, fecha_instalacion, 
                sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2, 
                accion, motivo, agente, observacion, olt, ont, router, timer_minutos
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        print("Iniciando la inyección masiva en la tabla 'atenciones'...")
        
        contador_insertados = 0
        contador_duplicados = 0
        
        for index in range(start_idx, len(df)):
            row = df.iloc[index]
            
            # --- MAPEO Y TRUNCAMIENTO DE VARIABLES ---
            
            # 1. Fecha (Col 0)
            fecha_val = row[0]
            fecha_prog = None
            if pd.notna(fecha_val):
                try:
                    fecha_prog = pd.to_datetime(fecha_val).date().isoformat()
                except:
                    fecha_prog = date.today().isoformat()
            else:
                fecha_prog = date.today().isoformat()

            # 2. Hora (Col 1)
            hora_val = row[1]
            hora_prog = None
            parsed_time = None
            if pd.notna(hora_val):
                try:
                    if isinstance(hora_val, time):
                        parsed_time = hora_val
                    elif isinstance(hora_val, datetime):
                        parsed_time = hora_val.time()
                    else:
                        parsed_time = pd.to_datetime(str(hora_val)).time()
                    
                    # Redondear al segundo más cercano para evitar discrepancias con MySQL (que almacena TIME sin milisegundos)
                    total_seconds = parsed_time.hour * 3600 + parsed_time.minute * 60 + parsed_time.second
                    if parsed_time.microsecond >= 500000:
                        total_seconds += 1
                    
                    new_hour = (total_seconds // 3600) % 24
                    new_minute = (total_seconds % 3600) // 60
                    new_second = total_seconds % 60
                    parsed_time = time(new_hour, new_minute, new_second)
                    hora_prog = parsed_time.isoformat()
                except:
                    pass

            # 3. Combinar Fecha y Hora
            fecha_hora = None
            if fecha_prog:
                try:
                    f_dt = date.fromisoformat(fecha_prog)
                    t_tm = parsed_time if parsed_time else time.min
                    fecha_hora = datetime.combine(f_dt, t_tm)
                except:
                    pass
            
            # 4. Contrato (Col 2)
            contrato = str(row[2]).strip() if pd.notna(row[2]) else None
            if contrato in [None, '', 'NAN', 'NONE']:
                contrato = None
            else:
                if contrato.endswith('.0') or contrato.endswith(',0'):
                    contrato = contrato[:-2]
                contrato = contrato[:20]
                
            # Omitir si es una fila vacía o incompleta (sin acción ni medio de contacto)
            accion_raw = str(row[11]).strip().upper() if pd.notna(row[11]) else ''
            medio_raw = str(row[8]).strip().upper() if pd.notna(row[8]) else ''
            if (not accion_raw or accion_raw in ['NAN', 'NONE']) and (not medio_raw or medio_raw in ['NAN', 'NONE']):
                continue
                
            # 5. Cliente (Col 3) - NOT NULL
            cliente = str(row[3]).strip().upper() if pd.notna(row[3]) else None
            if not cliente or cliente in ['', 'NAN', 'NONE']:
                cliente = "SIN NOMBRE"
            cliente = cliente[:150]

            # 6. Fecha Instalación (Col 4)
            fecha_inst_val = row[4]
            fecha_instalacion = None
            if pd.notna(fecha_inst_val):
                try:
                    fecha_instalacion = pd.to_datetime(fecha_inst_val).date().isoformat()
                except:
                    pass

            # 7. Sector (Col 5)
            sector = str(row[5]).strip().upper() if pd.notna(row[5]) else None
            if sector in [None, '', 'NAN', 'NONE']:
                sector = None
            else:
                sector = sector[:100]

            # Intentar rescatar nombre y sector desde directorio_clientes si vienen vacíos en el Excel
            if contrato and (not cliente or cliente == 'SIN NOMBRE' or not sector):
                cursor.execute("SELECT nombre_cliente, zona FROM directorio_clientes WHERE contrato = %s", (contrato,))
                dir_row = cursor.fetchone()
                if dir_row:
                    dir_name = dir_row[0]
                    dir_zone = dir_row[1]
                    if not cliente or cliente == 'SIN NOMBRE':
                        if dir_name:
                            cliente = dir_name.strip().upper()[:150]
                    if not sector:
                        if dir_zone:
                            sector = dir_zone.strip().upper()[:100]

            # 8. Tipo Atención (Col 6)
            tipo_atencion = str(row[6]).strip().upper() if pd.notna(row[6]) else None
            if tipo_atencion in [None, '', 'NAN', 'NONE']:
                tipo_atencion = None
            else:
                tipo_atencion = tipo_atencion[:100]

            # 9. Tipo Solicitud (Col 7)
            tipo_solicitud = str(row[7]).strip().upper() if pd.notna(row[7]) else None
            if tipo_solicitud in [None, '', 'NAN', 'NONE']:
                tipo_solicitud = None
            else:
                tipo_solicitud = tipo_solicitud[:100]

            # 10. Medio Contacto (Col 8)
            medio_contacto = str(row[8]).strip().upper() if pd.notna(row[8]) else None
            if medio_contacto in [None, '', 'NAN', 'NONE']:
                medio_contacto = None
            else:
                medio_contacto = medio_contacto[:50]

            # 11. Teléfono 1 (Col 9)
            telefono1 = str(row[9]).strip() if pd.notna(row[9]) else None
            if telefono1 in [None, '', 'NAN', 'NONE']:
                telefono1 = None
            else:
                if telefono1.endswith('.0') or telefono1.endswith(',0'):
                    telefono1 = telefono1[:-2]
                telefono1 = telefono1[:100]

            # 12. Teléfono 2 (Col 10)
            telefono2 = str(row[10]).strip() if pd.notna(row[10]) else None
            if telefono2 in [None, '', 'NAN', 'NONE']:
                telefono2 = None
            else:
                if telefono2.endswith('.0') or telefono2.endswith(',0'):
                    telefono2 = telefono2[:-2]
                telefono2 = telefono2[:100]

            # 13. Acción (Col 11)
            accion = str(row[11]).strip().upper() if pd.notna(row[11]) else None
            if accion in [None, '', 'NAN', 'NONE']:
                accion = None
            else:
                accion = accion[:150]

            # 14. Motivo (Col 12)
            motivo = str(row[12]).strip().upper() if pd.notna(row[12]) else None
            if motivo in [None, '', 'NAN', 'NONE']:
                motivo = None
            else:
                motivo = motivo[:150]

            # 15. Agente (Col 13)
            agente = str(row[13]).strip() if pd.notna(row[13]) else "Importado"
            agente = agente[:100]

            # 16. Observación (Col 14)
            observacion = str(row[14]).strip() if pd.notna(row[14]) else None
            if observacion in [None, '', 'NAN', 'NONE']:
                observacion = None

            # 17. OLT (Col 15)
            olt = str(row[15]).strip() if pd.notna(row[15]) else None
            if olt in [None, '', 'NAN', 'NONE']:
                olt = None
            else:
                if olt.endswith('.0') or olt.endswith(',0'):
                    olt = olt[:-2]
                olt = olt[:50]

            # Las columnas ont, router y timer_minutos no existen en el nuevo excel
            ont = None
            router = None
            timer_minutos = None
            
            # --- VERIFICACIÓN DE DUPLICADOS ---
            key = (
                fecha_prog,
                hora_prog,
                contrato.strip() if contrato else None,
                cliente.strip().upper() if cliente else None,
                agente.strip() if agente else None,
                accion.strip().upper() if accion else None
            )
            if key in existing_records:
                contador_duplicados += 1
                continue

            # Ejecutar inserción
            datos_atencion = (
                fecha_prog, hora_prog, fecha_hora, contrato, cliente, fecha_instalacion,
                sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2,
                accion, motivo, agente, observacion, olt, ont, router, timer_minutos
            )
            
            try:
                cursor.execute(query_insert, datos_atencion)
                existing_records.add(key)
                contador_insertados += 1
            except mysql.connector.Error as err:
                print(f"\n[ERROR] Falla al insertar fila index {index} en Excel.")
                print(f"Error de base de datos: {err}")
                raise err

        conexion.commit()
        print(f"Exito absoluto! Se importaron {contador_insertados} atenciones a la tabla 'atenciones'.")
        print(f"Se omitieron {contador_duplicados} registros duplicados por ya existir en la base de datos.")

    except mysql.connector.Error as err:
        print(f"Error crítico de MySQL: {err}")
    except Exception as e:
        print(f"Error inesperado: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            print("Conexión a la base de datos cerrada de forma segura.")

if __name__ == "__main__":
    importar_atenciones()
