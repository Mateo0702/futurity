from flask import Blueprint, request, redirect, url_for, session, jsonify, flash
from db_config import get_db_connection
from utils import normalizar_horario_texto 
from datetime import date

visitas_bp = Blueprint('visitas', __name__)

@visitas_bp.route('/api/visitas', methods=['POST'])
def registrar_visita():
    # Protección de sesión y rol
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        flash('No tienes permiso para registrar visitas.', 'danger')
        return redirect(url_for('dashboard'))

    try:
        creado_por = session['user_name']

        fecha_programada = request.form.get('fecha_programada', '').strip()
        
        # VALIDACIÓN: Formato de fecha y existencia real en el calendario
        try:
            from datetime import datetime
            datetime.strptime(fecha_programada, '%Y-%m-%d')
        except (ValueError, TypeError):
            flash(f'La fecha programada "{fecha_programada}" no es válida.', 'danger')
            return redirect(url_for('dashboard'))
        
        # VALIDACIÓN: No permitir crear visitas en el pasado
        if fecha_programada < str(date.today()):
            return jsonify({
                "status": "error", 
                "message": "❌ Error: La fecha de la visita no puede ser anterior al día de hoy."
            }), 400
            
        preferencia = request.form.get('preferencia_horaria')
        prioridad = request.form.get('prioridad', 'MEDIA')
        tecnico_principal = request.form.get('tecnico_asignado') or None
        tecnico_apoyo = request.form.get('tecnico_apoyo') or None
        empresa = request.form.get('empresa')
        contrato = request.form.get('contrato')
        cliente = request.form.get('cliente')
        telefonos = request.form.get('telefonos')
        sector = request.form.get('sector')
        
        dir_texto = request.form.get('direccion', '')
        lat = request.form.get('latitud', '')
        lon = request.form.get('longitud', '')
        direccion_completa = f"{dir_texto} ({lat}, {lon})" if lat and lon else dir_texto
        
        servicio = request.form.get('servicio')
        velocidad_mbps = request.form.get('velocidad_mbps')
        velocidad_mbps = int(velocidad_mbps) if velocidad_mbps and velocidad_mbps.isdigit() else None
        problema = request.form.get('problema')
        observacion_callcenter = request.form.get('observacion_callcenter')
        
        # Nuevos campos de instalación
        es_instalacion = int(request.form.get('es_instalacion', 0))
        producto = request.form.get('producto') or None
        tipo_instalacion = request.form.get('tipo_instalacion') or None
        vendedor = request.form.get('vendedor') or None
        recibido_coordinacion = request.form.get('recibido_coordinacion') or None
        if recibido_coordinacion == '':
            recibido_coordinacion = None
        
        # Recopilar la información técnica por partes (Opcional)
        info_parts = []
        info_caja = request.form.get('info_caja', '').strip()
        info_hilo = request.form.get('info_hilo', '').strip()
        info_ip = request.form.get('info_ip', '').strip()
        info_usr = request.form.get('info_usr', '').strip()
        info_pas = request.form.get('info_pas', '').strip()
        
        if info_caja: info_parts.append(f"CAJA: {info_caja}")
        if info_hilo: info_parts.append(f"HILO: {info_hilo}")
        if info_ip: info_parts.append(f"IP: {info_ip}")
        if info_usr: info_parts.append(f"USR: {info_usr}")
        if info_pas: info_parts.append(f"PAS: {info_pas}")
        
        informacion_tecnico = "\n".join(info_parts)

        # --- AQUÍ CONVERTIMOS EL TEXTO A MINUTOS PARA EL OPTIMIZADOR ---
        ventana_inicio, ventana_fin = normalizar_horario_texto(preferencia)

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

        # Añadimos los campos ventana_inicio_min y ventana_fin_min al INSERT
        query = """
            INSERT INTO visitas_tecnicas 
            (creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia_horaria, 
            empresa, contrato, cliente, telefonos, sector, direccion, 
            servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico, 
            ventana_inicio_min, ventana_fin_min, estado, prioridad,
            es_instalacion, producto, tipo_instalacion, vendedor, recibido_coordinacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s, %s, %s, %s, %s, %s)
        """ 
        valores = (
            creado_por, tecnico_principal, tecnico_apoyo, fecha_programada, preferencia,
            empresa, contrato, cliente, telefonos, sector, direccion_completa,
            servicio, velocidad_mbps, problema, observacion_callcenter, informacion_tecnico,
            ventana_inicio, ventana_fin, prioridad,
            es_instalacion, producto, tipo_instalacion, vendedor, recibido_coordinacion
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

# Dejamos aquí tu ruta de búsqueda de cliente para el autocompletado
@visitas_bp.route('/api/cliente/<contrato>', methods=['GET'])
def buscar_cliente(contrato):
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"error": "Sin conexión"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        # Determinar el contrato correcto según la empresa
        contrato_clean = contrato.strip()
        empresa = request.args.get('empresa', '').strip().upper()

        if empresa == 'FIBRACOM':
            query_contrato = contrato_clean if contrato_clean.upper().endswith('F') else (contrato_clean + 'F')
        elif empresa == 'SERVICABLE':
            query_contrato = contrato_clean[:-1] if contrato_clean.upper().endswith('F') else contrato_clean
        else:
            query_contrato = contrato_clean

        query = "SELECT nombre_cliente, zona, telefono1, telefono2 FROM directorio_clientes WHERE contrato = %s"
        cursor.execute(query, (query_contrato,))
        cliente = cursor.fetchone()
        
        if cliente:
            tel1 = str(cliente['telefono1']).strip() if cliente['telefono1'] else ""
            if tel1.endswith('.0') or tel1.endswith(',0'):
                tel1 = tel1[:-2]
            if tel1.lower() in ['nan', 'none']:
                tel1 = ""

            tel2 = str(cliente['telefono2']).strip() if cliente['telefono2'] else ""
            if tel2.endswith('.0') or tel2.endswith(',0'):
                tel2 = tel2[:-2]
            if tel2.lower() in ['nan', 'none']:
                tel2 = ""

            telefonos = tel1
            if tel2 and tel2 != tel1:
                if telefonos:
                    telefonos += f" / {tel2}"
                else:
                    telefonos = tel2

            return jsonify({
                "cliente": cliente['nombre_cliente'],
                "zona_excel": cliente['zona'],
                "telefonos": telefonos
            })
        else:
            return jsonify({"error": "No encontrado"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()

@visitas_bp.route('/api/visitas/reagendar/<int:id_visita>', methods=['POST'])
def reagendar_visita(id_visita):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        flash('No tienes permiso para reagendar visitas.', 'danger')
        return redirect(url_for('dashboard'))

    nueva_fecha = request.form.get('nueva_fecha', '').strip()
    
    # VALIDACIÓN: Formato de fecha y existencia real en el calendario
    try:
        from datetime import datetime
        datetime.strptime(nueva_fecha, '%Y-%m-%d')
    except (ValueError, TypeError):
        flash(f'La fecha de reagendamiento "{nueva_fecha}" no es válida.', 'danger')
        return redirect(url_for('dashboard'))

    nueva_prioridad = request.form.get('nueva_prioridad') # Por si ahora urge más
    observacion_adicional = request.form.get('observacion_reagendado')
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        # 1. Actualizamos la visita
        # Al cambiar la fecha, automáticamente desaparecerá del dashboard de 'HOY'
        query = """
            UPDATE visitas_tecnicas 
            SET fecha_programada = %s, 
                prioridad = %s,
                estado = 'REAGENDADA',
                observacion_callcenter = CONCAT(observacion_callcenter, ' | REAGENDADO: ', %s),
                tecnico_principal = 'NO TECNICO', -- Opcional: la liberamos para volver a asignarla
                token_rastreo = NULL -- IMPORTANTE: Matamos el link de rastreo anterior
            WHERE id_visita = %s
        """
        cursor.execute(query, (nueva_fecha, nueva_prioridad, observacion_adicional, id_visita))
        conexion.commit()
    except Exception as e:
        print(f"Error al reagendar: {e}")
    finally:
        cursor.close()
        conexion.close()
        
    return redirect(url_for('dashboard'))

@visitas_bp.route('/api/visitas/<int:id_visita>/cancelar', methods=['POST'])
def cancelar_visita(id_visita):
    if 'user_id' not in session: 
        return redirect(url_for('login'))
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        flash('No tienes permiso para cancelar visitas.', 'danger')
        return redirect(url_for('dashboard'))
    
    estado_cancelacion = request.form.get('estado_cancelacion') # CANCELADA o SOLVENTADA_REMOTA
    motivo = request.form.get('motivo')
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        # Guardamos el motivo, cambiamos estado y quitamos al técnico asignado
        query = """
            UPDATE visitas_tecnicas 
            SET estado = %s, resolucion_final = %s, tecnico_principal = 'NO TECNICO' 
            WHERE id_visita = %s
        """
        cursor.execute(query, (estado_cancelacion, motivo, id_visita))
        conexion.commit()
    except Exception as e:
        print(f"Error al cancelar: {e}")
    finally:
        cursor.close()
        conexion.close()
        
    return redirect(url_for('dashboard'))

@visitas_bp.route('/api/visitas/<int:id_visita>/reasignar', methods=['POST'])
def reasignar_tecnicos(id_visita):
    if 'user_id' not in session: 
        return redirect(url_for('login'))
    if session.get('user_role') not in ['ADMIN', 'ASESOR', 'CALIDAD']:
        flash('No tienes permiso para reasignar técnicos.', 'danger')
        return redirect(url_for('dashboard'))
    
    nuevo_principal = request.form.get('tecnico_principal')
    nuevo_apoyo = request.form.get('tecnico_apoyo') or None # Puede ir vacío
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        query = "UPDATE visitas_tecnicas SET tecnico_principal = %s, tecnico_apoyo = %s WHERE id_visita = %s"
        cursor.execute(query, (nuevo_principal, nuevo_apoyo, id_visita))
        conexion.commit()
    except Exception as e:
        print(f"Error al reasignar: {e}")
    finally:
        cursor.close()
        conexion.close()
        
    return redirect(url_for('dashboard'))