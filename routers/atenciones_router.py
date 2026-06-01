from flask import Blueprint, request, jsonify, session
from datetime import datetime, date, timedelta
from db_config import get_db_connection

atenciones_bp = Blueprint('atenciones', __name__)

@atenciones_bp.route('/api/cliente/buscar_contrato_json', methods=['GET'])
def buscar_contrato_json():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    contrato = request.args.get('contrato', '').strip()
    if not contrato:
        return jsonify({"status": "error", "message": "Contrato vacío"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        # Buscar en directorio_clientes el contrato exacto (con F para Fibracom, sin F para Servicable)
        query = """
            SELECT nombre_cliente AS cliente, zona AS sector, telefono1, telefono2, fecha_instalacion 
            FROM directorio_clientes 
            WHERE contrato = %s
        """
        cursor.execute(query, (contrato,))
        cliente = cursor.fetchone()
        
        if cliente:
            # Formatear fecha si existe
            if isinstance(cliente['fecha_instalacion'], (datetime, date)):
                cliente['fecha_instalacion'] = cliente['fecha_instalacion'].isoformat()
            elif isinstance(cliente['fecha_instalacion'], str) and len(cliente['fecha_instalacion']) >= 10:
                cliente['fecha_instalacion'] = cliente['fecha_instalacion'][:10]
            
            # Limpiar formatos flotantes (.0) si existieran
            for k in ['telefono1', 'telefono2']:
                val = cliente[k]
                if val:
                    val_str = str(val).strip()
                    if val_str.endswith('.0') or val_str.endswith(',0'):
                        val_str = val_str[:-2]
                    cliente[k] = val_str

            # Combinar teléfonos de forma limpia
            tels = []
            if cliente['telefono1']: tels.append(cliente['telefono1'])
            if cliente['telefono2']: tels.append(cliente['telefono2'])
            cliente['telefonos'] = ", ".join(tels)
            
            return jsonify({"status": "success", "cliente": cliente})
        else:
            return jsonify({"status": "error", "message": "Cliente no encontrado en el directorio"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/atenciones', methods=['POST'])
def registrar_atencion():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para registrar atenciones."}), 403
        
    # Obtener parámetros del JSON o del formulario
    data = request.get_json() if request.is_json else request.form
    
    contrato = data.get('contrato', '').strip() or None
    cliente = data.get('cliente', '').strip().upper()
    
    if not cliente:
        return jsonify({"status": "error", "message": "El nombre del cliente es obligatorio"}), 400
        
    # Extraer campos
    fecha_val = data.get('fecha') or date.today().isoformat()
    hora_val = data.get('hora') or datetime.now().time().strftime('%H:%M:%S')
    
    try:
        f_dt = datetime.strptime(str(fecha_val), "%Y-%m-%d").date()
        h_tm = datetime.strptime(str(hora_val), "%H:%M:%S").time()
        fecha_hora = datetime.combine(f_dt, h_tm)
    except:
        f_dt = date.today()
        h_tm = datetime.now().time()
        fecha_hora = datetime.now()
        
    fecha_inst_val = data.get('fecha_instalacion') or None
    if fecha_inst_val:
        try:
            fecha_instalacion = datetime.strptime(str(fecha_inst_val), "%Y-%m-%d").date().isoformat()
        except:
            fecha_instalacion = None
    else:
        fecha_instalacion = None
        
    sector = data.get('sector', '').strip().upper() or None
    tipo_atencion = data.get('tipo_atencion', '').strip().upper() or None
    tipo_solicitud = data.get('tipo_solicitud', '').strip().upper() or None
    medio_contacto = data.get('medio_contacto', '').strip().upper() or None
    telefono1 = data.get('telefono1', '').strip() or None
    telefono2 = data.get('telefono2', '').strip() or None
    accion = data.get('accion', '').strip().upper() or None
    motivo = data.get('motivo', '').strip().upper() or None
    
    # El agente responsable es el Call Center logueado
    agente = session.get('user_name', 'Call Center').strip()
    
    observacion = data.get('observacion', '').strip() or None
    olt = data.get('olt', '').strip().upper() or None
    ont = None
    router = None
    
    timer_minutos = None
            
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor()
    try:
        query_insert = """
            INSERT INTO atenciones (
                fecha, hora, fecha_hora, contrato, cliente, fecha_instalacion, 
                sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2, 
                accion, motivo, agente, observacion, olt, ont, router, timer_minutos
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        datos = (
            f_dt.isoformat(), h_tm.isoformat(), fecha_hora.isoformat(), contrato, cliente, fecha_instalacion,
            sector, tipo_atencion, tipo_solicitud, medio_contacto, telefono1, telefono2,
            accion, motivo, agente, observacion, olt, ont, router, timer_minutos
        )
        cursor.execute(query_insert, datos)
        conn.commit()
        
        # Devolver ID y éxito
        id_atencion = cursor.lastrowid
        return jsonify({
            "status": "success", 
            "message": "Atención registrada exitosamente",
            "id_atencion": id_atencion,
            "agente": agente
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/atenciones/recientes', methods=['GET'])
def atenciones_recientes():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver atenciones."}), 403
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        agente = session.get('user_name', 'Call Center').strip()
        query = """
            SELECT id_atencion, fecha, hora, contrato, cliente, sector, tipo_atencion, tipo_solicitud, medio_contacto, accion, motivo, timer_minutos, observacion
            FROM atenciones
            WHERE agente = %s AND fecha = CURDATE()
            ORDER BY id_atencion DESC
            LIMIT 10
        """
        cursor.execute(query, (agente,))
        atenciones = cursor.fetchall()
        
        for at in atenciones:
            if isinstance(at['fecha'], (datetime, date)):
                at['fecha'] = at['fecha'].isoformat()
            if isinstance(at['hora'], timedelta):
                total_seconds = int(at['hora'].total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                at['hora'] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            elif hasattr(at['hora'], 'strftime'):
                at['hora'] = at['hora'].strftime('%H:%M:%S')
            else:
                at['hora'] = str(at['hora'])
                
        return jsonify({"status": "success", "atenciones": atenciones})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@atenciones_bp.route('/api/admin/metricas_atenciones', methods=['GET'])
def metricas_atenciones():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver métricas de atenciones."}), 403
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "No se pudo conectar a la base de datos"}), 500
        
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Total atenciones (últimos 3 meses)
        query_kpis = """
            SELECT COUNT(*) as total_atenciones
            FROM atenciones
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        """
        cursor.execute(query_kpis)
        kpis = cursor.fetchone()
        
        total = kpis['total_atenciones'] or 0
        
        # Obtener el motivo principal (Top 1)
        query_motivo = """
            SELECT motivo, COUNT(*) as cantidad
            FROM atenciones
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
              AND motivo IS NOT NULL AND motivo != ''
            GROUP BY motivo
            ORDER BY cantidad DESC
            LIMIT 1
        """
        cursor.execute(query_motivo)
        motivo_row = cursor.fetchone()
        motivo_principal = motivo_row['motivo'] if motivo_row else '-'
        
        # 2. Distribución por Medio de Contacto
        query_medios = """
            SELECT medio_contacto, COUNT(*) as cantidad
            FROM atenciones
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
              AND medio_contacto IS NOT NULL AND medio_contacto != ''
            GROUP BY medio_contacto
            ORDER BY cantidad DESC
        """
        cursor.execute(query_medios)
        medios_raw = cursor.fetchall()
        
        # 3. Distribución por Tipo de Solicitud (Top 5)
        query_solicitudes = """
            SELECT tipo_solicitud, COUNT(*) as cantidad
            FROM atenciones
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
              AND tipo_solicitud IS NOT NULL AND tipo_solicitud != ''
            GROUP BY tipo_solicitud
            ORDER BY cantidad DESC
            LIMIT 5
        """
        cursor.execute(query_solicitudes)
        solicitudes_raw = cursor.fetchall()
        
        # 4. Distribución por Acción (Top 5)
        query_acciones = """
            SELECT accion, COUNT(*) as cantidad
            FROM atenciones
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
              AND accion IS NOT NULL AND accion != ''
            GROUP BY accion
            ORDER BY cantidad DESC
            LIMIT 5
        """
        cursor.execute(query_acciones)
        acciones_raw = cursor.fetchall()
        
        # 5. Evolución semanal de atenciones
        query_evolucion = """
            SELECT 
                DATE_FORMAT(fecha, '%Y-%u') as semana,
                MIN(fecha) as inicio_semana,
                COUNT(*) as cantidad
            FROM atenciones
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            GROUP BY semana
            ORDER BY inicio_semana ASC
        """
        cursor.execute(query_evolucion)
        evolucion_raw = cursor.fetchall()
        
        evolucion = []
        for row in evolucion_raw:
            fecha_dt = row['inicio_semana']
            fecha_str = fecha_dt.strftime('%d/%m') if isinstance(fecha_dt, (datetime, date)) else str(fecha_dt)
            evolucion.append({
                "label": f"Sem {fecha_str}",
                "cantidad": row['cantidad']
            })
            
        return jsonify({
            "status": "ok",
            "kpis": {
                "total_atenciones": total,
                "motivo_principal": motivo_principal
            },
            "medios": {row['medio_contacto']: row['cantidad'] for row in medios_raw},
            "solicitudes": [{"solicitud": row['tipo_solicitud'], "cantidad": row['cantidad']} for row in solicitudes_raw],
            "acciones": [{"accion": row['accion'], "cantidad": row['cantidad']} for row in acciones_raw],
            "evolucion": evolucion
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
