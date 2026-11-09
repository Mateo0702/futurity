from flask import Blueprint, render_template, jsonify, request, url_for
from db_config import get_db_connection

cliente_bp = Blueprint('cliente', __name__)

# ==========================================
# RUTAS PÚBLICAS PARA EL CLIENTE (RASTREO Y CALIFICACIÓN)
# ==========================================

@cliente_bp.route('/rastreo/<token>')
@cliente_bp.route('/seguimiento/<token>')
def rastreo_cliente(token):
    """Muestra la página del mapa al cliente vía React SPA."""
    import os
    from flask import send_from_directory, current_app
    return send_from_directory(os.path.join(current_app.root_path, 'frontend/dist'), 'index.html')


@cliente_bp.route('/descargar')
def descargar_app():
    """Muestra la página de descarga de la app móvil Android vía React SPA."""
    import os
    from flask import send_from_directory, current_app
    return send_from_directory(os.path.join(current_app.root_path, 'frontend/dist'), 'index.html')


@cliente_bp.route('/encuesta/<token>')
def encuesta_cliente(token):
    """Muestra la encuesta de satisfacción detallada al cliente vía React SPA."""
    import os
    from flask import send_from_directory, current_app
    return send_from_directory(os.path.join(current_app.root_path, 'frontend/dist'), 'index.html')


@cliente_bp.route('/api/cliente/encuesta_info/<token>')
def api_encuesta_info(token):
    """Retorna los datos de la visita para alimentar el componente React de encuesta."""
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    cursor.execute("""
        SELECT id_visita, tecnico_principal, tecnico_apoyo, estado, cliente, contrato, telefonos,
               arcotel_p1_trato, calificacion_estrellas
        FROM visitas_tecnicas 
        WHERE token_rastreo = %s
    """, (token,))
    visita = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not visita:
        return jsonify({"status": "error", "message": "Este enlace no es válido o ha expirado."}), 404

    ya_respondida = bool(visita.get('arcotel_p1_trato') is not None or visita.get('calificacion_estrellas') is not None)

    return jsonify({"status": "ok", "visita": visita, "ya_respondida": ya_respondida})


@cliente_bp.route('/api/rastreo_ubicacion/<token>')
def api_rastreo_ubicacion(token):
    conexion = get_db_connection()
    # Asegúrate de usar dictionary=True para poder leer los campos por nombre
    cursor = conexion.cursor(dictionary=True)
    
    # Cruzamos la visita técnica con la tabla de técnicos usando el nombre
    query = """
        SELECT v.*, 
               t1.foto_perfil AS foto_perfil_principal, 
               t1.foto_vehiculo AS foto_vehiculo_principal, 
               t1.placa_vehiculo AS placa_vehiculo_principal,
               t2.foto_perfil AS foto_perfil_apoyo
        FROM visitas_tecnicas v
        LEFT JOIN tecnicos t1 ON v.tecnico_principal = t1.nombre
        LEFT JOIN tecnicos t2 ON v.tecnico_apoyo = t2.nombre
        WHERE v.token_rastreo = %s
    """
    cursor.execute(query, (token,))
    visita = cursor.fetchone()
    
    cursor.close()
    conexion.close()
    
    if visita:
        # Si las columnas de fotos vienen vacías (NULL), usamos las genéricas por defecto
        archivo_perfil_principal = visita['foto_perfil_principal'] if visita.get('foto_perfil_principal') else 'default_avatar.png'
        archivo_vehiculo = visita['foto_vehiculo_principal'] if visita.get('foto_vehiculo_principal') else 'furgoneta_milton.jpeg'
        archivo_perfil_apoyo = visita['foto_perfil_apoyo'] if visita.get('foto_perfil_apoyo') else None
        
        resp = jsonify({
            "status": "ok",
            "lat": float(visita['latitud_gps_vivo']) if visita['latitud_gps_vivo'] else None,
            "lon": float(visita['longitud_gps_vivo']) if visita['longitud_gps_vivo'] else None,
            "estado": visita['estado'],
            "tecnico": visita['tecnico_principal'],
            "tecnico_apoyo": visita['tecnico_apoyo'],
            # url_for genera la ruta web correcta para que el navegador del cliente encuentre el archivo
            "tecnico_foto": url_for('static', filename='uploads/' + archivo_perfil_principal),
            "tecnico_apoyo_foto": url_for('static', filename='uploads/' + archivo_perfil_apoyo) if archivo_perfil_apoyo else None,
            "vehiculo_foto": url_for('static', filename='uploads/' + archivo_vehiculo),
            "placa": visita['placa_vehiculo_principal'] if visita.get('placa_vehiculo_principal') else 'S/P'
        })
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp
        
    return jsonify({"status": "error", "message": "Token no válido"}), 404

