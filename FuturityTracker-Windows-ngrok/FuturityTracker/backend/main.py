import hashlib, hmac, secrets
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text, update
from sqlalchemy.orm import Session
from database import engine, get_db
from config import settings
from migrations import migrate
import models, schemas, crud

security=HTTPBearer(auto_error=False)
def digest(token): return hashlib.sha256(token.encode()).hexdigest()
def require_admin(credentials: HTTPAuthorizationCredentials=Depends(security)):
    if not settings.ADMIN_TOKEN or len(settings.ADMIN_TOKEN)<12:
        raise HTTPException(503,'Configure ADMIN_TOKEN (at least 12 characters) with setup.py')
    if credentials is None or not hmac.compare_digest(digest(credentials.credentials),digest(settings.ADMIN_TOKEN)):
        raise HTTPException(401,'Invalid administrator credential',headers={'WWW-Authenticate':'Bearer'})
def require_device(credentials: HTTPAuthorizationCredentials=Depends(security),db: Session=Depends(get_db)):
    if credentials is None: raise HTTPException(401,'Device credential required')
    credential=db.scalar(select(models.DeviceCredential).where(models.DeviceCredential.token_hash==digest(credentials.credentials)))
    if credential is None: raise HTTPException(401,'Invalid or revoked device credential')
    return credential.device_id
def match_device(expected, records):
    if any(r.device_id != expected for r in records): raise HTTPException(403,'Device identity mismatch')

@asynccontextmanager
async def lifespan(app):
    if len(settings.ADMIN_TOKEN)<12:
        raise RuntimeError('Configure ADMIN_TOKEN with at least 12 characters before starting the server')
    migrate(engine)
    yield
app=FastAPI(title=settings.APP_NAME,version='1.2.0',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
origins=[v.strip() for v in settings.CORS_ORIGINS.split(',') if v.strip()]
if origins:
    app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,
        allow_methods=['GET','POST','PUT','DELETE'],allow_headers=['Authorization','Content-Type'])
@app.middleware('http')
async def headers(request: Request,call_next):
    length=request.headers.get('content-length','0')
    if length.isdigit() and int(length)>262144:
        from fastapi.responses import JSONResponse
        return JSONResponse({'detail':'Request too large'},status_code=413)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Cache-Control']='no-store'
    response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'"
    return response
@app.get('/health')
def health(db: Session=Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'status':'ok','version':'1.2.0'}
@app.post('/api/v1/admin/device-tokens',dependencies=[Depends(require_admin)])
def issue_token(request: schemas.CredentialRequest,db: Session=Depends(get_db)):
    token=secrets.token_urlsafe(32)
    credential=db.get(models.DeviceCredential,request.device_id)
    if credential: credential.token_hash=digest(token)
    else: db.add(models.DeviceCredential(device_id=request.device_id,token_hash=digest(token)))
    db.commit()
    return {'device_id':request.device_id,'token':token}
@app.delete('/api/v1/admin/device-tokens/{device_id}',dependencies=[Depends(require_admin)])
def revoke_token(device_id: str,db: Session=Depends(get_db)):
    credential=db.get(models.DeviceCredential,device_id)
    if credential: db.delete(credential); db.commit()
    return {'status':'revoked'}
@app.post('/api/v1/location',response_model=schemas.SyncResponse)
def single(record: schemas.LocationRecordCreate,device_id=Depends(require_device),db: Session=Depends(get_db)):
    return receive(schemas.LocationBatchCreate(records=[record]),device_id,db)
@app.post('/api/v1/locations/batch',response_model=schemas.SyncResponse)
def receive(batch: schemas.LocationBatchCreate,device_id=Depends(require_device),db: Session=Depends(get_db)):
    match_device(device_id,batch.records)
    try: ids=crud.insert_batch_location_records(db,batch.records)
    except ValueError as e: db.rollback(); raise HTTPException(409,str(e))
    return schemas.SyncResponse(received_count=len(ids),synced_uuids=ids)
@app.post('/api/v1/device/status',response_model=schemas.SyncResponse)
def status(event: schemas.DeviceStatusEventRequest,device_id=Depends(require_device),db: Session=Depends(get_db)):
    match_device(device_id,[event])
    try: uid=crud.update_device_status_event(db,event)
    except ValueError as e: db.rollback(); raise HTTPException(409,str(e))
    return schemas.SyncResponse(received_count=1,synced_uuids=[uid])
@app.get('/api/v1/devices',dependencies=[Depends(require_admin)])
def devices(db: Session=Depends(get_db)):
    return crud.get_all_devices(db,settings.OFFLINE_THRESHOLD_SECONDS*1000)
@app.get('/api/v1/devices/{device_id}/latest',response_model=schemas.LocationRecordResponse,dependencies=[Depends(require_admin)])
def latest(device_id: str,db: Session=Depends(get_db)):
    record=crud.get_latest_location(db,device_id)
    if record is None: raise HTTPException(404,'No positions yet')
    return record
@app.get('/api/v1/devices/{device_id}/history',dependencies=[Depends(require_admin)])
def history(device_id: str,from_time: int=Query(0,ge=0),to_time: int=Query(0,ge=0),
    after_timestamp: int=Query(0,ge=0),after_id: int=Query(0,ge=0),limit: int=Query(1000,ge=1,le=2000),
    snapshot_id: int=Query(0,ge=0),db: Session=Depends(get_db)):
    from sqlalchemy import func, or_, and_
    if to_time and to_time<from_time: raise HTTPException(422,'Invalid date interval')
    if not snapshot_id: snapshot_id=db.scalar(select(func.max(models.LocationRecord.id))) or 0
    q=select(models.LocationRecord).where(models.LocationRecord.device_id==device_id,models.LocationRecord.id<=snapshot_id,
        models.LocationRecord.timestamp>=from_time)
    if to_time: q=q.where(models.LocationRecord.timestamp<=to_time)
    q=q.where(or_(models.LocationRecord.timestamp>after_timestamp,and_(models.LocationRecord.timestamp==after_timestamp,models.LocationRecord.id>after_id)))
    rows=list(db.scalars(q.order_by(models.LocationRecord.timestamp,models.LocationRecord.id).limit(limit+1)))
    more=len(rows)>limit; rows=rows[:limit]
    cursor={'after_timestamp':rows[-1].timestamp,'after_id':rows[-1].id} if more else None
    return {'records':[schemas.LocationRecordResponse.model_validate(r).model_dump() for r in rows],
        'next_cursor':cursor,'snapshot_id':snapshot_id}
@app.put('/api/v1/admin/device-profiles/{device_id}', dependencies=[Depends(require_admin)])
def update_device_profile(device_id: str, profile: schemas.DeviceProfileUpdate, db: Session=Depends(get_db)):
    if db.get(models.Device, device_id) is None:
        raise HTTPException(404, 'Device must send its first authenticated contact before assignment')
    row = db.get(models.DeviceProfile, device_id)
    if row is None:
        row = models.DeviceProfile(device_id=device_id)
        db.add(row)
    for field, value in profile.model_dump().items():
        setattr(row, field, value)
    db.commit()
    return {'device_id': device_id, **profile.model_dump()}

@app.get('/')
def index():
    from fastapi.responses import RedirectResponse
    return RedirectResponse('./dashboard/')

dashboard=Path(__file__).resolve().parent.parent/'dashboard'
if dashboard.exists(): app.mount('/dashboard',StaticFiles(directory=dashboard,html=True),name='dashboard')
if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8810)
