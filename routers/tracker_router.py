import hashlib
import hmac
import secrets
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from db_config import get_db_connection

tracker_bp = Blueprint('tracker', __name__)

ADMIN_TOKEN_DEFAULT = "FuturityTrackerAdmin2026SecretKey"

def digest(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def now_ms():
    return int(time.time() * 1000)

def obtener_usuario_autenticado():
    token = request.headers.get('Authorization')
    if token and token.startswith("Bearer "):
        from utils_jwt import verify_token
        user = verify_token(token)
        if user:
            role = user.get('role') or user.get('rol') or user.get('user_role')
            return {
                'id_usuario': user.get('sub') or user.get('id_usuario'),
                'username': user.get('username') or user.get('nombre'),
                'role': role
            }
    if 'user_id' in session:
        return {
            'id_usuario': session['user_id'],
            'username': session.get('user_name'),
            'role': session.get('user_role') or session.get('rol')
        }
    return None

def es_administrador(usuario):
    if not usuario:
        # Verificar también si viene el Bearer token de admin de Tracker
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith("Bearer "):
            token_recibido = auth_header.split(" ", 1)[1]
            if hmac.compare_digest(digest(token_recibido), digest(ADMIN_TOKEN_DEFAULT)):
                return True
        return False
    user_role = str(usuario.get('role') or usuario.get('rol') or '').upper()
    return user_role in ('ADMIN', 'SUPERADMIN', 'ASESOR', 'CALIDAD', 'BODEGA', 'ATC', 'ATC_AUDITOR', 'AUDITOR', 'CALLCENTER', 'COORDINADOR')

def validar_credencial_dispositivo(cursor, auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token_recibido = auth_header.split(" ", 1)[1]
    hash_recibido = digest(token_recibido)

    cursor.execute("SELECT device_id FROM tracker_device_credentials WHERE token_hash = %s", (hash_recibido,))
    row = cursor.fetchone()
    if row:
        return row['device_id']
    return None

# --- ENDPOINTS PÚBLICOS Y DISPOSITIVOS PMT ---

@tracker_bp.route('/health', methods=['GET'])
def health():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(buffered=True)
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'version': '1.2.0-atlas-native'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@tracker_bp.route('/api/v1/location', methods=['POST'])
def single_location():
    data = request.get_json(silent=True) or {}
    return receive_batch({'records': [data]})

@tracker_bp.route('/api/v1/locations/batch', methods=['POST'])
def receive_batch(payload_override=None):
    payload = payload_override or (request.get_json(silent=True) or {})
    records = payload.get('records', [])
    if not records:
        return jsonify({'received_count': 0, 'synced_uuids': []})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        # Autenticar dispositivo
        device_id = validar_credencial_dispositivo(cursor, request.headers.get('Authorization'))
        if not device_id:
            return jsonify({'detail': 'Device credential required'}), 401

        synced_uuids = []
        last_lat = None
        last_lon = None
        last_battery = None
        last_charging = False
        last_network = 'fused'
        last_ts = 0

        for r in records:
            rec_dev_id = r.get('device_id')
            if rec_dev_id and rec_dev_id != device_id:
                return jsonify({'detail': 'Device identity mismatch'}), 403

            uuid_val = r.get('uuid') or f"{device_id}_{r.get('timestamp', now_ms())}_{secrets.token_hex(4)}"
            lat = float(r.get('latitude', 0.0))
            lon = float(r.get('longitude', 0.0))
            accuracy = float(r.get('accuracy', 0.0))
            speed = float(r.get('speed', 0.0))
            bearing = float(r.get('bearing', 0.0))
            altitude = float(r.get('altitude', 0.0))
            battery = int(r.get('battery_level', 100))
            charging = 1 if r.get('is_charging', False) else 0
            net_type = str(r.get('network_type', 'fused'))
            provider = str(r.get('provider', 'fused'))
            ts = int(r.get('timestamp', now_ms()))

            cursor.execute("""
            INSERT IGNORE INTO tracker_location_records (
                uuid, device_id, latitude, longitude, accuracy, speed, bearing, altitude,
                battery_level, is_charging, network_type, provider, timestamp, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (uuid_val, device_id, lat, lon, accuracy, speed, bearing, altitude, battery, charging, net_type, provider, ts, now_ms()))

            if cursor.rowcount > 0:
                synced_uuids.append(uuid_val)

            if ts >= last_ts:
                last_ts = ts
                last_lat = lat
                last_lon = lon
                last_battery = battery
                last_charging = charging
                last_network = net_type

        # Actualizar estado de dispositivo en tracker_devices
        if last_lat is not None and last_lon is not None:
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
                device_id, 'PMT Device', 'Android', now_ms(), now_ms(),
                last_lat, last_lon, last_battery, last_charging, last_network, last_ts
            ))

            # Sincronizar automáticamente con el técnico de Atlas vinculado en device_profile
            cursor.execute("SELECT atlas_technician_id, technician FROM tracker_device_profiles WHERE device_id = %s", (device_id,))
            prof = cursor.fetchone()
            if prof:
                if prof.get('atlas_technician_id'):
                    cursor.execute("""
                    UPDATE tecnicos 
                    SET latitud_actual = %s, longitud_actual = %s, ultima_conexion = NOW()
                    WHERE id_tecnico = %s
                    """, (last_lat, last_lon, prof['atlas_technician_id']))
                elif prof.get('technician'):
                    cursor.execute("""
                    UPDATE tecnicos 
                    SET latitud_actual = %s, longitud_actual = %s, ultima_conexion = NOW()
                    WHERE nombre = %s OR UPPER(nombre) = %s
                    """, (last_lat, last_lon, prof['technician'], prof['technician'].upper()))

        conn.commit()
        return jsonify({'received_count': len(synced_uuids), 'synced_uuids': synced_uuids})
    except Exception as e:
        conn.rollback()
        return jsonify({'detail': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@tracker_bp.route('/api/v1/device/status', methods=['POST'])
def device_status():
    r = request.get_json(silent=True) or {}
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        device_id = validar_credencial_dispositivo(cursor, request.headers.get('Authorization'))
        if not device_id:
            return jsonify({'detail': 'Device credential required'}), 401

        uid = r.get('uuid') or f"status_{device_id}_{now_ms()}"
        status_ev = str(r.get('status_event', 'TRACKING_ACTIVE'))
        ts = int(r.get('timestamp', now_ms()))

        cursor.execute("""
        INSERT INTO tracker_status_events (uuid, device_id, status_event, timestamp, received_at)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE status_event = VALUES(status_event)
        """, (uid, device_id, status_ev, ts, now_ms()))

        cursor.execute("""
        UPDATE tracker_devices 
        SET last_status_event = %s, last_status_timestamp = %s, last_seen = %s
        WHERE device_id = %s
        """, (status_ev, ts, now_ms(), device_id))

        conn.commit()
        return jsonify({'received_count': 1, 'synced_uuids': [uid]})
    except Exception as e:
        conn.rollback()
        return jsonify({'detail': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# --- ENDPOINTS DE ADMINISTRACIÓN DE TRACKER ---

@tracker_bp.route('/api/v1/devices', methods=['GET'])
def list_devices():
    usuario = obtener_usuario_autenticado()
    if not es_administrador(usuario):
        return jsonify({'detail': 'No autorizado'}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        cursor.execute("""
        SELECT d.*, 
               p.display_name, p.technician, p.area, p.vehicle_plate, p.atlas_technician_id
        FROM tracker_devices d
        LEFT JOIN tracker_device_profiles p ON d.device_id = p.device_id
        ORDER BY d.last_seen DESC
        """)
        rows = cursor.fetchall()

        now = now_ms()
        offline_threshold = 300 * 1000 # 5 minutos sin reporte es offline

        devices_list = []
        for r in rows:
            is_online = (now - r['last_seen']) < offline_threshold
            devices_list.append({
                'device_id': r['device_id'],
                'device_model': r['device_model'],
                'android_version': r['android_version'],
                'first_seen': r['first_seen'],
                'last_seen': r['last_seen'],
                'last_latitude': r['last_latitude'],
                'last_longitude': r['last_longitude'],
                'battery_level': r['battery_level'],
                'is_charging': bool(r['is_charging']),
                'network_type': r['network_type'],
                'last_status_event': r['last_status_event'],
                'last_status_message': r['last_status_message'],
                'is_online': is_online,
                'profile': {
                    'display_name': r['display_name'] or '',
                    'technician': r['technician'] or '',
                    'area': r['area'] or '',
                    'vehicle_plate': r['vehicle_plate'] or '',
                    'atlas_technician_id': r['atlas_technician_id']
                }
            })

        return jsonify(devices_list)
    except Exception as e:
        return jsonify({'detail': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@tracker_bp.route('/api/v1/devices/<device_id>/latest', methods=['GET'])
def get_latest_location(device_id):
    usuario = obtener_usuario_autenticado()
    if not es_administrador(usuario):
        return jsonify({'detail': 'No autorizado'}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        cursor.execute("""
        SELECT * FROM tracker_location_records
        WHERE device_id = %s
        ORDER BY timestamp DESC, id DESC
        LIMIT 1
        """, (device_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'detail': 'No positions yet'}), 404
        return jsonify(row)
    finally:
        cursor.close()
        conn.close()

@tracker_bp.route('/api/v1/devices/<device_id>/history', methods=['GET'])
def get_device_history(device_id):
    usuario = obtener_usuario_autenticado()
    if not es_administrador(usuario):
        return jsonify({'detail': 'No autorizado'}), 401

    from_time = int(request.args.get('from_time', 0))
    to_time = int(request.args.get('to_time', 0))
    limit = min(int(request.args.get('limit', 1000)), 2000)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        query = "SELECT * FROM tracker_location_records WHERE device_id = %s"
        params = [device_id]

        if from_time > 0:
            query += " AND timestamp >= %s"
            params.append(from_time)
        if to_time > 0:
            query += " AND timestamp <= %s"
            params.append(to_time)

        query += " ORDER BY timestamp ASC, id ASC LIMIT %s"
        params.append(limit + 1)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        next_cursor = None
        if has_more and rows:
            next_cursor = {
                'after_timestamp': rows[-1]['timestamp'],
                'after_id': rows[-1]['id']
            }

        return jsonify({
            'records': rows,
            'next_cursor': next_cursor
        })
    finally:
        cursor.close()
        conn.close()

@tracker_bp.route('/api/v1/admin/device-tokens', methods=['POST'])
def issue_device_token():
    usuario = obtener_usuario_autenticado()
    if not es_administrador(usuario):
        return jsonify({'detail': 'No autorizado'}), 401

    r = request.get_json(silent=True) or {}
    device_id = r.get('device_id')
    if not device_id:
        return jsonify({'detail': 'device_id es requerido'}), 400

    token = secrets.token_urlsafe(32)
    t_hash = digest(token)

    conn = get_db_connection()
    cursor = conn.cursor(buffered=True)

    try:
        cursor.execute("""
        INSERT INTO tracker_device_credentials (device_id, token_hash)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash)
        """, (device_id, t_hash))
        conn.commit()
        return jsonify({'device_id': device_id, 'token': token})
    finally:
        cursor.close()
        conn.close()

@tracker_bp.route('/api/v1/admin/device-profiles/<device_id>', methods=['PUT'])
def update_device_profile(device_id):
    usuario = obtener_usuario_autenticado()
    if not es_administrador(usuario):
        return jsonify({'detail': 'No autorizado'}), 401

    r = request.get_json(silent=True) or {}
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        cursor.execute("SELECT device_id FROM tracker_devices WHERE device_id = %s", (device_id,))
        if not cursor.fetchone():
            return jsonify({'detail': 'Device must send its first authenticated contact before assignment'}), 404

        display_name = r.get('display_name', '')
        technician = r.get('technician', '')
        area = r.get('area', '')
        vehicle_plate = r.get('vehicle_plate', '')
        atlas_tec_id = r.get('atlas_technician_id')

        cursor.execute("""
        INSERT INTO tracker_device_profiles (device_id, display_name, technician, area, vehicle_plate, atlas_technician_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            technician = VALUES(technician),
            area = VALUES(area),
            vehicle_plate = VALUES(vehicle_plate),
            atlas_technician_id = VALUES(atlas_technician_id)
        """, (device_id, display_name, technician, area, vehicle_plate, atlas_tec_id))

        conn.commit()
        return jsonify({'device_id': device_id, 'status': 'updated'})
    finally:
        cursor.close()
        conn.close()
