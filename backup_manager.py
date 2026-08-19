import os
import sys
import gzip
import shutil
import zipfile
import subprocess
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Forzar codificación UTF-8 en salida de consola de Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Cargar variables de entorno
load_dotenv()

# Configuración de base de datos
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'Futurity2026')
DB_DATABASE = os.environ.get('DB_DATABASE', 'optimizador_rutas')

# Configuración de Cloudflare R2
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '').strip()
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '').strip()
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '').strip()
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'futurity-backups').strip()

# Directorios de respaldo
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUPS_DIR = os.path.join(BASE_DIR, 'backups')
DB_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'db')
UPLOADS_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'uploads')
UPLOADS_SOURCE_DIR = os.path.join(BASE_DIR, 'static', 'uploads')

os.makedirs(DB_BACKUPS_DIR, exist_ok=True)
os.makedirs(UPLOADS_BACKUPS_DIR, exist_ok=True)

def find_mysqldump():
    """Localiza el ejecutable de mysqldump en el sistema."""
    path_dump = shutil.which('mysqldump')
    if path_dump:
        return path_dump

    known_paths = [
        r'C:\Program Files\MySQL\MySQL Server 9.7\bin\mysqldump.exe',
        r'C:\Program Files\MySQL\MySQL Server 9.0\bin\mysqldump.exe',
        r'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe',
        r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe',
        r'C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysqldump.exe',
        r'C:\xampp\mysql\bin\mysqldump.exe',
        r'C:\laragon\bin\mysql\bin\mysqldump.exe',
        r'C:\wamp64\bin\mysql\bin\mysqldump.exe'
    ]
    for p in known_paths:
        if os.path.exists(p):
            return p
    return None

def get_r2_client():
    """Inicializa el cliente de Cloudflare R2 usando boto3 (S3 API)."""
    if not (R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY):
        return None
    try:
        import boto3
        from botocore.config import Config
        
        endpoint = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        return s3
    except Exception as e:
        print(f"[R2] Error al conectar con Cloudflare R2: {e}")
        return None

def upload_to_r2(s3_client, file_path, r2_key):
    """Sube un archivo local a Cloudflare R2."""
    if not s3_client:
        return False
    try:
        print(f"[R2] Subiendo {os.path.basename(file_path)} a Cloudflare R2 (bucket: {R2_BUCKET_NAME})...")
        s3_client.upload_file(file_path, R2_BUCKET_NAME, r2_key)
        print(f"[R2] Subida completada con exito: {r2_key}")
        return True
    except Exception as e:
        print(f"[R2] Error subiendo a R2 ({r2_key}): {e}")
        return False

def backup_database(timestamp_str):
    """Genera un volcado completo de la BD MySQL y lo comprime en .sql.gz."""
    mysqldump_bin = find_mysqldump()
    if not mysqldump_bin:
        print("[BD] Error: No se encontro mysqldump.exe en el sistema.")
        return None

    raw_sql_path = os.path.join(DB_BACKUPS_DIR, f"backup_{DB_DATABASE}_{timestamp_str}.sql")
    gz_sql_path = f"{raw_sql_path}.gz"

    cmd = [
        mysqldump_bin,
        f"-h{DB_HOST}",
        f"-u{DB_USER}",
        f"-p{DB_PASSWORD}",
        "--routines",
        "--triggers",
        "--single-transaction",
        "--quick",
        "--databases",
        DB_DATABASE
    ]

    print(f"[BD] Exportando base de datos '{DB_DATABASE}' con {os.path.basename(mysqldump_bin)}...")
    try:
        with open(raw_sql_path, 'wb') as f_out:
            result = subprocess.run(cmd, stdout=f_out, stderr=subprocess.PIPE, check=True)

        # Comprimir a .gz
        with open(raw_sql_path, 'rb') as f_in:
            with gzip.open(gz_sql_path, 'wb') as f_gz:
                shutil.copyfileobj(f_in, f_gz)

        # Eliminar el .sql plano para ahorrar espacio
        if os.path.exists(raw_sql_path):
            os.remove(raw_sql_path)

        size_mb = os.path.getsize(gz_sql_path) / (1024 * 1024)
        print(f"[BD] Backup de BD completado: {os.path.basename(gz_sql_path)} ({size_mb:.2f} MB)")
        return gz_sql_path
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.decode('utf-8', errors='ignore') if e.stderr else str(e)
        print(f"[BD] Error al ejecutar mysqldump: {err_msg}")
        if os.path.exists(raw_sql_path):
            os.remove(raw_sql_path)
        return None

