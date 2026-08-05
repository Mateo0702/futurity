import jwt
import datetime
import os
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env
load_dotenv()

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("FLASK_SECRET_KEY") or "desarrollo_secreto_123"
JWT_ALGORITHM = "HS256"

def generate_token(user_id, username, role, expires_in_days=30):
    """
    Genera un token JWT para el usuario especificado.
    """
    try:
        payload = {
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=expires_in_days),
            'iat': datetime.datetime.utcnow(),
            'sub': str(user_id),
            'username': str(username),
            'role': str(role)
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    except Exception as e:
        print(f"Error generando token JWT: {e}")
        return None

def verify_token(token):
    """
    Verifica y decodifica un token JWT.
    Retorna el payload si es válido, o None en caso contrario.
    """
    try:
        # Asegurarse de que el token no contenga prefijos como 'Bearer '
        if token.startswith("Bearer "):
            token = token.split(" ")[1]
            
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        print("El token JWT ha expirado.")
        return None
    except jwt.InvalidTokenError as e:
        print(f"Token JWT inválido: {e}")
        return None
    except Exception as e:
        print(f"Error al verificar token JWT: {e}")
        return None
