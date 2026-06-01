import os
import uuid
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.security import generate_password_hash
from werkzeug.utils import secure_filename
from db_config import get_db_connection

usuarios_bp = Blueprint('usuarios', __name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_admin_privileges():
    """Valida si el usuario actual es administrador."""
    if 'user_id' not in session:
        return False, jsonify({"status": "error", "message": "No autorizado. Inicie sesión."}), 401
    if session.get('user_role') != 'ADMIN':
        return False, jsonify({"status": "error", "message": "No tienes privilegios de administrador."}), 403
    return True, None, None

def save_uploaded_file(file_key, folder):
    """Guarda un archivo subido de forma segura con un nombre único."""
    if file_key not in request.files:
        return None
    file = request.files[file_key]
    if file.filename == '':
        return None
    if file and allowed_file(file.filename):
        # Asegurar que el directorio de subida existe
        os.makedirs(folder, exist_ok=True)
        # Nombre único con UUID para evitar colisiones
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(folder, unique_name)
        file.save(filepath)
        return unique_name
    return None

# ==========================================
# APIS PARA GESTIÓN DE USUARIOS
# ==========================================

@usuarios_bp.route('/api/admin/usuarios', methods=['GET'])
def list_usuarios():
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id_usuario, nombre, email, rol, activo FROM usuarios_callcenter ORDER BY id_usuario DESC")
        usuarios = cursor.fetchall()
        return jsonify({"status": "ok", "usuarios": usuarios})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@usuarios_bp.route('/api/admin/usuarios', methods=['POST'])
def create_usuario():
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    data = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    rol = data.get('rol', 'ASESOR').strip().upper()
    activo = int(data.get('activo', 1))

    if not nombre or not email or not password:
        return jsonify({"status": "error", "message": "Todos los campos (nombre, email y contraseña) son obligatorios."}), 400

    if rol not in ['ADMIN', 'ASESOR', 'BODEGA', 'TECNICO']:
        return jsonify({"status": "error", "message": "Rol inválido."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor()
    try:
        # Verificar duplicado
        cursor.execute("SELECT id_usuario FROM usuarios_callcenter WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "Ya existe un usuario con este correo electrónico."}), 400

        # Crear hash
        pass_hash = generate_password_hash(password, method='scrypt')

        cursor.execute("""
            INSERT INTO usuarios_callcenter (nombre, email, password_hash, rol, activo)
            VALUES (%s, %s, %s, %s, %s)
        """, (nombre, email, pass_hash, rol, activo))
        conn.commit()

        # Vinculación automática: si es TECNICO, asegurar que exista en la tabla tecnicos
        if rol == 'TECNICO':
            cursor_tec = conn.cursor()
            cursor_tec.execute("SELECT id_tecnico FROM tecnicos WHERE nombre = %s", (nombre,))
            if not cursor_tec.fetchone():
                cursor_tec.execute("INSERT INTO tecnicos (nombre, activo) VALUES (%s, %s)", (nombre, activo))
                conn.commit()
            cursor_tec.close()

        return jsonify({"status": "ok", "message": "Usuario creado con éxito."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@usuarios_bp.route('/api/admin/usuarios/<int:id_usuario>', methods=['PUT'])
def update_usuario(id_usuario):
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    data = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    rol = data.get('rol', '').strip().upper()
    activo = int(data.get('activo', 1))

    if not nombre or not email or not rol:
        return jsonify({"status": "error", "message": "Nombre, email y rol son campos obligatorios."}), 400

    if rol not in ['ADMIN', 'ASESOR', 'BODEGA', 'TECNICO']:
        return jsonify({"status": "error", "message": "Rol inválido."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor()
    try:
        # Verificar duplicado excluyendo este ID
        cursor.execute("SELECT id_usuario FROM usuarios_callcenter WHERE email = %s AND id_usuario != %s", (email, id_usuario))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "Ya existe otro usuario con este correo electrónico."}), 400

        if password:
            pass_hash = generate_password_hash(password, method='scrypt')
            cursor.execute("""
                UPDATE usuarios_callcenter
                SET nombre = %s, email = %s, password_hash = %s, rol = %s, activo = %s
                WHERE id_usuario = %s
            """, (nombre, email, pass_hash, rol, activo, id_usuario))
        else:
            cursor.execute("""
                UPDATE usuarios_callcenter
                SET nombre = %s, email = %s, rol = %s, activo = %s
                WHERE id_usuario = %s
            """, (nombre, email, rol, activo, id_usuario))

        conn.commit()

        # Si el rol es TECNICO, asegurar que exista en la tabla tecnicos
        if rol == 'TECNICO':
            cursor_tec = conn.cursor()
            cursor_tec.execute("SELECT id_tecnico FROM tecnicos WHERE nombre = %s", (nombre,))
            if not cursor_tec.fetchone():
                cursor_tec.execute("INSERT INTO tecnicos (nombre, activo) VALUES (%s, %s)", (nombre, activo))
                conn.commit()
            cursor_tec.close()

        return jsonify({"status": "ok", "message": "Usuario actualizado con éxito."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@usuarios_bp.route('/api/admin/usuarios/<int:id_usuario>/toggle', methods=['POST'])
def toggle_usuario(id_usuario):
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT activo, nombre, rol FROM usuarios_callcenter WHERE id_usuario = %s", (id_usuario,))
        usr = cursor.fetchone()
        if not usr:
            return jsonify({"status": "error", "message": "Usuario no encontrado."}), 404

        nuevo_estado = 0 if usr['activo'] else 1
        cursor.execute("UPDATE usuarios_callcenter SET activo = %s WHERE id_usuario = %s", (nuevo_estado, id_usuario))
        conn.commit()

        # Si es técnico, también desactivar en la tabla de técnicos
        if usr['rol'] == 'TECNICO':
            cursor.execute("UPDATE tecnicos SET activo = %s WHERE nombre = %s", (nuevo_estado, usr['nombre']))
            conn.commit()

        estado_txt = "activado" if nuevo_estado else "desactivado"
        return jsonify({"status": "ok", "message": f"Usuario {estado_txt} con éxito."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# ==========================================
# APIS PARA GESTIÓN DE TÉCNICOS
# ==========================================

@usuarios_bp.route('/api/admin/tecnicos', methods=['GET'])
def list_tecnicos():
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id_tecnico, nombre, activo, foto_perfil, foto_vehiculo, placa_vehiculo, area_trabajo 
            FROM tecnicos 
            WHERE nombre NOT IN ('TECNOLOGIA', 'NO TECNICO')
            ORDER BY id_tecnico DESC
        """)
        tecnicos = cursor.fetchall()
        return jsonify({"status": "ok", "tecnicos": tecnicos})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@usuarios_bp.route('/api/admin/tecnicos', methods=['POST'])
def create_tecnico():
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    # Usar multipart form data
    nombre = request.form.get('nombre', '').strip()
    placa = request.form.get('placa_vehiculo', 'S/P').strip()
    activo = int(request.form.get('activo', 1))
    area_trabajo = request.form.get('area_trabajo', 'SOPORTE').strip()

    if not nombre:
        return jsonify({"status": "error", "message": "El nombre del técnico es obligatorio."}), 400

    # Guardar imágenes
    upload_dir = os.path.join(current_app.root_path, UPLOAD_FOLDER)
    foto_perfil = save_uploaded_file('foto_perfil', upload_dir) or 'default_avatar.png'
    foto_vehiculo = save_uploaded_file('foto_vehiculo', upload_dir) or 'furgoneta_milton.jpeg'

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id_tecnico FROM tecnicos WHERE nombre = %s", (nombre,))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "Ya existe un técnico con este nombre."}), 400

        cursor.execute("""
            INSERT INTO tecnicos (nombre, activo, foto_perfil, foto_vehiculo, placa_vehiculo, area_trabajo)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (nombre, activo, foto_perfil, foto_vehiculo, placa, area_trabajo))
        conn.commit()

        return jsonify({"status": "ok", "message": "Técnico creado con éxito."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@usuarios_bp.route('/api/admin/tecnicos/<int:id_tecnico>', methods=['POST'])  # POST para soportar multipart file uploads en edición
def update_tecnico(id_tecnico):
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    nombre = request.form.get('nombre', '').strip()
    placa = request.form.get('placa_vehiculo', 'S/P').strip()
    activo = int(request.form.get('activo', 1))
    area_trabajo = request.form.get('area_trabajo', 'SOPORTE').strip()

    if not nombre:
        return jsonify({"status": "error", "message": "El nombre del técnico es obligatorio."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        # Verificar duplicado
        cursor.execute("SELECT id_tecnico FROM tecnicos WHERE nombre = %s AND id_tecnico != %s", (nombre, id_tecnico))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "Ya existe otro técnico con este nombre."}), 400

        # Obtener valores actuales de fotos
        cursor.execute("SELECT foto_perfil, foto_vehiculo, nombre FROM tecnicos WHERE id_tecnico = %s", (id_tecnico,))
        tec = cursor.fetchone()
        if not tec:
            return jsonify({"status": "error", "message": "Técnico no encontrado."}), 404

        nombre_anterior = tec['nombre']

        upload_dir = os.path.join(current_app.root_path, UPLOAD_FOLDER)
        new_foto_perfil = save_uploaded_file('foto_perfil', upload_dir)
        new_foto_vehiculo = save_uploaded_file('foto_vehiculo', upload_dir)

        foto_perfil = new_foto_perfil if new_foto_perfil else tec['foto_perfil']
        foto_vehiculo = new_foto_vehiculo if new_foto_vehiculo else tec['foto_vehiculo']

        cursor.execute("""
            UPDATE tecnicos
            SET nombre = %s, activo = %s, foto_perfil = %s, foto_vehiculo = %s, placa_vehiculo = %s, area_trabajo = %s
            WHERE id_tecnico = %s
        """, (nombre, activo, foto_perfil, foto_vehiculo, placa, area_trabajo, id_tecnico))
        conn.commit()

        # Si cambió el nombre del técnico, sincronizar también su cuenta en usuarios_callcenter si existe
        if nombre != nombre_anterior:
            cursor.execute("UPDATE usuarios_callcenter SET nombre = %s WHERE nombre = %s AND rol = 'TECNICO'", (nombre, nombre_anterior))
            conn.commit()

        return jsonify({"status": "ok", "message": "Técnico actualizado con éxito."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@usuarios_bp.route('/api/admin/tecnicos/<int:id_tecnico>/toggle', methods=['POST'])
def toggle_tecnico(id_tecnico):
    is_admin, response, status = check_admin_privileges()
    if not is_admin:
        return response, status

    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT activo, nombre FROM tecnicos WHERE id_tecnico = %s", (id_tecnico,))
        tec = cursor.fetchone()
        if not tec:
            return jsonify({"status": "error", "message": "Técnico no encontrado."}), 404

        nuevo_estado = 0 if tec['activo'] else 1
        cursor.execute("UPDATE tecnicos SET activo = %s WHERE id_tecnico = %s", (nuevo_estado, id_tecnico))
        conn.commit()

        # Sincronizar desactivación en usuarios_callcenter si tiene cuenta
        cursor.execute("UPDATE usuarios_callcenter SET activo = %s WHERE nombre = %s AND rol = 'TECNICO'", (nuevo_estado, tec['nombre']))
        conn.commit()

        estado_txt = "activado" if nuevo_estado else "desactivado"
        return jsonify({"status": "ok", "message": f"Técnico {estado_txt} con éxito."})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
