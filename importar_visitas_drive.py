import os
import glob
import mysql.connector
import pandas as pd
from datetime import datetime, date, time
import re

# Importamos la función de normalización del proyecto
from utils import normalizar_horario_texto

def parse_sheet_name_to_date(sheet_name, default_year=2026):
    sheet_name = sheet_name.upper().strip()
    
    meses = {
        'ENERO': 1, 'ENE': 1,
        'FEBRERO': 2, 'FEB': 2,
        'MARZO': 3, 'MAR': 3,
        'ABRIL': 4, 'ABR': 4,
        'MAYO': 5, 'MAY': 5,
        'JUNIO': 6, 'JUN': 6,
        'JULIO': 7, 'JUL': 7,
        'AGOSTO': 8, 'AGO': 8,
        'SEPTIEMBRE': 9, 'SEP': 9,
        'OCTUBRE': 10, 'OCT': 10,
        'NOVIEMBRE': 11, 'NOV': 11,
        'DICIEMBRE': 12, 'DIC': 12
    }
    
    match_dia = re.search(r'\d+', sheet_name)
    if not match_dia:
        return None
    
    dia = int(match_dia.group())
    
    mes = None
    for k, v in meses.items():
        if k in sheet_name:
            mes = v
            break
            
    if not mes:
        match_fecha = re.search(r'(\d+)[\-/](\d+)', sheet_name)
        if match_fecha:
            dia = int(match_fecha.group(1))
            mes = int(match_fecha.group(2))
            
    if not mes:
        return None
        
    try:
        return date(default_year, mes, dia).isoformat()
    except Exception as e:
        print(f"Error parseando fecha de hoja '{sheet_name}': {e}")
        return None

