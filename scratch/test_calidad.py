import sys
import unittest
from datetime import date
from werkzeug.security import generate_password_hash

sys.path.append(r'c:\Users\mateo\OneDrive\Documentos\Futurity_git\futurity')
from app import app
from db_config import get_db_connection
from flask import session

class TestCalidadModule(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()
        self.created_visitas = []
        self.created_usuarios = []
        self.original_caro_hash = None

        # Backup y reset temporal del password de Caro
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            try:
                cursor.execute("SELECT password_hash FROM usuarios_callcenter WHERE email = %s", ('cjadan@futurity.com.ec',))
                row = cursor.fetchone()
                if row:
                    self.original_caro_hash = row[0]
                    temp_hash = generate_password_hash('calidad123', method='scrypt')
                    cursor.execute("UPDATE usuarios_callcenter SET password_hash = %s WHERE email = %s", (temp_hash, 'cjadan@futurity.com.ec'))
                    conn.commit()
            except Exception as e:
                print(f"Error backing up Caro password: {e}")
            finally:
                cursor.close()
                conn.close()

    def tearDown(self):
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            try:
                # Restaurar password de Caro si fue guardada
                if hasattr(self, 'original_caro_hash') and self.original_caro_hash:
                    cursor.execute("UPDATE usuarios_callcenter SET password_hash = %s WHERE email = %s", (self.original_caro_hash, 'cjadan@futurity.com.ec'))
                # Limpiar visitas creadas en la base de datos
                if self.created_visitas:
                    for id_visita in self.created_visitas:
                        cursor.execute("DELETE FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
                # Limpiar usuarios creados en la base de datos
                if self.created_usuarios:
                    for id_usuario in self.created_usuarios:
                        cursor.execute("DELETE FROM usuarios_callcenter WHERE id_usuario = %s", (id_usuario,))
                conn.commit()
            except Exception as e:
                print(f"Error limpiando test data: {e}")
            finally:
                cursor.close()
                conn.close()

    def test_01_login_calidad_session_active_area(self):
        """Verifica que al iniciar sesión como Caro se asigne la vista INSTALACIONES automáticamente."""
        with self.client as c:
            # Login
            resp_login = c.post('/login', data={
                'email': 'cjadan@futurity.com.ec',
                'password': 'calidad123'
            }, follow_redirects=True)
            self.assertEqual(resp_login.status_code, 200)
            
            # Verificar variables de sesión usando session_transaction
            with c.session_transaction() as sess:
                self.assertEqual(sess.get('user_role'), 'CALIDAD')
                self.assertEqual(sess.get('active_area'), 'INSTALACIONES')

    def test_02_creacion_instalacion(self):
        """Verifica la creación exitosa de una instalación con sus campos adicionales."""
        with self.client as c:
            # Login como Calidad
            c.post('/login', data={
                'email': 'cjadan@futurity.com.ec',
                'password': 'calidad123'
            }, follow_redirects=True)
            
            # Crear visita de instalación
            hoy = date.today().isoformat()
            data_visita = {
                'fecha_programada': hoy,
                'prioridad': 'ALTA',
                'tecnico_asignado': 'NO TECNICO',
                'tecnico_apoyo': '',
                'empresa': 'SERVICABLE',
                'contrato': 'TEST100',
                'cliente': 'CLIENTE PRUEBA CALIDAD',
                'telefonos': '0999999999',
                'sector': 'CENTRO',
                'direccion': 'Calle Falsa 123',
                'preferencia_horaria': 'mañana',
                'servicio': 'INSTALACIÓN NUEVA',
                'es_instalacion': '1',
                'producto': 'INTERNET',
                'tipo_instalacion': 'NORMAL',
                'vendedor': 'VENDEDOR PRUEBA',
                'recibido_coordinacion': hoy,
                'observacion_callcenter': 'Observación de prueba de instalación'
            }
            
            resp_create = c.post('/api/visitas', data=data_visita, follow_redirects=True)
            self.assertEqual(resp_create.status_code, 200)

            # Buscar en BD la última visita de prueba
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT * FROM visitas_tecnicas 
                WHERE contrato = 'TEST100' AND cliente = 'CLIENTE PRUEBA CALIDAD'
                ORDER BY id_visita DESC LIMIT 1
            """)
            visita_db = cursor.fetchone()
            cursor.close()
            conn.close()

            self.assertIsNotNone(visita_db)
            self.created_visitas.append(visita_db['id_visita'])
            
            # Validar campos específicos
            self.assertEqual(visita_db['es_instalacion'], 1)
            self.assertEqual(visita_db['producto'], 'INTERNET')
            self.assertEqual(visita_db['tipo_instalacion'], 'NORMAL')
            self.assertEqual(visita_db['vendedor'], 'VENDEDOR PRUEBA')
            self.assertEqual(str(visita_db['recibido_coordinacion']), hoy)
            self.assertEqual(visita_db['servicio'], 'INSTALACIÓN NUEVA')

    def test_03_admin_cambiar_area_vista(self):
        """Verifica que el administrador pueda cambiar la vista y actualice la sesión."""
        # Necesitamos un admin. Busquemos un usuario de rol ADMIN en la BD
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_usuario, nombre, email FROM usuarios_callcenter WHERE rol = 'ADMIN' AND activo = 1 LIMIT 1")
        admin_user = cursor.fetchone()
        
        if not admin_user:
            cursor.close()
            conn.close()
            self.skipTest("No se encontró ningún usuario con rol ADMIN en la BD para probar la conmutación.")

        admin_id = admin_user['id_usuario']
        admin_name = admin_user['nombre']
        admin_email = admin_user['email']
        test_token = 'test-token-123-admin'
        
        # Actualizar el token en la BD para este admin para pasar check_single_session
        cursor.execute("UPDATE usuarios_callcenter SET session_token = %s WHERE id_usuario = %s", (test_token, admin_id))
        conn.commit()
        cursor.close()
        conn.close()

        print(f"Probando conmutación con usuario administrador: {admin_email} (ID: {admin_id})")

        with self.client as c:
            # Login manual insertando sesión
            with c.session_transaction() as sess:
                sess['user_id'] = admin_id
                sess['user_name'] = admin_name
                sess['user_role'] = 'ADMIN'
                sess['session_token'] = test_token
                sess['active_area'] = 'SOPORTE'

            # Cambiar a INSTALACIONES
            resp = c.post('/api/admin/cambiar_area_vista', json={'active_area': 'INSTALACIONES'})
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(session.get('active_area'), 'INSTALACIONES')

            # Cambiar a SOPORTE
            resp2 = c.post('/api/admin/cambiar_area_vista', json={'active_area': 'SOPORTE'})
            self.assertEqual(resp2.status_code, 200)
            self.assertEqual(session.get('active_area'), 'SOPORTE')

    def test_04_asesor_metricas_atenciones(self):
        """Verifica que un usuario con rol ASESOR pueda ver las métricas de atenciones."""
        # Obtener un asesor real
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_usuario, nombre, email FROM usuarios_callcenter WHERE rol = 'ASESOR' AND activo = 1 LIMIT 1")
        asesor_user = cursor.fetchone()
        
        if not asesor_user:
            cursor.close()
            conn.close()
            self.skipTest("No se encontró ningún usuario con rol ASESOR en la BD.")

        asesor_id = asesor_user['id_usuario']
        asesor_name = asesor_user['nombre']
        test_token = 'test-token-123-asesor'
        
        # Actualizar el token en la BD para pasar check_single_session
        cursor.execute("UPDATE usuarios_callcenter SET session_token = %s WHERE id_usuario = %s", (test_token, asesor_id))
        conn.commit()
        cursor.close()
        conn.close()

        with self.client as c:
            with c.session_transaction() as sess:
                sess['user_id'] = asesor_id
                sess['user_name'] = asesor_name
                sess['user_role'] = 'ASESOR'
                sess['session_token'] = test_token
                sess['active_area'] = 'SOPORTE'

            # Petición a métricas de atenciones
            resp = c.get('/api/admin/metricas_atenciones')
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data.get('status'), 'ok')

    def test_05_crear_y_actualizar_usuario_calidad(self):
        """Verifica que un administrador pueda crear y actualizar un usuario con rol CALIDAD."""
        # Obtener un admin real para la sesión
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_usuario, nombre, email FROM usuarios_callcenter WHERE rol = 'ADMIN' AND activo = 1 LIMIT 1")
        admin_user = cursor.fetchone()
        
        if not admin_user:
            cursor.close()
            conn.close()
            self.skipTest("No se encontró ningún usuario con rol ADMIN en la BD.")

        admin_id = admin_user['id_usuario']
        admin_name = admin_user['nombre']
        test_token = 'test-token-123-admin-user'
        
        cursor.execute("UPDATE usuarios_callcenter SET session_token = %s WHERE id_usuario = %s", (test_token, admin_id))
        conn.commit()
        cursor.close()
        conn.close()

        with self.client as c:
            # Establecer sesión de admin
            with c.session_transaction() as sess:
                sess['user_id'] = admin_id
                sess['user_name'] = admin_name
                sess['user_role'] = 'ADMIN'
                sess['session_token'] = test_token
                sess['active_area'] = 'SOPORTE'

            # 1. Crear usuario con rol CALIDAD
            user_data = {
                'nombre': 'Usuario Calidad Test',
                'email': 'calidad_test@futurity.com.ec',
                'password': 'password123',
                'rol': 'CALIDAD',
                'activo': 1
            }
            resp_create = c.post('/api/admin/usuarios', json=user_data)
            self.assertEqual(resp_create.status_code, 200)
            self.assertEqual(resp_create.get_json().get('status'), 'ok')

            # Obtener ID del usuario creado
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id_usuario, nombre, email, rol FROM usuarios_callcenter WHERE email = %s", (user_data['email'],))
            new_user = cursor.fetchone()
            cursor.close()
            conn.close()

            self.assertIsNotNone(new_user)
            self.created_usuarios.append(new_user['id_usuario'])
            self.assertEqual(new_user['rol'], 'CALIDAD')
            self.assertEqual(new_user['nombre'], 'Usuario Calidad Test')

            # 2. Actualizar el usuario creado (cambiar nombre, email y contraseña opcional)
            update_data = {
                'nombre': 'Usuario Calidad Test Modificado',
                'email': 'calidad_test_mod@futurity.com.ec',
                'password': 'newpassword123',
                'rol': 'CALIDAD',
                'activo': 1
            }
            resp_update = c.put(f"/api/admin/usuarios/{new_user['id_usuario']}", json=update_data)
            self.assertEqual(resp_update.status_code, 200)
            self.assertEqual(resp_update.get_json().get('status'), 'ok')

            # Verificar cambios en BD
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id_usuario, nombre, email, rol FROM usuarios_callcenter WHERE id_usuario = %s", (new_user['id_usuario'],))
            updated_user = cursor.fetchone()
            cursor.close()
            conn.close()

            self.assertIsNotNone(updated_user)
            self.assertEqual(updated_user['nombre'], 'Usuario Calidad Test Modificado')
            self.assertEqual(updated_user['email'], 'calidad_test_mod@futurity.com.ec')
            self.assertEqual(updated_user['rol'], 'CALIDAD')

if __name__ == '__main__':
    unittest.main()
