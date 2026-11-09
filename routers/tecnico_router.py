import secrets # IMPORTANTE: Añade esto arriba para generar el token seguro
from flask import Blueprint, request, redirect, url_for, render_template, jsonify, session
from db_config import get_db_connection
from datetime import date
import re
import os
import base64
from utils import parsear_informacion_tecnica, normalizar_gpon_sn



tecnico_bp = Blueprint('tecnico', __name__)

NUMERO_GRUA = "0958672088"

def obtener_usuario_autenticado():
    token = request.headers.get('Authorization')
    if token and token.startswith("Bearer "):
        from utils_jwt import verify_token
        user = verify_token(token)
        if user:
            return {
                'id_usuario': user.get('sub'),
                'username': user.get('username'),
                'role': user.get('role')
            }
    elif 'user_id' in session:
        return {
            'id_usuario': session['user_id'],
            'username': session.get('user_name'),
            'role': session.get('user_role')
        }
    return None

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


@tecnico_bp.route('/api/tecnico/panel/<nombre_tecnico>', methods=['GET'])
def api_panel_tecnico(nombre_tecnico):
    usuario = obtener_usuario_autenticado()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    rol = usuario.get('role')
    nombre_usuario = usuario.get('username')
    nombre_real = nombre_tecnico.replace('_', ' ')
    
    if rol == 'TECNICO' and nombre_usuario != nombre_real:
        return jsonify({"status": "error", "message": "No tienes permiso para acceder al panel de otro técnico."}), 403
        
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    hoy = date.today().isoformat()
    
    try:
        # 1. Obtener foto_perfil, estado de actividad, área de trabajo, coordenadas y pánico del técnico
        cursor.execute("SELECT foto_perfil, estado_actividad, area_trabajo, alerta_panico, mensaje_panico, latitud_actual, longitud_actual, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') as placa FROM tecnicos WHERE nombre = %s OR UPPER(nombre) = %s", (nombre_real, nombre_real.upper()))
        tec_estado_row = cursor.fetchone()
        placa_tec = tec_estado_row['placa'] if tec_estado_row and 'placa' in tec_estado_row else 'S/P'
        foto_perfil = tec_estado_row['foto_perfil'] if (tec_estado_row and tec_estado_row['foto_perfil']) else 'default_avatar.png'
        estado_actividad = tec_estado_row['estado_actividad'] if tec_estado_row else 'Disponible'
        if not estado_actividad or estado_actividad in ['Desconectado', 'Sesión Iniciada', 'DESCONECTADO']:
            estado_actividad = 'Disponible'
            try:
                cursor.execute("""
                    UPDATE tecnicos 
                    SET estado_actividad = 'Disponible', 
                        ultima_conexion = NOW()
                    WHERE nombre = %s OR UPPER(nombre) = %s
                """, (nombre_real, nombre_real.upper()))
                conexion.commit()
            except Exception as ex_u:
                print(f"Error auto-activando técnico: {ex_u}")
        area_trabajo = tec_estado_row['area_trabajo'] if (tec_estado_row and tec_estado_row['area_trabajo']) else 'SOPORTE'
        alerta_panico = tec_estado_row['alerta_panico'] if tec_estado_row else 0
        mensaje_panico = tec_estado_row['mensaje_panico'] if tec_estado_row else None
        lat_act = float(tec_estado_row['latitud_actual']) if tec_estado_row and tec_estado_row['latitud_actual'] is not None else None
        lon_act = float(tec_estado_row['longitud_actual']) if tec_estado_row and tec_estado_row['longitud_actual'] is not None else None
        
        # 2. Traemos TODAS las visitas de hoy para calcular los índices globales
        query_all = """
            SELECT * FROM visitas_tecnicas 
            WHERE fecha_programada = %s
        """
        cursor.execute(query_all, (hoy,))
        todas_las_visitas = cursor.fetchall()
        
        todas_las_visitas.sort(key=lambda x: x.get('id_visita', 0) or 0)
        for idx, v in enumerate(todas_las_visitas, start=1):
            v['numero_parada'] = idx
            
        nombre_real_upper = nombre_real.upper()
        visitas_del_tecnico = [
            v for v in todas_las_visitas 
            if ((v.get('tecnico_principal') or '').upper() == nombre_real_upper or 
                (v.get('tecnico_apoyo') or '').upper() == nombre_real_upper)
            and v.get('estado') not in ('CANCELADA', 'SOLVENTADA_REMOTA')
        ]
        
        from optimizador import optimizar_ruta_tecnico
        visitas_del_tecnico = optimizar_ruta_tecnico(visitas_del_tecnico, lat_act, lon_act)
        visitas_del_tecnico = parsear_informacion_tecnica(visitas_del_tecnico)
        
        soluciones = obtener_soluciones_activas()
        
        # Catálogo general de materiales con su stock en Bodega Central (para pedidos y traspasos)
        cursor.execute("""
            SELECT id_material, codigo_material, nombre_material, unidad_medida, categoria, stock_bodega
            FROM materiales
            WHERE activo = 1
            ORDER BY nombre_material ASC
        """)
        catalogo_materiales = cursor.fetchall()
        
        cursor.execute("""
            SELECT nombre FROM catalogo_modelos_ont 
            WHERE activo = 1 
            ORDER BY CASE 
                WHEN nombre = 'XX231v' THEN 1 
                WHEN nombre = 'XX530v' THEN 2 
                WHEN nombre = 'XPON' THEN 3 
                ELSE 4 
            END, nombre ASC
        """)
        catalogo_ont = cursor.fetchall()
        
        cursor.execute("""
            SELECT nombre FROM catalogo_modelos_router 
            WHERE activo = 1 
            ORDER BY CASE 
                WHEN nombre LIKE '%EX511%' THEN 1 
                WHEN nombre LIKE '%AX3%' THEN 2 
                WHEN nombre LIKE '%AX2%' THEN 3 
                ELSE 4 
            END, nombre ASC
        """)
        catalogo_router = cursor.fetchall()
        
        # Obtener lista de otros técnicos activos para traspaso de insumos
        cursor.execute("SELECT nombre, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa FROM tecnicos WHERE activo = 1 AND nombre != %s ORDER BY nombre ASC", (nombre_real,))
        tecnicos_list = cursor.fetchall()
        
        # Obtener IDs de las visitas del técnico para adjuntar materiales usados y equipos retirados
        visita_ids = [v['id_visita'] for v in visitas_del_tecnico if v.get('id_visita')]
        materiales_por_visita = {}
        equipos_retirados_por_visita = {}

        if visita_ids:
            format_strings = ','.join(['%s'] * len(visita_ids))
            cursor.execute(f"""
                SELECT vm.id_visita, vm.id_material, vm.cantidad_usada, 
                       m.nombre_material, m.unidad_medida, m.codigo_material, m.categoria
                FROM visitas_materiales vm
                JOIN materiales m ON vm.id_material = m.id_material
                WHERE vm.id_visita IN ({format_strings})
                ORDER BY m.nombre_material ASC
            """, tuple(visita_ids))
            for mat in cursor.fetchall():
                vid = mat['id_visita']
                if vid not in materiales_por_visita:
                    materiales_por_visita[vid] = []
                cant = float(mat['cantidad_usada']) if mat.get('cantidad_usada') is not None else 0
                mat['cantidad_usada'] = int(cant) if cant.is_integer() else cant
                materiales_por_visita[vid].append(mat)

            cursor.execute(f"""
                SELECT er.id_retiro, er.id_visita, er.tipo_equipo, er.modelo, er.numero_serie, 
                       er.motivo_retiro, er.observacion_retiro, er.estado_custodia
                FROM equipos_retirados_visitas er
                WHERE er.id_visita IN ({format_strings})
                ORDER BY er.id_retiro ASC
            """, tuple(visita_ids))
            for eq in cursor.fetchall():
                vid = eq['id_visita']
                if vid not in equipos_retirados_por_visita:
                    equipos_retirados_por_visita[vid] = []
                equipos_retirados_por_visita[vid].append(eq)

        # Formatear fechas y horas para que sean JSON-serializables
        for v in visitas_del_tecnico:
            vid = v.get('id_visita')
            v['materiales_usados'] = materiales_por_visita.get(vid, [])
            v['equipos_retirados'] = equipos_retirados_por_visita.get(vid, [])

            if 'fecha_programada' in v and isinstance(v['fecha_programada'], date):
                v['fecha_programada'] = v['fecha_programada'].isoformat()
            for h_field in ('fecha_ingreso', 'hora_en_ruta', 'hora_inicio_visita', 'hora_fin_visita'):
                if h_field in v and v[h_field] is not None:
                    if hasattr(v[h_field], 'isoformat'):
                        v[h_field] = v[h_field].isoformat()
                    else:
                        v[h_field] = str(v[h_field])
                
        return jsonify({
            "status": "ok",
            "visitas": visitas_del_tecnico,
            "tecnico": nombre_real,
            "foto_perfil": foto_perfil,
            "estado_actividad": estado_actividad,
            "area_trabajo": area_trabajo,
            "alerta_panico": alerta_panico,
            "mensaje_panico": mensaje_panico,
            "numero_grua": NUMERO_GRUA,
            "soluciones": soluciones,
            "catalogo": catalogo_materiales,
            "catalogo_ont": catalogo_ont,
            "catalogo_router": catalogo_router,
            "tecnicos_lista": tecnicos_list
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/tecnico/<nombre_tecnico>')
def panel_tecnico(nombre_tecnico):
    # Validar que esté logueado
    if 'user_id' not in session:
        from flask import redirect, url_for
        return redirect(url_for('login'))
        
    rol = session.get('user_role')
    nombre_usuario = session.get('user_name', '')
    
    # DEBUG LOG
    try:
        with open("request_debug.log", "a", encoding="utf-8") as f:
            f.write(f"--- ACCESS --- \n")
            f.write(f"nombre_tecnico URL: {nombre_tecnico}\n")
            f.write(f"session user_id: {session.get('user_id')}\n")
            f.write(f"session user_name: {session.get('user_name')}\n")
            f.write(f"session user_role: {session.get('user_role')}\n")
    except Exception as log_err:
        pass
    
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
    
    # 1. Obtener estado de actividad, área de trabajo, coordenadas y pánico del técnico
    cursor.execute("SELECT estado_actividad, area_trabajo, alerta_panico, mensaje_panico, latitud_actual, longitud_actual, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') as placa FROM tecnicos WHERE nombre = %s", (nombre_real,))
    tec_estado_row = cursor.fetchone()
    placa_tec = tec_estado_row['placa'] if tec_estado_row and 'placa' in tec_estado_row else 'S/P'
    estado_actividad = tec_estado_row['estado_actividad'] if tec_estado_row else 'Disponible'
    area_trabajo = tec_estado_row['area_trabajo'] if (tec_estado_row and tec_estado_row['area_trabajo']) else 'SOPORTE'
    alerta_panico = tec_estado_row['alerta_panico'] if tec_estado_row else 0
    mensaje_panico = tec_estado_row['mensaje_panico'] if tec_estado_row else None
    lat_act = float(tec_estado_row['latitud_actual']) if tec_estado_row and tec_estado_row['latitud_actual'] is not None else None
    lon_act = float(tec_estado_row['longitud_actual']) if tec_estado_row and tec_estado_row['longitud_actual'] is not None else None
    
    # 2. Traemos TODAS las visitas de hoy para calcular los índices globales correctos
    query_all = """
        SELECT * FROM visitas_tecnicas 
        WHERE fecha_programada = %s
    """
    cursor.execute(query_all, (hoy,))
    todas_las_visitas = cursor.fetchall()
    
    # Ordenar por id_visita de forma estable para asegurar el orden de registro
    todas_las_visitas.sort(key=lambda x: x.get('id_visita', 0) or 0)
    
    # Asignar índice global numero_parada
    for idx, v in enumerate(todas_las_visitas, start=1):
        v['numero_parada'] = idx
        
    # Filtrar solo las visitas asignadas a este técnico (de forma insensible a mayúsculas/minúsculas)
    nombre_real_upper = nombre_real.upper()
    visitas_del_tecnico = [
        v for v in todas_las_visitas 
        if ((v.get('tecnico_principal') or '').upper() == nombre_real_upper or 
            (v.get('tecnico_apoyo') or '').upper() == nombre_real_upper)
        and v.get('estado') not in ('CANCELADA', 'SOLVENTADA_REMOTA')
    ]
    
    # 3. Optimizar las visitas de este técnico geográficamente
    from optimizador import optimizar_ruta_tecnico
    from utils import parsear_informacion_tecnica
    visitas_del_tecnico = optimizar_ruta_tecnico(visitas_del_tecnico, lat_act, lon_act)
    visitas_del_tecnico = parsear_informacion_tecnica(visitas_del_tecnico)
    
    # --- Carga de catálogos y soluciones (Queda igual) ---
    soluciones = obtener_soluciones_activas()
    
    if placa_tec and placa_tec != 'S/P':
        cursor.execute("""
            SELECT DISTINCT m.id_material, m.codigo_material, m.nombre_material, m.unidad_medida, m.categoria, m.stock_bodega
            FROM materiales m
            LEFT JOIN inventario_tecnicos it ON m.id_material = it.id_material AND it.placa_vehiculo = %s
            WHERE m.activo = 1 AND (m.stock_bodega > 0 OR (it.cantidad_disponible IS NOT NULL AND it.cantidad_disponible > 0))
            ORDER BY m.nombre_material ASC
        """, (placa_tec,))
    else:
        cursor.execute("""
            SELECT id_material, codigo_material, nombre_material, unidad_medida, categoria, stock_bodega
            FROM materiales
            WHERE activo = 1 AND stock_bodega > 0
            ORDER BY nombre_material ASC
        """)
    catalogo_materiales = cursor.fetchall()
    
    cursor.execute("SELECT nombre FROM catalogo_modelos_ont WHERE activo = 1 ORDER BY nombre ASC")
    catalogo_ont = cursor.fetchall()
    
    cursor.execute("SELECT nombre FROM catalogo_modelos_router WHERE activo = 1 ORDER BY nombre ASC")
    catalogo_router = cursor.fetchall()
    
    cursor.close()
    conexion.close()

    # Parsear información técnica (Caja, Hilo, IP, etc.) para visualización del técnico
    visitas_del_tecnico = parsear_informacion_tecnica(visitas_del_tecnico)

    # DEBUG LOG
    try:
        with open("request_debug.log", "a", encoding="utf-8") as f:
            f.write(f"Count of visits found: {len(visitas_del_tecnico)}\n")
            f.write(f"Visits IDs: {[v['id_visita'] for v in visitas_del_tecnico]}\n\n")
    except Exception as log_err:
        pass

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
        # Resetear cualquier otra visita activa de este técnico a PENDIENTE para evitar duplicados en ruta
        usuario = obtener_usuario_autenticado()
        if not usuario:
            return jsonify({"status": "error", "message": "No autorizado"}), 401
            
        cursor.execute("SELECT tecnico_principal FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        tec_row = cursor.fetchone()
        tecnico_nombre = tec_row[0] if tec_row else None
        
        if tecnico_nombre:
            cursor.execute("""
                SELECT id_visita, cliente, estado 
                FROM visitas_tecnicas 
                WHERE (tecnico_principal = %s OR tecnico_apoyo = %s) 
                  AND estado IN ('EN_RUTA', 'EN_PROGRESO')
                  AND id_visita != %s
                  AND fecha_programada = %s
                LIMIT 1
            """, (tecnico_nombre, tecnico_nombre, id_visita, date.today().isoformat()))
            activa = cursor.fetchone()
            if activa:
                est_txt = "en ruta" if activa[2] == 'EN_RUTA' else "en progreso"
                return jsonify({
                    "status": "error",
                    "message": f"Ya tienes la visita #{activa[0]} ({activa[1]}) {est_txt}. Debes finalizarla o posponerla antes de iniciar otra."
                }), 400
            
            cursor.execute("""
                UPDATE visitas_tecnicas 
                SET estado = 'PENDIENTE'
                WHERE (tecnico_principal = %s OR tecnico_apoyo = %s) 
                  AND estado IN ('EN_RUTA', 'EN_PROGRESO')
                  AND id_visita != %s
                  AND fecha_programada = %s
            """, (tecnico_nombre, tecnico_nombre, id_visita, date.today().isoformat()))
            conexion.commit()

        # Preservar siempre el token existente de la visita; nunca sobrescribirlo si ya fue asignado
        cursor.execute("SELECT estado, token_rastreo FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        row_est = cursor.fetchone()
        estado_actual = row_est[0] if row_est else None
        token_existente = row_est[1] if row_est else None
        
        token_final = token_existente if token_existente else secrets.token_hex(16)
        token_seguro = token_final

        query = """
            UPDATE visitas_tecnicas 
            SET estado = 'EN_RUTA', 
                hora_en_ruta = COALESCE(hora_en_ruta, NOW()), 
                token_rastreo = %s 
            WHERE id_visita = %s
        """
        cursor.execute(query, (token_final, id_visita))
        conexion.commit()

        # Actualizar estado de actividad global del técnico
        cursor.execute("SELECT cliente FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        cliente_row = cursor.fetchone()
        cliente = cliente_row[0] if cliente_row else "Cliente"
        
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
            
    if request.is_json or request.headers.get('Accept') == 'application/json':
        return jsonify({"status": "ok", "message": "Puesto en camino con éxito", "token_rastreo": token_seguro})
    return redirect(request.referrer)


# --- 3. ACTUALIZADO: BOTÓN "INICIAR TRABAJO" (Llegó a la casa) ---
@tecnico_bp.route('/api/tecnico/iniciar/<int:id_visita>', methods=['POST'])
def iniciar_visita(id_visita):
    """El técnico llegó al domicilio y empieza a trabajar."""
    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    # Capturar latitud_inicio y longitud_inicio de forma flexible
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    lat_ini = datos.get('latitud_inicio')
    lon_ini = datos.get('longitud_inicio')
    
    try:
        lat_val = float(lat_ini) if lat_ini else None
    except ValueError:
        lat_val = None
    try:
        lon_val = float(lon_ini) if lon_ini else None
    except ValueError:
        lon_val = None

    try:
        # Resetear cualquier otra visita activa de este técnico a PENDIENTE para evitar duplicados
        usuario = obtener_usuario_autenticado()
        if not usuario:
            return jsonify({"status": "error", "message": "No autorizado"}), 401
            
        cursor.execute("SELECT tecnico_principal FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        tec_row = cursor.fetchone()
        tecnico_nombre = tec_row[0] if tec_row else None
        
        if tecnico_nombre:
            cursor.execute("""
                SELECT id_visita, cliente, estado 
                FROM visitas_tecnicas 
                WHERE (tecnico_principal = %s OR tecnico_apoyo = %s) 
                  AND estado = 'EN_PROGRESO'
                  AND id_visita != %s
                  AND fecha_programada = %s
                LIMIT 1
            """, (tecnico_nombre, tecnico_nombre, id_visita, date.today().isoformat()))
            activa = cursor.fetchone()
            if activa:
                return jsonify({
                    "status": "error",
                    "message": f"Ya tienes la visita #{activa[0]} ({activa[1]}) en progreso. Debes finalizarla o posponerla antes de iniciar otra."
                }), 400
            
            cursor.execute("""
                UPDATE visitas_tecnicas 
                SET estado = 'PENDIENTE'
                WHERE (tecnico_principal = %s OR tecnico_apoyo = %s) 
                  AND estado IN ('EN_RUTA', 'EN_PROGRESO')
                  AND id_visita != %s
                  AND fecha_programada = %s
            """, (tecnico_nombre, tecnico_nombre, id_visita, date.today().isoformat()))
            conexion.commit()

        # Generar token de rastreo si no existe para la firma remota
        cursor.execute("SELECT token_rastreo FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        row = cursor.fetchone()
        token = row[0] if row else None
        if not token:
            token_seguro = secrets.token_urlsafe(16)
            cursor.execute("UPDATE visitas_tecnicas SET token_rastreo = %s WHERE id_visita = %s", (token_seguro, id_visita))
            conexion.commit()

        # Solo actualizar a EN_PROGRESO si el estado actual es PENDIENTE, REAGENDADA o EN_RUTA
        cursor.execute("SELECT estado FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        row_est = cursor.fetchone()
        estado_actual = row_est[0] if row_est else None
        
        if estado_actual in ['PENDIENTE', 'REAGENDADA', 'EN_RUTA', None]:
            query = """
                UPDATE visitas_tecnicas 
                SET estado = 'EN_PROGRESO', 
                    hora_inicio_visita = NOW(),
                    latitud_inicio = %s,
                    longitud_inicio = %s
                WHERE id_visita = %s
            """
            cursor.execute(query, (lat_val, lon_val, id_visita))
            conexion.commit()

        # Actualizar estado de actividad global del técnico
        cursor.execute("SELECT cliente FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        cliente_row = cursor.fetchone()
        cliente = cliente_row[0] if cliente_row else "Cliente"
        
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
            
    if request.is_json or request.headers.get('Accept') == 'application/json':
        return jsonify({"status": "ok", "message": "Visita iniciada con éxito"})
    return redirect(request.referrer)


@tecnico_bp.route('/api/tecnico/finalizar/<int:id_visita>', methods=['POST'])
def finalizar_visita(id_visita):
    """Recibe el formulario del celular y cierra la visita."""
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    solucion = datos.get('solucion_tecnico')
    if solucion and any(term in str(solucion).upper() for term in ['REAGENDAD', 'SATURACI', 'NO DESEA', 'SIN RESPUESTA', 'CANCELAD', 'NO SE PUEDE']):
        return jsonify({
            "status": "error",
            "message": "Una visita no realizada o que el cliente rechaza/cancela no se puede finalizar. Debe usar la opción 'Posponer' para que Call Center / Operaciones gestione la cancelación o reagendamiento."
        }), 400

    observacion = datos.get('observacion_tecnico')
    onu = datos.get('modelo_onu')
    router = datos.get('modelo_router')
    coordenadas = datos.get('coordenadas_tecnico')
    
    metodo_firma = datos.get('metodo_firma', 'REMOTA')
    motivo_sin_firma = datos.get('motivo_sin_firma', '')
    
    # Captura de fotos y firma
    equipos_juntos = datos.get('equipos_juntos')  # '1' o '0'
    equipos_juntos_val = 1 if (equipos_juntos == '1' or equipos_juntos == 1 or equipos_juntos is True) else 0
    
    foto_equipos_b64 = datos.get('foto_equipos_base64')
    foto_equipos_2_b64 = datos.get('foto_equipos_2_base64')
    firma_cliente_b64 = datos.get('firma_cliente_base64')
    
    # Fotos adicionales opcionales
    foto_extra_1_b64 = datos.get('foto_extra_1_base64')
    foto_extra_2_b64 = datos.get('foto_extra_2_base64')
    foto_extra_3_b64 = datos.get('foto_extra_3_base64')
    foto_extra_4_b64 = datos.get('foto_extra_4_base64')
    
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

    # Guardar fotos adicionales opcionales
    foto_extra_1_filename = guardar_imagen_base64(foto_extra_1_b64, f"extra_{id_visita}_1.jpg")
    foto_extra_2_filename = guardar_imagen_base64(foto_extra_2_b64, f"extra_{id_visita}_2.jpg")
    foto_extra_3_filename = guardar_imagen_base64(foto_extra_3_b64, f"extra_{id_visita}_3.jpg")
    foto_extra_4_filename = guardar_imagen_base64(foto_extra_4_b64, f"extra_{id_visita}_4.jpg")

    # Capturamos las listas dinámicas de materiales enviados desde el HTML o JSON
    if request.is_json:
        materiales_utilizados = datos.get('materiales', [])
        materiales_ids = [str(x.get('id_material')) for x in materiales_utilizados]
        cantidades = [str(x.get('cantidad')) for x in materiales_utilizados]
    else:
        materiales_ids = request.form.getlist('materiales_seleccionados[]')
        cantidades = request.form.getlist('cantidades_materiales[]')
    
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        # Validar la firma del cliente (enviada ahora o guardada de manera remota)
        if metodo_firma == 'SIN_FIRMA':
            motivos_map = {
                'TRABAJO_EXTERNO': 'Trabajo Externo (Caja de Distribución / Poste)',
                'CLIENTE_AUSENTE': 'Cliente Ausente / No contesta',
                'SOPORTE_REMOTO': 'Soporte Remoto / Configuración Lógica',
                'TERCERA_EDAD_DISCAPACIDAD_SIN_FIRMA': 'Cliente de Tercera Edad / Discapacidad (No puede firmar)',
                'OTROS': 'Otros'
            }
            motivo_texto = motivos_map.get(motivo_sin_firma, motivo_sin_firma or 'No especificado')
            firma_final_filename = f"SIN_FIRMA: {motivo_texto}"
        else:
            cursor.execute("SELECT firma_cliente FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
            firma_row = cursor.fetchone()
            firma_existente = firma_row['firma_cliente'] if (firma_row and firma_row['firma_cliente']) else None
            firma_final_filename = firma_cliente_filename or firma_existente
            
        if not firma_final_filename:
            raise Exception("No se puede finalizar la visita sin la firma de conformidad del cliente.")

        # 1. Actualizar la visita técnica
        sn_nuevo = datos.get('numero_serie_onu') or datos.get('numero_serie')
        sn_onu_normalizado = normalizar_gpon_sn(sn_nuevo) if sn_nuevo else None
        sn_router = datos.get('numero_serie_router')
        router_secundario = datos.get('router_secundario')
        sn_router_secundario = datos.get('numero_serie_router_secundario')
        tipo_mesh = datos.get('tipo_mesh')
        cantidad_routers = datos.get('cantidad_routers') or 1

        query = """
            UPDATE visitas_tecnicas 
            SET estado = 'FINALIZADA', 
                hora_fin_visita = NOW(),
                solucion_tecnico = %s,
                observacion_tecnico = %s,
                modelo_onu = %s,
                numero_serie_onu = COALESCE(%s, numero_serie_onu),
                modelo_router = %s,
                numero_serie_router = COALESCE(%s, numero_serie_router),
                router_secundario = COALESCE(%s, router_secundario),
                numero_serie_router_secundario = COALESCE(%s, numero_serie_router_secundario),
                tipo_mesh = COALESCE(%s, tipo_mesh),
                cantidad_routers = %s,
                coordenadas_tecnico = %s,
                equipos_juntos = %s,
                foto_equipos = %s,
                foto_equipos_2 = %s,
                firma_cliente = %s,
                foto_extra_1 = %s,
                foto_extra_2 = %s,
                foto_extra_3 = %s,
                foto_extra_4 = %s
            WHERE id_visita = %s
        """
        cursor.execute(query, (
            solucion, observacion, onu, sn_onu_normalizado, router, sn_router,
            router_secundario, sn_router_secundario, tipo_mesh, cantidad_routers,
            coordenadas,
            equipos_juntos_val, foto_equipos_filename, foto_equipos_2_filename,
            firma_final_filename,
            foto_extra_1_filename, foto_extra_2_filename, foto_extra_3_filename, foto_extra_4_filename,
            id_visita
        ))
        
        # Obtener el contrato y técnicos de esta visita
        cursor.execute("SELECT contrato, tecnico_principal, tecnico_apoyo FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        tec_row = cursor.fetchone()
        tecnico_principal_visita = tec_row['tecnico_principal'] if tec_row else None
        contrato_visita = tec_row['contrato'] if tec_row else None

        # Opción 1: Determinar el técnico y la placa que efectivamente cierra la visita (usuario autenticado)
        user_auth = obtener_usuario_autenticado()
        tecnico_nombre = None
        placa_vehiculo = 'S/P'

        if user_auth and user_auth.get('username'):
            auth_name = str(user_auth['username']).strip()
            cursor.execute("""
                SELECT nombre, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa 
                FROM tecnicos 
                WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(%s))
                LIMIT 1
            """, (auth_name,))
            t_auth = cursor.fetchone()
            if t_auth and t_auth['nombre']:
                tecnico_nombre = t_auth['nombre']
                if t_auth['placa'] and t_auth['placa'] != 'S/P':
                    placa_vehiculo = t_auth['placa']

        # Si el usuario autenticado no es un técnico registrado con placa, fallback al técnico principal
        if not tecnico_nombre or placa_vehiculo == 'S/P':
            if tecnico_principal_visita:
                tecnico_nombre = tecnico_nombre or tecnico_principal_visita
                cursor.execute("""
                    SELECT COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa 
                    FROM tecnicos 
                    WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(%s))
                    LIMIT 1
                """, (tecnico_principal_visita,))
                placa_row = cursor.fetchone()
                if placa_row and placa_row['placa'] and placa_row['placa'] != 'S/P':
                    placa_vehiculo = placa_row['placa']

        tecnico_nombre = tecnico_nombre or tecnico_principal_visita or 'S/P'

        # Registrar en la visita quién realizó el cierre técnico y desde qué placa se descontaron materiales
        cursor.execute("""
            UPDATE visitas_tecnicas 
            SET tecnico_cierre = %s,
                placa_cierre = %s
            WHERE id_visita = %s
        """, (tecnico_nombre, placa_vehiculo if placa_vehiculo != 'S/P' else None, id_visita))

        # Auto-actualizar el inventario de equipos del cliente en directorio_clientes
        if contrato_visita:
            c_val = str(contrato_visita).strip().upper()
            c_clean = c_val.lstrip('0')
            
            cursor.execute("""
                UPDATE directorio_clientes
                SET modelo_ont = COALESCE(NULLIF(%s, ''), modelo_ont),
                    numero_serie = COALESCE(NULLIF(%s, ''), numero_serie),
                    router_principal = COALESCE(NULLIF(%s, ''), router_principal),
                    numero_serie_router = COALESCE(NULLIF(%s, ''), numero_serie_router),
                    router_secundario = COALESCE(NULLIF(%s, ''), router_secundario),
                    numero_serie_router_secundario = COALESCE(NULLIF(%s, ''), numero_serie_router_secundario),
                    tipo_mesh = COALESCE(NULLIF(%s, ''), tipo_mesh),
                    cantidad_routers = COALESCE(%s, cantidad_routers)
                WHERE UPPER(contrato) = %s OR UPPER(contrato) = %s
            """, (
                onu, sn_onu_normalizado, router, sn_router,
                router_secundario, sn_router_secundario, tipo_mesh, cantidad_routers,
                c_val, c_clean
            ))

        # 2. Registrar materiales e inventario si existen (de forma idempotente)
        materiales_agrupados = {}
        if materiales_ids and cantidades:
            for i in range(len(materiales_ids)):
                try:
                    id_m = int(materiales_ids[i])
                    c_m = int(cantidades[i])
                    if id_m > 0 and c_m > 0:
                        materiales_agrupados[id_m] = materiales_agrupados.get(id_m, 0) + c_m
                except (ValueError, TypeError):
                    continue

        # Si la visita ya tenía materiales previamente (ej. reintento o doble clic),
        # revertimos el descuento previo en el inventario del vehículo antes de re-aplicar
        cursor.execute("SELECT id_material, cantidad_usada FROM visitas_materiales WHERE id_visita = %s", (id_visita,))
        materiales_previos = cursor.fetchall()
        if materiales_previos:
            if placa_vehiculo and placa_vehiculo != 'S/P':
                for mp in materiales_previos:
                    cursor.execute("""
                        UPDATE inventario_tecnicos 
                        SET cantidad_disponible = cantidad_disponible + %s 
                        WHERE placa_vehiculo = %s AND id_material = %s
                    """, (mp['cantidad_usada'], placa_vehiculo, mp['id_material']))
            cursor.execute("DELETE FROM visitas_materiales WHERE id_visita = %s", (id_visita,))

        # Registrar los materiales consolidados
        if materiales_agrupados:
            query_materiales = """
                INSERT INTO visitas_materiales (id_visita, id_material, cantidad_usada)
                VALUES (%s, %s, %s)
            """
            query_update_custodia = """
                UPDATE inventario_tecnicos 
                SET cantidad_disponible = cantidad_disponible - %s 
                WHERE placa_vehiculo = %s AND id_material = %s
            """
            for id_mat, cant in materiales_agrupados.items():
                cursor.execute(query_materiales, (id_visita, int(id_mat), int(cant)))
                if placa_vehiculo and placa_vehiculo != 'S/P':
                    cursor.execute("""
                        INSERT IGNORE INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
                        VALUES (%s, %s, 0)
                    """, (placa_vehiculo, int(id_mat)))
                    cursor.execute(query_update_custodia, (int(cant), placa_vehiculo, int(id_mat)))
                        
        # 3. Registrar equipos retirados si hubo cambio o reemplazo
        # Limpiar registros previos de equipos retirados en vehículo para esta visita para evitar duplicados en reintentos
        cursor.execute("DELETE FROM equipos_retirados_visitas WHERE id_visita = %s AND estado_custodia = 'EN_VEHICULO'", (id_visita,))

        equipos_retirados_data = datos.get('equipos_retirados', [])
        if not equipos_retirados_data:
            if datos.get('hubo_cambio_onu') and (datos.get('sn_retirado_onu') or datos.get('motivo_retiro_onu')):
                equipos_retirados_data.append({
                    'tipo_equipo': 'ONU',
                    'numero_serie': datos.get('sn_retirado_onu') or 'SIN_SERIE',
                    'modelo': datos.get('modelo_retirado_onu') or datos.get('modelo_onu'),
                    'motivo_retiro': datos.get('motivo_retiro_onu') or 'REEMPLAZO_UPGRADE',
                    'observacion_retiro': datos.get('obs_retiro_onu') or ''
                })
            if datos.get('hubo_cambio_router') and (datos.get('sn_retirado_router') or datos.get('motivo_retiro_router')):
                equipos_retirados_data.append({
                    'tipo_equipo': 'ROUTER',
                    'numero_serie': datos.get('sn_retirado_router') or 'SIN_SERIE',
                    'modelo': datos.get('modelo_retirado_router') or datos.get('modelo_router'),
                    'motivo_retiro': datos.get('motivo_retiro_router') or 'REEMPLAZO_UPGRADE',
                    'observacion_retiro': datos.get('obs_retiro_router') or ''
                })

        for eq in equipos_retirados_data:
            raw_sn = eq.get('numero_serie') or ''
            sn_ret = raw_sn.strip().upper() if isinstance(raw_sn, str) else str(raw_sn)
            if sn_ret and sn_ret != 'SIN_SERIE':
                tipo_eq = eq.get('tipo_equipo', 'ONU')
                mod_ret = eq.get('modelo') or None
                motivo_ret = eq.get('motivo_retiro', 'REEMPLAZO_UPGRADE')
                obs_ret = eq.get('observacion_retiro', '')
                cursor.execute("""
                    INSERT INTO equipos_retirados_visitas 
                    (id_visita, tipo_equipo, numero_serie, modelo, motivo_retiro, observacion_retiro, tecnico, placa_vehiculo, estado_custodia, fecha_retiro)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'EN_VEHICULO', NOW())
                """, (id_visita, tipo_eq, sn_ret, mod_ret, motivo_ret, obs_ret, tecnico_nombre, placa_vehiculo))

        # 4. Actualizar trazabilidad de equipos nuevos instalados si corresponden a los seriales
        from utils import obtener_variantes_sn_gpon
        seriales_candidatos = [s for s in [sn_nuevo, sn_onu_normalizado, sn_router, sn_router_secundario] if s and str(s).strip() and str(s).strip() != 'SIN_SERIE']
        if seriales_candidatos:
            cursor.execute("SELECT cliente, contrato FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
            v_data = cursor.fetchone()
            nombre_cli = v_data['cliente'] if v_data else ''
            contrato_cli = v_data['contrato'] if v_data else ''

            for s_inst in seriales_candidatos:
                vars_sn = obtener_variantes_sn_gpon(s_inst)
                if not vars_sn:
                    continue
                format_sn = ','.join(['%s'] * len(vars_sn))
                cursor.execute(f"""
                    UPDATE trazabilidad_equipos
                    SET estado = 'INSTALADO_CLIENTE',
                        ubicacion_placa = NULL,
                        id_visita_instalado = %s,
                        contrato_cliente = %s,
                        nombre_cliente = %s,
                        fecha_instalacion = NOW(),
                        observacion = CONCAT(COALESCE(observacion, ''), %s)
                    WHERE numero_serie IN ({format_sn}) AND estado IN ('EN_VEHICULO', 'EN_BODEGA')
                """, (
                    id_visita, 
                    contrato_cli, 
                    nombre_cli, 
                    f" | Instalado en cliente {nombre_cli} (Contrato: {contrato_cli}) por {tecnico_nombre} en visita #{id_visita}", 
                    *vars_sn
                ))

        # Actualizar estado global del técnico
        usuario = obtener_usuario_autenticado()
        if tecnico_nombre:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s, ultima_conexion = NOW() 
                WHERE nombre = %s
            """, ("Disponible", tecnico_nombre))
            
        conexion.commit()
        print(f"[Cierre] Visita #{id_visita} finalizada, insumos y equipos retirados actualizados.")
    except Exception as e:
        conexion.rollback()
        print(f"[Cierre] Error al finalizar visita con materiales: {e}")
        if request.is_json or request.headers.get('Accept') == 'application/json':
            return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    if request.is_json or request.headers.get('Accept') == 'application/json':
        return jsonify({"status": "ok", "message": "Visita finalizada con éxito"})
    return redirect(request.referrer)

# --- 5. RASTREO SILENCIOSO DEL GPS EN VIVO ---
# --- 5. RASTREO SILENCIOSO DEL GPS EN VIVO (ULTRA TOLERANTE) ---
@tecnico_bp.route('/api/tecnico/rastreo_vivo/<int:id_visita>', methods=['POST'])
def rastreo_vivo(id_visita):
    """Recibe la latitud y longitud del celular del técnico y fuerza su guardado."""
    import secrets
    import time

    # Manejo ultra flexible por si viene como JSON o Formulario clásico
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    lat = datos.get('latitud')
    lon = datos.get('longitud')
    
    bateria = datos.get('bateria')
    try:
        bateria = int(bateria) if bateria is not None else None
    except (ValueError, TypeError):
        bateria = None

    cargando_raw = datos.get('cargando')
    cargando = 1 if cargando_raw in [True, 1, '1', 'true', 'True'] else 0

    accuracy = float(datos.get('precision') or datos.get('accuracy') or 0.0)
    speed = float(datos.get('velocidad') or datos.get('speed') or 0.0)
    bearing = float(datos.get('bearing') or datos.get('rumbo') or 0.0)
    altitude = float(datos.get('altitud') or datos.get('altitude') or 0.0)
    device_id = datos.get('device_id') or None
    modelo_dispositivo = datos.get('modelo_dispositivo') or None
    version_app = datos.get('version_app') or None
    tecnico_param = datos.get('tecnico_nombre')
    ts_now = int(time.time() * 1000)

    if lat and lon:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        try:
            # 1. Actualizar coordenadas para el rastreo del cliente en la visita
            cursor.execute("""
                UPDATE visitas_tecnicas 
                SET latitud_gps_vivo = %s, 
                    longitud_gps_vivo = %s, 
                    ultima_actualizacion_gps = NOW() 
                WHERE id_visita = %s
            """, (lat, lon, id_visita))

            # 2. Identificar el técnico asignado
            tecnico_nombre = tecnico_param or session.get('user_name')
            if not tecnico_nombre:
                cursor.execute("SELECT tecnico_principal, tecnico_apoyo FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
                tec_row = cursor.fetchone()
                if tec_row:
                    tecnico_nombre = tec_row.get('tecnico_principal') or tec_row.get('tecnico_apoyo')

            if tecnico_nombre:
                # 3. Actualizar la ficha del técnico con ubicación y telemetría
                cursor.execute("""
                    UPDATE tecnicos 
                    SET latitud_actual = %s, 
                        longitud_actual = %s, 
                        ultima_conexion = NOW(),
                        bateria = COALESCE(%s, bateria),
                        cargando = %s,
                        device_id = COALESCE(%s, device_id),
                        modelo_dispositivo = COALESCE(%s, modelo_dispositivo),
                        version_app = COALESCE(%s, version_app)
                    WHERE nombre = %s OR UPPER(nombre) = %s
                """, (lat, lon, bateria, cargando, device_id, modelo_dispositivo, version_app, tecnico_nombre, tecnico_nombre.upper()))

                # Obtener id_tecnico y nombre canónico
                cursor.execute("SELECT id_tecnico, nombre, device_id FROM tecnicos WHERE nombre = %s OR UPPER(nombre) = %s LIMIT 1", (tecnico_nombre, tecnico_nombre.upper()))
                row_t = cursor.fetchone()
                id_tec = row_t['id_tecnico'] if row_t else None
                nombre_canonico = row_t['nombre'] if row_t else tecnico_nombre
                dev_db = row_t.get('device_id') if row_t else None

                dev_target = device_id or dev_db or f"TECH_{nombre_canonico}"
                uuid_val = f"{dev_target}_{ts_now}_{secrets.token_hex(4)}"

                # 4. Asegurar que dev_target existe en tracker_devices (requerido por FK)
                cursor.execute("""
                    INSERT INTO tracker_devices (
                        device_id, device_model, android_version, first_seen, last_seen,
                        last_latitude, last_longitude, battery_level, is_charging, network_type,
                        last_location_timestamp
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        last_seen = VALUES(last_seen),
                        last_latitude = VALUES(last_latitude),
                        last_longitude = VALUES(last_longitude),
                        battery_level = VALUES(battery_level),
                        is_charging = VALUES(is_charging),
                        network_type = VALUES(network_type),
                        last_location_timestamp = VALUES(last_location_timestamp)
                """, (
                    dev_target, modelo_dispositivo or 'PMT Device', version_app or 'Android', ts_now, ts_now,
                    float(lat), float(lon), bateria if bateria is not None else 100, cargando, 'fused', ts_now
                ))

                # 5. Auto-vincular en tracker_device_profiles
                cursor.execute("""
                    INSERT INTO tracker_device_profiles (device_id, display_name, technician, atlas_technician_id)
                    VALUES (%s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        technician = VALUES(technician),
                        atlas_technician_id = VALUES(atlas_technician_id),
                        display_name = IF(display_name IS NULL OR display_name = '', VALUES(display_name), display_name)
                """, (dev_target, f"PMT {nombre_canonico}", nombre_canonico, id_tec))

                # 6. Registrar punto de ruta histórico en tracker_location_records
                cursor.execute("""
                    INSERT INTO tracker_location_records (
                        uuid, device_id, latitude, longitude, accuracy, speed, bearing, altitude,
                        battery_level, is_charging, network_type, provider, timestamp, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    uuid_val, dev_target, float(lat), float(lon), accuracy, speed, bearing, altitude,
                    bateria if bateria is not None else 100, cargando, 'fused', 'fused', ts_now, ts_now
                ))

            conexion.commit()
            print(f"[GPS] Ubicación y ruta guardadas con éxito para técnico {tecnico_nombre} en visita #{id_visita}")
        except Exception as e:
            print(f"[GPS] Error crítico en rastreo_vivo: {e}")
        finally:
            if 'conexion' in locals() and conexion.is_connected():
                cursor.close()
                conexion.close()
    else:
        print("[GPS] Advertencia: Llego la petición pero los valores lat/lon vinieron vacíos.")
                
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
        
        # B. Guardamos los materiales dinámicamente uno por uno si existen (idempotente)
        materiales_agrupados = {}
        if materiales_ids and cantidades:
            for i in range(len(materiales_ids)):
                try:
                    id_m = int(materiales_ids[i])
                    c_m = int(cantidades[i])
                    if id_m > 0 and c_m > 0:
                        materiales_agrupados[id_m] = materiales_agrupados.get(id_m, 0) + c_m
                except (ValueError, TypeError):
                    continue

        cursor.execute("DELETE FROM visitas_materiales WHERE id_visita = %s", (id_visita,))
        if materiales_agrupados:
            query_materiales = """
                INSERT INTO visitas_materiales (id_visita, id_material, cantidad_usada)
                VALUES (%s, %s, %s)
            """
            for id_mat, cant in materiales_agrupados.items():
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
        print(f"[Cierre] Visita #{id_visita} cerrada y materiales registrados exitosamente.")
        
    except Exception as e:
        conexion.rollback()
        print(f"[Cierre] Error al cerrar visita con materiales: {e}")
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
        contrato_param = request.args.get('contrato', '').strip()
        # Buscamos visitas del cliente en los últimos 3 meses (90 días)
        # Filtramos para que traiga principalmente las FINALIZADAS o CANCELADAS para ver el desenlace.
        # Soporta nombres invertidos dividiendo la búsqueda por palabras o por número de contrato.
        palabras = [p.strip() for p in nombre_cliente.split() if p.strip()]
        
        if palabras or contrato_param:
            condiciones_list = []
            valores = []
            
            if palabras:
                cond_palabras = " AND ".join(["cliente LIKE %s" for _ in palabras])
                condiciones_list.append(f"({cond_palabras})")
                for p in palabras:
                    valores.append(f"%{p}%")
                    
            if contrato_param:
                condiciones_list.append("(contrato = %s OR contrato = %s)")
                valores.append(contrato_param)
                valores.append(contrato_param.lstrip('0'))
                
            cond_final = " OR ".join(condiciones_list)
            query = f"""
                SELECT fecha_programada, problema, solucion_tecnico, observacion_tecnico, tecnico_principal, estado
                FROM visitas_tecnicas
                WHERE ({cond_final}) AND estado IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
                AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
                ORDER BY fecha_programada DESC
            """
            cursor.execute(query, tuple(valores))
        else:
            query = """
                SELECT fecha_programada, problema, solucion_tecnico, observacion_tecnico, tecnico_principal, estado
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


@tecnico_bp.route('/api/app/version', methods=['GET'])
def get_app_version():
    return jsonify({
        "status": "ok",
        "version_code": 3,
        "version_name": "1.2.0",
        "apk_url": "/static/app/futurity_atlas.apk",
        "release_notes": "Sincronización continua de ubicación con pantalla apagada, telemetría de batería en tiempo real y soporte offline para visitas técnicas.",
        "force_update": False
    })


@tecnico_bp.route('/api/tecnico/ping_global', methods=['POST'])
def ping_global():
    import secrets
    import time

    usuario = obtener_usuario_autenticado()
    if not usuario or usuario.get('role') not in ['TECNICO', 'ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    lat = datos.get('latitud')
    lon = datos.get('longitud')
    tecnico_nombre = datos.get('tecnico_nombre')
    if usuario.get('role') == 'TECNICO' or not tecnico_nombre:
        tecnico_nombre = usuario.get('username')

    bateria = datos.get('bateria')
    try:
        bateria = int(bateria) if bateria is not None else None
    except (ValueError, TypeError):
        bateria = None

    cargando_raw = datos.get('cargando')
    cargando = 1 if cargando_raw in [True, 1, '1', 'true', 'True'] else 0

    accuracy = float(datos.get('precision') or datos.get('accuracy') or 0.0)
    speed = float(datos.get('velocidad') or datos.get('speed') or 0.0)
    bearing = float(datos.get('bearing') or datos.get('rumbo') or 0.0)
    altitude = float(datos.get('altitud') or datos.get('altitude') or 0.0)
    device_id = datos.get('device_id') or None
    modelo_dispositivo = datos.get('modelo_dispositivo') or None
    version_app = datos.get('version_app') or None
    network_type = str(datos.get('network_type') or 'fused')
    ts_now = int(time.time() * 1000)

    if lat and lon and tecnico_nombre:
        conexion = get_db_connection()
        if not conexion:
            return jsonify({"status": "error", "message": "Error de conexión a base de datos"}), 500
        cursor = conexion.cursor(dictionary=True)
        try:
            # 1. Actualizar ficha del técnico en tiempo real
            cursor.execute("""
                UPDATE tecnicos 
                SET latitud_actual = %s, 
                    longitud_actual = %s, 
                    ultima_conexion = NOW(),
                    estado_actividad = IF(estado_actividad = 'Desconectado', 'Disponible', estado_actividad),
                    bateria = COALESCE(%s, bateria),
                    cargando = %s,
                    device_id = COALESCE(%s, device_id),
                    modelo_dispositivo = COALESCE(%s, modelo_dispositivo),
                    version_app = COALESCE(%s, version_app)
                WHERE nombre = %s OR UPPER(nombre) = %s
            """, (lat, lon, bateria, cargando, device_id, modelo_dispositivo, version_app, tecnico_nombre, tecnico_nombre.upper()))
            conexion.commit()

            # Obtener id_tecnico y nombre canónico
            cursor.execute("SELECT id_tecnico, nombre, device_id FROM tecnicos WHERE nombre = %s OR UPPER(nombre) = %s LIMIT 1", (tecnico_nombre, tecnico_nombre.upper()))
            row_tec = cursor.fetchone()
            id_tec = row_tec['id_tecnico'] if row_tec else None
            nombre_canonico = row_tec['nombre'] if row_tec else tecnico_nombre
            dev_db = row_tec.get('device_id') if row_tec else None

            dev_target = device_id or dev_db or f"TECH_{nombre_canonico}"
            uuid_val = f"{dev_target}_{ts_now}_{secrets.token_hex(4)}"

            # 2. Asegurar que dev_target existe en tracker_devices (requerido por FK)
            cursor.execute("""
                INSERT INTO tracker_devices (
                    device_id, device_model, android_version, first_seen, last_seen,
                    last_latitude, last_longitude, battery_level, is_charging, network_type,
                    last_location_timestamp
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    last_seen = VALUES(last_seen),
                    last_latitude = VALUES(last_latitude),
                    last_longitude = VALUES(last_longitude),
                    battery_level = VALUES(battery_level),
                    is_charging = VALUES(is_charging),
                    network_type = VALUES(network_type),
                    last_location_timestamp = VALUES(last_location_timestamp)
            """, (
                dev_target, modelo_dispositivo or 'PMT Device', version_app or 'Android', ts_now, ts_now,
                float(lat), float(lon), bateria if bateria is not None else 100, cargando, network_type, ts_now
            ))

            # 3. Vincular automáticamente dispositivo con perfil de técnico
            cursor.execute("""
                INSERT INTO tracker_device_profiles (device_id, display_name, technician, atlas_technician_id)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    technician = VALUES(technician),
                    atlas_technician_id = VALUES(atlas_technician_id),
                    display_name = IF(display_name IS NULL OR display_name = '', VALUES(display_name), display_name)
            """, (dev_target, f"PMT {nombre_canonico}", nombre_canonico, id_tec))

            # 4. Registrar punto de ruta histórico en tracker_location_records
            cursor.execute("""
                INSERT INTO tracker_location_records (
                    uuid, device_id, latitude, longitude, accuracy, speed, bearing, altitude,
                    battery_level, is_charging, network_type, provider, timestamp, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                uuid_val, dev_target, float(lat), float(lon), accuracy, speed, bearing, altitude,
                bateria if bateria is not None else 100, cargando, network_type, 'fused', ts_now, ts_now
            ))

            conexion.commit()
        except Exception as e:
            print(f"Error in ping_global: {e}")
        finally:
            cursor.close()
            conexion.close()
            
    return jsonify({"status": "ok"})



@tecnico_bp.route('/api/tecnico/descanso', methods=['POST'])
def descanso_tecnico():
    usuario = obtener_usuario_autenticado()
    if not usuario or usuario.get('role') not in ['TECNICO', 'ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    accion = datos.get('accion')
    tecnico_nombre = datos.get('tecnico_nombre')
    if usuario.get('role') == 'TECNICO' or not tecnico_nombre:
        tecnico_nombre = usuario.get('username')

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
    usuario = obtener_usuario_autenticado()
    if not usuario or usuario.get('role') not in ['TECNICO', 'ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    area = datos.get('area_trabajo')
    tecnico_nombre = datos.get('tecnico_nombre')
    if usuario.get('role') == 'TECNICO' or not tecnico_nombre:
        tecnico_nombre = usuario.get('username')

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
    usuario = obtener_usuario_autenticado()
    if not usuario or usuario.get('role') not in ['TECNICO', 'ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    mensaje = datos.get('mensaje')
    tecnico_nombre = datos.get('tecnico_nombre')
    if usuario.get('role') == 'TECNICO' or not tecnico_nombre:
        tecnico_nombre = usuario.get('username')

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
    usuario = obtener_usuario_autenticado()
    if not usuario or usuario.get('role') not in ['TECNICO', 'ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    tecnico_nombre = datos.get('tecnico_nombre')
    if usuario.get('role') == 'TECNICO' or not tecnico_nombre:
        tecnico_nombre = usuario.get('username')

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


@tecnico_bp.route('/api/tecnico/verificar_firma/<int:id_visita>')
def verificar_firma(id_visita):
    from flask import url_for
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a base de datos"}), 500
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("SELECT firma_cliente, token_rastreo FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        visita = cursor.fetchone()
        if not visita:
            return jsonify({"status": "error", "message": "Visita no encontrada"}), 404
        
        if visita['firma_cliente']:
            return jsonify({
                "status": "firmado", 
                "firma_url": url_for('static', filename='uploads/' + visita['firma_cliente'])
            })
        else:
            return jsonify({
                "status": "pendiente",
                "token": visita['token_rastreo']
            })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/api/tecnico/posponer/<int:id_visita>', methods=['POST'])
def posponer_visita(id_visita):
    usuario = obtener_usuario_autenticado()
    if not usuario or usuario.get('role') not in ['TECNICO', 'ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    motivo = datos.get('motivo')
    motivo_otro = datos.get('motivo_otro')
    
    motivo_final = motivo
    if motivo == 'Otro motivo' and motivo_otro:
        motivo_final = motivo_otro
        
    tecnico_nombre = datos.get('tecnico_nombre')
    if usuario.get('role') == 'TECNICO' or not tecnico_nombre:
        tecnico_nombre = usuario.get('username')
    
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        # 1. Obtener observacion actual de callcenter
        cursor.execute("SELECT observacion_callcenter FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
        visita = cursor.fetchone()
        if not visita:
            return jsonify({"status": "error", "message": "Visita no encontrada"}), 404
            
        obs_actual = visita['observacion_callcenter'] or ""
        import datetime
        now_str = datetime.datetime.now().strftime("%H:%M")
        nota_pospuesta = f"\n[Pospuesta {now_str}]: {motivo_final}"
        nueva_obs = (obs_actual + nota_pospuesta).strip()
        
        # 2. Restablecer visita a PENDIENTE, limpiando marcas de tiempo
        cursor.execute("""
            UPDATE visitas_tecnicas 
            SET estado = 'PENDIENTE',
                hora_en_ruta = NULL,
                hora_inicio_visita = NULL,
                observacion_callcenter = %s
            WHERE id_visita = %s
        """, (nueva_obs, id_visita))
        
        # 3. Liberar estado del técnico a Disponible
        if tecnico_nombre:
            cursor.execute("""
                UPDATE tecnicos 
                SET estado_actividad = %s,
                    ultima_conexion = NOW() 
                WHERE nombre = %s
            """, ("Disponible", tecnico_nombre))
            
        conexion.commit()
        print(f"[Posponer] Visita #{id_visita} pospuesta para más tarde por el técnico.")
        return jsonify({"status": "ok"})
    except Exception as e:
        conexion.rollback()
        print(f"[Posponer] Error al posponer visita #{id_visita}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/tecnico/mi_inventario', methods=['GET'])
def api_tecnico_mi_inventario():
    usuario = obtener_usuario_autenticado()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        username = usuario.get('username') or session.get('user_name')
        cursor.execute("""
            SELECT id_tecnico, nombre, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa 
            FROM tecnicos 
            WHERE nombre = %s OR UPPER(nombre) = %s OR nombre LIKE %s
        """, (username, (username or '').upper(), f"%{username}%"))
        row_tec = cursor.fetchone()
        
        if not row_tec:
            return jsonify({"status": "error", "message": "Técnico no encontrado"}), 404
            
        nombre_tecnico = row_tec['nombre']
        placa = row_tec['placa']
        
        # 1. Materiales en el vehículo
        materiales = []
        if placa and placa != 'S/P':
            cursor.execute("""
                SELECT it.id_material, m.nombre_material, m.codigo_material, m.unidad_medida, m.categoria, it.cantidad_disponible
                FROM inventario_tecnicos it
                JOIN materiales m ON it.id_material = m.id_material
                WHERE it.placa_vehiculo = %s AND it.cantidad_disponible > 0
                ORDER BY m.nombre_material ASC
            """, (placa,))
            materiales = cursor.fetchall()
            
        # 2. Equipos retirados en custodia del vehículo
        cursor.execute("""
            SELECT er.id_retiro, er.id_visita, er.tipo_equipo, er.numero_serie, er.modelo, 
                   er.motivo_retiro, er.observacion_retiro, er.fecha_retiro, er.placa_vehiculo,
                   v.cliente, v.contrato
            FROM equipos_retirados_visitas er
            LEFT JOIN visitas_tecnicas v ON er.id_visita = v.id_visita
            WHERE (er.tecnico = %s OR (er.placa_vehiculo = %s AND er.placa_vehiculo != 'S/P'))
              AND er.estado_custodia = 'EN_VEHICULO'
            ORDER BY er.fecha_retiro DESC
        """, (nombre_tecnico, placa))
        equipos_retirados = cursor.fetchall()
        for eq in equipos_retirados:
            if eq.get('fecha_retiro'):
                eq['fecha_retiro'] = eq['fecha_retiro'].strftime('%Y-%m-%d %H:%M:%S')

        # 3. Equipos asignados para instalación (ONTs y Routers en trazabilidad_equipos)
        equipos_asignados = []
        if placa and placa != 'S/P':
            cursor.execute("""
                SELECT id_equipo, tipo_equipo, modelo, marca, numero_serie, estado, 
                       fecha_entrega_vehiculo, observacion
                FROM trazabilidad_equipos
                WHERE ubicacion_placa = %s AND estado = 'EN_VEHICULO'
                ORDER BY tipo_equipo ASC, modelo ASC, fecha_entrega_vehiculo DESC
            """, (placa,))
            equipos_asignados = cursor.fetchall()
            for eq in equipos_asignados:
                if eq.get('fecha_entrega_vehiculo'):
                    eq['fecha_entrega_vehiculo'] = eq['fecha_entrega_vehiculo'].strftime('%Y-%m-%d %H:%M:%S')
                
        return jsonify({
            "status": "ok",
            "tecnico": nombre_tecnico,
            "placa": placa,
            "materiales": materiales,
            "equipos_asignados": equipos_asignados,
            "equipos_retirados": equipos_retirados
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/api/tecnico/mis_requisiciones', methods=['GET'])
def api_tecnico_mis_requisiciones():
    usuario = obtener_usuario_autenticado()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        username = usuario.get('username') or session.get('user_name')
        cursor.execute("""
            SELECT id_tecnico, nombre, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa 
            FROM tecnicos 
            WHERE nombre = %s OR UPPER(nombre) = %s OR nombre LIKE %s
        """, (username, (username or '').upper(), f"%{username}%"))
        row_tec = cursor.fetchone()
        
        if not row_tec:
            return jsonify({"status": "error", "message": "Técnico no encontrado"}), 404
            
        nombre_tecnico = row_tec['nombre']
        placa = row_tec['placa']

        cursor.execute("""
            SELECT * FROM requisiciones_materiales
            WHERE (placa_vehiculo = %s OR nombre_tecnico = %s)
            ORDER BY fecha_solicitud DESC LIMIT 30
        """, (placa, nombre_tecnico))
        reqs = cursor.fetchall()

        for r in reqs:
            r['tipo_requisicion'] = r.get('tipo_requisicion') or 'MATERIALES'
            r['requiere_comodato'] = bool(r.get('requiere_comodato'))
            obs = r.get('observaciones') or ''
            if '[RECHAZO:' in obs:
                m_rechazo = re.search(r'\[RECHAZO:\s*(.*?)\]', obs)
                r['motivo_rechazo'] = m_rechazo.group(1).strip() if m_rechazo else ''
                r['comentario_tecnico'] = re.sub(r'\[RECHAZO:\s*.*?\]', '', obs).strip()
            else:
                r['comentario_tecnico'] = obs.strip()
                r['motivo_rechazo'] = ''
            cursor.execute("""
                SELECT ri.*
                FROM requisiciones_materiales_items ri
                WHERE ri.id_requisicion = %s
            """, (r['id_requisicion'],))
            r['items'] = cursor.fetchall()
            if r.get('fecha_solicitud'):
                r['fecha_solicitud_fmt'] = r['fecha_solicitud'].strftime('%Y-%m-%d %H:%M')
            if r.get('fecha_aprobacion'):
                r['fecha_aprobacion_fmt'] = r['fecha_aprobacion'].strftime('%Y-%m-%d %H:%M')
            if r.get('fecha_entrega'):
                r['fecha_entrega_fmt'] = r['fecha_entrega'].strftime('%Y-%m-%d %H:%M')

        # Contar cuántas están listas para firmar
        pendientes_firma = [r for r in reqs if r['estado'] == 'LISTO_ENTREGA']

        return jsonify({
            "status": "ok",
            "placa": placa,
            "tecnico": nombre_tecnico,
            "requisiciones": reqs,
            "total_listas_para_firmar": len(pendientes_firma)
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/api/tecnico/requisiciones/<int:id_requisicion>/firmar', methods=['POST'])
def api_tecnico_requisicion_firmar(id_requisicion):
    usuario = obtener_usuario_autenticado()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    data = request.json or {}
    firma_base64 = data.get('firma_tecnico')
    if not firma_base64:
        return jsonify({"status": "error", "message": "Debes dibujar tu firma digital para recibir."}), 400

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500

    cursor = conexion.cursor(dictionary=True)
    try:
        username = usuario.get('username') or session.get('user_name')

        cursor.execute("SELECT * FROM requisiciones_materiales WHERE id_requisicion = %s", (id_requisicion,))
        req = cursor.fetchone()
        if not req:
            return jsonify({"status": "error", "message": "Requisición no encontrada"}), 404
        if req['estado'] == 'ENTREGADA':
            return jsonify({"status": "error", "message": "Esta solicitud ya fue entregada y firmada."}), 400

        placa = req['placa_vehiculo']

        cursor.execute("SELECT * FROM requisiciones_materiales_items WHERE id_requisicion = %s", (id_requisicion,))
        items = cursor.fetchall()

        # Transferencia atómica
        for it in items:
            id_mat = it.get('id_material')
            if it.get('cantidad_aprobada') is not None:
                cant = int(it['cantidad_aprobada'])
            else:
                cant = int(it.get('cantidad_solicitada') or 0)

            if cant <= 0:
                continue

            # Restar de materiales (bodega) solo si es material tradicional
            if id_mat:
                cursor.execute("UPDATE materiales SET stock_bodega = GREATEST(0, stock_bodega - %s) WHERE id_material = %s", (cant, id_mat))

                # Sumar a inventario_tecnicos de la placa
                cursor.execute("SELECT id_inventario, cantidad_disponible FROM inventario_tecnicos WHERE placa_vehiculo = %s AND id_material = %s", (placa, id_mat))
                inv_row = cursor.fetchone()
                if inv_row:
                    cursor.execute("UPDATE inventario_tecnicos SET cantidad_disponible = cantidad_disponible + %s WHERE id_inventario = %s", (cant, inv_row['id_inventario']))
                else:
                    cursor.execute("INSERT INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible) VALUES (%s, %s, %s)", (placa, id_mat, cant))

        # Actualizar estado
        cursor.execute("""
            UPDATE requisiciones_materiales
            SET estado = 'ENTREGADA',
                fecha_entrega = NOW(),
                firma_tecnico = %s,
                entregado_por = COALESCE(aprobado_por, 'Bodega Central')
            WHERE id_requisicion = %s
        """, (firma_base64, id_requisicion))

        conexion.commit()
        return jsonify({
            "status": "ok",
            "message": f"¡Firma registrada con éxito! Los materiales fueron cargados a tu buseta ({placa}).",
            "numero_solicitud": req['numero_solicitud']
        })
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/api/tecnico/devolver_equipos_bodega', methods=['POST'])
def api_tecnico_devolver_equipos_bodega():
    usuario = obtener_usuario_autenticado()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    data = request.json or {}
    ids_retiro = data.get('ids_retiro', [])
    if isinstance(ids_retiro, int):
        ids_retiro = [ids_retiro]
        
    if not ids_retiro:
        return jsonify({"status": "error", "message": "No se seleccionaron equipos para devolver."}), 400
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        agente = usuario.get('username') or session.get('user_name') or 'SISTEMA'
        format_strings = ','.join(['%s'] * len(ids_retiro))
        query = f"""
            UPDATE equipos_retirados_visitas 
            SET estado_custodia = 'DEVUELTO_BODEGA', 
                fecha_devolucion_bodega = NOW(),
                recibido_por = %s
            WHERE id_retiro IN ({format_strings})
        """
        params = [agente] + [int(x) for x in ids_retiro]
        cursor.execute(query, tuple(params))
        conexion.commit()
        
        return jsonify({
            "status": "ok", 
            "message": f"Se devolvieron {len(ids_retiro)} equipo(s) a Bodega Central exitosamente."
        })
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/tecnico/traspaso_material', methods=['POST'])
def traspaso_material_tecnico():
    usuario = obtener_usuario_autenticado()
    if not usuario:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    data = request.json or {}
    destino_nombre = data.get('tecnico_destino_nombre', '').strip()
    id_material = data.get('id_material')
    cantidad = int(data.get('cantidad', 0))
    
    if not destino_nombre or not id_material or cantidad <= 0:
        return jsonify({"status": "error", "message": "Faltan datos requeridos (técnico destino, material, cantidad > 0)."}), 400
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        origen_nombre = usuario.get('username') or session.get('user_name')
        cursor.execute("""
            SELECT nombre, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa 
            FROM tecnicos 
            WHERE nombre = %s OR UPPER(nombre) = %s OR nombre LIKE %s
        """, (origen_nombre, (origen_nombre or '').upper(), f"%{origen_nombre}%"))
        row_origen = cursor.fetchone()
        if not row_origen:
            return jsonify({"status": "error", "message": "Técnico de origen no encontrado"}), 404
            
        tecnico_origen_nombre = row_origen['nombre']
        placa_origen = row_origen['placa']
        
        if placa_origen == 'S/P':
            return jsonify({"status": "error", "message": "El técnico debe tener una buseta/placa asignada para transferir inventario."}), 400

        # Caso 1: Devolución a Bodega Central
        if destino_nombre in ['BODEGA_CENTRAL', 'BODEGA CENTRAL', 'BODEGA']:
            tecnico_destino_nombre = 'BODEGA CENTRAL'
            placa_destino = 'BODEGA'
            
            # Descontar del origen
            cursor.execute("""
                INSERT IGNORE INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
                VALUES (%s, %s, 0)
            """, (placa_origen, int(id_material)))
            
            cursor.execute("""
                UPDATE inventario_tecnicos 
                SET cantidad_disponible = cantidad_disponible - %s 
                WHERE placa_vehiculo = %s AND id_material = %s
            """, (cantidad, placa_origen, int(id_material)))
            
            # Sumar al stock de bodega central
            cursor.execute("""
                UPDATE materiales 
                SET stock_bodega = COALESCE(stock_bodega, 0) + %s 
                WHERE id_material = %s
            """, (cantidad, int(id_material)))
            
            # Registrar log de traspaso
            cursor.execute("""
                INSERT INTO traspasos_tecnicos (tecnico_origen, placa_origen, tecnico_destino, placa_destino, id_material, cantidad, agente_registro, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """, (tecnico_origen_nombre, placa_origen, tecnico_destino_nombre, placa_destino, int(id_material), cantidad, tecnico_origen_nombre))
            
            conexion.commit()
            return jsonify({"status": "ok", "message": f"Devolución de {cantidad} unidad(es) a Bodega Central registrada exitosamente."})

        # Caso 2: Traspaso a otro técnico compañero
        cursor.execute("SELECT nombre, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa FROM tecnicos WHERE nombre = %s", (destino_nombre,))
        row_destino = cursor.fetchone()
        if not row_destino:
            return jsonify({"status": "error", "message": "Técnico destino no encontrado"}), 404
            
        tecnico_destino_nombre = row_destino['nombre']
        placa_destino = row_destino['placa']
        
        if placa_destino == 'S/P':
            return jsonify({"status": "error", "message": f"El técnico {tecnico_destino_nombre} no tiene una buseta/placa asignada para recibir inventario."}), 400
            
        # Descontar del origen
        cursor.execute("""
            INSERT IGNORE INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
            VALUES (%s, %s, 0)
        """, (placa_origen, int(id_material)))
        
        cursor.execute("""
            UPDATE inventario_tecnicos 
            SET cantidad_disponible = cantidad_disponible - %s 
            WHERE placa_vehiculo = %s AND id_material = %s
        """, (cantidad, placa_origen, int(id_material)))
        
        # Sumar al destino
        cursor.execute("""
            INSERT IGNORE INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
            VALUES (%s, %s, 0)
        """, (placa_destino, int(id_material)))
        
        cursor.execute("""
            UPDATE inventario_tecnicos 
            SET cantidad_disponible = cantidad_disponible + %s 
            WHERE placa_vehiculo = %s AND id_material = %s
        """, (cantidad, placa_destino, int(id_material)))
        
        # Registrar log de traspaso
        cursor.execute("""
            INSERT INTO traspasos_tecnicos (tecnico_origen, placa_origen, tecnico_destino, placa_destino, id_material, cantidad, agente_registro, fecha_hora)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (tecnico_origen_nombre, placa_origen, tecnico_destino_nombre, placa_destino, int(id_material), cantidad, tecnico_origen_nombre))
        
        conexion.commit()
        return jsonify({"status": "ok", "message": f"Se transfirieron {cantidad} unidad(es) a {tecnico_destino_nombre}."})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/admin/tecnicos/reasignar_vehiculo', methods=['POST'])
def reasignar_vehiculo_tecnico():
    data = request.json or {}
    id_tecnico = data.get('id_tecnico')
    placa_asignada_hoy = data.get('placa_asignada_hoy', '').strip().upper()
    transferir_inventario = data.get('transferir_inventario', False)
    
    if not id_tecnico:
        return jsonify({"status": "error", "message": "ID de técnico es requerido."}), 400
        
    es_reset = placa_asignada_hoy in ['', 'RESET', 'TITULAR']
    if es_reset:
        nueva_placa_db = None
    else:
        nueva_placa_db = placa_asignada_hoy
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        # Obtener datos del técnico y su placa activa actual antes del cambio
        cursor.execute("SELECT nombre, placa_vehiculo, COALESCE(NULLIF(placa_asignada_hoy, ''), placa_vehiculo, 'S/P') AS placa_actual FROM tecnicos WHERE id_tecnico = %s", (id_tecnico,))
        tec_row = cursor.fetchone()
        if not tec_row:
            return jsonify({"status": "error", "message": "Técnico no encontrado."}), 404
            
        nombre_tecnico = tec_row['nombre']
        placa_anterior = tec_row['placa_actual']
        placa_titular = tec_row['placa_vehiculo']
        
        # Placa final a asignar
        placa_final = placa_titular if es_reset else nueva_placa_db
        
        # Si la placa elegida coincide con la titular habitual del técnico, se trata como reset
        if placa_final == placa_titular or placa_final == 'S/P':
            es_reset = True
            nueva_placa_db = None
            placa_final = placa_titular

        # Regla de seguridad crítica: Si se está retornando a la furgoneta titular o las placas son iguales,
        # NUNCA se debe transferir el inventario. Cada furgoneta mantiene sus materiales y equipos.
        if es_reset or placa_anterior == placa_final or placa_anterior == 'S/P' or placa_final == 'S/P':
            transferir_inventario = False
        else:
            transferir_inventario = (transferir_inventario is True or transferir_inventario == 1 or str(transferir_inventario).lower() == 'true')
        
        # Si solicitó transferir el inventario físico entre las busetas
        if transferir_inventario and placa_anterior and placa_final and placa_anterior != placa_final and placa_anterior != 'S/P':
            # Buscar todos los insumos disponibles en la buseta anterior
            cursor.execute("SELECT id_material, cantidad_disponible FROM inventario_tecnicos WHERE placa_vehiculo = %s AND cantidad_disponible > 0", (placa_anterior,))
            insumos_anteriores = cursor.fetchall()
            
            for item in insumos_anteriores:
                id_mat = item['id_material']
                cant = item['cantidad_disponible']
                
                # Descontar de la buseta anterior
                cursor.execute("UPDATE inventario_tecnicos SET cantidad_disponible = 0 WHERE placa_vehiculo = %s AND id_material = %s", (placa_anterior, id_mat))
                
                # Sumar a la nueva buseta
                cursor.execute("""
                    INSERT IGNORE INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
                    VALUES (%s, %s, 0)
                """, (placa_final, id_mat))
                
                cursor.execute("""
                    UPDATE inventario_tecnicos SET cantidad_disponible = cantidad_disponible + %s WHERE placa_vehiculo = %s AND id_material = %s
                """, (cant, placa_final, id_mat))
                
                # Registrar en log auditables de traspasos
                cursor.execute("""
                    INSERT INTO traspasos_tecnicos (tecnico_origen, placa_origen, tecnico_destino, placa_destino, id_material, cantidad, agente_registro, fecha_hora)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                """, (nombre_tecnico, placa_anterior, nombre_tecnico, placa_final, id_mat, cant, f"CallCenter ({nombre_tecnico})"))

            # Trasladar también los equipos serializados de la buseta anterior a la nueva buseta
            cursor.execute("""
                UPDATE trazabilidad_equipos
                SET ubicacion_placa = %s,
                    observacion = CONCAT(COALESCE(observacion, ''), %s)
                WHERE ubicacion_placa = %s AND estado = 'EN_VEHICULO'
            """, (placa_final, f" | Traslado automático por reasignación de buseta a {placa_final}", placa_anterior))
                
        # Actualizar la asignación del técnico
        cursor.execute("UPDATE tecnicos SET placa_asignada_hoy = %s WHERE id_tecnico = %s", (nueva_placa_db, id_tecnico))
        conexion.commit()
        
        msg = f"Buseta reasignada a {placa_final} correctamente."
        if transferir_inventario:
            msg += " Se trasladó la custodia física de insumos y equipos a la nueva buseta."
        return jsonify({"status": "ok", "message": msg})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/admin/traspasos_historial', methods=['GET'])
def historial_traspasos():
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        query = """
            SELECT t.id_traspaso, t.tecnico_origen, t.placa_origen, t.tecnico_destino, t.placa_destino,
                   t.id_material, m.nombre_material, t.cantidad, t.agente_registro, t.fecha_hora
            FROM traspasos_tecnicos t
            LEFT JOIN materiales m ON t.id_material = m.id_material
            ORDER BY t.id_traspaso DESC
            LIMIT 100
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        for r in rows:
            if r.get('fecha_hora'):
                r['fecha_hora'] = r['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S')
        return jsonify({"status": "ok", "traspasos": rows})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/admin/vehiculos', methods=['GET'])
def listar_vehiculos():
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id_vehiculo, placa, descripcion, activo, fecha_registro FROM vehiculos ORDER BY placa ASC")
        rows = cursor.fetchall()
        for r in rows:
            if r.get('fecha_registro'):
                r['fecha_registro'] = r['fecha_registro'].strftime('%Y-%m-%d %H:%M:%S')
        return jsonify({"status": "ok", "vehiculos": rows})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/admin/vehiculos', methods=['POST'])
def crear_vehiculo():
    data = request.json or {}
    placa = data.get('placa', '').strip().upper()
    descripcion = data.get('descripcion', '').strip()
    
    if not placa:
        return jsonify({"status": "error", "message": "La placa del vehículo es requerida."}), 400
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("""
            INSERT INTO vehiculos (placa, descripcion, activo)
            VALUES (%s, %s, 1)
            ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activo = 1
        """, (placa, descripcion or f"Vehículo / Buseta {placa}"))
        
        conexion.commit()
        return jsonify({"status": "ok", "message": f"Vehículo con placa '{placa}' registrado correctamente."})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@tecnico_bp.route('/api/admin/vehiculos/<int:id_vehiculo>/toggle', methods=['POST'])
def toggle_vehiculo(id_vehiculo):
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE vehiculos SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END WHERE id_vehiculo = %s", (id_vehiculo,))
        conexion.commit()
        return jsonify({"status": "ok", "message": "Estado del vehículo actualizado."})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@tecnico_bp.route('/api/tecnico/logout', methods=['POST'])
def api_tecnico_logout():
    usuario = obtener_usuario_autenticado()
    data = request.get_json(silent=True) or {}
    tecnico_nombre = data.get('tecnico') or (usuario.get('username') if usuario else None)
    
    if tecnico_nombre:
        nombre_limpio = tecnico_nombre.replace('_', ' ')
        conexion = get_db_connection()
        if conexion:
            try:
                cursor = conexion.cursor()
                cursor.execute("""
                    UPDATE tecnicos 
                    SET estado_actividad = 'Desconectado', 
                        latitud_actual = NULL, 
                        longitud_actual = NULL, 
                        ultima_conexion = NOW()
                    WHERE nombre = %s OR UPPER(nombre) = %s
                """, (nombre_limpio, nombre_limpio.upper()))
                conexion.commit()
                cursor.close()
            except Exception as e:
                print("Error actualizando estado a Desconectado en logout:", e)
            finally:
                conexion.close()

    return jsonify({"status": "ok", "message": "Sesión cerrada correctamente"}), 200
