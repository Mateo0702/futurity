import sys
sys.path.append(r'c:\Users\mateo\OneDrive\Documentos\Futurity_git\futurity')
from db_config import get_db_connection

conn = get_db_connection()
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id_tecnico, nombre, area_trabajo, placa_vehiculo, foto_vehiculo FROM tecnicos")
rows = cursor.fetchall()
for r in rows:
    print(r)
cursor.close()
conn.close()
