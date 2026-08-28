import { useState, useEffect, useRef } from 'react';

export default function SeguimientoCliente({ token }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modalFoto, setModalFoto] = useState(null);

  const mapRef = useRef(null);
  const markerRef = useRef(null);
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

          // If visit finished, redirect to survey
          if (result.estado === 'FINALIZADA') {
            clearInterval(intervalId);
            window.location.href = `/encuesta/${token}`;
            return;
          }

          // If technician arrived (EN_PROGRESO), state handles display of arrival card
          if (result.estado === 'EN_PROGRESO') {
            return;
          }

          // Update Leaflet map marker
          if (result.lat && result.lon && window.L && mapRef.current) {
            const coords = [result.lat, result.lon];
            if (!mapInstanceRef.current) {
              const map = window.L.map(mapRef.current).setView(coords, 16);
              window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google Maps'
              }).addTo(map);

              const iconoTecnico = window.L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/3204/3204905.png',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
              });

              markerRef.current = window.L.marker(coords, { icon: iconoTecnico }).addTo(map);
              mapInstanceRef.current = map;
            } else {
              if (markerRef.current) {
                markerRef.current.setLatLng(coords);
              }
            }
          }
        } else {
          setError(result.message || 'Este enlace de rastreo no es válido o ha caducado.');
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Error al consultar la ubicación en tiempo real.');
        setLoading(false);
      }
    };

    fetchTracking();
    intervalId = setInterval(fetchTracking, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [token]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <i className="fa-solid fa-compass fa-spin" style={{ fontSize: '2.5rem', color: '#dc2626', marginBottom: '15px' }}></i>
        <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc' }}>Conectando con la unidad técnica...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loadingContainer}>
        <i className="fa-solid fa-location-crosshairs-slash" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '15px' }}></i>
        <h2 style={{ color: '#dc2626', margin: '0 0 10px 0' }}>Enlace de Rastreo No Disponible</h2>
        <p style={{ color: '#94a3b8', margin: 0 }}>{error}</p>
      </div>
    );
  }

  // Arrival Overlay Screen
  if (data && data.estado === 'EN_PROGRESO') {
    return (
      <div style={styles.llegadaScreen}>
        <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📍</div>
        <h2 style={styles.llegadaTitle}>¡Hemos llegado!</h2>
        <p style={styles.llegadaDesc}>El técnico ya se encuentra en tu domicilio realizando la visita.</p>
        <p style={{ marginTop: '30px', opacity: 0.8, fontSize: '0.9rem' }}>Gracias por confiar en Futurity.</p>
      </div>
    );
  }

  const tecnicoNombreDisplay = () => {
    if (!data) return 'Técnico Asignado';
    if (data.tecnico && data.tecnico_apoyo) {
      return `${data.tecnico.split(' ')[0]} & ${data.tecnico_apoyo.split(' ')[0]}`;
    }
    return data.tecnico || 'Técnico Asignado';
  };

  return (
    <div style={styles.bodyBg}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '5px' }}>
          <img src="/static/img/logo_futurity.png" alt="Futurity" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#ffffff', fontWeight: 900 }}>Futurity</h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>Rastreo en tiempo real</p>
        <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0', opacity: 0.85, fontStyle: 'italic', color: '#94a3b8' }}>
          "El amigo que te conecta, porque tú nos importas" 💙
        </p>
      </div>

      {/* Map Element */}
      <div ref={mapRef} id="map-seguimiento" style={{ height: '52vh', width: '100%', minHeight: '340px' }} />

      {/* Technician Info Card */}
      <div style={styles.infoCard}>
        <div style={styles.statusBadge}>
          <i className="fa-solid fa-car-side"></i> Técnico en camino
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '14px' }}>
          <div style={{ position: 'relative', width: '60px', height: '60px' }}>
            <img
              src={data?.tecnico_foto || '/static/uploads/default_avatar.png'}
              alt="Técnico"
              onClick={() => setModalFoto({ src: data?.tecnico_foto, title: 'Tu Técnico Asignado', round: true })}
              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', cursor: 'pointer' }}
            />
            {data?.tecnico_apoyo_foto && (
              <img
                src={data.tecnico_apoyo_foto}
                alt="Técnico Apoyo"
                style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', position: 'absolute', bottom: '-5px', right: '-10px' }}
              />
            )}
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'white' }}>{tecnicoNombreDisplay()}</p>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#94a3b8' }}>
              Vehículo: <span style={{ color: '#38bdf8' }}>{data?.placa || 'S/P'}</span>
            </p>
          </div>

          {data?.vehiculo_foto && (
            <img
              src={data.vehiculo_foto}
              alt="Vehículo"
              onClick={() => setModalFoto({ src: data.vehiculo_foto, title: 'Vehículo de Soporte', round: false })}
              style={{ width: '85px', height: '55px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #e2e8f0', marginLeft: 'auto', cursor: 'pointer' }}
            />
          )}
        </div>

        <p style={{ marginTop: '16px', fontSize: '0.88rem', color: '#94a3b8', margin: '14px 0 0 0' }}>
          Puedes seguir su ubicación en tiempo real en el mapa superior.
        </p>
      </div>

      {/* Photo Modal */}
      {modalFoto && (
        <div
          onClick={() => setModalFoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            padding: '20px',
            boxSizing: 'border-box',
            cursor: 'pointer'
          }}
        >
          <span style={{ color: 'white', fontSize: '2.5rem', position: 'absolute', top: '15px', right: '25px' }}>&times;</span>
          <img
            src={modalFoto.src}
            alt="Ampliada"
            style={{
              borderRadius: modalFoto.round ? '50%' : '12px',
              width: modalFoto.round ? '240px' : 'auto',
              height: modalFoto.round ? '240px' : 'auto',
              maxWidth: '100%',
              maxHeight: '50vh',
              objectFit: 'cover',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}
          />
          <p style={{ color: 'white', marginTop: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>{modalFoto.title}</p>
          <p style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '4px' }}>Toca cualquier parte para cerrar</p>
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
    padding: '20px',
    textAlign: 'center'
  },
  header: {
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '16px 20px',
    textAlign: 'center',
    zIndex: 10
  },
  infoCard: {
    background: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px 24px 0 0',
    padding: '24px',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
    color: '#f8fafc',
    flexGrow: 1
  },
  statusBadge: {
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    color: 'white',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.82rem',
    fontWeight: 800,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  llegadaScreen: {
    backgroundColor: '#022c22',
    color: 'white',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px',
    textAlign: 'center'
  },
  llegadaTitle: {
    fontSize: '2rem',
    fontWeight: 900,
    margin: '0 0 10px 0',
    color: '#34d399'
  },
  llegadaDesc: {
    fontSize: '1.05rem',
    maxWidth: '360px',
    lineHeight: 1.5,
    margin: 0,
    color: '#a7f3d0'
  }
};
