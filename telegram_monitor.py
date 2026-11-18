"""
=============================================================================
FUTURITY ATLAS - MONITOR AUTÓNOMO DE TELEGRAM EN SEGUNDO PLANO
=============================================================================
Este servicio ejecuta un hilo continuo (daemon) cada 20 segundos que monitorea:
1. Alertas de fin de almuerzo (5 minutos antes de terminar, leyendo el bloque
   movible guardado en `cronograma_almuerzos` o el cálculo automático).
2. Alertas de atraso en INICIO (+5 minutos desde la hora programada de inicio
   si la visita sigue PENDIENTE / ASIGNADA sin que el técnico salga o inicie).
3. Alertas de atraso en FINALIZACIÓN (+5 minutos desde la hora estimada de fin
   si la visita sigue abierta en EN_RUTA, EN_SITIO, EN_PROGRESO o PENDIENTE).

Usa formato HTML con escape seguro para garantizar el 100% de entregas.
=============================================================================
"""

import os
import time
import json
import re
import html
import threading
import urllib.request
import urllib.error
from datetime import datetime

from db_config import get_db_connection

TOLERANCIA_ATRASO_MIN = 5
INTERVALO_CICLO_SEG = 20

# Cache en memoria para no duplicar alertas en el mismo día/horario
_alertas_almuerzo_enviadas = set()
_alertas_inicio_enviadas = set()
_alertas_fin_enviadas = set()
_ultimo_dia_limpieza = None


def _esc(val):
    return html.escape(str(val or '').strip())


def _enviar_mensaje_telegram(mensaje_html):
    """Envía un mensaje con formato HTML seguro al grupo de Telegram configurado."""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID_OPERACIONES') or os.environ.get('TELEGRAM_CHAT_ID')

    if not bot_token or not chat_id or not mensaje_html:
        return False

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": mensaje_html,
        "parse_mode": "HTML"
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "FuturityAtlas/2.1"}
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if not data.get('ok', False):
                print(f"[TelegramMonitor] Telegram respondió ok=False: {data}")
            return data.get('ok', False)
    except urllib.error.HTTPError as e:
        body = ''
        try:
            body = e.read().decode('utf-8', errors='ignore')
        except Exception:
            pass
        print(f"[TelegramMonitor] HTTP {e.code} enviando a Telegram: {body}")
        return False
    except Exception as e:
        print(f"[TelegramMonitor] Error enviando mensaje a Telegram: {e}")
        return False


def _parsear_hora_real_min(valor):
    """Convierte timedelta / time / 'HH:MM:SS' / 'YYYY-MM-DD HH:MM:SS' a minutos desde 00:00."""
    if valor is None:
        return None
    if hasattr(valor, 'total_seconds'):
        tot = int(valor.total_seconds())
        if 0 <= tot < 86400:
            return tot // 60
    if hasattr(valor, 'hour') and hasattr(valor, 'minute'):
        return valor.hour * 60 + valor.minute
    s = str(valor).strip()
    m = re.search(r'(\d{1,2}):(\d{2})', s)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mi <= 59:
            return h * 60 + mi
    return None


def _parsear_rango_horario(preferencia_str, ventana_inicio=None, ventana_fin=None):
    """Devuelve (inicio_min, fin_min) alineado con el Gantt del frontend."""
    start_min, end_min = None, None
    has_explicit_range = False

    if preferencia_str:
        raw = str(preferencia_str).lower().strip()
        if 'coordinar' in raw or raw == 'flexible':
            return None, None

        match = re.search(
            r'(\d{1,2})(?:[:hH](\d{2}))?\s*(am|pm)?\s*(?:-|a|hasta|\/)\s*(\d{1,2})(?:[:hH](\d{2}))?\s*(am|pm)?',
            raw
        )
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

            start_min = h1 * 60 + m1
            end_min = h2 * 60 + m2
            has_explicit_range = True
        else:
            single = re.search(r'(\d{1,2})(?:[:hH](\d{2}))?', raw)
            if single:
                h = int(single.group(1))
                m = int(single.group(2)) if single.group(2) else 0
                if ('pm' in raw or 'tarde' in raw) and h < 12:
                    h += 12
                start_min = h * 60 + m
                end_min = start_min + 90
            elif 'mañana' in raw or 'manana' in raw:
                start_min, end_min = 9 * 60, 12 * 60
                has_explicit_range = True
            elif 'tarde' in raw:
                start_min, end_min = 14 * 60, 18 * 60
                has_explicit_range = True

    if not has_explicit_range and ventana_inicio and int(ventana_inicio) > 0:
        start_min = int(ventana_inicio)
        if ventana_fin and int(ventana_fin) > start_min:
            end_min = int(ventana_fin)
        else:
            end_min = start_min + 90

    if start_min is not None and (end_min is None or end_min <= start_min):
        end_min = start_min + 90

    return start_min, end_min


