import os
from flask import Flask, render_template, session, redirect, url_for, request, flash, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
import uuid
import re
from datetime import date, timedelta
from dotenv import load_dotenv
import qrcode
import io
import base64

# Cargar variables de entorno del archivo .env
load_dotenv()

from routers.visitas_router import visitas_bp
from routers.tecnico_router import tecnico_bp
from routers.cliente_router import cliente_bp
from routers.admin_router import admin_bp
from routers.atenciones_router import atenciones_bp
from routers.usuarios_router import usuarios_bp
# Tus módulos internos
from optimizador import interpretar_preferencia_horaria, optimizar_todas_las_visitas
from db_config import get_db_connection
from utils import normalizar_horario_texto, parsear_informacion_tecnica


OFICINA_LAT = -2.896829
OFICINA_LON = -78.975419

app = Flask(__name__)
# Pega aquí el código que generaste en la terminal:
app.secret_key = os.environ.get('FLASK_SECRET_KEY', '8b093e226bd1155f8527a13430d48a4048023c69e7cde5dcc37224407f0ac1c2') 
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)

app.register_blueprint(visitas_bp)
app.register_blueprint(tecnico_bp)
app.register_blueprint(cliente_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(atenciones_bp)
app.register_blueprint(usuarios_bp)

__version__ = "1.0.0"

@app.context_processor
def inject_version():
    return dict(app_version=__version__)

# --- FILTROS ---
@app.template_filter('minutos_a_hora')
def minutos_a_hora(minutos):
    if minutos is None: return "N/A"
    return f"{minutos // 60:02d}:{minutos % 60:02d}"

# --- VALIDACIÓN GLOBAL DE SESIÓN ÚNICA ---
@app.before_request
def check_single_session():
    # Ignorar rutas estáticas y rutas públicas que no requieren validación estricta
    rutas_ignoradas = ['static', 'login', 'logout', 'tecnico.panel_tecnico', 'tecnico.en_camino_visita', 'tecnico.iniciar_visita', 'tecnico.finalizar_visita', 'tecnico.rastreo_vivo', 'tecnico.cerrar_visita_proceso', 'cliente.rastreo_cliente', 'cliente.publico_cuadro_mando']
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

            # Si el token en la BD cambió o se invalidó (is None)
            if not usuario_db or usuario_db['session_token'] != current_token:
                session.clear()
                # Solo mostrar la alerta si el token en la base de datos no es nulo (es decir, no fue logout manual)
                if usuario_db and usuario_db['session_token'] is not None:
                    flash('Tu sesión fue cerrada porque se inició sesión desde otro dispositivo.', 'warning')
                return redirect(url_for('login'))


@app.before_request
def check_password_change_required():
    # Rutas permitidas que no requieren redirección
    rutas_permitidas = ['static', 'login', 'logout', 'cambiar_password', 'cliente.rastreo_cliente', 'cliente.encuesta_cliente', 'cliente.firma_cliente', 'cliente.publico_cuadro_mando']
    if request.endpoint in rutas_permitidas or request.endpoint is None:
        return
        
    # No interferir con llamadas de API en segundo plano
    if request.path.startswith('/api/'):
        return

    # Si el usuario tiene primer_ingreso activo en su sesión
    if 'user_id' in session and session.get('primer_ingreso') == 1:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.is_json:
            return
        flash('Por seguridad, debes cambiar tu contraseña inicial antes de continuar.', 'warning')
        return redirect(url_for('cambiar_password'))


@app.before_request
def check_user_active_area():
    if 'user_id' in session:
        rol = session.get('user_role')
        if rol == 'CALIDAD':
            session['active_area'] = 'INSTALACIONES'
        elif rol in ['ASESOR', 'ADMIN']:
            session['active_area'] = 'SOPORTE'


@app.route('/api/admin/cambiar_area_vista', methods=['POST'])
def cambiar_area_vista():
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    if request.is_json:
        datos = request.get_json() or {}
    else:
        datos = request.form
        
    nueva_area = datos.get('active_area')
    if nueva_area in ['SOPORTE', 'INSTALACIONES']:
        session['active_area'] = nueva_area
        return jsonify({"status": "ok", "active_area": nueva_area})
    return jsonify({"status": "error", "message": "Área no válida"}), 400



# --- RUTAS DE AUTENTICACIÓN (LOGIN / LOGOUT) ---
@app.route('/login/token', methods=['GET'])
def login_por_token():
    user_id = request.args.get('user_id')
    token = request.args.get('token')
    
    if not user_id or not token:
        return redirect(url_for('login'))
        
    conexion = get_db_connection()
    if not conexion:
        return redirect(url_for('login'))
        
    cursor = conexion.cursor(dictionary=True)
    cursor.execute("SELECT * FROM usuarios_callcenter WHERE id_usuario = %s AND session_token = %s AND activo = 1", (user_id, token))
    usuario = cursor.fetchone()
    cursor.close()
    conexion.close()
    
    if usuario:
        # Recrear la sesión
        session.permanent = True
        session['user_id'] = usuario['id_usuario']
        session['user_name'] = usuario['nombre']
        session['user_role'] = usuario['rol']
        session['session_token'] = token
        session['primer_ingreso'] = usuario.get('primer_ingreso', 0)
        
        # Redireccionar según el rol
        rol = usuario.get('rol', 'ASESOR')
        if rol == 'TECNICO':
            return redirect(url_for('tecnico.panel_tecnico'))
        else:
            return redirect(url_for('dashboard'))
            
    return redirect(url_for('login', error_token=1))

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

            # Creamos la sesión y la marcamos como permanente (duración de 30 días)
            session.permanent = True
            session['user_id'] = usuario['id_usuario']
            session['user_name'] = usuario['nombre']
            session['user_role'] = usuario['rol']
            session['session_token'] = nuevo_token # Guardamos el token en la cookie del navegador
            session['primer_ingreso'] = usuario.get('primer_ingreso', 1)
            
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
    user_id = session.get('user_id')
    
    # 1. Si es técnico, actualizar su estado en la tabla de técnicos
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

    # 2. Invalidar el token de sesión en la base de datos para cualquier usuario (Admin, Asesor, Bodega, Técnico)
    if user_id:
        conexion = get_db_connection()
        if conexion:
            cursor = conexion.cursor()
            try:
                cursor.execute("""
                    UPDATE usuarios_callcenter 
                    SET session_token = NULL 
                    WHERE id_usuario = %s
                """, (user_id,))
                conexion.commit()
            except Exception as e:
                print(f"Error invalidating session token during logout: {e}")
            finally:
                cursor.close()
                conexion.close()

    session.clear() # Borramos la sesión
    return redirect(url_for('login'))


def validar_seguridad_contrasena(password):
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r'[A-Z]', password):
        return False, "La contraseña debe incluir al menos una letra mayúscula."
    if not re.search(r'[a-z]', password):
        return False, "La contraseña debe incluir al menos una letra minúscula."
    if not re.search(r'[0-9]', password):
        return False, "La contraseña debe incluir al menos un número."
    if not re.search(r'[^A-Za-z0-9]', password):
        return False, "La contraseña debe incluir al menos un carácter especial o signo (ej: !@#$%^&*)."
    return True, None


