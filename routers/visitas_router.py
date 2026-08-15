from flask import Blueprint, request, redirect, url_for, session, jsonify, flash
from db_config import get_db_connection
from utils import normalizar_horario_texto 
from datetime import date

visitas_bp = Blueprint('visitas', __name__)

def obtener_usuario_visitas():
    token = request.headers.get('Authorization')
    if token and token.startswith("Bearer "):
        from utils_jwt import verify_token
        user = verify_token(token)
        if user:
            return {
                'id_usuario': user.get('sub') or user.get('id_usuario'),
                'user_name': user.get('username') or user.get('nombre'),
                'user_role': user.get('role') or user.get('rol')
            }
    if 'user_id' in session:
        return {
            'id_usuario': session['user_id'],
            'user_name': session.get('user_name'),
            'user_role': session.get('user_role')
        }
    return None

@visitas_bp.route('/api/visitas', methods=['POST'])
def registrar_visita():
    # Protección de sesión y rol
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        flash('No tienes permiso para registrar visitas.', 'danger')
        return redirect(url_for('dashboard'))

    try:
        creado_por = session['user_name']

        fecha_programada = request.form.get('fecha_programada', '').strip()
        
        # VALIDACIÓN: Formato de fecha y existencia real en el calendario
        try:
            from datetime import datetime
            datetime.strptime(fecha_programada, '%Y-%m-%d')
        except (ValueError, TypeError):
            flash(f'La fecha programada "{fecha_programada}" no es válida.', 'danger')
            return redirect(url_for('dashboard'))
        
        # VALIDACIÓN: No permitir crear visitas en el pasado
        if fecha_programada < str(date.today()):
            return jsonify({
                "status": "error", 
                "message": "❌ Error: La fecha de la visita no puede ser anterior al día de hoy."
            }), 400
            
        preferencia = request.form.get('preferencia_horaria')
        prioridad = request.form.get('prioridad', 'MEDIA')
        tecnico_principal = request.form.get('tecnico_asignado') or None
        tecnico_apoyo = request.form.get('tecnico_apoyo') or None
        empresa = request.form.get('empresa')
        contrato = request.form.get('contrato')
        cliente = request.form.get('cliente')
        telefonos = request.form.get('telefonos')
        sector = request.form.get('sector')
        
        dir_texto = request.form.get('direccion', '')
        lat = request.form.get('latitud', '').strip()
        lon = request.form.get('longitud', '').strip()
        direccion_completa = f"{dir_texto} ({lat}, {lon})" if lat and lon else dir_texto
        
        try:
            lat_val = float(lat) if lat else None
        except ValueError:
            lat_val = None
        try:
            lon_val = float(lon) if lon else None
        except ValueError:
            lon_val = None
        
        servicio = request.form.get('servicio')
        velocidad_mbps = request.form.get('velocidad_mbps')
        velocidad_mbps = int(velocidad_mbps) if velocidad_mbps and velocidad_mbps.isdigit() else None
        problema = request.form.get('problema')
        observacion_callcenter = request.form.get('observacion_callcenter')
        
        # Nuevos campos de instalación
        es_instalacion = int(request.form.get('es_instalacion', 0))
        producto = request.form.get('producto') or None
        tipo_instalacion = request.form.get('tipo_instalacion') or None
        vendedor = request.form.get('vendedor') or None
        recibido_coordinacion = request.form.get('recibido_coordinacion') or None
        if recibido_coordinacion == '':
            recibido_coordinacion = None
        
        # Recopilar la información técnica por partes (Opcional)
        info_parts = []
        info_caja = request.form.get('info_caja', '').strip()
        info_hilo = request.form.get('info_hilo', '').strip()
        info_ip = request.form.get('info_ip', '').strip()
        info_vlan = request.form.get('info_vlan', '').strip()
        info_usr = request.form.get('info_usr', '').strip()
        info_pas = request.form.get('info_pas', '').strip()
        
        if info_caja: info_parts.append(f"CAJA: {info_caja}")
        if info_hilo: info_parts.append(f"HILO: {info_hilo}")
        if info_ip: info_parts.append(f"IP: {info_ip}")
        if info_vlan: info_parts.append(f"VLAN: {info_vlan}")
        if info_usr: info_parts.append(f"USR: {info_usr}")
        if info_pas: info_parts.append(f"PAS: {info_pas}")
        
        informacion_tecnico = "\n".join(info_parts)
 
        # --- AQUÍ CONVERTIMOS EL TEXTO A MINUTOS PARA EL OPTIMIZADOR ---
        ventana_inicio, ventana_fin = normalizar_horario_texto(preferencia)
 
        # 1. Consultar el turno o restricción del técnico
        if tecnico_principal and preferencia:
            preferencia_horaria = preferencia.lower()
            conexion_val = get_db_connection()
            if conexion_val:
                cursor_val = conexion_val.cursor(dictionary=True)
                cursor_val.execute("SELECT turno FROM tecnicos WHERE nombre = %s", (tecnico_principal,))
                tecnico_info = cursor_val.fetchone()
                
                if tecnico_info and tecnico_info.get('turno'):
                    turno_tecnico = tecnico_info['turno'] # 'MAÑANA' o 'TARDE'
                    
                    # 2. VALIDACIÓN CRÍTICA: Detectar el choque de horarios
                    if turno_tecnico == 'TARDE' and ('mañana' in preferencia_horaria or 'manana' in preferencia_horaria):
                        cursor_val.close()
                        conexion_val.close()
                        return jsonify({
                            "status": "error", 
                            "message": f"❌ Error: {tecnico_principal} trabaja en la TARDE. No puedes asignarle una visita de la MAÑANA."
                        }), 400
                        
                    if turno_tecnico == 'MAÑANA' and 'tarde' in preferencia_horaria:
                        cursor_val.close()
                        conexion_val.close()
                        return jsonify({
                            "status": "error", 
                            "message": f"❌ Error: {tecnico_principal} trabaja en la MAÑANA. No puedes asignarle una visita de la TARDE."
                        }), 400
                
                cursor_val.close()
                conexion_val.close()
 
        conexion = get_db_connection()
        cursor = conexion.cursor()
 
        # Añadimos los campos ventana_inicio_min y ventana_fin_min al INSERT
        query = """
            INSERT INTO visitas_tecnicas 
            (creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia_horaria, 
            empresa, contrato, cliente, telefonos, sector, direccion, 
            servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, 
            ventana_inicio_min, ventana_fin_min, estado, prioridad,
            es_instalacion, producto, tipo_instalacion, vendedor, recibido_coordinacion,
            latitud, longitud)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s, %s, %s, %s, %s, %s, %s, %s)
        """ 
        valores = (
            creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia,
            empresa, contrato, cliente, telefonos, sector, direccion_completa,
            servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico,
            ventana_inicio, ventana_fin, prioridad,
            es_instalacion, producto, tipo_instalacion, vendedor, recibido_coordinacion,
            lat_val, lon_val
        )
        
        cursor.execute(query, valores)
        conexion.commit() 
        
        return redirect(url_for('dashboard'))

    except Exception as e:
        return f"Error al guardar en BD: {e}"
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()

