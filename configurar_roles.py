import os
import sys
from werkzeug.security import generate_password_hash
from db_config import get_db_connection

def configurar():
    conexion = get_db_connection()
    if not conexion:
        print("Error: No se pudo conectar a la base de datos.")
        return

    cursor = conexion.cursor()
    try:
        # 1. Configurar roles de usuarios existentes
        print("Actualizando roles de asesores existentes...")
        cursor.execute("""
            UPDATE usuarios_callcenter 
            SET rol = 'ADMIN' 
            WHERE email = 'msamaniego@futurity.com.ec'
        """)
        cursor.execute("""
            UPDATE usuarios_callcenter 
            SET rol = 'ASESOR' 
            WHERE email IN ('gquezada@futurity.com.ec', 'lsaenz@futurity.com.ec')
        """)
        
        # 2. Asegurar que exista la cuenta de BODEGA
        email_bodega = 'bodega@futurity.com.ec'
        cursor.execute("SELECT id_usuario FROM usuarios_callcenter WHERE email = %s", (email_bodega,))
        if cursor.fetchone():
            print("El usuario de bodega ya existe. Actualizando contrasena y rol...")
            hash_pass = generate_password_hash('bodega123', method='scrypt')
            cursor.execute("""
                UPDATE usuarios_callcenter 
                SET nombre = 'Bodega Central', password_hash = %s, rol = 'BODEGA', activo = 1 
                WHERE email = %s
            """, (hash_pass, email_bodega))
        else:
            print("Creando nuevo usuario de BODEGA...")
            hash_pass = generate_password_hash('bodega123', method='scrypt')
            cursor.execute("""
                INSERT INTO usuarios_callcenter (nombre, email, password_hash, rol, activo)
                VALUES (%s, %s, %s, %s, %s)
            """, ('Bodega Central', email_bodega, hash_pass, 'BODEGA', 1))

        # 3. Asegurar que exista la cuenta de TECNICO (enlazada a ERICK LOJANO)
        email_tecnico = 'erick_lojano@futurity.com.ec'
        cursor.execute("SELECT id_usuario FROM usuarios_callcenter WHERE email = %s", (email_tecnico,))
        if cursor.fetchone():
            print("El usuario tecnico (Erick Lojano) ya existe. Actualizando contrasena y rol...")
            hash_pass = generate_password_hash('tecnico123', method='scrypt')
            cursor.execute("""
                UPDATE usuarios_callcenter 
                SET nombre = 'ERICK LOJANO', password_hash = %s, rol = 'TECNICO', activo = 1 
                WHERE email = %s
            """, (hash_pass, email_tecnico))
        else:
            print("Creando nuevo usuario de TECNICO (Erick Lojano)...")
            hash_pass = generate_password_hash('tecnico123', method='scrypt')
            cursor.execute("""
                INSERT INTO usuarios_callcenter (nombre, email, password_hash, rol, activo)
                VALUES (%s, %s, %s, %s, %s)
            """, ('ERICK LOJANO', email_tecnico, hash_pass, 'TECNICO', 1))

        conexion.commit()
        print("Configuracion de roles y usuarios completada con exito.")
        
    except Exception as e:
        conexion.rollback()
        print(f"Error durante la configuracion de la base de datos: {e}")
    finally:
        cursor.close()
        conexion.close()

if __name__ == '__main__':
    configurar()
