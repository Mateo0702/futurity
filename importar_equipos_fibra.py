import pandas as pd
import mysql.connector
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

def ejecutar_importacion_fibra():
    excel_path = 'equipos_fibra.xlsx'
    print(f"Leyendo archivo {excel_path} (FIBRACOM)...")
    df = pd.read_excel(excel_path)
    print(f"Total registros cargados: {len(df)}")

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # 1. Identificar visitas técnicas finalizadas posteriores al 18 de agosto (2026-08-18)
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
                    if c[:-1].isdigit():
                        contratos_protegidos.add(f"{int(c[:-1]):07d}F")
                        contratos_protegidos.add(f"{int(c[:-1]):08d}F")
                elif c.isdigit():
                    contratos_protegidos.add(f"{c}F")
                    contratos_protegidos.add(f"{int(c):07d}F")
                    contratos_protegidos.add(f"{int(c):08d}F")

        print(f"Total identificadores de contratos protegidos post 18-Ago: {len(contratos_protegidos)}")

        # 2. Consultar todos los clientes en directorio_clientes
        cur.execute("SELECT contrato, nombre_cliente, empresa FROM directorio_clientes")
        todos_clientes_db = cur.fetchall()

        actualizados = 0
        insertados = 0
        omitidos_protegidos = 0
        omitidos_sin_contrato = 0

        for idx, row in df.iterrows():
            c_raw = clean_val(row.get('CONTRATO'))
            cliente_excel = clean_val(row.get('CLIENTE'))
            
            if not c_raw:
                omitidos_sin_contrato += 1
                continue

            # Generar variantes de contrato Fibracom
            c_variants = [
                c_raw,
                f"{c_raw}F",
                f"{int(c_raw):07d}F" if c_raw.isdigit() else "",
                f"{int(c_raw):08d}F" if c_raw.isdigit() else "",
                f"{int(c_raw):02d}F" if c_raw.isdigit() else ""
            ]
            c_variants = [v for v in c_variants if v]

            # Verificar si está en la lista de contratos protegidos
            esta_protegido = any(v in contratos_protegidos for v in c_variants)
            if esta_protegido:
                print(f" -> Protegido: Contrato #{c_raw} ({cliente_excel}) omitido para preservar cambios recientes.")
                omitidos_protegidos += 1
                continue

            # Buscar match en base de datos
            match_db = None
            # 1. Por variantes de contrato
            for r in todos_clientes_db:
                if r['contrato'] in c_variants:
                    match_db = r
                    break
            
            # 2. Si no hubo match por contrato, buscar por coincidencia exacta de nombre
            if not match_db and cliente_excel:
                for r in todos_clientes_db:
                    if r['nombre_cliente'] and cliente_excel.upper() == r['nombre_cliente'].upper():
                        match_db = r
                        break

            sn_ont = clean_val(row.get('SN'))
            modelo_ont = clean_val(row.get('ONT'))
            olt = clean_val(row.get('OLT')) or 'VALLE'
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

            ip_nodo_master = '10.64.20.2' if ('SANTA ANA' in str(zona).upper() or 'S.ANA' in str(olt).upper()) else '100.64.21.2'

            if match_db:
                contrato_target = match_db['contrato']
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
                # Nuevo cliente Fibracom (ej. 531F)
                contrato_nuevo = f"{c_raw}F" if not c_raw.endswith('F') else c_raw
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
                    contrato_nuevo, 'FIBRACOM', cliente_excel or 'CLIENTE FIBRACOM', zona,
                    sn_ont, modelo_ont, router_principal, router_secundario,
                    tipo_mesh, cantidad_routers, modo_acceso, ip_address, olt
                ))
                insertados += 1
                todos_clientes_db.append({'contrato': contrato_nuevo, 'nombre_cliente': cliente_excel, 'empresa': 'FIBRACOM'})

        conn.commit()
        print("\n==========================================")
        print("[OK] PROCESO DE ACTUALIZACION FIBRACOM FINALIZADO")
        print("==========================================")
        print(f"Registros actualizados en directorio: {actualizados}")
        print(f"Nuevos contratos insertados:          {insertados}")
        print(f"Contratos protegidos (post 18-Ago):  {omitidos_protegidos}")
        print(f"Filas sin numero de contrato:        {omitidos_sin_contrato}")
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
    ejecutar_importacion_fibra()
