from flask import Blueprint, request, jsonify, session
from datetime import datetime, date, timedelta
from db_config import get_db_connection

atenciones_bp = Blueprint('atenciones', __name__)

@atenciones_bp.route('/api/cliente/buscar_contrato_json', methods=['GET'])
def buscar_contrato_json():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    contrato = request.args.get('contrato', '').strip()
    if not contrato:
        return jsonify({"status": "error", "message": "Contrato vacío"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        # Buscar en directorio_clientes el contrato exacto (con F para Fibracom, sin F para Servicable)
        from utils import format_antiguedad
        query = """
            SELECT nombre_cliente AS cliente, zona AS sector, telefono1, telefono2, fecha_instalacion,
                   total_mensual, antiguedad, numero_serie 
            FROM directorio_clientes 
            WHERE contrato = %s
        """
        cursor.execute(query, (contrato,))
        cliente = cursor.fetchone()
        
        if cliente:
            cliente['antiguedad_fmt'] = format_antiguedad(cliente.get('antiguedad'), cliente.get('fecha_instalacion'))
            cliente['total_mensual'] = float(cliente['total_mensual']) if cliente.get('total_mensual') is not None else None
            cliente['numero_serie'] = cliente.get('numero_serie') or 'S/N'

            # Formatear fecha si existe
            if isinstance(cliente['fecha_instalacion'], (datetime, date)):
                cliente['fecha_instalacion'] = cliente['fecha_instalacion'].isoformat()
            elif isinstance(cliente['fecha_instalacion'], str) and len(cliente['fecha_instalacion']) >= 10:
                cliente['fecha_instalacion'] = cliente['fecha_instalacion'][:10]
            
            # Limpiar formatos flotantes (.0) si existieran
            for k in ['telefono1', 'telefono2']:
                val = cliente[k]
                if val:
                    val_str = str(val).strip()
                    if val_str.endswith('.0') or val_str.endswith(',0'):
                        val_str = val_str[:-2]
                    cliente[k] = val_str

            # Combinar teléfonos de forma limpia
            tels = []
            if cliente['telefono1']: tels.append(cliente['telefono1'])
            if cliente['telefono2']: tels.append(cliente['telefono2'])
            cliente['telefonos'] = ", ".join(tels)
            
            return jsonify({"status": "success", "cliente": cliente})
        else:
            return jsonify({"status": "error", "message": "Cliente no encontrado en el directorio"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/atenciones', methods=['POST'])
def registrar_atencion():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para registrar atenciones."}), 403
        
    # Obtener parámetros del JSON o del formulario
    data = request.get_json() if request.is_json else request.form
    
    contrato = data.get('contrato', '').strip() or None
    cliente = data.get('cliente', '').strip().upper()
    
    if not cliente:
        return jsonify({"status": "error", "message": "El nombre del cliente es obligatorio"}), 400
        
    # Extraer campos
    fecha_val = data.get('fecha') or date.today().isoformat()
    hora_val = data.get('hora') or datetime.now().time().strftime('%H:%M:%S')
    
    try:
        f_dt = datetime.strptime(str(fecha_val), "%Y-%m-%d").date()
        h_tm = datetime.strptime(str(hora_val), "%H:%M:%S").time()
        fecha_hora = datetime.combine(f_dt, h_tm)
    except:
        f_dt = date.today()
        h_tm = datetime.now().time()
        fecha_hora = datetime.now()
        
    fecha_inst_val = data.get('fecha_instalacion') or None
    if fecha_inst_val:
        try:
            fecha_instalacion = datetime.strptime(str(fecha_inst_val), "%Y-%m-%d").date().isoformat()
        except:
            fecha_instalacion = None
    else:
        fecha_instalacion = None
        
    sector = data.get('sector', '').strip().upper() or None
    tipo_atencion = data.get('tipo_atencion', '').strip().upper() or None
    tipo_solicitud = data.get('tipo_solicitud', '').strip().upper() or None
    medio_contacto = data.get('medio_contacto', '').strip().upper() or None
    telefono1 = data.get('telefono1', '').strip() or None
    telefono2 = data.get('telefono2', '').strip() or None
    accion = data.get('accion', '').strip().upper() or None
    motivo = data.get('motivo', '').strip().upper() or None
    
    # El agente responsable es el Call Center logueado
    agente = session.get('user_name', 'Call Center').strip()
    
    observacion = data.get('observacion', '').strip() or None
    olt = data.get('olt', '').strip().upper() or None
    ont = None
    router = None
    
    timer_minutos = None
            
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor()
    try:
        query_insert = """
            INSERT INTO atenciones (
                fecha, hora, fecha_hora, contrato, cliente, fecha_instalacion, 
                sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2, 
                accion, motivo, agente, observacion, olt, ont, router, timer_minutos
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        datos = (
            f_dt.isoformat(), h_tm.isoformat(), fecha_hora.isoformat(), contrato, cliente, fecha_instalacion,
            sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2,
            accion, motivo, agente, observacion, olt, ont, router, timer_minutos
        )
        cursor.execute(query_insert, datos)
        conn.commit()
        
        # Devolver ID y éxito
        id_atencion = cursor.lastrowid
        return jsonify({
            "status": "success", 
            "message": "Atención registrada exitosamente",
            "id_atencion": id_atencion,
            "agente": agente
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/atenciones/recientes', methods=['GET'])
def atenciones_recientes():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver atenciones."}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        agente = session.get('user_name', 'Call Center').strip()
        fecha_req = request.args.get('fecha', '').strip()
        
        if fecha_req:
            query = """
                SELECT id_atencion, fecha, hora, contrato, cliente, sector, tipo_atencion, tipo_solicitud, medio_contacto, accion, motivo, timer_minutos, observacion
                FROM atenciones
                WHERE agente = %s AND fecha = %s
                ORDER BY id_atencion DESC
                LIMIT 50
            """
            cursor.execute(query, (agente, fecha_req))
        else:
            query = """
                SELECT id_atencion, fecha, hora, contrato, cliente, sector, tipo_atencion, tipo_solicitud, medio_contacto, accion, motivo, timer_minutos, observacion
                FROM atenciones
                WHERE agente = %s AND fecha = CURDATE()
                ORDER BY id_atencion DESC
                LIMIT 50
            """
            cursor.execute(query, (agente,))
        atenciones = cursor.fetchall()
        
        for at in atenciones:
            if isinstance(at['fecha'], (datetime, date)):
                at['fecha'] = at['fecha'].isoformat()
            if isinstance(at['hora'], timedelta):
                total_seconds = int(at['hora'].total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                at['hora'] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            elif hasattr(at['hora'], 'strftime'):
                at['hora'] = at['hora'].strftime('%H:%M:%S')
            else:
                at['hora'] = str(at['hora'])
                
        return jsonify({"status": "success", "atenciones": atenciones})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/metricas_atenciones', methods=['GET'])
def metricas_atenciones():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver métricas de atenciones."}), 403

    # Obtener parámetros de filtros (hoy y hace 3 meses por defecto si no se especifican)
    hoy_dt = date.today()
    hace_tres_meses = (hoy_dt - timedelta(days=90)).isoformat()
    hoy_str = hoy_dt.isoformat()

    fecha_inicio = request.args.get('fecha_inicio', hace_tres_meses)
    if not fecha_inicio:
        fecha_inicio = hace_tres_meses
    fecha_fin = request.args.get('fecha_fin', hoy_str)
    if not fecha_fin:
        fecha_fin = hoy_str

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "No se pudo conectar a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        # Cláusula WHERE común
        where_clause = "WHERE fecha >= %s AND fecha <= %s"
        params = [fecha_inicio, fecha_fin]

        # 1. Total atenciones
        query_kpis = f"""
            SELECT COUNT(*) as total_atenciones
            FROM atenciones
            {where_clause}
        """
        cursor.execute(query_kpis, params)
        kpis = cursor.fetchone()
        
        total = kpis['total_atenciones'] or 0
        
        # Obtener el motivo principal (Top 1)
        query_motivo = f"""
            SELECT motivo, COUNT(*) as cantidad
            FROM atenciones
            {where_clause}
              AND motivo IS NOT NULL AND motivo != ''
            GROUP BY motivo
            ORDER BY cantidad DESC
            LIMIT 1
        """
        cursor.execute(query_motivo, params)
        motivo_row = cursor.fetchone()
        motivo_principal = motivo_row['motivo'] if motivo_row else '-'
        
        # 2. Distribución por Medio de Contacto
        query_medios = f"""
            SELECT medio_contacto, COUNT(*) as cantidad
            FROM atenciones
            {where_clause}
              AND medio_contacto IS NOT NULL AND medio_contacto != ''
            GROUP BY medio_contacto
            ORDER BY cantidad DESC
        """
        cursor.execute(query_medios, params)
        medios_raw = cursor.fetchall()
        
        # 3. Distribución por Tipo de Solicitud (Top 5)
        query_solicitudes = f"""
            SELECT tipo_solicitud, COUNT(*) as cantidad
            FROM atenciones
            {where_clause}
              AND tipo_solicitud IS NOT NULL AND tipo_solicitud != ''
            GROUP BY tipo_solicitud
            ORDER BY cantidad DESC
            LIMIT 5
        """
        cursor.execute(query_solicitudes, params)
        solicitudes_raw = cursor.fetchall()
        
        # 4. Distribución por Acción (Top 5)
        query_acciones = f"""
            SELECT accion, COUNT(*) as cantidad
            FROM atenciones
            {where_clause}
              AND accion IS NOT NULL AND accion != ''
            GROUP BY accion
            ORDER BY cantidad DESC
            LIMIT 5
        """
        cursor.execute(query_acciones, params)
        acciones_raw = cursor.fetchall()
        
        # 5. Evolución semanal de atenciones
        query_evolucion = f"""
            SELECT 
                DATE_FORMAT(fecha, '%Y-%u') as semana,
                MIN(fecha) as inicio_semana,
                COUNT(*) as cantidad
            FROM atenciones
            {where_clause}
            GROUP BY semana
            ORDER BY inicio_semana ASC
        """
        cursor.execute(query_evolucion, params)
        evolucion_raw = cursor.fetchall()
        
        evolucion = []
        for row in evolucion_raw:
            fecha_dt = row['inicio_semana']
            fecha_str = fecha_dt.strftime('%d/%m') if isinstance(fecha_dt, (datetime, date)) else str(fecha_dt)
            evolucion.append({
                "label": f"Sem {fecha_str}",
                "cantidad": row['cantidad']
            })
            
        return jsonify({
            "status": "ok",
            "kpis": {
                "total_atenciones": total,
                "motivo_principal": motivo_principal
            },
            "medios": {row['medio_contacto']: row['cantidad'] for row in medios_raw},
            "solicitudes": [{"solicitud": row['tipo_solicitud'], "cantidad": row['cantidad']} for row in solicitudes_raw],
            "acciones": [{"accion": row['accion'], "cantidad": row['cantidad']} for row in acciones_raw],
            "evolucion": evolucion
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/cliente/atenciones_recientes_contrato', methods=['GET'])
def atenciones_recientes_contrato():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    contrato = request.args.get('contrato', '').strip()
    if not contrato:
        return jsonify({"status": "error", "message": "Contrato vacío"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT id_atencion, fecha, hora, tipo_atencion, tipo_solicitud, medio_contacto, accion, motivo, agente, observacion
            FROM atenciones
            WHERE contrato = %s
            ORDER BY fecha_hora DESC, id_atencion DESC
            LIMIT 5
        """
        cursor.execute(query, (contrato,))
        atenciones = cursor.fetchall()
        
        for at in atenciones:
            if isinstance(at['fecha'], (datetime, date)):
                at['fecha'] = at['fecha'].isoformat()
            if isinstance(at['hora'], timedelta):
                total_seconds = int(at['hora'].total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                at['hora'] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            elif hasattr(at['hora'], 'strftime'):
                at['hora'] = at['hora'].strftime('%H:%M:%S')
            else:
                at['hora'] = str(at['hora'])
                
        return jsonify({"status": "success", "atenciones": atenciones})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/atenciones/masivo', methods=['POST'])
def registrar_atenciones_masivo():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para registrar atenciones."}), 403

    data = request.get_json() if request.is_json else request.form
    
    # Extraer lista de contratos (puede ser texto multilínea, delimitado por comas, etc.)
    raw_contratos = data.get('contratos')
    if isinstance(raw_contratos, str):
        import re
        contratos_list = [c.strip() for c in re.split(r'[\r\n,;\s]+', raw_contratos) if c.strip()]
    elif isinstance(raw_contratos, list):
        contratos_list = [str(c).strip() for c in raw_contratos if str(c).strip()]
    else:
        contratos_list = []

    if not contratos_list:
        return jsonify({"status": "error", "message": "No se proporcionó ningún contrato válido para procesar."}), 400

    # Eliminar duplicados manteniendo el orden
    contratos_unicos = []
    seen = set()
    for c in contratos_list:
        if c not in seen:
            seen.add(c)
            contratos_unicos.append(c)

    # Parámetros comunes
    fecha_val = data.get('fecha') or date.today().isoformat()
    hora_val = data.get('hora') or datetime.now().time().strftime('%H:%M:%S')

    try:
        f_dt = datetime.strptime(str(fecha_val), "%Y-%m-%d").date()
        h_tm = datetime.strptime(str(hora_val), "%H:%M:%S").time()
        fecha_hora = datetime.combine(f_dt, h_tm)
    except:
        f_dt = date.today()
        h_tm = datetime.now().time()
        fecha_hora = datetime.now()

    tipo_atencion = (data.get('tipo_atencion') or '').strip().upper() or "SERVICIO TÉCNICO"
    tipo_solicitud = (data.get('tipo_solicitud') or '').strip().upper() or "SOPORTE TÉCNICO"
    medio_contacto = (data.get('medio_contacto') or '').strip().upper() or "WHATSAPP"
    accion = (data.get('accion') or '').strip().upper() or "SOPORTE MEDIANTE MENSAJES"
    motivo = (data.get('motivo') or '').strip().upper() or "VALIDACIÓN DE SC"
    observacion = (data.get('observacion') or '').strip() or None
    olt = (data.get('olt') or '').strip().upper() or None
    agente = session.get('user_name', 'Call Center').strip()

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    no_encontrados = []

    try:
        # Pre-cargar directorio de clientes para los contratos solicitados
        format_strings = ','.join(['%s'] * len(contratos_unicos))
        query_directorio = f"""
            SELECT contrato, nombre_cliente, zona, telefono1, telefono2, fecha_instalacion
            FROM directorio_clientes
            WHERE contrato IN ({format_strings})
        """
        cursor.execute(query_directorio, tuple(contratos_unicos))
        clientes_db = {str(row['contrato']).strip(): row for row in cursor.fetchall()}

        query_insert = """
            INSERT INTO atenciones (
                fecha, hora, fecha_hora, contrato, cliente, fecha_instalacion, 
                sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2, 
                accion, motivo, agente, observacion, olt, ont, router, timer_minutos
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        rows_to_insert = []
        for c in contratos_unicos:
            cliente_info = clientes_db.get(c)
            if cliente_info:
                nombre_cl = (cliente_info['nombre_cliente'] or f"CLIENTE CONTRATO {c}").strip().upper()
                sector_cl = (cliente_info['zona'] or '').strip().upper() or None
                tel1 = (str(cliente_info['telefono1']).strip() if cliente_info['telefono1'] else '').replace('.0', '').replace(',0', '') or None
                tel2 = (str(cliente_info['telefono2']).strip() if cliente_info['telefono2'] else '').replace('.0', '').replace(',0', '') or None
                
                f_inst = cliente_info['fecha_instalacion']
                if isinstance(f_inst, (datetime, date)):
                    f_inst_str = f_inst.isoformat()
                elif isinstance(f_inst, str) and len(f_inst) >= 10:
                    f_inst_str = f_inst[:10]
                else:
                    f_inst_str = None
            else:
                nombre_cl = f"CLIENTE NO ENCONTRADO EN DIRECTORIO (CONTRATO {c})"
                sector_cl = None
                tel1 = None
                tel2 = None
                f_inst_str = None
                no_encontrados.append(c)

            rows_to_insert.append((
                f_dt.isoformat(), h_tm.isoformat(), fecha_hora.isoformat(), c, nombre_cl, f_inst_str,
                sector_cl, tipo_atencion, tipo_solicitud, medio_contacto, tel1, tel2,
                accion, motivo, agente, observacion, olt, None, None, None
            ))

        # Inserción en bloque
        cursor_exec = conn.cursor()
        cursor_exec.executemany(query_insert, rows_to_insert)
        conn.commit()
        registrados = cursor_exec.rowcount
        cursor_exec.close()

        return jsonify({
            "status": "success",
            "message": f"Se registraron {registrados} atenciones exitosamente.",
            "total_procesados": len(contratos_unicos),
            "registrados": registrados,
            "no_encontrados": no_encontrados,
            "agente": agente
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"Error al procesar el lote: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/cliente/buscar_completo_json', methods=['GET'])
def buscar_completo_json():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({"status": "success", "clientes": []})
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        from utils import format_antiguedad
        # Búsqueda parcial por contrato, nombre, teléfono o identificación
        query = """
            SELECT contrato, nombre_cliente AS cliente, zona AS sector, 
                   telefono1, telefono2, telefono3, fecha_instalacion,
                   total_mensual, antiguedad, numero_serie, producto, direccion
            FROM directorio_clientes 
            WHERE contrato LIKE %s 
               OR nombre_cliente LIKE %s 
               OR telefono1 LIKE %s 
               OR telefono2 LIKE %s 
               OR telefono3 LIKE %s
            LIMIT 15
        """
        like_q = f"%{q}%"
        cursor.execute(query, (like_q, like_q, like_q, like_q, like_q))
        rows = cursor.fetchall()
        
        clientes = []
        for row in rows:
            # Formatear fecha
            f_inst = ""
            if isinstance(row['fecha_instalacion'], (datetime, date)):
                f_inst = row['fecha_instalacion'].isoformat()
            elif isinstance(row['fecha_instalacion'], str) and len(row['fecha_instalacion']) >= 10:
                f_inst = row['fecha_instalacion'][:10]
                
            # Limpiar teléfonos
            tels = []
            for k in ['telefono1', 'telefono2', 'telefono3']:
                val = row[k]
                if val:
                    val_str = str(val).strip()
                    if val_str.endswith('.0') or val_str.endswith(',0'):
                        val_str = val_str[:-2]
                    if val_str and val_str not in tels:
                        tels.append(val_str)
            telefonos_str = ", ".join(tels)
            
            clientes.append({
                "contrato": row['contrato'],
                "cliente": row['cliente'],
                "sector": row['sector'] or "N/D",
                "direccion": row['direccion'] or "N/D",
                "telefonos": telefonos_str or "No registrado",
                "fecha_instalacion": f_inst or "N/D",
                "total_mensual": float(row['total_mensual']) if row.get('total_mensual') is not None else None,
                "antiguedad_fmt": format_antiguedad(row.get('antiguedad'), row.get('fecha_instalacion')),
                "numero_serie": row.get('numero_serie') or "S/N",
                "producto": row.get('producto') or "N/D"
            })
            
        return jsonify({"status": "success", "clientes": clientes})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/admin/smartolt/diagnostico/<sn>', methods=['GET'])
def diagnostico_smartolt(sn):
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para consultar diagnóstico"}), 403
        
    import urllib.request
    import ssl
    import json
    
    api_key = "e2b23976ae0649a1a1d767915fd90002"
    dom = "diyer.smartolt.com"
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # 1. Consultar señal
    url_signal = f"https://{dom}/api/onu/get_onu_signal/{sn}"
    req_signal = urllib.request.Request(url_signal)
    req_signal.add_header("X-Token", api_key)
    req_signal.add_header("User-Agent", "FuturityAtlas/1.0")
    
    signal_data = {}
    try:
        with urllib.request.urlopen(req_signal, timeout=6, context=ctx) as resp:
            signal_data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error querying SmartOLT signal for {sn}: {e}")
        
    # 2. Consultar información completa de estado
    url_status = f"https://{dom}/api/onu/get_onu_full_status_info/{sn}"
    req_status = urllib.request.Request(url_status)
    req_status.add_header("X-Token", api_key)
    req_status.add_header("User-Agent", "FuturityAtlas/1.0")
    
    status_data = {}
    try:
        with urllib.request.urlopen(req_status, timeout=6, context=ctx) as resp:
            status_data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error querying SmartOLT full status for {sn}: {e}")
        
    # Verificar si ambas fallaron de manera crítica (por ejemplo, ONU no existe)
    if not signal_data.get("status") and not status_data.get("status"):
        msg = "No se pudo obtener información del equipo de SmartOLT. Verifique el SN."
        return jsonify({"status": "error", "message": msg}), 404
        
    # Procesar y unificar los datos
    full_json = status_data.get("full_status_json", {})
    onu_details = full_json.get("ONU details", {})
    optical_status = full_json.get("Optical status", {})
    wan_interfaces = full_json.get("ONU WAN Interfaces", {})
    
    # Determinar estado
    phase_state = onu_details.get("Phase state", "OffLine")
    if phase_state.lower() == "working":
        status_display = "Online"
    elif phase_state.lower() == "offline":
        status_display = "Offline"
    else:
        status_display = phase_state
        
    # Extraer IP WAN
    ip_wan = "N/D"
    if wan_interfaces:
        for k, v in wan_interfaces.items():
            ip_val = v.get("IPv4 address")
            if ip_val and ip_val != "N/A" and ip_val != "0.0.0.0":
                ip_wan = ip_val
                break
                
    rx_power = "N/D"
    tx_power = "N/D"
    
    if signal_data.get("onu_signal_1490") and signal_data.get("onu_signal_1490") != "-":
        rx_power = signal_data.get("onu_signal_1490")
    elif optical_status.get("ONU Rx") and optical_status.get("ONU Rx") != "N/A(dBm)":
        rx_power = optical_status.get("ONU Rx")
        
    if signal_data.get("onu_signal_1310") and signal_data.get("onu_signal_1310") != "-":
        tx_power = signal_data.get("onu_signal_1310")
    elif optical_status.get("OLT Rx") and optical_status.get("OLT Rx") != "N/A(dBm)":
        tx_power = optical_status.get("OLT Rx")
        
    for p in ['rx_power', 'tx_power']:
        val = locals()[p]
        if val:
            val = val.replace("(dbm)", " dBm").replace("(dBm)", " dBm").replace("(dB)", " dB")
            if p == 'rx_power': rx_power = val
            else: tx_power = val
            
    # Extraer OLT, Tarjeta, Puerto
    olt_name = onu_details.get("Description", "").split("descr_")[0].split("zone_")[-1] if "zone_" in onu_details.get("Description", "") else "KONNEK"
    
    diagnostico = {
        "sn": sn,
        "nombre_equipo": onu_details.get("Name", "N/D"),
        "modelo": onu_details.get("Detected ONU type") or onu_details.get("Type") or "N/D",
        "estado": status_display,
        "uptime": onu_details.get("Online Duration", "N/D"),
        "distancia": onu_details.get("ONU Distance", "N/D"),
        "ip_wan": ip_wan,
        "potencia_rx": rx_power,
        "potencia_tx": tx_power,
        "vlan": onu_details.get("Description", "").split("vlan_")[-1].split("_")[0] if "vlan_" in onu_details.get("Description", "") else "N/D"
    }
    
    return jsonify({"status": "success", "diagnostico": diagnostico})


