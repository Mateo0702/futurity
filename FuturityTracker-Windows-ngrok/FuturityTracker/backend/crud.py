from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
import models

def insert_ignore(db, model, values, key):
    insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else pg_insert
    return db.execute(insert(model).values(**values).on_conflict_do_nothing(index_elements=[key])).rowcount == 1

def ensure_device(db, record):
    insert_ignore(db, models.Device, dict(device_id=record.device_id,
        device_model=record.device_model, android_version=record.android_version,
        first_seen=models.now_ms(), last_seen=0), 'device_id')

def insert_batch_location_records(db, records):
    # One transaction per batch; unique constraints provide concurrent idempotency.
    uuids=[]
    for record in records:
        ensure_device(db,record)
        values=record.model_dump(exclude={'device_model','android_version'})
        values['uuid']=str(record.uuid)
        insert_ignore(db,models.LocationRecord,values,'uuid')
        saved=db.get(models.LocationRecord, db.scalar(select(models.LocationRecord.id).where(models.LocationRecord.uuid==str(record.uuid))))
        if saved.device_id != record.device_id:
            raise ValueError('UUID belongs to another device')
        # Retries with the same UUID cannot replace an already acknowledged record.
        db.execute(update(models.Device).where(models.Device.device_id==record.device_id).values(last_seen=models.now_ms()))
        db.execute(update(models.Device).where(models.Device.device_id==record.device_id,
            (models.Device.last_location_timestamp.is_(None)) | (models.Device.last_location_timestamp < saved.timestamp)
        ).values(last_latitude=saved.latitude,last_longitude=saved.longitude,last_location_timestamp=saved.timestamp))
        uuids.append(str(record.uuid))
    db.commit()
    return uuids

def update_device_status_event(db,event):
    ensure_device(db,event)
    inserted = insert_ignore(db, models.StatusEvent, dict(uuid=str(event.uuid),device_id=event.device_id,
        status_event=event.status_event,timestamp=event.timestamp,received_at=models.now_ms()),'uuid')
    existing=db.get(models.StatusEvent,str(event.uuid))
    if existing.device_id!=event.device_id:
        raise ValueError('UUID belongs to another device')
    db.execute(update(models.Device).where(models.Device.device_id==event.device_id).values(last_seen=models.now_ms()))
    # A retry acknowledges the original event and cannot rewrite its telemetry.
    if not inserted:
        db.commit()
        return str(event.uuid)
    db.execute(update(models.Device).where(models.Device.device_id==event.device_id,
        models.Device.last_status_timestamp.is_(None) | (models.Device.last_status_timestamp < event.timestamp)
    ).values(last_status_timestamp=event.timestamp,last_status_event=event.status_event,
        last_status_message=event.message,tracking_enabled=event.tracking_enabled,
        gps_enabled=event.gps_enabled,battery_level=event.battery_level,is_charging=event.is_charging,
        network_type=event.network_type,device_model=event.device_model,android_version=event.android_version))
    db.commit()
    return str(event.uuid)

def get_all_devices(db, offline_threshold_ms):
    now=models.now_ms()
    result=[]
    query = select(models.Device, models.DeviceProfile).outerjoin(
        models.DeviceProfile, models.DeviceProfile.device_id == models.Device.device_id
    ).order_by(models.Device.device_id)
    for d, profile in db.execute(query):
        values={c.name:getattr(d,c.name) for c in models.Device.__table__.columns}
        for field in ['display_name','technician','area','vehicle_plate','atlas_technician_id']:
            values[field]=getattr(profile,field) if profile else (None if field=='atlas_technician_id' else '')
        values['is_online']=0 <= now-d.last_seen <= offline_threshold_ms
        values['telemetry_stale']=d.last_status_timestamp is None or now-d.last_status_timestamp>offline_threshold_ms
        result.append(values)
    return result

def get_latest_location(db,device_id):
    return db.scalar(select(models.LocationRecord).where(models.LocationRecord.device_id==device_id).order_by(models.LocationRecord.timestamp.desc(),models.LocationRecord.id.desc()).limit(1))
