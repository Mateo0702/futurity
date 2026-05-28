import re

def normalizar_horario_texto(texto_preferencia):
    """
    Convierte frases de Call Center en ventanas de tiempo (minutos desde medianoche).
    Jornada laboral por defecto: 08:00 (480) a 18:00 (1080).
    """
    inicio_default = 480  # 8:00 AM
    fin_default = 1080    # 6:00 PM

    if not texto_preferencia:
        return inicio_default, fin_default

    texto = texto_preferencia.lower().strip()

    # 1. Palabras clave (mañana / tarde)
    if "mañana" in texto:
        return 480, 780   # 08:00 AM a 01:00 PM
    elif "tarde" in texto:
        return 780, 1080  # 01:00 PM a 06:00 PM
    elif "coordinar" in texto or "llamar" in texto:
        return inicio_default, fin_default # Todo el día, prioridad baja

    # 2. Búsqueda de horas exactas (Ej: "8:30" o "15:00")
    # Busca patrones de números separados por dos puntos
    coincidencia = re.search(r'(\d{1,2}):(\d{2})', texto)
    if coincidencia:
        horas = int(coincidencia.group(1))
        minutos = int(coincidencia.group(2))
        
        # Convertir formato 12h a 24h asumiendo horario laboral
        if horas < 8 and "pm" in texto: 
            horas += 12
            
        minutos_totales = (horas * 60) + minutos
        
        # Damos una ventana de 1 hora desde la hora solicitada
        return minutos_totales, minutos_totales + 60

    # Si no entiende qué pusieron, le da todo el día para no romper el algoritmo
    return inicio_default, fin_default

def parsear_informacion_tecnica(visitas):
    """
    Parsea la columna 'informacion_tecnico' de cada visita que contiene texto tipo:
    CAJA: <valor>
    HILO: <valor>
    IP: <valor>
    USR: <valor>
    PAS: <valor>
    Y añade estos campos individuales al diccionario de la visita.
    """
    for v in visitas:
        v['info_caja'] = None
        v['info_hilo'] = None
        v['info_ip'] = None
        v['info_usr'] = None
        v['info_pas'] = None
        
        info = v.get('informacion_tecnico')
        if info:
            for line in info.split('\n'):
                line = line.strip()
                if line.upper().startswith('CAJA:'):
                    v['info_caja'] = line[5:].strip()
                elif line.upper().startswith('HILO:'):
                    v['info_hilo'] = line[5:].strip()
                elif line.upper().startswith('IP:'):
                    v['info_ip'] = line[3:].strip()
                elif line.upper().startswith('USR:'):
                    v['info_usr'] = line[4:].strip()
                elif line.upper().startswith('PAS:'):
                    v['info_pas'] = line[4:].strip()
    return visitas