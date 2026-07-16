import pandas as pd
import mysql.connector
from mysql.connector import Error
import sys
import os
from datetime import datetime

# Añadir directorio actual al path para importar db_config
sys.path.append('.')
from db_config import get_db_connection

def format_fibracom_contract(val):
    if pd.isna(val) or val is None:
        return None
    val_str = str(val).strip()
    if val_str.lower() in ['nan', 'none', 'null', '']:
        return None
    # Eliminar decimales si viene de float en Excel (.0)
    if val_str.endswith('.0'):
        val_str = val_str[:-2]
        
    # Verificar si el contrato ya tiene el sufijo 'F'
    if val_str.upper().endswith('F'):
        return val_str.upper()
    else:
        return f"{val_str.upper()}F"

def clean_str(val):
    if pd.isna(val) or val is None:
        return None
    val_str = str(val).strip()
    if val_str.lower() in ['nan', 'none', 'null', '']:
        return None
    if val_str.endswith('.0'):
        val_str = val_str[:-2]
    return val_str

def clean_int(val):
    if pd.isna(val) or val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

def clean_float(val):
    if pd.isna(val) or val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def clean_date(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.strftime('%Y-%m-%d')
    val_str = str(val).strip()
    if val_str.lower() in ['nan', 'none', 'null', '']:
        return None
    try:
        dt = pd.to_datetime(val_str)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return val_str[:19]

def main():
    file_path = 'base_fibracom.xlsx'
    if not os.path.exists(file_path):
        print(f"Error: No se encontró el archivo {file_path}")
        sys.exit(1)

    print(f"Cargando archivo {file_path}...")
    try:
        # Cargar indicando tipos de datos para no perder formatos de teléfonos
        df = pd.read_excel(file_path, dtype={
            '# Contrato': str,
            'Telefono1': str,
            'Telefono2': str,
            'Numero Serie': str
        })
    except Exception as e:
        print(f"Error al leer el archivo Excel: {e}")
        sys.exit(1)

    print(f"Archivo cargado. Total de filas en Excel: {len(df)}")

    conexion = get_db_connection()
    if not conexion:
        print("Error: No se pudo conectar a la base de datos.")
        sys.exit(1)

    cursor = conexion.cursor()
    
    # Contadores
    insertados = 0
    actualizados = 0
    sin_cambios = 0
    errores = 0

    query_upsert = """
        INSERT INTO directorio_clientes (
            contrato, empresa, fecha_instalacion, producto, estado, 
            antiguedad, forma_pago, nombre_cliente, direccion, zona, 
            telefono1, telefono2, telefono3, tv_adicionales, total_mensual, numero_serie
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            empresa = VALUES(empresa),
            fecha_instalacion = VALUES(fecha_instalacion),
            producto = VALUES(producto),
            estado = VALUES(estado),
            antiguedad = VALUES(antiguedad),
            forma_pago = VALUES(forma_pago),
            nombre_cliente = VALUES(nombre_cliente),
            direccion = VALUES(direccion),
            zona = VALUES(zona),
            telefono1 = VALUES(telefono1),
            telefono2 = VALUES(telefono2),
            telefono3 = VALUES(telefono3),
            tv_adicionales = VALUES(tv_adicionales),
            total_mensual = VALUES(total_mensual),
            numero_serie = VALUES(numero_serie)
    """

    print("Procesando e importando clientes de Fibracom...")
    for index, row in df.iterrows():
        # Validar y formatear el número de contrato
        contrato_original = row.get('# Contrato')
        contrato = format_fibracom_contract(contrato_original)
        
        if not contrato:
            continue

        producto = clean_str(row.get('Productos'))
        estado = clean_str(row.get('Estado'))
        fecha_inst = clean_date(row.get('Fecha Instalacion'))
        antig = clean_int(row.get('Antig'))
        forma_pago = clean_str(row.get('NombreFormaPago'))
        cliente = clean_str(row.get('Cliente'))
        if not cliente:
            cliente = "CLIENTE SIN NOMBRE"

        direccion = clean_str(row.get('Direccion'))
        zona = clean_str(row.get('Zona'))
        tel1 = clean_str(row.get('Telefono1'))
        tel2 = clean_str(row.get('Telefono2'))
        tel3 = None # Fibracom no posee columna Telefono3
        
        tv_adic = clean_int(row.get('Tv Adicional'))
        if tv_adic is None:
            tv_adic = 0
            
        total_mensual = clean_float(row.get('Total Mensual'))
        num_serie = clean_str(row.get('Numero Serie'))
        
        empresa = 'FIBRACOM' # Constante para este archivo

        valores = (
            contrato, empresa, fecha_inst, producto, estado,
            antig, forma_pago, cliente, direccion, zona,
            tel1, tel2, tel3, tv_adic, total_mensual, num_serie
        )

        try:
            cursor.execute(query_upsert, valores)
            status = cursor.rowcount
            if status == 1:
                insertados += 1
            elif status == 2:
                actualizados += 1
            else:
                sin_cambios += 1
        except Error as e:
            print(f"Error en fila {index + 2} (Contrato Original: {contrato_original} -> Formateado: {contrato}): {e}")
            errores += 1

        if index % 100 == 0:
            conexion.commit()

    conexion.commit()
    cursor.close()
    conexion.close()

    print("\nResultados del Proceso de Importación (Fibracom):")
    print(f"  Total filas procesadas del Excel: {len(df)}")
    print(f"  Nuevos clientes insertados: {insertados}")
    print(f"  Clientes existentes actualizados: {actualizados}")
    print(f"  Clientes sin cambios detectados: {sin_cambios}")
    print(f"  Errores encontrados: {errores}")

if __name__ == '__main__':
    main()
