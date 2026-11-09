"""
=============================================================================
FUTURITY ATLAS - SINCRONIZADOR EN SEGUNDO PLANO CON BASE CENTRAL ISP
=============================================================================
Este worker sincroniza los clientes y contratos desde la Base Central 
(192.168.232.5:85) hacia la tabla local `directorio_clientes`.

Reglas de negocio implementadas:
1. Nomenclaturas estrictas:
   - Sufijos independientes ('D', 'I', etc. ej: '128D'): se respetan intactos.
   - Sufijo 'F' (FIBRACOM): detección inteligente por IP de nodo maestro,
     zona geográfica o sufijo explícito.
   - Sin sufijo: SERVICABLE.
2. Una cédula = Múltiples contratos:
   - Al consultar una cédula, itera sobre todos los contratos en 'infocontratos'.
   - Cada contrato se inserta o actualiza individualmente con ON DUPLICATE KEY.
3. Concatenación de servicios:
   - Une todos los servicios del contrato ('Internet 500M + TV + etc.')
   - Extrae la velocidad real en Mbps del plan.
4. Estrategia Diurna vs. Nocturna:
   - Diurno (08:00 a 18:00): Micro-bloques de 35-50 clientes cada 10-15 min,
     priorizando clientes con visitas técnicas agendadas hoy.
   - Nocturno (02:00 AM): Barrido completo del 100% de la base local.
5. Pausas protectoras: 0.2s entre peticiones para no saturar la red local.
=============================================================================
"""

import sys
import os
import time
import json
import re
import argparse
import urllib.request
import urllib.error
from datetime import datetime, date, timedelta

# Asegurar path actual para importar módulos del proyecto
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db_config import get_db_connection
from utils import MAPEO_NODOS

# Configuración de la API Central
API_CENTRAL_URL = "http://192.168.232.5:85/api/contratosclientes"
TIMEOUT_API_SEG = 8
PAUSA_ENTRE_CONSULTAS_SEG = 0.25
PAUSA_BLOQUE_DIURNO_SEG = 600  # 10 minutos entre bloques durante el día
CANTIDAD_LOTE_DIURNO = 40
HORA_BARRIDO_NOCTURNO = 2  # 02:00 AM

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_clientes.log")

