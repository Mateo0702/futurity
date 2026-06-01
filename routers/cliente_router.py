from flask import Blueprint, render_template, jsonify, request, url_for
from db_config import get_db_connection

cliente_bp = Blueprint('cliente', __name__)

# ==========================================
# RUTAS PÚBLICAS PARA EL CLIENTE (RASTREO Y CALIFICACIÓN)
# ==========================================

@cliente_bp.route('/rastreo/<token>')
def rastreo_cliente(token):
    """Muestra la página del mapa al cliente."""
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    # Buscamos de quién es este código secreto
    cursor.execute("SELECT tecnico_principal, tecnico_apoyo, estado, cliente FROM visitas_tecnicas WHERE token_rastreo = %s", (token,))
    visita = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not visita:
        return "Este enlace de rastreo no es válido o ya ha caducado.", 404

    # Le enviamos los datos a la plantilla del mapa
    return render_template('mapa_cliente.html', visita=visita, token=token)


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
        
        return jsonify({
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
        
    return jsonify({"status": "error", "message": "Token no válido"}), 404

@cliente_bp.route('/api/cliente/calificar/<token>', methods=['POST'])
def calificar_visita(token):
    """Permite al cliente calificar la visita una vez que ha finalizado."""
    estrellas = request.form.get('estrellas')
    comentario = request.form.get('comentario', '')
    
    if not estrellas:
        return jsonify({"status": "error", "message": "Faltan las estrellas"}), 400

    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    try:
        # Actualizamos la visita con el token correspondiente
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
