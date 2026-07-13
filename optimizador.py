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


def optimizar_ruta_tecnico(visitas, starting_lat=None, starting_lon=None):
    if not visitas:
        return []
        
    # Default office starting point
    if starting_lat is None or starting_lon is None:
        starting_lat = -2.896829
        starting_lon = -78.975419
        
    # Segregate visits by state
    active = []
    pending = []
    finished = []
    
    for v in visitas:
        if v.get('estado') in ['EN_PROGRESO', 'EN_RUTA']:
            active.append(v)
        elif v.get('estado') in ['FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA']:
            finished.append(v)
        else:
            pending.append(v)
            
    # Start point for optimizing pending visits
    current_lat = starting_lat
    current_lon = starting_lon
    
    # If there are active visits, the optimization start point should be the location of the last active visit (if coordinates are present)
    if active:
        for act_v in reversed(active):
            v_lat = act_v.get('latitud')
            v_lon = act_v.get('longitud')
            if v_lat is not None and v_lon is not None:
                try:
                    current_lat = float(v_lat)
                    current_lon = float(v_lon)
                    break
                except (ValueError, TypeError):
                    pass
                 
    # Separate pending visits with valid coordinates from those without
    pending_with_coords = []
    pending_without_coords = []
    for p in pending:
        p_lat = p.get('latitud')
        p_lon = p.get('longitud')
        if p_lat is not None and p_lon is not None:
            try:
                # Store coordinates as floats for calculation
                p['lat_float'] = float(p_lat)
                p['lon_float'] = float(p_lon)
                pending_with_coords.append(p)
            except (ValueError, TypeError):
                pending_without_coords.append(p)
        else:
            pending_without_coords.append(p)
            
    # Nearest Neighbor sequencing
    sequenced_pending = []
    current_pt = (current_lat, current_lon)
    
    while pending_with_coords:
        best_idx = 0
        best_score = 99999999.0
        for idx, v in enumerate(pending_with_coords):
            dist = calcular_distancia(current_pt[0], current_pt[1], v['lat_float'], v['lon_float'])
            
            v_start = v.get('ventana_inicio_min')
            if v_start is None:
                v_start = 480
                
            score = (v_start * 10) + dist
            if score < best_score:
                best_score = score
                best_idx = idx
                 
        next_visit = pending_with_coords.pop(best_idx)
        # Clean temporary float keys
        if 'lat_float' in next_visit: del next_visit['lat_float']
        if 'lon_float' in next_visit: del next_visit['lon_float']
        sequenced_pending.append(next_visit)
        current_pt = (float(next_visit['latitud']), float(next_visit['longitud']))
        
    # Clean temporary keys for any other items
    for p in pending_without_coords:
        if 'lat_float' in p: del p['lat_float']
        if 'lon_float' in p: del p['lon_float']
        
    # Sort pending without coordinates by time window start
    pending_without_coords.sort(key=lambda x: x.get('ventana_inicio_min') if x.get('ventana_inicio_min') is not None else 480)
    
    # Append pending without coordinates at the end of pending
    sequenced_pending.extend(pending_without_coords)
    
    # Combine all
    sorted_visitas = active + sequenced_pending + finished
    
    # Assign sequential orden_tecnico (technician stop sequence)
    for idx, v in enumerate(sorted_visitas, start=1):
        v['orden_tecnico'] = idx
        v['numero_parada'] = idx # Sobrescribir para mostrar la parada ordenada secuencialmente en el UI
         
    return sorted_visitas


def optimizar_todas_las_visitas(visitas):
    if not visitas:
        return []
        
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
