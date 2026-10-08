import React, { useState, useEffect, useRef } from 'react';

const L = window.L;

function MapaTrackerTab({ token }) {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tecnicos, setTecnicos] = useState([]);

  // Playback / History state
  const [historyMode, setHistoryMode] = useState(false);
  const [historyDevice, setHistoryDevice] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetDevice, setAssignTargetDevice] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenDeviceName, setTokenDeviceName] = useState('');
  const [tokenDeviceSerial, setTokenDeviceSerial] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  // Refs for Map & Leaflet objects
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const historyMarkerRef = useRef(null);
  const timerRef = useRef(null);
  const autoRefreshTimerRef = useRef(null);

  // Fetch devices and technicians
  const fetchDevices = async () => {
    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('session_token');
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch('/api/v1/devices', { headers });
      const data = await res.json();
      if (res.ok) {
        const rawList = Array.isArray(data) ? data : (data.devices || []);
        const normalized = rawList.map(d => ({
          id: d.device_id || d.id,
          name: d.profile?.display_name || d.device_id || d.id,
          serial_number: d.device_id || d.serial_number,
          online: d.is_online !== undefined ? d.is_online : (d.online || false),
          battery_level: d.battery_level,
          network_type: d.network_type || '4G/GPS',
          is_charging: d.is_charging || false,
          latitude: d.last_latitude !== undefined ? d.last_latitude : d.latitude,
          longitude: d.last_longitude !== undefined ? d.last_longitude : d.longitude,
          speed: d.speed || 0,
          altitude: d.altitude || 0,
          timestamp: d.last_seen ? new Date(d.last_seen).toISOString() : d.timestamp,
          technician_id: d.profile?.atlas_technician_id || d.technician_id,
          technician_nombre: d.profile?.technician || d.technician_nombre
        }));
        setDevices(normalized);
      }
    } catch (e) {
      console.error("Error al cargar dispositivos PMT:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTecnicos = async () => {
    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('session_token');
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch('/api/admin/tecnicos', { headers });
      if (res.ok) {
        const data = await res.json();
        setTecnicos(Array.isArray(data) ? data : (data.tecnicos || []));
      }
    } catch (e) {
      console.error("Error al cargar lista de técnicos:", e);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchTecnicos();

    // Auto refresh live positions every 10s
    autoRefreshTimerRef.current = setInterval(() => {
      fetchDevices();
    }, 10000);

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, [token]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Cuenca - Ecuador by default
    const map = L.map(mapContainerRef.current, {
      center: [-2.896829, -78.975419],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Live Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || historyMode) return;

    // Clear old markers if device no longer exists
    const deviceIds = new Set(devices.map(d => d.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!deviceIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    const bounds = [];

    devices.forEach(dev => {
      if (dev.latitude == null || dev.longitude == null) return;

      const lat = parseFloat(dev.latitude);
      const lon = parseFloat(dev.longitude);
      if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) return;

      bounds.push([lat, lon]);

      const isOnline = dev.online;
      const statusColor = isOnline ? '#10b981' : '#64748b';
      const isSelected = selectedDeviceId === dev.id;

      const markerHtml = `
        <div style="
          position: relative;
          width: ${isSelected ? '38px' : '32px'};
          height: ${isSelected ? '38px' : '32px'};
          background: ${isOnline ? '#064e3b' : '#1e293b'};
          border: 3px solid ${statusColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          transition: all 0.3s ease;
        ">
          <i class="fa-solid fa-satellite-dish" style="font-size: ${isSelected ? '16px' : '14px'}; color: ${isOnline ? '#34d399' : '#94a3b8'};"></i>
          ${isOnline ? `<div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 10px;
            height: 10px;
            background: #10b981;
            border: 2px solid #ffffff;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
          "></div>` : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-tracker-marker',
        html: markerHtml,
        iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
        iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16]
      });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; color: #1e293b; min-width: 200px;">
          <div style="font-weight: 700; font-size: 15px; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span>${dev.name || 'Dispositivo PMT'}</span>
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 99px; background: ${isOnline ? '#dcfce7' : '#f1f5f9'}; color: ${isOnline ? '#15803d' : '#64748b'}; font-weight: 600;">
              ${isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
            SN: ${dev.serial_number || dev.id}
          </div>
          ${dev.technician_nombre ? `
            <div style="font-size: 13px; color: #2563eb; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-user-gear"></i> ${dev.technician_nombre}
            </div>
          ` : '<div style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 6px;">Sin técnico asignado</div>'}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div>⚡ Batería: <strong>${dev.battery_level != null ? dev.battery_level + '%' : 'N/D'}</strong></div>
            <div>📶 Red: <strong>${dev.network_type || 'GPS'}</strong></div>
            <div>🚗 Vel: <strong>${dev.speed != null ? Math.round(dev.speed) + ' km/h' : '0 km/h'}</strong></div>
            <div>⏱️ Última: <strong>${dev.timestamp ? new Date(dev.timestamp).toLocaleTimeString() : 'N/D'}</strong></div>
          </div>
        </div>
      `;

      if (markersRef.current[dev.id]) {
        markersRef.current[dev.id].setLatLng([lat, lon]);
        markersRef.current[dev.id].setIcon(customIcon);
        markersRef.current[dev.id].setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setSelectedDeviceId(dev.id);
        });
        markersRef.current[dev.id] = marker;
      }
    });

    // Auto fit bounds on initial load if bounds exist
    if (bounds.length > 0 && !selectedDeviceId) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [devices, selectedDeviceId, historyMode]);

  // Center map on selected device
  const handleSelectDevice = (dev) => {
    setSelectedDeviceId(dev.id);
    if (dev.latitude != null && dev.longitude != null && mapInstanceRef.current) {
      const lat = parseFloat(dev.latitude);
      const lon = parseFloat(dev.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1 });
        if (markersRef.current[dev.id]) {
          markersRef.current[dev.id].openPopup();
        }
      }
    }
  };

  // Load Device History (Recorrido Histórico)
  const handleStartHistory = async (dev) => {
    setHistoryDevice(dev);
    setHistoryMode(true);
    setIsPlaying(false);
    setPlaybackIndex(0);
    setHistoryLoading(true);

    const startTime = `${historyDate}T00:00:00`;
    const endTime = `${historyDate}T23:59:59`;

    try {
      const res = await fetch(`/api/v1/devices/${dev.id}/history?start_time=${startTime}&end_time=${endTime}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setHistoryData(data.history || []);
        renderHistoryOnMap(data.history || []);
      } else {
        setHistoryData([]);
      }
    } catch (e) {
      console.error("Error cargando historial de dispositivo:", e);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderHistoryOnMap = (pts) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear live markers layer
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    if (polylineRef.current) map.removeLayer(polylineRef.current);
    if (historyMarkerRef.current) map.removeLayer(historyMarkerRef.current);

    if (!pts || pts.length === 0) return;

    const latLngs = pts.map(p => [p.latitude, p.longitude]);

    // Draw route line
    polylineRef.current = L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.8,
      dashArray: '8, 8',
      lineJoin: 'round'
    }).addTo(map);

    // Add Start Marker
    const startPoint = latLngs[0];
    const startIcon = L.divIcon({
      className: 'history-start-marker',
      html: `<div style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white;">A</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker(startPoint, { icon: startIcon }).addTo(map).bindPopup("Punto Inicio");

    // Add End Marker
    const endPoint = latLngs[latLngs.length - 1];
    const endIcon = L.divIcon({
      className: 'history-end-marker',
      html: `<div style="background: #ef4444; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white;">B</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker(endPoint, { icon: endIcon }).addTo(map).bindPopup("Punto Final");

    // Add Moving Marker
    const currentIcon = L.divIcon({
      className: 'history-playback-marker',
      html: `<div style="background: #3b82f6; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(59,130,246,0.5);"><i class="fa-solid fa-car-side"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    historyMarkerRef.current = L.marker(startPoint, { icon: currentIcon }).addTo(map);

    map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
  };

  // Handle Playback Interval
  useEffect(() => {
    if (isPlaying && historyData.length > 0) {
      timerRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= historyData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, historyData, playbackSpeed]);

  // Update Moving Marker position when playbackIndex changes
  useEffect(() => {
    if (!historyMode || !historyData[playbackIndex] || !historyMarkerRef.current || !mapInstanceRef.current) return;
    const pt = historyData[playbackIndex];
    const latLng = [pt.latitude, pt.longitude];
    historyMarkerRef.current.setLatLng(latLng);
    mapInstanceRef.current.panTo(latLng, { animate: true, duration: 0.3 });
  }, [playbackIndex, historyData, historyMode]);

  const exitHistoryMode = () => {
    setHistoryMode(false);
    setHistoryData([]);
    setHistoryDevice(null);
    setIsPlaying(false);
    if (polylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
    }
    if (historyMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(historyMarkerRef.current);
    }
    fetchDevices();
  };

  // Open Technician Assign Modal
  const openAssignModal = (dev) => {
    setAssignTargetDevice(dev);
    setSelectedTechId(dev.technician_id || '');
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignTargetDevice) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/v1/admin/device-profiles/${assignTargetDevice.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          atlas_technician_id: selectedTechId ? parseInt(selectedTechId) : null
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setShowAssignModal(false);
        fetchDevices();
      } else {
        alert(data.error || 'Error al guardar asignación');
      }
    } catch (e) {
      console.error("Error al asignar técnico:", e);
      alert("Error de conexión al servidor");
    } finally {
      setAssigning(false);
    }
  };

  // Generate New Device Token Modal
  const handleGenerateToken = async () => {
    if (!tokenDeviceName.trim()) {
      alert("Por favor ingrese el nombre del dispositivo");
      return;
    }
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/v1/admin/device-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_id: tokenDeviceName.trim().toLowerCase().replace(/\s+/g, '-'),
          device_name: tokenDeviceName.trim(),
          serial_number: tokenDeviceSerial.trim()
        })
      });
      const data = await res.json();
      if (res.ok && (data.token || data.status === 'ok')) {
        setGeneratedToken(data.token || data.raw_token);
        fetchDevices();
      } else {
        alert(data.error || 'Error al generar token');
      }
    } catch (e) {
      console.error("Error generando token:", e);
      alert("Error de conexión al servidor");
    } finally {
      setGeneratingToken(false);
    }
  };

  // Filtered devices
  const filteredDevices = devices.filter(dev => {
    const term = searchTerm.toLowerCase();
    return (
      (dev.name && dev.name.toLowerCase().includes(term)) ||
      (dev.serial_number && dev.serial_number.toLowerCase().includes(term)) ||
      (dev.technician_nombre && dev.technician_nombre.toLowerCase().includes(term)) ||
      dev.id.toLowerCase().includes(term)
    );
  });

  const totalOnline = devices.filter(d => d.online).length;
  const totalOffline = devices.length - totalOnline;
  const totalLowBattery = devices.filter(d => d.battery_level != null && d.battery_level <= 20).length;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', position: 'relative', background: 'var(--bg-color)' }}>
      {/* Sidebar Panel */}
      <div style={{
        width: '380px',
        minWidth: '380px',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--card-bg, #0f172a)',
        zIndex: 10
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <i className="fa-solid fa-satellite-dish"></i>
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--sidebar-text, #ffffff)' }}>
                  Rastreo PMT Tracker
                </h2>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Futurity GPS</span>
              </div>
            </div>
            <button
              onClick={() => {
                setGeneratedToken(null);
                setTokenDeviceName('');
                setTokenDeviceSerial('');
                setShowTokenModal(true);
              }}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#38bdf8',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Registrar nuevo token de rastreador"
            >
              <i className="fa-solid fa-plus"></i> Nuevo
            </button>
          </div>

          {/* Stats Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>{devices.length}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#34d399' }}>Online</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{totalOnline}</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#f87171' }}>Baja Batería</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{totalLowBattery}</div>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}></i>
            <input
              type="text"
              placeholder="Buscar por dispositivo, SN o técnico..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px 8px 36px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Devices List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
              <div>Cargando rastreadores...</div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <i className="fa-solid fa-satellite-dish" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}></i>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>No se encontraron dispositivos</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Verifique la conexión del rastreador PMT.</div>
            </div>
          ) : (
            filteredDevices.map(dev => {
              const isSelected = selectedDeviceId === dev.id;
              return (
                <div
                  key={dev.id}
                  onClick={() => handleSelectDevice(dev)}
                  style={{
                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid #334155',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: dev.online ? '#10b981' : '#64748b',
                        boxShadow: dev.online ? '0 0 8px #10b981' : 'none'
                      }}></div>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#ffffff' }}>
                        {dev.name || dev.id}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '99px',
                      background: dev.online ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      color: dev.online ? '#34d399' : '#94a3b8',
                      fontWeight: '600'
                    }}>
                      {dev.online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>SN: <code>{dev.serial_number || dev.id}</code></span>
                    {dev.battery_level != null && (
                      <span style={{ color: dev.battery_level <= 20 ? '#ef4444' : dev.battery_level <= 50 ? '#f59e0b' : '#10b981', fontWeight: '600' }}>
                        <i className={`fa-solid fa-battery-${dev.battery_level > 80 ? 'full' : dev.battery_level > 50 ? 'three-quarters' : dev.battery_level > 20 ? 'half' : 'quarter'}`}></i> {dev.battery_level}%
                      </span>
                    )}
                  </div>

                  {/* Técnico Asignado */}
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '10px', background: '#0f172a', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-user-gear" style={{ color: '#38bdf8' }}></i>
                      <span>{dev.technician_nombre || 'Sin asignación'}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssignModal(dev);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {dev.technician_nombre ? 'Cambiar' : 'Asignar'}
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectDevice(dev);
                      }}
                      style={{
                        flex: 1,
                        background: '#3b82f6',
                        border: 'none',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '5px 0',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <i className="fa-solid fa-location-crosshairs"></i> Ubicar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartHistory(dev);
                      }}
                      style={{
                        flex: 1,
                        background: '#334155',
                        border: 'none',
                        color: '#e2e8f0',
                        borderRadius: '6px',
                        padding: '5px 0',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <i className="fa-solid fa-route"></i> Recorrido
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Map View Area */}
      <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
        {/* Leaflet Container */}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#020617' }} />

        {/* History Mode Control Banner */}
        {historyMode && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid #3b82f6',
            borderRadius: '12px',
            padding: '12px 20px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            color: '#ffffff'
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#60a5fa' }}>
                Recorrido Histórico: {historyDevice?.name || historyDevice?.id}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Puntos registrados: {historyData.length}
              </div>
            </div>

            {/* Date Selector */}
            <input
              type="date"
              value={historyDate}
              onChange={e => {
                setHistoryDate(e.target.value);
                if (historyDevice) handleStartHistory(historyDevice);
              }}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '4px 8px',
                fontSize: '12px'
              }}
            />

            {/* Playback Controls */}
            {historyData.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    background: isPlaying ? '#ef4444' : '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}
                >
                  <i className={`fa-solid fa-${isPlaying ? 'pause' : 'play'}`}></i>
                </button>

                <input
                  type="range"
                  min="0"
                  max={historyData.length - 1}
                  value={playbackIndex}
                  onChange={e => {
                    setIsPlaying(false);
                    setPlaybackIndex(parseInt(e.target.value));
                  }}
                  style={{ width: '120px', accentColor: '#3b82f6' }}
                />

                <select
                  value={playbackSpeed}
                  onChange={e => setPlaybackSpeed(parseFloat(e.target.value))}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '4px',
                    fontSize: '11px'
                  }}
                >
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="5">5x</option>
                  <option value="10">10x</option>
                </select>
              </div>
            )}

            <button
              onClick={exitHistoryMode}
              style={{
                background: '#334155',
                border: 'none',
                color: '#f87171',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-xmark"></i> Salir
            </button>
          </div>
        )}
      </div>

      {/* MODAL: Assign Technician */}
      {showAssignModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '420px',
            padding: '24px',
            color: '#ffffff'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '700' }}>
              Vincular Dispositivo PMT
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
              Asigne un técnico de Futurity al dispositivo <strong>{assignTargetDevice?.name || assignTargetDevice?.id}</strong>.
            </p>

            <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '600' }}>
              Técnico de Campo:
            </label>
            <select
              value={selectedTechId}
              onChange={e => setSelectedTechId(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#ffffff',
                fontSize: '14px',
                marginBottom: '20px',
                outline: 'none'
              }}
            >
              <option value="">-- Sin técnico asignado --</option>
              {tecnicos.map(t => (
                <option key={t.id_tecnico} value={t.id_tecnico}>
                  {t.nombre} {t.apellidos || ''} ({t.area || 'SOPORTE'})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  background: '#334155',
                  border: 'none',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAssignment}
                disabled={assigning}
                style={{
                  background: '#3b82f6',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {assigning ? 'Guardando...' : 'Guardar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Token for PMT Hardware */}
      {showTokenModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '460px',
            padding: '24px',
            color: '#ffffff'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>
              Registrar Nuevo Rastreador PMT
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
              Genera una credencial Bearer para un nuevo módulo de hardware GPS.
            </p>

            {generatedToken ? (
              <div>
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#34d399', fontWeight: '700', marginBottom: '4px' }}>
                    ¡TOKEN GENERADO CON ÉXITO!
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                    Copie este token e ingréselo en el firmware/configuración del rastreador PMT. No se volverá a mostrar en texto claro.
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={generatedToken}
                    style={{
                      width: '100%',
                      background: '#020617',
                      border: '1px solid #34d399',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#34d399',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: '700'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowTokenModal(false)}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Entendido / Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  Nombre del Rastreador / Buseta:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Buseta 04 - PMT-004"
                  value={tokenDeviceName}
                  onChange={e => setTokenDeviceName(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    marginBottom: '12px',
                    outline: 'none'
                  }}
                />

                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                  Número de Serie / IMEI Hardware (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: SN-8849102948"
                  value={tokenDeviceSerial}
                  onChange={e => setTokenDeviceSerial(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    marginBottom: '20px',
                    outline: 'none'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => setShowTokenModal(false)}
                    style={{
                      background: '#334155',
                      border: 'none',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerateToken}
                    disabled={generatingToken}
                    style={{
                      background: '#3b82f6',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {generatingToken ? 'Generando...' : 'Generar Token'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MapaTrackerTab;
