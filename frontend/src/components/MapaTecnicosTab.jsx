import React, { useState, useEffect, useRef } from 'react';

const L = window.L;

function TechnicianAvatar({ fotoPerfil, nombre, isOnline, size = 44 }) {
  const [imgError, setImgError] = useState(false);
  const initial = nombre ? nombre.trim().charAt(0).toUpperCase() : 'T';
  const hasCustomPhoto = fotoPerfil && fotoPerfil !== 'default_avatar.png';

  if (hasCustomPhoto && !imgError) {
    return (
      <img
        src={`/static/uploads/${fotoPerfil}`}
        alt={nombre}
        onError={() => setImgError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1.5px solid var(--border-color)',
          flexShrink: 0,
          filter: isOnline ? 'none' : 'grayscale(1)'
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 900,
        fontSize: `${size * 0.42}px`,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
        border: '1.5px solid var(--border-color)',
        filter: isOnline ? 'none' : 'grayscale(0.7)',
        opacity: isOnline ? 1 : 0.7
      }}
    >
      {initial}
    </div>
  );
}

function MapaTecnicosTab({ token, activeArea = 'SOPORTE' }) {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);

  // KPIs
  const [kpis, setKpis] = useState({ activos: 0, inactivos: 0, libres: 0, ocupados: 0 });

  // Map and Markers Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const circlesRef = useRef({});
  const panicSetRef = useRef(new Set());

  // Audio Context Alert Synthesizer
  const playEmergencySound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.6);
      osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.9);
      osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 1.2);

      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.5);
    } catch (e) {
      console.warn("No se pudo reproducir el sonido de alerta:", e);
    }
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Centered in Cuenca, Ecuador
    const map = L.map(mapRef.current, {
      center: [-2.9001, -79.0059],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '&copy; Google Maps'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Fetch Live Locations & Polling
  const fetchUbicaciones = async () => {
    try {
      const res = await fetch(`/api/admin/tecnicos/ubicaciones?area=${activeArea}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        const list = data.ubicaciones || [];
        setUbicaciones(list);
        updateKPIs(list);
        updateMapMarkers(list);
      }
    } catch (e) {
      console.error("Error al cargar ubicaciones de técnicos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUbicaciones();
    const interval = setInterval(fetchUbicaciones, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [activeArea, token]);

  // Update KPI counters
  const updateKPIs = (list) => {
    let activos = 0;
    let inactivos = 0;
    let libres = 0;
    let ocupados = 0;

    list.forEach(u => {
      if (u.conectado === 1) {
        activos++;
        if (u.estado?.includes('Trabajando') || u.estado?.includes('En camino')) {
          ocupados++;
        } else {
          libres++;
        }
      } else {
        inactivos++;
      }
    });

    setKpis({ activos, inactivos, libres, ocupados });
  };

  // Custom Leaflet Icons
  const iconoEnRuta = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3065/3065532.png',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const iconoEnProgreso = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2942/2942503.png',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const iconoOffline = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3204/3204905.png',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const iconoPanico = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  // Update Markers on Leaflet Map
  const updateMapMarkers = (list) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentActiveKeys = [];
    const newEmergencyAlerts = [];

    list.forEach(u => {
      if (!u.lat || !u.lon) return;

      const key = u.tecnico;
      const latLng = [parseFloat(u.lat), parseFloat(u.lon)];
      const perfilUrl = `/static/uploads/${u.foto_perfil || 'default_avatar.png'}`;
      const vehiculoUrl = `/static/uploads/${u.foto_vehiculo || 'furgoneta_milton.jpeg'}`;
      const placa = u.placa_vehiculo || 'S/P';

      let estadoClaseColor = '#94a3b8';
      let estadoTexto = u.estado || 'DESCONECTADO';
      let tiempoTexto = 'Desconectado';

      if (u.ultima_actualizacion) {
        const fechaAct = new Date(u.ultima_actualizacion);
        const difSegs = Math.floor((new Date() - fechaAct) / 1000);
        if (difSegs > 3600) tiempoTexto = `Hace ${Math.floor(difSegs / 3600)}h`;
        else if (difSegs > 60) tiempoTexto = `Hace ${Math.floor(difSegs / 60)}m`;
        else if (difSegs > 0) tiempoTexto = `Hace ${difSegs}s`;
      }

      if (u.conectado === 1) {
        currentActiveKeys.push(key);
        let icono = iconoOffline;
        let opacityVal = 1.0;

        if (u.alerta_panico) {
          icono = iconoPanico;
          estadoClaseColor = '#ef4444';
          estadoTexto = '🚨 EMERGENCIA: ' + (u.mensaje_panico || 'Auxilio');
          newEmergencyAlerts.push({ tecnico: key, motivo: u.mensaje_panico || 'Auxilio solicitado' });

          if (!panicSetRef.current.has(key)) {
            panicSetRef.current.add(key);
            playEmergencySound();
          }
        } else if (u.conectado === 2) {
          estadoClaseColor = '#64748b';
          estadoTexto = '⚠️ SIN SEÑAL / BAJA COB.';
        } else if (u.estado?.includes('En camino')) {
          icono = iconoEnRuta;
          estadoClaseColor = '#f59e0b';
        } else if (u.estado?.includes('Trabajando')) {
          icono = iconoEnProgreso;
          estadoClaseColor = '#ef4444';
        } else {
          estadoClaseColor = '#10b981';
        }

        // Emergency Radius Circle
        if (u.alerta_panico) {
          if (circlesRef.current[key]) {
            circlesRef.current[key].setLatLng(latLng);
          } else {
            const circle = L.circle(latLng, {
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.3,
              radius: 100
            }).addTo(map);
            circlesRef.current[key] = circle;
          }
        } else if (circlesRef.current[key]) {
          map.removeLayer(circlesRef.current[key]);
          delete circlesRef.current[key];
        }

        // Create or Move Marker
        if (markersRef.current[key]) {
          markersRef.current[key].setLatLng(latLng);
          markersRef.current[key].setIcon(icono);
          markersRef.current[key].setOpacity(opacityVal);
        } else {
          const marker = L.marker(latLng, { icon: icono, opacity: opacityVal }).addTo(map);
          marker.bindTooltip(key, {
            permanent: true,
            direction: 'top',
            className: 'tooltip-tecnico-react'
          });
          markersRef.current[key] = marker;
        }

        // Popup HTML
        const popupHtml = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; width: 220px;">
            ${u.alerta_panico ? `
              <div style="background-color: #fee2e2; border: 1px solid #fca5a5; padding: 8px; border-radius: 8px; margin-bottom: 8px; color: #b91c1c; font-weight: bold; text-align: center; font-size: 0.8rem;">
                🚨 EMERGENCIA EN RUTA:<br>"${u.mensaje_panico || 'Auxilio'}"
              </div>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              <img src="${perfilUrl}" alt="${key}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1.5px solid #cbd5e1;">
              <div>
                <h4 style="margin: 0; color: #0f172a; font-size: 0.95rem; font-weight: 800;">${key}</h4>
                <span style="background-color: ${estadoClaseColor}; color: white; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; border-radius: 4px; text-transform: uppercase;">
                  ${estadoTexto}
                </span>
              </div>
            </div>
            <div style="font-size: 0.8rem; color: #475569; display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
              <div>Placa Vehículo: <strong>${placa}</strong></div>
              <div style="text-align: center; margin: 4px 0;">
                <img src="${vehiculoUrl}" alt="Vehículo" style="width: 100%; height: 75px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0;">
              </div>
              <div style="font-size: 0.72rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between;">
                <span>Actualizado:</span>
                <strong>${tiempoTexto}</strong>
              </div>
            </div>
          </div>
        `;
        markersRef.current[key].bindPopup(popupHtml);
      }
    });

    // Remove inactive markers
    Object.keys(markersRef.current).forEach(key => {
      if (!currentActiveKeys.includes(key)) {
        map.removeLayer(markersRef.current[key]);
        delete markersRef.current[key];
        if (circlesRef.current[key]) {
          map.removeLayer(circlesRef.current[key]);
          delete circlesRef.current[key];
        }
      }
    });

    setEmergencyAlerts(newEmergencyAlerts);
  };

  const handleFocusTechnician = (u) => {
    if (!u.lat || !u.lon || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.setView([parseFloat(u.lat), parseFloat(u.lon)], 16, { animate: true });
    if (markersRef.current[u.tecnico]) {
      markersRef.current[u.tecnico].openPopup();
    }
  };

  return (
    <div id="tab-mapa-tecnicos" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Hero Banner */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '20px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-map-location-dot" style={{ color: '#0284c7' }}></i> Monitoreo en Vivo de Técnicos
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Ubicación GPS y estado de las cuadrillas reportado en tiempo real desde la aplicación de campo ({activeArea}).
          </p>
        </div>
        <button
          type="button"
          onClick={fetchUbicaciones}
          style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
        >
          <i className="fa-solid fa-arrows-rotate"></i> Actualizar Ubicaciones
        </button>
      </div>

      {/* Emergency Alert Banner */}
      {emergencyAlerts.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: 'white', padding: '16px 24px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 10px 25px rgba(220, 38, 38, 0.3)', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #ef4444' }}>
          <i className="fa-solid fa-triangle-exclamation fa-beat" style={{ fontSize: '2rem' }}></i>
          <div>
            <strong style={{ fontSize: '1rem', display: 'block', textTransform: 'uppercase' }}>🚨 ALERTA DE EMERGENCIA ACTIVADA EN RUTA</strong>
            <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>
              {emergencyAlerts.map(a => `${a.tecnico}: "${a.motivo}"`).join(' | ')}
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Technician Roster (Left) + Leaflet Map (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', height: 'calc(100vh - 240px)', minHeight: '520px', marginBottom: '20px' }}>
        
        {/* Left Sidebar Roster */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Equipo Técnico</span>
            <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>
              {ubicaciones.length}
            </span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
            {ubicaciones.length > 0 ? (
              ubicaciones.map((u, idx) => {
                const isOnline = u.conectado === 1;
                const perfilUrl = `/static/uploads/${u.foto_perfil || 'default_avatar.png'}`;
                const isPanic = u.alerta_panico === 1;

                let estadoBadge = 'OFFLINE';
                let estadoColor = '#94a3b8';
                let detalleTexto = '';

                if (isPanic) {
                  estadoBadge = '🚨 AUXILIO';
                  estadoColor = '#ef4444';
                  detalleTexto = u.mensaje_panico || 'Alerta de emergencia activa';
                } else if (!isOnline) {
                  estadoBadge = 'OFFLINE';
                  estadoColor = '#94a3b8';
                  detalleTexto = 'Sin conexión de red';
                } else if (u.estado?.includes('En camino') || u.estado?.includes('EN_RUTA')) {
                  estadoBadge = 'EN CAMINO';
                  estadoColor = '#f59e0b';
                  detalleTexto = u.estado.replace(/^En camino a /i, '').replace(/^EN_RUTA /i, '');
                  if (!detalleTexto || detalleTexto === 'EN_RUTA') detalleTexto = 'En traslado a cliente';
                } else if (u.estado?.includes('Trabajando') || u.estado?.includes('EN_PROGRESO')) {
                  estadoBadge = 'TRABAJANDO';
                  estadoColor = '#ef4444';
                  detalleTexto = u.estado.replace(/^Trabajando en /i, '').replace(/^EN_PROGRESO /i, '');
                  if (!detalleTexto || detalleTexto === 'EN_PROGRESO') detalleTexto = 'Atendiendo visita';
                } else if (u.estado?.includes('Descanso')) {
                  estadoBadge = 'EN DESCANSO';
                  estadoColor = '#f59e0b';
                  detalleTexto = 'Pausa / Almuerzo';
                } else {
                  estadoBadge = 'DISPONIBLE';
                  estadoColor = '#10b981';
                  detalleTexto = 'Disponible para visitas';
                }

                return (
                  <div
                    key={idx}
                    onClick={() => isOnline && handleFocusTechnician(u)}
                    style={{
                      background: isPanic ? 'rgba(239, 68, 68, 0.12)' : 'var(--profile-bg)',
                      border: `1px solid ${isPanic ? '#ef4444' : 'var(--border-color)'}`,
                      borderRadius: '14px',
                      padding: '12px 14px',
                      cursor: isOnline ? 'pointer' : 'not-allowed',
                      opacity: isOnline ? 1 : 0.65,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <TechnicianAvatar fotoPerfil={u.foto_perfil} nombre={u.tecnico} isOnline={isOnline} />
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {u.tecnico}
                        </strong>
                        <span style={{ background: estadoColor, color: 'white', fontSize: '0.62rem', padding: '2px 7px', borderRadius: '6px', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {estadoBadge}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                        {detalleTexto && (
                          <span style={{ color: isPanic ? '#fca5a5' : 'var(--text-main)', fontWeight: 600, fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            📍 {detalleTexto}
                          </span>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)' }}>🚘 {u.placa_vehiculo || 'S/P'}</span>
                          {isOnline ? (
                            <span style={{ color: '#0284c7', fontWeight: 800, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-location-crosshairs"></i> Centrar
                            </span>
                          ) : (
                            <span style={{ color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.72rem' }}>Offline</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '40px 0' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block', color: 'var(--primary)' }}></i>
                <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>Cargando equipo técnico...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Map Canvas Container */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          
          {/* Floating Map KPI Cards */}
          <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 1000, display: 'flex', gap: '10px', flexWrap: 'wrap', pointerEvents: 'none' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                Activos: <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{kpis.activos}</strong>
              </span>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                Inactivos: <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{kpis.inactivos}</strong>
              </span>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                Libres: <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{kpis.libres}</strong>
              </span>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                Ocupados: <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{kpis.ocupados}</strong>
              </span>
            </div>
          </div>

          {/* Leaflet Map Div */}
          <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
        </div>
      </div>
    </div>
  );
}

export default MapaTecnicosTab;