@cliente_bp.route('/api/cliente/calificar/<token>', methods=['POST'])
def calificar_visita(token):
    """Permite al cliente calificar la visita con las preguntas oficiales de ARCOTEL."""
    data = request.get_json(silent=True) or request.form or {}

    def parse_rating(val):
        try:
            if val is not None and str(val).strip() != '':
                v = int(val)
                return v if 1 <= v <= 5 else None
        except:
            pass
        return None

    # Parámetros oficiales ARCOTEL (escala 1 a 5)
    p1 = parse_rating(data.get('arcotel_p1_trato') or data.get('p1'))
    p2 = parse_rating(data.get('arcotel_p2_paciencia') or data.get('p2'))
    p3 = parse_rating(data.get('arcotel_p3_disponibilidad') or data.get('p3'))
    p4 = parse_rating(data.get('arcotel_p4_agilidad') or data.get('p4'))
    p5 = parse_rating(data.get('arcotel_p5_tiempo_espera') or data.get('p5'))
    sugerencia = (data.get('arcotel_sugerencia') or data.get('comentario') or data.get('sugerencia') or '').strip()

    # Parámetros legados (escala 1 a 10)
    rapidez_old = data.get('rapidez')
    atencion_old = data.get('atencion')
    explicacion_old = data.get('explicacion')

    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    try:
        if p1 and p2 and p3 and p4 and p5:
            promedio_5 = (p1 + p2 + p3 + p4 + p5) / 5.0
            estrellas = max(1, min(5, int(round(promedio_5))))

            # Compatibilidad legado (escala 1 a 10)
            r_old = p4 * 2
            a_old = p1 * 2
            e_old = p3 * 2

            query = """
                UPDATE visitas_tecnicas 
                SET calificacion_estrellas = %s, 
                    calificacion_comentario = %s,
                    arcotel_p1_trato = %s,
                    arcotel_p2_paciencia = %s,
                    arcotel_p3_disponibilidad = %s,
                    arcotel_p4_agilidad = %s,
                    arcotel_p5_tiempo_espera = %s,
                    arcotel_sugerencia = %s,
                    encuesta_rapidez = %s,
                    encuesta_atencion = %s,
                    encuesta_explicacion = %s
                WHERE token_rastreo = %s
            """
            cursor.execute(query, (
                estrellas, sugerencia,
                p1, p2, p3, p4, p5, sugerencia,
                r_old, a_old, e_old,
                token
            ))
        elif rapidez_old and atencion_old and explicacion_old:
            r_val = int(rapidez_old)
            a_val = int(atencion_old)
            e_val = int(explicacion_old)
            promedio_10 = (r_val + a_val + e_val) / 3.0
            estrellas = max(1, min(5, int(round(promedio_10 / 2.0))))

            p1_c = max(1, min(5, int(round(a_val / 2.0))))
            p2_c = p1_c
            p3_c = max(1, min(5, int(round(e_val / 2.0))))
            p4_c = max(1, min(5, int(round(r_val / 2.0))))
            p5_c = p4_c

            query = """
                UPDATE visitas_tecnicas 
                SET calificacion_estrellas = %s, 
                    calificacion_comentario = %s,
                    encuesta_rapidez = %s,
                    encuesta_atencion = %s,
                    encuesta_explicacion = %s,
                    arcotel_p1_trato = %s,
                    arcotel_p2_paciencia = %s,
                    arcotel_p3_disponibilidad = %s,
                    arcotel_p4_agilidad = %s,
                    arcotel_p5_tiempo_espera = %s,
                    arcotel_sugerencia = %s
                WHERE token_rastreo = %s
            """
            cursor.execute(query, (
                estrellas, sugerencia,
                r_val, a_val, e_val,
                p1_c, p2_c, p3_c, p4_c, p5_c, sugerencia,
                token
            ))
        else:
            return jsonify({"status": "error", "message": "Por favor complete todas las preguntas de la encuesta."}), 400

        conexion.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "error", "message": "No se encontró el registro para esta encuesta."}), 404
            
        return jsonify({"status": "ok", "message": "¡Muchas gracias por su calificación!"})
        
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@cliente_bp.route('/api/geocode')
def api_geocode():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    import urllib.request
    import urllib.parse
    import json
    
    url = f"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={urllib.parse.quote(query)}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'FuturityControlCenter/1.0 (mateo@futurity.com.ec)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                return jsonify(data)
            return jsonify([])
    except Exception as e:
        print(f"Error in server geocode api: {e}")
        return jsonify([])


@cliente_bp.route('/firmar/<token>')
@cliente_bp.route('/firma-remota/<token>')
def firmar_remoto(token):
    import os
    from flask import send_from_directory, current_app
    return send_from_directory(os.path.join(current_app.root_path, 'frontend/dist'), 'index.html')


@cliente_bp.route('/api/cliente/firma_info/<token>')
def api_firma_info(token):
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    cursor.execute("SELECT id_visita, cliente, tecnico_principal, tecnico_apoyo, es_instalacion FROM visitas_tecnicas WHERE token_rastreo = %s", (token,))
    visita = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not visita:
        return jsonify({"status": "error", "message": "El enlace de firma no es válido o ha expirado."}), 404

    return jsonify({"status": "ok", "visita": visita})