def backup_uploads(timestamp_str):
    """Comprime la carpeta de fotos y firmas static/uploads en un archivo .zip."""
    if not os.path.exists(UPLOADS_SOURCE_DIR):
        print("[FOTOS] La carpeta static/uploads no existe aun. Omitiendo.")
        return None

    zip_filename = f"uploads_{timestamp_str}.zip"
    zip_path = os.path.join(UPLOADS_BACKUPS_DIR, zip_filename)

    print("[FOTOS] Comprimiendo evidencias y fotos de static/uploads/...")
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(UPLOADS_SOURCE_DIR):
                for file in files:
                    file_full_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_full_path, UPLOADS_SOURCE_DIR)
                    zipf.write(file_full_path, arcname)

        size_mb = os.path.getsize(zip_path) / (1024 * 1024)
        print(f"[FOTOS] Backup de fotos completado: {zip_filename} ({size_mb:.2f} MB)")
        return zip_path
    except Exception as e:
        print(f"[FOTOS] Error al comprimir fotos: {e}")
        return None

def rotate_local_backups(days_to_keep=30):
    """Elimina respaldos locales más antiguos a N días."""
    cutoff_date = datetime.now() - timedelta(days=days_to_keep)
    print(f"[LIMPIEZA] Verificando respaldos locales anteriores a {cutoff_date.strftime('%Y-%m-%d')}...")

    deleted_count = 0
    for target_dir in [DB_BACKUPS_DIR, UPLOADS_BACKUPS_DIR]:
        if not os.path.exists(target_dir):
            continue
        for fname in os.listdir(target_dir):
            fpath = os.path.join(target_dir, fname)
            if os.path.isfile(fpath):
                file_time = datetime.fromtimestamp(os.path.getmtime(fpath))
                if file_time < cutoff_date:
                    try:
                        os.remove(fpath)
                        deleted_count += 1
                        print(f"  - Eliminado por antiguedad: {fname}")
                    except Exception as e:
                        print(f"  - Error eliminando {fname}: {e}")

    print(f"[LIMPIEZA] Limpieza local finalizada ({deleted_count} archivos eliminados).")

def run_full_backup():
    """Ejecuta el ciclo completo de respaldo local y en la nube R2."""
    now = datetime.now()
    timestamp_str = now.strftime('%Y-%m-%d_%H%M%S')
    print("=" * 65)
    print(f"INICIANDO RESPALDO COMPLETO FUTURITY ATLAS [{now.strftime('%Y-%m-%d %H:%M:%S')}]")
    print("=" * 65)

    # 1. Respaldo de Base de Datos
    db_file = backup_database(timestamp_str)

    # 2. Respaldo de Fotos y Firmas
    uploads_file = backup_uploads(timestamp_str)

    # 3. Subir a Cloudflare R2 si está configurado
    r2_client = get_r2_client()
    if r2_client:
        if db_file and os.path.exists(db_file):
            r2_key = f"db/{now.strftime('%Y-%m')}/{os.path.basename(db_file)}"
            upload_to_r2(r2_client, db_file, r2_key)

        if uploads_file and os.path.exists(uploads_file):
            r2_key = f"uploads/{now.strftime('%Y-%m')}/{os.path.basename(uploads_file)}"
            upload_to_r2(r2_client, uploads_file, r2_key)
    else:
        print("[R2] Info: Cloudflare R2 aun no configurado en .env. Respaldo guardado 100% en disco local.")

    # 4. Rotación local (30 días)
    rotate_local_backups(days_to_keep=30)

    print("=" * 65)
    print("RESPALDO FINALIZADO EXITOSAMENTE")
    print("=" * 65)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--test-r2':
        print("[R2] Probando conexion a Cloudflare R2...")
        client = get_r2_client()
        if client:
            try:
                buckets = client.list_buckets()
                names = [b['Name'] for b in buckets.get('Buckets', [])]
                print(f"[R2] Conexion exitosa! Buckets disponibles: {names}")
            except Exception as e:
                print(f"[R2] Error listando buckets: {e}")
        else:
            print("[R2] Faltan credenciales R2 en .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).")
    else:
        run_full_backup()
