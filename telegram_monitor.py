"""
=============================================================================
FUTURITY ATLAS - MONITOR AUTÓNOMO DE TELEGRAM EN SEGUNDO PLANO
=============================================================================
Este servicio ejecuta un hilo continuo (daemon) que monitorea:
1. Alertas de fin de almuerzo (exactamente 5 minutos antes para técnicos de la mañana).
2. Alertas de visitas atrasadas (+15 minutos respecto a su horario programado).

Envía notificaciones al grupo oficial de Telegram (Atrasos VT) de forma 100%
autónoma, sin requerir intervención humana de los coordinadores.
=============================================================================
"""

import os
import time
import json
import re
import threading
import urllib.request
import urllib.error
from datetime import datetime, date

from db_config import get_db_connection

# Cache en memoria para no duplicar alertas en el mismo día
_alertas_almuerzo_enviadas = set()
_alertas_atraso_enviadas = set()
_ultimo_dia_limpieza = None

def _enviar_mensaje_telegram(mensaje):
    """Envía un mensaje con formato Markdown al grupo de Telegram configurado."""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID_OPERACIONES') or os.environ.get('TELEGRAM_CHAT_ID')

    if not bot_token or not chat_id or not mensaje:
        return False

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": mensaje,
        "parse_mode": "Markdown"
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "FuturityAtlas/2.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('ok', False)
    except Exception as e:
        print(f"[TelegramMonitor] Error enviando mensaje a Telegram: {e}")
        return False

def _parsear_rango_horario(preferencia_str):
    """Devuelve (inicio_min, fin_min) a partir de un string como '09:00 - 10:30' o '12h30 a 14h00'."""
    if not preferencia_str:
        return None, None

    raw = str(preferencia_str).lower().strip()
    match = re.search(r'(\d{1,2})(?:[:hH](\d{2}))?\s*(am|pm)?\s*(?:-|a|hasta|\/)\s*(\d{1,2})(?:[:hH](\d{2}))?\s*(am|pm)?', raw)
    if match:
        h1 = int(match.group(1))
        m1 = int(match.group(2)) if match.group(2) else 0
        mod1 = (match.group(3) or '').lower()
        h2 = int(match.group(4))
        m2 = int(match.group(5)) if match.group(5) else 0
        mod2 = (match.group(6) or '').lower()

        if (mod1 == 'pm' or 'tarde' in raw) and h1 < 12 and not raw.startswith('12'):
            h1 += 12
        if (mod2 == 'pm' or h2 < h1 or (1 <= h2 <= 7 and h1 >= 8)) and h2 < 12:
            h2 += 12

        return h1 * 60 + m1, h2 * 60 + m2

    single = re.search(r'(\d{1,2})(?:[:hH](\d{2}))?', raw)
    if single:
        h = int(single.group(1))
        m = int(single.group(2)) if single.group(2) else 0
        if ('pm' in raw or 'tarde' in raw) and h < 12:
            h += 12
        return h * 60 + m, h * 60 + m + 90

    if 'mañana' in raw or 'manana' in raw:
        return 9 * 60, 11 * 60
    if 'tarde' in raw:
        return 14 * 60, 16 * 60

    return None, None

def _formato_hhmm(minutos):
    h = minutos // 60
    m = minutos % 60
    return f"{h:02d}:{m:02d}"

