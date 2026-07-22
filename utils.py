import re
from datetime import datetime, date

def format_antiguedad(antiguedad_meses=None, fecha_instalacion=None):
    """
    Formatea la antigüedad en años y meses comprensibles.
    """
    total_meses = 0
    if antiguedad_meses is not None and str(antiguedad_meses).isdigit():
        total_meses = int(antiguedad_meses)
    elif fecha_instalacion:
        try:
            if isinstance(fecha_instalacion, str):
                for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"):
                    try:
                        d = datetime.strptime(fecha_instalacion.split()[0], fmt).date()
                        break
                    except Exception:
                        d = None
            elif isinstance(fecha_instalacion, (datetime, date)):
                d = fecha_instalacion if isinstance(fecha_instalacion, date) else fecha_instalacion.date()
            else:
                d = None

            if d:
                today = date.today()
                total_meses = (today.year - d.year) * 12 + (today.month - d.month)
        except Exception:
            total_meses = 0

    if total_meses <= 0:
        return "Nuevo (< 1 mes)"

    anios = total_meses // 12
    meses = total_meses % 12

    if anios > 0 and meses > 0:
        return f"{anios} año{'s' if anios > 1 else ''} y {meses} mes{'es' if meses > 1 else ''}"
    elif anios > 0:
        return f"{anios} año{'s' if anios > 1 else ''}"
    else:
        return f"{meses} mes{'es' if meses > 1 else ''}"

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

    # 1. Palabras clave específicas
    if "medio dia" in texto or "medio día" in texto:
        return 720, 840  # 12:00 PM a 02:00 PM

    # 2. Búsqueda de horas exactas con formato de dos puntos (Ej: "8:30" o "15:00")
    coincidencia_colon = re.search(r'(\d{1,2}):(\d{2})', texto)
    if coincidencia_colon:
        horas = int(coincidencia_colon.group(1))
        minutos = int(coincidencia_colon.group(2))
        
        # Convertir formato 12h a 24h asumiendo horario laboral
        if horas < 8 and "pm" in texto: 
            horas += 12
        elif horas == 12 and "am" in texto:
            horas = 0
            
        minutos_totales = (horas * 60) + minutos
        return minutos_totales, minutos_totales + 60

    # 3. Buscar formato tipo "13h30" o "13 h 30"
    coincidencia_h_min = re.search(r'(\d{1,2})\s*h\s*(\d{2})', texto)
    if coincidencia_h_min:
        horas = int(coincidencia_h_min.group(1))
        minutos = int(coincidencia_h_min.group(2))
        minutos_totales = (horas * 60) + minutos
        return minutos_totales, minutos_totales + 60

    # 4. Buscar formato tipo "13h" o "13 h"
    coincidencia_h = re.search(r'(\d{1,2})\s*h\b', texto)
    if coincidencia_h:
        horas = int(coincidencia_h.group(1))
        if horas < 8 and "pm" in texto:
            horas += 12
        minutos_totales = horas * 60
        return minutos_totales, minutos_totales + 60

    # 5. Buscar formato tipo "3pm", "3 pm", "3 am", "3am" (sin minutos)
    coincidencia_ampm = re.search(r'(\d{1,2})\s*(pm|am|p\.m\.|a\.m\.)', texto)
    if coincidencia_ampm:
        horas = int(coincidencia_ampm.group(1))
        periodo = coincidencia_ampm.group(2).replace('.', '').strip()
        if periodo == "pm" and horas < 12:
            horas += 12
        elif periodo == "am" and horas == 12:
            horas = 0
        minutos_totales = horas * 60
        return minutos_totales, minutos_totales + 60

    # 6. Palabras clave generales (mañana / tarde)
    if "mañana" in texto:
        return 480, 780   # 08:00 AM a 01:00 PM
    elif "tarde" in texto:
        return 780, 1080  # 01:00 PM a 06:00 PM
    elif "coordinar" in texto or "llamar" in texto:
        return inicio_default, fin_default

    return inicio_default, fin_default

def parsear_informacion_tecnica(visitas):
    """
    Parsea la columna 'informacion_tecnico' de cada visita y la enriquece con
    datos comerciales del cliente (total_mensual, antiguedad_fmt, numero_serie).
    """
    if not visitas:
        return visitas

    from db_config import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True) if conn else None

    try:
        for v in visitas:
            v['info_caja'] = None
            v['info_hilo'] = None
            v['info_ip'] = None
            v['info_vlan'] = None
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
                    elif line.upper().startswith('VLAN:'):
                        v['info_vlan'] = line[5:].strip()
                    elif line.upper().startswith('USR:'):
                        v['info_usr'] = line[4:].strip()
                    elif line.upper().startswith('PAS:'):
                        v['info_pas'] = line[4:].strip()

            # Enriquecer con datos comerciales del cliente (Mensualidad, Antigüedad, SN)
            if cursor and v.get('contrato'):
                c_val = str(v['contrato']).strip().upper()
                c_clean = c_val.lstrip('0')
                cursor.execute("""
                    SELECT total_mensual, antiguedad, fecha_instalacion, numero_serie
                    FROM directorio_clientes
                    WHERE UPPER(contrato) = %s OR UPPER(contrato) = %s
                    LIMIT 1
                """, (c_val, c_clean))
                cli_info = cursor.fetchone()
                if cli_info:
                    v['total_mensual'] = float(cli_info['total_mensual']) if cli_info.get('total_mensual') is not None else None
                    v['numero_serie'] = cli_info.get('numero_serie') or 'S/N'
                    v['antiguedad_fmt'] = format_antiguedad(cli_info.get('antiguedad'), cli_info.get('fecha_instalacion'))
                else:
                    v['total_mensual'] = None
                    v['numero_serie'] = 'S/N'
                    v['antiguedad_fmt'] = 'N/D'
    except Exception as e:
        print(f"Error enriqueciendo visitas con datos de cliente: {e}")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

    return visitas