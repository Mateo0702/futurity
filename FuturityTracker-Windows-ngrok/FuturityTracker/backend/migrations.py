from sqlalchemy import inspect, text
from database import Base
import models
def migrate(engine):
    # Additive migration: existing location data and timestamps are never rewritten.
    Base.metadata.create_all(engine)
    columns = {c['name'] for c in inspect(engine).get_columns('devices')}
    additions = {
        'last_status_event': 'VARCHAR', 'last_status_message': 'VARCHAR',
        'last_location_timestamp': 'BIGINT', 'last_status_timestamp': 'BIGINT',
        'gps_enabled': 'BOOLEAN', 'tracking_enabled': 'BOOLEAN'
    }
    with engine.begin() as conn:
        for name, kind in additions.items():
            if name not in columns:
                conn.execute(text(f'ALTER TABLE devices ADD COLUMN {name} {kind}'))
        conn.execute(text('UPDATE devices SET last_location_timestamp = (SELECT MAX(timestamp) FROM location_records WHERE location_records.device_id=devices.device_id), last_latitude = (SELECT latitude FROM location_records WHERE location_records.device_id=devices.device_id ORDER BY timestamp DESC, id DESC LIMIT 1), last_longitude = (SELECT longitude FROM location_records WHERE location_records.device_id=devices.device_id ORDER BY timestamp DESC, id DESC LIMIT 1) WHERE last_location_timestamp IS NULL'))
        # Legacy last_seen was timezone-dependent. Until an authenticated contact,
        # presence is unknown instead of treating a future legacy date as online.
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_location_device_time ON location_records(device_id, timestamp, id)'))
        conn.execute(text('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)'))
        if not conn.execute(text('SELECT version FROM schema_migrations WHERE version=2')).first():
            conn.execute(text('UPDATE devices SET last_seen=0'))
            conn.execute(text('INSERT INTO schema_migrations(version) VALUES (2)'))
