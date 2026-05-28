import secrets # IMPORTANTE: Añade esto arriba para generar el token seguro
from flask import Blueprint, request, redirect, url_for, render_template, jsonify
from db_config import get_db_connection
from datetime import date
import re
from utils import parsear_informacion_tecnica

tecnico_bp = Blueprint('tecnico', __name__)

def interpretar_preferencia_horaria(texto):
    if not texto:
        return 9999 # Sin hora va al final
    
    texto = str(texto).lower()
    # Buscar números en el texto (ej: "a las 10", "10h00", "10:30")
    import re
    match = re.search(r'(\d{1,2})', texto)
    if match:
        hora = int(match.group(1))
        # Lógica para Cuenca: si ponen 1, 2, 3... suele ser PM (tarde)
        if 1 <= hora <= 7:
            hora += 12
        return hora
    return 9999


@tecnico_bp.route('/tecnico/<nombre_tecnico>')
def panel_tecnico(nombre_tecnico):
    nombre_real = nombre_tecnico.replace('_', ' ')
    
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    
    hoy = date.today().isoformat()
    
    # 1. CAMBIO CLAVE: Traemos TODAS las visitas de la empresa de HOY (Quitamos el filtro de técnico aquí)
    query = """
        SELECT * FROM visitas_tecnicas 
        WHERE fecha_programada = %s 
        AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA')
    """
    cursor.execute(query, (hoy,))
    todas_las_visitas = cursor.fetchall()
    
    # =========================================================
    # EL MOTOR OPTIMIZADOR EN VIVO (Aplica a nivel empresa)
    # =========================================================
    def peso_orden(v):
        if v['estado'] in ['EN_PROGRESO', 'EN_RUTA']:
            estado_val = 0 
        elif v['estado'] == 'FINALIZADA':
            estado_val = 9 
        else:
            estado_val = 1 

        prioridad_val = {'ALTA': 1, 'MEDIA': 2, 'BAJA': 3}.get(v.get('prioridad', 'MEDIA'), 2)
        hora_val = interpretar_preferencia_horaria(v.get('preferencia_horaria', ''))

        return (estado_val, prioridad_val, hora_val, v['id_visita'])

    # 2. Ordenamos todas las visitas del día
    todas_las_visitas.sort(key=peso_orden)
    
    # 3. Enumeramos globalmente (Esta será la Parada #1, Parada #2, etc. para toda la empresa)
    for indice, visita in enumerate(todas_las_visitas, start=1):
        visita['numero_parada'] = indice

    # 4. FILTRO FINAL: Extraemos solo las que le corresponden a este técnico en específico
    visitas_del_tecnico = [
        v for v in todas_las_visitas 
        if v.get('tecnico_principal') == nombre_real or v.get('tecnico_apoyo') == nombre_real
    ]
    
    # --- Carga de catálogos y soluciones (Queda igual) ---
    soluciones = obtener_soluciones_activas()
    
    cursor.execute("SELECT * FROM materiales ORDER BY nombre_material ASC")
    catalogo_materiales = cursor.fetchall()
    
    cursor.execute("SELECT nombre FROM catalogo_modelos_ont WHERE activo = 1 ORDER BY nombre ASC")
    catalogo_ont = cursor.fetchall()
    
    cursor.execute("SELECT nombre FROM catalogo_modelos_router WHERE activo = 1 ORDER BY nombre ASC")
    catalogo_router = cursor.fetchall()
    
    cursor.close()
    conexion.close()

    # Parsear información técnica (Caja, Hilo, IP, etc.) para visualización del técnico
    visitas_del_tecnico = parsear_informacion_tecnica(visitas_del_tecnico)

    # Mandamos al HTML la lista filtrada ('visitas_del_tecnico')
    return render_template('tecnico_panel.html', 
                           visitas=visitas_del_tecnico, 
                           tecnico=nombre_real,
                           soluciones=soluciones,
                           catalogo=catalogo_materiales,
                           catalogo_ont=catalogo_ont,           
                           catalogo_router=catalogo_router)

def obtener_soluciones_activas():
    """Consulta la tabla catalogo_soluciones y devuelve la lista ordenada."""
    conexion = get_db_connection()
    if not conexion: return []
    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre FROM catalogo_soluciones WHERE activo = TRUE ORDER BY nombre ASC")
        return cursor.fetchall()
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()


