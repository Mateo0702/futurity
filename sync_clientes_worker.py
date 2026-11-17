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
4. Protección total de Equipos:
   - NUNCA sobreescribe ni borra 'numero_serie', 'modelo_ont', routers o mesh.
5. Estrategia Diurna vs. Nocturna:
   - Diurno (07:00 a 19:00): Micro-bloques de 40 clientes cada 10 min,
     priorizando clientes con visitas técnicas agendadas hoy y activos.
   - Nocturno (02:00 AM): Barrido completo del 100% de la base local.
6. Pausas protectoras: 0.25s entre peticiones para no saturar la red local.
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
    respetando el registro técnico (IP OLT), zonas geográficas reales y la cédula,
    evitando falsos positivos por homónimos entre empresas.
    """
    ip = str(ip_maestro or '').strip()
    zona = str(nombre_zona or '').upper()
    num_clean = re.sub(r'[^0-9a-zA-Z]', '', str(num_contrato or '').strip())
    num_plain = num_clean[:-1] if num_clean.upper().endswith('F') else num_clean
    num_with_f = num_plain + 'F'

    # 1. Detección por IP del Nodo Maestro (Criterio técnico primario e infalible)
    if ip in ('100.64.21.2', '10.64.20.2', '100.64.20.2') or ip.startswith('100.64.') or ip.startswith('10.64.'):
        return True

    # 1.b Detección por IP de OLTs de Servicable (Orquídeas, Monay, Baños, etc.)
    if ip in ('10.101.1.50', '10.101.1.18', '10.80.80.134', '10.11.99.1', '10.17.11.6', '10.101.100.10') or ip.startswith('10.101.') or ip.startswith('10.120.') or ip.startswith('10.140.') or ip.startswith('10.150.') or ip.startswith('10.160.') or ip.startswith('10.80.'):
        return False

    # 2. Detección por Zona geográfica exclusiva de Fibracom
    zonas_fibracom = ['SANTA ANA', 'VALLE', 'EL VALLE', 'CHILCAPAMBA', 'SAN BARTOLOME', 'QUINGEO', 'JADAN', 'TARQUI', 'VICTORIA DEL PORTETE']
    if any(z in zona for z in zonas_fibracom):
        return True

    # 3. Zonas urbanas de Servicable: Si la zona es claramente Servicable y la IP no es de Fibracom, es SERVICABLE
    zonas_urbanas_servi = [
        'UNCOVIA', 'MIRAFLORES', 'TOTORACOCHA', 'RICAURTE', 'CENTRO', 'CENTRO CUENCA',
        'BAÑOS', 'MONAY', 'BELLAVISTA', 'YANUNCAY', 'SUCRE', 'HUAYNA CAPAC',
        'EL VECINO', 'MACHANGARA', 'SAN BLAS', 'CAÑARIBAMBA', 'EL PINAR', 'PINAR',
        'ORQUIDEAS', 'ORQ', 'MISICATA', 'GAPAL', 'CAROLINA', 'TOMEBAMBA', 'TRIGALES',
        'KENEDY', 'KENNEDY', 'CHECA', 'CHIQUINTAD', 'SAYAUSI', 'SININCAY'
    ]
    if any(z in zona for z in zonas_urbanas_servi) and not (ip.startswith('100.64.') or ip.startswith('10.64.')):
        return False

    # 4. Si el contrato de origen ya termina con 'F' y no es zona Servicable
    if num_contrato and str(num_contrato).strip().upper().endswith('F'):
        return True

    # 5. Chequeo en base local: EXCLUSIVAMENTE para la MISMA cédula (nunca cruzar contratos de clientes distintos)
    if conn and cedula:
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("""
                SELECT contrato, empresa FROM directorio_clientes 
                WHERE cedula = %s AND (contrato = %s OR contrato = %s)
                ORDER BY (contrato = %s) DESC, (empresa = 'FIBRACOM') DESC
                LIMIT 1
            """, (cedula, num_with_f, num_plain, num_with_f))
            row_cli = cur.fetchone()
            cur.close()
            if row_cli:
                emp = (row_cli.get('empresa') or '').upper()
                if emp == 'FIBRACOM' or row_cli['contrato'].upper().endswith('F'):
                    return True
                if emp == 'SERVICABLE':
                    return False
        except Exception:
            pass

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
        registrar_log("Columna 'ultima_actualizacion_api' lista en directorio_clientes.")
    except Exception:
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
    Respeta nomenclaturas (F, D, etc.) e inserta/actualiza cada contrato
    sin sobreescribir número de serie de ONU ni equipos.
    """
    res = consultar_api_central(cedula)
    cur = conn.cursor(dictionary=True)

    if res.get('status') != 'ok':
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
        # Pre-escaneo: Identificar si hay contratos con sufijo derivado ('D', 'I') para esta cédula
        contratos_con_sufijo = set()
        for c_item in infocontratos:
            num = str(c_item.get('numerocontrato') or '').strip().upper()
            if len(num) > 1 and num[-1] in ('D', 'I') and num[:-1].isdigit():
                contratos_con_sufijo.add(num[:-1])

        for c_item in infocontratos:
            raw_num = str(c_item.get('numerocontrato') or '').strip()
            if not raw_num:
                continue

            # Si este contrato es el base plano sin letra (ej: '299') y el cliente tiene la variante con letra ('299D'),
            # descartarlo y eliminar el registro residual si existiera en BD
            if raw_num.upper() in contratos_con_sufijo:
                cur.execute("""
                    DELETE FROM directorio_clientes
                    WHERE contrato = %s AND cedula = %s
                """, (raw_num, cliente_cedula))
                continue

            ip_nodo = c_item.get('ipmaestro') or ''
            nombre_zona = c_item.get('nombrezona') or ''

            is_fib = es_contrato_fibracom(
                num_contrato=raw_num,
                ip_maestro=ip_nodo,
                nombre_zona=nombre_zona,
                conn=conn,
                cedula=cliente_cedula
            )

            if is_fib:
                raw_num_plain = raw_num[:-1] if raw_num.upper().endswith('F') else raw_num
                contrato_atlas = raw_num_plain + 'F'
                empresa_atlas = 'FIBRACOM'
            else:
                contrato_atlas = raw_num
                empresa_atlas = 'SERVICABLE'

            tel_raw = c_item.get('telefonolocal') or ''
            tel_clean = normalizar_telefono_ec(tel_raw)

            detalles = c_item.get('detalles') or []
            servicios = extraer_servicios_concatenados(detalles)
            if not servicios:
                servicios = str(c_item.get('servicios') or c_item.get('servicio') or c_item.get('producto') or '').strip()
            
            vel_mbps = extraer_velocidad_mbps(servicios)

            # Rescatar equipos si migra de duplicado sin 'F'
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

            # Insertar o actualizar (ON DUPLICATE KEY UPDATE nunca toca ni borra número de serie ni equipos)
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
    Obtiene el lote de cédulas activas a sincronizar en horario diurno:
    1. Prioridad: Cédulas con visitas técnicas agendadas hoy.
    2. Rotación: Cédulas activas con más tiempo sin sincronizar (excluyendo cancelados).
    """
    cedulas = []
    cur = conn.cursor(dictionary=True)
    try:
        sql_visitas = """
            SELECT d.cedula 
            FROM visitas_tecnicas v
            JOIN directorio_clientes d ON (v.contrato = d.contrato OR (v.cliente = d.nombre_cliente AND d.cedula IS NOT NULL AND d.cedula != ''))
            WHERE DATE(v.fecha_programada) = CURDATE()
              AND d.cedula IS NOT NULL AND TRIM(d.cedula) != ''
              AND (d.ultima_actualizacion_api IS NULL OR d.ultima_actualizacion_api < NOW() - INTERVAL 2 HOUR)
            GROUP BY d.cedula
            LIMIT 15
        """
        cur.execute(sql_visitas)
        for r in cur.fetchall():
            c = (r.get('cedula') or '').strip()
            if c and c not in cedulas:
                cedulas.append(c)

        restantes = max(0, limite - len(cedulas))
        if restantes > 0:
            sql_rotacion = """
                SELECT cedula, MAX(ultima_actualizacion_api) AS ultima_sync
                FROM directorio_clientes 
                WHERE cedula IS NOT NULL AND TRIM(cedula) != '' AND LENGTH(TRIM(cedula)) >= 3
                  AND UPPER(COALESCE(estado, '')) NOT IN ('CANCELADO', 'CANCELADA', 'INACTIVO', 'RETIRADO', 'BAJA', 'ANULADO')
                  AND UPPER(COALESCE(estado, '')) NOT LIKE '%CANCEL%'
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
                if "OK" not in detalle and "Sin contratos" not in detalle:
                    errores += 1
        except Exception as e:
            registrar_log(f"Excepción procesando cédula {cedula}: {e}")
            errores += 1

        time.sleep(PAUSA_ENTRE_CONSULTAS_SEG)

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

    if args.cedula:
        ced = args.cedula.strip()
        registrar_log(f"Modo manual: Sincronizando cédula específica '{ced}'...")
        n_c, msg = sincronizar_cliente_cedula(conn, ced)
        registrar_log(f"Resultado cédula {ced}: {n_c} contrato(s) actualizados ({msg})")
        conn.close()
        return

    if args.full:
        registrar_log("Modo manual: Ejecutando barrido completo de clientes...")
        todas = obtener_todas_las_cedulas(conn)
        ejecutar_bloque(conn, todas, descripcion="Barrido Completo Manual")
        conn.close()
        return

    if args.once:
        registrar_log("Modo manual: Ejecutando un solo bloque diurno...")
        bloque = obtener_cedulas_prioridad_diurna(conn, limite=CANTIDAD_LOTE_DIURNO)
        ejecutar_bloque(conn, bloque, descripcion="Bloque Único")
        conn.close()
        return

    registrar_log("Worker en modo continuo activado.")
    registrar_log(f"Horario diurno: Bloques de {CANTIDAD_LOTE_DIURNO} clientes cada {PAUSA_BLOQUE_DIURNO_SEG // 60} minutos.")
    registrar_log(f"Horario nocturno: Barrido completo diario programado a las {HORA_BARRIDO_NOCTURNO:02d}:00 AM.")

    ultimo_dia_barrido = None

    while True:
        try:
            if not conn.is_connected():
                conn = get_db_connection()

            ahora = datetime.now()
            hora_actual = ahora.hour
            dia_actual = ahora.date()

            # Barrido nocturno a las 02:00 AM
            if hora_actual == HORA_BARRIDO_NOCTURNO and ultimo_dia_barrido != dia_actual:
                registrar_log(f"=== INICIANDO BARRIDO NOCTURNO AUTOMÁTICO (02:00 AM) ===")
                todas = obtener_todas_las_cedulas(conn)
                ejecutar_bloque(conn, todas, descripcion="Barrido Nocturno")
                ultimo_dia_barrido = dia_actual
                registrar_log(f"=== BARRIDO NOCTURNO COMPLETADO CON ÉXITO ===")
                time.sleep(60)
                continue

            # Horario diurno (07:00 a 19:00)
            if 7 <= hora_actual < 19:
                bloque = obtener_cedulas_prioridad_diurna(conn, limite=CANTIDAD_LOTE_DIURNO)
                if bloque:
                    ejecutar_bloque(conn, bloque, descripcion=f"Lote Diurno {ahora.strftime('%H:%M')}")
                else:
                    registrar_log("No hay clientes que requieran sincronización en este momento.")
                
                time.sleep(PAUSA_BLOQUE_DIURNO_SEG)
            else:
                time.sleep(1800)

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

