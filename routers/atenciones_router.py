from flask import Blueprint, request, jsonify, session
from datetime import datetime, date, timedelta
from db_config import get_db_connection

atenciones_bp = Blueprint('atenciones', __name__)

@atenciones_bp.route('/api/cliente/buscar_contrato_json', methods=['GET'])
def buscar_contrato_json():
    if 'user_id' not in session:
        token = request.headers.get('Authorization')
        if token and token.startswith("Bearer "):
            from utils_jwt import verify_token
            payload = verify_token(token)
            if not payload:
                return jsonify({"status": "error", "message": "No autorizado"}), 401
        else:
            return jsonify({"status": "error", "message": "No autorizado"}), 401

    contrato = request.args.get('contrato', '') or request.args.get('q', '') or request.args.get('cedula', '')
    contrato = contrato.strip()
    if not contrato:
        return jsonify({"status": "error", "message": "Parámetro de búsqueda vacío"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        from utils import format_antiguedad, MAPEO_NODOS
        query_contrato_f = contrato if contrato.upper().endswith('F') else (contrato + 'F')
        query_contrato_plain = contrato[:-1] if contrato.upper().endswith('F') else contrato

        query = """
            SELECT contrato, cedula, empresa, nombre_cliente AS cliente, zona AS sector, 
                   telefono1, telefono2, telefono3, fecha_instalacion,
                   total_mensual, antiguedad, numero_serie, producto, direccion, forma_pago,
                   velocidad_mbps, ip_cliente, ip_nodo, vendedor, email,
                   modelo_ont, router_principal, router_secundario, tipo_mesh,
                   cantidad_routers, modo_acceso
            FROM directorio_clientes 
            WHERE contrato = %s 
               OR contrato = %s 
               OR contrato = %s 
               OR cedula = %s
        """
        cursor.execute(query, (contrato, query_contrato_f, query_contrato_plain, contrato))
        rows = cursor.fetchall()
        
        def format_cliente_dict(cliente):
            cliente['antiguedad_fmt'] = format_antiguedad(cliente.get('antiguedad'), cliente.get('fecha_instalacion'))
            cliente['total_mensual'] = float(cliente['total_mensual']) if cliente.get('total_mensual') is not None else None
            cliente['numero_serie'] = cliente.get('numero_serie') or 'S/N'
            cliente['cedula'] = cliente.get('cedula') or ''
            cliente['empresa'] = cliente.get('empresa') or 'SERVICABLE'
            cliente['nodo_nombre'] = MAPEO_NODOS.get(cliente.get('ip_nodo'), cliente.get('ip_nodo'))
            cliente['cantidad_routers'] = cliente.get('cantidad_routers') or 1


            # Formatear fecha si existe
            if isinstance(cliente['fecha_instalacion'], (datetime, date)):
                cliente['fecha_instalacion'] = cliente['fecha_instalacion'].isoformat()
            elif isinstance(cliente['fecha_instalacion'], str) and len(cliente['fecha_instalacion']) >= 10:
                cliente['fecha_instalacion'] = cliente['fecha_instalacion'][:10]
            
            # Limpiar formatos flotantes (.0) si existieran
            for k in ['telefono1', 'telefono2', 'telefono3']:
                val = cliente.get(k)
                if val:
                    val_str = str(val).strip()
                    if val_str.endswith('.0') or val_str.endswith(',0'):
                        val_str = val_str[:-2]
                    cliente[k] = val_str

            # Combinar teléfonos de forma limpia
            tels = [cliente.get('telefono1'), cliente.get('telefono2'), cliente.get('telefono3')]
            tels = [t for t in tels if t and t.lower() not in ['nan', 'none']]
            cliente['telefonos'] = " / ".join(dict.fromkeys(tels))
            return cliente

        if len(rows) > 1:
            contratos_list = [format_cliente_dict(r) for r in rows]
            return jsonify({
                "status": "multi_contrato",
                "total": len(contratos_list),
                "contratos": contratos_list,
                "cliente": contratos_list[0]
            })
        elif len(rows) == 1:
            cliente = format_cliente_dict(rows[0])
            return jsonify({"status": "success", "cliente": cliente})
        else:
            return jsonify({"status": "error", "message": "Cliente no encontrado en el directorio"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

def obtener_usuario_actual(req):

    auth_header = req.headers.get('Authorization')
    if auth_header and auth_header.startswith("Bearer "):
        from utils_jwt import verify_token
        u = verify_token(auth_header)
        if u:
            agente_nombre = u.get('nombre') or u.get('name') or u.get('username')
            conn = get_db_connection()
            if conn:
                try:
                    cursor = conn.cursor(dictionary=True)
                    cursor.execute("SELECT nombre FROM usuarios_callcenter WHERE id_usuario = %s OR email = %s", (u.get('sub'), u.get('username')))
                    row = cursor.fetchone()
                    if row and row.get('nombre'):
                        agente_nombre = row['nombre']
                except Exception as ex_u:
                    print("Error resolving agent name:", ex_u)
                finally:
                    conn.close()
            return {
                'id_usuario': u.get('sub'),
                'username': u.get('username'),
                'nombre': agente_nombre or session.get('user_name', 'Call Center'),
                'rol': u.get('role') or session.get('user_role', 'ASESOR')
            }
    if 'user_id' in session:
        return {
            'id_usuario': session['user_id'],
            'username': session.get('username'),
            'nombre': session.get('user_name', 'Call Center'),
            'rol': session.get('user_role', 'ASESOR')
        }
    return None

@atenciones_bp.route('/api/admin/atenciones', methods=['POST'])
def registrar_atencion():
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if user.get('rol') not in ['ADMIN', 'ASESOR', 'ATC']:
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
    agente = str(user.get('nombre') or 'Call Center').strip()
    
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
        id_atencion = cursor.lastrowid
        conn.commit()
        
        # Asignación automática equitativa a auditor ATC (Round-Robin)
        try:
            asignar_auditoria_atencion(
                conn, cursor, id_atencion, contrato, cliente, telefono1, telefono2,
                sector, motivo, agente, f_dt.isoformat()
            )
            conn.commit()
        except Exception as ex_aud:
            print(f"Error en asignación automática de auditoría: {ex_aud}")

        # Devolver ID y éxito
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
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if user.get('rol') not in ['ADMIN', 'ASESOR', 'ATC']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver atenciones."}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        agente = str(user.get('nombre') or 'Call Center').strip()
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
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD', 'ATC']:
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
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

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

    # Eliminar duplicados manteniendo el orden y normalizando a mayúsculas
    contratos_unicos = []
    seen = set()
    for c in contratos_list:
        c_norm = str(c).strip().upper()
        if c_norm and c_norm not in seen:
            seen.add(c_norm)
            contratos_unicos.append(c_norm)

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
    agente = str(user.get('nombre') or 'Call Center').strip()

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    no_encontrados = []

    try:
        # Pre-cargar directorio de clientes para los contratos solicitados (flexible case-insensitive)
        format_strings = ','.join(['%s'] * len(contratos_unicos))
        query_directorio = f"""
            SELECT contrato, nombre_cliente, zona, telefono1, telefono2, fecha_instalacion
            FROM directorio_clientes
            WHERE UPPER(TRIM(contrato)) IN ({format_strings})
        """
        cursor.execute(query_directorio, tuple(contratos_unicos))
        clientes_db = {str(row['contrato']).strip().upper(): row for row in cursor.fetchall()}

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

        # Asignar automáticamente los nuevos tickets a auditoría
        try:
            cur_sync = conn.cursor(dictionary=True)
            cur_sync.execute("""
                SELECT a.id_atencion, a.contrato, a.cliente, a.telefono1, a.telefono2, a.sector, a.motivo, a.agente, a.fecha
                FROM atenciones a
                LEFT JOIN auditoria_calidad_atenciones aud ON a.id_atencion = aud.id_atencion
                WHERE a.fecha = %s AND aud.id_auditoria IS NULL
                ORDER BY a.id_atencion ASC
            """, (f_dt.isoformat(),))
            pendientes = cur_sync.fetchall()

            cur_sync.execute("SELECT nombre FROM usuarios_callcenter WHERE rol = 'ATC_AUDITOR' AND activo = 1 ORDER BY id_usuario ASC")
            auditores = [r['nombre'] for r in cur_sync.fetchall()] or ['Andrea Mendoza', 'Jennifer Atancuri']

            for idx, a in enumerate(pendientes):
                aud = auditores[idx % len(auditores)]
                cur_sync.execute("""
                    INSERT INTO auditoria_calidad_atenciones (
                        id_atencion, contrato, cliente, telefono1, telefono2, sector, motivo_atencion,
                        agente_evaluado, auditor_asignado, fecha_atencion, estado_contacto
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE')
                """, (a['id_atencion'], a['contrato'], a['cliente'], a['telefono1'], a['telefono2'], a['sector'], a['motivo'], a['agente'], aud, a['fecha']))
            conn.commit()
            cur_sync.close()
        except Exception as ex_sync:
            print(f"Error asignando auditoria tras carga masiva: {ex_sync}")

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
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        from utils_jwt import verify_token
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({"status": "success", "clientes": []})
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        from utils import format_antiguedad, MAPEO_NODOS
        # Búsqueda parcial por contrato, cédula, nombre, teléfono o identificación o IP
        query = """
            SELECT contrato, cedula, empresa, nombre_cliente AS cliente, zona AS sector, 
                   telefono1, telefono2, telefono3, fecha_instalacion,
                   total_mensual, antiguedad, numero_serie, producto, direccion, forma_pago,
                   velocidad_mbps, ip_cliente, ip_nodo, vendedor, email,
                   modelo_ont, router_principal, numero_serie_router, router_secundario, numero_serie_router_secundario, tipo_mesh,
                   cantidad_routers, modo_acceso
            FROM directorio_clientes 
            WHERE contrato LIKE %s 
               OR cedula LIKE %s
               OR nombre_cliente LIKE %s 
               OR telefono1 LIKE %s 
               OR telefono2 LIKE %s 
               OR telefono3 LIKE %s
               OR numero_serie LIKE %s
               OR ip_cliente LIKE %s
            LIMIT 25
        """
        like_q = f"%{q}%"
        cursor.execute(query, (like_q, like_q, like_q, like_q, like_q, like_q, like_q, like_q))
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
            telefonos_str = " / ".join(tels)
            
            clientes.append({
                "contrato": row['contrato'],
                "cedula": row.get('cedula') or "",
                "empresa": row.get('empresa') or "SERVICABLE",
                "cliente": row['cliente'],
                "sector": row['sector'] or "N/D",
                "direccion": row['direccion'] or "N/D",
                "telefonos": telefonos_str or "No registrado",
                "fecha_instalacion": f_inst or "N/D",
                "total_mensual": float(row['total_mensual']) if row.get('total_mensual') is not None else None,
                "antiguedad_fmt": format_antiguedad(row.get('antiguedad'), row.get('fecha_instalacion')),
                "numero_serie": row.get('numero_serie') or "S/N",
                "producto": row.get('producto') or "N/D",
                "velocidad_mbps": row.get('velocidad_mbps'),
                "ip_cliente": row.get('ip_cliente') or "",
                "ip_nodo": row.get('ip_nodo') or "",
                "nodo_nombre": MAPEO_NODOS.get(row.get('ip_nodo'), row.get('ip_nodo')),
                "modelo_ont": row.get('modelo_ont'),
                "router_principal": row.get('router_principal'),
                "numero_serie_router": row.get('numero_serie_router'),
                "router_secundario": row.get('router_secundario'),
                "numero_serie_router_secundario": row.get('numero_serie_router_secundario'),
                "tipo_mesh": row.get('tipo_mesh'),
                "cantidad_routers": row.get('cantidad_routers') or 1,
                "modo_acceso": row.get('modo_acceso'),
                "vendedor": row.get('vendedor') or "",
                "forma_pago": row.get('forma_pago') or "N/D"
            })

            
        return jsonify({"status": "success", "clientes": clientes})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/cliente/actualizar_datos_tecnicos', methods=['POST'])
def actualizar_datos_tecnicos_cliente():
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        from utils_jwt import verify_token
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    user_role = user.get('role') or user.get('rol')
    if user_role not in ['ADMIN', 'ASESOR', 'ATC', 'CALIDAD', 'BODEGA']:
        return jsonify({"status": "error", "message": "No tienes permisos para modificar datos técnicos de clientes"}), 403

    datos = request.get_json() or {}
    contrato = str(datos.get('contrato', '')).strip()
    if not contrato:
        return jsonify({"status": "error", "message": "Falta el número de contrato"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        from utils import normalizar_gpon_sn, MAPEO_NODOS
        raw_sn = datos.get('numero_serie') or ''
        sn_normalizado = normalizar_gpon_sn(raw_sn) if raw_sn else ''
        
        ip_cliente = str(datos.get('ip_cliente', '')).strip()
        ip_nodo = str(datos.get('ip_nodo', '')).strip()
        modelo_ont = str(datos.get('modelo_ont', '')).strip()
        router_principal = str(datos.get('router_principal', '')).strip()
        numero_serie_router = str(datos.get('numero_serie_router', '')).strip().upper()
        router_secundario = str(datos.get('router_secundario', '')).strip()
        numero_serie_router_secundario = str(datos.get('numero_serie_router_secundario', '')).strip().upper()
        tipo_mesh = str(datos.get('tipo_mesh', '')).strip()
        modo_acceso = str(datos.get('modo_acceso', '')).strip()
        cantidad_routers = int(datos.get('cantidad_routers', 1)) if datos.get('cantidad_routers') else 1

        c_val = contrato.upper()
        c_clean = c_val.lstrip('0')

        query_update = """
            UPDATE directorio_clientes
            SET ip_cliente = %s,
                ip_nodo = %s,
                numero_serie = %s,
                modelo_ont = %s,
                router_principal = %s,
                numero_serie_router = %s,
                router_secundario = %s,
                numero_serie_router_secundario = %s,
                tipo_mesh = %s,
                cantidad_routers = %s,
                modo_acceso = %s
            WHERE UPPER(contrato) = %s OR UPPER(contrato) = %s
        """
        cursor.execute(query_update, (
            ip_cliente or None,
            ip_nodo or None,
            sn_normalizado or None,
            modelo_ont or None,
            router_principal or None,
            numero_serie_router or None,
            router_secundario or None,
            numero_serie_router_secundario or None,
            tipo_mesh or None,
            cantidad_routers,
            modo_acceso or None,
            c_val, c_clean
        ))
        conn.commit()

        # Consultar los datos actualizados para responder
        cursor.execute("""
            SELECT contrato, cedula, empresa, nombre_cliente AS cliente, zona AS sector, 
                   telefono1, telefono2, telefono3, fecha_instalacion,
                   total_mensual, antiguedad, numero_serie, producto, direccion, forma_pago,
                   velocidad_mbps, ip_cliente, ip_nodo, vendedor, email,
                   modelo_ont, router_principal, numero_serie_router, router_secundario, numero_serie_router_secundario, tipo_mesh,
                   cantidad_routers, modo_acceso
            FROM directorio_clientes 
            WHERE UPPER(contrato) = %s OR UPPER(contrato) = %s
            LIMIT 1
        """, (c_val, c_clean))
        updated_row = cursor.fetchone()

        nodo_nombre = MAPEO_NODOS.get(updated_row.get('ip_nodo'), updated_row.get('ip_nodo')) if updated_row else ''

        return jsonify({
            "status": "success",
            "message": f"Datos técnicos del contrato #{contrato} actualizados correctamente.",
            "cliente_actualizado": {
                **updated_row,
                "nodo_nombre": nodo_nombre
            } if updated_row else {}
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"Error al actualizar datos técnicos: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/admin/smartolt/diagnostico/<sn>', methods=['GET'])
def diagnostico_smartolt(sn):
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        from utils_jwt import verify_token
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    user_role = user.get('role') or user.get('rol')
    if user_role not in ['ADMIN', 'ASESOR', 'TECNICO', 'CALIDAD', 'ATC']:
        return jsonify({"status": "error", "message": "No tienes privilegios para consultar diagnóstico"}), 403
        
    import urllib.request
    import ssl
    import json
    import concurrent.futures
    
    SMARTOLT_CREDENTIALS = [
        {"domain": "diyer.smartolt.com", "api_key": "e2b23976ae0649a1a1d767915fd90002"},
        {"domain": "servicablegz.smartolt.com", "api_key": "ae287af051d349a68db0aec4b11cc933"}
    ]
    
    def check_single_smartolt(cred):
        dom = cred["domain"]
        api_key = cred["api_key"]
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        url = f"https://{dom}/api/onu/get_onu_details/{sn}"
        req = urllib.request.Request(url)
        req.add_header("X-Token", api_key)
        req.add_header("User-Agent", "FuturityAtlas/1.0")
        
        try:
            with urllib.request.urlopen(req, timeout=4, context=ctx) as resp:
                if resp.status == 200:
                    raw = resp.read().decode('utf-8')
                    data = json.loads(raw)
                    if data.get("status") == True and "onu_details" in data:
                        return {"domain": dom, "data": data}
        except Exception:
            pass
        return None

    # Consulta en paralelo
    found_result = None
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(SMARTOLT_CREDENTIALS)) as executor:
        futures = [executor.submit(check_single_smartolt, cred) for cred in SMARTOLT_CREDENTIALS]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res is not None:
                found_result = res
                # Cancela el resto de hilos de ser posible
                break
                
    if not found_result:
        return jsonify({
            "status": "error", 
            "message": f"El equipo con serie {sn} no se encuentra registrado en ninguna central de SmartOLT activa."
        }), 404
        
    data = found_result["data"]
    details = data["onu_details"]
    
    # Formatear potencias
    rx_val = details.get("signal_1490")
    tx_val = details.get("signal_1310")
    
    rx_power = f"{rx_val} dBm" if rx_val is not None and str(rx_val) != "-" else "N/D"
    tx_power = f"{tx_val} dBm" if tx_val is not None and str(tx_val) != "-" else "N/D"
    
    # Formatear OLT y puerto PON
    olt_name = details.get("olt_name", "N/D")
    board = details.get("board")
    port = details.get("port")
    pon_port = f"T:{board} / P:{port}" if board is not None and port is not None else "N/D"
    
    # Formatear el uptime (duración desde el último cambio de estado)
    uptime_str = "N/D"
    last_change = details.get("last_status_change")
    if last_change and str(last_change) not in ["None", "N/D"]:
        try:
            clean_str = str(last_change).split(".")[0]
            dt = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            diff = datetime.now() - dt
            
            days = diff.days
            hours = diff.seconds // 3600
            minutes = (diff.seconds % 3600) // 60
            
            parts = []
            if days > 0:
                parts.append(f"{days}d")
            if hours > 0:
                parts.append(f"{hours}h")
            if minutes > 0:
                parts.append(f"{minutes}m")
                
            duration = " ".join(parts) if parts else "0m"
            date_fmt = dt.strftime("%d/%m/%Y %H:%M")
            uptime_str = f"{duration} ({date_fmt})"
        except Exception as ex:
            print("Error parsing last_status_change:", ex)
            uptime_str = str(last_change)
    
    # Estructurar diagnóstico
    diagnostico = {
        "sn": sn,
        "nombre_equipo": details.get("name", "N/D"),
        "modelo": details.get("onu_type_name", "N/D"),
        "estado": details.get("status", "Offline"),
        "uptime": uptime_str,
        "distancia": f"{details.get('distance')} m" if details.get('distance') else "N/D",
        "ip_wan": details.get("address") or "N/D",
        "potencia_rx": rx_power,
        "potencia_tx": tx_power,
        "vlan": details.get("vlan") or "N/D",
        "pon_port": pon_port,
        "olt_name": olt_name
    }
    return jsonify({"status": "success", "diagnostico": diagnostico})


# ==========================================================
# GESTIÓN Y AUDITORÍA DE CALIDAD ATC (CALL CENTER)
# ==========================================================

def asignar_auditoria_atencion(conn, cursor, id_atencion, contrato, cliente, telefono1, telefono2, sector, motivo, agente, fecha_atencion):
    """
    Asigna una atención registrada al auditor con menor carga del día (Round-Robin entre rol ATC_AUDITOR).
    """
    try:
        c_aud = conn.cursor(dictionary=True)
        c_aud.execute("SELECT nombre FROM usuarios_callcenter WHERE rol = 'ATC_AUDITOR' AND activo = 1 ORDER BY id_usuario ASC")
        auditores = [r['nombre'] for r in c_aud.fetchall()]
        c_aud.close()

        if not auditores:
            auditores = ['Andrea Mendoza', 'Jennifer Atancuri']

        # Balanceo exacto: contar tickets asignados hoy a cada auditor
        c_count = conn.cursor(dictionary=True)
        c_count.execute("""
            SELECT auditor_asignado, COUNT(*) as total
            FROM auditoria_calidad_atenciones
            WHERE fecha_atencion = %s AND auditor_asignado IS NOT NULL
            GROUP BY auditor_asignado
        """, (fecha_atencion,))
        conteo = {r['auditor_asignado']: r['total'] for r in c_count.fetchall()}
        c_count.close()

        auditor_elegido = min(auditores, key=lambda a: conteo.get(a, 0))

        cursor.execute("""
            INSERT INTO auditoria_calidad_atenciones (
                id_atencion, contrato, cliente, telefono1, telefono2, sector, motivo_atencion,
                agente_evaluado, auditor_asignado, fecha_atencion, estado_contacto
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE')
            ON DUPLICATE KEY UPDATE
                contrato = VALUES(contrato),
                cliente = VALUES(cliente),
                telefono1 = VALUES(telefono1),
                telefono2 = VALUES(telefono2),
                sector = VALUES(sector),
                motivo_atencion = VALUES(motivo_atencion),
                agente_evaluado = VALUES(agente_evaluado)
        """, (id_atencion, contrato, cliente, telefono1, telefono2, sector, motivo, agente, auditor_elegido, fecha_atencion))
    except Exception as e:
        print(f"Error asignando auditoria para atencion #{id_atencion}: {e}")


@atenciones_bp.route('/api/atc/auditoria/lista', methods=['GET'])
def api_atc_auditoria_lista():
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if user.get('rol') not in ['ADMIN', 'ATC_AUDITOR', 'CALIDAD']:
        return jsonify({"status": "error", "message": "Acceso restringido a auditores ATC."}), 403

    fecha = request.args.get('fecha', date.today().isoformat()).strip()
    filtro_auditor = request.args.get('filtro_auditor', 'MIS_ASIGNADAS').strip()
    estado = request.args.get('estado', '').strip()
    search = request.args.get('search', '').strip()
    user_name = user.get('nombre', '')

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM auditoria_calidad_atenciones WHERE 1=1"
        params = []

        if fecha:
            query += " AND fecha_atencion = %s"
            params.append(fecha)

        if filtro_auditor == 'MIS_ASIGNADAS':
            query += " AND (auditor_asignado = %s OR auditor_gestion = %s)"
            params.extend([user_name, user_name])
        elif filtro_auditor != 'TODAS' and filtro_auditor:
            query += " AND auditor_asignado = %s"
            params.append(filtro_auditor)

        if estado:
            query += " AND estado_contacto = %s"
            params.append(estado)

        if search:
            query += " AND (cliente LIKE %s OR contrato LIKE %s OR agente_evaluado LIKE %s OR telefono1 LIKE %s OR telefono2 LIKE %s)"
            search_p = f"%{search}%"
            params.extend([search_p, search_p, search_p, search_p, search_p])

        query += " ORDER BY id_auditoria ASC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        for r in rows:
            if r.get('fecha_atencion') and hasattr(r['fecha_atencion'], 'isoformat'):
                r['fecha_atencion'] = r['fecha_atencion'].isoformat()
            if r.get('fecha_gestion') and hasattr(r['fecha_gestion'], 'isoformat'):
                r['fecha_gestion'] = r['fecha_gestion'].isoformat()
            if r.get('fecha_creacion') and hasattr(r['fecha_creacion'], 'isoformat'):
                r['fecha_creacion'] = r['fecha_creacion'].isoformat()
            if r.get('promedio_total') is not None:
                r['promedio_total'] = float(r['promedio_total'])

        return jsonify({"status": "ok", "auditorias": rows, "total": len(rows)})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/atc/auditoria/guardar', methods=['POST'])
def api_atc_auditoria_guardar():
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if user.get('rol') not in ['ADMIN', 'ATC_AUDITOR', 'CALIDAD']:
        return jsonify({"status": "error", "message": "Acceso restringido a auditores ATC."}), 403

    data = request.get_json() or {}
    id_auditoria = data.get('id_auditoria')
    estado_contacto = (data.get('estado_contacto') or 'PENDIENTE').strip().upper()
    user_name = user.get('nombre', 'Auditor ATC')

    if not id_auditoria:
        return jsonify({"status": "error", "message": "ID de auditoría es requerido"}), 400

    p1 = data.get('p1_claridad')
    p2 = data.get('p2_amabilidad')
    p3 = data.get('p3_rapidez')
    p4 = data.get('p4_efectividad')
    p5 = data.get('p5_satisfaccion')
    p6 = data.get('p6_facilidad')

    # Convertir a enteros válidos (1 a 10)
    scores = []
    parsed_p = []
    for p in [p1, p2, p3, p4, p5, p6]:
        try:
            if p is not None and str(p).strip() != '':
                val = int(p)
                if 1 <= val <= 10:
                    scores.append(val)
                    parsed_p.append(val)
                else:
                    parsed_p.append(None)
            else:
                parsed_p.append(None)
        except (ValueError, TypeError):
            parsed_p.append(None)

    promedio_total = round(sum(scores) / len(scores), 2) if scores else None

    respuesta_facilidad = (data.get('respuesta_facilidad') or '').strip() or None
    recomendacion_cliente = (data.get('recomendacion_cliente') or '').strip() or None
    observaciones = (data.get('observaciones') or '').strip() or None

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE auditoria_calidad_atenciones
            SET estado_contacto = %s,
                p1_claridad = %s,
                p2_amabilidad = %s,
                p3_rapidez = %s,
                p4_efectividad = %s,
                p5_satisfaccion = %s,
                p6_facilidad = %s,
                promedio_total = %s,
                respuesta_facilidad = %s,
                recomendacion_cliente = %s,
                observaciones = %s,
                auditor_gestion = %s,
                fecha_gestion = NOW(),
                intentos_llamada = intentos_llamada + 1
            WHERE id_auditoria = %s
        """, (
            estado_contacto, parsed_p[0], parsed_p[1], parsed_p[2], parsed_p[3], parsed_p[4], parsed_p[5],
            promedio_total, respuesta_facilidad, recomendacion_cliente, observaciones,
            user_name, id_auditoria
        ))
        conn.commit()
        return jsonify({
            "status": "ok",
            "message": "Auditoría guardada exitosamente.",
            "promedio_total": promedio_total
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/atc/auditoria/metricas', methods=['GET'])
def api_atc_auditoria_metricas():
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    fecha_inicio = request.args.get('fecha_inicio', date.today().isoformat()).strip()
    fecha_fin = request.args.get('fecha_fin', date.today().isoformat()).strip()
    auditor_filter = request.args.get('auditor', '').strip()

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # 1. Métricas de Contactabilidad
        query_cont = """
            SELECT 
                COUNT(*) as total_asignadas,
                SUM(CASE WHEN estado_contacto = 'CONTESTO' THEN 1 ELSE 0 END) as contestaron,
                SUM(CASE WHEN estado_contacto = 'NO_CONTESTA' THEN 1 ELSE 0 END) as no_contestaron,
                SUM(CASE WHEN estado_contacto = 'NUMERO_EQUIVOCADO' THEN 1 ELSE 0 END) as equivocados,
                SUM(CASE WHEN estado_contacto = 'FUERA_SERVICIO' THEN 1 ELSE 0 END) as fuera_servicio,
                SUM(CASE WHEN estado_contacto = 'PENDIENTE' THEN 1 ELSE 0 END) as pendientes
            FROM auditoria_calidad_atenciones
            WHERE fecha_atencion BETWEEN %s AND %s
        """
        params_cont = [fecha_inicio, fecha_fin]
        if auditor_filter:
            query_cont += " AND (auditor_asignado = %s OR auditor_gestion = %s)"
            params_cont.extend([auditor_filter, auditor_filter])

        cursor.execute(query_cont, tuple(params_cont))
        contact_row = cursor.fetchone() or {}

        tot_asig = contact_row.get('total_asignadas', 0) or 0
        tot_cont = contact_row.get('contestaron', 0) or 0
        tot_nocont = contact_row.get('no_contestaron', 0) or 0
        tot_equiv = contact_row.get('equivocados', 0) or 0
        tot_fuera = contact_row.get('fuera_servicio', 0) or 0
        tot_pend = contact_row.get('pendientes', 0) or 0
        pct_cont = round((tot_cont / tot_asig * 100), 1) if tot_asig > 0 else 0.0

        # 2. Promedios por Pregunta y Global
        query_prom = """
            SELECT 
                ROUND(AVG(p1_claridad), 2) as p1_claridad,
                ROUND(AVG(p2_amabilidad), 2) as p2_amabilidad,
                ROUND(AVG(p3_rapidez), 2) as p3_rapidez,
                ROUND(AVG(p4_efectividad), 2) as p4_efectividad,
                ROUND(AVG(p5_satisfaccion), 2) as p5_satisfaccion,
                ROUND(AVG(p6_facilidad), 2) as p6_facilidad,
                ROUND(AVG(promedio_total), 2) as promedio_global,
                COUNT(promedio_total) as total_calificadas
            FROM auditoria_calidad_atenciones
            WHERE fecha_atencion BETWEEN %s AND %s AND estado_contacto = 'CONTESTO'
        """
        params_prom = [fecha_inicio, fecha_fin]
        if auditor_filter:
            query_prom += " AND (auditor_asignado = %s OR auditor_gestion = %s)"
            params_prom.extend([auditor_filter, auditor_filter])

        cursor.execute(query_prom, tuple(params_prom))
        prom_row = cursor.fetchone() or {}

        # 3. Ranking de Calificación por Asesor Evaluado
        query_asesores = """
            SELECT 
                agente_evaluado as agente,
                COUNT(*) as total_evaluadas,
                ROUND(AVG(promedio_total), 2) as promedio_total,
                ROUND(AVG(p1_claridad), 2) as p1_claridad,
                ROUND(AVG(p2_amabilidad), 2) as p2_amabilidad,
                ROUND(AVG(p3_rapidez), 2) as p3_rapidez,
                ROUND(AVG(p4_efectividad), 2) as p4_efectividad,
                ROUND(AVG(p5_satisfaccion), 2) as p5_satisfaccion,
                ROUND(AVG(p6_facilidad), 2) as p6_facilidad
            FROM auditoria_calidad_atenciones
            WHERE fecha_atencion BETWEEN %s AND %s 
              AND estado_contacto = 'CONTESTO'
              AND agente_evaluado IS NOT NULL 
              AND agente_evaluado != ''
            GROUP BY agente_evaluado
            ORDER BY promedio_total DESC, total_evaluadas DESC
        """
        cursor.execute(query_asesores, (fecha_inicio, fecha_fin))
        ranking_asesores = cursor.fetchall()
        for r in ranking_asesores:
            for k in ['promedio_total', 'p1_claridad', 'p2_amabilidad', 'p3_rapidez', 'p4_efectividad', 'p5_satisfaccion', 'p6_facilidad']:
                if r.get(k) is not None:
                    r[k] = float(r[k])

        # 4. Productividad por Auditor ATC
        query_auditores = """
            SELECT 
                COALESCE(auditor_gestion, auditor_asignado) as auditor,
                COUNT(*) as total_asignadas,
                SUM(CASE WHEN estado_contacto = 'CONTESTO' THEN 1 ELSE 0 END) as contestadas,
                SUM(CASE WHEN estado_contacto = 'NO_CONTESTA' THEN 1 ELSE 0 END) as no_contestadas,
                SUM(CASE WHEN estado_contacto = 'PENDIENTE' THEN 1 ELSE 0 END) as pendientes,
                ROUND(AVG(CASE WHEN estado_contacto = 'CONTESTO' THEN promedio_total ELSE NULL END), 2) as promedio_calificado
            FROM auditoria_calidad_atenciones
            WHERE fecha_atencion BETWEEN %s AND %s
            GROUP BY COALESCE(auditor_gestion, auditor_asignado)
            ORDER BY total_asignadas DESC
        """
        cursor.execute(query_auditores, (fecha_inicio, fecha_fin))
        ranking_auditores = cursor.fetchall()
        for a in ranking_auditores:
            if a.get('promedio_calificado') is not None:
                a['promedio_calificado'] = float(a['promedio_calificado'])

        return jsonify({
            "status": "ok",
            "contactabilidad": {
                "total_asignadas": tot_asig,
                "contestaron": tot_cont,
                "no_contestaron": tot_nocont,
                "equivocados": tot_equiv,
                "fuera_servicio": tot_fuera,
                "pendientes": tot_pend,
                "pct_contestaron": pct_cont
            },
            "promedios_preguntas": {
                "p1_claridad": float(prom_row.get('p1_claridad') or 0.0),
                "p2_amabilidad": float(prom_row.get('p2_amabilidad') or 0.0),
                "p3_rapidez": float(prom_row.get('p3_rapidez') or 0.0),
                "p4_efectividad": float(prom_row.get('p4_efectividad') or 0.0),
                "p5_satisfaccion": float(prom_row.get('p5_satisfaccion') or 0.0),
                "p6_facilidad": float(prom_row.get('p6_facilidad') or 0.0),
                "promedio_global": float(prom_row.get('promedio_global') or 0.0),
                "total_calificadas": prom_row.get('total_calificadas', 0)
            },
            "ranking_asesores": ranking_asesores,
            "ranking_auditores": ranking_auditores
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@atenciones_bp.route('/api/atc/auditoria/sincronizar_dia', methods=['POST'])
def api_atc_auditoria_sincronizar_dia():
    user = obtener_usuario_actual(request)
    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    data = request.get_json() or {}
    fecha = (data.get('fecha') or date.today().isoformat()).strip()

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.id_atencion, a.contrato, a.cliente, a.telefono1, a.telefono2, a.sector, a.motivo, a.agente, a.fecha
            FROM atenciones a
            LEFT JOIN auditoria_calidad_atenciones aud ON a.id_atencion = aud.id_atencion
            WHERE a.fecha = %s AND aud.id_auditoria IS NULL
            ORDER BY a.id_atencion ASC
        """, (fecha,))
        pendientes = cursor.fetchall()

        cursor.execute("SELECT nombre FROM usuarios_callcenter WHERE rol = 'ATC_AUDITOR' AND activo = 1 ORDER BY id_usuario ASC")
        auditores = [r['nombre'] for r in cursor.fetchall()]
        if not auditores:
            auditores = ['Andrea Mendoza', 'Jennifer Atancuri']

        for idx, a in enumerate(pendientes):
            auditor = auditores[idx % len(auditores)]
            cursor.execute("""
                INSERT INTO auditoria_calidad_atenciones (
                    id_atencion, contrato, cliente, telefono1, telefono2, sector, motivo_atencion,
                    agente_evaluado, auditor_asignado, fecha_atencion, estado_contacto
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE')
            """, (a['id_atencion'], a['contrato'], a['cliente'], a['telefono1'], a['telefono2'], a['sector'], a['motivo'], a['agente'], auditor, a['fecha']))

        conn.commit()
        return jsonify({"status": "ok", "message": f"Se sincronizaron y asignaron {len(pendientes)} tickets para el {fecha}."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