@cliente_bp.route('/api/cliente/firmar/<token>', methods=['POST'])
def guardar_firma_remota(token):
    import os
    import base64

    datos = request.get_json() or {}
    b64_string = datos.get('firma_base64')
    if not b64_string:
        return jsonify({"status": "error", "message": "Falta la firma"}), 400

    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id_visita FROM visitas_tecnicas WHERE token_rastreo = %s", (token,))
        visita = cursor.fetchone()
        if not visita:
            return jsonify({"status": "error", "message": "Token inválido o expirado"}), 404
        
        id_visita = visita['id_visita']

        uploads_dir = os.path.join('static', 'uploads')
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)

        if ',' in b64_string:
            b64_string = b64_string.split(',')[1]

        img_data = base64.b64decode(b64_string)
        filename = f"firma_{id_visita}.png"
        filepath = os.path.join(uploads_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(img_data)

        cursor.execute("UPDATE visitas_tecnicas SET firma_cliente = %s WHERE id_visita = %s", (filename, id_visita))
        conexion.commit()

        return jsonify({"status": "ok", "message": "Firma guardada con éxito."})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@cliente_bp.route('/publico/cuadro_mando/<fecha>/<token>')
def publico_cuadro_mando_view(fecha, token):
    import os
    from flask import send_from_directory, current_app
    return send_from_directory(os.path.join(current_app.root_path, 'frontend/dist'), 'index.html')


@cliente_bp.route('/api/publico/cuadro_mando/<fecha>/<token>', methods=['GET'])
def publico_cuadro_mando(fecha, token):
    import hashlib
    from datetime import datetime, timedelta
    from flask import current_app, request, jsonify

    # 1. Validar el token
    secret = current_app.secret_key or "fallback_secret_salt_futurity_2026"
    expected_token = hashlib.sha256(f"{fecha}_{secret}".encode('utf-8')).hexdigest()[:16]
    
    if token != expected_token:
        return jsonify({"status": "error", "message": "El enlace es inválido, ha expirado o ha sido modificado."}), 403
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        # 1. Obtener la lista de agentes de callcenter activos
        cursor.execute("SELECT nombre FROM callcenter WHERE activo = 1 ORDER BY nombre ASC")
        agentes_list = [row['nombre'] for row in cursor.fetchall()]
        
        # 1.5. Consultar si existe configuración previamente guardada para esta fecha
        cursor.execute("""
            SELECT agente_a, agente_b, agente_c, horario_a, horario_b, horario_c, soporte_a, soporte_b, soporte_c
            FROM cuadro_mando_config
            WHERE fecha = %s
        """, (fecha,))
        saved = cursor.fetchone() or {}

        # 2. Intentar auto-detectar los 3 agentes más activos en esta fecha (exclusivamente Call Center)
        cursor.execute("""
            SELECT a.agente, COUNT(*) as c 
            FROM atenciones a
            INNER JOIN callcenter cc ON a.agente = cc.nombre COLLATE utf8mb4_0900_ai_ci
            WHERE a.fecha = %s AND cc.activo = 1
            GROUP BY a.agente 
            ORDER BY c DESC 
            LIMIT 3
        """, (fecha,))
        detected_rows = cursor.fetchall()
        detected_agentes = [r['agente'] for r in detected_rows]
        
        # Rellenar con valores por defecto si no hay suficientes agentes
        default_agents = ['CC. Luis Saenz', 'CC. Guissella Quezada', 'CC. Mateo Samaniego']
        for default in default_agents:
            if len(detected_agentes) >= 3:
                break
            if default not in detected_agentes:
                detected_agentes.append(default)
        
        # Asegurar longitud 3
        while len(detected_agentes) < 3:
            detected_agentes.append('Sin asignar')
            
        # Leer agentes: prioridad query param -> config guardada -> detectados
        agente_a = request.args.get('agente_a') or saved.get('agente_a') or detected_agentes[0]
        agente_b = request.args.get('agente_b') or saved.get('agente_b') or detected_agentes[1]
        agente_c = request.args.get('agente_c') or saved.get('agente_c') or detected_agentes[2]
        
        horario_a = request.args.get('horario_a') or saved.get('horario_a') or '7 AM - 4 PM'
        horario_b = request.args.get('horario_b') or saved.get('horario_b') or '2 PM - 9 PM'
        horario_c = request.args.get('horario_c') or saved.get('horario_c') or '10 AM - 8 PM'

        def parse_soporte(val, fallback):
            if val is not None and str(val).strip() != '':
                try:
                    return int(val)
                except (ValueError, TypeError):
                    pass
            if fallback is not None:
                try:
                    return int(fallback)
                except (ValueError, TypeError):
                    pass
            return 0

        soporte_a = parse_soporte(request.args.get('soporte_a'), saved.get('soporte_a'))
        soporte_b = parse_soporte(request.args.get('soporte_b'), saved.get('soporte_b'))
        soporte_c = parse_soporte(request.args.get('soporte_c'), saved.get('soporte_c'))
            
        agentes = [agente_a, agente_b, agente_c]
        
        # 3. Contar gestiones por agente y categoría
        atenciones_data = {
            'visitas_coordinadas': [0, 0, 0],
            'solventado_llamada': [0, 0, 0],
            'solventado_mensajes': [0, 0, 0],
            'solventado_oficina': [0, 0, 0],
            'otros': [0, 0, 0]
        }
        
        for i, ag in enumerate(agentes):
            if not ag or ag == 'Sin asignar':
                continue
            # Visitas Coordinadas
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA')
            """, (fecha, ag))
            atenciones_data['visitas_coordinadas'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado por Llamada
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion = 'SOPORTE MEDIANTE LLAMADA'
            """, (fecha, ag))
            atenciones_data['solventado_llamada'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado por Mensajes
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion = 'SOPORTE MEDIANTE MENSAJES'
            """, (fecha, ag))
            atenciones_data['solventado_mensajes'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado en Oficina
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND medio_contacto = 'OFICINA'
                  AND (accion NOT IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA') OR accion IS NULL)
            """, (fecha, ag))
            atenciones_data['solventado_oficina'][i] = cursor.fetchone()['total'] or 0
            
            # Info / Transferencia / Otros
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s 
                  AND (accion NOT IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA', 'SOPORTE MEDIANTE LLAMADA', 'SOPORTE MEDIANTE MENSAJES') OR accion IS NULL)
                  AND (medio_contacto != 'OFICINA' OR medio_contacto IS NULL)
            """, (fecha, ag))
            atenciones_data['otros'][i] = cursor.fetchone()['total'] or 0
            
        # 4. KPIs de Visitas Técnicas de Campo (Solo Daños/Soporte)
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada = %s AND DATE(fecha_registro) < %s AND (estado != 'CANCELADA' OR estado IS NULL)
              AND (es_instalacion = 0 OR es_instalacion IS NULL)
        """, (fecha, fecha))
        kpi_pendientes_anteriores = cursor.fetchone()['total'] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND (es_instalacion = 0 OR es_instalacion IS NULL)
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE'
              )
        """, (fecha,))
        kpi_atendidas_hoy = cursor.fetchone()['total'] or 0
        
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        manana = (fecha_dt + timedelta(days=1)).isoformat()
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada = %s AND (estado = 'PENDIENTE' OR estado IS NULL)
              AND (es_instalacion = 0 OR es_instalacion IS NULL)
        """, (manana,))
        kpi_pendientes_manana = cursor.fetchone()['total'] or 0
        
        kpi_generadas_hoy = max(0, kpi_atendidas_hoy + kpi_pendientes_manana - kpi_pendientes_anteriores)
        kpi_total_carga = kpi_pendientes_anteriores + kpi_generadas_hoy
        
        # 5. Listados de problemas / soluciones (Solo Daños/Soporte)
        cursor.execute("""
            SELECT solucion_tecnico, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND (es_instalacion = 0 OR es_instalacion IS NULL)
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE'
              )
            GROUP BY solucion_tecnico
        """, (fecha,))
        soluciones_rows = cursor.fetchall()
        
        from routers.admin_router import map_solucion, map_problema
        
        soluciones_dict = {
            "CAMBIO DE FIBRA REALIZADO": 0,
            "SE COORDINA CAMBIO DE UTP / FIBRA": 0,
            "CAMBIO DE CABLE UTP / RG6": 0,
            "FISICO / CAMBIO DE CONECTORES APC-UPC O RG6": 0,
            "FISICO / CAMBIO DE ONU EN MAL ESTADO": 0,
            "LÓGICO / CONFIGURACIÓN DE EQUIPOS": 0,
            "INSPECCIÓN / SOLUCIÓN PARCIAL": 0,
            "RADIO ENLACE / DOMÓTICA": 0,
            "FISICO / CAMBIO DE ADAPTADOR DE CORRIENTE": 0,
            "ARREGLO DE INSTALACIÓN / REUBICACIÓN DE EQUIPOS / RETENCIÓN": 0,
            "INSTALACIÓN EFECTIVA / CAMBIO DE ROUTER": 0,
            "TICKET A TECNOLOGÍA, DAÑO RADIAL": 0,
            "TICKET A TECNOLOGÍA, DAÑO FTTH": 0,
            "TICKET A TECNOLOGÍA, DAÑO HFC": 0
        }
        
        for r in soluciones_rows:
            mapped = map_solucion(r['solucion_tecnico'])
            if mapped in soluciones_dict:
                soluciones_dict[mapped] += r['cantidad']
                
        cursor.execute("""
            SELECT problema, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
              AND (es_instalacion = 0 OR es_instalacion IS NULL)
              AND problema IS NOT NULL AND problema != ''
            GROUP BY problema
        """, (manana,))
        problemas_rows = cursor.fetchall()
        
        problemas_dict = {
            "CAMBIOS DE FIBRA A REALIZAR": 0,
            "VERIFICAR INSTACION": 0,
            "EQUIPOS ALARMADOS": 0,
            "REVISION DE ONT": 0,
            "LENTITUD EN EL SERVICIO": 0,
            "REVISION DE SERVICIO/COBERTURA": 0,
            "ACTUALIZACIÓN DE EQUIPO / COLOCACIÓN ROUTER": 0,
            "NO MARCA VELOCIDAD CONTRATADA": 0,
            "REUBICACION DE EQUIPOS": 0,
            "VT COBRADA / MANIPULACION DEL CLI": 0,
            "ACTIVAR STREAMING": 0,
            "CANALES BORROSOS": 0,
            "POTENCIA DEGRADADA (GPON)": 0,
            "RETENCIÓN": 0
        }
        
        for r in problemas_rows:
            mapped = map_problema(r['problema'])
            if mapped in problemas_dict:
                problemas_dict[mapped] += r['cantidad']
                
        # Construir tablas en Python para pasarlas al template
        at = atenciones_data
        rows_atenciones = [
            { "label": "VISITAS COORDINADAS", "vals": [at['visitas_coordinadas'][0], at['visitas_coordinadas'][1], at['visitas_coordinadas'][2]], "total": sum(at['visitas_coordinadas']) },
            { "label": "SOLVENTADO POR LLAMADA", "vals": [at['solventado_llamada'][0], at['solventado_llamada'][1], at['solventado_llamada'][2]], "total": sum(at['solventado_llamada']) },
            { "label": "SOLVENTADO POR MENSAJES", "vals": [at['solventado_mensajes'][0], at['solventado_mensajes'][1], at['solventado_mensajes'][2]], "total": sum(at['solventado_mensajes']) },
            { "label": "SOLVENTADO EN OFICINA", "vals": [at['solventado_oficina'][0], at['solventado_oficina'][1], at['solventado_oficina'][2]], "total": sum(at['solventado_oficina']) },
            { "label": "SOPORTE A TÉCNICOS VT / INST", "vals": [soporte_a, soporte_b, soporte_c], "total": (soporte_a + soporte_b + soporte_c) },
            { "label": "INFO / TRANSFERENCIAS - OTROS", "vals": [at['otros'][0], at['otros'][1], at['otros'][2]], "total": sum(at['otros']) }
        ]
        
        agente_totals = [
            rows_atenciones[0]["vals"][0] + rows_atenciones[1]["vals"][0] + rows_atenciones[2]["vals"][0] + rows_atenciones[3]["vals"][0] + rows_atenciones[4]["vals"][0] + rows_atenciones[5]["vals"][0],
            rows_atenciones[0]["vals"][1] + rows_atenciones[1]["vals"][1] + rows_atenciones[2]["vals"][1] + rows_atenciones[3]["vals"][1] + rows_atenciones[4]["vals"][1] + rows_atenciones[5]["vals"][1],
            rows_atenciones[0]["vals"][2] + rows_atenciones[1]["vals"][2] + rows_atenciones[2]["vals"][2] + rows_atenciones[3]["vals"][2] + rows_atenciones[4]["vals"][2] + rows_atenciones[5]["vals"][2]
        ]
        total_cc_general = sum(agente_totals)
        
        # Filtrar soluciones y problemas con valor > 0 para mostrarlas en tablas compactas
        active_soluciones = {k: v for k, v in soluciones_dict.items() if v > 0}
        active_problemas = {k: v for k, v in problemas_dict.items() if v > 0}
        
        # 4.5. Obtener visitas para mañana (Reporte 2)
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        target_date = (fecha_dt + timedelta(days=1)).isoformat()
        cursor.execute("""
            SELECT 
                id_visita,
                fecha_registro,
                cliente,
                sector,
                problema,
                estado
            FROM visitas_tecnicas
            WHERE fecha_programada = %s 
              AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA', 'FINALIZADA')
              AND (es_instalacion = 0 OR es_instalacion IS NULL)
              AND (problema NOT LIKE '%INSTALACION NUEVA%' AND problema NOT LIKE '%INSTALACIÓN NUEVA%' OR problema IS NULL)
        """, (target_date,))
        visitas_manana = cursor.fetchall()
        
        # 4.6. Obtener actividades de técnicos de hoy (Reporte 3)
        cursor.execute("""
            SELECT 
                tecnico_principal,
                tecnico_apoyo,
                solucion_tecnico,
                es_instalacion,
                COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE'
              )
            GROUP BY tecnico_principal, tecnico_apoyo, solucion_tecnico, es_instalacion
            ORDER BY tecnico_principal, tecnico_apoyo, cantidad DESC
        """, (fecha,))
        actividades_tecnicos = cursor.fetchall()
        
        for v in visitas_manana:
            if v.get('fecha_registro'):
                v['fecha_registro'] = v['fecha_registro'].isoformat() if hasattr(v['fecha_registro'], 'isoformat') else str(v['fecha_registro'])
        
        return jsonify({
            "status": "ok",
            "fecha": fecha,
            "agente_a": agente_a,
            "agente_b": agente_b,
            "agente_c": agente_c,
            "horario_a": horario_a,
            "horario_b": horario_b,
            "horario_c": horario_c,
            "soporte_a": soporte_a,
            "soporte_b": soporte_b,
            "soporte_c": soporte_c,
            "rows_atenciones": rows_atenciones,
            "agente_totals": agente_totals,
            "total_cc_general": total_cc_general,
            "kpis": {
                "pendientes_anteriores": kpi_pendientes_anteriores,
                "generadas_hoy": kpi_generadas_hoy,
                "total_carga": kpi_total_carga,
                "atendidas_hoy": kpi_atendidas_hoy,
                "pendientes_manana": kpi_pendientes_manana
            },
            "soluciones": active_soluciones,
            "problemas": active_problemas,
            "visitas_manana": visitas_manana,
            "actividades_tecnicos": actividades_tecnicos
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error al procesar el reporte: {str(e)}"}), 500
    finally:
        cursor.close()
        conexion.close()


# ==========================================
# RUTAS DE INTEGRACIÓN CON BASE CENTRAL (192.168.232.5:85)
# ==========================================
import urllib.request
import urllib.error
import json
import re
from utils import MAPEO_NODOS

def _normalizar_telefono_ec(tel):
    if not tel:
        return ""
    t = str(tel).strip()
    if t.endswith('.0') or t.endswith(',0'):
        t = t[:-2]
    t = re.sub(r'[^\d]', '', t)
    if t.startswith('593') and len(t) == 12:
        t = '0' + t[3:]
    return t

def _extraer_velocidad_mbps(servicios_str):
    if not servicios_str:
        return None
    m_act = re.search(r'VELOCIDAD\s+ACTUAL\s+(\d+)', servicios_str, re.IGNORECASE)
    if m_act:
        try:
            return int(m_act.group(1))
        except:
            pass
    m = re.search(r'(\d+)\s*(?:MEGAS|MB)', servicios_str, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except:
            pass
    return None

def _extraer_servicios_concatenados(detalles):
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

def _consultar_api_central(cedula):
    cedula_clean = re.sub(r'[^a-zA-Z0-9]', '', str(cedula or '').strip())
    if not cedula_clean or len(cedula_clean) < 3:
        return {"status": "error", "message": "Identificación o código inválido (mínimo 3 caracteres)"}

    url = f"http://192.168.232.5:85/api/contratosclientes?codigo={cedula_clean}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Futurity-Atlas/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            raw_data = response.read().decode('utf-8')
            data = json.loads(raw_data)
            return {"status": "ok", "data": data}
    except urllib.error.HTTPError as e:
        return {"status": "not_found", "message": "Cliente no encontrado en la Base Central."}
    except urllib.error.URLError as e:
        return {"status": "connection_error", "message": f"No se pudo conectar a la Base Central (192.168.232.5:85): {e.reason}"}
    except Exception as e:
        return {"status": "error", "message": f"Error al consultar la Base Central: {str(e)}"}

def _es_contrato_fibracom(num_contrato, ip_maestro='', nombre_zona='', conn=None, cedula=''):
    """
    Determina de manera confiable si un contrato pertenece a FIBRACOM o SERVICABLE.
    """
    if num_contrato and str(num_contrato).strip().upper().endswith('F'):
        return True
        
    num_clean = re.sub(r'[^0-9a-zA-Z]', '', str(num_contrato).strip())
    num_plain = num_clean[:-1] if num_clean.upper().endswith('F') else num_clean
    num_with_f = num_plain + 'F'

    # 1. Si ya existe en la base local este contrato específico para esta cédula o este número exacto
    if conn:
        try:
            cur = conn.cursor(dictionary=True)
            # Primero: ¿Existe este contrato registrado para esta cédula en específico?
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

            # Segundo: ¿Existe el contrato plano exacto en la base local (ej: '458')?
            cur.execute("""
                SELECT contrato, empresa, cedula FROM directorio_clientes 
                WHERE contrato = %s
                LIMIT 1
            """, (num_plain,))
            row_exact = cur.fetchone()
            if row_exact:
                emp = (row_exact.get('empresa') or '').upper()
                # Si coincide con la cédula o no hay cédula en BD, respetar la empresa local
                if not cedula or not row_exact.get('cedula') or str(row_exact.get('cedula')).strip() == str(cedula).strip():
                    cur.close()
                    if emp == 'SERVICABLE':
                        return False
                    elif emp == 'FIBRACOM':
                        return True

            # Tercero: ¿Existe con sufijo 'F' (ej: '458F') pero EXCLUSIVAMENTE para esta misma cédula?
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

    # 2. Detección por IP del Nodo / OLT Maestro de Fibracom
    ip = str(ip_maestro or '').strip()
    if ip in ('100.64.21.2', '10.64.20.2', '100.64.20.2') or ip.startswith('100.64.') or ip.startswith('10.64.'):
        return True

    # 3. Detección por Zona geográfica de Fibracom
    zona = str(nombre_zona or '').upper()
    if any(z in zona for z in ['SANTA ANA', 'VALLE', 'EL VALLE']):
        return True

    return False

def _mapear_contrato_central(contrato_item, cliente_nombres, cliente_cedula, conn=None, contrato_buscado=''):
    raw_num = str(contrato_item.get('numerocontrato') or '').strip()
    ip_nodo = contrato_item.get('ipmaestro') or ''
    nombre_zona = contrato_item.get('nombrezona') or ''
    
    # Determinar si es Fibracom usando el número REAL de contrato de este ítem
    is_fib = _es_contrato_fibracom(
        num_contrato=raw_num,
        ip_maestro=ip_nodo,
        nombre_zona=nombre_zona,
        conn=conn,
        cedula=cliente_cedula
    )
    
    raw_num_plain = raw_num[:-1] if raw_num.upper().endswith('F') else raw_num
    num_contrato = (raw_num_plain + 'F') if is_fib else raw_num_plain
    empresa_default = "FIBRACOM" if is_fib else "SERVICABLE"
    
    tel_raw = contrato_item.get('telefonolocal') or ''
    tel_clean = _normalizar_telefono_ec(tel_raw)
    
    detalles = contrato_item.get('detalles') or []
    servicios = _extraer_servicios_concatenados(detalles)
    if not servicios:
        servicios = str(contrato_item.get('servicios') or contrato_item.get('servicio') or contrato_item.get('producto') or '').strip()
    vel_mbps = _extraer_velocidad_mbps(servicios)
    
    local_info = None
    if conn and num_contrato:
        try:
            c_check = conn.cursor(dictionary=True)
            # Buscar en directorio local dando prioridad a la coincidencia con este cliente y contrato
            c_check.execute("""
                SELECT * FROM directorio_clientes 
                WHERE (contrato = %s OR contrato = %s)
                  AND (cedula = %s OR cedula IS NULL OR cedula = '')
                ORDER BY (contrato = %s) DESC, (cedula = %s) DESC
                LIMIT 1
            """, (num_contrato, raw_num_plain, cliente_cedula, num_contrato, cliente_cedula))
            local_info = c_check.fetchone()
            c_check.close()
        except Exception:
            pass

    nodo_nom = MAPEO_NODOS.get(ip_nodo, ip_nodo)
    empresa_final = local_info.get('empresa') if local_info and local_info.get('empresa') else empresa_default
    if is_fib:
        empresa_final = 'FIBRACOM'
    elif empresa_default == 'SERVICABLE':
        empresa_final = 'SERVICABLE'
    
    return {
        "contrato": num_contrato,
        "cliente": cliente_nombres,
        "cedula": cliente_cedula,
        "empresa": empresa_final,
        "direccion": contrato_item.get('direccionlocal') or (local_info.get('direccion') if local_info else ""),
        "sector": contrato_item.get('nombrezona') or (local_info.get('zona') if local_info else ""),
        "zona_excel": contrato_item.get('nombrezona') or (local_info.get('zona') if local_info else ""),
        "telefono1": tel_clean or (local_info.get('telefono1') if local_info else ""),
        "telefono2": local_info.get('telefono2') if local_info else "",
        "telefono3": local_info.get('telefono3') if local_info else "",
        "telefonos": tel_clean or (local_info.get('telefono1') if local_info else ""),
        "total_mensual": float(contrato_item.get('valormensual')) if contrato_item.get('valormensual') is not None else (float(local_info.get('total_mensual')) if local_info and local_info.get('total_mensual') is not None else None),
        "estado": contrato_item.get('estadoContrato') or (local_info.get('estado') if local_info else "ACTIVO"),
        "producto": servicios or (local_info.get('producto') if local_info else ""),
        "velocidad_mbps": vel_mbps if vel_mbps is not None else (local_info.get('velocidad_mbps') if local_info else None),
        "ip_cliente": contrato_item.get('ipcliente') or (local_info.get('ip_cliente') if local_info else ""),
        "ip_nodo": ip_nodo or (local_info.get('ip_nodo') if local_info else ""),
        "nodo_nombre": nodo_nom,
        "deudatotal": float(contrato_item.get('deudatotal')) if contrato_item.get('deudatotal') is not None else 0.0,
        "cantidadDeuda": float(contrato_item.get('cantidadDeuda')) if contrato_item.get('cantidadDeuda') is not None else 0.0,
        "deudaspendiente": contrato_item.get('deudaspendiente') or [],
        "ordenesServiciosTecnico": contrato_item.get('ordenesServiciosTecnico') or [],
        "numero_serie": (local_info.get('numero_serie') if local_info and local_info.get('numero_serie') else "") or "S/N",
        "modelo_ont": local_info.get('modelo_ont') if local_info else "",
        "router_principal": local_info.get('router_principal') if local_info else "",
        "numero_serie_router": local_info.get('numero_serie_router') if local_info else "",
        "router_secundario": local_info.get('router_secundario') if local_info else "",
        "numero_serie_router_secundario": local_info.get('numero_serie_router_secundario') if local_info else "",
        "tipo_mesh": local_info.get('tipo_mesh') if local_info else "",
        "cantidad_routers": local_info.get('cantidad_routers') if local_info and local_info.get('cantidad_routers') else 1,
        "modo_acceso": local_info.get('modo_acceso') if local_info else "",
        "fecha_instalacion": str(local_info.get('fecha_instalacion'))[:10] if local_info and local_info.get('fecha_instalacion') else "",
        "existe_local": bool(local_info)
    }

@cliente_bp.route('/api/cliente/consultar_base_central', methods=['GET'])
def api_consultar_base_central():
    cedula = (request.args.get('cedula') or request.args.get('codigo') or '').strip()
    contrato = request.args.get('contrato', '').strip()
    
    if not cedula:
        return jsonify({"status": "error", "message": "Por favor ingrese una identificación, cédula, RUC o código para consultar."}), 400

    res_central = _consultar_api_central(cedula)
    if res_central.get('status') != 'ok':
        code = 404 if res_central.get('status') == 'not_found' else 500
        return jsonify(res_central), code

    data = res_central.get('data') or {}
    cliente_nombres = data.get('nombres', '').strip()
    cliente_cedula = data.get('cedula', '').strip() or cedula
    
    conn = get_db_connection()
    contratos_parsed = []
    try:
        for c_item in data.get('infocontratos', []):
            mapped = _mapear_contrato_central(
                c_item, cliente_nombres, cliente_cedula, conn=conn, contrato_buscado=contrato
            )
            contratos_parsed.append(mapped)
    finally:
        if conn and conn.is_connected():
            conn.close()

    # Si se especificó un contrato, marcarlo o priorizarlo (ignorando mayúsculas y sufijo F si aplica)
    if contrato:
        contrato_plain = contrato[:-1].upper() if contrato.upper().endswith('F') else contrato.upper()
        for c in contratos_parsed:
            c_plain = c['contrato'][:-1].upper() if c['contrato'].upper().endswith('F') else c['contrato'].upper()
            if c['contrato'].upper() == contrato.upper() or c_plain == contrato_plain:
                c['seleccionado'] = True

    return jsonify({
        "status": "success",
        "cliente": {
            "nombres": cliente_nombres,
            "cedula": cliente_cedula,
            "id_central": data.get('id', '')
        },
        "contratos": contratos_parsed
    })

@cliente_bp.route('/api/cliente/importar_base_central', methods=['POST'])
def api_importar_base_central():
    req_data = request.get_json(silent=True) or request.form or {}
    cedula = str(req_data.get('cedula') or req_data.get('codigo') or '').strip()
    contrato_req = str(req_data.get('contrato') or '').strip()

    if not cedula or not contrato_req:
        return jsonify({"status": "error", "message": "Identificación/cédula y número de contrato son requeridos para importar."}), 400

    res_central = _consultar_api_central(cedula)
    if res_central.get('status') != 'ok':
        code = 404 if res_central.get('status') == 'not_found' else 500
        return jsonify(res_central), code

    data = res_central.get('data') or {}
    cliente_nombres = data.get('nombres', '').strip()
    cliente_cedula = data.get('cedula', '').strip() or cedula
    
    # Buscar el contrato en la respuesta central ignorando sufijo F
    req_plain = contrato_req[:-1] if contrato_req.upper().endswith('F') else contrato_req
    target_item = None
    for c_item in data.get('infocontratos', []):
        c_num = str(c_item.get('numerocontrato', '')).strip()
        c_num_plain = c_num[:-1] if c_num.upper().endswith('F') else c_num
        if c_num == contrato_req or c_num_plain == req_plain:
            target_item = c_item
            break
            
    if not target_item:
        if len(data.get('infocontratos', [])) == 1:
            target_item = data['infocontratos'][0]
        else:
            return jsonify({"status": "error", "message": f"El contrato #{contrato_req} no se encontró dentro de los contratos de la cédula {cedula}."}), 404

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos local."}), 500

    raw_central_num = str(target_item.get('numerocontrato', '')).strip()
    raw_plain = raw_central_num[:-1] if raw_central_num.upper().endswith('F') else raw_central_num
    
    # Evaluar si es FIBRACOM
    is_fib = _es_contrato_fibracom(
        num_contrato=contrato_req or raw_central_num,
        ip_maestro=target_item.get('ipmaestro', ''),
        nombre_zona=target_item.get('nombrezona', ''),
        conn=conn,
        cedula=cliente_cedula
    )
    
    contrato_atlas = (raw_plain + 'F') if is_fib else raw_plain
    empresa_atlas = 'FIBRACOM' if is_fib else 'SERVICABLE'

    tel_raw = target_item.get('telefonolocal') or ''
    tel_clean = _normalizar_telefono_ec(tel_raw)
    detalles = target_item.get('detalles') or []
    servicios = _extraer_servicios_concatenados(detalles)
    if not servicios:
        servicios = str(target_item.get('servicios') or target_item.get('servicio') or target_item.get('producto') or '').strip()
    vel_mbps = _extraer_velocidad_mbps(servicios)

    try:
        cursor = conn.cursor(dictionary=True)
        
        # Si es Fibracom y existía un duplicado sin 'F' para esta cédula (ej: '451'), eliminar el duplicado huérfano
        if is_fib:
            cursor.execute("""
                DELETE FROM directorio_clientes 
                WHERE contrato = %s AND cedula = %s AND empresa != 'FIBRACOM'
            """, (raw_plain, cliente_cedula))

        query = """
            INSERT INTO directorio_clientes (
                contrato, empresa, producto, estado, forma_pago,
                nombre_cliente, direccion, zona, telefono1, total_mensual,
                cedula, velocidad_mbps, ip_cliente, ip_nodo
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s
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
                velocidad_mbps = COALESCE(VALUES(velocidad_mbps), velocidad_mbps)
        """
        cursor.execute(query, (
            contrato_atlas,
            empresa_atlas,
            servicios,
            target_item.get('estadoContrato', 'ACTIVO'),
            'N/D',
            cliente_nombres,
            target_item.get('direccionlocal', ''),
            target_item.get('nombrezona', ''),
            tel_clean,
            target_item.get('valormensual'),
            cliente_cedula,
            vel_mbps,
            target_item.get('ipcliente', ''),
            target_item.get('ipmaestro', '')
        ))
        conn.commit()

        mapped_client = _mapear_contrato_central(
            target_item, cliente_nombres, cliente_cedula, conn=conn, contrato_buscado=contrato_atlas
        )

        return jsonify({
            "status": "success",
            "message": f"Contrato #{contrato_atlas} ({empresa_atlas}) sincronizado exitosamente en la base local.",
            "cliente": mapped_client
        })

    except Exception as e:
        if conn and conn.is_connected():
            conn.rollback()
        return jsonify({"status": "error", "message": f"Error al guardar en base local: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


