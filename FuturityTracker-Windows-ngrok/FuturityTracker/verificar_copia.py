"""Verify the received package BEFORE its first start; prints no credentials."""
import hashlib
import json
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'MANIFIESTO.json').read_text(encoding='utf-8'))
for name, expected in manifest['files_sha256'].items():
    path = (root / name).resolve()
    if not path.is_relative_to(root) or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise SystemExit('Archivo ausente o diferente: ' + name)
with sqlite3.connect((root / 'backend' / 'futurity_tracker.db').as_uri() + '?mode=ro', uri=True) as db:
    if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
        raise SystemExit('Base inconsistente')
    for table in ('devices', 'device_credentials', 'device_profiles', 'location_records', 'status_events'):
        count = db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
        if count != manifest['counts'][table]:
            raise SystemExit('Recuento diferente: ' + table)
print('Copia verificada. Fecha UTC:', manifest['snapshot_utc'])
print('Recuentos:', json.dumps(manifest['counts']))
