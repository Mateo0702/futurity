from db_config import get_db_connection
from datetime import date, datetime
import re # Asegúrate de importar esto arriba del todo
import math

def calcular_distancia(lat1, lon1, lat2, lon2):
    """Calcula la distancia en KM entre dos puntos usando Haversine."""
    if None in [lat1, lon1, lat2, lon2]: return 999 # Distancia infinita si falta dato
    
    R = 6371.0 # Radio de la Tierra en KM
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c
def interpretar_preferencia_horaria(texto):
    if not texto:
        return 9999
    
    texto = str(texto).lower()
    hora_actual = datetime.now().hour # Captura la hora real en formato 24h (ej: 13 para la 1 PM)
    
    # 1. VALIDACIÓN PARA VISITAS DE LA "MAÑANA"
    if 'mañana' in texto or 'manana' in texto:
        # Si ya es mediodía o más tarde (>= 12), esta visita ya expiró o es incoherente.
        # Le damos un peso altísimo (99999) para "castigarla" y mandarla al final de las paradas.
        if hora_actual >= 12:
            return 99999
        return 800 # Si aún es de mañana, mantiene su prioridad alta como Parada #1

    # 2. VALIDACIÓN PARA VISITAS DE LA "TARDE"
    if 'tarde' in texto:
        return 1600 # Las de la tarde mantienen su peso estándar

    # 3. VALIDACIÓN PARA RANGOS DE HORAS ESPECÍFICAS (Ej: "A las 10:00", "A las 15:00")
    import re
    match = re.search(r'(\d{1,2})', texto)
    if match:
        hora_sugerida = int(match.group(1))
        # Conversión simple a formato 24 horas si ponen horas de la tarde como 1, 2, 3...
        if 1 <= hora_sugerida <= 7:
            hora_sugerida += 12
            
        # Si la hora sugerida ya pasó con respecto a la hora actual, la mandamos al final
        if hora_actual > hora_sugerida:
            return 99999 # Ya pasó la hora, va al último
            
        return hora_sugerida * 100
    
    return 9999


def obtener_minuto_inicio_visita(v):
    pref = str(v.get('preferencia_horaria') or '').strip()
    pref_upper = pref.upper()
    
    # Si explícitamente es "Por coordinar" o "Flexible", no tiene horario fijo asignado
    if 'COORDINAR' in pref_upper or pref_upper == 'FLEXIBLE':
        return None
        
    v_start = v.get('ventana_inicio_min')
    if v_start is not None and str(v_start).strip().isdigit():
        return int(v_start)
        
    # Si tiene texto de rango o frase horaria, intentar extraer minutos
    if pref:
        m = re.search(r'(\d{1,2})(?:[:hH](\d{2}))?', pref)
        if m:
            hora = int(m.group(1))
            minuto = int(m.group(2) or 0)
            if 1 <= hora <= 7:
                hora += 12
            return hora * 60 + minuto
            
    return None


def optimizar_ruta_tecnico(visitas, starting_lat=None, starting_lon=None):
    if not visitas:
        return []
        
    # Segregar visitas por estado
    active = []
    pending_con_hora = []
    pending_por_coordinar = []
    finished = []
    
    for v in visitas:
        estado = (v.get('estado') or '').upper()
        if estado in ['EN_PROGRESO', 'EN_RUTA', 'EN_SITIO']:
            active.append(v)
        elif estado in ['FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA']:
            finished.append(v)
        else:
            min_inicio = obtener_minuto_inicio_visita(v)
            if min_inicio is not None:
                v['_min_inicio_sort'] = min_inicio
                pending_con_hora.append(v)
            else:
                pending_por_coordinar.append(v)
                
    # 1. Ordenar pendientes con hora 100% estricto por hora de inicio del cronograma
    pending_con_hora.sort(key=lambda x: (
        x.get('_min_inicio_sort', 9999),
        x.get('ventana_fin_min') if x.get('ventana_fin_min') is not None else 9999,
        x.get('id_visita') or 0
    ))
    for v in pending_con_hora:
        if '_min_inicio_sort' in v:
            del v['_min_inicio_sort']
            
    # 2. Pendientes por coordinar van al final de las pendientes
    pending_por_coordinar.sort(key=lambda x: x.get('id_visita') or 0)
    
    # 3. Combinar: Activas -> Pendientes con hora -> Pendientes por coordinar -> Finalizadas
    sorted_visitas = active + pending_con_hora + pending_por_coordinar + finished
    
    # 4. Asignar orden de parada secuencial del técnico
    for idx, v in enumerate(sorted_visitas, start=1):
        v['orden_tecnico'] = idx
        v['numero_parada'] = idx
         
    return sorted_visitas


def optimizar_todas_las_visitas(visitas):
    if not visitas:
        return []
        
    # Ordenar por id_visita de forma estable para asegurar el orden de registro
    visitas.sort(key=lambda x: x.get('id_visita', 0) or 0)
    
    # Assign global numero_parada in the order they are loaded
    for idx, v in enumerate(visitas, start=1):
        v['numero_parada'] = idx
        
    # Group by technician
    groups = {}
    for v in visitas:
        tec = v.get('tecnico_principal')
        if tec is None or tec in ['', 'NO TECNICO', 'SIN ASIGNAR', 'Auto']:
            tec = 'SIN_ASIGNAR'
        if tec not in groups:
            groups[tec] = []
        groups[tec].append(v)
        
    # Connect to DB to get live coordinates of each technician if available
    conexion = get_db_connection()
    tec_coords = {}
    if conexion:
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("""
                SELECT nombre, latitud_actual, longitud_actual 
                FROM tecnicos 
                WHERE activo = 1 
                  AND latitud_actual IS NOT NULL 
                  AND longitud_actual IS NOT NULL
            """)
            for row in cursor.fetchall():
                tec_coords[row['nombre']] = (float(row['latitud_actual']), float(row['longitud_actual']))
        except Exception as e:
            print(f"Error reading technician coordinates: {e}")
        finally:
            cursor.close()
            conexion.close()
             
    optimized_visitas = []
    
    # Process named technicians first
    for tec, group_visitas in groups.items():
        if tec == 'SIN_ASIGNAR':
            continue
        lat, lon = tec_coords.get(tec, (None, None))
        opt_group = optimizar_ruta_tecnico(group_visitas, lat, lon)
        optimized_visitas.extend(opt_group)
        
    # Process unassigned last
    if 'SIN_ASIGNAR' in groups:
        opt_group = optimizar_ruta_tecnico(groups['SIN_ASIGNAR'], None, None)
        optimized_visitas.extend(opt_group)
        
    # Sort for display:
    # Put unassigned at the end.
    # Grouped by technician name, then by orden_tecnico
    def display_sort_key(v):
        tec = v.get('tecnico_principal') or 'SIN_ASIGNAR'
        is_unassigned = 1 if tec in ['', 'NO TECNICO', 'SIN ASIGNAR', 'Auto', 'SIN_ASIGNAR'] else 0
        return (is_unassigned, tec, v.get('orden_tecnico', 9999))
        
    optimized_visitas.sort(key=display_sort_key)
    return optimized_visitas