@app.route('/cambiar_password', methods=['GET', 'POST'])
def cambiar_password():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    if request.method == 'POST':
        nueva = request.form.get('nueva_password', '').strip()
        confirmacion = request.form.get('confirmar_password', '').strip()

        if not nueva or not confirmacion:
            flash('Ambos campos son obligatorios.', 'danger')
            return render_template('cambiar_password.html')

        if nueva != confirmacion:
            flash('Las contraseñas no coinciden.', 'danger')
            return render_template('cambiar_password.html')

        es_segura, mensaje = validar_seguridad_contrasena(nueva)
        if not es_segura:
            flash(mensaje, 'danger')
            return render_template('cambiar_password.html')

        conexion = get_db_connection()
        if not conexion:
            flash('Error de conexión a la base de datos.', 'danger')
            return render_template('cambiar_password.html')

        try:
            cursor = conexion.cursor()
            # Hashear la nueva contraseña
            pass_hash = generate_password_hash(nueva, method='scrypt')
            cursor.execute("""
                UPDATE usuarios_callcenter 
                SET password_hash = %s, primer_ingreso = 0 
                WHERE id_usuario = %s
            """, (pass_hash, session['user_id']))
            conexion.commit()
            cursor.close()

            # Actualizar la sesión
            session['primer_ingreso'] = 0
            flash('Tu contraseña se ha cambiado exitosamente.', 'success')

            # Redirigir según el rol
            rol = session.get('user_role')
            if rol == 'TECNICO':
                nombre_url = session.get('user_name', '').replace(' ', '_')
                return redirect(url_for('tecnico.panel_tecnico', nombre_tecnico=nombre_url))
            elif rol == 'BODEGA':
                return redirect(url_for('dashboard', tab='inventario'))
            else:
                return redirect(url_for('dashboard'))

        except Exception as e:
            print(f"Error al cambiar contraseña: {e}")
            flash('Ocurrió un error al actualizar la contraseña.', 'danger')
        finally:
            conexion.close()

    return render_template('cambiar_password.html')


