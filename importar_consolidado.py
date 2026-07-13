import os
import re
import pandas as pd
import mysql.connector
from datetime import datetime, date, time
from db_config import get_db_connection
from utils import normalizar_horario_texto

def parse_sheet_name_to_date(sheet_name):
    """Parsea el nombre de la pestaña (ej: '1 JULIO', '26 AGOSTO') para obtener la fecha de ruteo."""
    months = {
        'JUNIO': 6,
        'JULIO': 7,
        'AGOSTO': 8
    }
    sheet_clean = sheet_name.strip().upper()
    
    # Coincidir con formatos tipo "1 JULIO" o "26 AGOSTO"
    match = re.match(r'(\d+)\s+([A-Z]+)', sheet_clean)
    if match:
        day = int(match.group(1))
        month_name = match.group(2)
        month = months.get(month_name, 7)
        return date(2026, month, day)
    
    return None

def format_db_datetime(val):
    """Parsea y formatea un valor a formato datetime para MySQL, o retorna None."""
    if pd.isna(val) or str(val).strip().lower() in ['nan', 'none', '']:
        return None
    try:
        dt = pd.to_datetime(val)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None

def importar_consolidado():
    file_path = "consolidado_visitas.xlsx"
    if not os.path.exists(file_path):
        print(f"Error: No se encontró el archivo {file_path}")
        return

    print("Conectando a la base de datos MySQL...")
    conexion = get_db_connection()
    if not conexion:
        print("Error: No se pudo conectar a la base de datos.")
        return
        
    cursor = conexion.cursor(buffered=True, dictionary=True)
    xl = pd.ExcelFile(file_path)
    
    print(f"Hojas encontradas en el archivo: {xl.sheet_names}")
    
    total_leidos = 0
    total_insertados = 0
    total_actualizados = 0
    
    # Fecha operativa de hoy
    hoy_date = date(2026, 7, 13)
    
    try:
        for sheet in xl.sheet_names:
            print(f"\n--- Leyendo hoja: '{sheet}' ---")
            
            # Cargar la hoja omitiendo la fila 0 (que tiene las secciones agrupadas), usando la fila 1 como cabecera
            df = pd.read_excel(file_path, sheet_name=sheet, header=1)
            print(f"  Total de filas en la hoja: {len(df)}")
            
            # Obtener fecha de la pestaña
            fecha_pestana = parse_sheet_name_to_date(sheet)
            
            for index, row in df.iterrows():
                row_values = list(row.values)
                # Validar que tenga al menos 24 columnas
                if len(row_values) < 24:
                    continue
                
                # Mapear columnas por índice
                tecnico_cc = row_values[0]
                tecnico_principal = row_values[1]
                tecnico_apoyo = row_values[2]
                num_vt = row_values[3]
                fecha_y_hora = row_values[4]
                pref_horaria = row_values[5]
                empresa = row_values[6]
                contrato = row_values[7]
                cliente = row_values[8]
                telefonos = row_values[9]
                sector = row_values[10]
                direccion = row_values[11]
                servicio = row_values[12]
                velocidad = row_values[13]
                problema = row_values[14]
                obs_callcenter = row_values[15]
                info_tecnico = row_values[16]
                inicio_vt = row_values[17]
                solucion_tec = row_values[18]
                obs_tecnico = row_values[19]
                modelo_onu = row_values[20]
                modelo_router = row_values[21]
                coordenadas = row_values[22]
                finalizacion = row_values[23]
                
                # --- LIMPIEZA & VALIDACIÓN DE CLIENTE ---
                if pd.isna(cliente) or not str(cliente).strip():
                    continue
                
                cliente_str = str(cliente).strip().upper()
                # Omitir separadores / reuniones
                if any(x in cliente_str for x in ['REUNIÓN', 'REUNION', 'REUNIN', 'ALMUERZO', 'DESCANSO']):
                    continue
                
                # --- FECHA DE CREACIÓN (FECHA REGISTRO) ---
                fecha_registro_dt = None
                if pd.notna(fecha_y_hora):
                    try:
                        fecha_registro_dt = pd.to_datetime(fecha_y_hora)
                    except:
                        pass
                
                # --- FECHA DE REALIZACIÓN (FECHA PROGRAMADA) ---
                fecha_prog_str = None
                finalizacion_dt = None
                if pd.notna(finalizacion):
                    try:
                        finalizacion_dt = pd.to_datetime(finalizacion)
                        fecha_prog_str = finalizacion_dt.date().isoformat()
                    except:
                        pass
                
                # Si no hay ninguna fecha y es consolidado de Junio, omitir fila (evita registros como "monay shopping" vacíos)
                if not fecha_pestana and not fecha_registro_dt and not finalizacion_dt:
                    continue
                
                total_leidos += 1
                
                # --- CONTRATO ---
                contrato_str = None
                if pd.notna(contrato):
                    contrato_str = str(contrato).strip()
                    if contrato_str.endswith('.0') or contrato_str.endswith(',0'):
                        contrato_str = contrato_str[:-2]
                    if contrato_str.lower() in ['nan', 'none', '']:
                        contrato_str = None
                
                # Si no tiene fecha de finalización, determinar por pestaña o registro
                if not fecha_prog_str:
                    if fecha_pestana:
                        fecha_prog_str = fecha_pestana.isoformat()
                    elif fecha_registro_dt:
                        fecha_prog_str = fecha_registro_dt.date().isoformat()
                    else:
                        fecha_prog_str = date.today().isoformat()
                
                # Si falló la fecha de registro
                if not fecha_registro_dt:
                    if finalizacion_dt:
                        fecha_registro_dt = finalizacion_dt
                    else:
                        fecha_registro_dt = datetime.combine(date.fromisoformat(fecha_prog_str), time.min)
                
                fecha_registro_str = fecha_registro_dt.strftime('%Y-%m-%d %H:%M:%S')
                
                # --- DEDUCIR SI ES INSTALACIÓN ---
                is_inst = 0
                prob_upper = str(problema).upper() if pd.notna(problema) else ""
                serv_upper = str(servicio).upper() if pd.notna(servicio) else ""
                if any(x in prob_upper for x in ['INSTALACION', 'INSTALACIÓN', 'NUEVA']) or any(x in serv_upper for x in ['INSTALACION', 'INSTALACIÓN']):
                    is_inst = 1
                
                # --- ESTADO (FINALIZADA, PENDIENTE, REAGENDADA, CANCELADA) ---
                fecha_prog_date = date.fromisoformat(fecha_prog_str)
                
                # Si tiene fecha de finalización, está completada
                if pd.notna(finalizacion) and str(finalizacion).strip().lower() not in ['nan', 'none', '']:
                    estado = 'FINALIZADA'
                else:
                    # Si la fecha programada es hoy o futura, por defecto es PENDIENTE (no cancelada!)
                    if fecha_prog_date >= hoy_date:
                        estado = 'PENDIENTE'
                    else:
                        # Si es pasada, evaluar comentarios
                        comb_obs = (str(obs_tecnico) + " " + str(solucion_tec) + " " + str(obs_callcenter)).upper()
                        if any(x in comb_obs for x in ['REAGENDADA', 'REAGENDADO', 'REAGENDA', 'RECOORDINA']):
                            estado = 'REAGENDADA'
                        elif any(x in comb_obs for x in ['SATURACION', 'SATURACIÓN', 'SATURACIO', 'NO SE PUEDE REALIZAR', 'NO SE PUEDE REALIXAR']):
                            estado = 'PENDIENTE'
                        else:
                            estado = 'CANCELADA'
                
                # --- VELOCIDAD ---
                vel_val = None
                if pd.notna(velocidad):
                    try:
                        digits = ''.join(c for c in str(velocidad) if c.isdigit())
                        if digits:
                            vel_val = int(digits)
                    except:
                        pass
                
                # --- HORARIOS & VENTANA ---
                pref_str = str(pref_horaria).strip() if pd.notna(pref_horaria) else "Todo el día"
                ventana_inicio, ventana_fin = normalizar_horario_texto(pref_str)
                
                # --- CAMPOS RESTANTES ---
                creado_por_str = str(tecnico_cc).strip() if pd.notna(tecnico_cc) else "Importado"
                if creado_por_str.lower() in ['nan', 'none', '']:
                    creado_por_str = "Importado"
                
                tecnico_principal_str = str(tecnico_principal).strip().upper() if pd.notna(tecnico_principal) else None
                if tecnico_principal_str in ['NAN', 'NONE', '']: tecnico_principal_str = None
                
                tecnico_apoyo_str = str(tecnico_apoyo).strip().upper() if pd.notna(tecnico_apoyo) else None
                if tecnico_apoyo_str in ['NAN', 'NONE', '']: tecnico_apoyo_str = None
                
                empresa_str = str(empresa).strip().upper() if pd.notna(empresa) else "SERVICABLE"
                if empresa_str not in ['SERVICABLE', 'FIBRACOM']:
                    empresa_str = "SERVICABLE"
                
                telefonos_str = str(telefonos).strip() if pd.notna(telefonos) else None
                if telefonos_str in ['NAN', 'NONE', '']: telefonos_str = None
                
                sector_str = str(sector).strip().upper() if pd.notna(sector) else None
                if sector_str in ['NAN', 'NONE', '']: sector_str = None
                
                direccion_str = str(direccion).strip() if pd.notna(direccion) else None
                if direccion_str in ['NAN', 'NONE', '']: direccion_str = None
                
                servicio_str = str(servicio).strip() if pd.notna(servicio) else None
                if servicio_str in ['NAN', 'NONE', '']: servicio_str = None
                
                problema_str = str(problema).strip() if pd.notna(problema) else None
                if problema_str in ['NAN', 'NONE', '']: problema_str = None
                
                obs_callcenter_str = str(obs_callcenter).strip() if pd.notna(obs_callcenter) else None
                if obs_callcenter_str in ['NAN', 'NONE', '']: obs_callcenter_str = None
                
                solucion_tec_str = str(solucion_tec).strip() if pd.notna(solucion_tec) else None
                if solucion_tec_str in ['NAN', 'NONE', '']: solucion_tec_str = None
                
                obs_tecnico_str = str(obs_tecnico).strip() if pd.notna(obs_tecnico) else None
                if obs_tecnico_str in ['NAN', 'NONE', '']: obs_tecnico_str = None
                
                modelo_onu_str = str(modelo_onu).strip() if pd.notna(modelo_onu) else None
                if modelo_onu_str in ['NAN', 'NONE', '']: modelo_onu_str = None
                
                modelo_router_str = str(modelo_router).strip() if pd.notna(modelo_router) else None
                if modelo_router_str in ['NAN', 'NONE', '']: modelo_router_str = None
                
                coordenadas_str = str(coordenadas).strip() if pd.notna(coordenadas) else None
                if coordenadas_str in ['NAN', 'NONE', '']: coordenadas_str = None
                
                hora_inicio_db = format_db_datetime(inicio_vt)
                hora_fin_db = format_db_datetime(finalizacion)
                
                # --- VERIFICAR SI YA EXISTE EN BD ---
                existe_id = None
                if contrato_str:
                    cursor.execute("""
                        SELECT id_visita FROM visitas_tecnicas 
                        WHERE contrato = %s AND fecha_programada = %s AND es_instalacion = %s
                    """, (contrato_str, fecha_prog_str, is_inst))
                else:
                    cursor.execute("""
                        SELECT id_visita FROM visitas_tecnicas 
                        WHERE cliente = %s AND fecha_programada = %s AND es_instalacion = %s
                    """, (cliente_str, fecha_prog_str, is_inst))
                
                res = cursor.fetchone()
                if res:
                    existe_id = res['id_visita']
                    
                if existe_id:
                    # Actualizar estado y campos clave
                    query_update = """
                        UPDATE visitas_tecnicas 
                        SET estado = %s,
                            solucion_tecnico = %s,
                            observacion_tecnico = %s,
                            hora_inicio_visita = %s,
                            hora_fin_visita = %s,
                            creado_por = %s,
                            tecnico_principal = %s,
                            tecnico_apoyo = %s
                        WHERE id_visita = %s
                    """
                    cursor.execute(query_update, (
                        estado, solucion_tec_str, obs_tecnico_str, 
                        hora_inicio_db, hora_fin_db, creado_por_str,
                        tecnico_principal_str, tecnico_apoyo_str,
                        existe_id
                    ))
                    total_actualizados += 1
                else:
                    # --- INSERTAR EN BD ---
                    query_insert = """
                        INSERT INTO visitas_tecnicas (
                            creado_por, tecnico_principal, tecnico_apoyo, fecha_registro, fecha_programada, preferencia_horaria, 
                            prioridad, empresa, contrato, cliente, telefonos, sector, direccion, 
                            servicio, estado, es_instalacion, problema, observacion_callcenter,
                            solucion_tecnico, observacion_tecnico, modelo_onu, modelo_router, coordenadas_tecnico,
                            hora_inicio_visita, hora_fin_visita, velocidad_mbps,
                            ventana_inicio_min, ventana_fin_min
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    valores = (
                        creado_por_str, tecnico_principal_str, tecnico_apoyo_str, fecha_registro_str, fecha_prog_str, pref_str,
                        'MEDIA', empresa_str, contrato_str, cliente_str, telefonos_str, sector_str, direccion_str,
                        servicio_str, estado, is_inst, problema_str, obs_callcenter_str,
                        solucion_tec_str, obs_tecnico_str, modelo_onu_str, modelo_router_str, coordenadas_str,
                        hora_inicio_db, hora_fin_db, vel_val,
                        ventana_inicio, ventana_fin
                    )
                    cursor.execute(query_insert, valores)
                    total_insertados += 1
            
            conexion.commit()
            print(f"  Hoja finalizada. Insertados: {total_insertados}, Actualizados: {total_actualizados}")
            
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
        print(f"Filas válidas evaluadas: {total_leidos}")
        print(f"Nuevos registros insertados: {total_insertados}")
        print(f"Registros actualizados (estado/detalles): {total_actualizados}")

if __name__ == '__main__':
    importar_consolidado()
