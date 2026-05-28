import os
import mysql.connector
import pandas as pd
from datetime import datetime, date

def importar_respaldo():
    # 1. Nombre del archivo de Excel
    archivo_excel = "respaldo_visitas.xlsx"
    
    if not os.path.exists(archivo_excel):
        print(f"Error: No se encontró el archivo '{archivo_excel}' en esta carpeta.")
        print("Por favor, guarda tu archivo de Excel con el nombre 'respaldo_visitas.xlsx' en este mismo directorio.")
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
        # Cargar Excel sin cabeceras para poder usar índices numéricos consistentes
        df = pd.read_excel(archivo_excel, header=None)
        
        # Omitir fila de cabecera si detectamos palabras clave en la primera fila
        start_idx = 0
        first_row_vals = [str(v).lower() for v in df.iloc[0].values]
        if any(h in first_row_vals for h in ["contrato", "# contrato", "cliente", "asesor"]):
            start_idx = 1
            print("Cabecera detectada y omitida de la importación.")

        print(f"Archivo leído con éxito. Se encontraron {len(df) - start_idx} registros listos para procesar.")
        
        # --- PREPROCESAMIENTO DE DATOS ---
        print("Preprocesando datos (resolviendo celdas de asesores agrupadas e interpolando fechas inválidas)...")
        
        # 1. Rellenar hacia adelante el asesor/creador (Col 0) para celdas vacías por agrupación visual
        df[0] = df[0].ffill()
        
        # 2. Limpiar columna de fechas (Col 4) convirtiendo nulos, inválidos y fechas con año < 2000 (1890/1899)
        # a NaT, para luego aplicar ffill() y bfill() y asociarlas con las fechas más cercanas de su puesto
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
        
        print("Conectando a MySQL...")
        conexion = mysql.connector.connect(**config_db)
        cursor = conexion.cursor()

        # Obtener los creadores únicos del excel para limpiar registros previos de esta fuente
        creadores_excel = df[0].dropna().unique().tolist()
        if creadores_excel:
            print("Limpiando registros previos del backup para evitar duplicados...")
            format_strings = ', '.join(['%s'] * len(creadores_excel))
            cursor.execute(f"DELETE FROM visitas_tecnicas WHERE creado_por IN ({format_strings})", tuple(creadores_excel))
            print(f"Limpieza completada. Se eliminaron {cursor.rowcount} registros anteriores.")

        query_insert = """
            INSERT INTO visitas_tecnicas (
                creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_programada, preferencia_horaria, 
                prioridad, empresa, contrato, cliente, telefonos, sector, direccion, 
                servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, 
                estado, solucion_tecnico, observacion_tecnico, modelo_onu, modelo_router, 
                coordenadas_tecnico, hora_fin_visita
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        print("Iniciando la inyección masiva en la tabla 'visitas_tecnicas'...")
        
        contador_insertados = 0
        indices_a_omitir = set()
        
        for index in range(start_idx, len(df)):
            if index in indices_a_omitir:
                continue
                
            row = df.iloc[index]
            
            # Detectar si la fila siguiente es una continuación de la fila actual (registro dividido en Excel)
            siguiente_idx = index + 1
            es_continuacion = False
            if siguiente_idx < len(df):
                sig_row = df.iloc[siguiente_idx]
                # Si el cliente (Col 8) en la sig_row contiene referencias técnicas de caja/hilo, es una continuación
                sig_cliente_val = str(sig_row[8]) if pd.notna(sig_row[8]) else ""
                if 'caja:' in sig_cliente_val.lower() or 'hilo:' in sig_cliente_val.lower():
                    es_continuacion = True
                    indices_a_omitir.add(siguiente_idx)
            
            # --- MAPEO Y TRUNCAMIENTO DE VARIABLES ---
            
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
            
            # Fecha programada (Col 4 - ya sanitizada y ffilled/bfilled en df)
            fecha_val = row[4]
            fecha_registro = None
            if pd.notna(fecha_val):
                try:
                    fecha_dt = pd.to_datetime(fecha_val)
                    fecha_programada = fecha_dt.date().isoformat()
                    fecha_registro = fecha_dt.to_pydatetime()
                except:
                    fecha_programada = str(date.today())
                    fecha_registro = datetime.now()
            else:
                fecha_programada = str(date.today())
                fecha_registro = datetime.now()
                
            # Preferencia horaria / Prioridad (Col 5)
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
                
            # Cliente (Col 8) - NOT NULL
            cliente = str(row[8]).strip().upper() if pd.notna(row[8]) else None
            if not cliente or cliente in ['', 'NAN', 'NONE']:
                continue # Omitir registros vacíos
            cliente = cliente[:150]
            
            # Si detectamos que se dividió el registro, extraemos los campos restantes de sig_row (la continuación)
            if es_continuacion:
                sig_row = df.iloc[siguiente_idx]
                
                # Teléfonos (sig_row Col 1)
                telefonos = str(sig_row[1]).strip() if pd.notna(sig_row[1]) else None
                if telefonos in [None, '', 'NAN', 'NONE']:
                    telefonos = None
                else:
                    if telefonos.endswith('.0') or telefonos.endswith(',0'):
                        telefonos = telefonos[:-2]
                    telefonos = telefonos[:100]
                    
                # Sector (sig_row Col 2)
                sector = str(sig_row[2]).strip().upper() if pd.notna(sig_row[2]) else None
                if sector in [None, '', 'NAN', 'NONE']:
                    sector = None
                else:
                    sector = sector[:100]
                
                # Dirección (sig_row Col 3)
                direccion = str(sig_row[3]).strip() if pd.notna(sig_row[3]) else None
                if direccion in [None, '', 'NAN', 'NONE']:
                    direccion = None
                if not direccion and sector:
                    direccion = sector
                elif direccion and sector and sector not in direccion:
                    direccion = f"{direccion} ({sector})"
                if direccion:
                    direccion = direccion[:255]
                    
                # Servicio (sig_row Col 4)
                servicio = str(sig_row[4]).strip().upper() if pd.notna(sig_row[4]) else None
                if servicio in [None, '', 'NAN', 'NONE']:
                    servicio = None
                else:
                    servicio = servicio[:50]
                
                # Velocidad Mbps (sig_row Col 5)
                velocidad_raw = sig_row[5]
                velocidad_mbps = None
                if pd.notna(velocidad_raw):
                    try:
                        clean_vel = str(velocidad_raw).upper().replace('MBPS', '').strip()
                        velocidad_mbps = int(float(clean_vel))
                    except:
                        pass
                
                # Problema (sig_row Col 6)
                problema = str(sig_row[6]).strip().upper() if pd.notna(sig_row[6]) else None
                if problema in [None, '', 'NAN', 'NONE']:
                    problema = None
                else:
                    problema = problema[:150]
                
                # Observación Callcenter (sig_row Col 7)
                observacion_callcenter = str(sig_row[7]).strip() if pd.notna(sig_row[7]) else None
                if observacion_callcenter in [None, '', 'NAN', 'NONE']:
                    observacion_callcenter = None
                
                # Informacion técnica de poste (sig_row Col 8)
                informacion_tecnico = str(sig_row[8]).strip() if pd.notna(sig_row[8]) else None
                if informacion_tecnico in [None, '', 'NAN', 'NONE']:
                    informacion_tecnico = None
                
                # Solución técnica (sig_row Col 10)
                solucion_tecnico = str(sig_row[10]).strip().upper() if pd.notna(sig_row[10]) else None
                if solucion_tecnico in [None, '', 'NAN', 'NONE']:
                    solucion_tecnico = None
                else:
                    solucion_tecnico = solucion_tecnico[:150]
                
                # Observación técnico (sig_row Col 11)
                observacion_tecnico = str(sig_row[11]).strip() if pd.notna(sig_row[11]) else None
                if observacion_tecnico in [None, '', 'NAN', 'NONE']:
                    observacion_tecnico = None
                
                # ONU (sig_row Col 12)
                modelo_onu = str(sig_row[12]).strip().upper() if pd.notna(sig_row[12]) else None
                if modelo_onu in [None, '', 'NAN', 'NONE']:
                    modelo_onu = None
                else:
                    modelo_onu = modelo_onu[:50]
                
                # Router (sig_row Col 13)
                modelo_router = str(sig_row[13]).strip().upper() if pd.notna(sig_row[13]) else None
                if modelo_router in [None, '', 'NAN', 'NONE']:
                    modelo_router = None
                else:
                    modelo_router = modelo_router[:50]
                
                # Coordenadas técnico (sig_row Col 14)
                coordenadas_tecnico = str(sig_row[14]).strip() if pd.notna(sig_row[14]) else None
                if coordenadas_tecnico in [None, '', 'NAN', 'NONE']:
                    coordenadas_tecnico = None
                else:
                    coordenadas_tecnico = coordenadas_tecnico[:100]
                
                # Hora fin de visita (sig_row Col 15)
                hora_fin_val = sig_row[15]
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
            else:
                # Fila normal (mapear de la fila actual `row` usando sus respectivos índices estándar)
                
                # Teléfonos (Col 9)
                telefonos = str(row[9]).strip() if pd.notna(row[9]) else None
                if telefonos in [None, '', 'NAN', 'NONE']:
                    telefonos = None
                else:
                    if telefonos.endswith('.0') or telefonos.endswith(',0'):
                        telefonos = telefonos[:-2]
                    telefonos = telefonos[:100]
                    
                # Sector (Col 10)
                sector = str(row[10]).strip().upper() if pd.notna(row[10]) else None
                if sector in [None, '', 'NAN', 'NONE']:
                    sector = None
                else:
                    sector = sector[:100]
                
                # Dirección (Col 11)
                direccion = str(row[11]).strip() if pd.notna(row[11]) else None
                if direccion in [None, '', 'NAN', 'NONE']:
                    direccion = None
                if not direccion and sector:
                    direccion = sector
                elif direccion and sector and sector not in direccion:
                    direccion = f"{direccion} ({sector})"
                if direccion:
                    direccion = direccion[:255]
                    
                # Servicio (Col 12)
                servicio = str(row[12]).strip().upper() if pd.notna(row[12]) else None
                if servicio in [None, '', 'NAN', 'NONE']:
                    servicio = None
                else:
                    servicio = servicio[:50]
                
                # Velocidad Mbps (Col 13)
                velocidad_raw = row[13]
                velocidad_mbps = None
                if pd.notna(velocidad_raw):
                    try:
                        clean_vel = str(velocidad_raw).upper().replace('MBPS', '').strip()
                        velocidad_mbps = int(float(clean_vel))
                    except:
                        pass
                
                # Problema (Col 14)
                problema = str(row[14]).strip().upper() if pd.notna(row[14]) else None
                if problema in [None, '', 'NAN', 'NONE']:
                    problema = None
                else:
                    problema = problema[:150]
                
                # Observación Callcenter (Col 15)
                observacion_callcenter = str(row[15]).strip() if pd.notna(row[15]) else None
                if observacion_callcenter in [None, '', 'NAN', 'NONE']:
                    observacion_callcenter = None
                
                # Informacion técnica de poste (Col 16)
                informacion_tecnico = str(row[16]).strip() if pd.notna(row[16]) else None
                if informacion_tecnico in [None, '', 'NAN', 'NONE']:
                    informacion_tecnico = None
                
                # Solución técnica (Col 18)
                solucion_tecnico = str(row[18]).strip().upper() if pd.notna(row[18]) else None
                if solucion_tecnico in [None, '', 'NAN', 'NONE']:
                    solucion_tecnico = None
                else:
                    solucion_tecnico = solucion_tecnico[:150]
                
                # Observación técnico (Col 19)
                observacion_tecnico = str(row[19]).strip() if pd.notna(row[19]) else None
                if observacion_tecnico in [None, '', 'NAN', 'NONE']:
                    observacion_tecnico = None
                
                # ONU (Col 20)
                modelo_onu = str(row[20]).strip().upper() if pd.notna(row[20]) else None
                if modelo_onu in [None, '', 'NAN', 'NONE']:
                    modelo_onu = None
                else:
                    modelo_onu = modelo_onu[:50]
                
                # Router (Col 21)
                modelo_router = str(row[21]).strip().upper() if pd.notna(row[21]) else None
                if modelo_router in [None, '', 'NAN', 'NONE']:
                    modelo_router = None
                else:
                    modelo_router = modelo_router[:50]
                
                # Coordenadas técnico (Col 22)
                coordenadas_tecnico = str(row[22]).strip() if pd.notna(row[22]) else None
                if coordenadas_tecnico in [None, '', 'NAN', 'NONE']:
                    coordenadas_tecnico = None
                else:
                    coordenadas_tecnico = coordenadas_tecnico[:100]
                
                # Hora fin de visita (Col 23)
                hora_fin_val = row[23]
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
            
            # Determinar estado según la solución técnica
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
                # Si no tiene solución técnica, y no tiene técnico asignado o no tiene hora_fin_visita, no debería estar finalizada
                if not tecnico_principal or tecnico_principal.upper() in ["NO TECNICO", "SIN ASIGNAR", "NONE", "NAN", ""]:
                    estado = "CANCELADA"
            
            # Ejecutar inserción
            datos_visita = (
                creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_programada, preferencia,
                prioridad, empresa, contrato, cliente, telefonos, sector, direccion,
                servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico,
                estado, solucion_tecnico, observacion_tecnico, modelo_onu, modelo_router,
                coordenadas_tecnico, hora_fin_visita
            )
            
            try:
                cursor.execute(query_insert, datos_visita)
                contador_insertados += 1
            except mysql.connector.Error as err:
                print(f"\n[ERROR] Falla al insertar fila index {index} en Excel.")
                print(f"Valores a insertar:")
                print(f" - creado_por: {creado_por}")
                print(f" - tecnico_principal: {tecnico_principal}")
                print(f" - tecnico_apoyo: {tecnico_apoyo}")
                print(f" - fecha_programada: {fecha_programada}")
                print(f" - preferencia: {preferencia}")
                print(f" - prioridad: {prioridad}")
                print(f" - empresa: {empresa}")
                print(f" - contrato: '{contrato}' (longitud: {len(contrato) if contrato else 0})")
                print(f" - cliente: '{cliente}' (longitud: {len(cliente) if cliente else 0})")
                print(f" - telefonos: {telefonos}")
                print(f" - sector: {sector}")
                print(f" - direccion: {direccion}")
                print(f" - servicio: {servicio}")
                print(f" - velocidad_mbps: {velocidad_mbps}")
                print(f" - problema: {problema}")
                print(f" - observacion_callcenter: {observacion_callcenter}")
                print(f" - informacion_tecnico: {informacion_tecnico}")
                print(f" - estado: {estado}")
                print(f" - solucion_tecnico: {solucion_tecnico}")
                print(f" - observacion_tecnico: {observacion_tecnico}")
                print(f" - modelo_onu: {modelo_onu}")
                print(f" - modelo_router: {modelo_router}")
                print(f" - coordenadas_tecnico: {coordenadas_tecnico}")
                print(f" - hora_fin_visita: {hora_fin_visita}")
                print(f"Error de base de datos: {err}")
                raise err

        conexion.commit()
        print(f"Exito absoluto! Se importaron {contador_insertados} visitas a la tabla 'visitas_tecnicas'.")

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
    importar_respaldo()