def importar_visitas_drive(archivo_excel=None):
    # 1. Configuración de credenciales de la BD
    config_db = {
        'host': 'localhost',
        'user': 'root',
        'password': 'Sama/2001',
        'database': 'optimizador_rutas'
    }

    # Si no se provee el archivo, buscamos por defecto ASIGNACIONES PRINCIPAL (1).xlsx en la carpeta actual
    if not archivo_excel:
        archivo_excel = "ASIGNACIONES PRINCIPAL (1).xlsx"
        
    if not os.path.exists(archivo_excel):
        print(f"Error: No se encontró el archivo '{archivo_excel}' en esta carpeta.")
        print("Por favor, asegúrate de colocar el archivo 'ASIGNACIONES PRINCIPAL (1).xlsx' en esta misma carpeta antes de ejecutar.")
        return

    if not os.path.exists(archivo_excel):
        print(f"Error: No se encontró el archivo '{archivo_excel}'.")
        return

    print(f"Leyendo el libro de Excel '{archivo_excel}'...")
    try:
        xl = pd.ExcelFile(archivo_excel)
        sheet_names = xl.sheet_names
        print(f"Hojas encontradas en el libro ({len(sheet_names)} hojas):")
        print(sheet_names)
    except Exception as e:
        print(f"Error al abrir el archivo de Excel: {e}")
        return

    print("\nConectando a MySQL...")
    try:
        conexion = mysql.connector.connect(**config_db)
        cursor = conexion.cursor(dictionary=True)
        
        # Limpiar registros históricos previos (rango 5844 a 9999 y mayores o iguales a 10505) para evitar duplicidad
        print("Eliminando visitas históricas anteriores (rango 5844-9999 y >= 10505)...")
        cursor.execute("DELETE FROM visitas_tecnicas WHERE id_visita BETWEEN 5844 AND 9999 OR id_visita >= 10505")
        deleted_count = cursor.rowcount
        print(f"Limpieza completada. Se eliminaron {deleted_count} visitas históricas.")
        
        # Restablecer el AUTO_INCREMENT para que la importación empiece limpia desde 10505
        cursor.execute("ALTER TABLE visitas_tecnicas AUTO_INCREMENT = 10505")
        print("Auto-increment restablecido a 10505.")
        conexion.commit()
    except Exception as e:
        print(f"Error al conectar con la base de datos o al limpiar la tabla: {e}")
        return

    total_insertados = 0
    total_duplicados = 0

    try:
        for sheet_name in sheet_names:
            if sheet_name.strip() != '2026':
                print(f"Omitiendo hoja (solo se procesa la de 2026): {sheet_name}")
                continue

            print(f"\n--- Importando hoja: {sheet_name} ---")
            
            # Cargar hoja sin cabeceras
            df = pd.read_excel(archivo_excel, sheet_name=sheet_name, header=None)
            
            if df.empty or len(df) < 2:
                print(f"Hoja vacía o con datos insuficientes.")
                continue

            # Omitir fila de cabecera si detectamos palabras clave en la primera fila
            start_idx = 0
            first_row_vals = [str(v).lower() for v in df.iloc[0].values]
            if any(h in first_row_vals for h in ["contrato", "cliente", "asesor", "call", "center", "tecnico"]):
                start_idx = 1
                
            # Rellenar hacia adelante el asesor/creador (Col 0)
            df[0] = df[0].ffill()
            
            # Limpiar columna de fechas (Col 4)
            cleaned_dates = []
            for idx in range(len(df)):
                val = df.iloc[idx][4]
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
                
            df[4] = pd.to_datetime(cleaned_dates)
            df[4] = df[4].ffill().bfill()

            indices_a_omitir = set()
            sheet_inserted = 0

            for index in range(start_idx, len(df)):
                if index in indices_a_omitir:
                    continue
                    
                row = df.iloc[index]
                
                # Omitir filas vacías
                if pd.isna(row[8]) and pd.isna(row[7]):
                    continue

                # Omitir si es la fila de cabecera
                cliente_val = str(row[8]).strip().upper() if pd.notna(row[8]) else ""
                contrato_val = str(row[7]).strip().upper() if pd.notna(row[7]) else ""
                if cliente_val == "CLIENTE" or contrato_val == "CONTRATO" or "TECNICO" in cliente_val or "TÉCNICO" in cliente_val:
                    continue

                # Detectar si la fila siguiente es continuación (registro dividido)
                siguiente_idx = index + 1
                es_continuacion = False
                if siguiente_idx < len(df):
                    sig_row = df.iloc[siguiente_idx]
                    sig_cliente_val = str(sig_row[8]) if pd.notna(sig_row[8]) else ""
                    if 'caja:' in sig_cliente_val.lower() or 'hilo:' in sig_cliente_val.lower():
                        es_continuacion = True
                        indices_a_omitir.add(siguiente_idx)

                # --- MAPEO Y PARSEO DE COLUMNAS ---
                
                # Creado por (Col 0)
                creado_por = str(row[0]).strip() if pd.notna(row[0]) else "Importado"
                creado_por = creado_por[:100]

                # Técnico principal (Col 1)
                tecnico_principal = str(row[1]).strip().upper() if pd.notna(row[1]) else None
                if tecnico_principal in [None, '', 'NAN', 'NONE']:
                    tecnico_principal = None
                else:
                    tecnico_principal = tecnico_principal[:100]

                # Técnico apoyo (Col 2)
                tecnico_apoyo = str(row[2]).strip().upper() if pd.notna(row[2]) else None
                if tecnico_apoyo in [None, '', 'NAN', 'NONE']:
                    tecnico_apoyo = None
                else:
                    tecnico_apoyo = tecnico_apoyo[:100]

                # Fecha de registro (Col 4)
                fecha_val = row[4]
                fecha_registro = None
                if pd.notna(fecha_val):
                    try:
                        if hasattr(fecha_val, 'to_pydatetime'):
                            fecha_registro = fecha_val.to_pydatetime()
                        elif isinstance(fecha_val, datetime):
                            fecha_registro = fecha_val
                        elif isinstance(fecha_val, date):
                            fecha_registro = datetime.combine(fecha_val, time.min)
                        else:
                            parsed_dt = pd.to_datetime(fecha_val)
                            fecha_registro = parsed_dt.to_pydatetime() if hasattr(parsed_dt, 'to_pydatetime') else parsed_dt
                    except Exception as e:
                        print(f"Error parseando fecha_registro en fila {index}: {e}")
                        continue
                else:
                    print(f"Omitiendo fila {index} por falta de fecha_registro (Columna 4)")
                    continue

                # Fecha de realización / Hora Fin (Col 23)
                fecha_realizada_val = row[23]
                fecha_realizada = None
                if pd.notna(fecha_realizada_val):
                    try:
                        if hasattr(fecha_realizada_val, 'to_pydatetime'):
                            fecha_realizada = fecha_realizada_val.to_pydatetime()
                        elif isinstance(fecha_realizada_val, datetime):
                            fecha_realizada = fecha_realizada_val
                        elif isinstance(fecha_realizada_val, date):
                            fecha_realizada = datetime.combine(fecha_realizada_val, time.min)
                        else:
                            parsed_dt = pd.to_datetime(fecha_realizada_val)
                            fecha_realizada = parsed_dt.to_pydatetime() if hasattr(parsed_dt, 'to_pydatetime') else parsed_dt
                    except Exception as e:
                        # Si hay un error parsing, no pasa nada, se queda en None
                        pass

                # Determinar fecha programada
                if fecha_realizada:
                    fecha_programada = fecha_realizada.date().isoformat()
                else:
                    fecha_programada = fecha_registro.date().isoformat()


                # Preferencia horaria (Col 5)
                preferencia = str(row[5]).strip() if pd.notna(row[5]) else None
                if preferencia in [None, '', 'NAN', 'NONE']:
                    preferencia = None
                else:
                    preferencia = preferencia[:150]

                prioridad = "MEDIA"
                if preferencia:
                    pref_lower = preferencia.lower()
                    if "no es urgente" in pref_lower or "baja" in pref_lower or "flexible" in pref_lower:
                        prioridad = "BAJA"
                    elif "urgente" in pref_lower or "alta" in pref_lower:
                        prioridad = "ALTA"

                # Empresa (Col 6)
                empresa = str(row[6]).strip().upper() if pd.notna(row[6]) else None
                if empresa in [None, '', 'NAN', 'NONE']:
                    empresa = None
                else:
                    empresa = empresa[:50]

                # Contrato (Col 7)
                contrato = str(row[7]).strip() if pd.notna(row[7]) else None
                if contrato in [None, '', 'NAN', 'NONE']:
                    contrato = None
                else:
                    if contrato.endswith('.0') or contrato.endswith(',0'):
                        contrato = contrato[:-2]
                    contrato = contrato[:20]

                # Cliente (Col 8)
                cliente = str(row[8]).strip().upper() if pd.notna(row[8]) else None
                if not cliente or cliente in ['', 'NAN', 'NONE']:
                    continue
                cliente = cliente[:150]

                # Mapear columnas según si es continuación o fila normal
                if es_continuacion:
                    sig_row = df.iloc[siguiente_idx]
                    telefonos = str(sig_row[1]).strip() if pd.notna(sig_row[1]) else None
                    sector = str(sig_row[2]).strip().upper() if pd.notna(sig_row[2]) else None
                    direccion = str(sig_row[3]).strip() if pd.notna(sig_row[3]) else None
                    servicio = str(sig_row[4]).strip().upper() if pd.notna(sig_row[4]) else None
                    velocidad_raw = sig_row[5]
                    problema = str(sig_row[6]).strip().upper() if pd.notna(sig_row[6]) else None
                    observacion_callcenter = str(sig_row[7]).strip() if pd.notna(sig_row[7]) else None
                    informacion_tecnico = str(sig_row[8]).strip() if pd.notna(sig_row[8]) else None
                    solucion_tecnico = str(sig_row[10]).strip().upper() if pd.notna(sig_row[10]) else None
                    observacion_tecnico = str(sig_row[11]).strip() if pd.notna(sig_row[11]) else None
                    modelo_onu = str(sig_row[12]).strip().upper() if pd.notna(sig_row[12]) else None
                    modelo_router = str(sig_row[13]).strip().upper() if pd.notna(sig_row[13]) else None
                    coordenadas_tecnico = str(sig_row[14]).strip() if pd.notna(sig_row[14]) else None
                    hora_fin_val = sig_row[15]
                else:
                    telefonos = str(row[9]).strip() if pd.notna(row[9]) else None
                    sector = str(row[10]).strip().upper() if pd.notna(row[10]) else None
                    direccion = str(row[11]).strip() if pd.notna(row[11]) else None
                    servicio = str(row[12]).strip().upper() if pd.notna(row[12]) else None
                    velocidad_raw = row[13]
                    problema = str(row[14]).strip().upper() if pd.notna(row[14]) else None
                    observacion_callcenter = str(row[15]).strip() if pd.notna(row[15]) else None
                    informacion_tecnico = str(row[16]).strip() if pd.notna(row[16]) else None
                    solucion_tecnico = str(row[18]).strip().upper() if pd.notna(row[18]) else None
                    observacion_tecnico = str(row[19]).strip() if pd.notna(row[19]) else None
                    modelo_onu = str(row[20]).strip().upper() if pd.notna(row[20]) else None
                    modelo_router = str(row[21]).strip().upper() if pd.notna(row[21]) else None
                    coordenadas_tecnico = str(row[22]).strip() if pd.notna(row[22]) else None
                    hora_fin_val = row[23]

                # Sanitizar telefonos
                if telefonos in [None, '', 'NAN', 'NONE']:
                    telefonos = None
                else:
                    if telefonos.endswith('.0') or telefonos.endswith(',0'):
                        telefonos = telefonos[:-2]
                    telefonos = telefonos[:100]

                # Sanitizar sector / direccion
                sector = sector[:100] if sector else None
                if direccion in [None, '', 'NAN', 'NONE']:
                    direccion = None
                if not direccion and sector:
                    direccion = sector
                elif direccion and sector and sector not in direccion:
                    direccion = f"{direccion} ({sector})"
                direccion = direccion[:255] if direccion else None

                # Sanitizar servicio
                servicio = servicio[:50] if servicio else None

                # Parsear velocidad
                velocidad_mbps = None
                if pd.notna(velocidad_raw):
                    try:
                        clean_vel = str(velocidad_raw).upper().replace('MBPS', '').strip()
                        velocidad_mbps = int(float(clean_vel))
                    except:
                        pass

                # Sanitizar problema
                problema = problema[:150] if problema else None
                solucion_tecnico = solucion_tecnico[:150] if solucion_tecnico else None
                modelo_onu = modelo_onu[:50] if modelo_onu else None
                modelo_router = modelo_router[:50] if modelo_router else None
                coordenadas_tecnico = coordenadas_tecnico[:100] if coordenadas_tecnico else None

                # Parsear hora fin
                hora_fin_visita = None
                if pd.notna(hora_fin_val):
                    try:
                        dt_val = pd.to_datetime(hora_fin_val)
                        if dt_val.year < 2000:
                            prog_dt = pd.to_datetime(fecha_programada)
                            dt_val = datetime.combine(prog_dt.date(), dt_val.time())
                        hora_fin_visita = dt_val.isoformat()
                    except:
                        pass

                # Determinar estado
                if fecha_realizada:
                    estado = "FINALIZADA"
                    if solucion_tecnico:
                        sol_upper = solucion_tecnico.upper()
                        if ("CANCELADA" in sol_upper or "RECHAZA" in sol_upper or 
                            "NO DESEA" in sol_upper or "NO SE PUEDE" in sol_upper or 
                            "SIN RESPUESTA" in sol_upper or "GENERAR CAMBIO" in sol_upper or
                            "GENERAR ARREGLO" in sol_upper or "GESTIONAR ARREGLO" in sol_upper):
                            estado = "CANCELADA"
                        elif "REAGENDADA" in sol_upper or "REPROGRAMADA" in sol_upper:
                            estado = "REAGENDADA"
                else:
                    # Si no tiene fecha de realización, no se cerró.
                    # Si es futura/hoy, es PENDIENTE
                    fecha_prog_dt = date.fromisoformat(fecha_programada)
                    if fecha_prog_dt >= date.today():
                        estado = "PENDIENTE"
                    else:
                        # Si es pasada y no tiene fecha de realización, es CANCELADA o REAGENDADA
                        estado = "CANCELADA"
                        if solucion_tecnico:
                            sol_upper = solucion_tecnico.upper()
                            if "REAGENDADA" in sol_upper or "REPROGRAMADA" in sol_upper:
                                estado = "REAGENDADA"

                # Calcular campos adicionales para el optimizador
                preferencia_horaria = preferencia if preferencia else "Todo el día"
                ventana_inicio, ventana_fin = normalizar_horario_texto(preferencia_horaria)
                
                es_instalacion = 0
                if servicio and ("INSTALACION" in servicio or "INSTALACIÓN" in servicio):
                    es_instalacion = 1

                # --- EVITAR DUPLICADOS CON RANGO LIVE (ID >= 10000) ---
                # Buscamos si existe ya en producción por contrato, cliente y fecha_registro exacta
                if contrato is None:
                    cursor.execute("""
                        SELECT COUNT(*) as c FROM visitas_tecnicas 
                        WHERE id_visita >= 10000 AND contrato IS NULL AND cliente = %s AND fecha_registro = %s
                          AND (tecnico_principal = %s OR (tecnico_principal IS NULL AND %s IS NULL))
                          AND (problema = %s OR (problema IS NULL AND %s IS NULL))
                    """, (cliente, fecha_registro, tecnico_principal, tecnico_principal, problema, problema))
                else:
                    cursor.execute("""
                        SELECT COUNT(*) as c FROM visitas_tecnicas 
                        WHERE id_visita >= 10000 AND contrato = %s AND cliente = %s AND fecha_registro = %s
                          AND (tecnico_principal = %s OR (tecnico_principal IS NULL AND %s IS NULL))
                          AND (problema = %s OR (problema IS NULL AND %s IS NULL))
                    """, (contrato, cliente, fecha_registro, tecnico_principal, tecnico_principal, problema, problema))
                if cursor.fetchone()['c'] > 0:
                    print(f"Fila {index}: Omitiendo porque ya existe como visita en vivo en producción (contrato={contrato}, cliente={cliente})")
                    total_duplicados += 1
                    continue

                # --- EVITAR DUPLICADOS DENTRO DE LA IMPORTACIÓN ACTUAL ---
                if contrato is None:
                    cursor.execute("""
                        SELECT COUNT(*) as c FROM visitas_tecnicas 
                        WHERE contrato IS NULL AND fecha_programada = %s AND es_instalacion = %s AND cliente = %s
                          AND (tecnico_principal = %s OR (tecnico_principal IS NULL AND %s IS NULL))
                          AND (problema = %s OR (problema IS NULL AND %s IS NULL))
                    """, (fecha_programada, es_instalacion, cliente, tecnico_principal, tecnico_principal, problema, problema))
                else:
                    cursor.execute("""
                        SELECT COUNT(*) as c FROM visitas_tecnicas 
                        WHERE contrato = %s AND fecha_programada = %s AND es_instalacion = %s AND cliente = %s
                          AND (tecnico_principal = %s OR (tecnico_principal IS NULL AND %s IS NULL))
                          AND (problema = %s OR (problema IS NULL AND %s IS NULL))
                    """, (contrato, fecha_programada, es_instalacion, cliente, tecnico_principal, tecnico_principal, problema, problema))
                if cursor.fetchone()['c'] > 0:
                    total_duplicados += 1
                    continue

                # --- INSERTAR EN BD ---
                query_insert = """
                    INSERT INTO visitas_tecnicas (
                        creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_programada, preferencia_horaria, 
                        prioridad, empresa, contrato, cliente, telefonos, sector, direccion, 
                        servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, 
                        estado, solucion_tecnico, observacion_tecnico, modelo_onu, modelo_router, 
                        coordenadas_tecnico, hora_fin_visita, ventana_inicio_min, ventana_fin_min, es_instalacion
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                valores = (
                    creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_programada, preferencia,
                    prioridad, empresa, contrato, cliente, telefonos, sector, direccion,
                    servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico,
                    estado, solucion_tecnico, observacion_tecnico, modelo_onu, modelo_router,
                    coordenadas_tecnico, hora_fin_visita, ventana_inicio, ventana_fin, es_instalacion
                )
                
                cursor.execute(query_insert, valores)
                sheet_inserted += 1
                total_insertados += 1

            conexion.commit()
            print(f"Hoja '{sheet_name}' procesada con éxito. Insertados: {sheet_inserted}")

    except Exception as e:
        conexion.rollback()
        print(f"Error al importar archivo de Drive: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conexion.close()
        print("\nConexión cerrada.")
        print(f"=== RESULTADO GENERAL DE IMPORTACIÓN ===")
        print(f"Libro procesado: {os.path.basename(archivo_excel)}")
        print(f"Total visitas importadas: {total_insertados}")
        print(f"Total duplicados omitidos: {total_duplicados}")

if __name__ == '__main__':
    # Permite ejecutar por defecto o pasando ruta
    importar_visitas_drive()
