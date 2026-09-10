import pandas as pd
import mysql.connector
import re
from db_config import get_db_connection

def clean_val(val):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if s.lower() in ['nan', 'none', 'null', '', '-']:
        return None
    if s.endswith('.0'):
        s = s[:-2]
    return s

def clean_int(val):
    if pd.isna(val) or val is None:
        return None
    try:
        return int(float(val))
    except:
        return None

def ejecutar_importacion_cs():
    excel_path = 'equipos_cs.xlsx'
    print(f"Leyendo archivo {excel_path} (Control Sur)...")
    df = pd.read_excel(excel_path)
    print(f"Total registros cargados: {len(df)}")

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # 1. Identificar contratos con visitas finalizadas posteriores al 18 de agosto (2026-08-18)
        print("Consultando historial de visitas tecnicas posteriores al 2026-08-18...")
        cur.execute("""
            SELECT DISTINCT contrato, fecha_programada, solucion_tecnico
            FROM visitas_tecnicas
            WHERE estado = 'FINALIZADA'
              AND fecha_programada > '2026-08-18'
              AND contrato IS NOT NULL
        """)
        visitas_posteriores = cur.fetchall()
        contratos_protegidos = set()
        for v in visitas_posteriores:
            c = clean_val(v.get('contrato'))
            if c:
                contratos_protegidos.add(c)
                if c.endswith('F'):
                    contratos_protegidos.add(c[:-1])
                else:
                    contratos_protegidos.add(f"{c}F")

        print(f"Contratos protegidos con cambios recientes post 18-Ago: {len(contratos_protegidos)}")

        # 2. Consultar contratos existentes en directorio_clientes
        cur.execute("SELECT contrato FROM directorio_clientes")
        contratos_existentes = set(clean_val(r['contrato']) for r in cur.fetchall() if r.get('contrato'))
        print(f"Contratos existentes en directorio_clientes: {len(contratos_existentes)}")

        actualizados = 0
        insertados = 0
        omitidos_protegidos = 0
        omitidos_nodos_tecnicos = 0

        for idx, row in df.iterrows():
            c_raw = str(row.get('CONTRATO', '')).strip()
            if c_raw.endswith('.0'):
                c_raw = c_raw[:-2]

            # Extraer contrato y nombre si venian mezclados
            match = re.match(r'^(\d+)[_\s]*(.*)$', c_raw)
            if not match:
                omitidos_nodos_tecnicos += 1
                continue

            contrato = match.group(1)
            resto_nombre = match.group(2).replace('_', ' ').strip()
            
            cliente_raw = clean_val(row.get('CLIENTE'))
            cliente = cliente_raw if cliente_raw else (resto_nombre if resto_nombre else 'CLIENTE NUEVO')

            # Si el contrato tuvo cambios después del 18 de agosto -> PROTEGER Y NO TOCAR
            if contrato in contratos_protegidos:
                omitidos_protegidos += 1
                continue

            sn_ont = clean_val(row.get('SN'))
            modelo_ont = clean_val(row.get('ONT'))
            olt = clean_val(row.get('OLT')) or 'Control Sur'
            zona = clean_val(row.get('Zone'))
            ip_address = clean_val(row.get('Address'))
            router_principal = clean_val(row.get('ROUTER PRINCIPAL'))
            router_secundario = clean_val(row.get('ROUTER SECUNDARIO'))
            
            # Buscar columna MESH
            mesh_col = [c for c in df.columns if 'MESH' in str(c).upper()]
            tipo_mesh = clean_val(row.get(mesh_col[0])) if mesh_col else None
            
            cantidad_routers = clean_int(row.get('Cantidad'))
            
            # Buscar columna Modo Acceso
            acceso_col = [c for c in df.columns if 'ROUTER' in str(c).upper() and 'ONT' in str(c).upper() and 'SIN ACCESO' in str(c).upper()]
            modo_acceso = clean_val(row.get(acceso_col[0])) if acceso_col else None

            ip_nodo_master = '10.80.80.134'

            # Buscar contrato exacto o con sufijos oficiales (D, F, A, I)
            contrato_target = None
            if contrato in contratos_existentes:
                contrato_target = contrato
            elif (contrato + 'D') in contratos_existentes:
                contrato_target = contrato + 'D'
            elif (contrato + 'F') in contratos_existentes:
                contrato_target = contrato + 'F'
            elif (contrato + 'A') in contratos_existentes:
                contrato_target = contrato + 'A'
            elif (contrato + 'I') in contratos_existentes:
                contrato_target = contrato + 'I'

            if contrato_target:
                # ACTUALIZAR REGISTRO EXISTENTE
                update_sql = """
                    UPDATE directorio_clientes SET
                        numero_serie = %s,
                        modelo_ont = %s,
                        router_principal = %s,
                        router_secundario = %s,
                        tipo_mesh = %s,
                        cantidad_routers = %s,
                        modo_acceso = %s,
                        ip_cliente = %s,
                        ip_nodo = %s
                    WHERE contrato = %s
                """
                cur.execute(update_sql, (
                    sn_ont, modelo_ont, router_principal, router_secundario,
                    tipo_mesh, cantidad_routers, modo_acceso, ip_address, ip_nodo_master,
                    contrato_target
                ))
                actualizados += 1
            else:
                # INSERTAR NUEVO CONTRATO EN DIRECTORIO
                insert_sql = """
                    INSERT INTO directorio_clientes (
                        contrato, empresa, nombre_cliente, zona,
                        numero_serie, modelo_ont, router_principal, router_secundario,
                        tipo_mesh, cantidad_routers, modo_acceso, ip_cliente, ip_nodo
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    )
                """
                cur.execute(insert_sql, (
                    contrato, 'SERVICABLE', cliente, zona,
                    sn_ont, modelo_ont, router_principal, router_secundario,
                    tipo_mesh, cantidad_routers, modo_acceso, ip_address, ip_nodo_master
                ))
                insertados += 1
                contratos_existentes.add(contrato)

        conn.commit()
        print("\n==========================================")
        print("[OK] PROCESO DE ACTUALIZACION CS (CONTROL SUR) FINALIZADO")
        print("==========================================")
        print(f"Registros actualizados en directorio: {actualizados}")
        print(f"Nuevos contratos insertados:          {insertados}")
        print(f"Contratos protegidos (post 18-Ago):  {omitidos_protegidos}")
        print(f"Nodos tecnicos/alarmas ignorados:    {omitidos_nodos_tecnicos}")
        print("==========================================")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Error durante la importacion: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    ejecutar_importacion_cs()
