from flask import Flask, render_template, session, redirect, url_for, request, flash, jsonify
from werkzeug.security import check_password_hash
import uuid
from datetime import date, timedelta

from routers.visitas_router import visitas_bp
from routers.tecnico_router import tecnico_bp
from routers.cliente_router import cliente_bp
from routers.admin_router import admin_bp
from routers.atenciones_router import atenciones_bp
from routers.usuarios_router import usuarios_bp
# Tus módulos internos
from optimizador import interpretar_preferencia_horaria
from db_config import get_db_connection
from utils import normalizar_horario_texto, parsear_informacion_tecnica


OFICINA_LAT = -2.896829
OFICINA_LON = -78.975419

app = Flask(__name__)
# Pega aquí el código que generaste en la terminal:
app.secret_key = '8b093e226bd1155f8527a13430d48a4048023c69e7cde5dcc37224407f0ac1c2' 
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=60)

app.register_blueprint(visitas_bp)
app.register_blueprint(tecnico_bp)
app.register_blueprint(cliente_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(atenciones_bp)
app.register_blueprint(usuarios_bp)

# --- FILTROS ---
@app.template_filter('minutos_a_hora')
def minutos_a_hora(minutos):
    if minutos is None: return "N/A"
    return f"{minutos // 60:02d}:{minutos % 60:02d}"

# --- VALIDACIÓN GLOBAL DE SESIÓN ÚNICA ---
@app.before_request
def check_single_session():
    # Ignorar rutas estáticas y rutas públicas que no requieren validación estricta
    rutas_ignoradas = ['static', 'login', 'logout', 'tecnico.panel_tecnico', 'tecnico.en_camino_visita', 'tecnico.iniciar_visita', 'tecnico.finalizar_visita', 'tecnico.rastreo_vivo', 'tecnico.cerrar_visita_proceso', 'cliente.rastreo_cliente']
    if request.endpoint in rutas_ignoradas or request.endpoint is None:
        return

    # Si hay un usuario logueado en la sesión actual
    if 'user_id' in session and 'session_token' in session:
        user_id = session['user_id']
        current_token = session['session_token']

        # Consultar el token válido en la base de datos
        conexion = get_db_connection()
        if conexion:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT session_token FROM usuarios_callcenter WHERE id_usuario = %s", (user_id,))
            usuario_db = cursor.fetchone()
            cursor.close()
            conexion.close()

            # Si el token en la BD cambió, significa que alguien inició sesión en otro lugar
            if not usuario_db or usuario_db['session_token'] != current_token:
                session.clear()
                flash('Tu sesión fue cerrada porque se inició sesión desde otro dispositivo.', 'warning')
                return redirect(url_for('login'))


# --- RUTAS DE AUTENTICACIÓN (LOGIN / LOGOUT) ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    # Si ya está logueado, lo mandamos directo al dashboard
    if 'user_id' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        conexion = get_db_connection()
        if not conexion:
            flash('Error de conexión a la base de datos', 'danger')
            return render_template('login.html')

        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM usuarios_callcenter WHERE email = %s AND activo = 1", (email,))
        usuario = cursor.fetchone()
        cursor.close()
        conexion.close()

        # Verificamos si el usuario existe y si la contraseña coincide con el hash
        if usuario and check_password_hash(usuario['password_hash'], password):
            # Generar un token único para esta sesión
            nuevo_token = str(uuid.uuid4())
            
            # Guardarlo en la base de datos
            conexion = get_db_connection()
            cursor = conexion.cursor()
            cursor.execute("UPDATE usuarios_callcenter SET session_token = %s WHERE id_usuario = %s", (nuevo_token, usuario['id_usuario']))
            conexion.commit()
            cursor.close()
            conexion.close()

            # Creamos la sesión y la marcamos como no permanente si cerramos el navegador
            session.permanent = False
            session['user_id'] = usuario['id_usuario']
            session['user_name'] = usuario['nombre']
            session['user_role'] = usuario['rol']
            session['session_token'] = nuevo_token # Guardamos el token en la cookie del navegador
            
            # Redireccionar según el rol del usuario
            rol = usuario.get('rol', 'ASESOR')
            if rol == 'TECNICO':
                # Actualizar estado global del técnico en la base de datos
                conexion_tec = get_db_connection()
                if conexion_tec:
                    cursor_tec = conexion_tec.cursor()
                    try:
                        cursor_tec.execute("""
                            UPDATE tecnicos 
                            SET estado_actividad = 'Sesión Iniciada', 
                                latitud_actual = NULL, 
                                longitud_actual = NULL, 
                                ultima_conexion = NOW()
                            WHERE nombre = %s
                        """, (usuario['nombre'],))
                        conexion_tec.commit()
                    except Exception as e:
                        print(f"Error updating status during login: {e}")
                    finally:
                        cursor_tec.close()
                        conexion_tec.close()
                nombre_url = usuario['nombre'].replace(' ', '_')
                return redirect(url_for('tecnico.panel_tecnico', nombre_tecnico=nombre_url))
            elif rol == 'BODEGA':
                return redirect(url_for('dashboard', tab='inventario'))
            else:
                return redirect(url_for('dashboard'))
        else:
            flash('Correo corporativo o contraseña incorrectos.', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    tecnico_nombre = session.get('user_name')
    rol = session.get('user_role')
    if rol == 'TECNICO' and tecnico_nombre:
        conexion = get_db_connection()
        if conexion:
            cursor = conexion.cursor()
            try:
                cursor.execute("""
                    UPDATE tecnicos 
                    SET estado_actividad = 'Desconectado', 
                        latitud_actual = NULL, 
                        longitud_actual = NULL, 
                        ultima_conexion = NOW()
                    WHERE nombre = %s
                """, (tecnico_nombre,))
                conexion.commit()
            except Exception as e:
                print(f"Error updating status during logout: {e}")
            finally:
                cursor.close()
                conexion.close()

    session.clear() # Borramos la sesión
    return redirect(url_for('login'))


# --- 1. RUTA PRINCIPAL: El Dashboard ---
@app.route('/')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    rol = session.get('user_role')
    if rol == 'TECNICO':
        nombre_url = session.get('user_name', '').replace(' ', '_')
        return redirect(url_for('tecnico.panel_tecnico', nombre_tecnico=nombre_url))

    # Determinar la pestaña activa por defecto según el rol si no se especifica en la URL
    tab_param = request.args.get('tab', '')
    if not tab_param:
        if rol == 'BODEGA':
            active_tab = 'inventario'
        else:
            active_tab = 'visitas'
    else:
        active_tab = tab_param

    # 1. Filtros de búsqueda (Fecha y Texto)
    fecha_filtro_raw = request.args.get('fecha_filtro')
    if fecha_filtro_raw is None:
        # Carga inicial sin filtro especificado
        fecha_busqueda = date.today().isoformat()
    elif not fecha_filtro_raw.strip():
        # Formulario enviado pero la fecha está vacía (p. ej., por fecha inválida en el navegador o campo limpio)
        flash('Por favor seleccione o ingrese una fecha válida. Mostrando las visitas de hoy.', 'warning')
        fecha_busqueda = date.today().isoformat()
    else:
        try:
            fecha_filtro_raw = fecha_filtro_raw.strip()
            # Validamos que la fecha tenga el formato y sea una fecha real en el calendario
            from datetime import datetime
            datetime.strptime(fecha_filtro_raw, '%Y-%m-%d')
            fecha_busqueda = fecha_filtro_raw
        except ValueError:
            flash(f'La fecha "{fecha_filtro_raw}" no es válida. Se muestran las visitas de hoy.', 'warning')
            fecha_busqueda = date.today().isoformat()
    texto_busqueda = request.args.get('buscar_cliente', '').strip()

    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)

    # 2. Consulta SQL: Traemos visitas del día (excluimos canceladas del conteo de paradas)
    if texto_busqueda:
        is_fibracom = texto_busqueda.upper().endswith('F')
        if is_fibracom:
            contrato_base = texto_busqueda[:-1]
            query = """
                SELECT * FROM visitas_tecnicas 
                WHERE fecha_programada = %s 
                AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA')
                AND (cliente LIKE %s OR (contrato = %s AND empresa = 'FIBRACOM'))
            """
        else:
            contrato_base = texto_busqueda
            query = """
                SELECT * FROM visitas_tecnicas 
                WHERE fecha_programada = %s 
                AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA')
                AND (cliente LIKE %s OR (contrato = %s AND (empresa != 'FIBRACOM' OR empresa IS NULL)))
            """
        params = (fecha_busqueda, f"%{texto_busqueda}%", contrato_base)
    else:
        query = """
            SELECT * FROM visitas_tecnicas 
            WHERE fecha_programada = %s 
            AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA')
        """
        params = (fecha_busqueda,)

    cursor.execute(query, params)
    visitas = cursor.fetchall()
    
    # Parsear información técnica (Caja, Hilo, IP, etc.) para visualización en Call Center
    visitas = parsear_informacion_tecnica(visitas)

    # --- 3. MOTOR DE ORDENAMIENTO INTELIGENTE ---
    def peso_orden(v):
        # A. ESTADO (Los que están trabajando o en ruta van PRIMERO)
        estado_val = 0 if v['estado'] in ['EN_PROGRESO', 'EN_RUTA'] else 1 if v['estado'] == 'PENDIENTE' else 9
        
        # B. PRIORIDAD (ALTA=1, MEDIA=2, BAJA=3)
        prioridad_raw = v.get('prioridad', 'MEDIA')
        prioridad_val = {'ALTA': 1, 'MEDIA': 2, 'BAJA': 3}.get(prioridad_raw, 2)
        
        # C. HORA (Interpretamos el texto del Call Center)
        hora_val = interpretar_preferencia_horaria(v.get('preferencia_horaria', ''))
        
        return (estado_val, prioridad_val, hora_val, v['id_visita'])

    # Aplicamos el ordenamiento global
    visitas.sort(key=peso_orden)

    # --- 4. ASIGNACIÓN DE "PARADA #" (Global para toda la empresa) ---
    for indice, v in enumerate(visitas, start=1):
        v['numero_parada'] = indice

    # --- 5. ESTADÍSTICAS DEL DÍA SELECCIONADO ---
    cursor.execute("SELECT estado, COUNT(*) as total FROM visitas_tecnicas WHERE fecha_programada = %s GROUP BY estado", (fecha_busqueda,))
    res_stats = cursor.fetchall()
    
    stats = {'pendientes': 0, 'finalizadas': 0, 'reagendadas': 0, 'canceladas': 0}
    for s in res_stats:
        est = s['estado']
        if est == 'PENDIENTE': stats['pendientes'] += s['total']
        elif est == 'FINALIZADA': stats['finalizadas'] += s['total']
        elif est == 'REAGENDADA': stats['reagendadas'] += s['total']
        elif est in ['CANCELADA', 'SOLVENTADA_REMOTA']: stats['canceladas'] += s['total']

    # --- 6. DATOS PARA EL DASHBOARD GRÁFICO (ÚLTIMOS 30 DÍAS) ---
    cursor = conexion.cursor(dictionary=True)
    
    # A. Gráfico de Barras: Visitas finalizadas por día
    query_barras = """
        SELECT DATE_FORMAT(fecha_programada, '%m-%d') as dia, COUNT(*) as total 
        FROM visitas_tecnicas 
        WHERE estado IN ('FINALIZADA', 'SOLVENTADA_REMOTA')
        AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY fecha_programada 
        ORDER BY fecha_programada ASC
    """
    cursor.execute(query_barras)
    datos_barras = cursor.fetchall()
    
    # Convertimos a listas separadas para Chart.js
    labels_barras = [d['dia'] for d in datos_barras]
    valores_barras = [d['total'] for d in datos_barras]

    # B. Gráfico de Anillo: Distribución por Problema/Servicio
    query_problemas = """
        SELECT problema, COUNT(*) as total 
        FROM visitas_tecnicas 
        WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY problema 
        ORDER BY total DESC LIMIT 5
    """
    cursor.execute(query_problemas)
    datos_anillo_prob = cursor.fetchall()
    labels_prob = [d['problema'] for d in datos_anillo_prob]
    valores_prob = [d['total'] for d in datos_anillo_prob]

    # C. Gráfico de Anillo: Distribución por Sector
    query_sectores = """
        SELECT sector, COUNT(*) as total 
        FROM visitas_tecnicas 
        WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY sector 
        ORDER BY total DESC LIMIT 5
    """
    cursor.execute(query_sectores)
    datos_anillo_sec = cursor.fetchall()
    labels_sec = [d['sector'] for d in datos_anillo_sec]
    valores_sec = [d['total'] for d in datos_anillo_sec]

    query_tiempos = """
        SELECT solucion_tecnico, 
               AVG(TIMESTAMPDIFF(MINUTE, hora_inicio_visita, hora_fin_visita)) as tiempo_promedio
        FROM visitas_tecnicas 
        WHERE estado = 'FINALIZADA' 
        AND hora_inicio_visita IS NOT NULL 
        AND hora_fin_visita IS NOT NULL
        AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY solucion_tecnico
    """
    cursor.execute(query_tiempos)
    datos_tiempos = cursor.fetchall()
    
    # Procesar listas para JS
    labels_tiempos = [d['solucion_tecnico'] for d in datos_tiempos]
    valores_tiempos = [float(d['tiempo_promedio'] or 0) for d in datos_tiempos]

    # Pasamos las nuevas variables al template
    return render_template('index.html', 
                           visitas=visitas, 
                           stats=stats, 
                           fecha_actual=fecha_busqueda,
                           active_tab=active_tab,
                           sectores=obtener_sectores_activos(), 
                           tecnicos=obtener_tecnicos_activos(),
                           problemas=obtener_problemas_activos(),
                           asesor=session.get('user_name', 'Asesor'),
                           # Variables para gráficos:
                           labels_barras=labels_barras, val_barras=valores_barras,
                           labels_prob=labels_prob, val_prob=valores_prob,
                           labels_sec=labels_sec, val_sec=valores_sec,
                           labels_tiempos=labels_tiempos, 
                           valores_tiempos=valores_tiempos)




# --- 3. RUTA PARA GUARDAR NUEVAS VISITAS ---
@app.route('/api/visitas', methods=['POST'])
def registrar_visita():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    try:
        # Quién está creando esta visita (se extrae de la sesión)
        creado_por = session['user_name']

        # Extraemos los datos del formulario HTML
        prioridad = request.form.get('prioridad', 'MEDIA')
        fecha_programada = request.form.get('fecha_programada')
        preferencia = request.form.get('preferencia_horaria')
        
        tecnico_principal = request.form.get('tecnico_asignado') or None
        tecnico_apoyo = request.form.get('tecnico_apoyo') or None
        
        empresa = request.form.get('empresa')
        contrato = request.form.get('contrato')
        cliente = request.form.get('cliente')
        telefonos = request.form.get('telefonos')
        sector = request.form.get('sector')
        
        # Combinamos la dirección si envían lat/lon para que calce en el campo 'direccion'
        dir_texto = request.form.get('direccion', '')
        lat = request.form.get('latitud', '')
        lon = request.form.get('longitud', '')
        direccion_completa = f"{dir_texto} ({lat}, {lon})" if lat and lon else dir_texto
        
        servicio = request.form.get('servicio')
        velocidad_mbps = request.form.get('velocidad_mbps')
        # Si la velocidad está vacía, evitamos error de base de datos
        velocidad_mbps = int(velocidad_mbps) if velocidad_mbps and velocidad_mbps.isdigit() else None
        
        problema = request.form.get('problema')
        observacion_callcenter = request.form.get('observacion_callcenter')
        informacion_tecnico = request.form.get('informacion_tecnico')
        
        # Opcional: si en el futuro quieres guardar también las ventanas en min en otra tabla
        # ventana_inicio, ventana_fin = normalizar_horario_texto(preferencia)

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

        # Armamos el INSERT alineado a la nueva tabla visitas_tecnicas
        query = """
            INSERT INTO visitas_tecnicas 
            (creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia_horaria, 
            empresa, contrato, cliente, telefonos, sector, direccion, 
            servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, estado, prioridad)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s)
        """
        valores = (
            creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia,
            empresa, contrato, cliente, telefonos, sector, direccion_completa,
            servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, prioridad
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


# --- FUNCIONES AUXILIARES ---
def obtener_sectores_activos():
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre_sector FROM catalogo_sectores WHERE activo = TRUE ORDER BY nombre_sector ASC")
        return cursor.fetchall()
    except Exception as e:
        print(f"Error al obtener sectores: {e}")
        return []
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()

def obtener_tecnicos_activos():
    """Consulta la tabla tecnicos y devuelve la lista completa."""
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre FROM tecnicos WHERE activo = TRUE ORDER BY nombre ASC")
        return cursor.fetchall()
    except Exception as e:
        print(f"Error al obtener tecnicos: {e}")
        return []
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()

def obtener_color_reporte(visita):
    """Analiza la visita y devuelve la clase CSS según las reglas de Futurity."""
    estado = visita.get('estado', '')
    
    # Buscamos qué pasó al final (sea del técnico o del callcenter)
    solucion = visita.get('solucion_tecnico') or visita.get('resolucion_final') or ''
    solucion = str(solucion).upper()

    # 1. Rojo (No desea / Sin respuesta)
    if 'NO DESEA VISITA' in solucion or 'SIN RESPUESTA' in solucion:
        return 'fila-roja'
    
    # 2. Celeste (Reagendada)
    if estado == 'REAGENDADA' or 'REAGENDADA' in solucion:
        return 'fila-celeste'
    
    # 3. Naranja (Cambio de FO)
    if 'CAMBIO DE FO' in solucion and 'GENERAR' in solucion:
        return 'fila-naranja'
    
    # 4. Morado Claro (Solución Parcial)
    if 'SOLUCIÓN PARCIAL' in solucion:
        return 'fila-morada'
    
    # 5. Amarillo (Ticket NOC)
    if 'NOC' in solucion:
        return 'fila-amarilla'
    
    # 6. Sin color (Saturación)
    if 'SATURACIÓN' in solucion:
        return 'fila-blanca'
    
    # 7. Verde (Efectiva en campo o desde oficina)
    if estado == 'FINALIZADA' or estado == 'SOLVENTADA_REMOTA':
        return 'fila-verde'
    
    # Por defecto, si está PENDIENTE
    return 'fila-pendiente'

# Registramos la función para poder usarla en el HTML
app.jinja_env.globals.update(obtener_color_reporte=obtener_color_reporte)

def obtener_problemas_activos():
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre FROM catalogo_problemas WHERE activo = TRUE ORDER BY nombre ASC")
        return cursor.fetchall()
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()



if __name__ == '__main__':
    # El host '0.0.0.0' le dice a Flask: "Acepta conexiones de celulares en la misma red"
    app.run(host='0.0.0.0', port=5000, debug=True)