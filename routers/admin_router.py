from flask import Blueprint, render_template, request, jsonify, session, send_file
from datetime import datetime, timedelta, date
from db_config import get_db_connection
from io import BytesIO
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER

admin_bp = Blueprint('admin', __name__)

from flask import redirect, url_for
from urllib.parse import urlencode

@admin_bp.route('/admin/control_calidad')
def dashboard_calidad():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('user_role') not in ['ADMIN']:
        from flask import flash
        flash('No tienes permiso para acceder al control de calidad.', 'danger')
        return redirect(url_for('dashboard'))

    # Redireccionar al dashboard de la app con el parámetro tab=control-calidad y pasar los filtros
    args = request.args.to_dict()
    args['tab'] = 'control-calidad'
    query_string = urlencode(args)
    return redirect(f"/?{query_string}")


@admin_bp.route('/api/admin/control_calidad/datos')
def api_dashboard_calidad():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver datos de control de calidad."}), 403
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        # Capturar parámetros de fecha y cliente, usando hoy por defecto
        hoy = datetime.now().strftime('%Y-%m-%d')
        fecha_inicio = request.args.get('fecha_inicio', hoy)
        fecha_fin = request.args.get('fecha_fin', hoy)
        cliente_filtro = request.args.get('cliente', '').strip()

        # Construir cláusula WHERE común
        base_where = "WHERE calificacion_estrellas IS NOT NULL AND fecha_programada >= %s AND fecha_programada <= %s"
        params = [fecha_inicio, fecha_fin]

        if cliente_filtro:
            base_where += " AND cliente LIKE %s"
            params.append(f"%{cliente_filtro}%")
        
        # 1. Consulta para los KPIs Generales
        cursor.execute(f"""
            SELECT 
                ROUND(AVG(calificacion_estrellas), 2) AS promedio_global,
                COUNT(calificacion_estrellas) AS total_calificadas,
                SUM(CASE WHEN calificacion_estrellas <= 3 THEN 1 ELSE 0 END) AS alertas_criticas
            FROM visitas_tecnicas
            {base_where}
        """, params)
        kpis = cursor.fetchone()
        
        # Validar nulos en los KPIs
        if kpis:
            if kpis['promedio_global'] is None: kpis['promedio_global'] = 0.0
            if kpis['total_calificadas'] is None: kpis['total_calificadas'] = 0
            if kpis['alertas_criticas'] is None: kpis['alertas_criticas'] = 0
        else:
            kpis = {"promedio_global": 0.0, "total_calificadas": 0, "alertas_criticas": 0}

        # 2. Consulta para el Ranking de Técnicos (Alimentar Gráfico)
        cursor.execute(f"""
            SELECT 
                tecnico_principal AS nombre,
                ROUND(AVG(calificacion_estrellas), 2) AS promedio,
                COUNT(calificacion_estrellas) AS total_visitas,
                CAST(IFNULL(SUM(CASE WHEN calificacion_estrellas >= 4 THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS buenas,
                CAST(IFNULL(SUM(CASE WHEN calificacion_estrellas <= 3 THEN 1 ELSE 0 END), 0) AS UNSIGNED) AS malas
            FROM visitas_tecnicas
            {base_where}
            GROUP BY tecnico_principal
            ORDER BY total_visitas DESC, promedio DESC
        """, params)
        ranking_tecnicos = cursor.fetchall()

        # 3. Consulta para la Tabla con Filtros Aplicados
        query_tabla = f"""
            SELECT id_visita, cliente, sector, tecnico_principal, calificacion_estrellas, calificacion_comentario, hora_fin_visita
            FROM visitas_tecnicas
            {base_where}
            ORDER BY hora_fin_visita DESC LIMIT 100
        """
        cursor.execute(query_tabla, params)
        resenas_detalladas = cursor.fetchall()
        
        # Formatear fechas
        for r in resenas_detalladas:
            if r['hora_fin_visita']:
                r['hora_fin_visita'] = r['hora_fin_visita'].isoformat()
        
        # Traer lista de técnicos para el combobox del filtro
        cursor.execute("SELECT nombre FROM tecnicos WHERE activo = 1")
        lista_tecnicos = cursor.fetchall()

        return jsonify({
            "status": "ok",
            "kpis": kpis,
            "ranking": ranking_tecnicos,
            "resenas": resenas_detalladas,
            "tecnicos": lista_tecnicos,
            "filtros": {'fecha_inicio': fecha_inicio, 'fecha_fin': fecha_fin, 'cliente': cliente_filtro}
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@admin_bp.route('/api/admin/auditoria_cliente', methods=['GET'])
def auditoria_cliente():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para realizar auditorías de clientes."}), 403

    contrato = request.args.get('contrato', '').strip()
    desde = request.args.get('desde', '')
    hasta = request.args.get('hasta', '')
    
    # Determinar si es Fibracom o Servicable basándose en el sufijo 'F'
    is_fibracom = contrato.upper().endswith('F')
    
    if is_fibracom:
        contrato_base = contrato[:-1]
        contrato_directorio = contrato
    else:
        contrato_base = contrato
        contrato_directorio = contrato
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify([])
    cursor = conexion.cursor(dictionary=True)
    
    # Obtener el nombre oficial del cliente desde el directorio
    cursor.execute("""
        SELECT nombre_cliente FROM directorio_clientes WHERE contrato = %s
    """, (contrato_directorio,))
    cliente_dir = cursor.fetchone()
    nombre_oficial = cliente_dir['nombre_cliente'] if cliente_dir else None
    
    # 1. Obtener Visitas Técnicas
    if is_fibracom:
        query_visitas = """
            SELECT id_visita, fecha_programada, cliente, problema, solucion_tecnico, 
                   observacion_tecnico, tecnico_principal, tecnico_apoyo, 
                   estado, calificacion_estrellas, calificacion_comentario,
                   'visita_tecnica' AS tipo_registro
            FROM visitas_tecnicas 
            WHERE contrato = %s AND empresa = 'FIBRACOM'
        """
    else:
        query_visitas = """
            SELECT id_visita, fecha_programada, cliente, problema, solucion_tecnico, 
                   observacion_tecnico, tecnico_principal, tecnico_apoyo, 
                   estado, calificacion_estrellas, calificacion_comentario,
                   'visita_tecnica' AS tipo_registro
            FROM visitas_tecnicas 
            WHERE contrato = %s AND (empresa != 'FIBRACOM' OR empresa IS NULL)
        """
    params_visitas = [contrato_base]
    if desde:
        query_visitas += " AND fecha_programada >= %s"
        params_visitas.append(desde)
    if hasta:
        query_visitas += " AND fecha_programada <= %s"
        params_visitas.append(hasta)
        
    cursor.execute(query_visitas, tuple(params_visitas))
    visitas = cursor.fetchall()
    
    # 2. Obtener Atenciones Diarias
    query_atenciones = """
        SELECT id_atencion AS id_visita, fecha AS fecha_programada, cliente, tipo_solicitud AS problema, 
               accion AS solucion_tecnico, observacion AS observacion_tecnico, 
               agente AS tecnico_principal, medio_contacto AS tecnico_apoyo,
               'FINALIZADA' AS estado, NULL AS calificacion_estrellas, NULL AS calificacion_comentario,
               'atencion' AS tipo_registro, hora, olt, ont, router, timer_minutos
        FROM atenciones 
        WHERE contrato = %s
    """
    params_atenciones = [contrato_directorio]
    if desde:
        query_atenciones += " AND fecha >= %s"
        params_atenciones.append(desde)
    if hasta:
        query_atenciones += " AND fecha <= %s"
        params_atenciones.append(hasta)
        
    cursor.execute(query_atenciones, tuple(params_atenciones))
    atenciones = cursor.fetchall()
    
    cursor.close()
    conexion.close()
    
    # Unificar nombre de cliente si se encontró en el directorio
    if nombre_oficial:
        for v in visitas:
            v['cliente'] = nombre_oficial
        for a in atenciones:
            a['cliente'] = nombre_oficial
    
    # Combinar ambas listas
    from datetime import time as dt_time
    resultados = visitas + atenciones
    
    if not resultados and nombre_oficial:
        resultados = [{"cliente": nombre_oficial, "tipo_registro": "meta", "estado": "SIN_REGISTROS", "fecha_programada": ""}]
    
    def get_sort_key(item):
        d_val = item['fecha_programada']
        if isinstance(d_val, (datetime, date)):
            d = d_val
        else:
            try:
                d = datetime.strptime(str(d_val), "%Y-%m-%d").date()
            except:
                d = date.min
        
        t = dt_time.min
        if item['tipo_registro'] == 'atencion' and item.get('hora'):
            h_val = item['hora']
            if isinstance(h_val, dt_time):
                t = h_val
            elif isinstance(h_val, timedelta):
                tot_sec = int(h_val.total_seconds())
                t = dt_time(hour=(tot_sec // 3600) % 24, minute=(tot_sec // 60) % 60, second=tot_sec % 60)
            else:
                try:
                    t = datetime.strptime(str(h_val), "%H:%M:%S").time()
                except:
                    pass
        return (d, t)
        
    resultados.sort(key=get_sort_key, reverse=True)
    
    # Convertir las fechas a cadenas ISO para JSON
    for res in resultados:
        if isinstance(res['fecha_programada'], (datetime, date)):
            res['fecha_programada'] = res['fecha_programada'].isoformat()
        if 'hora' in res:
            if isinstance(res['hora'], dt_time):
                res['hora'] = res['hora'].isoformat()
            elif isinstance(res['hora'], timedelta):
                tot_sec = int(res['hora'].total_seconds())
                res['hora'] = f"{(tot_sec // 3600) % 24:02d}:{(tot_sec // 60) % 60:02d}:{tot_sec % 60:02d}"
            elif res['hora'] is not None:
                res['hora'] = str(res['hora'])
            
    return jsonify(resultados)

@admin_bp.route('/api/admin/tecnicos/ubicaciones', methods=['GET'])
def api_tecnicos_ubicaciones():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver la ubicación de los técnicos."}), 403
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        # Consulta para traer la ubicación actual global de cada técnico activo
        query = """
            SELECT id_tecnico,
                   nombre AS tecnico, 
                   latitud_actual AS lat, 
                   longitud_actual AS lon, 
                   ultima_conexion AS ultima_actualizacion, 
                   estado_actividad AS estado, 
                   foto_perfil,
                   foto_vehiculo,
                   placa_vehiculo
            FROM tecnicos
            WHERE activo = 1 
              AND latitud_actual IS NOT NULL 
              AND longitud_actual IS NOT NULL
        """
        cursor.execute(query)
        ubicaciones = cursor.fetchall()
        
        # Formatear fecha/hora a ISO para serialización JSON
        for u in ubicaciones:
            if u['ultima_actualizacion']:
                u['ultima_actualizacion'] = u['ultima_actualizacion'].isoformat()
            
        return jsonify({"status": "ok", "ubicaciones": ubicaciones})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

@admin_bp.route('/api/admin/metricas_globales', methods=['GET'])
def metricas_globales():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver métricas globales."}), 403

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "No se pudo conectar a la base de datos"}), 500
    
    cursor = conexion.cursor(dictionary=True)
    try:
        # 1. Total visitas y KPIs en los últimos 3 meses
        query_kpis = """
            SELECT 
                COUNT(*) as total_visitas,
                SUM(CASE WHEN estado IN ('FINALIZADA', 'SOLVENTADA_REMOTA') THEN 1 ELSE 0 END) as visitas_efectivas,
                AVG(CASE WHEN estado = 'FINALIZADA' AND hora_inicio_visita IS NOT NULL AND hora_fin_visita IS NOT NULL 
                         THEN TIMESTAMPDIFF(MINUTE, hora_inicio_visita, hora_fin_visita) ELSE NULL END) as tiempo_promedio
            FROM visitas_tecnicas
            WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        """
        cursor.execute(query_kpis)
        kpis = cursor.fetchone()
        
        total = kpis['total_visitas'] or 0
        efectivas = kpis['visitas_efectivas'] or 0
        tasa_efectividad = round(float(efectivas / total * 100), 1) if total > 0 else 0.0
        tiempo_promedio = round(float(kpis['tiempo_promedio'] or 0), 1)
        
        # 2. Distribución por Estado
        query_estados = """
            SELECT estado, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            GROUP BY estado
        """
        cursor.execute(query_estados)
        estados_raw = cursor.fetchall()
        estados = {
            'PENDIENTE': 0,
            'FINALIZADA': 0,
            'REAGENDADA': 0,
            'CANCELADA': 0
        }
        for row in estados_raw:
            est = row['estado']
            cant = row['cantidad']
            if est == 'PENDIENTE':
                estados['PENDIENTE'] += cant
            elif est in ('FINALIZADA', 'SOLVENTADA_REMOTA'):
                estados['FINALIZADA'] += cant
            elif est == 'REAGENDADA':
                estados['REAGENDADA'] += cant
            elif est == 'CANCELADA':
                estados['CANCELADA'] += cant
        
        # 3. Top 3 Clientes con más visitas
        query_top_clientes = """
            SELECT cliente, contrato, COUNT(*) as total_visitas
            FROM visitas_tecnicas
            WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
              AND contrato IS NOT NULL AND contrato != ''
              AND estado IN ('FINALIZADA', 'SOLVENTADA_REMOTA')
            GROUP BY cliente, contrato
            ORDER BY total_visitas DESC
            LIMIT 3
        """
        cursor.execute(query_top_clientes)
        top_clientes = cursor.fetchall()
        
        # 4. Top 5 Problemas comunes
        query_problemas = """
            SELECT problema, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            GROUP BY problema
            ORDER BY cantidad DESC
            LIMIT 5
        """
        cursor.execute(query_problemas)
        top_problemas = cursor.fetchall()
        
        # 5. Evolución semanal de visitas
        query_evolucion = """
            SELECT 
                DATE_FORMAT(fecha_programada, '%Y-%u') as semana,
                MIN(fecha_programada) as inicio_semana,
                COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
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
                'label': f"Sem {fecha_str}",
                'cantidad': row['cantidad']
            })
            
        data = {
            'status': 'ok',
            'kpis': {
                'total_visitas': total,
                'tasa_efectividad': tasa_efectividad,
                'tiempo_promedio': tiempo_promedio
            },
            'estados': estados,
            'top_clientes': top_clientes,
            'top_problemas': top_problemas,
            'evolucion': evolucion
        }
        
        return jsonify(data)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748b'))
        
        # Header (Only on page 2 onwards)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor('#e2e8f0'))
            self.setLineWidth(0.5)
            self.line(36, 756, 576, 756)
            self.drawString(36, 762, "Futurity - Reporte de Auditoría de Cliente")
        
        # Footer (On all pages)
        self.setStrokeColor(colors.HexColor('#e2e8f0'))
        self.setLineWidth(0.5)
        self.line(36, 45, 576, 45)
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(576, 32, page_text)
        self.drawString(36, 32, "Generado por Sistema Futurity")
        self.restoreState()


@admin_bp.route('/api/admin/reporte_pdf', methods=['GET'])
def reporte_pdf():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'ASESOR']:
        return jsonify({"status": "error", "message": "No tienes privilegios para descargar reportes."}), 403

    contrato = request.args.get('contrato', '').strip()
    desde = request.args.get('desde', '')
    hasta = request.args.get('hasta', '')

    if not contrato:
        return jsonify({"status": "error", "message": "Debe especificar un número de contrato"}), 400

    # Determinar si es Fibracom o Servicable basándose en el sufijo 'F'
    is_fibracom = contrato.upper().endswith('F')
    
    if is_fibracom:
        contrato_base = contrato[:-1]
        contrato_directorio = contrato
    else:
        contrato_base = contrato
        contrato_directorio = contrato

    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    cursor = conexion.cursor(dictionary=True)
    try:
        # 1. Obtener datos del cliente de directorio_clientes
        cursor.execute("""
            SELECT nombre_cliente AS cliente, zona AS sector, '-' as direccion FROM directorio_clientes WHERE contrato = %s
        """, (contrato_directorio,))
        cliente_data = cursor.fetchone()
        
        if not cliente_data:
            # Fallback a visitas_tecnicas
            if is_fibracom:
                cursor.execute("""
                    SELECT cliente, sector, direccion FROM visitas_tecnicas WHERE contrato = %s AND empresa = 'FIBRACOM' LIMIT 1
                """, (contrato_base,))
            else:
                cursor.execute("""
                    SELECT cliente, sector, direccion FROM visitas_tecnicas WHERE contrato = %s AND (empresa != 'FIBRACOM' OR empresa IS NULL) LIMIT 1
                """, (contrato_base,))
            cliente_data = cursor.fetchone()
            
            if not cliente_data:
                # Fallback a atenciones
                cursor.execute("""
                    SELECT cliente, sector, '-' as direccion FROM atenciones WHERE contrato = %s LIMIT 1
                """, (contrato_directorio,))
                cliente_data = cursor.fetchone()
        
        cliente_nombre = "Desconocido"
        cliente_sector = "-"
        cliente_direccion = "-"
        if cliente_data:
            cliente_nombre = cliente_data['cliente']
            cliente_sector = cliente_data['sector'] or "-"
            cliente_direccion = cliente_data.get('direccion') or "-"
        
        # 2. Obtener Visitas Técnicas
        if is_fibracom:
            query_visitas = """
                SELECT id_visita, fecha_programada, cliente, problema, solucion_tecnico, 
                       observacion_tecnico, tecnico_principal, tecnico_apoyo, 
                       estado, calificacion_estrellas, calificacion_comentario,
                       'visita_tecnica' AS tipo_registro
                FROM visitas_tecnicas 
                WHERE contrato = %s AND empresa = 'FIBRACOM'
            """
        else:
            query_visitas = """
                SELECT id_visita, fecha_programada, cliente, problema, solucion_tecnico, 
                       observacion_tecnico, tecnico_principal, tecnico_apoyo, 
                       estado, calificacion_estrellas, calificacion_comentario,
                       'visita_tecnica' AS tipo_registro
                FROM visitas_tecnicas 
                WHERE contrato = %s AND (empresa != 'FIBRACOM' OR empresa IS NULL)
            """
        params_visitas = [contrato_base]
        if desde:
            query_visitas += " AND fecha_programada >= %s"
            params_visitas.append(desde)
        if hasta:
            query_visitas += " AND fecha_programada <= %s"
            params_visitas.append(hasta)
        query_visitas += " ORDER BY fecha_programada DESC"
        cursor.execute(query_visitas, tuple(params_visitas))
        visitas = cursor.fetchall()
        
        # 3. Obtener Atenciones Diarias
        query_atenciones = """
            SELECT id_atencion AS id_visita, fecha AS fecha_programada, cliente, tipo_solicitud AS problema, 
                   accion AS solucion_tecnico, observacion AS observacion_tecnico, 
                   agente AS tecnico_principal, medio_contacto AS tecnico_apoyo,
                   'FINALIZADA' AS estado, NULL AS calificacion_estrellas, NULL AS calificacion_comentario,
                   'atencion' AS tipo_registro, hora, olt, ont, router, timer_minutos
            FROM atenciones 
            WHERE contrato = %s
        """
        params_atenciones = [contrato_directorio]
        if desde:
            query_atenciones += " AND fecha >= %s"
            params_atenciones.append(desde)
        if hasta:
            query_atenciones += " AND fecha <= %s"
            params_atenciones.append(hasta)
        query_atenciones += " ORDER BY fecha DESC, hora DESC"
        cursor.execute(query_atenciones, tuple(params_atenciones))
        atenciones = cursor.fetchall()
        
        # KPIs calculations
        total_visitas = len(visitas)
        total_atenciones = len(atenciones)
        
        calificadas = [v for v in visitas if v.get('calificacion_estrellas') is not None]
        if calificadas:
            promedio_estrellas = f"{sum(v['calificacion_estrellas'] for v in calificadas) / len(calificadas):.1f} \u2605"
        else:
            promedio_estrellas = "-"
            
        # Start building PDF
        pdf_buffer = BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=54,
            bottomMargin=60
        )
        
        styles = getSampleStyleSheet()
        
        # Define custom colors
        primary_color = colors.HexColor('#b91c1c') # Dark Red
        secondary_color = colors.HexColor('#1e293b') # Slate
        dark_text = colors.HexColor('#0f172a')
        muted_text = colors.HexColor('#475569')
        bg_light = colors.HexColor('#f8fafc')
        border_color = colors.HexColor('#e2e8f0')
        
        # Custom styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=20,
            leading=24,
            textColor=primary_color,
            spaceAfter=4
        )
        
        subtitle_style = ParagraphStyle(
            'DocSub',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=muted_text,
            spaceAfter=15
        )
        
        section_title_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=secondary_color,
            spaceBefore=15,
            spaceAfter=8,
            keepWithNext=True
        )
        
        meta_label_style = ParagraphStyle(
            'MetaLabel',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=dark_text
        )
        
        meta_val_style = ParagraphStyle(
            'MetaVal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=11,
            textColor=muted_text
        )
        
        kpi_title_style = ParagraphStyle(
            'KPITitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=9,
            alignment=TA_CENTER,
            textColor=muted_text
        )
        
        kpi_val_style = ParagraphStyle(
            'KPIVal',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=16,
            alignment=TA_CENTER,
            textColor=dark_text
        )
        
        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=colors.white
        )
        
        table_cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=dark_text
        )
        
        table_cell_bold_style = ParagraphStyle(
            'TableCellBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=dark_text
        )
        
        table_cell_italic_style = ParagraphStyle(
            'TableCellItalic',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=7.5,
            leading=9,
            textColor=muted_text
        )
        
        story = []
        
        # 1. Header Banner
        story.append(Paragraph("FUTURITY \u2014 REPORTE DE AUDITOR\u00cdA DE CLIENTE", title_style))
        story.append(Paragraph("HISTORIAL CONSOLIDADO DE VISITAS Y SOPORTE DE CALL CENTER", subtitle_style))
        
        # 2. Metadata Block (Customer & Filter details)
        rango_fechas = f"Desde: {desde or 'Inicio'} | Hasta: {hasta or 'Hoy'}"
        fecha_gen = datetime.now().strftime('%d/%m/%Y %H:%M')
        
        meta_data = [
            [
                Paragraph("Contrato:", meta_label_style), Paragraph(f"#{contrato}", meta_val_style),
                Paragraph("Fecha Generaci\u00f3n:", meta_label_style), Paragraph(fecha_gen, meta_val_style)
            ],
            [
                Paragraph("Cliente:", meta_label_style), Paragraph(cliente_nombre, meta_val_style),
                Paragraph("Rango Filtro:", meta_label_style), Paragraph(rango_fechas, meta_val_style)
            ],
            [
                Paragraph("Sector:", meta_label_style), Paragraph(cliente_sector, meta_val_style),
                Paragraph("Direcci\u00f3n:", meta_label_style), Paragraph(cliente_direccion, meta_val_style)
            ]
        ]
        
        meta_table = Table(meta_data, colWidths=[60, 200, 110, 170])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BACKGROUND', (0,0), (-1,-1), bg_light),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.25, border_color),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))
        
        # 3. KPIs Cards
        kpi_data = [
            [
                Paragraph("VISITAS T\u00c9CNICAS REGISTRADAS", kpi_title_style),
                Paragraph("ATENCIONES SOPORTE DIARIO", kpi_title_style),
                Paragraph("CALIFICACI\u00d3N PROM. VISITAS", kpi_title_style)
            ],
            [
                Paragraph(str(total_visitas), kpi_val_style),
                Paragraph(str(total_atenciones), kpi_val_style),
                Paragraph(promedio_estrellas, kpi_val_style)
            ]
        ]
        kpi_table = Table(kpi_data, colWidths=[180, 180, 180])
        kpi_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BACKGROUND', (0,0), (-1,-1), bg_light),
            ('BOX', (0,0), (-1,-1), 1, primary_color),
            ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('BOTTOMPADDING', (0,0), (-1,0), 2),
            ('TOPPADDING', (0,1), (-1,-1), 2),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 15))
        
        # 4. Section 1: Visitas Técnicas
        story.append(Paragraph("1. HISTORIAL DE VISITAS T\u00c9CNICAS (VT)", section_title_style))
        
        visit_col_widths = [65, 125, 95, 65, 190]
        visit_table_data = [[
            Paragraph("Fecha", table_header_style),
            Paragraph("Problema Detectado", table_header_style),
            Paragraph("T\u00e9cnico / Apoyo", table_header_style),
            Paragraph("Estado", table_header_style),
            Paragraph("Soluci\u00f3n / Observaci\u00f3n del T\u00e9cnico", table_header_style)
        ]]
        
        if total_visitas > 0:
            for v in visitas:
                f_val = v['fecha_programada']
                f_str = f_val.strftime('%d/%m/%Y') if isinstance(f_val, (datetime, date)) else str(f_val)
                
                estado_lbl = v['estado']
                if estado_lbl == 'FINALIZADA': estado_lbl = 'Efectiva'
                elif estado_lbl == 'SOLVENTADA_REMOTA': estado_lbl = 'Solv. Remota'
                
                tech_lbl = v['tecnico_principal'] or 'Sin asignar'
                if v['tecnico_apoyo']:
                    tech_lbl += f" / {v['tecnico_apoyo']}"
                    
                sol_lbl = v['solucion_tecnico'] or 'Sin soluci\u00f3n registrada.'
                if v['observacion_tecnico']:
                    sol_lbl += f"\nObs: {v['observacion_tecnico']}"
                if v['calificacion_estrellas']:
                    sol_lbl += f"\nCalificaci\u00f3n: {'★' * v['calificacion_estrellas']} ({v['calificacion_comentario'] or 'Sin comentarios'})"
                    
                sol_paragraph = Paragraph(sol_lbl.replace('\n', '<br/>'), table_cell_style)
                
                visit_table_data.append([
                    Paragraph(f_str, table_cell_bold_style),
                    Paragraph(v['problema'] or '-', table_cell_style),
                    Paragraph(tech_lbl, table_cell_style),
                    Paragraph(estado_lbl, table_cell_bold_style),
                    sol_paragraph
                ])
        else:
            visit_table_data.append([
                Paragraph("No se registraron visitas t\u00e9cnicas en el per\u00edodo seleccionado.", table_cell_italic_style),
                "", "", "", ""
            ])
            
        visit_table = Table(visit_table_data, colWidths=visit_col_widths, repeatRows=1)
        visit_table_style = [
            ('BACKGROUND', (0,0), (-1,0), primary_color),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.25, border_color),
        ]
        if total_visitas == 0:
            visit_table_style.append(('SPAN', (0,1), (4,1)))
        else:
            for idx in range(1, len(visit_table_data)):
                if idx % 2 == 0:
                    visit_table_style.append(('BACKGROUND', (0,idx), (-1,idx), bg_light))
                    
        visit_table.setStyle(TableStyle(visit_table_style))
        story.append(visit_table)
        story.append(Spacer(1, 15))
        
        # 5. Section 2: Atenciones de Soporte
        story.append(Paragraph("2. HISTORIAL DE ATENCIONES DE SOPORTE DIARIO", section_title_style))
        
        aten_col_widths = [85, 110, 70, 95, 180]
        aten_table_data = [[
            Paragraph("Fecha / Hora", table_header_style),
            Paragraph("Solicitud / Motivo", table_header_style),
            Paragraph("Medio / Canal", table_header_style),
            Paragraph("Agente Responsable", table_header_style),
            Paragraph("Acci\u00f3n / Detalle de la Atenci\u00f3n", table_header_style)
        ]]
        
        if total_atenciones > 0:
            for a in atenciones:
                f_val = a['fecha_programada']
                f_str = f_val.strftime('%d/%m/%Y') if isinstance(f_val, (datetime, date)) else str(f_val)
                
                h_str = ""
                if a.get('hora'):
                    h_val = a['hora']
                    if hasattr(h_val, 'strftime'):
                        h_str = h_val.strftime(' %H:%M')
                    elif isinstance(h_val, timedelta):
                        tot_sec = int(h_val.total_seconds())
                        h_str = f" {tot_sec // 3600:02d}:{(tot_sec % 3600) // 60:02d}"
                    else:
                        h_str = f" {str(h_val)[:5]}"
                
                via_lbl = a['tecnico_apoyo'] or 'WhatsApp'
                agent_lbl = a['tecnico_principal'] or 'Call Center'
                sol_lbl = a['solucion_tecnico'] or '-'
                if a['observacion_tecnico']:
                    sol_lbl += f"\nObs: {a['observacion_tecnico']}"
                if a.get('olt'):
                    sol_lbl += f" (OLT: {a['olt']})"
                    
                sol_paragraph = Paragraph(sol_lbl.replace('\n', '<br/>'), table_cell_style)
                
                aten_table_data.append([
                    Paragraph(f_str + h_str, table_cell_bold_style),
                    Paragraph(a['problema'] or '-', table_cell_style),
                    Paragraph(via_lbl, table_cell_style),
                    Paragraph(agent_lbl, table_cell_style),
                    sol_paragraph
                ])
        else:
            aten_table_data.append([
                Paragraph("No se registraron atenciones de soporte en el per\u00edodo seleccionado.", table_cell_italic_style),
                "", "", "", ""
            ])
            
        aten_table = Table(aten_table_data, colWidths=aten_col_widths, repeatRows=1)
        aten_table_style = [
            ('BACKGROUND', (0,0), (-1,0), secondary_color),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('INNERGRID', (0,0), (-1,-1), 0.25, border_color),
        ]
        if total_atenciones == 0:
            aten_table_style.append(('SPAN', (0,1), (4,1)))
        else:
            for idx in range(1, len(aten_table_data)):
                if idx % 2 == 0:
                    aten_table_style.append(('BACKGROUND', (0,idx), (-1,idx), bg_light))
                    
        aten_table.setStyle(TableStyle(aten_table_style))
        story.append(aten_table)
        
        # Build Document
        doc.build(story, canvasmaker=NumberedCanvas)
        pdf_buffer.seek(0)
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"Reporte_Auditoria_{contrato}.pdf"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


def format_datetime_val(dt_val):
    if not dt_val:
        return ""
    if isinstance(dt_val, (datetime, date)):
        return dt_val.strftime('%d/%m/%y %H:%M')
    try:
        dt = datetime.fromisoformat(str(dt_val))
        return dt.strftime('%d/%m/%y %H:%M')
    except:
        return str(dt_val)


def generar_excel_calidad(visitas, fecha_str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Visitas Efectivas"
    
    # Asegurar que se muestre la cuadrícula
    ws.views.sheetView[0].showGridLines = True
    
    headers = [
        "FECHA Y HORA",
        "CONTRATO",
        "CLIENTE",
        "TELÉFONOS",
        "SECTOR",
        "SERVICIO",
        "SOLUCIÓN DEL TÉCNICO",
        "OBSERVACION TECNICO",
        "TÉCNICO/TECNICOS QUE REALIZAN LA ACTIVIDAD",
        "",  # Espacio para el técnico de apoyo (segunda columna)
        "FINALIZACIÓN"
    ]
    
    # Escribir cabecera
    ws.append(headers)
    
    # Combinar celdas de técnico (I1 y J1)
    ws.merge_cells("I1:J1")
    
    # Estilos cabecera
    header_fill = PatternFill(start_color="B4C6E7", end_color="B4C6E7", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    thin_side = Side(style='thin', color='A0A0A0')
    border_style = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    
    for col_idx in range(1, 12):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = border_style
        
    ws.row_dimensions[1].height = 32
    
    # Estilos datos
    data_font = Font(name="Calibri", size=10)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    row_num = 2
    for v in visitas:
        # Formatear fechas de forma segura
        f_reg = format_datetime_val(v.get('fecha_registro'))
        f_fin = format_datetime_val(v.get('hora_fin_visita'))
        
        row_data = [
            f_reg,
            str(v.get('contrato') or ''),
            str(v.get('cliente') or '').upper(),
            str(v.get('telefonos') or ''),
            str(v.get('sector') or '').upper(),
            str(v.get('servicio') or '').upper(),
            str(v.get('solucion_tecnico') or '').upper(),
            str(v.get('observacion_tecnico') or ''),
            str(v.get('tecnico_principal') or '').upper(),
            str(v.get('tecnico_apoyo') or '').upper(),
            f_fin
        ]
        ws.append(row_data)
        
        for col_idx in range(1, 12):
            cell = ws.cell(row=row_num, column=col_idx)
            cell.font = data_font
            cell.border = border_style
            
            # Alineaciones específicas
            if col_idx in [1, 2, 11]:  # Fecha registro, contrato, finalizacion
                cell.alignment = center_align
            else:
                cell.alignment = left_align
                
        ws.row_dimensions[row_num].height = 24
        row_num += 1
        
    # Ajuste automático de anchos de columnas
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            # Omitimos la primera fila para algunas columnas largas en el cálculo para evitar que se ensanchen demasiado
            if cell.row == 1 and col_letter in ['C', 'G', 'H']:
                continue
            if cell.value:
                # Si tiene saltos de línea, consideramos la línea más larga
                lines = str(cell.value).split('\n')
                for line in lines:
                    max_len = max(max_len, len(line))
        
        width = max(max_len + 3, 12)
        # Límites por columna para estética premium
        if col_letter == 'C':  # Cliente
            width = min(width, 35)
        elif col_letter in ['G', 'H']:  # Solución, Observación
            width = min(width, 45)
        elif col_letter == 'D':  # Teléfonos
            width = min(width, 18)
        elif col_letter == 'F':  # Servicio
            width = min(width, 16)
        
        ws.column_dimensions[col_letter].width = width
        
    excel_buffer = BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)
    return excel_buffer


@admin_bp.route('/api/admin/reporte_calidad/preview', methods=['GET'])
def preview_reporte_calidad():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        is_sunday = (fecha_dt.weekday() == 6)
        
        if is_sunday:
            query = """
                SELECT 
                    id_visita, 
                    fecha_registro, 
                    contrato, 
                    cliente, 
                    telefonos, 
                    sector, 
                    servicio, 
                    solucion_tecnico, 
                    observacion_tecnico, 
                    tecnico_principal, 
                    tecnico_apoyo,
                    hora_fin_visita
                FROM visitas_tecnicas
                WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) BETWEEN DATE_SUB(%s, INTERVAL 2 DAY) AND %s AND estado = 'FINALIZADA'
                  AND tecnico_principal IS NOT NULL 
                  AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
                  AND solucion_tecnico IS NOT NULL 
                  AND solucion_tecnico NOT IN (
                      'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                      'SIN RESPUESTA DEL CLIENTE',
                      'GENERAR CAMBIO DE FO',
                      'GENERAR ARREGLO DE INSTALACIÓN',
                      'GESTIONAR ARREGLO DE INSTALACIÓN'
                  )
                ORDER BY COALESCE(DATE(hora_fin_visita), fecha_programada) ASC, hora_fin_visita ASC
            """
            cursor.execute(query, (fecha, fecha))
        else:
            query = """
                SELECT 
                    id_visita, 
                    fecha_registro, 
                    contrato, 
                    cliente, 
                    telefonos, 
                    sector, 
                    servicio, 
                    solucion_tecnico, 
                    observacion_tecnico, 
                    tecnico_principal, 
                    tecnico_apoyo,
                    hora_fin_visita
                FROM visitas_tecnicas
                WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
                  AND tecnico_principal IS NOT NULL 
                  AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
                  AND solucion_tecnico IS NOT NULL 
                  AND solucion_tecnico NOT IN (
                      'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                      'SIN RESPUESTA DEL CLIENTE',
                      'GENERAR CAMBIO DE FO',
                      'GENERAR ARREGLO DE INSTALACIÓN',
                      'GESTIONAR ARREGLO DE INSTALACIÓN'
                  )
                ORDER BY hora_fin_visita ASC
            """
            cursor.execute(query, (fecha,))
        visitas = cursor.fetchall()
        
        # Serializar objetos datetime a formato legible/ISO para JSON
        for v in visitas:
            if v['fecha_registro']:
                v['fecha_registro'] = v['fecha_registro'].isoformat()
            if v['hora_fin_visita']:
                v['hora_fin_visita'] = v['hora_fin_visita'].isoformat()
                
        return jsonify({"status": "ok", "visitas": visitas})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@admin_bp.route('/api/admin/reporte_calidad/excel', methods=['GET'])
def download_excel_reporte_calidad():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        is_sunday = (fecha_dt.weekday() == 6)
        
        if is_sunday:
            query = """
                SELECT 
                    fecha_registro, 
                    contrato, 
                    cliente, 
                    telefonos, 
                    sector, 
                    servicio, 
                    solucion_tecnico, 
                    observacion_tecnico, 
                    tecnico_principal, 
                    tecnico_apoyo,
                    hora_fin_visita
                FROM visitas_tecnicas
                WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) BETWEEN DATE_SUB(%s, INTERVAL 2 DAY) AND %s AND estado = 'FINALIZADA'
                  AND tecnico_principal IS NOT NULL 
                  AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
                  AND solucion_tecnico IS NOT NULL 
                  AND solucion_tecnico NOT IN (
                      'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                      'SIN RESPUESTA DEL CLIENTE',
                      'GENERAR CAMBIO DE FO',
                      'GENERAR ARREGLO DE INSTALACIÓN',
                      'GESTIONAR ARREGLO DE INSTALACIÓN'
                  )
                ORDER BY COALESCE(DATE(hora_fin_visita), fecha_programada) ASC, hora_fin_visita ASC
            """
            cursor.execute(query, (fecha, fecha))
        else:
            query = """
                SELECT 
                    fecha_registro, 
                    contrato, 
                    cliente, 
                    telefonos, 
                    sector, 
                    servicio, 
                    solucion_tecnico, 
                    observacion_tecnico, 
                    tecnico_principal, 
                    tecnico_apoyo,
                    hora_fin_visita
                FROM visitas_tecnicas
                WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
                  AND tecnico_principal IS NOT NULL 
                  AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
                  AND solucion_tecnico IS NOT NULL 
                  AND solucion_tecnico NOT IN (
                      'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                      'SIN RESPUESTA DEL CLIENTE',
                      'GENERAR CAMBIO DE FO',
                      'GENERAR ARREGLO DE INSTALACIÓN',
                      'GESTIONAR ARREGLO DE INSTALACIÓN'
                  )
                ORDER BY hora_fin_visita ASC
            """
            cursor.execute(query, (fecha,))
        visitas = cursor.fetchall()
        cursor.close()
        conexion.close()
        
        excel_buffer = generar_excel_calidad(visitas, fecha)
        filename = f"Reporte_Visitas_Efectivas_{fecha}.xlsx"
        
        return send_file(
            excel_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def format_tec_short(name):
    if not name or name.upper() in ["NO TECNICO", "SIN ASIGNAR", "NONE", "NAN", ""]:
        return "Sin asignar"
    parts = [p.strip() for p in name.split('/')]
    formatted_parts = []
    for p in parts:
        words = p.split()
        if len(words) >= 2:
            formatted_parts.append(f"{words[0].capitalize()} {words[1][0].upper()}.")
        elif len(words) == 1:
            formatted_parts.append(words[0].capitalize())
        else:
            formatted_parts.append(p)
    return " / ".join(formatted_parts)


def generar_excel_actividades(grouped, fecha_str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resumen de Actividades"
    
    ws.views.sheetView[0].showGridLines = True
    
    headers = ["TÉCNICO", "ACTIVIDAD", "CANTIDAD", "TOTAL"]
    ws.append(headers)
    
    # Peach fill (#FCE4D6)
    header_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    thin_side = Side(style='thin', color='A0A0A0')
    border_style = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    
    for col_idx in range(1, 5):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = border_style
        
    ws.row_dimensions[1].height = 28
    
    data_font = Font(name="Calibri", size=10)
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    
    row_num = 2
    for tec, info in grouped.items():
        start_row = row_num
        activities = info['actividades']
        total = info['total']
        
        for act in activities:
            ws.append([
                tec,
                act['actividad'],
                act['cantidad'],
                total
            ])
            
            for col_idx in range(1, 5):
                cell = ws.cell(row=row_num, column=col_idx)
                cell.font = data_font
                cell.border = border_style
                
                if col_idx in [1, 3, 4]:
                    cell.alignment = center_align
                else:
                    cell.alignment = left_align
                    
            ws.row_dimensions[row_num].height = 22
            row_num += 1
            
        end_row = row_num - 1
        if start_row < end_row:
            ws.merge_cells(start_row=start_row, start_column=1, end_row=end_row, end_column=1)
            ws.merge_cells(start_row=start_row, start_column=4, end_row=end_row, end_column=4)
            
    ws.column_dimensions['A'].width = 25  # Técnico
    ws.column_dimensions['B'].width = 45  # Actividad
    ws.column_dimensions['C'].width = 12  # Cantidad
    ws.column_dimensions['D'].width = 12  # Total
    
    excel_buffer = BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)
    return excel_buffer


@admin_bp.route('/api/admin/reporte_actividades/preview', methods=['GET'])
def preview_reporte_actividades():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        query = """
            SELECT 
                tecnico_principal,
                tecnico_apoyo,
                solucion_tecnico,
                COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE',
                  'GENERAR CAMBIO DE FO',
                  'GENERAR ARREGLO DE INSTALACIÓN',
                  'GESTIONAR ARREGLO DE INSTALACIÓN'
              )
            GROUP BY tecnico_principal, tecnico_apoyo, solucion_tecnico
            ORDER BY tecnico_principal, tecnico_apoyo, cantidad DESC
        """
        cursor.execute(query, (fecha,))
        rows = cursor.fetchall()
        cursor.close()
        conexion.close()
        
        from collections import OrderedDict
        grouped = OrderedDict()
        
        for r in rows:
            tec_p = r['tecnico_principal']
            tec_a = r['tecnico_apoyo']
            actividad = r['solucion_tecnico']
            cantidad = r['cantidad']
            
            disp_name = format_tec_short(tec_p)
            if tec_a and tec_a.upper() not in ["NO TECNICO", "SIN ASIGNAR", "NONE", "NAN", ""]:
                disp_name += " / " + format_tec_short(tec_a)
                
            if disp_name == "Sin asignar":
                continue
                
            if disp_name not in grouped:
                grouped[disp_name] = {
                    "tecnico": disp_name,
                    "actividades": [],
                    "total": 0
                }
                
            grouped[disp_name]["actividades"].append({
                "actividad": str(actividad or '').upper(),
                "cantidad": cantidad
            })
            grouped[disp_name]["total"] += cantidad
            
        return jsonify({"status": "ok", "reporte": list(grouped.values())})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route('/api/admin/reporte_actividades/excel', methods=['GET'])
def download_excel_reporte_actividades():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        query = """
            SELECT 
                tecnico_principal,
                tecnico_apoyo,
                solucion_tecnico,
                COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE',
                  'GENERAR CAMBIO DE FO',
                  'GENERAR ARREGLO DE INSTALACIÓN',
                  'GESTIONAR ARREGLO DE INSTALACIÓN'
              )
            GROUP BY tecnico_principal, tecnico_apoyo, solucion_tecnico
            ORDER BY tecnico_principal, tecnico_apoyo, cantidad DESC
        """
        cursor.execute(query, (fecha,))
        rows = cursor.fetchall()
        cursor.close()
        conexion.close()
        
        from collections import OrderedDict
        grouped = OrderedDict()
        
        for r in rows:
            tec_p = r['tecnico_principal']
            tec_a = r['tecnico_apoyo']
            actividad = r['solucion_tecnico']
            cantidad = r['cantidad']
            
            disp_name = format_tec_short(tec_p)
            if tec_a and tec_a.upper() not in ["NO TECNICO", "SIN ASIGNAR", "NONE", "NAN", ""]:
                disp_name += " / " + format_tec_short(tec_a)
                
            if disp_name == "Sin asignar":
                continue
                
            if disp_name not in grouped:
                grouped[disp_name] = {
                    "actividades": [],
                    "total": 0
                }
                
            grouped[disp_name]["actividades"].append({
                "actividad": str(actividad or '').upper(),
                "cantidad": cantidad
            })
            grouped[disp_name]["total"] += cantidad
            
        excel_buffer = generar_excel_actividades(grouped, fecha)
        filename = f"Reporte_Actividades_Tecnicos_{fecha}.xlsx"
        
        return send_file(
            excel_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def format_datetime_dia_siguiente(dt_val):
    if not dt_val:
        return ""
    if isinstance(dt_val, (datetime, date)):
        dt = dt_val
    else:
        try:
            dt = datetime.fromisoformat(str(dt_val))
        except:
            return str(dt_val)
            
    d = dt.day
    m = dt.month
    y = dt.year
    if isinstance(dt, datetime):
        h = dt.hour
        mi = dt.minute
        s = dt.second
        return f"{d}/{m}/{y} {h:02d}:{mi:02d}:{s:02d}"
    else:
        return f"{d}/{m}/{y}"


def generar_excel_dia_siguiente(visitas, grupo_reagendadas_len, grupo_hoy_len, fecha_str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Visitas Siguiente Día"
    
    ws.views.sheetView[0].showGridLines = True
    
    headers = [
        "HORA DE ASIGNACIÓN",
        "NOMBRE",
        "SECTOR",
        "PROBLEMA",
        "OBSERVACIÓN"
    ]
    
    ws.append(headers)
    
    header_fill = PatternFill(start_color="C6E0B4", end_color="C6E0B4", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    thin_side = Side(style='thin', color='A0A0A0')
    border_style = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    
    for col_idx in range(1, 6):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = border_style
        
    ws.row_dimensions[1].height = 28
    
    data_font = Font(name="Calibri", size=10)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    row_num = 2
    for v in visitas:
        f_reg = format_datetime_dia_siguiente(v.get('fecha_registro'))
        row_data = [
            f_reg,
            str(v.get('cliente') or '').upper(),
            str(v.get('sector') or '').upper(),
            str(v.get('problema') or '').upper(),
            ""
        ]
        ws.append(row_data)
        
        for col_idx in range(1, 6):
            cell = ws.cell(row=row_num, column=col_idx)
            cell.font = data_font
            cell.border = border_style
            if col_idx in [1, 5]:
                cell.alignment = center_align
            else:
                cell.alignment = left_align
        
        ws.row_dimensions[row_num].height = 22
        row_num += 1
        
    if grupo_reagendadas_len > 0:
        start_row = 2
        end_row = 2 + grupo_reagendadas_len - 1
        ws.merge_cells(start_row=start_row, start_column=5, end_row=end_row, end_column=5)
        top_cell = ws.cell(row=start_row, column=5)
        top_cell.value = "VISITAS REAGENDADAS Y COORDINADAS DÍAS ANTERIORES"
        top_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        top_cell.font = Font(name="Calibri", size=10, bold=True)
        
    if grupo_hoy_len > 0:
        start_row = 2 + grupo_reagendadas_len
        end_row = 2 + grupo_reagendadas_len + grupo_hoy_len - 1
        ws.merge_cells(start_row=start_row, start_column=5, end_row=end_row, end_column=5)
        top_cell = ws.cell(row=start_row, column=5)
        top_cell.value = "VISITAS GENERADAS EL DÍA DE HOY"
        top_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        top_cell.font = Font(name="Calibri", size=10, bold=True)

    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            if cell.row == 1:
                continue
            if cell.value:
                lines = str(cell.value).split('\n')
                for line in lines:
                    max_len = max(max_len, len(line))
        width = max(max_len + 3, 12)
        if col_letter == 'A':
            width = 22
        elif col_letter == 'B':
            width = min(width, 35)
        elif col_letter == 'C':
            width = min(width, 22)
        elif col_letter == 'D':
            width = min(width, 28)
        elif col_letter == 'E':
            width = 22
            
        ws.column_dimensions[col_letter].width = width

    excel_buffer = BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)
    return excel_buffer


@admin_bp.route('/api/admin/reporte_dia_siguiente/preview', methods=['GET'])
def preview_reporte_dia_siguiente():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        target_date = fecha_dt + timedelta(days=1)
        
        cursor = conexion.cursor(dictionary=True)
        query = """
            SELECT 
                id_visita,
                fecha_registro,
                cliente,
                sector,
                problema,
                estado
            FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA', 'FINALIZADA')
        """
        cursor.execute(query, (target_date,))
        rows = cursor.fetchall()
        
        grupo_reagendadas = []
        grupo_hoy = []
        
        for v in rows:
            f_reg = v.get('fecha_registro')
            is_hoy = False
            if f_reg:
                if isinstance(f_reg, datetime):
                    reg_date = f_reg.date()
                elif isinstance(f_reg, date):
                    reg_date = f_reg
                else:
                    try:
                        reg_date = datetime.strptime(str(f_reg)[:10], "%Y-%m-%d").date()
                    except:
                        reg_date = None
                
                if reg_date == fecha_dt:
                    is_hoy = True
            
            if is_hoy:
                v['grupo'] = 'HOY'
                grupo_hoy.append(v)
            else:
                v['grupo'] = 'REAGENDADAS'
                grupo_reagendadas.append(v)
                
        def get_reg_time(v):
            f_reg = v.get('fecha_registro')
            if isinstance(f_reg, datetime):
                return f_reg
            if isinstance(f_reg, date):
                return datetime.combine(f_reg, datetime.min.time())
            if f_reg:
                try:
                    return datetime.strptime(str(f_reg), "%Y-%m-%d %H:%M:%S")
                except:
                    pass
            return datetime.min

        grupo_reagendadas.sort(key=get_reg_time)
        grupo_hoy.sort(key=get_reg_time)
        
        visitas_final = grupo_reagendadas + grupo_hoy
        
        for v in visitas_final:
            if v['fecha_registro'] and isinstance(v['fecha_registro'], (datetime, date)):
                v['fecha_registro'] = v['fecha_registro'].isoformat()
                
        return jsonify({"status": "ok", "visitas": visitas_final})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@admin_bp.route('/api/admin/reporte_dia_siguiente/excel', methods=['GET'])
def download_excel_reporte_dia_siguiente():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        target_date = fecha_dt + timedelta(days=1)
        
        cursor = conexion.cursor(dictionary=True)
        query = """
            SELECT 
                fecha_registro,
                cliente,
                sector,
                problema,
                estado
            FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('CANCELADA', 'SOLVENTADA_REMOTA', 'FINALIZADA')
        """
        cursor.execute(query, (target_date,))
        rows = cursor.fetchall()
        cursor.close()
        conexion.close()
        
        grupo_reagendadas = []
        grupo_hoy = []
        
        for v in rows:
            f_reg = v.get('fecha_registro')
            is_hoy = False
            if f_reg:
                if isinstance(f_reg, datetime):
                    reg_date = f_reg.date()
                elif isinstance(f_reg, date):
                    reg_date = f_reg
                else:
                    try:
                        reg_date = datetime.strptime(str(f_reg)[:10], "%Y-%m-%d").date()
                    except:
                        reg_date = None
                
                if reg_date == fecha_dt:
                    is_hoy = True
            
            if is_hoy:
                v['grupo'] = 'HOY'
                grupo_hoy.append(v)
            else:
                v['grupo'] = 'REAGENDADAS'
                grupo_reagendadas.append(v)
                
        def get_reg_time(v):
            f_reg = v.get('fecha_registro')
            if isinstance(f_reg, datetime):
                return f_reg
            if isinstance(f_reg, date):
                return datetime.combine(f_reg, datetime.min.time())
            if f_reg:
                try:
                    return datetime.strptime(str(f_reg), "%Y-%m-%d %H:%M:%S")
                except:
                    pass
            return datetime.min

        grupo_reagendadas.sort(key=get_reg_time)
        grupo_hoy.sort(key=get_reg_time)
        
        visitas_final = grupo_reagendadas + grupo_hoy
        
        excel_buffer = generar_excel_dia_siguiente(
            visitas_final, 
            len(grupo_reagendadas), 
            len(grupo_hoy), 
            fecha
        )
        filename = f"Reporte_Visitas_Dia_Siguiente_{fecha}.xlsx"
        
        return send_file(
            excel_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def map_solucion(sol):
    if not sol:
        return "INSPECCIÓN / SOLUCIÓN PARCIAL"
    sol = sol.upper().strip()
    if "CAMBIO DE FIBRA" in sol or "CAMBIO DE FO" in sol:
        return "CAMBIO DE FIBRA REALIZADO"
    if "GESTIONAR ARREGLO" in sol or "COORDINA" in sol or "TICKET AL NOC" in sol:
        return "SE COORDINA CAMBIO DE UTP / FIBRA"
    if "CABLE RG6 / UTP" in sol or "CAMBIO DE CABLE" in sol or "RG6" in sol or "RJ45" in sol:
        return "CAMBIO DE CABLE UTP / RG6"
    if "CONECTORES" in sol or "CONECTOR" in sol:
        return "FISICO / CAMBIO DE CONECTORES APC-UPC O RG6"
    if "CAMBIO DE EQUIPO ONT" in sol or "CAMBIO DE ONU" in sol:
        return "FISICO / CAMBIO DE ONU EN MAL ESTADO"
    if "CONF. DE EQUIPOS" in sol or "CONFIGURACIÓN" in sol or "CONF. DE EQUIPO" in sol:
        return "LÓGICO / CONFIGURACIÓN DE EQUIPOS"
    if "INSPECCIÓN" in sol or "SOLUCIÓN PARCIAL" in sol:
        return "INSPECCIÓN / SOLUCIÓN PARCIAL"
    if "RADIO ENLACE" in sol or "DOMÓTICA" in sol:
        return "RADIO ENLACE / DOMÓTICA"
    if "ADAPTADOR" in sol or "CONEXIÓN ELÉCTRICA" in sol:
        return "FISICO / CAMBIO DE ADAPTADOR DE CORRIENTE"
    if "ARREGLO DE INSTALACIÓN" in sol or "REUBICACION" in sol or "RETENCIÓN" in sol or "REVISION COMPLETA" in sol or "RETIRO DE EQUIPOS" in sol:
        return "ARREGLO DE INSTALACIÓN / REUBICACIÓN DE EQUIPOS / RETENCIÓN"
    if "EFECTIVA" in sol or "ROUTER" in sol:
        return "INSTALACIÓN EFECTIVA / CAMBIO DE ROUTER"
    return "INSPECCIÓN / SOLUCIÓN PARCIAL"


def map_problema(prob):
    if not prob:
        return "VERIFICAR INSTACION"
    prob = prob.upper().strip()
    if "CAMBIO DE FIBRA" in prob or "CAMBIO DE FO" in prob or "CAMBIOS DE FIBRA" in prob:
        return "CAMBIOS DE FIBRA A REALIZAR"
    if "VERIFICAR INSTACION" in prob or "VERIFICAR INSTALACIÓN" in prob or "VERIFICAR INSTALACION" in prob:
        return "VERIFICAR INSTACION"
    if "ALARMADO" in prob or "LOS" in prob:
        return "EQUIPOS ALARMADOS"
    if "REVISION DE ONT" in prob or "REVISIÓN DE ONT" in prob:
        return "REVISION DE ONT"
    if "LENTITUD" in prob:
        return "LENTITUD EN EL SERVICIO"
    if "REVISION DE SERVICIO" in prob or "COBERTURA" in prob:
        return "REVISION DE SERVICIO/COBERTURA"
    if "ACTUALIZACION" in prob or "ROUTER" in prob or "EQUIPOS" in prob or "COLOCACIÓN ROUTER" in prob or "CONF." in prob:
        return "ACTUALIZACIÓN DE EQUIPO / COLOCACIÓN ROUTER"
    if "VELOCIDAD" in prob:
        return "NO MARCA VELOCIDAD CONTRATADA"
    if "REUBICACION" in prob or "REUBICACIÓN" in prob:
        return "REUBICACION DE EQUIPOS"
    if "COBRADA" in prob or "MANIPULACIÓN" in prob or "MANIPULACION" in prob:
        return "VT COBRADA / MANIPULACION DEL CLI"
    if "STREAMING" in prob or "ZAPPING" in prob or "ACTIVAR" in prob:
        return "ACTIVAR STREAMING"
    if "CANALES" in prob or "BORROSOS" in prob:
        return "CANALES BORROSOS"
    if "POTENCIA" in prob or "GPON" in prob:
        return "POTENCIA DEGRADADA (GPON)"
    if "RETENCION" in prob or "RETENCIÓN" in prob:
        return "RETENCIÓN"
    return "VERIFICAR INSTACION"


@admin_bp.route('/api/admin/cuadro_mando/preview', methods=['GET'])
def preview_cuadro_mando():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    fecha = request.args.get('fecha', date.today().isoformat())
    
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        # 1. Obtener la lista de agentes de callcenter activos
        cursor.execute("SELECT nombre FROM callcenter WHERE activo = 1 ORDER BY nombre ASC")
        agentes_list = [row['nombre'] for row in cursor.fetchall()]
        
        # 2. Intentar auto-detectar los 3 agentes más activos en esta fecha
        cursor.execute("""
            SELECT agente, COUNT(*) as c 
            FROM atenciones 
            WHERE fecha = %s AND agente IS NOT NULL AND agente != '' AND agente != 'Importado'
            GROUP BY agente 
            ORDER BY c DESC 
            LIMIT 3
        """, (fecha,))
        detected_rows = cursor.fetchall()
        detected_agentes = [r['agente'] for r in detected_rows]
        
        # Rellenar con valores por defecto si no hay suficientes agentes
        default_agents = ['CC. Luis Saenz', 'CC. Guissella Quezada', 'CC. Mateo Samaniego']
        for default in default_agents:
            if len(detected_agentes) >= 3:
                break
            if default not in detected_agentes:
                detected_agentes.append(default)
        
        # Asegurar longitud 3
        while len(detected_agentes) < 3:
            detected_agentes.append('Sin asignar')
            
        agente_a = request.args.get('agente_a', detected_agentes[0])
        agente_b = request.args.get('agente_b', detected_agentes[1])
        agente_c = request.args.get('agente_c', detected_agentes[2])
        
        agentes = [agente_a, agente_b, agente_c]
        
        # 3. Contar gestiones por agente y categoría
        atenciones_data = {
            'visitas_coordinadas': [0, 0, 0],
            'solventado_llamada': [0, 0, 0],
            'solventado_mensajes': [0, 0, 0],
            'solventado_oficina': [0, 0, 0],
            'otros': [0, 0, 0]
        }
        
        for i, ag in enumerate(agentes):
            if not ag or ag == 'Sin asignar':
                continue
            # Visitas Coordinadas
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA')
            """, (fecha, ag))
            atenciones_data['visitas_coordinadas'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado por Llamada
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion = 'SOPORTE MEDIANTE LLAMADA'
            """, (fecha, ag))
            atenciones_data['solventado_llamada'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado por Mensajes
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion = 'SOPORTE MEDIANTE MENSAJES'
            """, (fecha, ag))
            atenciones_data['solventado_mensajes'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado en Oficina
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND medio_contacto = 'OFICINA'
                  AND (accion NOT IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA') OR accion IS NULL)
            """, (fecha, ag))
            atenciones_data['solventado_oficina'][i] = cursor.fetchone()['total'] or 0
            
            # Info / Transferencia / Otros
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s 
                  AND (accion NOT IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA', 'SOPORTE MEDIANTE LLAMADA', 'SOPORTE MEDIANTE MENSAJES') OR accion IS NULL)
                  AND (medio_contacto != 'OFICINA' OR medio_contacto IS NULL)
            """, (fecha, ag))
            atenciones_data['otros'][i] = cursor.fetchone()['total'] or 0
            
        # 4. KPIs de Visitas Técnicas de Campo (derecha)
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada < %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA', 'REAGENDADA')
        """, (fecha,))
        kpi_pendientes_anteriores = cursor.fetchone()['total'] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE DATE(fecha_registro) = %s
        """, (fecha,))
        kpi_generadas_hoy = cursor.fetchone()['total'] or 0
        
        kpi_total_carga = kpi_pendientes_anteriores + kpi_generadas_hoy
        
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE',
                  'GENERAR CAMBIO DE FO',
                  'GENERAR ARREGLO DE INSTALACIÓN',
                  'GESTIONAR ARREGLO DE INSTALACIÓN'
              )
        """, (fecha,))
        kpi_atendidas_hoy = cursor.fetchone()['total'] or 0
        
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        manana = (fecha_dt + timedelta(days=1)).isoformat()
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
        """, (manana,))
        kpi_pendientes_manana = cursor.fetchone()['total'] or 0
        
        # 5. Listados de problemas / soluciones
        cursor.execute("""
            SELECT solucion_tecnico, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE',
                  'GENERAR CAMBIO DE FO',
                  'GENERAR ARREGLO DE INSTALACIÓN',
                  'GESTIONAR ARREGLO DE INSTALACIÓN'
              )
            GROUP BY solucion_tecnico
        """, (fecha,))
        soluciones_rows = cursor.fetchall()
        
        soluciones_dict = {
            "CAMBIO DE FIBRA REALIZADO": 0,
            "SE COORDINA CAMBIO DE UTP / FIBRA": 0,
            "CAMBIO DE CABLE UTP / RG6": 0,
            "FISICO / CAMBIO DE CONECTORES APC-UPC O RG6": 0,
            "FISICO / CAMBIO DE ONU EN MAL ESTADO": 0,
            "LÓGICO / CONFIGURACIÓN DE EQUIPOS": 0,
            "INSPECCIÓN / SOLUCIÓN PARCIAL": 0,
            "RADIO ENLACE / DOMÓTICA": 0,
            "FISICO / CAMBIO DE ADAPTADOR DE CORRIENTE": 0,
            "ARREGLO DE INSTALACIÓN / REUBICACIÓN DE EQUIPOS / RETENCIÓN": 0,
            "INSTALACIÓN EFECTIVA / CAMBIO DE ROUTER": 0,
            "TICKET A TECNOLOGÍA, DAÑO RADIAL": 0,
            "TICKET A TECNOLOGÍA, DAÑO FTTH": 0,
            "TICKET A TECNOLOGÍA, DAÑO HFC": 0
        }
        
        for r in soluciones_rows:
            mapped = map_solucion(r['solucion_tecnico'])
            if mapped in soluciones_dict:
                soluciones_dict[mapped] += r['cantidad']
                
        cursor.execute("""
            SELECT problema, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
              AND problema IS NOT NULL AND problema != ''
            GROUP BY problema
        """, (manana,))
        problemas_rows = cursor.fetchall()
        
        problemas_dict = {
            "CAMBIOS DE FIBRA A REALIZAR": 0,
            "VERIFICAR INSTACION": 0,
            "EQUIPOS ALARMADOS": 0,
            "REVISION DE ONT": 0,
            "LENTITUD EN EL SERVICIO": 0,
            "REVISION DE SERVICIO/COBERTURA": 0,
            "ACTUALIZACIÓN DE EQUIPO / COLOCACIÓN ROUTER": 0,
            "NO MARCA VELOCIDAD CONTRATADA": 0,
            "REUBICACION DE EQUIPOS": 0,
            "VT COBRADA / MANIPULACION DEL CLI": 0,
            "ACTIVAR STREAMING": 0,
            "CANALES BORROSOS": 0,
            "POTENCIA DEGRADADA (GPON)": 0,
            "RETENCIÓN": 0
        }
        
        for r in problemas_rows:
            mapped = map_problema(r['problema'])
            if mapped in problemas_dict:
                problemas_dict[mapped] += r['cantidad']
                
        return jsonify({
            "status": "ok",
            "fecha": fecha,
            "agentes_list": agentes_list,
            "agente_a": agente_a,
            "agente_b": agente_b,
            "agente_c": agente_c,
            "atenciones": atenciones_data,
            "kpis": {
                "pendientes_anteriores": kpi_pendientes_anteriores,
                "generadas_hoy": kpi_generadas_hoy,
                "total_carga": kpi_total_carga,
                "atendidas_hoy": kpi_atendidas_hoy,
                "pendientes_manana": kpi_pendientes_manana
            },
            "soluciones": soluciones_dict,
            "problemas": problemas_dict
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@admin_bp.route('/api/admin/cuadro_mando/excel', methods=['POST'])
def download_excel_cuadro_mando():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
        
    data = request.get_json() or {}
    fecha = data.get('fecha', date.today().isoformat())
    
    agente_a = data.get('agente_a', 'CC. Luis Saenz')
    agente_b = data.get('agente_b', 'CC. Guissella Quezada')
    agente_c = data.get('agente_c', 'CC. Mateo Samaniego')
    
    horario_a = data.get('horario_a', '7 AM - 4 PM')
    horario_b = data.get('horario_b', '2 PM - 9 PM')
    horario_c = data.get('horario_c', '10 AM - 8 PM')
    
    try:
        soporte_a = int(data.get('soporte_a', 0))
    except:
        soporte_a = 0
        
    try:
        soporte_b = int(data.get('soporte_b', 0))
    except:
        soporte_b = 0
        
    try:
        soporte_c = int(data.get('soporte_c', 0))
    except:
        soporte_c = 0
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        # 1. Contar gestiones por agente y categoría
        agentes = [agente_a, agente_b, agente_c]
        atenciones_data = {
            'visitas_coordinadas': [0, 0, 0],
            'solventado_llamada': [0, 0, 0],
            'solventado_mensajes': [0, 0, 0],
            'solventado_oficina': [0, 0, 0],
            'otros': [0, 0, 0]
        }
        
        for i, ag in enumerate(agentes):
            if not ag or ag == 'Sin asignar':
                continue
            # Visitas Coordinadas
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA')
            """, (fecha, ag))
            atenciones_data['visitas_coordinadas'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado por Llamada
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion = 'SOPORTE MEDIANTE LLAMADA'
            """, (fecha, ag))
            atenciones_data['solventado_llamada'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado por Mensajes
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND accion = 'SOPORTE MEDIANTE MENSAJES'
            """, (fecha, ag))
            atenciones_data['solventado_mensajes'][i] = cursor.fetchone()['total'] or 0
            
            # Solventado en Oficina
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s AND medio_contacto = 'OFICINA'
                  AND (accion NOT IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA') OR accion IS NULL)
            """, (fecha, ag))
            atenciones_data['solventado_oficina'][i] = cursor.fetchone()['total'] or 0
            
            # Info / Transferencia / Otros
            cursor.execute("""
                SELECT COUNT(*) as total FROM atenciones 
                WHERE fecha = %s AND agente = %s 
                  AND (accion NOT IN ('VISITA TECNICA', 'VISITA TECNICA COBRADA', 'SOPORTE MEDIANTE LLAMADA', 'SOPORTE MEDIANTE MENSAJES') OR accion IS NULL)
                  AND (medio_contacto != 'OFICINA' OR medio_contacto IS NULL)
            """, (fecha, ag))
            atenciones_data['otros'][i] = cursor.fetchone()['total'] or 0
            
        # 2. KPIs de Visitas Técnicas de Campo
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada < %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA', 'REAGENDADA')
        """, (fecha,))
        kpi_pendientes_anteriores = cursor.fetchone()['total'] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE DATE(fecha_registro) = %s
        """, (fecha,))
        kpi_generadas_hoy = cursor.fetchone()['total'] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE',
                  'GENERAR CAMBIO DE FO',
                  'GENERAR ARREGLO DE INSTALACIÓN',
                  'GESTIONAR ARREGLO DE INSTALACIÓN'
              )
        """, (fecha,))
        kpi_atendidas_hoy = cursor.fetchone()['total'] or 0
        
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
        manana = (fecha_dt + timedelta(days=1)).isoformat()
        cursor.execute("""
            SELECT COUNT(*) as total FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
        """, (manana,))
        kpi_pendientes_manana = cursor.fetchone()['total'] or 0
        
        # Listados de problemas / soluciones
        cursor.execute("""
            SELECT solucion_tecnico, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE COALESCE(DATE(hora_fin_visita), fecha_programada) = %s AND estado = 'FINALIZADA'
              AND tecnico_principal IS NOT NULL 
              AND tecnico_principal NOT IN ('', 'NO TECNICO', 'SIN ASIGNAR', 'NONE', 'NAN')
              AND solucion_tecnico IS NOT NULL 
              AND solucion_tecnico NOT IN (
                  'NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA', 
                  'SIN RESPUESTA DEL CLIENTE',
                  'GENERAR CAMBIO DE FO',
                  'GENERAR ARREGLO DE INSTALACIÓN',
                  'GESTIONAR ARREGLO DE INSTALACIÓN'
              )
            GROUP BY solucion_tecnico
        """, (fecha,))
        soluciones_rows = cursor.fetchall()
        
        soluciones_dict = {
            "CAMBIO DE FIBRA REALIZADO": 0,
            "SE COORDINA CAMBIO DE UTP / FIBRA": 0,
            "CAMBIO DE CABLE UTP / RG6": 0,
            "FISICO / CAMBIO DE CONECTORES APC-UPC O RG6": 0,
            "FISICO / CAMBIO DE ONU EN MAL ESTADO": 0,
            "LÓGICO / CONFIGURACIÓN DE EQUIPOS": 0,
            "INSPECCIÓN / SOLUCIÓN PARCIAL": 0,
            "RADIO ENLACE / DOMÓTICA": 0,
            "FISICO / CAMBIO DE ADAPTADOR DE CORRIENTE": 0,
            "ARREGLO DE INSTALACIÓN / REUBICACIÓN DE EQUIPOS / RETENCIÓN": 0,
            "INSTALACIÓN EFECTIVA / CAMBIO DE ROUTER": 0,
            "TICKET A TECNOLOGÍA, DAÑO RADIAL": 0,
            "TICKET A TECNOLOGÍA, DAÑO FTTH": 0,
            "TICKET A TECNOLOGÍA, DAÑO HFC": 0
        }
        
        for r in soluciones_rows:
            mapped = map_solucion(r['solucion_tecnico'])
            if mapped in soluciones_dict:
                soluciones_dict[mapped] += r['cantidad']
                
        cursor.execute("""
            SELECT problema, COUNT(*) as cantidad
            FROM visitas_tecnicas
            WHERE fecha_programada = %s AND estado NOT IN ('FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA')
              AND problema IS NOT NULL AND problema != ''
            GROUP BY problema
        """, (manana,))
        problemas_rows = cursor.fetchall()
        
        problemas_dict = {
            "CAMBIOS DE FIBRA A REALIZAR": 0,
            "VERIFICAR INSTACION": 0,
            "EQUIPOS ALARMADOS": 0,
            "REVISION DE ONT": 0,
            "LENTITUD EN EL SERVICIO": 0,
            "REVISION DE SERVICIO/COBERTURA": 0,
            "ACTUALIZACIÓN DE EQUIPO / COLOCACIÓN ROUTER": 0,
            "NO MARCA VELOCIDAD CONTRATADA": 0,
            "REUBICACION DE EQUIPOS": 0,
            "VT COBRADA / MANIPULACION DEL CLI": 0,
            "ACTIVAR STREAMING": 0,
            "CANALES BORROSOS": 0,
            "POTENCIA DEGRADADA (GPON)": 0,
            "RETENCIÓN": 0
        }
        
        for r in problemas_rows:
            mapped = map_problema(r['problema'])
            if mapped in problemas_dict:
                problemas_dict[mapped] += r['cantidad']
                
        # 3. GENERAR EL EXCEL CON OPENPYXL
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Cuadro de Mando Diario"
        ws.views.sheetView[0].showGridLines = True
        
        # Anchos de columna
        ws.column_dimensions['A'].width = 35
        ws.column_dimensions['B'].width = 22
        ws.column_dimensions['C'].width = 22
        ws.column_dimensions['D'].width = 22
        ws.column_dimensions['E'].width = 26
        ws.column_dimensions['F'].width = 28
        ws.column_dimensions['G'].width = 12
        ws.column_dimensions['H'].width = 28
        ws.column_dimensions['I'].width = 12
        
        # Fills y Fonts
        fill_hdr_dark = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
        fill_lbl_purple = PatternFill(start_color="8064A2", end_color="8064A2", fill_type="solid")
        fill_agent_a = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
        fill_agent_b = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
        fill_agent_c = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
        fill_total_cc = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
        fill_total_row = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
        
        fill_vis_attended = PatternFill(start_color="BDD7EE", end_color="BDD7EE", fill_type="solid")
        fill_vis_pending = PatternFill(start_color="C6E0B4", end_color="C6E0B4", fill_type="solid")
        fill_sol_hdr = PatternFill(start_color="DDEBF7", end_color="DDEBF7", fill_type="solid")
        fill_prob_hdr = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
        
        font_white_bold = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        font_black_bold = Font(name="Calibri", size=10, bold=True, color="000000")
        font_regular = Font(name="Calibri", size=10, color="000000")
        font_large_bold = Font(name="Calibri", size=16, bold=True, color="000000")
        font_title_white = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        
        align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
        
        thin_side = Side(style='thin', color='A0A0A0')
        border_all = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        
        # Fila 1: Títulos generales
        ws.merge_cells("B1:E1")
        ws.cell(row=1, column=2, value="ATENCIONES DIARIAS POR CALL CENTER")
        ws.merge_cells("F1:I1")
        ws.cell(row=1, column=6, value="VISITAS TÉCNICAS REALIZADAS POR EL TÉCNICO OPERADOR DE CAMPO")
        
        for c in range(2, 10):
            cell = ws.cell(row=1, column=c)
            cell.fill = fill_hdr_dark
            cell.font = font_title_white
            cell.alignment = align_center
            cell.border = border_all
        ws.row_dimensions[1].height = 28
        
        # Fila 2: Sub-títulos / Horarios
        ws.cell(row=2, column=1, value="HORARIO").fill = fill_lbl_purple
        ws.cell(row=2, column=1).font = font_white_bold
        ws.cell(row=2, column=1).alignment = align_center
        ws.cell(row=2, column=1).border = border_all
        
        ws.cell(row=2, column=2, value=f"HORARIO A\n{horario_a}").fill = fill_agent_a
        ws.cell(row=2, column=3, value=f"HORARIO B\n{horario_b}").fill = fill_agent_b
        ws.cell(row=2, column=4, value=f"HORARIO C\n{horario_c}").fill = fill_agent_c
        
        ws.cell(row=2, column=5, value="Gestión total de call center").fill = fill_total_cc
        
        ws.cell(row=2, column=6, value="VISITAS PENDIENTES DE AYER Y DE DIAS ANTERIORES")
        ws.cell(row=2, column=7, value="VISITAS GENERADAS HOY")
        ws.merge_cells("H2:I2")
        ws.cell(row=2, column=8, value="TOTAL CARGA DE VISITAS")
        
        for c in range(2, 6):
            cell = ws.cell(row=2, column=c)
            cell.font = font_black_bold
            cell.alignment = align_center
            cell.border = border_all
            
        for c in range(6, 10):
            cell = ws.cell(row=2, column=c)
            cell.font = Font(name="Calibri", size=9, bold=True, color="000000")
            cell.alignment = align_center
            cell.border = border_all
        ws.row_dimensions[2].height = 32
        
        # Fila 3: Agentes de turno / KPI valores
        ws.cell(row=3, column=1, value="AGENTE DE TURNO ESTE DÍA").fill = fill_lbl_purple
        ws.cell(row=3, column=1).font = font_white_bold
        ws.cell(row=3, column=1).alignment = align_center
        ws.cell(row=3, column=1).border = border_all
        
        ws.cell(row=3, column=2, value=agente_a).fill = fill_agent_a
        ws.cell(row=3, column=3, value=agente_b).fill = fill_agent_b
        ws.cell(row=3, column=4, value=agente_c).fill = fill_agent_c
        ws.cell(row=3, column=5, value="=SUM(B7:D7)+SUM(B8:D8)+SUM(B9:D9)+SUM(B10:D10)+SUM(B11:D11)+SUM(B12:D12)").fill = fill_total_cc
        
        ws.cell(row=3, column=6, value=kpi_pendientes_anteriores)
        ws.cell(row=3, column=7, value=kpi_generadas_hoy)
        ws.merge_cells("H3:I3")
        ws.cell(row=3, column=8, value="=F3+G3")
        
        for c in range(2, 5):
            cell = ws.cell(row=3, column=c)
            cell.font = font_black_bold
            cell.alignment = align_center
            cell.border = border_all
            
        ws.cell(row=3, column=5).font = font_large_bold
        ws.cell(row=3, column=5).alignment = align_center
        ws.cell(row=3, column=5).border = border_all
        
        for c in range(6, 10):
            cell = ws.cell(row=3, column=c)
            cell.font = font_large_bold
            cell.alignment = align_center
            cell.border = border_all
        ws.row_dimensions[3].height = 30
        
        # Fila 4: Cabecera Detalle de actividad
        ws.merge_cells("A4:E4")
        ws.cell(row=4, column=1, value="DETALLE DE ACTIVIDAD POR CALL CENTER").fill = fill_lbl_purple
        ws.cell(row=4, column=1).font = font_white_bold
        ws.cell(row=4, column=1).alignment = align_center
        ws.cell(row=4, column=1).border = border_all
        
        ws.merge_cells("F4:I4")
        ws.cell(row=4, column=6, value="DETALLE DE VISITAS POR DAÑOS").fill = fill_hdr_dark
        ws.cell(row=4, column=6).font = font_title_white
        ws.cell(row=4, column=6).alignment = align_center
        ws.cell(row=4, column=6).border = border_all
        ws.row_dimensions[4].height = 28
        
        # Fila 5: Agentes cabecera / Atendidos vs Pendientes mañana
        ws.cell(row=5, column=1, value="AGENTE").fill = fill_lbl_purple
        ws.cell(row=5, column=1).font = font_white_bold
        ws.cell(row=5, column=1).alignment = align_center
        ws.cell(row=5, column=1).border = border_all
        
        ws.cell(row=5, column=2, value=agente_a).fill = fill_agent_a
        ws.cell(row=5, column=3, value=agente_b).fill = fill_agent_b
        ws.cell(row=5, column=4, value=agente_c).fill = fill_agent_c
        ws.cell(row=5, column=5, value="TOTAL GESTIONES").fill = fill_hdr_dark
        
        for c in range(2, 5):
            cell = ws.cell(row=5, column=c)
            cell.font = font_black_bold
            cell.alignment = align_center
            cell.border = border_all
            
        ws.cell(row=5, column=5).font = font_white_bold
        ws.cell(row=5, column=5).alignment = align_center
        ws.cell(row=5, column=5).border = border_all
        
        ws.merge_cells("F5:G5")
        ws.cell(row=5, column=6, value="VISITAS ATENDIDAS Y SOLUCIONADAS +\nCAMBIOS DE FO").fill = fill_vis_attended
        ws.cell(row=5, column=6).font = Font(name="Calibri", size=9, bold=True, color="000000")
        ws.cell(row=5, column=6).alignment = align_center
        ws.cell(row=5, column=6).border = border_all
        
        ws.merge_cells("H5:I5")
        ws.cell(row=5, column=8, value="VISITAS PENDIENTES MAÑANA").fill = fill_vis_pending
        ws.cell(row=5, column=8).font = Font(name="Calibri", size=9, bold=True, color="000000")
        ws.cell(row=5, column=8).alignment = align_center
        ws.cell(row=5, column=8).border = border_all
        ws.row_dimensions[5].height = 32
        
        # Fila 6: TOTAL DE GESTIONES AL DÍA / Conteo de visitas de hoy y mañana
        ws.cell(row=6, column=1, value="TOTAL DE GESTIONES AL DÍA").fill = fill_total_row
        ws.cell(row=6, column=1).font = font_white_bold
        ws.cell(row=6, column=1).alignment = align_left
        ws.cell(row=6, column=1).border = border_all
        
        ws.cell(row=6, column=2, value="=SUM(B7:B12)").fill = fill_total_row
        ws.cell(row=6, column=3, value="=SUM(C7:C12)").fill = fill_total_row
        ws.cell(row=6, column=4, value="=SUM(D7:D12)").fill = fill_total_row
        ws.cell(row=6, column=5, value="=SUM(E7:E12)").fill = fill_total_row
        
        for c in range(2, 6):
            cell = ws.cell(row=6, column=c)
            cell.font = font_white_bold
            cell.alignment = align_center
            cell.border = border_all
            
        ws.merge_cells("F6:G6")
        ws.cell(row=6, column=6, value=kpi_atendidas_hoy)
        ws.cell(row=6, column=6).font = font_large_bold
        ws.cell(row=6, column=6).alignment = align_center
        ws.cell(row=6, column=6).border = border_all
        
        ws.merge_cells("H6:I6")
        ws.cell(row=6, column=8, value=kpi_pendientes_manana)
        ws.cell(row=6, column=8).font = font_large_bold
        ws.cell(row=6, column=8).alignment = align_center
        ws.cell(row=6, column=8).border = border_all
        ws.row_dimensions[6].height = 28
        
        # Filas 7 a 12: Categorías de atenciones / Subtítulos de daños
        categorias_rows = [
            ("VISITAS COORDINADAS", atenciones_data['visitas_coordinadas']),
            ("SOLVENTADO POR LLAMADA", atenciones_data['solventado_llamada']),
            ("SOLVENTADO POR MENSAJES", atenciones_data['solventado_mensajes']),
            ("SOLVENTADO EN OFICINA", atenciones_data['solventado_oficina']),
            ("SOPORTE A TÉCNICOS VT / INST", [soporte_a, soporte_b, soporte_c]),
            ("INFO / TRANSFERENCIAS - OTROS", atenciones_data['otros'])
        ]
        
        ws.merge_cells("F7:G7")
        ws.cell(row=7, column=6, value="PROBLEMA / SOLUCION DE VISITAS DE HOY").fill = fill_sol_hdr
        ws.cell(row=7, column=6).font = Font(name="Calibri", size=9, bold=True, color="000000")
        ws.cell(row=7, column=6).alignment = align_center
        ws.cell(row=7, column=6).border = border_all
        
        ws.merge_cells("H7:I7")
        ws.cell(row=7, column=8, value="PROBLEMAS DE VISITAS PARA MAÑANA").fill = fill_prob_hdr
        ws.cell(row=7, column=8).font = Font(name="Calibri", size=9, bold=True, color="000000")
        ws.cell(row=7, column=8).alignment = align_center
        ws.cell(row=7, column=8).border = border_all
        
        for idx, (cat_name, vals) in enumerate(categorias_rows, start=7):
            ws.cell(row=idx, column=1, value=cat_name).fill = fill_lbl_purple
            ws.cell(row=idx, column=1).font = font_white_bold
            ws.cell(row=idx, column=1).alignment = align_left
            ws.cell(row=idx, column=1).border = border_all
            
            ws.cell(row=idx, column=2, value=vals[0]).fill = fill_agent_a
            ws.cell(row=idx, column=3, value=vals[1]).fill = fill_agent_b
            ws.cell(row=idx, column=4, value=vals[2]).fill = fill_agent_c
            ws.cell(row=idx, column=5, value=f"=SUM(B{idx}:D{idx})").fill = fill_total_cc
            
            for c in range(2, 6):
                cell = ws.cell(row=idx, column=c)
                cell.font = font_black_bold
                cell.alignment = align_center
                cell.border = border_all
            ws.row_dimensions[idx].height = 24
            
        # Filas 8 a 21: Lista de problemas y soluciones detallados
        soluciones_lista = [
            "CAMBIO DE FIBRA REALIZADO",
            "SE COORDINA CAMBIO DE UTP / FIBRA",
            "CAMBIO DE CABLE UTP / RG6",
            "FISICO / CAMBIO DE CONECTORES APC-UPC O RG6",
            "FISICO / CAMBIO DE ONU EN MAL ESTADO",
            "LÓGICO / CONFIGURACIÓN DE EQUIPOS",
            "INSPECCIÓN / SOLUCIÓN PARCIAL",
            "RADIO ENLACE / DOMÓTICA",
            "FISICO / CAMBIO DE ADAPTADOR DE CORRIENTE",
            "ARREGLO DE INSTALACIÓN / REUBICACIÓN DE EQUIPOS / RETENCIÓN",
            "INSTALACIÓN EFECTIVA / CAMBIO DE ROUTER",
            "TICKET A TECNOLOGÍA, DAÑO RADIAL",
            "TICKET A TECNOLOGÍA, DAÑO FTTH",
            "TICKET A TECNOLOGÍA, DAÑO HFC"
        ]
        
        problemas_lista = [
            "CAMBIOS DE FIBRA A REALIZAR",
            "VERIFICAR INSTACION",
            "EQUIPOS ALARMADOS",
            "REVISION DE ONT",
            "LENTITUD EN EL SERVICIO",
            "REVISION DE SERVICIO/COBERTURA",
            "ACTUALIZACIÓN DE EQUIPO / COLOCACIÓN ROUTER",
            "NO MARCA VELOCIDAD CONTRATADA",
            "REUBICACION DE EQUIPOS",
            "VT COBRADA / MANIPULACION DEL CLI",
            "ACTIVAR STREAMING",
            "CANALES BORROSOS",
            "POTENCIA DEGRADADA (GPON)",
            "RETENCIÓN"
        ]
        
        for idx in range(14):
            row_idx = 8 + idx
            sol_name = soluciones_lista[idx]
            sol_val = soluciones_dict.get(sol_name, 0)
            
            prob_name = problemas_lista[idx]
            prob_dict_name = "VERIFICAR INSTACION" if prob_name == "VERIFICAR INSTACION" else prob_name
            prob_val = problemas_dict.get(prob_dict_name, 0)
            
            # Lado izquierdo (soluciones de hoy)
            ws.cell(row=row_idx, column=6, value=sol_name).font = Font(name="Calibri", size=8, color="000000")
            ws.cell(row=row_idx, column=6).alignment = align_left
            ws.cell(row=row_idx, column=6).border = border_all
            
            ws.cell(row=row_idx, column=7, value=sol_val).font = font_black_bold
            ws.cell(row=row_idx, column=7).alignment = align_center
            ws.cell(row=row_idx, column=7).border = border_all
            
            # Lado derecho (problemas de mañana)
            ws.cell(row=row_idx, column=8, value=prob_name).font = Font(name="Calibri", size=8, color="000000")
            ws.cell(row=row_idx, column=8).alignment = align_left
            ws.cell(row=row_idx, column=8).border = border_all
            
            ws.cell(row=row_idx, column=9, value=prob_val).font = font_black_bold
            ws.cell(row=row_idx, column=9).alignment = align_center
            ws.cell(row=row_idx, column=9).border = border_all
            
            ws.row_dimensions[row_idx].height = 22
            
        # Escribir tabla vertical auxiliar para el Gráfico 1 (Gestion por Agente) para compatibilidad con Google Sheets
        ws.cell(row=1, column=11, value="Agente")
        ws.cell(row=1, column=12, value="Gestión")
        ws.cell(row=2, column=11, value="=B5")
        ws.cell(row=2, column=12, value="=B6")
        ws.cell(row=3, column=11, value="=C5")
        ws.cell(row=3, column=12, value="=C6")
        ws.cell(row=4, column=11, value="=D5")
        ws.cell(row=4, column=12, value="=D6")

        # 4. AÑADIR LOS GRÁFICOS PIE NATIVOS EN EL EXCEL (Filas 23+)
        try:
            from openpyxl.chart import PieChart, Reference
            from openpyxl.chart.label import DataLabelList
            
            # Gráfico 1: GESTIÓN POR AGENTE (usando la tabla vertical de columnas K y L)
            chart_ag = PieChart()
            labels_ref_ag = Reference(ws, min_col=11, min_row=2, max_row=4)
            data_ref_ag = Reference(ws, min_col=12, min_row=1, max_row=4)
            chart_ag.add_data(data_ref_ag, titles_from_data=True)
            chart_ag.set_categories(labels_ref_ag)
            chart_ag.title = "GESTIÓN POR AGENTE"
            chart_ag.dataLabels = DataLabelList()
            chart_ag.dataLabels.showPercent = True
            chart_ag.dataLabels.showVal = True
            chart_ag.dataLabels.showCatName = False
            chart_ag.dataLabels.showSerName = False
            chart_ag.width = 11
            chart_ag.height = 7
            ws.add_chart(chart_ag, "A23")
            
            # Gráfico 2: TIPO DE ATENCIÓN
            chart_tp = PieChart()
            labels_ref_tp = Reference(ws, min_col=1, min_row=7, max_row=12)
            data_ref_tp = Reference(ws, min_col=5, min_row=7, max_row=12)
            chart_tp.add_data(data_ref_tp, titles_from_data=False)
            chart_tp.set_categories(labels_ref_tp)
            chart_tp.title = "TIPO DE ATENCIÓN"
            chart_tp.dataLabels = DataLabelList()
            chart_tp.dataLabels.showPercent = True
            chart_tp.dataLabels.showVal = True
            chart_tp.dataLabels.showCatName = False
            chart_tp.dataLabels.showSerName = False
            chart_tp.width = 11
            chart_tp.height = 7
            ws.add_chart(chart_tp, "D23")
        except Exception as chart_err:
            print(f"Error al generar gráficos nativos de openpyxl: {chart_err}")
            
        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        filename = f"Reporte_General_{fecha}.xlsx"
        return send_file(
            excel_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@admin_bp.route('/api/admin/inventario', methods=['GET'])
def api_obtener_inventario():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'BODEGA']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ver inventario."}), 403
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión a la base de datos"}), 500
        
    try:
        cursor = conexion.cursor(dictionary=True)
        
        # 1. Obtener catálogo de materiales con stock en bodega
        cursor.execute("SELECT id_material, nombre_material, unidad_medida, stock_bodega FROM materiales ORDER BY nombre_material ASC")
        materiales = cursor.fetchall()
        
        # 2. Obtener lista de placas de vehículos activos
        cursor.execute("SELECT DISTINCT placa_vehiculo FROM tecnicos WHERE activo = 1 ORDER BY placa_vehiculo ASC")
        placas = [p['placa_vehiculo'] for p in cursor.fetchall() if p['placa_vehiculo']]
        
        # 3. Obtener stock disponible en custodia por placa
        cursor.execute("SELECT placa_vehiculo, id_material, cantidad_disponible FROM inventario_tecnicos")
        custodia_raw = cursor.fetchall()
        
        # 4. Obtener consumo histórico (usado) por placa
        cursor.execute("""
            SELECT t.placa_vehiculo, vm.id_material, SUM(vm.cantidad_usada) as total_usado
            FROM visitas_materiales vm
            JOIN visitas_tecnicas vt ON vm.id_visita = vt.id_visita
            JOIN tecnicos t ON vt.tecnico_principal = t.nombre
            WHERE vt.estado = 'FINALIZADA' AND t.placa_vehiculo IS NOT NULL
            GROUP BY t.placa_vehiculo, vm.id_material
        """)
        consumo_raw = cursor.fetchall()
        
        # Estructurar la respuesta por placa y material
        inventario_tecnicos = {}
        for placa in placas:
            inventario_tecnicos[placa] = {}
            for mat in materiales:
                inventario_tecnicos[placa][str(mat['id_material'])] = {
                    "cantidad_disponible": 0,
                    "total_usado": 0
                }
                
        for row in custodia_raw:
            placa = row['placa_vehiculo']
            id_mat = str(row['id_material'])
            if placa in inventario_tecnicos and id_mat in inventario_tecnicos[placa]:
                inventario_tecnicos[placa][id_mat]['cantidad_disponible'] = row['cantidad_disponible']
                
        for row in consumo_raw:
            placa = row['placa_vehiculo']
            id_mat = str(row['id_material'])
            if placa in inventario_tecnicos and id_mat in inventario_tecnicos[placa]:
                inventario_tecnicos[placa][id_mat]['total_usado'] = int(row['total_usado'] or 0)
                
        return jsonify({
            "status": "ok",
            "materiales": materiales,
            "tecnicos": placas,  # Retorna placas bajo la clave 'tecnicos' para compatibilidad con el JS
            "inventario_tecnicos": inventario_tecnicos
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@admin_bp.route('/api/admin/inventario/bodega/ingreso', methods=['POST'])
def api_bodega_ingreso():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'BODEGA']:
        return jsonify({"status": "error", "message": "No tienes privilegios para ingresar insumos a bodega."}), 403
        
    datos = request.get_json() or {}
    id_material = datos.get('id_material')
    cantidad = datos.get('cantidad')
    
    if not id_material or not cantidad or int(cantidad) <= 0:
        return jsonify({"status": "error", "message": "Parámetros inválidos"}), 400
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión"}), 500
        
    try:
        cursor = conexion.cursor()
        cursor.execute("""
            UPDATE materiales 
            SET stock_bodega = stock_bodega + %s 
            WHERE id_material = %s
        """, (int(cantidad), int(id_material)))
        conexion.commit()
        return jsonify({"status": "ok", "message": "Material ingresado a bodega con éxito"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@admin_bp.route('/api/admin/inventario/tecnico/entrega', methods=['POST'])
def api_tecnico_entrega():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'BODEGA']:
        return jsonify({"status": "error", "message": "No tienes privilegios para entregar insumos a técnicos."}), 403
        
    datos = request.get_json() or {}
    placa_vehiculo = datos.get('tecnico_nombre') or datos.get('placa_vehiculo')
    id_material = datos.get('id_material')
    cantidad = datos.get('cantidad')
    
    if not placa_vehiculo or not id_material or not cantidad or int(cantidad) <= 0:
        return jsonify({"status": "error", "message": "Parámetros inválidos"}), 400
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión"}), 500
        
    try:
        cursor = conexion.cursor()
        
        # 1. Validar stock en bodega
        cursor.execute("SELECT stock_bodega FROM materiales WHERE id_material = %s", (int(id_material),))
        row = cursor.fetchone()
        if not row or row[0] < int(cantidad):
            return jsonify({"status": "error", "message": "Stock insuficiente en bodega"}), 400
            
        # 2. Descontar de bodega
        cursor.execute("""
            UPDATE materiales 
            SET stock_bodega = stock_bodega - %s 
            WHERE id_material = %s
        """, (int(cantidad), int(id_material)))
        
        # 3. Sumar a la placa
        cursor.execute("""
            INSERT INTO inventario_tecnicos (placa_vehiculo, id_material, cantidad_disponible)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE cantidad_disponible = cantidad_disponible + VALUES(cantidad_disponible)
        """, (placa_vehiculo, int(id_material), int(cantidad)))
        
        conexion.commit()
        return jsonify({"status": "ok", "message": "Material entregado a la placa con éxito"})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()


@admin_bp.route('/api/admin/inventario/tecnico/devolucion', methods=['POST'])
def api_tecnico_devolucion():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    if session.get('user_role') not in ['ADMIN', 'BODEGA']:
        return jsonify({"status": "error", "message": "No tienes privilegios para registrar devoluciones."}), 403
        
    datos = request.get_json() or {}
    placa_vehiculo = datos.get('tecnico_nombre') or datos.get('placa_vehiculo')
    id_material = datos.get('id_material')
    cantidad = datos.get('cantidad')
    
    if not placa_vehiculo or not id_material or not cantidad or int(cantidad) <= 0:
        return jsonify({"status": "error", "message": "Parámetros inválidos"}), 400
        
    conexion = get_db_connection()
    if not conexion:
        return jsonify({"status": "error", "message": "Error de conexión"}), 500
        
    try:
        cursor = conexion.cursor()
        
        # 1. Validar que la placa tenga suficiente cantidad para devolver
        cursor.execute("""
            SELECT cantidad_disponible FROM inventario_tecnicos 
            WHERE placa_vehiculo = %s AND id_material = %s
        """, (placa_vehiculo, int(id_material)))
        row = cursor.fetchone()
        if not row or row[0] < int(cantidad):
            return jsonify({"status": "error", "message": "La placa no dispone de esa cantidad en custodia"}), 400
            
        # 2. Descontar a la placa
        cursor.execute("""
            UPDATE inventario_tecnicos 
            SET cantidad_disponible = cantidad_disponible - %s 
            WHERE placa_vehiculo = %s AND id_material = %s
        """, (int(cantidad), placa_vehiculo, int(id_material)))
        
        # 3. Sumar a bodega
        cursor.execute("""
            UPDATE materiales 
            SET stock_bodega = stock_bodega + %s 
            WHERE id_material = %s
        """, (int(cantidad), int(id_material)))
        
        conexion.commit()
        return jsonify({"status": "ok", "message": "Devolución registrada con éxito"})
    except Exception as e:
        conexion.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()