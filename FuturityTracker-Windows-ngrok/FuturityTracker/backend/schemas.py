from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from time import time
DeviceId = Annotated[str, Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_.:-]+$')]
class LocationRecordCreate(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    uuid: UUID
    device_id: DeviceId
    device_model: str = Field(min_length=1, max_length=120)
    android_version: str = Field(min_length=1, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=10000)
    speed: float = Field(default=0, ge=0, le=400)
    bearing: float = Field(default=0, ge=0, le=360)
    altitude: float = Field(default=0, ge=-15000, le=100000)
    battery_level: int = Field(ge=-1, le=100)
    is_charging: bool
    network_type: str = Field(max_length=40)
    provider: str = Field(default='fused', max_length=40)
    timestamp: int = Field(gt=0)
    @field_validator('timestamp')
    @classmethod
    def not_future(cls, value):
        if value > int(time()*1000) + 300000:
            raise ValueError('Timestamp exceeds allowed clock skew (5 minutes)')
        return value
class LocationBatchCreate(BaseModel):
    records: list[LocationRecordCreate] = Field(min_length=1, max_length=100)
class DeviceStatusEventRequest(BaseModel):
    uuid: UUID
    device_id: DeviceId
    device_model: str = Field(min_length=1, max_length=120)
    android_version: str = Field(min_length=1, max_length=80)
    status_event: Literal['HEARTBEAT','TRACKING_STARTED','TRACKING_STOPPED','GPS_DISABLED','GPS_ENABLED','PERMISSION_MISSING']
    message: str = Field(default='', max_length=300)
    timestamp: int = Field(gt=0)
    battery_level: int = Field(default=-1, ge=-1, le=100)
    is_charging: bool = False
    network_type: str = Field(default='UNKNOWN', max_length=40)
    gps_enabled: bool = False
    tracking_enabled: bool = False
    _clock = field_validator('timestamp')(LocationRecordCreate.not_future.__func__)
class SyncResponse(BaseModel):
    status: str = 'success'
    received_count: int
    synced_uuids: list[str]
class CredentialRequest(BaseModel):
    device_id: DeviceId
class LocationRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    device_id: str
    latitude: float
    longitude: float
    accuracy: float
    speed: float
    bearing: float
    altitude: float
    battery_level: int
    is_charging: bool
    network_type: str
    provider: str
    timestamp: int


class DeviceProfileUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    display_name: str = Field(default='', max_length=100)
    technician: str = Field(default='', max_length=100)
    area: str = Field(default='', max_length=50)
    vehicle_plate: str = Field(default='', max_length=30)
    atlas_technician_id: int | None = Field(default=None, gt=0)
