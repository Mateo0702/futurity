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
from routers.api_v2_router import api_v2_bp
from flask_cors import CORS
from utils_jwt import verify_token
# Tus módulos internos

from optimizador import interpretar_preferencia_horaria, optimizar_todas_las_visitas
from db_config import get_db_connection
from utils import normalizar_horario_texto, parsear_informacion_tecnica


OFICINA_LAT = -2.896829
OFICINA_LON = -78.975419

app = Flask(__name__)
# Configurar CORS para permitir peticiones desde cualquier origen (React local, red local, etc.)
CORS(app, resources={r"/*": {"origins": "*"}})

# Pega aquí el código que generaste en la terminal:
app.secret_key = os.environ.get('FLASK_SECRET_KEY', '8b093e226bd1155f8527a13430d48a4048023c69e7cde5dcc37224407f0ac1c2') 
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)
app.config['SESSION_REFRESH_EACH_REQUEST'] = False

app.register_blueprint(visitas_bp)
app.register_blueprint(tecnico_bp)
app.register_blueprint(cliente_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(atenciones_bp)
app.register_blueprint(usuarios_bp)
app.register_blueprint(api_v2_bp)

@app.before_request
def auto_login_from_jwt():
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = verify_token(token)
        if payload:
            session['user_id'] = payload.get('sub')
            session['user_name'] = payload.get('username')
            session['user_role'] = payload.get('role')

def get_app_version():
    version_code = 1
    version_name = "1.0.0"
    try:
        props_path = os.path.join(os.path.dirname(__file__), 'futurity-android', 'gradle.properties')
        if os.path.exists(props_path):
            with open(props_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if '=' in line:
                        parts = line.strip().split('=', 1)
                        if len(parts) == 2:
                            key, val = parts
                            if key.strip() == 'VERSION_CODE':
                                version_code = int(val.strip())
                            elif key.strip() == 'VERSION_NAME':
                                version_name = val.strip()
    except Exception as e:
        print("Error reading properties version:", e)
    return version_code, version_name

__version__ = "1.0.0"

@app.context_processor
def inject_version():
    # Detectar versión del User-Agent personalizado
    user_agent = request.headers.get('User-Agent', '')
    need_update = False
    client_code = None
    
    # Formato esperado: FuturityAtlas/1.0.0 (versionCode:1)
    match = re.search(r'versionCode:(\d+)', user_agent)
    latest_code, latest_name = get_app_version()
    
    if match:
        client_code = int(match.group(1))
        if client_code < latest_code:
            need_update = True
            
    return dict(
        app_version=__version__,
        need_app_update=need_update,
        latest_app_version_name=latest_name
    )

@app.route('/api/app/version')
def app_version_api():
    latest_code, latest_name = get_app_version()
    return jsonify({
        "versionCode": latest_code,
        "versionName": latest_name,
        "url": request.host_url + "static/app/futurity_atlas.apk"
    })

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
            if 'active_area' not in session:
                session['active_area'] = 'SOPORTE'


@app.route('/api/admin/cambiar_area_vista', methods=['POST'])
def cambiar_area_vista():
    if 'user_id' not in session or session.get('user_role') not in ['ADMIN', 'ASESOR']:
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
            nombre_url = usuario['nombre'].replace(' ', '_')
            return redirect(url_for('tecnico.panel_tecnico', nombre_tecnico=nombre_url))
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
            flash('Correo corporativo o contraseña incorrectos.', 'danger')

    from flask import send_from_directory
    return send_from_directory('frontend/dist', 'index.html')

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
        download_url = request.url_root + "static/app/futurity_atlas.apk"
        
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
    from flask import send_from_directory
    return send_from_directory('frontend/dist', 'index.html')




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
    if 'SOLUCIÓN PARCIAL' in solucion or 'SOLUCION PARCIAL' in solucion or 'GESTIONAR ARREGLO' in solucion:
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



# --- SERVING REACT STATIC PRODUCTION ASSETS & SPA ROUTING FALLBACK ---
@app.route('/assets/<path:path>')
def serve_react_assets(path):
    from flask import send_from_directory
    return send_from_directory('frontend/dist/assets', path)

@app.route('/<path:path>')
def serve_react_root_files(path):
    import os
    from flask import send_from_directory
    dist_dir = 'frontend/dist'
    
    # If the file exists in React build folder, serve it directly
    if os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    
    # Handle public client routes directly
    if path.startswith('seguimiento/') or path.startswith('rastreo/'):
        parts = path.split('/')
        token = parts[1] if len(parts) > 1 else ''
        from routers.cliente_router import rastreo_cliente
        return rastreo_cliente(token)

    if path.startswith('firma-remota/') or path.startswith('firmar/'):
        parts = path.split('/')
        token = parts[1] if len(parts) > 1 else ''
        from routers.cliente_router import firmar_remoto
        return firmar_remoto(token)

    # If it is not a backend API/public request, fallback to index.html for React Router
    if not path.startswith('api/') and not path.startswith('static/') and not path.startswith('publico/'):
        return send_from_directory(dist_dir, 'index.html')
        
    return "Not Found", 404


if __name__ == '__main__':
    # Obtener el puerto desde las variables de entorno o usar 5000 por defecto
    port = int(os.environ.get('PORT', 5000))
    # El host '0.0.0.0' le dice a Flask: "Acepta conexiones en toda la red"
    app.run(host='0.0.0.0', port=port, debug=True)