def registrar_log(mensaje):
    """Escribe un mensaje con marca de tiempo en consola y archivo de log."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linea = f"[{ts}] {mensaje}"
    print(linea)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(linea + "\n")
    except Exception:
        pass

def normalizar_telefono_ec(tel):
    if not tel:
        return ""
    t = str(tel).strip()
    if t.endswith('.0') or t.endswith(',0'):
        t = t[:-2]
    t = re.sub(r'[^\d]', '', t)
    if t.startswith('593') and len(t) == 12:
        t = '0' + t[3:]
    return t

def extraer_velocidad_mbps(servicios_str):
    if not servicios_str:
        return None
    m_act = re.search(r'VELOCIDAD\s+ACTUAL\s+(\d+)', servicios_str, re.IGNORECASE)
    if m_act:
        try:
            return int(m_act.group(1))
        except Exception:
            pass
    m = re.search(r'(\d+)\s*(?:MEGAS|MB)', servicios_str, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    return None

def extraer_servicios_concatenados(detalles):
    if not detalles:
        return ''
    if isinstance(detalles, str):
        return detalles.strip()
    if isinstance(detalles, dict):
        detalles = [detalles]
    if not isinstance(detalles, list):
        return ''
    servs = []
    for d in detalles:
        if isinstance(d, dict):
            s = d.get('servicios') or d.get('servicio') or d.get('descripcion') or d.get('nombre') or d.get('producto') or ''
            s = str(s).strip()
            if s and s not in servs:
                servs.append(s)
        elif isinstance(d, str):
            s = d.strip()
            if s and s not in servs:
                servs.append(s)
    return " + ".join(servs)

def es_contrato_fibracom(num_contrato, ip_maestro='', nombre_zona='', conn=None, cedula=''):
    """
    Determina si un contrato pertenece a FIBRACOM o SERVICABLE
    respetando el registro local y las IPs/zonas de Fibracom.
    """
    if num_contrato and str(num_contrato).strip().upper().endswith('F'):
        return True
        
    num_clean = re.sub(r'[^0-9a-zA-Z]', '', str(num_contrato).strip())
    num_plain = num_clean[:-1] if num_clean.upper().endswith('F') else num_clean
    num_with_f = num_plain + 'F'

    # 1. Chequeo en base local
    if conn:
        try:
            cur = conn.cursor(dictionary=True)
            if cedula:
                cur.execute("""
                    SELECT contrato, empresa FROM directorio_clientes 
                    WHERE cedula = %s AND (contrato = %s OR contrato = %s)
                    LIMIT 1
                """, (cedula, num_plain, num_with_f))
                row_cli = cur.fetchone()
                if row_cli:
                    emp = (row_cli.get('empresa') or '').upper()
                    cur.close()
                    if emp == 'SERVICABLE':
                        return False
                    if emp == 'FIBRACOM' or row_cli['contrato'].upper().endswith('F'):
                        return True

            cur.execute("""
                SELECT contrato, empresa, cedula FROM directorio_clientes 
                WHERE contrato = %s
                LIMIT 1
            """, (num_plain,))
            row_exact = cur.fetchone()
            if row_exact:
                emp = (row_exact.get('empresa') or '').upper()
                if not cedula or not row_exact.get('cedula') or str(row_exact.get('cedula')).strip() == str(cedula).strip():
                    cur.close()
                    if emp == 'SERVICABLE':
                        return False
                    elif emp == 'FIBRACOM':
                        return True

            if cedula:
                cur.execute("""
                    SELECT contrato, empresa FROM directorio_clientes 
                    WHERE contrato = %s AND cedula = %s
                    LIMIT 1
                """, (num_with_f, cedula))
                row_f = cur.fetchone()
                if row_f and ((row_f.get('empresa') or '').upper() == 'FIBRACOM' or row_f['contrato'].upper().endswith('F')):
                    cur.close()
                    return True

            cur.close()
        except Exception:
            pass

    # 2. Detección por IP del Nodo Maestro
    ip = str(ip_maestro or '').strip()
    if ip in ('100.64.21.2', '10.64.20.2', '100.64.20.2') or ip.startswith('100.64.') or ip.startswith('10.64.'):
        return True

    # 3. Detección por Zona geográfica
    zona = str(nombre_zona or '').upper()
    if any(z in zona for z in ['SANTA ANA', 'VALLE', 'EL VALLE']):
        return True

    return False

def asegurar_columna_sincronizacion(conn):
    """Verifica y crea la columna ultima_actualizacion_api en directorio_clientes si no existe."""
    try:
        cur = conn.cursor()
        cur.execute("""
            ALTER TABLE directorio_clientes 
            ADD COLUMN ultima_actualizacion_api DATETIME NULL DEFAULT NULL
        """)
        conn.commit()
        cur.close()
        registrar_log("Columna 'ultima_actualizacion_api' creada exitosamente en directorio_clientes.")
    except Exception:
        # Ya existe la columna o MySQL no permitió la alteración duplicada
        pass

def consultar_api_central(cedula):
    """Consulta la API de la Base Central por cédula/código."""
    cedula_clean = re.sub(r'[^a-zA-Z0-9]', '', str(cedula or '').strip())
    if not cedula_clean or len(cedula_clean) < 3:
        return {"status": "error", "message": "Cédula o código inválido"}

    url = f"{API_CENTRAL_URL}?codigo={cedula_clean}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Futurity-SyncWorker/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_API_SEG) as response:
            raw_data = response.read().decode('utf-8')
            data = json.loads(raw_data)
            return {"status": "ok", "data": data}
    except urllib.error.HTTPError as e:
        return {"status": "not_found", "message": f"HTTP {e.code}: No encontrado"}
    except urllib.error.URLError as e:
        return {"status": "connection_error", "message": f"Conexión fallida: {e.reason}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def sincronizar_cliente_cedula(conn, cedula):
    """
    Sincroniza todos los contratos asociados a una cédula.
    Respeta nomenclaturas (F, D, etc.) e inserta/actualiza cada contrato.
    """
    res = consultar_api_central(cedula)
    cur = conn.cursor(dictionary=True)

    if res.get('status') != 'ok':
        # Marcar la cédula como revisada para que la cola rote y no se atasque
        try:
            cur.execute("""
                UPDATE directorio_clientes 
                SET ultima_actualizacion_api = NOW() 
                WHERE cedula = %s
            """, (cedula,))
            conn.commit()
        except Exception:
            pass
        finally:
            cur.close()
        return 0, res.get('message', 'Error')

    data = res.get('data') or {}
    cliente_nombres = (data.get('nombres') or '').strip()
    cliente_cedula = (data.get('cedula') or cedula).strip()
    infocontratos = data.get('infocontratos') or []

    if not infocontratos:
        # Sin contratos en la API
        try:
            cur.execute("""
                UPDATE directorio_clientes 
                SET ultima_actualizacion_api = NOW() 
                WHERE cedula = %s
            """, (cliente_cedula,))
            conn.commit()
        except Exception:
            pass
        finally:
            cur.close()
        return 0, "Sin contratos reportados en API central"

    contratos_actualizados = 0

    try:
        for c_item in infocontratos:
            raw_num = str(c_item.get('numerocontrato') or '').strip()
            if not raw_num:
                continue

            ip_nodo = c_item.get('ipmaestro') or ''
            nombre_zona = c_item.get('nombrezona') or ''

            # Determinar si es Fibracom
            is_fib = es_contrato_fibracom(
                num_contrato=raw_num,
                ip_maestro=ip_nodo,
                nombre_zona=nombre_zona,
                conn=conn,
                cedula=cliente_cedula
            )

            # Conservar sufijos especiales como 'D' o 'I' intactos. Solo 'F' se normaliza
            if is_fib:
                raw_num_plain = raw_num[:-1] if raw_num.upper().endswith('F') else raw_num
                contrato_atlas = raw_num_plain + 'F'
                empresa_atlas = 'FIBRACOM'
            else:
                contrato_atlas = raw_num
                empresa_atlas = 'SERVICABLE'

            tel_raw = c_item.get('telefonolocal') or ''
            tel_clean = normalizar_telefono_ec(tel_raw)

            # Concatenar todos los servicios del contrato
            detalles = c_item.get('detalles') or []
            servicios = extraer_servicios_concatenados(detalles)
            if not servicios:
                servicios = str(c_item.get('servicios') or c_item.get('servicio') or c_item.get('producto') or '').strip()
            
            vel_mbps = extraer_velocidad_mbps(servicios)

            # Si es Fibracom y existía un registro previo sin 'F' para esta cédula (ej: '458'), rescatar equipos antes
            sn_rescatada = None
            ont_rescatada = None
            if is_fib:
                raw_plain = raw_num[:-1] if raw_num.upper().endswith('F') else raw_num
                if raw_plain != contrato_atlas:
                    cur.execute("""
                        SELECT numero_serie, modelo_ont FROM directorio_clientes 
                        WHERE contrato = %s AND cedula = %s LIMIT 1
                    """, (raw_plain, cliente_cedula))
                    r_old = cur.fetchone()
                    if r_old:
                        sn_rescatada = r_old.get('numero_serie')
                        ont_rescatada = r_old.get('modelo_ont')
                        cur.execute("""
                            DELETE FROM directorio_clientes 
                            WHERE contrato = %s AND cedula = %s AND empresa != 'FIBRACOM'
                        """, (raw_plain, cliente_cedula))

            # Insertar o actualizar contrato (ON DUPLICATE KEY UPDATE NUNCA toca numero_serie ni equipos)
            query = """
                INSERT INTO directorio_clientes (
                    contrato, empresa, producto, estado, forma_pago,
                    nombre_cliente, direccion, zona, telefono1, total_mensual,
                    cedula, velocidad_mbps, ip_cliente, ip_nodo,
                    numero_serie, modelo_ont, ultima_actualizacion_api
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, NOW()
                )
                ON DUPLICATE KEY UPDATE
                    empresa = VALUES(empresa),
                    nombre_cliente = VALUES(nombre_cliente),
                    cedula = VALUES(cedula),
                    direccion = COALESCE(NULLIF(VALUES(direccion), ''), direccion),
                    zona = COALESCE(NULLIF(VALUES(zona), ''), zona),
                    telefono1 = COALESCE(NULLIF(VALUES(telefono1), ''), telefono1),
                    total_mensual = VALUES(total_mensual),
                    estado = VALUES(estado),
                    producto = VALUES(producto),
                    ip_cliente = VALUES(ip_cliente),
                    ip_nodo = VALUES(ip_nodo),
                    velocidad_mbps = COALESCE(VALUES(velocidad_mbps), velocidad_mbps),
                    numero_serie = COALESCE(NULLIF(numero_serie, ''), VALUES(numero_serie), 'S/N'),
                    modelo_ont = COALESCE(NULLIF(modelo_ont, ''), VALUES(modelo_ont)),
                    ultima_actualizacion_api = NOW()
            """
            cur.execute(query, (
                contrato_atlas,
                empresa_atlas,
                servicios,
                c_item.get('estadoContrato', 'ACTIVO'),
                'N/D',
                cliente_nombres,
                c_item.get('direccionlocal', ''),
                nombre_zona,
                tel_clean,
                c_item.get('valormensual'),
                cliente_cedula,
                vel_mbps,
                c_item.get('ipcliente', ''),
                ip_nodo,
                sn_rescatada,
                ont_rescatada
            ))
            contratos_actualizados += 1

        # También marcar cualquier otro contrato existente localmente con esta misma cédula
        cur.execute("""
            UPDATE directorio_clientes 
            SET ultima_actualizacion_api = NOW() 
            WHERE cedula = %s
        """, (cliente_cedula,))

        conn.commit()
        return contratos_actualizados, "OK"

    except Exception as e:
        conn.rollback()
        return 0, f"Error SQL: {str(e)}"
    finally:
        cur.close()

def obtener_cedulas_prioridad_diurna(conn, limite=CANTIDAD_LOTE_DIURNO):
    """
    Obtiene el lote de cédulas a sincronizar en horario diurno:
    1. Prioridad: Cédulas con visitas técnicas agendadas hoy.
    2. Rotación: Cédulas con más tiempo sin sincronizar.
    """
    cedulas = []
    cur = conn.cursor(dictionary=True)
    try:
        # 1. Visitas técnicas de hoy
        sql_visitas = """
            SELECT DISTINCT d.cedula 
            FROM visitas_tecnicas v
            JOIN directorio_clientes d ON (v.contrato = d.contrato OR (v.cliente = d.nombre_cliente AND d.cedula IS NOT NULL AND d.cedula != ''))
            WHERE DATE(v.fecha_programada) = CURDATE()
              AND d.cedula IS NOT NULL AND TRIM(d.cedula) != ''
              AND (d.ultima_actualizacion_api IS NULL OR d.ultima_actualizacion_api < NOW() - INTERVAL 2 HOUR)
            LIMIT 15
        """
        cur.execute(sql_visitas)
        for r in cur.fetchall():
            c = (r.get('cedula') or '').strip()
            if c and c not in cedulas:
                cedulas.append(c)

        # 2. Rellenar con clientes que lleven más tiempo sin actualizarse
        restantes = max(0, limite - len(cedulas))
        if restantes > 0:
            sql_rotacion = """
                SELECT cedula, MAX(ultima_actualizacion_api) AS ultima_sync
                FROM directorio_clientes 
                WHERE cedula IS NOT NULL AND TRIM(cedula) != '' AND LENGTH(TRIM(cedula)) >= 3
                GROUP BY cedula
                ORDER BY (ultima_sync IS NULL) DESC, ultima_sync ASC 
                LIMIT %s
            """
            cur.execute(sql_rotacion, (restantes,))
            for r in cur.fetchall():
                c = (r.get('cedula') or '').strip()
                if c and c not in cedulas:
                    cedulas.append(c)

    except Exception as e:
        registrar_log(f"Error al obtener cédulas para sincronizar: {e}")
    finally:
        cur.close()

    return cedulas

def obtener_todas_las_cedulas(conn):
    """Obtiene el 100% de cédulas únicas para el barrido nocturno."""
    cedulas = []
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT cedula 
            FROM directorio_clientes 
            WHERE cedula IS NOT NULL AND TRIM(cedula) != '' AND LENGTH(TRIM(cedula)) >= 3
            GROUP BY cedula
            ORDER BY cedula ASC
        """)
        for r in cur.fetchall():
            c = (r.get('cedula') or '').strip()
            if c and c not in cedulas:
                cedulas.append(c)
    except Exception as e:
        registrar_log(f"Error al obtener todas las cédulas: {e}")
    finally:
        cur.close()
    return cedulas