def _monitorear_ciclo():
    """Ejecuta una pasada de verificación de almuerzos y atrasos."""
    global _ultimo_dia_limpieza

    ahora = datetime.now()
    hoy_str = ahora.strftime('%Y-%m-%d')
    ahora_min = ahora.hour * 60 + ahora.minute

    # Limpieza a medianoche de caches
    if _ultimo_dia_limpieza != hoy_str:
        _alertas_almuerzo_enviadas.clear()
        _alertas_atraso_enviadas.clear()
        _ultimo_dia_limpieza = hoy_str

    conn = get_db_connection()
    if not conn:
        return

    try:
        cur = conn.cursor(dictionary=True)

        # 1. Obtener todas las visitas programadas para hoy
        cur.execute("""
            SELECT id_visita, contrato, cliente, sector, tecnico_principal, 
                   tecnico_apoyo, preferencia_horaria, estado, problema, 
                   ventana_inicio_min, ventana_fin_min
            FROM visitas_tecnicas
            WHERE fecha_programada = %s
        """, (hoy_str,))
        visitas_hoy = cur.fetchall()

        # Agrupar por técnico principal
        visitas_por_tecnico = {}
        for v in visitas_hoy:
            tech = (v.get('tecnico_principal') or '').strip().upper()
            if not tech or tech in ['NO TECNICO', 'SIN ASIGNAR', 'AUTO', 'TECNOLOGIA']:
                continue
            if tech not in visitas_por_tecnico:
                visitas_por_tecnico[tech] = []
            visitas_por_tecnico[tech].append(v)

        # ---------------------------------------------------------------------
        # REGLA 1: Monitoreo Autónomo de Almuerzo (5 minutos antes de terminar)
        # ---------------------------------------------------------------------
        for tech, v_list in visitas_por_tecnico.items():
            cache_key = f"{tech}_{hoy_str}"
            if cache_key in _alertas_almuerzo_enviadas:
                continue

            parsed_list = []
            for v in v_list:
                s_min, e_min = _parsear_rango_horario(v.get('preferencia_horaria'))
                if s_min is None and v.get('ventana_inicio_min'):
                    s_min = v['ventana_inicio_min']
                    e_min = v.get('ventana_fin_min') or (s_min + 90)
                if s_min is not None:
                    parsed_list.append({
                        'startMin': s_min,
                        'endMin': e_min or (s_min + 90),
                        'visita': v
                    })

            if not parsed_list:
                continue

            parsed_list.sort(key=lambda x: x['startMin'])
            earliest_start = parsed_list[0]['startMin']

            # Si entra a las 12:00 o más tarde (ej. Milton Bermeo): viene almorzado
            if earliest_start >= 12 * 60:
                continue

            # Buscar última visita de la mañana (antes de las 14:00)
            morning_visits = [x for x in parsed_list if x['startMin'] < 14 * 60]
            if not morning_visits:
                continue

            last_morning = morning_visits[-1]
            lunch_start_min = last_morning['endMin']
            if lunch_start_min < 11 * 60 + 30:
                lunch_start_min = 12 * 60 + 30

            lunch_end_min = lunch_start_min + 60

            # ¿Estamos en la ventana de aviso: faltan entre 5 y 0 minutos para terminar?
            if (lunch_end_min - 5) <= ahora_min <= lunch_end_min:
                # Buscar siguiente visita
                proxima = None
                for x in parsed_list:
                    if x['startMin'] >= lunch_end_min - 15:
                        proxima = x['visita']
                        break

                prox_str = ""
                if proxima:
                    c_num = proxima.get('contrato') or 'S/C'
                    c_nom = proxima.get('cliente') or 'Cliente'
                    c_sec = proxima.get('sector') or 'Sin sector'
                    c_hor = proxima.get('preferencia_horaria') or 'Tarde'
                    prox_str = (
                        f"\n📍 *Próxima Visita Programada:*\n"
                        f"   • *Cliente:* {c_nom}\n"
                        f"   • *Contrato:* #{c_num}\n"
                        f"   • *Sector:* {c_sec}\n"
                        f"   • *Horario:* {c_hor}\n"
                    )
                else:
                    prox_str = "\n📍 *Sin visitas posteriores programadas para la tarde.*"

                h_ini_str = _formato_hhmm(lunch_start_min)
                h_fin_str = _formato_hhmm(lunch_end_min)

                msg = (
                    f"🍽️ *RECORDATORIO DE ALMUERZO - OPERACIONES*\n\n"
                    f"🛠️ *Técnico:* {tech}\n"
                    f"⏰ *Franja de Almuerzo:* {h_ini_str} - {h_fin_str} (1 hora)\n"
                    f"⏳ *Aviso:* Faltan *5 minutos* para finalizar la hora de almuerzo y retomar ruta.\n"
                    f"{prox_str}\n"
                    f"_Notificación automática del Centro de Comando Futurity_"
                )

                if _enviar_mensaje_telegram(msg):
                    print(f"[TelegramMonitor] Alerta de almuerzo enviada exitosamente para {tech}")
                    _alertas_almuerzo_enviadas.add(cache_key)

        # ---------------------------------------------------------------------
        # REGLA 2: Monitoreo Autónomo de Atrasos (+15 minutos sobre fin estimado)
        # ---------------------------------------------------------------------
        for v in visitas_hoy:
            v_id = v.get('id_visita')
            if v_id in _alertas_atraso_enviadas:
                continue

            estado = (v.get('estado') or 'PENDIENTE').upper()
            if estado not in ['PENDIENTE', 'ASIGNADA']:
                continue

            tech = (v.get('tecnico_principal') or '').strip().upper()
            if not tech or tech in ['NO TECNICO', 'SIN ASIGNAR', 'AUTO']:
                continue

            s_min, e_min = _parsear_rango_horario(v.get('preferencia_horaria'))
            if s_min is None and v.get('ventana_inicio_min'):
                s_min = v['ventana_inicio_min']
                e_min = v.get('ventana_fin_min') or (s_min + 90)

            if e_min is None:
                continue

            # Si ya pasaron más de 15 minutos de la hora estimada de fin
            if ahora_min >= (e_min + 15):
                retraso_min = ahora_min - e_min
                client = v.get('cliente') or 'Cliente'
                contrato = v.get('contrato') or 'S/C'
                sector = v.get('sector') or 'No indicado'
                problema = v.get('problema') or 'Revisión técnica'
                hor_pref = v.get('preferencia_horaria') or 'Horario no especificado'

                msg = (
                    f"🚨 *ALERTA DE RETRASO EN VISITA TÉCNICA*\n\n"
                    f"👤 *Cliente:* {client}\n"
                    f"📄 *Contrato:* #{contrato}\n"
                    f"📍 *Sector:* {sector}\n"
                    f"🛠️ *Técnico:* {tech}\n"
                    f"⏰ *Horario Estimado:* {hor_pref}\n"
                    f"⏳ *Tiempo de Atraso:* +{retraso_min} min transcurridos\n"
                    f"⚠️ *Problema:* {problema}\n"
                    f"📋 *Estado:* {estado}\n\n"
                    f"_Notificación automática del Centro de Comando Futurity_"
                )

                if _enviar_mensaje_telegram(msg):
                    print(f"[TelegramMonitor] Alerta de retraso enviada para visita #{contrato} ({tech})")
                    _alertas_atraso_enviadas.add(v_id)

        cur.close()
    except Exception as e:
        print(f"[TelegramMonitor] Excepción en ciclo de monitoreo: {e}")
    finally:
        conn.close()

def _bucle_monitor():
    """Bucle infinito que se ejecuta en segundo plano cada 30 segundos."""
    print("[TelegramMonitor] Servicio autónomo de alertas Telegram iniciado.")
    # Esperar 10 segundos al arranque para permitir que Waitress termine de iniciar
    time.sleep(10)
    while True:
        try:
            _monitorear_ciclo()
        except Exception as e:
            print(f"[TelegramMonitor] Error general en worker: {e}")
        time.sleep(30)

def iniciar_monitor_telegram():
    """Arranca el hilo de monitoreo en segundo plano (daemon)."""
    t = threading.Thread(target=_bucle_monitor, name="TelegramAutonomousMonitor", daemon=True)
    t.start()
    return t