# Dejamos aquí tu ruta de búsqueda de cliente para el autocompletado (Soporta Cédula y Contrato)
@visitas_bp.route('/api/cliente/<contrato>', methods=['GET'])
def buscar_cliente(contrato):
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"error": "Sin conexión"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        query_val = contrato.strip()
        empresa = request.args.get('empresa', '').strip().upper()

        query_contrato_f = query_val if query_val.upper().endswith('F') else (query_val + 'F')
        query_contrato_plain = query_val[:-1] if query_val.upper().endswith('F') else query_val

        # Buscar por Contrato directo, Cédula o Contrato Fibracom
        query = """
            SELECT contrato, cedula, empresa, nombre_cliente, zona, telefono1, telefono2, telefono3,
                   COALESCE(direccion, '') AS direccion, producto, velocidad_mbps, ip_cliente, ip_nodo,
                   numero_serie, estado, forma_pago, total_mensual, antiguedad, fecha_instalacion
            FROM directorio_clientes 
            WHERE contrato = %s 
               OR contrato = %s 
               OR contrato = %s 
               OR cedula = %s
        """
        cursor.execute(query, (query_val, query_contrato_f, query_contrato_plain, query_val))
        rows = cursor.fetchall()
        
        # Si se filtró por empresa en el frontend, priorizar/filtrar si aplica
        if empresa and len(rows) > 1:
            empresa_rows = [r for r in rows if (r.get('empresa') or '').upper() == empresa]
            if empresa_rows:
                rows = empresa_rows

        def format_cliente_payload(row):
            tel1 = str(row['telefono1']).strip() if row.get('telefono1') else ""
            if tel1.endswith('.0') or tel1.endswith(',0'): tel1 = tel1[:-2]
            if tel1.lower() in ['nan', 'none']: tel1 = ""

            tel2 = str(row['telefono2']).strip() if row.get('telefono2') else ""
            if tel2.endswith('.0') or tel2.endswith(',0'): tel2 = tel2[:-2]
            if tel2.lower() in ['nan', 'none']: tel2 = ""

            tel3 = str(row['telefono3']).strip() if row.get('telefono3') else ""
            if tel3.endswith('.0') or tel3.endswith(',0'): tel3 = tel3[:-2]
            if tel3.lower() in ['nan', 'none']: tel3 = ""

            tels = [t for t in [tel1, tel2, tel3] if t]
            telefonos = " / ".join(dict.fromkeys(tels))

            return {
                "contrato": row['contrato'],
                "cedula": row.get('cedula') or "",
                "empresa": row.get('empresa') or "SERVICABLE",
                "cliente": row['nombre_cliente'],
                "zona_excel": row['zona'] or "",
                "telefonos": telefonos,
                "direccion": row['direccion'] or "",
                "producto": row.get('producto') or "",
                "velocidad_mbps": row.get('velocidad_mbps'),
                "ip_cliente": row.get('ip_cliente') or "",
                "ip_nodo": row.get('ip_nodo') or "",
                "numero_serie": row.get('numero_serie') or "",
                "estado": row.get('estado') or "Activo",
                "total_mensual": float(row['total_mensual']) if row.get('total_mensual') is not None else None
            }

        if len(rows) > 1:
            # Multi-contrato detectado para esta Cédula
            contratos_list = [format_cliente_payload(r) for r in rows]
            return jsonify({
                "status": "multi_contrato",
                "total": len(contratos_list),
                "contratos": contratos_list,
                "cliente": contratos_list[0]['cliente'],
                "zona_excel": contratos_list[0]['zona_excel'],
                "telefonos": contratos_list[0]['telefonos'],
                "direccion": contratos_list[0]['direccion']
            })
        elif len(rows) == 1:
            payload = format_cliente_payload(rows[0])
            payload["status"] = "success"
            return jsonify(payload)
        else:
            return jsonify({"status": "not_found", "error": "No encontrado"}), 404
            
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion.is_connected():

            cursor.close()

