import { useState, useEffect, useRef } from 'react';
import EncuestaCliente from './EncuestaCliente';

export default function SeguimientoCliente({ token }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modalFoto, setModalFoto] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'mapa' | 'encuesta'
  const userInteractedTabRef = useRef(false);

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const clientMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    let intervalId = null;

    const fetchTracking = async () => {
      try {
        const res = await fetch(`/api/rastreo_ubicacion/${token}?t=${new Date().getTime()}`);
        const result = await res.json();

        if (res.ok && result.status === 'ok') {
          setData(result);
          setLoading(false);

          // Si el usuario no ha cambiado manualmente de pestaña, seleccionar la pestaña óptima según el estado
          if (!userInteractedTabRef.current) {
            if (result.estado === 'FINALIZADA') {
              setActiveTab('encuesta');
            } else if (result.estado === 'EN_RUTA' || result.estado === 'EN_PROGRESO') {
              setActiveTab('mapa');
            } else {
              setActiveTab('info');
            }
          }
        } else {
          setError(result.message || 'Este enlace no es válido o ha caducado.');
          setLoading(false);
        }
      } catch (err) {
        console.error("Error consultando tracking:", err);
        setError('Error al consultar la información de la visita.');
        setLoading(false);
      }
    };

    fetchTracking();
    intervalId = setInterval(fetchTracking, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [token]);

  // Efecto dedicado a inicializar y mantener el mapa Leaflet cuando la pestaña 'mapa' está activa
  useEffect(() => {
    if (activeTab !== 'mapa' || !window.L || !mapRef.current || !data) return;

    const tecLat = data.lat;
    const tecLon = data.lon;
    if (tecLat == null || tecLon == null) return;

    const tecCoords = [tecLat, tecLon];

    // 1. Si aún no existe instancia del mapa, crearla
    if (!mapInstanceRef.current) {
      try {
        if (mapRef.current._leaflet_id) {
          mapRef.current._leaflet_id = null;
        }
      } catch (e) {}

      const map = window.L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(tecCoords, 15);

      window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20
      }).addTo(map);

      // Icono estilizado de camioneta/técnico
      const iconoTecnico = window.L.divIcon({
        className: 'custom-car-pin',
        html: `
          <div style="background:#0284c7; width:44px; height:44px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 6px 16px rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; font-size:22px;">
            🚗
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      markerRef.current = window.L.marker(tecCoords, { icon: iconoTecnico })
        .addTo(map)
        .bindPopup(`<b>${data.tecnico || 'Técnico'}</b><br>Placa: ${data.placa || 'S/P'}`);

      // Si disponemos de coordenadas del domicilio del cliente
      if (data.dest_lat != null && data.dest_lon != null) {
        const destCoords = [data.dest_lat, data.dest_lon];
        const iconoCliente = window.L.divIcon({
          className: 'custom-home-pin',
          html: `
            <div style="background:#ef4444; width:42px; height:42px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 6px 16px rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; font-size:20px;">
              🏠
            </div>
          `,
          iconSize: [42, 42],
          iconAnchor: [21, 21]
        });

        clientMarkerRef.current = window.L.marker(destCoords, { icon: iconoCliente })
          .addTo(map)
          .bindPopup(`<b>Tu Domicilio</b><br>${data.direccion || ''}`);

        polylineRef.current = window.L.polyline([tecCoords, destCoords], {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8'
        }).addTo(map);

        const bounds = window.L.latLngBounds([tecCoords, destCoords]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 300);
    } else {
      // 2. Si ya existe, actualizar posición del vehículo y línea
      if (markerRef.current) {
        markerRef.current.setLatLng(tecCoords);
      }
      if (polylineRef.current && data.dest_lat != null && data.dest_lon != null) {
        polylineRef.current.setLatLngs([tecCoords, [data.dest_lat, data.dest_lon]]);
      }
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
    }
  }, [activeTab, data?.lat, data?.lon, data?.dest_lat, data?.dest_lon]);

  // Al cambiar a pestaña 'mapa', forzar a Leaflet a recalcular sus dimensiones de inmediato
  useEffect(() => {
    if (activeTab === 'mapa' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
    }
  }, [activeTab]);

  // Cleanup del mapa al desmontar el componente
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleSelectTab = (tabName) => {
    userInteractedTabRef.current = true;
    setActiveTab(tabName);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.pulsingCircle}>
          <i className="fa-solid fa-satellite-dish fa-spin" style={{ fontSize: '2.5rem', color: '#38bdf8' }}></i>
        </div>
        <h3 style={{ margin: '18px 0 6px 0', fontWeight: 850, color: '#f8fafc', fontSize: '1.2rem' }}>Conectando con tu visita...</h3>
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>Futurity • Portal de Experiencia del Cliente</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ ...styles.pulsingCircle, background: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }}>
          <i className="fa-solid fa-link-slash" style={{ fontSize: '2.5rem', color: '#ef4444' }}></i>
        </div>
        <h2 style={{ color: '#f87171', margin: '18px 0 8px 0', fontSize: '1.3rem', fontWeight: 850 }}>Enlace no disponible</h2>
        <p style={{ color: '#94a3b8', margin: 0, maxWidth: '340px', lineHeight: 1.5, fontSize: '0.9rem' }}>{error}</p>
      </div>
    );
  }

  const isEnRuta = data?.estado === 'EN_RUTA';
  const isEnProgreso = data?.estado === 'EN_PROGRESO';
  const isFinalizada = data?.estado === 'FINALIZADA';
  const isPendiente = !isEnRuta && !isEnProgreso && !isFinalizada;

  const tecnicoDisplay = data?.tecnico && data?.tecnico_apoyo 
    ? `${data.tecnico} & ${data.tecnico_apoyo}` 
    : (data?.tecnico || 'Cuadrilla Técnica Asignada');

  return (
    <div className="seguimiento-cliente-wrapper" style={styles.bodyBg}>
      {/* HEADER PRINCIPAL */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <img src="/static/img/logo_futurity.png" alt="Futurity" style={{ width: '34px', height: '34px', borderRadius: '8px' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Futurity <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>CLIENTE</span>
            </h1>
          </div>
        </div>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
          "El amigo que te conecta, porque tú nos importas" 💙
        </p>
      </header>

      {/* BARRA DE NAVEGACIÓN ENTRE LAS 3 FASES */}
      <nav style={styles.tabNav}>
        <button
          type="button"
          onClick={() => handleSelectTab('info')}
          style={{
            ...styles.tabButton,
            color: activeTab === 'info' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'info' ? '3px solid #38bdf8' : '3px solid transparent'
          }}
        >
          <i className="fa-solid fa-clipboard-list" style={{ fontSize: '0.9rem' }}></i>
          <span>Visita</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('mapa')}
          style={{
            ...styles.tabButton,
            color: activeTab === 'mapa' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'mapa' ? '3px solid #38bdf8' : '3px solid transparent'
          }}
        >
          <i className="fa-solid fa-map-location-dot" style={{ fontSize: '0.9rem' }}></i>
          <span>Mapa</span>
          {isEnRuta && (
            <span style={styles.livePulseDot} title="Técnico en ruta activa"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('encuesta')}
          style={{
            ...styles.tabButton,
            color: activeTab === 'encuesta' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'encuesta' ? '3px solid #38bdf8' : '3px solid transparent'
          }}
        >
          <i className="fa-solid fa-star" style={{ fontSize: '0.9rem', color: isFinalizada ? '#f59e0b' : 'inherit' }}></i>
          <span>Calificar</span>
          {isFinalizada && !data?.ya_respondida && (
            <span style={{ fontSize: '0.62rem', background: '#10b981', color: '#ffffff', padding: '1px 5px', borderRadius: '6px', fontWeight: 900, letterSpacing: '0.02em' }}>
              LISTA
            </span>
          )}
        </button>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ========================================================
            PESTAÑA 1: MI VISITA (DETALLES Y CUADRILLA)
        ======================================================== */}
        <div style={{ display: activeTab === 'info' ? 'flex' : 'none', flexDirection: 'column', width: '100%' }}>
          <div style={{ padding: '20px 16px 40px 16px', maxWidth: '560px', width: '100%', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* PROGRESS STEPPER */}
            <div style={styles.stepperContainer}>
              <div style={styles.stepItem}>
                <div style={{ ...styles.stepCircle, background: '#10b981', color: 'white' }}>
                  <i className="fa-solid fa-check"></i>
                </div>
                <span style={styles.stepLabel}>Agendada</span>
              </div>
              <div style={{ ...styles.stepLine, background: (isEnRuta || isEnProgreso || isFinalizada) ? '#10b981' : 'rgba(255,255,255,0.1)' }}></div>
              <div style={styles.stepItem}>
                <div style={{ ...styles.stepCircle, background: (isEnRuta || isEnProgreso || isFinalizada) ? '#10b981' : isPendiente ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)', color: (isEnRuta || isEnProgreso || isFinalizada) ? 'white' : '#38bdf8' }}>
                  {isEnRuta ? <i className="fa-solid fa-car-side"></i> : (isEnProgreso || isFinalizada) ? <i className="fa-solid fa-check"></i> : '2'}
                </div>
                <span style={{ ...styles.stepLabel, color: isEnRuta ? '#38bdf8' : 'inherit', fontWeight: isEnRuta ? 800 : 600 }}>En Camino</span>
              </div>
              <div style={{ ...styles.stepLine, background: (isEnProgreso || isFinalizada) ? '#10b981' : 'rgba(255,255,255,0.1)' }}></div>
              <div style={styles.stepItem}>
                <div style={{ ...styles.stepCircle, background: (isEnProgreso || isFinalizada) ? '#10b981' : 'rgba(255,255,255,0.1)', color: (isEnProgreso || isFinalizada) ? 'white' : '#94a3b8' }}>
                  {isFinalizada ? <i className="fa-solid fa-check"></i> : isEnProgreso ? <i className="fa-solid fa-wrench"></i> : '3'}
                </div>
                <span style={{ ...styles.stepLabel, color: isEnProgreso ? '#38bdf8' : 'inherit', fontWeight: isEnProgreso ? 800 : 600 }}>En Sitio</span>
              </div>
              <div style={{ ...styles.stepLine, background: isFinalizada ? '#10b981' : 'rgba(255,255,255,0.1)' }}></div>
              <div style={styles.stepItem}>
                <div style={{ ...styles.stepCircle, background: isFinalizada ? '#10b981' : 'rgba(255,255,255,0.1)', color: isFinalizada ? 'white' : '#94a3b8' }}>
                  <i className="fa-solid fa-star"></i>
                </div>
                <span style={{ ...styles.stepLabel, color: isFinalizada ? '#10b981' : 'inherit', fontWeight: isFinalizada ? 800 : 600 }}>Concluida</span>
              </div>
            </div>

            {/* BANNER ESTADO */}
            <div style={{
              background: isFinalizada ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)' :
                          isEnProgreso ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(29, 78, 216, 0.3) 100%)' :
                          isEnRuta ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%)' :
                          'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(3, 105, 161, 0.25) 100%)',
              border: `1px solid ${isFinalizada ? '#10b981' : isEnProgreso ? '#3b82f6' : isEnRuta ? '#f59e0b' : '#38bdf8'}`,
              borderRadius: '16px',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: isFinalizada ? '#6ee7b7' : isEnProgreso ? '#93c5fd' : isEnRuta ? '#fcd34d' : '#7dd3fc', display: 'block' }}>
                  Estado de tu atención
                </span>
                <strong style={{ fontSize: '1.05rem', color: '#ffffff', fontWeight: 900 }}>
                  {isFinalizada ? '✅ Visita Concluida con Éxito' :
                   isEnProgreso ? '🛠️ Técnico en tu Domicilio' :
                   isEnRuta ? '🚗 Personal Técnico en Camino' :
                   '📅 Visita Programada'}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => handleSelectTab(isFinalizada ? 'encuesta' : 'mapa')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: isFinalizada ? '#10b981' : '#38bdf8',
                  color: '#0f172a',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0
                }}
              >
                {isFinalizada ? 'Ver Calificación' : 'Ver Mapa'} <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>

            {/* TARJETA DATOS DE LA CITA */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <i className="fa-solid fa-calendar-check" style={{ color: '#38bdf8' }}></i> Detalles de tu Cita
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                <div style={{ gridColumn: 'span 2', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <small style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Cliente & Contrato</small>
                  <strong style={{ fontSize: '1.05rem', color: '#f8fafc', fontWeight: 850 }}>{data.cliente}</strong>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, marginTop: '2px' }}>
                    Contrato #{data.contrato} • Ref: #VT-{data.id_visita}
                  </span>
                </div>

                <div style={styles.gridItem}>
                  <small style={styles.gridLabel}>📅 Fecha Programada</small>
                  <strong style={{ ...styles.gridValue, color: '#f8fafc' }}>{data.fecha_programada || 'Hoy'}</strong>
                </div>

                <div style={styles.gridItem}>
                  <small style={styles.gridLabel}>⏰ Horario Estimado</small>
                  <strong style={{ ...styles.gridValue, color: '#fbbf24' }}>{data.preferencia_horaria || 'En el día'}</strong>
                </div>

                <div style={{ gridColumn: 'span 2', ...styles.gridItem }}>
                  <small style={styles.gridLabel}>📍 Dirección / Ubicación</small>
                  <strong style={{ ...styles.gridValue, color: '#f8fafc', lineHeight: 1.4 }}>
                    {data.direccion} {data.sector ? `(${data.sector})` : ''}
                  </strong>
                </div>

                <div style={{ gridColumn: 'span 2', ...styles.gridItem }}>
                  <small style={styles.gridLabel}>🛠️ Motivo de la Visita</small>
                  <strong style={{ ...styles.gridValue, color: data.es_instalacion === 1 ? '#38bdf8' : '#f87171' }}>
                    {data.es_instalacion === 1 ? `🔌 Instalación: ${data.servicio}` : `🛠️ Soporte: ${data.problema || data.servicio}`}
                  </strong>
                </div>
              </div>
            </div>

            {/* TARJETA PERSONAL TÉCNICO Y VEHÍCULO */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <i className="fa-solid fa-id-card" style={{ color: '#38bdf8' }}></i> Cuadrilla Técnica Asignada
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px' }}>
                <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                  <img
                    src={data?.tecnico_foto || '/static/uploads/default_avatar.png'}
                    alt="Técnico Principal"
                    onClick={() => setModalFoto({ src: data?.tecnico_foto, title: 'Personal Técnico Asignado', round: true })}
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8', cursor: 'pointer' }}
                  />
                  {data?.tecnico_apoyo_foto && (
                    <img
                      src={data.tecnico_apoyo_foto}
                      alt="Técnico Apoyo"
                      onClick={() => setModalFoto({ src: data.tecnico_apoyo_foto, title: 'Técnico de Apoyo', round: true })}
                      style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff', position: 'absolute', bottom: '-4px', right: '-8px', cursor: 'pointer' }}
                    />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '1rem', color: '#ffffff', fontWeight: 850, display: 'block', wordBreak: 'break-word' }}>
                    {tecnicoDisplay}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                    Vehículo Autorizado: <strong style={{ color: '#38bdf8' }}>{data.placa || 'S/P'}</strong>
                  </span>
                </div>

                {data?.vehiculo_foto && (
                  <img
                    src={data.vehiculo_foto}
                    alt="Vehículo"
                    onClick={() => setModalFoto({ src: data.vehiculo_foto, title: `Unidad de Soporte - Placa ${data.placa || 'S/P'}`, round: false })}
                    style={{ width: '74px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}
                  />
                )}
              </div>

              <div style={{ marginTop: '16px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.2rem', color: '#38bdf8' }}></i>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Por tu seguridad, todo nuestro personal viste uniforme oficial de Futurity y porta credencial de identificación corporativa.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================
            PESTAÑA 2: MAPA EN VIVO / RASTREO
        ======================================================== */}
        <div style={{ display: activeTab === 'mapa' ? 'flex' : 'none', flex: 1, flexDirection: 'column', position: 'relative' }}>
            
            {/* ESCENARIO A: Aún no está en camino (PENDIENTE) */}
            {isPendiente && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', background: '#0a0f1d' }}>
                <div style={styles.radarContainer}>
                  <div style={styles.radarPulse}></div>
                  <i className="fa-solid fa-car-side" style={{ fontSize: '2.8rem', color: '#38bdf8', position: 'relative', zIndex: 2 }}></i>
                </div>

                <h3 style={{ margin: '24px 0 8px 0', fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>
                  Tu cuadrilla técnica está en preparación
                </h3>
                <p style={{ margin: 0, maxWidth: '420px', fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  Nuestro personal se encuentra alistando herramientas o finalizando una visita previa en tu zona. En cuanto inicien su recorrido hacia tu domicilio, este mapa se activará automáticamente con su ubicación en tiempo real 🚗💨
                </p>

                {/* Resumen flotante de la cita */}
                <div style={{ marginTop: '28px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '16px 20px', maxWidth: '380px', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Horario Programado</span>
                    <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 800 }}>⏰ {data.preferencia_horaria || 'En el día'}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    <small style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Destino de la atención</small>
                    <span style={{ fontSize: '0.86rem', color: '#ffffff', fontWeight: 700 }}>{data.direccion}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectTab('info')}
                  style={{ marginTop: '20px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }}></i> Volver a Detalles
                </button>
              </div>
            )}

            {/* ESCENARIO B: En camino (EN_RUTA) */}
            {isEnRuta && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div ref={mapRef} id="map-seguimiento" style={{ flex: 1, minHeight: '55vh', width: '100%' }} />

                {/* Floating bottom card with technician info */}
                <div style={styles.floatingMapCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }}></span> EN CAMINO A TU DOMICILIO
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>
                      Placa: <strong style={{ color: '#38bdf8' }}>{data.placa || 'S/P'}</strong>
                    </span>
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: '#ffffff', fontWeight: 850, display: 'block' }}>
                    {tecnicoDisplay}
                  </strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    El mapa se actualiza automáticamente cada 5 segundos siguiendo la ubicación GPS del vehículo.
                  </p>
                </div>
              </div>
            )}

            {/* ESCENARIO C: Llegó al domicilio (EN_PROGRESO) */}
            {isEnProgreso && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', background: 'linear-gradient(180deg, #064e3b 0%, #022c22 100%)' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: '18px' }}>
                  📍
                </div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399', margin: '0 0 8px 0' }}>¡Hemos llegado!</h2>
                <p style={{ fontSize: '1.05rem', color: '#a7f3d0', maxWidth: '380px', lineHeight: 1.5, margin: 0 }}>
                  El personal técnico ya se encuentra en tu domicilio realizando los trabajos de atención técnica.
                </p>
                <div style={{ marginTop: '24px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 18px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 700 }}>
                    Técnico a cargo: <strong style={{ color: '#34d399' }}>{tecnicoDisplay}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* ESCENARIO D: Visita ya finalizada */}
            {isFinalizada && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', background: '#0a0f1d' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#10b981', marginBottom: '16px' }}>
                  <i className="fa-solid fa-flag-checkered"></i>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 900, color: '#ffffff' }}>Atención Técnica Concluida</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#94a3b8', maxWidth: '360px' }}>
                  El recorrido ha finalizado. Por favor ayúdanos respondiendo la breve encuesta de satisfacción.
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectTab('encuesta')}
                  style={{ padding: '12px 24px', borderRadius: '12px', background: '#10b981', color: '#ffffff', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-star"></i> Ir a Calificar el Servicio
                </button>
              </div>
            )}

          </div>

        {/* ========================================================
            PESTAÑA 3: ENCUESTA DE CALIFICACIÓN ARCOTEL
        ======================================================== */}
        <div style={{ display: activeTab === 'encuesta' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
          {isFinalizada ? (
            <EncuestaCliente token={token} />
          ) : (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', background: '#07090e' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', color: '#f59e0b', marginBottom: '18px' }}>
                <i className="fa-solid fa-star-half-stroke"></i>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>Encuesta de Satisfacción</h3>
              <p style={{ margin: 0, maxWidth: '400px', fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.5 }}>
                La encuesta oficial de calidad estará habilitada en este mismo enlace tan pronto como el equipo técnico concluya la visita en tu domicilio.
              </p>
              <span style={{ marginTop: '20px', fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.1)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                ⏳ Estado actual: {isEnRuta ? 'Técnico en camino' : isEnProgreso ? 'Técnico en domicilio' : 'Visita agendada'}
              </span>
              <button
                type="button"
                onClick={() => handleSelectTab('info')}
                style={{ marginTop: '24px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }}></i> Volver a Detalles
              </button>
            </div>
          )}
        </div>

      </main>

      {/* MODAL DE FOTO AMPLIADA */}
      {modalFoto && (
        <div
          onClick={() => setModalFoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.88)',
            zIndex: 999999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            padding: '20px',
            boxSizing: 'border-box',
            cursor: 'pointer'
          }}
        >
          <span style={{ color: 'white', fontSize: '2.2rem', position: 'absolute', top: '15px', right: '25px' }}>&times;</span>
          <img
            src={modalFoto.src}
            alt="Foto Ampliada"
            style={{
              borderRadius: modalFoto.round ? '50%' : '14px',
              width: modalFoto.round ? '240px' : 'auto',
              height: modalFoto.round ? '240px' : 'auto',
              maxWidth: '90%',
              maxHeight: '60vh',
              objectFit: 'cover',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              border: '2px solid rgba(255,255,255,0.2)'
            }}
          />
          <p style={{ color: 'white', marginTop: '18px', fontWeight: 800, fontSize: '1.05rem', textAlign: 'center' }}>{modalFoto.title}</p>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '4px 0 0 0' }}>Toca en cualquier parte para cerrar</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  bodyBg: {
    fontFamily: "'Outfit', system-ui, sans-serif",
    backgroundColor: '#07090e',
    color: '#f8fafc',
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  },
  loadingContainer: {
    backgroundColor: '#07090e',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center'
  },
  pulsingCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(56, 189, 248, 0.15)',
    border: '2px solid #38bdf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '14px 20px',
    textAlign: 'center'
  },
  tabNav: {
    display: 'flex',
    background: '#0f172a',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
    boxSizing: 'border-box'
  },
  tabButton: {
    flex: 1,
    padding: '12px 4px',
    background: 'transparent',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    minWidth: 0
  },
  livePulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    display: 'inline-block',
    marginLeft: '6px',
    boxShadow: '0 0 8px #10b981'
  },
  stepperContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 12px',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px'
  },
  stepCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    fontWeight: 850
  },
  stepLabel: {
    fontSize: '0.68rem',
    color: '#94a3b8',
    fontWeight: 700
  },
  stepLine: {
    flex: 1,
    height: '2px',
    margin: '0 4px',
    marginBottom: '16px'
  },
  card: {
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '18px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
  },
  cardTitle: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 850,
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  gridItem: {
    background: 'rgba(0,0,0,0.2)',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)'
  },
  gridLabel: {
    fontSize: '0.68rem',
    color: '#94a3b8',
    fontWeight: 800,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '3px'
  },
  gridValue: {
    fontSize: '0.88rem',
    fontWeight: 800
  },
  radarContainer: {
    position: 'relative',
    width: '100px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radarPulse: {
    position: 'absolute',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: 'rgba(56, 189, 248, 0.15)',
    border: '2px solid rgba(56, 189, 248, 0.35)'
  },
  floatingMapCard: {
    position: 'absolute',
    bottom: '20px',
    left: '16px',
    right: '16px',
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(56, 189, 248, 0.4)',
    borderRadius: '18px',
    padding: '16px 20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    zIndex: 1000
  }
};
