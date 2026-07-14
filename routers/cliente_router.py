from flask import Blueprint, render_template, jsonify, request, url_for
from db_config import get_db_connection

cliente_bp = Blueprint('cliente', __name__)

# ==========================================
# RUTAS PÚBLICAS PARA EL CLIENTE (RASTREO Y CALIFICACIÓN)
# ==========================================

@cliente_bp.route('/rastreo/<token>')
def rastreo_cliente(token):
    """Muestra la página del mapa al cliente o redirige a la encuesta si finalizó."""
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    # Buscamos de quién es este código secreto
    cursor.execute("SELECT tecnico_principal, tecnico_apoyo, estado, cliente FROM visitas_tecnicas WHERE token_rastreo = %s", (token,))
    visita = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not visita:
        return "Este enlace de rastreo no es válido o ya ha caducado.", 404

    if visita['estado'] == 'FINALIZADA':
        from flask import redirect
        return redirect(url_for('cliente.encuesta_cliente', token=token))

    # Le enviamos los datos a la plantilla del mapa
    return render_template('mapa_cliente.html', visita=visita, token=token)


@cliente_bp.route('/encuesta/<token>')
def encuesta_cliente(token):
    """Muestra la encuesta de satisfacción detallada al cliente."""
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    cursor.execute("SELECT tecnico_principal, tecnico_apoyo, estado, cliente FROM visitas_tecnicas WHERE token_rastreo = %s", (token,))
    visita = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not visita:
        return "Este enlace no es válido o ya ha caducado.", 404

    return render_template('encuesta_cliente.html', visita=visita, token=token)


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
    """Permite al cliente calificar la visita una vez que ha finalizado."""
    rapidez = request.form.get('rapidez')
    atencion = request.form.get('atencion')
    explicacion = request.form.get('explicacion')
    comentario = request.form.get('comentario', '')

    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    try:
        if rapidez and atencion and explicacion:
            # Calcular estrellas (1 a 5) en base al promedio de las puntuaciones 1 a 10
            r_val = int(rapidez)
            a_val = int(atencion)
            e_val = int(explicacion)
            promedio_10 = (r_val + a_val + e_val) / 3.0
            estrellas = int(round(promedio_10 / 2.0))
            estrellas = max(1, min(5, estrellas))

            query = """
                UPDATE visitas_tecnicas 
                SET calificacion_estrellas = %s, 
                    calificacion_comentario = %s,
                    encuesta_rapidez = %s,
                    encuesta_atencion = %s,
                    encuesta_explicacion = %s
                WHERE token_rastreo = %s AND estado = 'FINALIZADA'
            """
            cursor.execute(query, (estrellas, comentario, r_val, a_val, e_val, token))
        else:
            # Fallback antiguo de estrellas
            estrellas = request.form.get('estrellas')
            if not estrellas:
                return jsonify({"status": "error", "message": "Faltan datos de calificación"}), 400
            
            query = """
                UPDATE visitas_tecnicas 
                SET calificacion_estrellas = %s, 
                    calificacion_comentario = %s 
                WHERE token_rastreo = %s AND estado = 'FINALIZADA'
            """
            cursor.execute(query, (int(estrellas), comentario, token))

        conexion.commit()
        
        # Validar si se afectó alguna fila (asegurarse de que existe y está finalizada)
        if cursor.rowcount == 0:
            return jsonify({"status": "error", "message": "No se pudo guardar. La visita no existe o no está en estado FINALIZADA."}), 400
            
        return jsonify({"status": "ok", "message": "¡Gracias por tu calificación!"})
        
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
def firmar_remoto(token):
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    cursor.execute("SELECT id_visita, cliente, tecnico_principal, es_instalacion FROM visitas_tecnicas WHERE token_rastreo = %s", (token,))
    visita = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not visita:
        return "El enlace de firma no es válido o ha expirado.", 404

    return render_template('firma_cliente.html', visita=visita, token=token)


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
def publico_cuadro_mando(fecha, token):
    import hashlib
    from datetime import datetime, timedelta
    from flask import current_app, render_template, request
    
    # 1. Validar el token
    secret = current_app.secret_key or "fallback_secret_salt_futurity_2026"
    expected_token = hashlib.sha256(f"{fecha}_{secret}".encode('utf-8')).hexdigest()[:16]
    
    if token != expected_token:
        return render_template('publico_cuadro_mando.html', error="El enlace es inválido, ha expirado o ha sido modificado.", fecha=fecha)
        
    conexion = get_db_connection()
    if not conexion:
        return "Error de conexión a la base de datos", 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        # 1. Obtener la lista de agentes de callcenter activos
        cursor.execute("SELECT nombre FROM callcenter WHERE activo = 1 ORDER BY nombre ASC")
        agentes_list = [row['nombre'] for row in cursor.fetchall()]
        
        # 2. Intentar auto-detectar los 3 agentes más activos en esta fecha
        cursor.execute("""
            SELECT agente, COUNT(*) as c 
            FROM atenciones 
            WHERE fecha = %s AND agente IS NOT NULL AND agente != '' AND agente != 'Importado'
            GROUP BY agente 
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
            
        # Leer agentes de los query parameters, cayendo en los detectados
        agente_a = request.args.get('agente_a', detected_agentes[0])
        agente_b = request.args.get('agente_b', detected_agentes[1])
        agente_c = request.args.get('agente_c', detected_agentes[2])
        
        # Leer soporte manual
        try:
            soporte_a = int(request.args.get('soporte_a', 0))
        except:
            soporte_a = 0
        try:
            soporte_b = int(request.args.get('soporte_b', 0))
        except:
            soporte_b = 0
        try:
            soporte_c = int(request.args.get('soporte_c', 0))
        except:
            soporte_c = 0
            
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
            
        # 4. KPIs de Visitas Técnicas de Campo
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada = %s AND DATE(fecha_registro) < %s AND (estado != 'CANCELADA' OR estado IS NULL)
        """, (fecha, fecha))
        kpi_pendientes_anteriores = cursor.fetchone()['total'] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
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
            WHERE fecha_programada = %s AND (estado != 'CANCELADA' OR estado IS NULL)
        """, (manana,))
        kpi_pendientes_manana = cursor.fetchone()['total'] or 0
        
        kpi_generadas_hoy = max(0, kpi_atendidas_hoy + kpi_pendientes_manana - kpi_pendientes_anteriores)
        kpi_total_carga = kpi_pendientes_anteriores + kpi_generadas_hoy
        
        # 5. Listados de problemas / soluciones
        cursor.execute("""
            SELECT solucion_tecnico, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
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
            WHERE fecha_programada = %s AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA', 'FINALIZADA')
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
        
        return render_template('publico_cuadro_mando.html',
                               fecha=fecha,
                               agente_a=agente_a,
                               agente_b=agente_b,
                               agente_c=agente_c,
                               soporte_a=soporte_a,
                               soporte_b=soporte_b,
                               soporte_c=soporte_c,
                               rows_atenciones=rows_atenciones,
                               agente_totals=agente_totals,
                               total_cc_general=total_cc_general,
                               kpis={
                                   "pendientes_anteriores": kpi_pendientes_anteriores,
                                   "generadas_hoy": kpi_generadas_hoy,
                                   "total_carga": kpi_total_carga,
                                   "atendidas_hoy": kpi_atendidas_hoy,
                                   "pendientes_manana": kpi_pendientes_manana
                               },
                               soluciones=active_soluciones,
                               problemas=active_problemas,
                               visitas_manana=visitas_manana,
                               actividades_tecnicos=actividades_tecnicos)
    except Exception as e:
        return f"Error al procesar el reporte: {str(e)}", 500
    finally:
        cursor.close()
        conexion.close()