# --- 2. NUEVO: BOTÓN "VOY EN CAMINO" (Arranca el traslado) ---
@tecnico_bp.route('/api/tecnico/en_camino/<int:id_visita>', methods=['POST'])
def en_camino_visita(id_visita):
    """El técnico arranca en la camioneta. Genera el Link de Rastreo."""
    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    # Generamos un código único de 16 caracteres (Ej: 'V8mK9xP_zL2QwNrj')
    token_seguro = secrets.token_urlsafe(16)
    
    try:
        query = """
            UPDATE visitas_tecnicas 
            SET estado = 'EN_RUTA', 
                hora_en_ruta = NOW(), 
                token_rastreo = %s 
            WHERE id_visita = %s
        """
        cursor.execute(query, (token_seguro, id_visita))
        conexion.commit()
    except Exception as e:
        print(f"Error al poner en ruta: {e}")
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    return redirect(request.referrer)


# --- 3. ACTUALIZADO: BOTÓN "INICIAR TRABAJO" (Llegó a la casa) ---
@tecnico_bp.route('/api/tecnico/iniciar/<int:id_visita>', methods=['POST'])
def iniciar_visita(id_visita):
    """El técnico llegó al domicilio y empieza a trabajar."""
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        query = "UPDATE visitas_tecnicas SET estado = 'EN_PROGRESO', hora_inicio_visita = NOW() WHERE id_visita = %s"
        cursor.execute(query, (id_visita,))
        conexion.commit()
    except Exception as e:
        print(f"Error al iniciar visita: {e}")
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    return redirect(request.referrer)


# --- 4. BOTÓN "FINALIZAR VISITA" (Cierre Total) ---
@tecnico_bp.route('/api/tecnico/finalizar/<int:id_visita>', methods=['POST'])
def finalizar_visita(id_visita):
    """Recibe el formulario del celular y cierra la visita."""
    solucion = request.form.get('solucion_tecnico')
    observacion = request.form.get('observacion_tecnico')
    onu = request.form.get('modelo_onu')
    router = request.form.get('modelo_router')
    coordenadas = request.form.get('coordenadas_tecnico')
    
    # Capturamos las listas dinámicas de materiales enviados desde el HTML
    materiales_ids = request.form.getlist('materiales_seleccionados[]')
    cantidades = request.form.getlist('cantidades_materiales[]')
    
    conexion = get_db_connection()
    cursor = conexion.cursor()
    try:
        # 1. Actualizar la visita técnica
        query = """
            UPDATE visitas_tecnicas 
            SET estado = 'FINALIZADA', 
                hora_fin_visita = NOW(),
                solucion_tecnico = %s,
                observacion_tecnico = %s,
                modelo_onu = %s,
                modelo_router = %s,
                coordenadas_tecnico = %s
            WHERE id_visita = %s
        """
        cursor.execute(query, (solucion, observacion, onu, router, coordenadas, id_visita))
        
        # 2. Registrar materiales e inventario si existen
        if materiales_ids and cantidades:
            # Obtener el nombre del técnico principal de esta visita
            cursor.execute("SELECT tecnico_principal FROM visitas_tecnicas WHERE id_visita = %s", (id_visita,))
            tec_row = cursor.fetchone()
            tecnico_nombre = tec_row[0] if tec_row else None
            
            query_materiales = """
                INSERT INTO visitas_materiales (id_visita, id_material, cantidad_usada)
                VALUES (%s, %s, %s)
            """
            
            query_update_custodia = """
                UPDATE inventario_tecnicos 
                SET cantidad_disponible = cantidad_disponible - %s 
                WHERE tecnico_nombre = %s AND id_material = %s
            """
            
            for i in range(len(materiales_ids)):
                id_mat = materiales_ids[i]
                cant = cantidades[i]
                
                # Solo guardamos si seleccionó un material y puso una cantidad mayor a cero
                if id_mat and cant and int(cant) > 0:
                    cursor.execute(query_materiales, (id_visita, int(id_mat), int(cant)))
                    
                    if tecnico_nombre:
                        # Asegurar que exista el registro en inventario_tecnicos (por si no estaba inicializado)
                        cursor.execute("""
                            INSERT IGNORE INTO inventario_tecnicos (tecnico_nombre, id_material, cantidad_disponible)
                            VALUES (%s, %s, 0)
                        """, (tecnico_nombre, int(id_mat)))
                        
                        # Descontar del inventario del técnico
                        cursor.execute(query_update_custodia, (int(cant), tecnico_nombre, int(id_mat)))
                        
        conexion.commit()
        print(f"✅ Visita #{id_visita} finalizada e insumos actualizados.")
    except Exception as e:
        conexion.rollback()
        print(f"Error al finalizar visita con materiales: {e}")
    finally:
        if 'conexion' in locals() and conexion.is_connected():
            cursor.close()
            conexion.close()
            
    return redirect(request.referrer)