def ejecutar_bloque(conn, lista_cedulas, descripcion="Bloque"):
    """Recorre una lista de cédulas y sincroniza sus contratos con pausas seguras."""
    total = len(lista_cedulas)
    if total == 0:
        registrar_log(f"[{descripcion}] No hay cédulas pendientes por sincronizar.")
        return 0, 0

    registrar_log(f"[{descripcion}] Iniciando sincronización de {total} clientes...")
    exitos = 0
    contratos_totales = 0
    errores = 0

    for idx, cedula in enumerate(lista_cedulas, 1):
        try:
            n_contratos, detalle = sincronizar_cliente_cedula(conn, cedula)
            if n_contratos > 0:
                exitos += 1
                contratos_totales += n_contratos
            else:
                # No se encontraron contratos o error menor
                if "OK" not in detalle and "Sin contratos" not in detalle:
                    errores += 1
        except Exception as e:
            registrar_log(f"Excepción procesando cédula {cedula}: {e}")
            errores += 1

        # Pausa para proteger la red local y no saturar la API central
        time.sleep(PAUSA_ENTRE_CONSULTAS_SEG)

        # Log de avance cada 25 clientes en barridos largos
        if idx % 25 == 0 or idx == total:
            registrar_log(f"[{descripcion}] Progreso: {idx}/{total} cédulas ({contratos_totales} contratos actualizados)")

    registrar_log(f"[{descripcion}] Finalizado. Clientes con datos: {exitos}, Contratos totales: {contratos_totales}, Errores/No encontrados: {errores}")
    return exitos, contratos_totales

