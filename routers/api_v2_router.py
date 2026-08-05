import re
from flask import Blueprint, request, jsonify, session
from pydantic import create_model, validator, ValidationError
from werkzeug.security import check_password_hash
from db_config import get_db_connection
from utils_jwt import generate_token

# Crear Blueprint para la versión 2 de la API
api_v2_bp = Blueprint('api_v2', __name__)

# Definición de validadores personalizados (necesarios para compatibilidad con Python 3.14 y Pydantic v1)
def validate_email(v):
    v = (v or '').strip()
    if not v:
        raise ValueError("El correo electrónico no puede estar vacío")
    # Validación de formato de correo básico
    if not re.match(r"[^@]+@[^@]+\.[^@]+", v):
        raise ValueError("Formato de correo electrónico inválido")
    return v

def validate_password(v):
    v = (v or '').strip()
    if not v:
        raise ValueError("La contraseña no puede estar vacía")
    return v

# Crear el modelo dinámicamente para eludir limitaciones de annotations en metaclasas con Python 3.14
LoginRequest = create_model(
    'LoginRequest',
    email=(str, ...),
    password=(str, ...),
    __validators__={
        'validate_email': validator('email')(validate_email),
        'validate_password': validator('password')(validate_password)
    }
)

@api_v2_bp.route('/api/v2/login', methods=['POST'])
def api_v2_login():
    """
    Ruta para autenticar usuarios mediante credenciales en formato JSON.
    Retorna un token JWT si la autenticación es exitosa.
    """
    if not request.is_json:
        return jsonify({
            "status": "error",
            "message": "Content-Type debe ser application/json"
        }), 400

    try:
        data = request.get_json() or {}
        # Validar datos con el modelo dinámico
        login_data = LoginRequest(**data)
    except ValidationError as e:
        # Dar formato amigable a los errores de validación de Pydantic
        errors_list = []
        for error in e.errors():
            field = ".".join(str(loc) for loc in error["loc"])
            msg = error["msg"]
            errors_list.append(f"Error en campo '{field}': {msg}")
            
        return jsonify({
            "status": "error",
            "message": "Datos de entrada inválidos",
            "errors": errors_list
        }), 400

    email = login_data.email
    password = login_data.password

    conexion = get_db_connection()
    if not conexion:
        return jsonify({
            "status": "error",
            "message": "Error de conexión a la base de datos"
        }), 500

    cursor = conexion.cursor(dictionary=True)
    try:
        # Buscar usuario activo en usuarios_callcenter
        cursor.execute("SELECT * FROM usuarios_callcenter WHERE email = %s AND activo = 1", (email,))
        usuario = cursor.fetchone()

        if usuario and check_password_hash(usuario['password_hash'], password):
            # Generar token JWT
            token = generate_token(
                user_id=usuario['id_usuario'],
                username=usuario['nombre'],
                role=usuario['rol']
            )
            
            if not token:
                return jsonify({
                    "status": "error",
                    "message": "Error interno al generar el token JWT"
                }), 500

            return jsonify({
                "status": "success",
                "message": "Autenticación exitosa",
                "token": token,
                "usuario": {
                    "id": usuario['id_usuario'],
                    "nombre": usuario['nombre'],
                    "rol": usuario['rol']
                }
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Correo o contraseña incorrectos"
            }), 401
    except Exception as ex:
        return jsonify({
            "status": "error",
            "message": f"Error del servidor: {str(ex)}"
        }), 500
    finally:
        cursor.close()
        conexion.close()

@api_v2_bp.route('/api/v2/sectores', methods=['GET'])
def api_v2_sectores():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("SELECT nombre_sector, latitud_defecto, longitud_defecto FROM catalogo_sectores WHERE activo = TRUE ORDER BY nombre_sector ASC")
        sectores = cursor.fetchall()
        return jsonify({"status": "success", "sectores": sectores})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

