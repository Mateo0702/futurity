import { useState, useEffect, useRef } from 'react';

export default function FirmaRemota({ token }) {
  const [loading, setLoading] = useState(true);
  const [visita, setVisita] = useState(null);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const fetchFirmaInfo = async () => {
      try {
        const res = await fetch(`/api/cliente/firma_info/${token}`);
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          setVisita(data.visita);
        } else {
          setError(data.message || 'El enlace de firma no es válido o ha expirado.');
        }
      } catch (err) {
        console.error(err);
        setError('Error al conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    };

    fetchFirmaInfo();
  }, [token]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.lineCap = 'round';
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Verify blank canvas
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert('Por favor dibuje su firma en la casilla antes de guardar.');
      return;
    }

    const b64 = canvas.toDataURL('image/png');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/cliente/firmar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma_base64: b64 })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setSigned(true);
      } else {
        alert(data.message || 'Error al guardar la firma.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al enviar la firma.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.centerBg}>
        <div style={styles.card}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#dc2626', marginBottom: '10px' }}></i>
          <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>Cargando formulario de firma...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centerBg}>
        <div style={styles.card}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '12px' }}></i>
          <h3 style={{ color: '#dc2626', margin: '0 0 8px 0' }}>Enlace no disponible</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.bodyBg}>
      <div style={styles.card}>
        <img src="/static/img/logo_futurity.png" alt="Futurity Logo" style={styles.logo} />
        
        {!signed ? (
          <div>
            <h2 style={styles.title}>Firma de Conformidad</h2>
            <p style={styles.subtitle}>
              Estimado/a <strong>{visita?.cliente}</strong>, por favor registre su firma para confirmar la finalización del trabajo técnico realizad por <strong>{visita?.tecnico_principal || 'Técnico Futurity'}</strong>.
            </p>

            <div style={styles.canvasContainer}>
              <canvas
                ref={canvasRef}
                width={340}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={styles.canvas}
              />
            </div>

            <div style={styles.btnRow}>
              <button type="button" onClick={clearCanvas} style={styles.btnClear}>
                Limpiar
              </button>
              <button type="button" onClick={handleSaveSignature} disabled={submitting} style={styles.btnSave}>
                {submitting ? 'Guardando...' : 'Confirmar Firma'}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.successPanel}>
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>✅</div>
            <h3 style={{ color: '#0f172a', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px 0' }}>¡Firma Registrada!</h3>
            <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
              Muchas gracias. Su firma de conformidad ha sido recibida y guardada exitosamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  bodyBg: {
    backgroundColor: '#0f172a',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '40px 20px 60px 20px',
    boxSizing: 'border-box',
    fontFamily: "'Inter', system-ui, sans-serif",
    overflowY: 'auto'
  },
  centerBg: {
    backgroundColor: '#0f172a',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  card: {
    background: '#ffffff',
    padding: '30px 24px',
    borderRadius: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    width: '100%',
    maxWidth: '420px',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  logo: {
    maxHeight: '45px',
    width: 'auto',
    marginBottom: '16px'
  },
  title: {
    color: '#0f172a',
    fontSize: '1.4rem',
    fontWeight: 800,
    margin: '0 0 8px 0'
  },
  subtitle: {
    color: '#475569',
    fontSize: '0.88rem',
    margin: '0 0 20px 0',
    lineHeight: 1.5
  },
  canvasContainer: {
    background: '#f8fafc',
    borderRadius: '16px',
    border: '2px dashed #cbd5e1',
    overflow: 'hidden',
    marginBottom: '20px',
    touchAction: 'none'
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '160px',
    cursor: 'crosshair',
    touchAction: 'none'
  },
  btnRow: {
    display: 'flex',
    gap: '10px'
  },
  btnClear: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    background: 'transparent',
    color: '#64748b',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  btnSave: {
    flex: 2,
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    fontWeight: 800,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
  },
  successPanel: {
    padding: '20px 0'
  }
};