def main():
    parser = argparse.ArgumentParser(description="Futurity Atlas - Sincronizador de Clientes")
    parser.add_argument('--once', action='store_true', help="Ejecuta un solo bloque diurno y termina.")
    parser.add_argument('--full', action='store_true', help="Ejecuta un barrido completo de toda la base y termina.")
    parser.add_argument('--cedula', type=str, help="Sincroniza una cédula específica y termina.")
    args = parser.parse_args()

    registrar_log("Iniciando servicio de sincronización de clientes Futurity...")
    
    conn = get_db_connection()
    if not conn:
        registrar_log("ERROR CRÍTICO: No se pudo conectar a la base de datos local MySQL.")
        sys.exit(1)

    asegurar_columna_sincronizacion(conn)

    # 1. Modo cédula específica
    if args.cedula:
        ced = args.cedula.strip()
        registrar_log(f"Modo manual: Sincronizando cédula específica '{ced}'...")
        n_c, msg = sincronizar_cliente_cedula(conn, ced)
        registrar_log(f"Resultado cédula {ced}: {n_c} contrato(s) actualizados ({msg})")
        conn.close()
        return

    # 2. Modo barrido completo único
    if args.full:
        registrar_log("Modo manual: Ejecutando barrido completo del 100% de clientes...")
        todas = obtener_todas_las_cedulas(conn)
        ejecutar_bloque(conn, todas, descripcion="Barrido Completo Manual")
        conn.close()
        return

    # 3. Modo un solo bloque diurno
    if args.once:
        registrar_log("Modo manual: Ejecutando un solo bloque diurno...")
        bloque = obtener_cedulas_prioridad_diurna(conn, limite=CANTIDAD_LOTE_DIURNO)
        ejecutar_bloque(conn, bloque, descripcion="Bloque Único")
        conn.close()
        return

    # 4. Modo Demonio / En segundo plano continuo
    registrar_log("Worker en modo continuo activado.")
    registrar_log(f"Horario diurno: Bloques de {CANTIDAD_LOTE_DIURNO} clientes cada {PAUSA_BLOQUE_DIURNO_SEG // 60} minutos.")
    registrar_log(f"Horario nocturno: Barrido completo diario programado a las {HORA_BARRIDO_NOCTURNO:02d}:00 AM.")

    ultimo_dia_barrido = None

    while True:
        try:
            # Asegurar conexión activa a MySQL
            if not conn.is_connected():
                conn = get_db_connection()

            ahora = datetime.now()
            hora_actual = ahora.hour
            dia_actual = ahora.date()

            # Chequeo de barrido nocturno a las 02:00 AM
            if hora_actual == HORA_BARRIDO_NOCTURNO and ultimo_dia_barrido != dia_actual:
                registrar_log(f"=== INICIANDO BARRIDO NOCTURNO AUTOMÁTICO (02:00 AM) ===")
                todas = obtener_todas_las_cedulas(conn)
                ejecutar_bloque(conn, todas, descripcion="Barrido Nocturno")
                ultimo_dia_barrido = dia_actual
                registrar_log(f"=== BARRIDO NOCTURNO COMPLETADO CON ÉXITO ===")
                time.sleep(60)
                continue

            # Modo diurno (07:00 a 19:00)
            if 7 <= hora_actual < 19:
                bloque = obtener_cedulas_prioridad_diurna(conn, limite=CANTIDAD_LOTE_DIURNO)
                if bloque:
                    ejecutar_bloque(conn, bloque, descripcion=f"Lote Diurno {ahora.strftime('%H:%M')}")
                else:
                    registrar_log("No hay clientes que requieran sincronización en este momento.")
                
                # Pausa antes del siguiente bloque
                time.sleep(PAUSA_BLOQUE_DIURNO_SEG)
            else:
                # Fuera de jornada laboral (ej: 19:00 a 02:00 o 03:00 a 07:00), descansar bloques más largos
                time.sleep(1800)  # 30 minutos

        except KeyboardInterrupt:
            registrar_log("Worker detenido manualmente por el usuario.")
            break
        except Exception as e:
            registrar_log(f"Alerta en ciclo principal del worker: {e}. Reintentando en 60s...")
            time.sleep(60)

    if conn and conn.is_connected():
        conn.close()

if __name__ == '__main__':
    main()

