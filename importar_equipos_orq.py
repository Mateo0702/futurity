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

def ejecutar_importacion():
    excel_path = 'equipos_orq.xlsx'
    print(f"Leyendo archivo {excel_path}...")
    df = pd.read_excel(excel_path)
    print(f"Total registros cargados: {len(df)}")

    # Conectar a Base de Datos
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # 1. Identificar contratos con visitas finalizadas posteriores al martes 18 de agosto (2026-08-18)
        print("Consultando historial de visitas técnicas posteriores al 2026-08-18...")
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
                # También considerar sufijo F si aplica
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
        omitidos_sin_contrato = 0

        # Mapeo de columnas de Excel
        # ['SN', 'ONT', 'CONTRATO', 'CLIENTE', 'OLT', 'Zone', 'Address', 'ROUTER PRINCIPAL', 'ROUTER SECUNDARIO', 'MESH \nWIFI (W)\nCABLEADO (E)', 'Cantidad', '(R) ROUTER\n(O) ONT\n(N) SIN ACCESO']

        for idx, row in df.iterrows():
            contrato = clean_val(row.get('CONTRATO'))
            if not contrato:
                omitidos_sin_contrato += 1
                continue

            # Si el contrato tuvo cambios después del 18 de agosto -> PROTEGER Y NO TOCAR
            if contrato in contratos_protegidos:
                omitidos_protegidos += 1
                continue

            sn_ont = clean_val(row.get('SN'))
            modelo_ont = clean_val(row.get('ONT'))
            cliente = clean_val(row.get('CLIENTE'))
            olt = clean_val(row.get('OLT'))
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

            ip_nodo_master = '10.101.1.50'

            if contrato in contratos_existentes:
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
                    contrato
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
                    contrato, 'FUTURITY', cliente or 'CLIENTE NUEVO', zona,
                    sn_ont, modelo_ont, router_principal, router_secundario,
                    tipo_mesh, cantidad_routers, modo_acceso, ip_address, olt
                ))
                insertados += 1
                contratos_existentes.add(contrato)

        conn.commit()
        print("\n==========================================")
        print("[OK] PROCESO DE ACTUALIZACION FINALIZADO CON EXITO")
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
    ejecutar_importacion()
