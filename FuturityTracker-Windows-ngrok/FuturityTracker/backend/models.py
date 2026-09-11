from sqlalchemy import Column, Integer, String, Float, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from time import time
def now_ms():
    return int(time() * 1000)
from database import Base

class Device(Base):
    __tablename__ = "devices"

    device_id = Column(String, primary_key=True, index=True)
    device_model = Column(String, nullable=False)
    android_version = Column(String, nullable=False)
    first_seen = Column(BigInteger, default=now_ms)
    last_seen = Column(BigInteger, default=now_ms, index=True)
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    battery_level = Column(Integer, nullable=True)
    is_charging = Column(Boolean, default=False)
    network_type = Column(String, nullable=True)
    last_status_event = Column(String, default="TRACKING_ACTIVE")
    last_status_message = Column(String, default="Seguimiento Activo")

    last_location_timestamp = Column(BigInteger, nullable=True)
    last_status_timestamp = Column(BigInteger, nullable=True)
    gps_enabled = Column(Boolean, nullable=True)
    tracking_enabled = Column(Boolean, nullable=True)
    locations = relationship("LocationRecord", back_populates="device", cascade="all, delete-orphan")


class LocationRecord(Base):
    __tablename__ = "location_records"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True, nullable=False)
    device_id = Column(String, ForeignKey("devices.device_id"), index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=False)
    speed = Column(Float, nullable=False, default=0.0)
    bearing = Column(Float, nullable=False, default=0.0)
    altitude = Column(Float, nullable=False, default=0.0)
    battery_level = Column(Integer, nullable=False)
    is_charging = Column(Boolean, default=False)
    network_type = Column(String, nullable=False)
    provider = Column(String, nullable=False, default="fused")
    timestamp = Column(BigInteger, nullable=False, index=True)
    created_at = Column(BigInteger, default=now_ms)

    device = relationship("Device", back_populates="locations")


class DeviceCredential(Base):
    __tablename__ = 'device_credentials'
    device_id = Column(String, primary_key=True)
    token_hash = Column(String(64), unique=True, nullable=False)

class StatusEvent(Base):
    __tablename__ = 'status_events'
    uuid = Column(String, primary_key=True)
    device_id = Column(String, index=True, nullable=False)
    status_event = Column(String, nullable=False)
    timestamp = Column(BigInteger, nullable=False)
    received_at = Column(BigInteger, nullable=False, default=now_ms)


class DeviceProfile(Base):
    __tablename__ = 'device_profiles'
    device_id = Column(String, ForeignKey('devices.device_id'), primary_key=True)
    display_name = Column(String(100), nullable=False, default='')
    technician = Column(String(100), nullable=False, default='')
    area = Column(String(50), nullable=False, default='')
    vehicle_plate = Column(String(30), nullable=False, default='')
    atlas_technician_id = Column(Integer, nullable=True)