@visitas_bp.route('/api/visitas/reagendar/<int:id_visita>', methods=['POST'])
def reagendar_visita(id_visita):
    usuario = obtener_usuario_visitas()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if usuario.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        return jsonify({"status": "error", "message": "No tienes permiso para reagendar visitas."}), 403

    nueva_fecha = request.form.get('nueva_fecha', '').strip()
    
    # VALIDACIÓN: Formato de fecha y existencia real en el calendario
    try:
        from datetime import datetime
        datetime.strptime(nueva_fecha, '%Y-%m-%d')
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": f'La fecha de reagendamiento "{nueva_fecha}" no es válida.'}), 400

    nueva_prioridad = request.form.get('nueva_prioridad') # Por si ahora urge más
    observacion_adicional = request.form.get('observacion_reagendado', '').strip()
    
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        # 1. Obtener la visita original con todos sus datos
        cursor.execute("SELECT * FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        original = cursor.fetchone()
        if not original:
            return jsonify({"status": "error", "message": "La visita a reagendar no fue encontrada."}), 404
            
        # 2. Actualizar la visita original (se queda en el día actual pero con estado REAGENDADA)
        nota_reagenda = f" | REAGENDADO: {observacion_adicional}" if observacion_adicional else " | REAGENDADO"
        obs_call_original = (original['observacion_callcenter'] or "") + nota_reagenda
        
        cursor.execute("""
            UPDATE visitas_tecnicas 
            SET estado = 'REAGENDADA',
                observacion_callcenter = %s,
                tecnico_principal = 'NO TECNICO',
                tecnico_apoyo = NULL,
                token_rastreo = NULL
            WHERE id_visita = %s
        """, (obs_call_original, id_visita))
        
        # 3. Crear (clonar) una nueva visita para la nueva fecha en estado PENDIENTE y con 'NO TECNICO'
        prioridad_final = nueva_prioridad if nueva_prioridad else original['prioridad']
        
        cursor.execute("""
            INSERT INTO visitas_tecnicas (
                creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia_horaria, 
                empresa, contrato, cliente, telefonos, sector, direccion, 
                servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, 
                ventana_inicio_min, ventana_fin_min, estado, prioridad,
                es_instalacion, producto, tipo_instalacion, vendedor, recibido_coordinacion,
                latitud, longitud
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            original['creado_por'], 'NO TECNICO', None, nueva_fecha, original['preferencia_horaria'],
            original['empresa'], original['contrato'], original['cliente'], original['telefonos'], original['sector'], original['direccion'],
            original['servicio'], original['velocidad_mbps'], original['problema'], obs_call_original, original['informacion_tecnico'],
            original['ventana_inicio_min'], original['ventana_fin_min'], prioridad_final,
            original['es_instalacion'], original['producto'], original['tipo_instalacion'], original['vendedor'], original['recibido_coordinacion'],
            original['latitud'], original['longitud']
        ))
        
        conexion.commit()
        return jsonify({"status": "success", "message": "Visita reagendada con éxito."})
    except Exception as e:
        conexion.rollback()
        print(f"Error al reagendar: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@visitas_bp.route('/api/visitas/<int:id_visita>/cancelar', methods=['POST'])
def cancelar_visita(id_visita):
    usuario = obtener_usuario_visitas()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if usuario.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        return jsonify({"status": "error", "message": "No tienes permiso para cancelar visitas."}), 403
    
    estado_cancelacion = request.form.get('estado_cancelacion')
    motivo = request.form.get('motivo')
    
    if estado_cancelacion == 'SOLVENTADA_OTRO_DEP':
        estado_cancelacion = 'SOLVENTADA_REMOTA'
        motivo = f"SOLVENTADO POR OTRO DEPARTAMENTO. {motivo}" if motivo else "SOLVENTADO POR OTRO DEPARTAMENTO"
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        # Guardamos el motivo, cambiamos estado y quitamos al técnico asignado
        query = """
            UPDATE visitas_tecnicas 
            SET estado = %s, resolucion_final = %s, tecnico_principal = 'NO TECNICO' 
            WHERE id_visita = %s
        """
        cursor.execute(query, (estado_cancelacion, motivo, id_visita))
        conexion.commit()
        return jsonify({"status": "success", "message": "Visita cerrada/cancelada exitosamente."})
    except Exception as e:
        print(f"Error al cancelar: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@visitas_bp.route('/api/visitas/<int:id_visita>/reasignar', methods=['POST'])
def reasignar_tecnicos(id_visita):
    usuario = obtener_usuario_visitas()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if usuario.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        return jsonify({"status": "error", "message": "No tienes permiso para reasignar técnicos."}), 403
    
    nuevo_principal = request.form.get('tecnico_principal')
    nuevo_apoyo = request.form.get('tecnico_apoyo') or None # Puede ir vacío
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        query = "UPDATE visitas_tecnicas SET tecnico_principal = %s, tecnico_apoyo = %s WHERE id_visita = %s"
        cursor.execute(query, (nuevo_principal, nuevo_apoyo, id_visita))
        conexion.commit()
        return jsonify({"status": "success", "message": "Técnicos actualizados exitosamente."})
    except Exception as e:
        print(f"Error al reasignar: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@visitas_bp.route('/api/visitas/crear_cambio_fo', methods=['POST'])
def crear_cambio_fo():
    usuario = obtener_usuario_visitas()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    creado_por = usuario.get('user_name') or 'Call Center'
    contrato = request.form.get('contrato')
    cliente = request.form.get('cliente')
    empresa = request.form.get('empresa', 'SERVICABLE')
    servicio = request.form.get('servicio', 'INTERNET_GPON')
    velocidad_mbps = request.form.get('velocidad_mbps') or None
    sector = request.form.get('sector')
    direccion = request.form.get('direccion')
    telefonos = request.form.get('telefonos')
    latitud = request.form.get('latitud') or None
    longitud = request.form.get('longitud') or None
    
    fecha_programada = request.form.get('fecha_programada')
    preferencia_horaria = request.form.get('preferencia_horaria') or 'COORDINAR'
    tecnico_principal = request.form.get('tecnico_principal') or 'NO TECNICO'
    observacion_callcenter = request.form.get('observacion_callcenter') or 'Generado desde revisión técnica previo Cambio de FO'
    id_visita_origen = request.form.get('id_visita_origen')
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        query_insert = """
            INSERT INTO visitas_tecnicas (
                creado_por, tecnico_principal, fecha_programada, preferencia_horaria,
                empresa, contrato, cliente, telefonos, sector, direccion, servicio,
                velocidad_mbps, problema, observacion_callcenter, estado, prioridad,
                latitud, longitud
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'CAMBIO DE FO', %s, 'PENDIENTE', 'ALTA', %s, %s
            )
        """
        cursor.execute(query_insert, (
            f"CC. {creado_por}" if not creado_por.startswith("CC.") else creado_por,
            tecnico_principal,
            fecha_programada,
            preferencia_horaria,
            empresa,
            contrato,
            cliente,
            telefonos,
            sector,
            direccion,
            servicio,
            velocidad_mbps,
            f"[CAMBIO DE FO PROGRAMADO] {observacion_callcenter}",
            latitud,
            longitud
        ))
        
        if id_visita_origen:
            query_update_orig = """
                UPDATE visitas_tecnicas 
                SET resolucion_final = CONCAT(COALESCE(resolucion_final, ''), ' [Cambio de FO Agendado]')
                WHERE id_visita = %s
            """
            cursor.execute(query_update_orig, (id_visita_origen,))
            
        conexion.commit()
        return jsonify({"status": "ok", "message": "Visita de Cambio de FO programada exitosamente."})
    except Exception as e:
        print(f"Error al crear visita Cambio de FO: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()
    return redirect(url_for('dashboard'))