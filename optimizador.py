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
