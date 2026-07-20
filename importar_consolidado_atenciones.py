import os
import mysql.connector
import pandas as pd
from datetime import datetime, date, time, timedelta
from db_config import get_db_connection

def format_db_datetime(val):
    """Parsea y formatea un valor a formato datetime para MySQL, o retorna None."""
    if pd.isna(val) or str(val).strip().lower() in ['nan', 'none', '']:
        return None
    try:
        dt = pd.to_datetime(val)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None

def importar_consolidado_atenciones():
    file_path = "consolidado_atenciones.xlsx"
    if not os.path.exists(file_path):
        print(f"Error: No se encontró el archivo '{file_path}' en este directorio.")
        return

    print(f"Leyendo los datos de la hoja 'ACTUAL' en '{file_path}'...")
    try:
        df = pd.read_excel(file_path, sheet_name='ACTUAL')
        print(f"Lectura exitosa. Se encontraron {len(df)} registros para procesar.")
        
        # --- PREPROCESAMIENTO DE DATOS ---
        print("Preprocesando datos (rellenando celdas vacías de agente y fecha)...")
        # Rellenar hacia adelante agente (Col 13) y fecha (Col 0)
        df.iloc[:, 13] = df.iloc[:, 13].ffill()
        df.iloc[:, 0] = df.iloc[:, 0].ffill()
        
        # Limpiar y resolver fechas inválidas en Col 0
        cleaned_dates = []
        for idx in range(len(df)):
            val = df.iloc[idx, 0]
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
            
        df.iloc[:, 0] = pd.to_datetime(cleaned_dates)
        df.iloc[:, 0] = df.iloc[:, 0].ffill().bfill()
        
        print("Conectando a MySQL...")
        conexion = get_db_connection()
        if not conexion:
            print("Error: No se pudo conectar a la base de datos.")
            return
            
        cursor = conexion.cursor(dictionary=True)
        
        # Limpiar registros previamente importados el día de hoy para evitar duplicidad
        print("Limpiando importación de atenciones realizada el día de hoy...")
        cursor.execute("DELETE FROM atenciones WHERE DATE(fecha_registro) = CURDATE()")
        conexion.commit()
        print(f"Limpieza completada. Se eliminaron {cursor.rowcount} registros anteriores.")
        
        # Cargar registros existentes en memoria para evitar duplicidad de otros días
        print("Cargando registros existentes en memoria para evitar duplicados...")
        existing_records = set()
        cursor.execute("SELECT fecha, hora, contrato, cliente, agente, accion FROM atenciones")
        
        for row in cursor.fetchall():
            f_db = row['fecha'].isoformat() if row['fecha'] else None
            h_db = row['hora']
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
            
            c_db = row['contrato']
            cl_db = row['cliente']
            ag_db = row['agente']
            ac_db = row['accion']
            
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
                accion, motivo, agente, observacion, olt, ont, router, timer_minutos,
                fecha_registro
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """
        
        print("Iniciando inserción masiva en la tabla 'atenciones'...")
        
        total_insertados = 0
        total_duplicados = 0
        total_completados = 0
        
        batch_size = 1000
        batch_values = []
        
        for index, row in df.iterrows():
            row_vals = list(row.values)
            if len(row_vals) < 19:
                continue
                
            # --- PARSEAR CAMPOS POR ÍNDICE ---
            fecha_val = row_vals[0]
            hora_val = row_vals[1]
            contrato_val = row_vals[2]
            nombre_val = row_vals[3]
            fecha_inst_val = row_vals[4]
            sector_val = row_vals[5]
            tipo_atencion_val = row_vals[6]
            tipo_solicitud_val = row_vals[7]
            contacto_val = row_vals[8]
            telefono1_val = row_vals[9]
            telefono2_val = row_vals[10]
            accion_val = row_vals[11]
            motivo_val = row_vals[12]
            agente_val = row_vals[13]
            obs_val = row_vals[14]
            olt_val = row_vals[15]
            ont_val = row_vals[16]
            router_val = row_vals[17]
            timer_val = row_vals[18]
            
            # --- CONTRATO ---
            contrato = str(contrato_val).strip() if pd.notna(contrato_val) else None
            if contrato in [None, '', 'NAN', 'NONE']:
                contrato = None
            else:
                if contrato.endswith('.0') or contrato.endswith(',0'):
                    contrato = contrato[:-2]
                contrato = contrato[:20]
                
            # Omitir si es fila vacía (sin acción ni contacto)
            accion_raw = str(accion_val).strip().upper() if pd.notna(accion_val) else ''
            contacto_raw = str(contacto_val).strip().upper() if pd.notna(contacto_val) else ''
            if not accion_raw and not contacto_raw:
                continue
                
            # --- CLIENTE ---
            cliente = str(nombre_val).strip().upper() if pd.notna(nombre_val) else None
            if not cliente or cliente in ['', 'NAN', 'NONE']:
                cliente = "SIN NOMBRE"
            cliente = cliente[:150]
            
            # --- FECHA INSTALACION ---
            fecha_instalacion = None
            if pd.notna(fecha_inst_val):
                try:
                    fecha_instalacion = pd.to_datetime(fecha_inst_val).date().isoformat()
                except:
                    pass
                    
            # --- SECTOR ---
            sector = str(sector_val).strip().upper() if pd.notna(sector_val) else None
            if sector in [None, '', 'NAN', 'NONE']:
                sector = None
            else:
                sector = sector[:100]
                
            # --- TELÉFONOS ---
            telefono1 = str(telefono1_val).strip() if pd.notna(telefono1_val) else None
            if telefono1 in [None, '', 'NAN', 'NONE', '0']:
                telefono1 = None
            else:
                if telefono1.endswith('.0') or telefono1.endswith(',0'):
                    telefono1 = telefono1[:-2]
                telefono1 = telefono1[:100]
                
            telefono2 = str(telefono2_val).strip() if pd.notna(telefono2_val) else None
            if telefono2 in [None, '', 'NAN', 'NONE', '0']:
                telefono2 = None
            else:
                if telefono2.endswith('.0') or telefono2.endswith(',0'):
                    telefono2 = telefono2[:-2]
                telefono2 = telefono2[:100]
                
            # --- BÚSQUEDA DE DATOS FALTANTES EN DIRECTORIO CLIENTES ---
            # Si el contrato es válido y no es "0", podemos rellenar datos vacíos
            if contrato and contrato != "0" and (not cliente or cliente == 'SIN NOMBRE' or not sector or not fecha_instalacion or not telefono1 or not telefono2):
                cursor.execute("""
                    SELECT nombre_cliente, zona, fecha_instalacion, telefono1, telefono2, telefono3 
                    FROM directorio_clientes WHERE contrato = %s
                """, (contrato,))
                dir_row = cursor.fetchone()
                if dir_row:
                    total_completados += 1
                    if not cliente or cliente == 'SIN NOMBRE':
                        if dir_row['nombre_cliente']:
                            cliente = dir_row['nombre_cliente'].strip().upper()[:150]
                    if not sector:
                        if dir_row['zona']:
                            sector = dir_row['zona'].strip().upper()[:100]
                    if not fecha_instalacion:
                        if dir_row['fecha_instalacion']:
                            try:
                                fecha_instalacion = pd.to_datetime(dir_row['fecha_instalacion']).date().isoformat()
                            except:
                                pass
                    if not telefono1:
                        if dir_row['telefono1']:
                            telefono1 = dir_row['telefono1'].strip()[:100]
                    if not telefono2:
                        if dir_row['telefono2']:
                            telefono2 = dir_row['telefono2'].strip()[:100]
                        elif dir_row['telefono3']:
                            telefono2 = dir_row['telefono3'].strip()[:100]
            
            # --- DEMÁS CAMPOS ---
            tipo_atencion = str(tipo_atencion_val).strip().upper() if pd.notna(tipo_atencion_val) else None
            if not tipo_atencion or tipo_atencion in ['', 'NAN', 'NONE']: tipo_atencion = None
            else: tipo_atencion = tipo_atencion[:100]
            
            tipo_solicitud = str(tipo_solicitud_val).strip().upper() if pd.notna(tipo_solicitud_val) else None
            if not tipo_solicitud or tipo_solicitud in ['', 'NAN', 'NONE']: tipo_solicitud = None
            else: tipo_solicitud = tipo_solicitud[:100]
            
            medio_contacto = str(contacto_val).strip().upper() if pd.notna(contacto_val) else None
            if not medio_contacto or medio_contacto in ['', 'NAN', 'NONE']: medio_contacto = None
            else: medio_contacto = medio_contacto[:50]
            
            accion = str(accion_val).strip().upper() if pd.notna(accion_val) else None
            if not accion or accion in ['', 'NAN', 'NONE']: accion = None
            else: accion = accion[:150]
            
            motivo = str(motivo_val).strip().upper() if pd.notna(motivo_val) else None
            if not motivo or motivo in ['', 'NAN', 'NONE']: motivo = None
            else: motivo = motivo[:150]
            
            agente = str(agente_val).strip() if pd.notna(agente_val) else "Importado"
            agente = agente[:100]
            
            observacion = str(obs_val).strip() if pd.notna(obs_val) else None
            if observacion in ['', 'NAN', 'NONE']: observacion = None
            
            olt = str(olt_val).strip() if pd.notna(olt_val) else None
            if not olt or olt in ['', 'NAN', 'NONE']: olt = None
            else:
                if olt.endswith('.0') or olt.endswith(',0'): olt = olt[:-2]
                olt = olt[:50]
                
            ont = str(ont_val).strip() if pd.notna(ont_val) else None
            if not ont or ont in ['', 'NAN', 'NONE']: ont = None
            else: ont = ont[:50]
            
            router = str(router_val).strip() if pd.notna(router_val) else None
            if not router or router in ['', 'NAN', 'NONE']: router = None
            else: router = router[:50]
            
            timer = None
            if pd.notna(timer_val):
                try:
                    timer = int(float(timer_val))
                except:
                    pass
                    
            # --- CONFIGURAR FECHAS ---
            fecha_prog = None
            if pd.notna(fecha_val):
                try:
                    fecha_prog = pd.to_datetime(fecha_val).date().isoformat()
                except:
                    fecha_prog = date.today().isoformat()
            else:
                fecha_prog = date.today().isoformat()
                
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
                        
                    total_seconds = parsed_time.hour * 3600 + parsed_time.minute * 60 + parsed_time.second
                    if parsed_time.microsecond >= 500000:
                        total_seconds += 1
                    parsed_time = time((total_seconds // 3600) % 24, (total_seconds % 3600) // 60, total_seconds % 60)
                    hora_prog = parsed_time.isoformat()
                except:
                    pass
                    
            fecha_hora = None
            if fecha_prog:
                try:
                    f_dt = date.fromisoformat(fecha_prog)
                    t_tm = parsed_time if parsed_time else time.min
                    fecha_hora = datetime.combine(f_dt, t_tm).strftime('%Y-%m-%d %H:%M:%S')
                except:
                    pass
            
            # --- VERIFICAR DUPLICADOS ---
            key = (
                fecha_prog,
                hora_prog,
                contrato.strip() if contrato else None,
                cliente.strip().upper() if cliente else None,
                agente.strip() if agente else None,
                accion.strip().upper() if accion else None
            )
            
            if key in existing_records:
                total_duplicados += 1
                continue
                
            # Agregar al set local para no duplicar en la misma corrida
            existing_records.add(key)
            
            # Agregar a lote de inserción
            batch_values.append((
                fecha_prog, hora_prog, fecha_hora, contrato, cliente, fecha_instalacion,
                sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2,
                accion, motivo, agente, observacion, olt, ont, router, timer
            ))
            
            if len(batch_values) >= batch_size:
                cursor.executemany(query_insert, batch_values)
                conexion.commit()
                total_insertados += len(batch_values)
                batch_values = []
                print(f"  Insertados {total_insertados} registros...")
                
        # Insertar lote final
        if batch_values:
            cursor.executemany(query_insert, batch_values)
            conexion.commit()
            total_insertados += len(batch_values)
            
        print(f"\nImportación de atenciones consolidada finalizada exitosamente.")
        
    except Exception as e:
        conexion.rollback()
        print(f"Error grave durante la importación: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conexion' in locals() and conexion.is_connected():
            conexion.close()
        print("\nConexión a la base de datos cerrada de forma segura.")
        print(f"=== INFORME GENERAL DE IMPORTACIÓN ===")
        print(f"Registros insertados: {total_insertados}")
        print(f"Registros duplicados omitidos: {total_duplicados}")
        print(f"Campos completados desde el Directorio de Clientes: {total_completados}")

if __name__ == '__main__':
    importar_consolidado_atenciones()