# --- RUTAS DE DESCARGA DE LA APP MÓVIL ---
@app.route('/descargar')
@app.route('/app')
def descargar_app():
    try:
        # URL de descarga directa basada en cómo se conecta el usuario
        download_url = request.url_root + "static/app/futurity_nexus.apk"
        
        # Generar código QR dinámico
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(download_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        # Guardar en memoria y codificar a Base64
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        import traceback
        with open("qr_error.log", "w") as f:
            f.write(f"Error: {str(e)}\n")
            traceback.print_exc(file=f)
        qr_base64 = None
        
    return render_template('descargar.html', qr_base64=qr_base64)


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

    active_area = session.get('active_area', 'SOPORTE')
    es_instalacion_val = 1 if active_area == 'INSTALACIONES' else 0

    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)

    # 2. Consulta SQL: Traemos visitas del día (excluimos canceladas del conteo de paradas)
    if texto_busqueda:
        is_fibracom = texto_busqueda.upper().endswith('F')
        if is_fibracom:
            contrato_base = texto_busqueda[:-1]
            query = """
                SELECT v.*, t.placa_vehiculo AS placa_vehiculo_principal 
                FROM visitas_tecnicas v
                LEFT JOIN tecnicos t ON v.tecnico_principal = t.nombre
                WHERE v.fecha_programada = %s 
                AND v.es_instalacion = %s
                AND (v.cliente LIKE %s OR (v.contrato = %s AND v.empresa = 'FIBRACOM'))
            """
        else:
            contrato_base = texto_busqueda
            query = """
                SELECT v.*, t.placa_vehiculo AS placa_vehiculo_principal 
                FROM visitas_tecnicas v
                LEFT JOIN tecnicos t ON v.tecnico_principal = t.nombre
                WHERE v.fecha_programada = %s 
                AND v.es_instalacion = %s
                AND (v.cliente LIKE %s OR (v.contrato = %s AND (v.empresa != 'FIBRACOM' OR v.empresa IS NULL)))
            """
        params = (fecha_busqueda, es_instalacion_val, f"%{texto_busqueda}%", contrato_base)
    else:
        query = """
            SELECT v.*, t.placa_vehiculo AS placa_vehiculo_principal 
            FROM visitas_tecnicas v
            LEFT JOIN tecnicos t ON v.tecnico_principal = t.nombre
            WHERE v.fecha_programada = %s 
            AND v.es_instalacion = %s
        """
        params = (fecha_busqueda, es_instalacion_val)

    cursor.execute(query, params)
    visitas = cursor.fetchall()
    
    # Parsear información técnica (Caja, Hilo, IP, etc.) para visualización en Call Center
    visitas = parsear_informacion_tecnica(visitas)

    # --- 3. MOTOR DE ORDENAMIENTO INTELIGENTE (OPTIMIZACIÓN GEOGRÁFICA) ---
    visitas = optimizar_todas_las_visitas(visitas)

    # --- 5. ESTADÍSTICAS DEL DÍA SELECCIONADO ---
    cursor.execute("""
        SELECT estado, COUNT(*) as total 
        FROM visitas_tecnicas 
        WHERE fecha_programada = %s 
          AND es_instalacion = %s
        GROUP BY estado
    """, (fecha_busqueda, es_instalacion_val))
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
        AND es_instalacion = %s
        AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY fecha_programada 
        ORDER BY fecha_programada ASC
    """
    cursor.execute(query_barras, (es_instalacion_val,))
    datos_barras = cursor.fetchall()
    
    # Convertimos a listas separadas para Chart.js
    labels_barras = [d['dia'] for d in datos_barras]
    valores_barras = [d['total'] for d in datos_barras]

    # B. Gráfico de Anillo: Distribución por Problema/Servicio o Producto/Servicio
    if es_instalacion_val == 1:
        query_problemas = """
            SELECT producto as problema, COUNT(*) as total 
            FROM visitas_tecnicas 
            WHERE es_instalacion = 1
            AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY producto 
            ORDER BY total DESC LIMIT 5
        """
    else:
        query_problemas = """
            SELECT problema, COUNT(*) as total 
            FROM visitas_tecnicas 
            WHERE es_instalacion = 0
            AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
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
        WHERE es_instalacion = %s
        AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY sector 
        ORDER BY total DESC LIMIT 5
    """
    cursor.execute(query_sectores, (es_instalacion_val,))
    datos_anillo_sec = cursor.fetchall()
    labels_sec = [d['sector'] for d in datos_anillo_sec]
    valores_sec = [d['total'] for d in datos_anillo_sec]

    query_tiempos = """
        SELECT solucion_tecnico, 
               AVG(TIMESTAMPDIFF(MINUTE, hora_inicio_visita, hora_fin_visita)) as tiempo_promedio
        FROM visitas_tecnicas 
        WHERE estado = 'FINALIZADA' 
        AND es_instalacion = %s
        AND hora_inicio_visita IS NOT NULL 
        AND hora_fin_visita IS NOT NULL
        AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY solucion_tecnico
    """
    cursor.execute(query_tiempos, (es_instalacion_val,))
    datos_tiempos = cursor.fetchall()
    
    # Procesar listas para JS
    labels_tiempos = [d['solucion_tecnico'] for d in datos_tiempos]
    valores_tiempos = [float(d['tiempo_promedio'] or 0) for d in datos_tiempos]

    # Consultar recordatorios y bloqueos activos para la fecha actual de búsqueda
    cursor.execute("""
        SELECT r.*, t.nombre as tecnico_nombre 
        FROM recordatorios_bloqueos r
        LEFT JOIN tecnicos t ON r.tecnico_id = t.id_tecnico
        WHERE r.fecha = %s AND r.activo = 1
        ORDER BY r.hora_inicio ASC
    """, (fecha_busqueda,))
    recordatorios_hoy = cursor.fetchall()
    for r in recordatorios_hoy:
        if r['hora_inicio']:
            tot_sec = int(r['hora_inicio'].total_seconds())
            r['hora_inicio_str'] = f"{tot_sec // 3600:02d}:{(tot_sec % 3600) // 60:02d}"
        else:
            r['hora_inicio_str'] = None
        if r['hora_fin']:
            tot_sec = int(r['hora_fin'].total_seconds())
            r['hora_fin_str'] = f"{tot_sec // 3600:02d}:{(tot_sec % 3600) // 60:02d}"
        else:
            r['hora_fin_str'] = None

    # Pasamos las nuevas variables al template
    return render_template('index.html', 
                           visitas=visitas, 
                           stats=stats, 
                           fecha_actual=fecha_busqueda,
                           active_tab=active_tab,
                           sectores=obtener_sectores_activos(), 
                           tecnicos=obtener_tecnicos_activos(session.get('active_area')),
                           problemas=obtener_problemas_activos(),
                           asesor=session.get('user_name', 'Asesor'),
                           recordatorios_hoy=recordatorios_hoy,
                           # Variables para gráficos:
                           labels_barras=labels_barras, val_barras=valores_barras,
                           labels_prob=labels_prob, val_prob=valores_prob,
                           labels_sec=labels_sec, val_sec=valores_sec,
                           labels_tiempos=labels_tiempos, 
                           valores_tiempos=valores_tiempos)




# --- FUNCIONES AUXILIARES ---
def obtener_sectores_activos():
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre_sector, latitud_defecto, longitud_defecto FROM catalogo_sectores WHERE activo = TRUE ORDER BY nombre_sector ASC")
        return cursor.fetchall()
    except Exception as e:
        print(f"Error al obtener sectores: {e}")
        return []
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()

def obtener_tecnicos_activos(area=None):
    """Consulta la tabla tecnicos y devuelve la lista completa, opcionalmente filtrada por area_trabajo."""
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        if area:
            cursor.execute("SELECT nombre FROM tecnicos WHERE activo = TRUE AND area_trabajo = %s ORDER BY nombre ASC", (area,))
        else:
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

    # 1. Rojo (No desea / Sin respuesta o Cancelada)
    if 'NO DESEA VISITA' in solucion or 'SIN RESPUESTA' in solucion or estado == 'CANCELADA':
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
    # Obtener el puerto desde las variables de entorno o usar 5000 por defecto
    port = int(os.environ.get('PORT', 5000))
    # El host '0.0.0.0' le dice a Flask: "Acepta conexiones en toda la red"
    app.run(host='0.0.0.0', port=port, debug=True)