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

function calcularTiempoTranscurrido(fechaStr) {
  if (!fechaStr) return 'Desconectado';
  const fechaAct = new Date(fechaStr);
  const difSegs = Math.floor((new Date() - fechaAct) / 1000);
  if (isNaN(difSegs) || difSegs < 0) return 'Ahora';
  if (difSegs > 3600) return `Hace ${Math.floor(difSegs / 3600)}h`;
  if (difSegs > 60) return `Hace ${Math.floor(difSegs / 60)}m`;
  return `Hace ${difSegs}s`;
}

function MapaTecnicosTab({ token, activeArea = 'SOPORTE' }) {
  const [filterArea, setFilterArea] = useState(activeArea || 'TODOS');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);

  // KPIs
  const [kpis, setKpis] = useState({ activos: 0, inactivos: 0, libres: 0, ocupados: 0 });

  // Route History State
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const historyPolylineRef = useRef(null);

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
      const res = await fetch(`/api/admin/tecnicos/ubicaciones?area=${filterArea}`, {
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

  // Route History Fetcher
  const verRecorridoTecnico = async (idTecnico, nombreTecnico) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/tecnicos/${idTecnico}/historial_ruta`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        const puntos = data.puntos || [];
        setSelectedHistory({
          tecnico: nombreTecnico,
          id_tecnico: idTecnico,
          total_puntos: puntos.length,
          puntos: puntos
        });

        // Limpiar trazado anterior si existe
        if (historyPolylineRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(historyPolylineRef.current);
          historyPolylineRef.current = null;
        }

        if (puntos.length > 0 && mapInstanceRef.current) {
          const latLngs = puntos.map(p => [parseFloat(p.lat), parseFloat(p.lon)]);
          const polyline = L.polyline(latLngs, {
            color: '#0284c7',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(mapInstanceRef.current);

          historyPolylineRef.current = polyline;
          mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        } else {
          alert(`No hay registros de ruta hoy para ${nombreTecnico}.`);
        }
      } else {
        alert(data.message || 'Error al obtener la ruta.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al cargar la ruta.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const limpiarRecorrido = () => {
    if (historyPolylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(historyPolylineRef.current);
      historyPolylineRef.current = null;
    }
    setSelectedHistory(null);
  };

  useEffect(() => {
    window.verRecorridoTecnico = (idTecnico, nombreTecnico) => {
      verRecorridoTecnico(idTecnico, nombreTecnico);
    };
    return () => {
      delete window.verRecorridoTecnico;
    };
  }, [token]);

  useEffect(() => {
    fetchUbicaciones();
    const interval = setInterval(fetchUbicaciones, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [filterArea, token]);

  // Update KPI counters
  const updateKPIs = (list) => {
    let activos = 0;
    let inactivos = 0;
    let libres = 0;
    let ocupados = 0;

    list.forEach(u => {
      if (u.conectado === 1 || u.conectado === 2) {
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
      const tiempoTexto = calcularTiempoTranscurrido(u.ultima_actualizacion);

      if (u.conectado === 1 || u.conectado === 2) {
        currentActiveKeys.push(key);
        let icono = iconoOffline;
        let opacityVal = u.conectado === 2 ? 0.78 : 1.0;

        if (u.alerta_panico) {
          icono = iconoPanico;
          estadoClaseColor = '#ef4444';
          estadoTexto = '🚨 EMERGENCIA: ' + (u.mensaje_panico || 'Auxilio');
          newEmergencyAlerts.push({ tecnico: key, motivo: u.mensaje_panico || 'Auxilio solicitado' });

          if (!panicSetRef.current.has(key)) {
            panicSetRef.current.add(key);
            playEmergencySound();
          }
        } else if (u.estado?.includes('En camino')) {
          icono = iconoEnRuta;
          estadoClaseColor = u.conectado === 2 ? '#64748b' : '#f59e0b';
          estadoTexto = u.conectado === 2 ? `🚚 EN CAMINO (${tiempoTexto})` : (u.estado || 'EN CAMINO');
        } else if (u.estado?.includes('Trabajando')) {
          icono = iconoEnProgreso;
          estadoClaseColor = u.conectado === 2 ? '#64748b' : '#ef4444';
          estadoTexto = u.conectado === 2 ? `🔧 TRABAJANDO (${tiempoTexto})` : (u.estado || 'TRABAJANDO');
        } else if (u.conectado === 2) {
          icono = iconoOffline;
          estadoClaseColor = '#64748b';
          estadoTexto = `⚠️ SIN SEÑAL (${tiempoTexto})`;
        } else {
          estadoClaseColor = '#10b981';
          estadoTexto = u.estado || 'DISPONIBLE';
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

        const tooltipText = `${key}${u.conectado === 2 ? ' (⚠️ Sin señal)' : ''}`;

        // Create or Move Marker
        if (markersRef.current[key]) {
          markersRef.current[key].setLatLng(latLng);
          markersRef.current[key].setIcon(icono);
          markersRef.current[key].setOpacity(opacityVal);
          if (markersRef.current[key].getTooltip()) {
            markersRef.current[key].setTooltipContent(tooltipText);
          }
        } else {
          const marker = L.marker(latLng, { icon: icono, opacity: opacityVal }).addTo(map);
          marker.bindTooltip(tooltipText, {
            permanent: true,
            direction: 'top',
            className: 'tooltip-tecnico-react'
          });
          markersRef.current[key] = marker;
        }

        // Popup HTML
        const areaBadge = u.area_trabajo === 'INSTALACIONES' ? '⚡ Instalaciones' : '🛠️ Soporte';
        const areaBadgeColor = u.area_trabajo === 'INSTALACIONES' ? '#0284c7' : '#059669';

        let activaVisitaHtml = '';
        if (u.visita_activa_id) {
          const isInst = u.visita_activa_es_instalacion === 1;
          activaVisitaHtml = `
            <div style="margin-top: 8px; padding: 6px 8px; border-radius: 6px; font-size: 0.72rem; background: ${isInst ? 'rgba(2, 132, 199, 0.08)' : 'rgba(245, 158, 11, 0.08)'}; border-left: 3px solid ${isInst ? '#0284c7' : '#f59e0b'};">
              <div style="font-weight: 800; color: ${isInst ? '#0284c7' : '#d97706'}; text-transform: uppercase;">
                ${isInst ? '🔌 Instalación en Curso' : '🤝 Apoyo en Soporte'}
              </div>
              <div style="color: #0f172a; font-weight: bold; margin-top: 2px;">${u.visita_activa_cliente || ''}</div>
              <div style="color: #475569;">Contrato #${u.visita_activa_contrato || 'S/N'} (${u.visita_activa_sector || ''})</div>
            </div>
          `;
        }

        const popupHtml = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; width: 220px;">
            ${u.conectado === 2 ? `
              <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; color: #475569; font-weight: 700; text-align: center; font-size: 0.72rem;">
                ⚠️ Última posición conocida (Sin señal: ${tiempoTexto})
              </div>
            ` : ''}
            ${u.alerta_panico ? `
              <div style="background-color: #fee2e2; border: 1px solid #fca5a5; padding: 8px; border-radius: 8px; margin-bottom: 8px; color: #b91c1c; font-weight: bold; text-align: center; font-size: 0.8rem;">
                🚨 EMERGENCIA EN RUTA:<br>"${u.mensaje_panico || 'Auxilio'}"
              </div>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              <img src="${perfilUrl}" alt="${key}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1.5px solid #cbd5e1;">
              <div>
                <h4 style="margin: 0; color: #0f172a; font-size: 0.95rem; font-weight: 800;">${key}</h4>
                <div style="display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap;">
                  <span style="background-color: ${areaBadgeColor}; color: white; padding: 1px 6px; font-size: 0.62rem; font-weight: 800; border-radius: 4px;">
                    ${areaBadge}
                  </span>
                  <span style="background-color: ${estadoClaseColor}; color: white; padding: 1px 6px; font-size: 0.62rem; font-weight: bold; border-radius: 4px; text-transform: uppercase;">
                    ${estadoTexto}
                  </span>
                </div>
              </div>
            </div>
            ${activaVisitaHtml}
            ${(() => {
              const batVal = u.bateria !== null && u.bateria !== undefined ? u.bateria : null;
              const isChg = u.cargando === 1 || u.cargando === true;
              const batColor = batVal !== null ? (batVal > 50 ? '#10b981' : batVal > 20 ? '#f59e0b' : '#ef4444') : '#94a3b8';
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.05); font-size: 0.76rem;">
                  <span style="color: #64748b; font-weight: 600;">Batería PDA:</span>
                  <span style="color: ${batColor}; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                    ${isChg ? '⚡' : '🔋'} ${batVal !== null ? batVal + '%' : 'N/D'}
                  </span>
                </div>
              `;
            })()}
            <button onclick="window.verRecorridoTecnico(${u.id_tecnico}, '${key}')" style="width: 100%; margin-top: 8px; padding: 7px 10px; border-radius: 8px; border: none; background: #0284c7; color: white; font-weight: 800; font-size: 0.74rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📍 Ver Recorrido del Día
            </button>
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
            Ubicación satelital y órdenes en curso reportadas en tiempo real ({filterArea === 'INSTALACIONES' ? 'Cuadrillas de Instalación' : filterArea === 'SOPORTE' ? 'Técnicos de Soporte' : 'Todas las Cuadrillas'}).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Selector de Área / Cuadrilla */}
          <div style={{ display: 'flex', background: 'var(--profile-bg)', padding: '4px', borderRadius: '14px', border: '1px solid var(--border-color)', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setFilterArea('INSTALACIONES')}
              style={{
                background: filterArea === 'INSTALACIONES' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                color: filterArea === 'INSTALACIONES' ? 'white' : 'var(--text-main)',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>⚡</span> Cuadrillas Instalación
            </button>
            <button
              type="button"
              onClick={() => setFilterArea('SOPORTE')}
              style={{
                background: filterArea === 'SOPORTE' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                color: filterArea === 'SOPORTE' ? 'white' : 'var(--text-main)',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🛠️</span> Soporte
            </button>
            <button
              type="button"
              onClick={() => setFilterArea('TODOS')}
              style={{
                background: filterArea === 'TODOS' ? 'var(--text-main)' : 'transparent',
                color: filterArea === 'TODOS' ? 'var(--card-bg)' : 'var(--text-main)',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🌐 Todos
            </button>
          </div>

          <button
            type="button"
            onClick={fetchUbicaciones}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
          >
            <i className="fa-solid fa-arrows-rotate"></i> Actualizar
          </button>
        </div>
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
                const isStandby = u.conectado === 2;
                const hasPosition = isOnline || isStandby;
                const perfilUrl = `/static/uploads/${u.foto_perfil || 'default_avatar.png'}`;
                const isPanic = u.alerta_panico === 1;

                const tiempoTexto = calcularTiempoTranscurrido(u.ultima_actualizacion);
                let estadoBadge = 'OFFLINE';
                let estadoColor = '#94a3b8';
                let detalleTexto = '';

                if (isPanic) {
                  estadoBadge = '🚨 AUXILIO';
                  estadoColor = '#ef4444';
                  detalleTexto = u.mensaje_panico || 'Alerta de emergencia activa';
                } else if (u.conectado === 0) {
                  estadoBadge = 'OFFLINE';
                  estadoColor = '#94a3b8';
                  detalleTexto = 'Sesión cerrada';
                } else if (u.estado?.includes('En camino') || u.estado?.includes('EN_RUTA')) {
                  estadoBadge = isStandby ? '🚚 EN CAMINO' : 'EN CAMINO';
                  estadoColor = isStandby ? '#64748b' : '#f59e0b';
                  detalleTexto = isStandby ? `Última pos. (${tiempoTexto})` : (u.estado.replace(/^En camino a /i, '').replace(/^EN_RUTA /i, '') || 'En traslado a cliente');
                } else if (u.estado?.includes('Trabajando') || u.estado?.includes('EN_PROGRESO')) {
                  estadoBadge = isStandby ? '🔧 TRABAJANDO' : 'TRABAJANDO';
                  estadoColor = isStandby ? '#64748b' : '#ef4444';
                  detalleTexto = isStandby ? `Última pos. (${tiempoTexto})` : (u.estado.replace(/^Trabajando en /i, '').replace(/^EN_PROGRESO /i, '') || 'Atendiendo visita');
                } else if (isStandby) {
                  estadoBadge = '⚠️ SIN SEÑAL';
                  estadoColor = '#64748b';
                  detalleTexto = `Último ping: ${tiempoTexto}`;
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
                    onClick={() => hasPosition && handleFocusTechnician(u)}
                    style={{
                      background: isPanic ? 'rgba(239, 68, 68, 0.12)' : 'var(--profile-bg)',
                      border: `1px solid ${isPanic ? '#ef4444' : isStandby ? '#cbd5e1' : 'var(--border-color)'}`,
                      borderRadius: '14px',
                      padding: '12px 14px',
                      cursor: hasPosition ? 'pointer' : 'not-allowed',
                      opacity: isOnline ? 1 : isStandby ? 0.88 : 0.6,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <TechnicianAvatar fotoPerfil={u.foto_perfil} nombre={u.tecnico} isOnline={hasPosition} />
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '0.7rem' }} title={u.area_trabajo === 'INSTALACIONES' ? 'Cuadrilla Instalaciones' : 'Técnico Soporte'}>
                            {u.area_trabajo === 'INSTALACIONES' ? '⚡' : '🛠️'}
                          </span>
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.tecnico}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ background: estadoColor, color: 'white', fontSize: '0.62rem', padding: '2px 7px', borderRadius: '6px', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {estadoBadge}
                          </span>
                          {u.bateria !== null && u.bateria !== undefined && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                color: u.bateria > 50 ? '#10b981' : u.bateria > 20 ? '#f59e0b' : '#ef4444',
                                background: 'rgba(0,0,0,0.06)',
                                padding: '2px 5px',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                              title={`Batería del PDA: ${u.bateria}% ${u.cargando ? '(Cargando)' : ''}`}
                            >
                              {u.cargando ? '⚡' : '🔋'} {u.bateria}%
                            </span>
                          )}
                        </div>
                      </div>

                      {u.visita_activa_id && (
                        <div style={{
                          marginTop: '4px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          background: u.visita_activa_es_instalacion === 1 ? 'rgba(2, 132, 199, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          borderLeft: `3px solid ${u.visita_activa_es_instalacion === 1 ? '#0284c7' : '#f59e0b'}`
                        }}>
                          <div style={{ fontWeight: 800, color: u.visita_activa_es_instalacion === 1 ? '#0284c7' : '#d97706', fontSize: '0.68rem' }}>
                            {u.visita_activa_es_instalacion === 1 ? '🔌 Instalación en Curso' : '🤝 Apoyo en Soporte'}
                          </div>
                          <div style={{ color: 'var(--text-main)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.visita_activa_cliente}
                          </div>
                        </div>
                      )}

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
          
          {/* Active History Path Pill */}
          {selectedHistory && (
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '30px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.84rem',
              fontWeight: 700,
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}>
              <span>📍 Recorrido de <strong>{selectedHistory.tecnico}</strong> ({selectedHistory.total_puntos} puntos GPS hoy)</span>
              <button
                type="button"
                onClick={limpiarRecorrido}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 800
                }}
              >
                Cerrar Ruta
              </button>
            </div>
          )}
          
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