from utils import parsear_informacion_tecnica, format_antiguedad, normalizar_horario_texto
from optimizador import optimizar_todas_las_visitas
from datetime import date, datetime, timedelta
from utils_jwt import verify_token

@api_v2_bp.route('/api/v2/visitas', methods=['GET'])
def api_v2_get_visitas():
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    fecha_param = request.args.get('fecha', date.today().isoformat())
    buscar_texto = request.args.get('buscar', '').strip()
    active_area = request.args.get('area', 'SOPORTE')
    es_instalacion_val = 1 if active_area == 'INSTALACIONES' else 0

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de BD"}), 500

    cursor = conexion.cursor(dictionary=True)
    try:
        if buscar_texto:
            is_fibracom = buscar_texto.upper().endswith('F')
            if is_fibracom:
                contrato_base = buscar_texto[:-1]
                query = """
                    SELECT v.*, t.placa_vehiculo AS placa_vehiculo_principal 
                    FROM visitas_tecnicas v
                    LEFT JOIN tecnicos t ON v.tecnico_principal = t.nombre
                    WHERE v.fecha_programada = %s 
                    AND v.es_instalacion = %s
                    AND (v.cliente LIKE %s OR (v.contrato = %s AND v.empresa = 'FIBRACOM'))
                """
            else:
                contrato_base = buscar_texto
                query = """
                    SELECT v.*, t.placa_vehiculo AS placa_vehiculo_principal 
                    FROM visitas_tecnicas v
                    LEFT JOIN tecnicos t ON v.tecnico_principal = t.nombre
                    WHERE v.fecha_programada = %s 
                    AND v.es_instalacion = %s
                    AND (v.cliente LIKE %s OR (v.contrato = %s AND (v.empresa != 'FIBRACOM' OR v.empresa IS NULL)))
                """
            params = (fecha_param, es_instalacion_val, f"%{buscar_texto}%", contrato_base)
        else:
            query = """
                SELECT v.*, t.placa_vehiculo AS placa_vehiculo_principal 
                FROM visitas_tecnicas v
                LEFT JOIN tecnicos t ON v.tecnico_principal = t.nombre
                WHERE v.fecha_programada = %s 
                AND v.es_instalacion = %s
            """
            params = (fecha_param, es_instalacion_val)

        cursor.execute(query, params)
        visitas = cursor.fetchall()
        
        visitas = parsear_informacion_tecnica(visitas)
        visitas = optimizar_todas_las_visitas(visitas)

        for v in visitas:
            if v.get('fecha_programada'):
                v['fecha_programada'] = str(v['fecha_programada'])
            if v.get('hora_en_ruta'):
                v['hora_en_ruta'] = str(v['hora_en_ruta'])
            if v.get('hora_inicio_visita'):
                v['hora_inicio_visita'] = str(v['hora_inicio_visita'])
            if v.get('hora_fin_visita'):
                v['hora_fin_visita'] = str(v['hora_fin_visita'])
            if v.get('total_mensual'):
                v['total_mensual'] = float(v['total_mensual'])

        cursor.execute("""
            SELECT estado, COUNT(*) as total 
            FROM visitas_tecnicas 
            WHERE fecha_programada = %s 
              AND es_instalacion = %s
            GROUP BY estado
        """, (fecha_param, es_instalacion_val))
        rows_stats = cursor.fetchall()
        stats = {"pendientes": 0, "finalizadas": 0, "reagendadas": 0, "canceladas": 0}
        for r in rows_stats:
            est = (r['estado'] or '').upper()
            if est in ['PENDIENTE', 'EN_RUTA', 'EN_SITIO']:
                stats['pendientes'] += r['total']
            elif est == 'FINALIZADA':
                stats['finalizadas'] += r['total']
            elif est == 'REAGENDADA':
                stats['reagendadas'] += r['total']
            elif est == 'CANCELADA':
                stats['canceladas'] += r['total']

        try:
            target_dt = datetime.strptime(fecha_param, '%Y-%m-%d').date()
            ayer_dt = str(target_dt - timedelta(days=1))
        except Exception:
            ayer_dt = str(date.today() - timedelta(days=1))

        cursor.execute("""
            SELECT COUNT(*) as total 
            FROM visitas_tecnicas 
            WHERE fecha_programada = %s 
              AND es_instalacion = %s
              AND estado IN ('PENDIENTE', 'EN_RUTA', 'EN_SITIO')
        """, (ayer_dt, es_instalacion_val))
        row_ayer = cursor.fetchone()
        cant_pendientes_atrasadas = row_ayer['total'] if row_ayer else 0

        cursor.execute("""
            SELECT r.*, t.nombre as tecnico_nombre 
            FROM recordatorios_bloqueos r 
            LEFT JOIN tecnicos t ON r.tecnico_id = t.id_tecnico 
            WHERE r.fecha = %s AND (r.activo = 1 OR r.activo IS NULL)
            ORDER BY r.hora_inicio ASC
        """, (fecha_param,))
        recordatorios = cursor.fetchall()
        for rec in recordatorios:
            if rec.get('fecha'):
                rec['fecha'] = str(rec['fecha'])
            if rec.get('hora_inicio'):
                rec['hora_inicio_str'] = str(rec['hora_inicio'])
            if rec.get('hora_fin'):
                rec['hora_fin_str'] = str(rec['hora_fin'])

        return jsonify({
            "status": "success",
            "fecha": fecha_param,
            "ayer_fecha": ayer_dt,
            "area": active_area,
            "stats": stats,
            "cant_pendientes_atrasadas": cant_pendientes_atrasadas,
            "recordatorios": recordatorios,
            "visitas": visitas
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@api_v2_bp.route('/api/v2/recordatorio/atendido', methods=['POST'])
def api_v2_recordatorio_atendido():
    data = request.get_json() or {}
    rec_id = data.get('id_recordatorio')
    if not rec_id:
        return jsonify({"status": "error", "message": "ID faltante"}), 400

    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        cursor.execute("UPDATE recordatorios_bloqueos SET activo = 0 WHERE id_recordatorio = %s", (rec_id,))
        conexion.commit()
        return jsonify({"status": "success", "message": "Recordatorio marcado como atendido"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@api_v2_bp.route('/api/v2/tecnicos', methods=['GET'])
def api_v2_tecnicos():
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de BD"}), 500

    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id_tecnico, nombre, activo, placa_vehiculo, area_trabajo 
            FROM tecnicos 
            WHERE nombre NOT IN ('TECNOLOGIA', 'NO TECNICO') AND activo = TRUE
            ORDER BY nombre ASC
        """)
        tecnicos = cursor.fetchall()
        return jsonify({"status": "success", "tecnicos": tecnicos})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@api_v2_bp.route('/api/v2/visitas', methods=['POST'])
def api_v2_create_visita():
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role'), 'nombre': session.get('user_name')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    creado_por = user.get('nombre') or user.get('username') or 'Call Center'
    datos = request.get_json() or {}

    fecha_programada = datos.get('fecha_programada', '').strip()
    if not fecha_programada:
        return jsonify({"status": "error", "message": "Fecha programada es obligatoria"}), 400

    try:
        datetime.strptime(fecha_programada, '%Y-%m-%d')
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Fecha programada no válida"}), 400

    if fecha_programada < str(date.today()):
        return jsonify({
            "status": "error", 
            "message": "La fecha de la visita no puede ser anterior al día de hoy."
        }), 400

    preferencia = datos.get('preferencia_horaria', '')
    prioridad = datos.get('prioridad', 'MEDIA')
    tecnico_principal = datos.get('tecnico_asignado') or None
    tecnico_apoyo = datos.get('tecnico_apoyo') or None
    empresa = datos.get('empresa', 'SERVICABLE')
    contrato = datos.get('contrato')
    cliente = datos.get('cliente')
    telefonos = datos.get('telefonos')
    sector = datos.get('sector')
    
    dir_texto = datos.get('direccion', '')
    lat = str(datos.get('latitud', '')).strip()
    lon = str(datos.get('longitud', '')).strip()
    direccion_completa = f"{dir_texto} ({lat}, {lon})" if lat and lon else dir_texto
    
    try:
        lat_val = float(lat) if lat else None
    except ValueError:
        lat_val = None
    try:
        lon_val = float(lon) if lon else None
    except ValueError:
        lon_val = None
    
    servicio = datos.get('servicio')
    velocidad_mbps = datos.get('velocidad_mbps')
    velocidad_mbps = int(velocidad_mbps) if velocidad_mbps and str(velocidad_mbps).isdigit() else None
    problema = datos.get('problema')
    observacion_callcenter = datos.get('observacion_callcenter')
    
    es_instalacion = int(datos.get('es_instalacion', 0))
    producto = datos.get('producto') or None
    tipo_instalacion = datos.get('tipo_instalacion') or None
    vendedor = datos.get('vendedor') or None
    recibido_coordinacion = datos.get('recibido_coordinacion') or None
    if recibido_coordinacion == '':
        recibido_coordinacion = None

    info_parts = []
    info_caja = datos.get('info_caja', '').strip()
    info_hilo = datos.get('info_hilo', '').strip()
    info_ip = datos.get('info_ip', '').strip()
    info_vlan = datos.get('info_vlan', '').strip()
    info_usr = datos.get('info_usr', '').strip()
    info_pas = datos.get('info_pas', '').strip()
    
    if info_caja: info_parts.append(f"CAJA: {info_caja}")
    if info_hilo: info_parts.append(f"HILO: {info_hilo}")
    if info_ip: info_parts.append(f"IP: {info_ip}")
    if info_vlan: info_parts.append(f"VLAN: {info_vlan}")
    if info_usr: info_parts.append(f"USR: {info_usr}")
    if info_pas: info_parts.append(f"PAS: {info_pas}")
    informacion_tecnico = "\n".join(info_parts)

    ventana_inicio, ventana_fin = normalizar_horario_texto(preferencia)

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500

    cursor = conexion.cursor(dictionary=True)
    try:
        if tecnico_principal and preferencia:
            cursor.execute("SELECT turno FROM tecnicos WHERE nombre = %s", (tecnico_principal,))
            tecnico_info = cursor.fetchone()
            if tecnico_info and tecnico_info.get('turno'):
                turno_tecnico = tecnico_info['turno']
                pref_lower = preferencia.lower()
                if turno_tecnico == 'TARDE' and ('mañana' in pref_lower or 'manana' in pref_lower):
                    return jsonify({
                        "status": "error", 
                        "message": f"❌ Error: {tecnico_principal} trabaja en la TARDE. No puedes asignarle una visita de la MAÑANA."
                    }), 400
                if turno_tecnico == 'MAÑANA' and 'tarde' in pref_lower:
                    return jsonify({
                        "status": "error", 
                        "message": f"❌ Error: {tecnico_principal} trabaja en la MAÑANA. No puedes asignarle una visita de la TARDE."
                    }), 400

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
        return jsonify({"status": "success", "message": "Visita registrada exitosamente"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@api_v2_bp.route('/api/v2/problemas', methods=['GET'])
def api_v2_problemas():
    token = request.headers.get('Authorization')
    user = None
    if token and token.startswith("Bearer "):
        user = verify_token(token)
    elif 'user_id' in session:
        user = {'id_usuario': session['user_id'], 'rol': session.get('user_role')}

    if not user:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de BD"}), 500

    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute("SELECT nombre FROM catalogo_problemas WHERE activo = TRUE ORDER BY nombre ASC")
        problemas = cursor.fetchall()
        return jsonify({"status": "success", "problemas": problemas})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()





