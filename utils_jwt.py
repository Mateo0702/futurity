import jwt
import datetime
import os
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env
load_dotenv()

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("FLASK_SECRET_KEY") or "desarrollo_secreto_123"
JWT_ALGORITHM = "HS256"

def _normalize_payload(payload):
    if not payload:
        return payload
    if 'nombre' not in payload and 'username' in payload:
        payload['nombre'] = payload['username']
    if 'username' not in payload and 'nombre' in payload:
        payload['username'] = payload['nombre']
    if 'rol' not in payload and 'role' in payload:
        payload['rol'] = payload['role']
    if 'role' not in payload and 'rol' in payload:
        payload['role'] = payload['rol']
    if 'id_usuario' not in payload and 'sub' in payload and str(payload['sub']).isdigit():
        payload['id_usuario'] = int(payload['sub'])
    if 'sub' not in payload and 'id_usuario' in payload:
        payload['sub'] = str(payload['id_usuario'])
    if 'user_id' not in payload and 'id_usuario' in payload:
        payload['user_id'] = str(payload['id_usuario'])
    return payload

def generate_token(user_id, username, role, expires_in_days=365):
    """
    Genera un token JWT para el usuario especificado.
    """
    try:
        payload = {
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=expires_in_days),
            'iat': datetime.datetime.utcnow(),
            'sub': str(user_id),
            'user_id': str(user_id),
            'id_usuario': user_id,
            'username': str(username),
            'nombre': str(username),
            'role': str(role),
            'rol': str(role)
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    except Exception as e:
        print(f"Error generando token JWT: {e}")
        return None

def verify_token(token):
    """
    Verifica y decodifica un token JWT o token de sesión de la base de datos.
    Retorna el payload normalizado si es válido, o None en caso contrario.
    """
    try:
        if not token:
            return None
        # Asegurarse de que el token no contenga prefijos como 'Bearer '
        if token.startswith("Bearer "):
            parts = token.split(" ", 1)
            if len(parts) < 2:
                return None
            token = parts[1].strip()
        else:
            token = token.strip()

        # Filtrar valores basura que a veces se envían por JS undefined
        if not token or token in ['undefined', 'null', 'None']:
            return None
            
        # 1. Intentar decodificación estándar con validación estricta de firma y expiración
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            if payload:
                return _normalize_payload(payload)
        except jwt.ExpiredSignatureError:
            # 2. Si el token JWT expiró pero la firma era válida:
            # Comprobar si el usuario sigue activo en la base de datos para no desconectar
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
                user_id = payload.get('id_usuario') or payload.get('sub') or payload.get('user_id')
                if user_id:
                    from db_config import get_db_connection
                    conn = get_db_connection()
                    if conn:
                        try:
                            cur = conn.cursor(dictionary=True)
                            cur.execute("SELECT id_usuario, nombre, rol, email, activo FROM usuarios_callcenter WHERE id_usuario = %s AND activo = 1", (user_id,))
                            db_user = cur.fetchone()
                            if db_user:
                                payload['id_usuario'] = db_user['id_usuario']
                                payload['sub'] = str(db_user['id_usuario'])
                                payload['user_id'] = str(db_user['id_usuario'])
                                payload['nombre'] = db_user['nombre']
                                payload['username'] = db_user['nombre']
                                payload['rol'] = db_user['rol']
                                payload['role'] = db_user['rol']
                                payload['email'] = db_user.get('email')
                                return _normalize_payload(payload)
                        finally:
                            cur.close()
                            conn.close()
            except Exception as e_exp:
                print(f"Error comprobando token expirado en DB: {e_exp}")
        except jwt.InvalidTokenError:
            # 3. No es un token JWT estándar (puede ser un UUID o token de sesión de base de datos)
            pass

        # 4. Verificar si es un session_token de usuarios_callcenter (ej. UUID de login clásico)
        try:
            from db_config import get_db_connection
            conn = get_db_connection()
            if conn:
                try:
                    cur = conn.cursor(dictionary=True)
                    cur.execute("SELECT id_usuario, nombre, rol, email, activo FROM usuarios_callcenter WHERE session_token = %s AND activo = 1", (token,))
                    db_user = cur.fetchone()
                    if db_user:
                        user_dict = {
                            'id_usuario': db_user['id_usuario'],
                            'sub': str(db_user['id_usuario']),
                            'user_id': str(db_user['id_usuario']),
                            'nombre': db_user['nombre'],
                            'username': db_user['nombre'],
                            'rol': db_user['rol'],
                            'role': db_user['rol'],
                            'email': db_user.get('email')
                        }
                        return _normalize_payload(user_dict)
                finally:
                    cur.close()
                    conn.close()
        except Exception as db_err:
            print(f"Error verificando session_token en DB: {db_err}")

        return None
    except Exception as e:
        print(f"Error al verificar token: {e}")
        return None

