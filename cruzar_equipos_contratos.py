"""
=============================================================================
FUTURITY ATLAS - SCRIPT DE CRUCE Y RESCATE DE EQUIPOS / HARDWARE
=============================================================================
Este script rescata los datos técnicos (router_principal, modelo_ont, serie)
que quedaron atrapados en contratos anteriores, cancelados o con formatos 
antiguos de número (ej: '32351' sin ceros vs '032351' con ceros) y los 
traspasa al contrato ACTIVO del cliente.

Jerarquía de Cruce:
1. Ceros a la izquierda (ej: '032351' activo <- '32351' viejo).
2. Misma Serie de ONU física (mismo equipo instalado en el domicilio).
3. Misma Cédula (contrato viejo/cancelado con router -> contrato activo sin router).
4. Mismo Nombre exacto de cliente (cuando el registro viejo no tenía cédula).
=============================================================================
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db_config import get_db_connection

VALORES_INVALIDOS = ('', 'SIN DATOS', 'CABLE', 'CANCELADO', 'CORTADO', 'INACTIVO', 'RETIRADO', 'S/N', 'NULL')

def ejecutar_cruce():
    conn = get_db_connection()
    if not conn:
        print("Error de conexión a BD")
        return

    cur = conn.cursor(dictionary=True)
    total_rescatados = 0
    duplicados_eliminados = 0

    print("=== INICIANDO CRUCE INTELIGENTE DE EQUIPOS ===")

    # -------------------------------------------------------------
    # PASO 1: Por número de contrato con/sin ceros a la izquierda
    # Ejemplo: '032351' (activo sin router) <- '32351' (con router)
    # -------------------------------------------------------------
    print("\n--- PASO 1: Cruzando por contrato con ceros a la izquierda (ej: 032351 vs 32351) ---")
    cur.execute("""
        SELECT d_act.contrato as c_act, d_viejo.contrato as c_viejo,
               d_viejo.router_principal, d_viejo.modelo_ont, d_viejo.numero_serie,
               d_viejo.router_secundario, d_viejo.numero_serie_router, d_viejo.tipo_mesh,
               d_act.nombre_cliente
        FROM directorio_clientes d_act
        JOIN directorio_clientes d_viejo 
          ON TRIM(LEADING '0' FROM d_act.contrato) = TRIM(LEADING '0' FROM d_viejo.contrato)
         AND d_act.contrato != d_viejo.contrato
        WHERE (d_act.router_principal IS NULL OR d_act.router_principal = '' OR d_act.router_principal = 'SIN DATOS')
          AND (d_viejo.router_principal IS NOT NULL AND d_viejo.router_principal NOT IN ('', 'SIN DATOS', 'CABLE', 'CANCELADO', 'CORTADO', 'INACTIVO'))
    """)
    casos_p1 = cur.fetchall()

    for r in casos_p1:
        c_act = r['c_act']
        c_viejo = r['c_viejo']
        cur.execute("""
            UPDATE directorio_clientes
            SET router_principal = COALESCE(NULLIF(router_principal, ''), %s),
                modelo_ont = COALESCE(NULLIF(modelo_ont, ''), %s),
                numero_serie = COALESCE(NULLIF(numero_serie, ''), %s),
                router_secundario = COALESCE(NULLIF(router_secundario, ''), %s),
                numero_serie_router = COALESCE(NULLIF(numero_serie_router, ''), %s),
                tipo_mesh = COALESCE(NULLIF(tipo_mesh, ''), %s)
            WHERE contrato = %s
        """, (
            r['router_principal'], r['modelo_ont'], r['numero_serie'],
            r['router_secundario'], r['numero_serie_router'], r['tipo_mesh'],
            c_act
        ))
        total_rescatados += 1

        # Si el contrato viejo no tiene cédula o es un duplicado numérico huérfano, eliminarlo
        cur.execute("""
            DELETE FROM directorio_clientes
            WHERE contrato = %s AND (cedula IS NULL OR cedula = '' OR estado != 'ACTIVO')
        """, (c_viejo,))
        if cur.rowcount > 0:
            duplicados_eliminados += 1

    conn.commit()
    print(f"Paso 1 completado: {len(casos_p1)} contratos actualizados con éxito.")

    # -------------------------------------------------------------
    # PASO 2: Por misma Serie de ONU física
    # Si comparten la misma serie física de ONU, están en el mismo domicilio
    # -------------------------------------------------------------
    print("\n--- PASO 2: Cruzando por misma Serie física de ONU ---")
    cur.execute("""
        SELECT d_act.contrato as c_act, d_viejo.contrato as c_viejo,
               d_viejo.router_principal, d_viejo.modelo_ont,
               d_viejo.router_secundario, d_viejo.numero_serie_router, d_viejo.tipo_mesh,
               d_act.nombre_cliente
        FROM directorio_clientes d_act
        JOIN directorio_clientes d_viejo 
          ON d_act.numero_serie = d_viejo.numero_serie
         AND d_act.contrato != d_viejo.contrato
        WHERE (d_act.router_principal IS NULL OR d_act.router_principal = '' OR d_act.router_principal = 'SIN DATOS')
          AND (d_viejo.router_principal IS NOT NULL AND d_viejo.router_principal NOT IN ('', 'SIN DATOS', 'CABLE', 'CANCELADO', 'CORTADO', 'INACTIVO'))
          AND d_act.numero_serie IS NOT NULL AND d_act.numero_serie NOT IN ('', 'S/N', 'SN', 'NULL')
    """)
    casos_p2 = cur.fetchall()

    for r in casos_p2:
        c_act = r['c_act']
        cur.execute("""
            UPDATE directorio_clientes
            SET router_principal = COALESCE(NULLIF(router_principal, ''), %s),
                modelo_ont = COALESCE(NULLIF(modelo_ont, ''), %s),
                router_secundario = COALESCE(NULLIF(router_secundario, ''), %s),
                numero_serie_router = COALESCE(NULLIF(numero_serie_router, ''), %s),
                tipo_mesh = COALESCE(NULLIF(tipo_mesh, ''), %s)
            WHERE contrato = %s
        """, (
            r['router_principal'], r['modelo_ont'],
            r['router_secundario'], r['numero_serie_router'], r['tipo_mesh'],
            c_act
        ))
        total_rescatados += 1

    conn.commit()
    print(f"Paso 2 completado: {len(casos_p2)} contratos actualizados con éxito.")

    # -------------------------------------------------------------
    # PASO 3: Por Cédula del Cliente (contrato cancelado con router -> contrato activo sin router)
    # -------------------------------------------------------------
    print("\n--- PASO 3: Cruzando por Cédula (contrato cancelado -> contrato activo) ---")
    cur.execute("""
        SELECT d_act.contrato as c_act, d_viejo.contrato as c_viejo,
               d_viejo.router_principal, d_viejo.modelo_ont, d_viejo.numero_serie,
               d_viejo.router_secundario, d_viejo.numero_serie_router, d_viejo.tipo_mesh,
               d_act.nombre_cliente
        FROM directorio_clientes d_act
        JOIN directorio_clientes d_viejo 
          ON d_act.cedula = d_viejo.cedula
         AND d_act.contrato != d_viejo.contrato
        WHERE (d_act.router_principal IS NULL OR d_act.router_principal = '' OR d_act.router_principal = 'SIN DATOS')
          AND (d_viejo.router_principal IS NOT NULL AND d_viejo.router_principal NOT IN ('', 'SIN DATOS', 'CABLE', 'CANCELADO', 'CORTADO', 'INACTIVO'))
          AND d_act.cedula IS NOT NULL AND TRIM(d_act.cedula) != ''
          AND (d_viejo.estado LIKE '%CANCEL%' OR d_viejo.estado LIKE '%INACT%')
          AND (d_act.estado = 'ACTIVO' OR d_act.estado LIKE '%ACT%')
    """)
    casos_p3 = cur.fetchall()

    for r in casos_p3:
        c_act = r['c_act']
        cur.execute("""
            UPDATE directorio_clientes
            SET router_principal = COALESCE(NULLIF(router_principal, ''), %s),
                modelo_ont = COALESCE(NULLIF(modelo_ont, ''), %s),
                numero_serie = COALESCE(NULLIF(numero_serie, ''), %s),
                router_secundario = COALESCE(NULLIF(router_secundario, ''), %s),
                numero_serie_router = COALESCE(NULLIF(numero_serie_router, ''), %s),
                tipo_mesh = COALESCE(NULLIF(tipo_mesh, ''), %s)
            WHERE contrato = %s
        """, (
            r['router_principal'], r['modelo_ont'], r['numero_serie'],
            r['router_secundario'], r['numero_serie_router'], r['tipo_mesh'],
            c_act
        ))
        total_rescatados += 1

    conn.commit()
    print(f"Paso 3 completado: {len(casos_p3)} contratos actualizados con éxito.")

    # -------------------------------------------------------------
    # PASO 4: Por Nombre exacto de cliente (para registros viejos sin cédula)
    # -------------------------------------------------------------
    print("\n--- PASO 4: Cruzando por Nombre exacto de cliente (registros antiguos sin cédula) ---")
    cur.execute("""
        SELECT d_act.contrato as c_act, d_viejo.contrato as c_viejo,
               d_viejo.router_principal, d_viejo.modelo_ont, d_viejo.numero_serie,
               d_viejo.router_secundario, d_viejo.numero_serie_router, d_viejo.tipo_mesh,
               d_act.nombre_cliente
        FROM directorio_clientes d_act
        JOIN directorio_clientes d_viejo 
          ON TRIM(d_act.nombre_cliente) = TRIM(d_viejo.nombre_cliente)
         AND d_act.contrato != d_viejo.contrato
        WHERE (d_act.router_principal IS NULL OR d_act.router_principal = '' OR d_act.router_principal = 'SIN DATOS')
          AND (d_viejo.router_principal IS NOT NULL AND d_viejo.router_principal NOT IN ('', 'SIN DATOS', 'CABLE', 'CANCELADO', 'CORTADO', 'INACTIVO'))
          AND d_act.nombre_cliente IS NOT NULL AND TRIM(d_act.nombre_cliente) != ''
          AND (d_viejo.cedula IS NULL OR d_viejo.cedula = '')
    """)
    casos_p4 = cur.fetchall()

    for r in casos_p4:
        c_act = r['c_act']
        c_viejo = r['c_viejo']
        cur.execute("""
            UPDATE directorio_clientes
            SET router_principal = COALESCE(NULLIF(router_principal, ''), %s),
                modelo_ont = COALESCE(NULLIF(modelo_ont, ''), %s),
                numero_serie = COALESCE(NULLIF(numero_serie, ''), %s),
                router_secundario = COALESCE(NULLIF(router_secundario, ''), %s),
                numero_serie_router = COALESCE(NULLIF(numero_serie_router, ''), %s),
                tipo_mesh = COALESCE(NULLIF(tipo_mesh, ''), %s)
            WHERE contrato = %s
        """, (
            r['router_principal'], r['modelo_ont'], r['numero_serie'],
            r['router_secundario'], r['numero_serie_router'], r['tipo_mesh'],
            c_act
        ))
        total_rescatados += 1

        # Limpiar duplicado huérfano sin cédula
        cur.execute("""
            DELETE FROM directorio_clientes
            WHERE contrato = %s AND (cedula IS NULL OR cedula = '')
        """, (c_viejo,))
        if cur.rowcount > 0:
            duplicados_eliminados += 1

    conn.commit()
    print(f"Paso 4 completado: {len(casos_p4)} contratos actualizados con éxito.")

    # -------------------------------------------------------------
    # PASO 5: Limpieza de valores basura en router_principal ('CABLE', 'CANCELADO', 'CORTADO')
    # -------------------------------------------------------------
    print("\n--- PASO 5: Limpiando estados que se guardaron erróneamente en columna router_principal ---")
    cur.execute("""
        UPDATE directorio_clientes
        SET router_principal = NULL
        WHERE router_principal IN ('CANCELADO', 'CORTADO', 'INACTIVO', 'RETIRADO')
    """)
    estados_limpiados = cur.rowcount
    conn.commit()
    print(f"Valores de estado limpiados en router_principal: {estados_limpiados} contratos.")

    print("\n=======================================================")
    print(f"RESUMEN FINAL DEL CRUCE:")
    print(f"- Total de contratos activos enriquecidos con su router real: {total_rescatados}")
    print(f"- Registros duplicados huérfanos eliminados: {duplicados_eliminados}")
    print(f"- Estados basura limpiados de columna router: {estados_limpiados}")
    print("=======================================================")

    # Validar cómo quedó Carmen Pañega
    print("\n--- CASO CARMEN PAÑEGA DESPUÉS DEL CRUCE ---")
    cur.execute("""
        SELECT contrato, nombre_cliente, cedula, estado, router_principal, modelo_ont, numero_serie 
        FROM directorio_clientes 
        WHERE contrato IN ('32351', '032351')
    """)
    for r in cur.fetchall():
        print(r)

    conn.close()

if __name__ == '__main__':
    ejecutar_cruce()

