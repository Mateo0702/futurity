import secrets # IMPORTANTE: Añade esto arriba para generar el token seguro
from flask import Blueprint, request, redirect, url_for, render_template, jsonify, session
from db_config import get_db_connection
from datetime import date
import re
import os
import base64
from utils import parsear_informacion_tecnica

tecnico_bp = Blueprint('tecnico', __name__)

NUMERO_GRUA = "0958672088"

def interpretar_preferencia_horaria(texto):
    if not texto:
        return 9999 # Sin hora va al final
    
    texto = str(texto).lower()
    # Buscar números en el texto (ej: "a las 10", "10h00", "10:30")
    import re
    match = re.search(r'(\d{1,2})', texto)
    if match:
        hora = int(match.group(1))
        # Lógica para Cuenca: si ponen 1, 2, 3... suele ser PM (tarde)
        if 1 <= hora <= 7:
            hora += 12
        return hora
    return 9999


@tecnico_bp.route('/tecnico/<nombre_tecnico>')
def panel_tecnico(nombre_tecnico):
    # Validar que esté logueado
    if 'user_id' not in session:
        from flask import redirect, url_for
        return redirect(url_for('login'))
        
    rol = session.get('user_role')
    nombre_usuario = session.get('user_name', '')
    
    nombre_real = nombre_tecnico.replace('_', ' ')
    
    # Si es rol TECNICO, solo puede ver su propio panel
    if rol == 'TECNICO' and nombre_usuario != nombre_real:
        from flask import flash
        flash('No tienes permiso para acceder al panel de otro técnico.', 'danger')
        nombre_propio_url = nombre_usuario.replace(' ', '_')
        return redirect(url_for('tecnico.panel_tecnico', nombre_tecnico=nombre_propio_url))
    
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    
    hoy = date.today().isoformat()
    
    # 1. CAMBIO CLAVE: Traemos TODAS las visitas de la empresa de HOY (Quitamos el filtro de técnico aquí)
    query = """
        SELECT * FROM visitas_tecnicas 
        WHERE fecha_programada = %s 
        AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA')
    """
    cursor.execute(query, (hoy,))
    todas_las_visitas = cursor.fetchall()
    
    # =========================================================
    # EL MOTOR OPTIMIZADOR EN VIVO (Aplica a nivel empresa)
    # =========================================================
    def peso_orden(v):
        if v['estado'] in ['EN_PROGRESO', 'EN_RUTA']:
            estado_val = 0 
        elif v['estado'] == 'FINALIZADA':
            estado_val = 9 
        else:
            estado_val = 1 

        prioridad_val = {'ALTA': 1, 'MEDIA': 2, 'BAJA': 3}.get(v.get('prioridad', 'MEDIA'), 2)
        hora_val = interpretar_preferencia_horaria(v.get('preferencia_horaria', ''))

        return (estado_val, prioridad_val, hora_val, v['id_visita'])

    # 2. Ordenamos todas las visitas del día
    todas_las_visitas.sort(key=peso_orden)
    
    # 3. Enumeramos globalmente (Esta será la Parada #1, Parada #2, etc. para toda la empresa)
    for indice, visita in enumerate(todas_las_visitas, start=1):
        visita['numero_parada'] = indice

    # 4. FILTRO FINAL: Extraemos solo las que le corresponden a este técnico en específico
    visitas_del_tecnico = [
        v for v in todas_las_visitas 
        if v.get('tecnico_principal') == nombre_real or v.get('tecnico_apoyo') == nombre_real
    ]
    
    # --- Carga de catálogos y soluciones (Queda igual) ---
    soluciones = obtener_soluciones_activas()
    
    cursor.execute("SELECT * FROM materiales ORDER BY nombre_material ASC")
    catalogo_materiales = cursor.fetchall()
    
    cursor.execute("SELECT nombre FROM catalogo_modelos_ont WHERE activo = 1 ORDER BY nombre ASC")
    catalogo_ont = cursor.fetchall()
    
    cursor.execute("SELECT nombre FROM catalogo_modelos_router WHERE activo = 1 ORDER BY nombre ASC")
    catalogo_router = cursor.fetchall()

    # Obtener estado de actividad, área de trabajo y pánico del técnico
    cursor.execute("SELECT estado_actividad, area_trabajo, alerta_panico, mensaje_panico FROM tecnicos WHERE nombre = %s", (nombre_real,))
    tec_estado_row = cursor.fetchone()
    estado_actividad = tec_estado_row['estado_actividad'] if tec_estado_row else 'Disponible'
    area_trabajo = tec_estado_row['area_trabajo'] if (tec_estado_row and tec_estado_row['area_trabajo']) else 'SOPORTE'
    alerta_panico = tec_estado_row['alerta_panico'] if tec_estado_row else 0
    mensaje_panico = tec_estado_row['mensaje_panico'] if tec_estado_row else None
    
    cursor.close()
    conexion.close()

    # Parsear información técnica (Caja, Hilo, IP, etc.) para visualización del técnico
    visitas_del_tecnico = parsear_informacion_tecnica(visitas_del_tecnico)

    # Mandamos al HTML la lista filtrada ('visitas_del_tecnico')
    return render_template('tecnico_panel.html', 
                           visitas=visitas_del_tecnico, 
                           tecnico=nombre_real,
                           estado_actividad=estado_actividad,
                           area_trabajo=area_trabajo,
                           alerta_panico=alerta_panico,
                           mensaje_panico=mensaje_panico,
                           numero_grua=NUMERO_GRUA,
                           soluciones=soluciones,
                           catalogo=catalogo_materiales,
                           catalogo_ont=catalogo_ont,           
                           catalogo_router=catalogo_router)