def _formato_hhmm(minutos):
    h = int(minutos) // 60
    m = int(minutos) % 60
    return f"{h:02d}:{m:02d}"


def _monitorear_ciclo():
    """Ejecuta una pasada de verificación de almuerzos y atrasos (tolerancia 5 min)."""
    global _ultimo_dia_limpieza

    ahora = datetime.now()
    hoy_str = ahora.strftime('%Y-%m-%d')
    ahora_min = ahora.hour * 60 + ahora.minute

    # Limpieza diaria de cachés
    if _ultimo_dia_limpieza != hoy_str:
        _alertas_almuerzo_enviadas.clear()
        _alertas_inicio_enviadas.clear()
        _alertas_fin_enviadas.clear()
        _ultimo_dia_limpieza = hoy_str

    conn = get_db_connection()
    if not conn:
        return

    try:
        cur = conn.cursor(dictionary=True)

        # 1. Cargar almuerzos personalizados (movibles) del día si la tabla existe
        almuerzos_custom = {}
        try:
            cur.execute("""
                SELECT tecnico, inicio_min, fin_min, oculto
                FROM cronograma_almuerzos
                WHERE fecha = %s
            """, (hoy_str,))
            for r in cur.fetchall():
                t_key = (r.get('tecnico') or '').strip().upper()
                if t_key:
                    almuerzos_custom[t_key] = {
                        'inicio_min': int(r['inicio_min']),
                        'fin_min': int(r['fin_min']),
                        'oculto': bool(r['oculto'])
                    }
        except Exception:
            pass

        # 2. Obtener todas las visitas programadas para hoy
        cur.execute("""
            SELECT id_visita, contrato, cliente, sector, tecnico_principal,
                   tecnico_apoyo, preferencia_horaria, estado, problema,
                   ventana_inicio_min, ventana_fin_min,
                   hora_inicio_visita, hora_fin_visita
            FROM visitas_tecnicas
            WHERE fecha_programada = %s
        """, (hoy_str,))
        visitas_hoy = cur.fetchall()

        # Agrupar por técnico principal (excluyendo canceladas/solventadas remotas)
        visitas_por_tecnico = {}
        for v in visitas_hoy:
            estado_u = (v.get('estado') or 'PENDIENTE').strip().upper()
            if estado_u in ('CANCELADA', 'SOLVENTADA_REMOTA', 'REAGENDADA'):
                continue
            tech = (v.get('tecnico_principal') or '').strip().upper()
            if not tech or tech in ('NO TECNICO', 'SIN ASIGNAR', 'AUTO', 'TECNOLOGIA'):
                continue
            visitas_por_tecnico.setdefault(tech, []).append(v)

        # ---------------------------------------------------------------------
        # REGLA 1: Monitoreo Autónomo de Almuerzo (5 minutos antes de terminar)
        # ---------------------------------------------------------------------
        tecnicos_a_revisar = set(visitas_por_tecnico.keys()) | set(almuerzos_custom.keys())
        for tech in tecnicos_a_revisar:
            v_list = visitas_por_tecnico.get(tech, [])
            parsed_list = []
            for v in v_list:
                s_min, e_min = _parsear_rango_horario(
                    v.get('preferencia_horaria'),
                    v.get('ventana_inicio_min'),
                    v.get('ventana_fin_min')
                )
                if s_min is not None:
                    # Si la visita ya finalizó antes, usar hora_fin_visita real
                    if (v.get('estado') or '').strip().upper() == 'FINALIZADA':
                        real_fin = _parsear_hora_real_min(v.get('hora_fin_visita'))
                        if real_fin is not None and real_fin > s_min:
                            e_min = real_fin
                    parsed_list.append({
                        'startMin': s_min,
                        'endMin': e_min,
                        'visita': v
                    })
            parsed_list.sort(key=lambda x: x['startMin'])

            custom = almuerzos_custom.get(tech)
            if custom:
                if custom['oculto']:
                    continue
                lunch_start_min = custom['inicio_min']
                lunch_end_min = custom['fin_min']
            else:
                if not parsed_list:
                    continue
                earliest_start = parsed_list[0]['startMin']
                if earliest_start >= 12 * 60:
                    continue
                morning_visits = [x for x in parsed_list if x['startMin'] < 14 * 60]
                if not morning_visits:
                    continue
                lunch_start_min = morning_visits[-1]['endMin']
                if lunch_start_min < 11 * 60 + 30:
                    lunch_start_min = 12 * 60 + 30
                lunch_end_min = lunch_start_min + 60

            cache_key = f"{tech}_{hoy_str}_{lunch_end_min}"
            if cache_key in _alertas_almuerzo_enviadas:
                continue

            # Ventana de aviso: entre 5 y 0 minutos antes de terminar el almuerzo
            if (lunch_end_min - 5) <= ahora_min <= lunch_end_min:
                proxima = None
                for x in parsed_list:
                    if x['startMin'] >= lunch_end_min - 15:
                        proxima = x['visita']
                        break

                if proxima:
                    prox_str = (
                        f"\n📍 <b>Próxima Visita Programada:</b>\n"
                        f"   • <b>Cliente:</b> {_esc(proxima.get('cliente') or 'Cliente')}\n"
                        f"   • <b>Contrato:</b> #{_esc(proxima.get('contrato') or 'S/C')}\n"
                        f"   • <b>Sector:</b> {_esc(proxima.get('sector') or 'Sin sector')}\n"
                        f"   • <b>Horario:</b> {_esc(proxima.get('preferencia_horaria') or 'Tarde')}\n"
                    )
                else:
                    prox_str = "\n📍 <b>Sin visitas posteriores programadas para la tarde.</b>"

                h_ini_str = _formato_hhmm(lunch_start_min)
                h_fin_str = _formato_hhmm(lunch_end_min)
                faltan = max(0, lunch_end_min - ahora_min)
                aviso_txt = f"Faltan <b>{faltan} minutos</b>" if faltan > 0 else "<b>Finalizó el horario de almuerzo</b>"

                msg = (
                    f"🍽️ <b>RECORDATORIO DE ALMUERZO - OPERACIONES</b>\n\n"
                    f"🛠️ <b>Técnico:</b> {_esc(tech)}\n"
                    f"⏰ <b>Franja de Almuerzo:</b> {h_ini_str} - {h_fin_str}\n"
                    f"⏳ <b>Aviso:</b> {aviso_txt} para retomar ruta.\n"
                    f"{prox_str}\n"
                    f"<i>Notificación automática del Centro de Comando Futurity</i>"
                )

                if _enviar_mensaje_telegram(msg):
                    print(f"[TelegramMonitor] Alerta de almuerzo enviada para {tech} ({h_ini_str}-{h_fin_str})")
                    _alertas_almuerzo_enviadas.add(cache_key)

        # ---------------------------------------------------------------------
        # REGLA 2: Atrasos en INICIO (+5 min) y FINALIZACIÓN (+5 min)
        # ---------------------------------------------------------------------
        for v in visitas_hoy:
            v_id = v.get('id_visita')
            estado = (v.get('estado') or 'PENDIENTE').strip().upper()
            if estado in ('FINALIZADA', 'CANCELADA', 'REAGENDADA', 'SOLVENTADA_REMOTA'):
                continue

            tech = (v.get('tecnico_principal') or '').strip().upper()
            if not tech or tech in ('NO TECNICO', 'SIN ASIGNAR', 'AUTO', 'TECNOLOGIA'):
                continue

            s_min, e_min = _parsear_rango_horario(
                v.get('preferencia_horaria'),
                v.get('ventana_inicio_min'),
                v.get('ventana_fin_min')
            )
            if s_min is None or e_min is None:
                continue

            client = _esc(v.get('cliente') or 'Cliente')
            contrato = _esc(v.get('contrato') or 'S/C')
            sector = _esc(v.get('sector') or 'No indicado')
            problema = _esc(v.get('problema') or 'Revisión técnica')
            hor_pref = _esc(v.get('preferencia_horaria') or f"{_formato_hhmm(s_min)} - {_formato_hhmm(e_min)}")

            # 2A) Atraso en INICIO (+5 min desde hora de inicio estando aún PENDIENTE / ASIGNADA)
            if estado in ('PENDIENTE', 'ASIGNADA') and ahora_min >= (s_min + TOLERANCIA_ATRASO_MIN):
                key_ini = f"inicio_{v_id}_{s_min}"
                if key_ini not in _alertas_inicio_enviadas:
                    retraso_ini = ahora_min - s_min
                    msg = (
                        f"🚨 <b>ALERTA DE ATRASO EN INICIO (+{retraso_ini} min)</b>\n\n"
                        f"👤 <b>Cliente:</b> {client}\n"
                        f"📄 <b>Contrato:</b> #{contrato}\n"
                        f"📍 <b>Sector:</b> {sector}\n"
                        f"🛠️ <b>Técnico:</b> {_esc(tech)}\n"
                        f"⏰ <b>Horario Programado:</b> {hor_pref}\n"
                        f"⏳ <b>Atraso de inicio:</b> +{retraso_ini} min sin marcar En Ruta / Inicio\n"
                        f"⚠️ <b>Problema:</b> {problema}\n"
                        f"📋 <b>Estado actual:</b> {_esc(estado)}\n\n"
                        f"<i>Notificación automática del Centro de Comando Futurity</i>"
                    )
                    if _enviar_mensaje_telegram(msg):
                        print(f"[TelegramMonitor] Alerta INICIO (+{retraso_ini}m) enviada para #{contrato} ({tech})")
                        _alertas_inicio_enviadas.add(key_ini)

            # 2B) Atraso en FINALIZACIÓN (+5 min desde hora estimada de fin estando aún abierta)
            if estado in ('EN_RUTA', 'EN_SITIO', 'EN_PROGRESO', 'PENDIENTE', 'ASIGNADA') and ahora_min >= (e_min + TOLERANCIA_ATRASO_MIN):
                key_fin = f"fin_{v_id}_{e_min}"
                if key_fin not in _alertas_fin_enviadas:
                    retraso_fin = ahora_min - e_min
                    msg = (
                        f"⏰ <b>ALERTA DE ATRASO EN FINALIZACIÓN (+{retraso_fin} min)</b>\n\n"
                        f"👤 <b>Cliente:</b> {client}\n"
                        f"📄 <b>Contrato:</b> #{contrato}\n"
                        f"📍 <b>Sector:</b> {sector}\n"
                        f"🛠️ <b>Técnico:</b> {_esc(tech)}\n"
                        f"⏰ <b>Horario Estimado:</b> {hor_pref}\n"
                        f"⏳ <b>Exceso sobre hora fin:</b> +{retraso_fin} min sin finalizar\n"
                        f"⚠️ <b>Problema:</b> {problema}\n"
                        f"📋 <b>Estado actual:</b> {_esc(estado)}\n\n"
                        f"<i>Si la visita requiere más tiempo, extiéndela en el Cronograma.</i>"
                    )
                    if _enviar_mensaje_telegram(msg):
                        print(f"[TelegramMonitor] Alerta FIN (+{retraso_fin}m) enviada para #{contrato} ({tech})")
                        _alertas_fin_enviadas.add(key_fin)

        cur.close()
    except Exception as e:
        print(f"[TelegramMonitor] Excepción en ciclo de monitoreo: {e}")
    finally:
        conn.close()


def _bucle_monitor():
    """Bucle infinito que se ejecuta en segundo plano cada 20 segundos."""
    print(f"[TelegramMonitor] Servicio autónomo iniciado (tolerancia: {TOLERANCIA_ATRASO_MIN} min, ciclo: {INTERVALO_CICLO_SEG}s).")
    time.sleep(8)
    while True:
        try:
            _monitorear_ciclo()
        except Exception as e:
            print(f"[TelegramMonitor] Error general en worker: {e}")
        time.sleep(INTERVALO_CICLO_SEG)


def iniciar_monitor_telegram():
    """Arranca el hilo de monitoreo en segundo plano (daemon)."""
    t = threading.Thread(target=_bucle_monitor, name="TelegramAutonomousMonitor", daemon=True)
    t.start()
    return t