# --- 5. RASTREO SILENCIOSO DEL GPS EN VIVO ---
# --- 5. RASTREO SILENCIOSO DEL GPS EN VIVO (ULTRA TOLERANTE) ---
@tecnico_bp.route('/api/tecnico/rastreo_vivo/<int:id_visita>', methods=['POST'])
def rastreo_vivo(id_visita):
    """Recibe la latitud y longitud del celular del técnico y fuerza su guardado."""
    print(f"📡 ¡Alerta! Petición recibida para la visita #{id_visita}") # Ver en la terminal de la PC
    
    # Manejo ultra flexible por si viene como JSON o Formulario clásico
    if request.is_json:
        datos = request.get_json()
    else:
        datos = request.form
        
    lat = datos.get('latitud')
    lon = datos.get('longitud')
    
    print(f"📍 Datos recibidos del celular -> Lat: {lat}, Lon: {lon}")

    if lat and lon:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        try:
            # Quitamos el filtro "AND estado = 'EN_RUTA'" solo para pruebas, 
            # así nos aseguramos de que guarde pase lo que pase.
            query = """
                UPDATE visitas_tecnicas 
                SET latitud_gps_vivo = %s, 
                    longitud_gps_vivo = %s, 
                    ultima_actualizacion_gps = NOW() 
                WHERE id_visita = %s
            """
            cursor.execute(query, (lat, lon, id_visita))
            conexion.commit()
            print("💾 ¡Ubicación guardada con éxito en MySQL!")
        except Exception as e:
            print(f"❌ Error crítico en la consulta MySQL: {e}")
        finally:
            if 'conexion' in locals() and conexion.is_connected():
                cursor.close()
                conexion.close()
    else:
        print("⚠️ Advertencia: Llegó la petición pero los valores lat/lon vinieron vacíos.")
                
    return jsonify({"status": "ok"})

@tecnico_bp.route('/api/tecnico/cerrar_visita/<int:id_visita>', methods=['POST'])
def cerrar_visita_proceso(id_visita):
    # 1. Capturamos los datos tradicionales del cierre
    estado_final = request.form.get('estado_final') # 'FINALIZADA' o 'SOLVENTADA_REMOTA'
    observacion = request.form.get('observacion_cierre')
    
    # 2. Capturamos las listas dinámicas de materiales enviados desde el HTML
    materiales_ids = request.form.getlist('materiales_seleccionados[]')
    cantidades = request.form.getlist('cantidades_materiales[]')

    conexion = get_db_connection()
    cursor = conexion.cursor()
    
    try:
        # A. Actualizamos el estado general de la visita técnica
        query_visita = """
            UPDATE visitas_tecnicas 
            SET estado = %s, 
                observacion_tecnico = %s,
                fecha_cierre = NOW()
            WHERE id_visita = %s
        """
        cursor.execute(query_visita, (estado_final, observacion, id_visita))
        
        # B. Guardamos los materiales dinámicamente uno por uno si existen
        if materiales_ids and cantidades:
            query_materiales = """
                INSERT INTO visitas_materiales (id_visita, id_material, cantidad_usada)
                VALUES (%s, %s, %s)
            """
            for i in range(len(materiales_ids)):
                id_mat = materiales_ids[i]
                cant = cantidades[i]
                
                # Solo guardamos si seleccionó un material y puso una cantidad válida mayor a cero
                if id_mat and cant and int(cant) > 0:
                    cursor.execute(query_materiales, (id_visita, int(id_mat), int(cant)))
                    
        conexion.commit()
        print(f"✅ Visita #{id_visita} cerrada y materiales registrados exitosamente.")
        
    except Exception as e:
        conexion.rollback()
        print(f"❌ Error al cerrar visita con materiales: {e}")
    finally:
        cursor.close()
        conexion.close()
        
    return redirect(url_for('tecnico.panel', tecnico_name=session.get('tecnico_name')))

from flask import jsonify

@tecnico_bp.route('/api/cliente/historial/<path:nombre_cliente>')
def obtener_historial_cliente(nombre_cliente):
    conexion = get_db_connection()
    cursor = conexion.cursor(dictionary=True)
    
    try:
        # Buscamos visitas del cliente en los últimos 3 meses (90 días)
        # Filtramos para que traiga principalmente las FINALIZADAS o CANCELADAS para ver el desenlace
        query = """
            SELECT fecha_programada, problema, solucion_tecnico, tecnico_principal, estado
            FROM visitas_tecnicas
            WHERE cliente = %s AND estado IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
            AND fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            ORDER BY fecha_programada DESC
        """
        cursor.execute(query, (nombre_cliente,))
        historial = cursor.fetchall()
        
        return jsonify({"status": "ok", "historial": historial})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()