def obtener_soluciones_activas():
    """Consulta la tabla catalogo_soluciones y devuelve la lista ordenada."""
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre FROM catalogo_soluciones WHERE activo = TRUE ORDER BY nombre ASC")
        return cursor.fetchall()
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()


# --- 2. NUEVO: BOTÓN "VOY EN CAMINO" (Arranca el traslado) ---
@tecnico_bp.route('/api/tecnico/en_camino/<int:id_visita>', methods=['POST'])
def en_camino_visita(id_visita):
    """El técnico arranca en la camioneta. Genera el Link de Rastreo."""
    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    # Generamos un código único de 16 caracteres (Ej: 'V8mK9xP_zL2QwNrj')
    token_seguro = secrets.token_urlsafe(16)
    
    try:
        query = """
            UPDATE visitas_tecnicas 
            SET estado = 'EN_RUTA', 
                hora_en_ruta = NOW(), 
                token_rastreo = %s 
            WHERE id_visita = %s
        """
        cursor.execute(query, (token_seguro, id_visita))
        conexion.commit()

        # Actualizar estado de actividad global del técnico
        cursor.execute("SELECT cliente FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        cliente_row = cursor.fetchone()
        cliente = cliente_row[0] if cliente_row else "Cliente"
        
        tecnico_nombre = session.get('user_name')
        if tecnico_nombre:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s, ultima_conexion = NOW() 
                WHERE nombre = %s
            """, (f"En camino a: {cliente}", tecnico_nombre))
            conexion.commit()
    except Exception as e:
        print(f"Error al poner en ruta: {e}")
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    return redirect(request.referrer)


# --- 3. ACTUALIZADO: BOTÓN "INICIAR TRABAJO" (Llegó a la casa) ---
@tecnico_bp.route('/api/tecnico/iniciar/<int:id_visita>', methods=['POST'])
def iniciar_visita(id_visita):
    """El técnico llegó al domicilio y empieza a trabajar."""
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        query = "UPDATE visitas_tecnicas SET estado = 'EN_PROGRESO', hora_inicio_visita = NOW() WHERE id_visita = %s"
        cursor.execute(query, (id_visita,))
        conexion.commit()

        # Actualizar estado de actividad global del técnico
        cursor.execute("SELECT cliente FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        cliente_row = cursor.fetchone()
        cliente = cliente_row[0] if cliente_row else "Cliente"
        
        tecnico_nombre = session.get('user_name')
        if tecnico_nombre:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s, ultima_conexion = NOW() 
                WHERE nombre = %s
            """, (f"Trabajando con: {cliente}", tecnico_nombre))
            conexion.commit()
    except Exception as e:
        print(f"Error al iniciar visita: {e}")
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    return redirect(request.referrer)


# --- 4. BOTÓN "FINALIZAR VISITA" (Cierre Total) ---
@tecnico_bp.route('/api/tecnico/finalizar/<int:id_visita>', methods=['POST'])
def finalizar_visita(id_visita):
    """Recibe el formulario del celular y cierra la visita."""
    solucion = request.form.get('solucion_tecnico')
    observacion = request.form.get('observacion_tecnico')
    onu = request.form.get('modelo_onu')
    router = request.form.get('modelo_router')
    coordenadas = request.form.get('coordenadas_tecnico')
    
    # Captura de fotos y firma
    equipos_juntos = request.form.get('equipos_juntos')  # '1' o '0'
    equipos_juntos_val = 1 if equipos_juntos == '1' else 0
    
    foto_equipos_b64 = request.form.get('foto_equipos_base64')
    foto_equipos_2_b64 = request.form.get('foto_equipos_2_base64')
    firma_cliente_b64 = request.form.get('firma_cliente_base64')
    
    # Procesar archivos físicos
    uploads_dir = os.path.join('static', 'uploads')
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
        
    def guardar_imagen_base64(b64_string, filename):
        if not b64_string or not b64_string.strip():
            return None
        try:
            if ',' in b64_string:
                b64_string = b64_string.split(',')[1]
            img_data = base64.b64decode(b64_string)
            filepath = os.path.join(uploads_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(img_data)
            return filename
        except Exception as e:
            print(f"Error al guardar imagen {filename}: {e}")
            return None

    foto_equipos_filename = guardar_imagen_base64(foto_equipos_b64, f"equipos_{id_visita}_1.jpg")
    foto_equipos_2_filename = None
    if not equipos_juntos_val:
        foto_equipos_2_filename = guardar_imagen_base64(foto_equipos_2_b64, f"equipos_{id_visita}_2.jpg")
        
    firma_cliente_filename = guardar_imagen_base64(firma_cliente_b64, f"firma_{id_visita}.png")

    # Capturamos las listas dinámicas de materiales enviados desde el HTML
    materiales_ids = request.form.getlist('materiales_seleccionados[]')
    cantidades = request.form.getlist('cantidades_materiales[]')
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        # 1. Actualizar la visita técnica
        query = """
            UPDATE visitas_tecnicas 
            SET estado = 'FINALIZADA', 
                hora_fin_visita = NOW(),
                solucion_tecnico = %s,
                observacion_tecnico = %s,
                modelo_onu = %s,
                modelo_router = %s,
                coordenadas_tecnico = %s,
                equipos_juntos = %s,
                foto_equipos = %s,
                foto_equipos_2 = %s,
                firma_cliente = %s
            WHERE id_visita = %s
        """
        cursor.execute(query, (
            solucion, observacion, onu, router, coordenadas,
            equipos_juntos_val, foto_equipos_filename, foto_equipos_2_filename, firma_cliente_filename,
            id_visita
        ))
        
        # 2. Registrar materiales e inventario si existen
        if materiales_ids and cantidades:
            # Obtener el nombre del técnico principal de esta visita
            cursor.execute("SELECT tecnico_principal FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
            tec_row = cursor.fetchone()
            tecnico_nombre = tec_row[0] if tec_row else None
            
            placa_vehiculo = 'S/P'
            if tecnico_nombre:
                cursor.execute("SELECT placa_vehiculo FROM tecnicos WHERE nombre = %s", (tecnico_nombre,))
                placa_row = cursor.fetchone()
                placa_vehiculo = placa_row[0] if (placa_row and placa_row[0]) else 'S/P'
            
            query_materiales = """
                INSERT INTO visitas_materiales (id_visita, id_material, cantidad_usada)
                VALUES (%s, %s, %s)
            """
            
            query_update_custodia = """
                UPDATE inventario_tecnicos 
                SET cantidad_disponible = cantidad_disponible - %s 
                WHERE placa_vehiculo = %s AND id_material = %s
            """
            
            for i in range(len(materiales_ids)):
                id_mat = materiales_ids[i]
                cant = cantidades[i]
                
                # Solo guardamos si seleccionó un material y puso una cantidad mayor a cero
                if id_mat and cant and int(cant) > 0:
                    cursor.execute(query_materiales, (id_visita, int(id_mat), int(cant)))
                    
                    if placa_vehiculo:
                        # Asegurar que exista el registro en inventario_tecnicos (por si no estaba inicializado)
                        cursor.execute("""
                            INSERT IGNORE INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
                            VALUES (%s, %s, 0)
                        """, (placa_vehiculo, int(id_mat)))
                        
                        # Descontar del inventario del vehículo
                        cursor.execute(query_update_custodia, (int(cant), placa_vehiculo, int(id_mat)))
                        
        # Actualizar estado global del técnico
        tecnico_nombre = session.get('user_name')
        if tecnico_nombre:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s, ultima_conexion = NOW() 
                WHERE nombre = %s
            """, ("Disponible", tecnico_nombre))
            
        conexion.commit()
        print(f"✅ Visita #{id_visita} finalizada e insumos actualizados.")
    except Exception as e:
        conexion.rollback()
        print(f"Error al finalizar visita con materiales: {e}")
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    return redirect(request.referrer)

# --- 5. RASTREO SILENCIOSO DEL GPS EN VIVO ---
# --- 5. RASTREO SILENCIOSO DEL GPS EN VIVO (ULTRA TOLERANTE) ---
@tecnico_bp.route('/api/tecnico/rastreo_vivo/<int:id_visita>', methods=['POST'])
def rastreo_vivo(id_visita):
    """Recibe la latitud y longitud del celular del técnico y fuerza su guardado."""
    print(f"📡 ¡Alerta! Petición recibida para la visita #{id_visita}") # Ver en la terminal de la PC
    
    # Manejo ultra flexible por si viene como JSON o Formulario clásico
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    lat = datos.get('latitud')
    lon = datos.get('longitud')
    
    print(f"📍 Datos recibidos del celular -> Lat: {lat}, Lon: {lon}")

    if lat and lon:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            # Actualizar coordenadas para el rastreo del cliente
            query = """
                UPDATE visitas_tecnicas 
                SET latitud_gps_vivo = %s, 
                    longitud_gps_vivo = %s, 
                    ultima_actualizacion_gps = NOW() 
                WHERE id_visita = %s
            """
            cursor.execute(query, (lat, lon, id_visita))

            # Actualizar coordenadas globales del técnico (para el administrador)
            tecnico_nombre = session.get('user_name')
            if tecnico_nombre:
                cursor.execute("""
                    UPDATE tecnicos 
                    SET latitud_actual = %s, 
                        longitud_actual = %s, 
                        ultima_conexion = NOW()
                    WHERE nombre = %s
                """, (lat, lon, tecnico_nombre))

            conexion.commit()
            print("💾 ¡Ubicación guardada con éxito en MySQL!")
        except Exception as e:
            print(f"❌ Error crítico en la consulta MySQL: {e}")
        finally:
            if 'conexion' in locals() and conexion.is_connected():
                cursor.close()
                conexion.close()
    else:
        print("⚠️ Advertencia: Llegó la petición pero los valores lat/lon vinieron vacíos.")
                
    return jsonify({"status": "ok"})

@tecnico_bp.route('/api/tecnico/cerrar_visita/<int:id_visita>', methods=['POST'])
def cerrar_visita_proceso(id_visita):
    # 1. Capturamos los datos tradicionales del cierre
    estado_final = request.form.get('estado_final') # 'FINALIZADA' o 'SOLVENTADA_REMOTA'
    observacion = request.form.get('observacion_cierre')
    
    # 2. Capturamos las listas dinámicas de materiales enviados desde el HTML
    materiales_ids = request.form.getlist('materiales_seleccionados[]')
    cantidades = request.form.getlist('cantidades_materiales[]')

    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    try:
        # A. Actualizamos el estado general de la visita técnica
        query_visita = """
            UPDATE visitas_tecnicas 
            SET estado = %s, 
                observacion_tecnico = %s,
                fecha_cierre = NOW()
            WHERE id_visita = %s
        """
        cursor.execute(query_visita, (estado_final, observacion, id_visita))
        
        # B. Guardamos los materiales dinámicamente uno por uno si existen
        if materiales_ids and cantidades:
            query_materiales = """
                INSERT INTO visitas_materiales (id_visita, id_material, cantidad_usada)
                VALUES (%s, %s, %s)
            """
            for i in range(len(materiales_ids)):
                id_mat = materiales_ids[i]
                cant = cantidades[i]
                
                # Solo guardamos si seleccionó un material y puso una cantidad válida mayor a cero
                if id_mat and cant and int(cant) > 0:
                    cursor.execute(query_materiales, (id_visita, int(id_mat), int(cant)))

        # Actualizar estado global del técnico
        tecnico_nombre = session.get('user_name')
        if tecnico_nombre:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s, ultima_conexion = NOW() 
                WHERE nombre = %s
            """, ("Disponible", tecnico_nombre))
                    
        conexion.commit()
        print(f"✅ Visita #{id_visita} cerrada y materiales registrados exitosamente.")
        
    except Exception as e:
        conexion.rollback()
        print(f"❌ Error al cerrar visita con materiales: {e}")
    finally:
        cursor.close()
        conexion.close()
        
    nombre_propio = session.get('user_name', '').replace(' ', '_')
    return redirect(url_for('tecnico.panel_tecnico', nombre_tecnico=nombre_propio))

from flask import jsonify

@tecnico_bp.route('/api/cliente/historial/<path:nombre_cliente>')
def obtener_historial_cliente(nombre_cliente):
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    
    try:
        # Buscamos visitas del cliente en los últimos 3 meses (90 días)
        # Filtramos para que traiga principalmente las FINALIZADAS o CANCELADAS para ver el desenlace
        query = """
            SELECT fecha_programada, problema, solucion_tecnico, tecnico_principal, estado
            FROM visitas_tecnicas
            WHERE cliente = %s AND estado IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
            AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            ORDER BY fecha_programada DESC
        """
        cursor.execute(query, (nombre_cliente,))
        historial = cursor.fetchall()
        
        return jsonify({"status": "ok", "historial": historial})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/api/tecnico/ping_global', methods=['POST'])
def ping_global():
    if 'user_id' not in session or session.get('user_role') != 'TECNICO':
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    lat = datos.get('latitud')
    lon = datos.get('longitud')
    tecnico_nombre = session.get('user_name')

    if lat and lon and tecnico_nombre:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            cursor.execute("""
                UPDATE tecnicos 
                SET latitud_actual = %s, 
                    longitud_actual = %s, 
                    ultima_conexion = NOW()
                WHERE nombre = %s
            """, (lat, lon, tecnico_nombre))
            conexion.commit()
        except Exception as e:
            print(f"Error in ping_global: {e}")
        finally:
            cursor.close()
            conexion.close()
            
    return jsonify({"status": "ok"})


@tecnico_bp.route('/api/tecnico/descanso', methods=['POST'])
def descanso_tecnico():
    if 'user_id' not in session or session.get('user_role') != 'TECNICO':
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    accion = datos.get('accion')
    tecnico_nombre = session.get('user_name')

    if not accion and not request.is_json:
        accion = request.form.get('accion')

    if tecnico_nombre and accion:
        nuevo_estado = 'En Descanso' if accion == 'iniciar' else 'Disponible'
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s,
                    ultima_conexion = NOW()
                WHERE nombre = %s
            """, (nuevo_estado, tecnico_nombre))
            conexion.commit()
            return jsonify({"status": "ok", "estado": nuevo_estado})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
            
    return jsonify({"status": "error", "message": "Faltan parámetros"}), 400


@tecnico_bp.route('/api/tecnico/area_trabajo', methods=['POST'])
def cambiar_area_trabajo():
    if 'user_id' not in session or session.get('user_role') != 'TECNICO':
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    area = datos.get('area_trabajo')
    tecnico_nombre = session.get('user_name')

    if not area and not request.is_json:
        area = request.form.get('area_trabajo')

    if tecnico_nombre and area:
        area = area.upper().strip()
        if area not in ['SOPORTE', 'INSTALACIONES']:
            return jsonify({"status": "error", "message": "Área de trabajo no válida"}), 400
            
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            cursor.execute("""
                UPDATE tecnicos 
                SET area_trabajo = %s,
                    ultima_conexion = NOW()
                WHERE nombre = %s
            """, (area, tecnico_nombre))
            conexion.commit()
            return jsonify({"status": "ok", "area_trabajo": area})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
            
    return jsonify({"status": "error", "message": "Faltan parámetros"}), 400


@tecnico_bp.route('/api/tecnico/panico/activar', methods=['POST'])
def activar_panico():
    if 'user_id' not in session or session.get('user_role') != 'TECNICO':
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    mensaje = datos.get('mensaje')
    tecnico_nombre = session.get('user_name')

    if not mensaje and not request.is_json:
        mensaje = request.form.get('mensaje')

    if not mensaje:
        mensaje = "Varado / Auxilio solicitado"

    if tecnico_nombre:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            # Activar pánico y guardar mensaje
            cursor.execute("""
                UPDATE tecnicos 
                SET alerta_panico = 1,
                    mensaje_panico = %s,
                    estado_actividad = %s,
                    ultima_conexion = NOW()
                WHERE nombre = %s
            """, (mensaje, f"🚨 PÁNICO: {mensaje}", tecnico_nombre))
            conexion.commit()
            return jsonify({"status": "ok", "mensaje": mensaje})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
            
    return jsonify({"status": "error", "message": "Faltan parámetros"}), 400


@tecnico_bp.route('/api/tecnico/panico/desactivar', methods=['POST'])
def desactivar_panico():
    if 'user_id' not in session or session.get('user_role') != 'TECNICO':
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    tecnico_nombre = session.get('user_name')

    if tecnico_nombre:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            # Desactivar pánico
            cursor.execute("""
                UPDATE tecnicos 
                SET alerta_panico = 0,
                    mensaje_panico = NULL,
                    estado_actividad = 'Disponible',
                    ultima_conexion = NOW()
                WHERE nombre = %s
            """, (tecnico_nombre,))
            conexion.commit()
            return jsonify({"status": "ok"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
            
    return jsonify({"status": "error", "message": "Faltan parámetros"}), 400