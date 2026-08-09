import { useState, useEffect } from 'react';

export default function EncuestaCliente({ token }) {
  const [loading, setLoading] = useState(true);
  const [visita, setVisita] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [rapidez, setRapidez] = useState(null);
  const [atencion, setAtencion] = useState(null);
  const [explicacion, setExplicacion] = useState(null);
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    const fetchVisitaInfo = async () => {
      try {
        const res = await fetch(`/api/cliente/encuesta_info/${token}`);
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          setVisita(data.visita);
        } else {
          setError(data.message || 'Este enlace no es válido o ha expirado.');
        }
      } catch (err) {
        console.error(err);
        setError('Error al cargar la información de la encuesta.');
      } finally {
        setLoading(false);
      }
    };

    fetchVisitaInfo();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rapidez || !atencion || !explicacion) {
      alert('Por favor califique todas las preguntas antes de enviar.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('rapidez', rapidez);
      formData.append('atencion', atencion);
      formData.append('explicacion', explicacion);
      formData.append('comentario', comentario);

      const res = await fetch(`/api/cliente/calificar/${token}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setSubmitted(true);
      } else {
        alert(data.message || 'Error al guardar la encuesta.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al enviar las respuestas.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.loadingCard}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#dc2626', marginBottom: '12px' }}></i>
          <p style={{ margin: 0, fontWeight: 600, color: '#5c5346' }}>Cargando encuesta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.card}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '16px' }}></i>
          <h2 style={{ color: '#dc2626', margin: '0 0 10px 0', fontSize: '1.4rem' }}>Enlace no disponible</h2>
          <p style={{ color: '#5c5346', fontSize: '0.95rem', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  const tecnicoNombreDisplay = () => {
    if (!visita) return 'Técnico Asignado';
    if (visita.tecnico_principal && visita.tecnico_apoyo) {
      return `${visita.tecnico_principal.split(' ')[0]} y ${visita.tecnico_apoyo.split(' ')[0]}`;
    }
    return visita.tecnico_principal || 'Técnico Asignado';
  };

  return (
    <div style={styles.bodyBg}>
      <div style={styles.card}>
        {!submitted ? (
          <div>
            <div style={styles.header}>
              <img src="/static/img/logo_futurity.png" alt="Futurity Logo" style={styles.logo} />
              <h2 style={styles.title}>¡Servicio Finalizado!</h2>
              <p style={styles.subtitle}>
                En Futurity, nos importa ser el amigo que te conecta. 💙<br />
                Por favor, ayúdanos a evaluar nuestro servicio:
              </p>
            </div>

            <div style={styles.techInfo}>
              <span>🔧</span>
              <span>Técnico:</span>
              <strong style={{ color: '#2d2a26' }}>{tecnicoNombreDisplay()}</strong>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Pregunta 1: Rapidez */}
              <div style={styles.ratingGroup}>
                <p style={styles.ratingGroupTitle}>⚡ Rapidez de solución</p>
                <span style={styles.desc}>¿Qué tan rápido solucionamos tu problema o realizamos tu instalación?</span>
                <div style={styles.ratingOptions}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRapidez(val)}
                      style={{
                        ...styles.ratingBtn,
                        ...(rapidez === val ? styles.ratingBtnSelected : {})
                      }}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div style={styles.ratingLabels}>
                  <span>Muy lento 🐢</span>
                  <span>Inmediato 🚀</span>
                </div>
              </div>

              {/* Pregunta 2: Atención */}
              <div style={styles.ratingGroup}>
                <p style={styles.ratingGroupTitle}>😊 Atención del técnico</p>
                <span style={styles.desc}>¿Cómo calificarías el trato, respeto y amabilidad del personal?</span>
                <div style={styles.ratingOptions}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAtencion(val)}
                      style={{
                        ...styles.ratingBtn,
                        ...(atencion === val ? styles.ratingBtnSelected : {})
                      }}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div style={styles.ratingLabels}>
                  <span>Deficiente 🙁</span>
                  <span>Excelente 🌟</span>
                </div>
              </div>

              {/* Pregunta 3: Explicación */}
              <div style={styles.ratingGroup}>
                <p style={styles.ratingGroupTitle}>📢 Explicación del técnico</p>
                <span style={styles.desc}>¿Qué tan clara y detallada fue la explicación sobre el trabajo realizado?</span>
                <div style={styles.ratingOptions}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setExplicacion(val)}
                      style={{
                        ...styles.ratingBtn,
                        ...(explicacion === val ? styles.ratingBtnSelected : {})
                      }}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div style={styles.ratingLabels}>
                  <span>Confusa ❓</span>
                  <span>Muy clara 👍</span>
                </div>
              </div>

              {/* Comentario Adicional */}
              <div style={styles.ratingGroup}>
                <p style={styles.ratingGroupTitle}>💬 Comentarios adicionales (Opcional)</p>
                <textarea
                  rows="3"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Cuéntanos más sobre tu experiencia..."
                  style={styles.commentBox}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={styles.btnSubmit}
              >
                {submitting ? 'Enviando...' : 'Enviar Calificación'}
              </button>
            </form>
          </div>
        ) : (
          <div style={styles.thanksPanel}>
            <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🎉</div>
            <h3 style={{ color: '#2d2a26', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 10px 0' }}>¡Muchas gracias!</h3>
            <p style={{ color: '#5c5346', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
              Tus respuestas han sido registradas. Nos ayudan enormemente a seguir mejorando y ser el amigo que te conecta. 💙
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  bodyBg: {
    backgroundColor: '#e8e2d5',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '20px 15px',
    boxSizing: 'border-box',
    fontFamily: "'Inter', sans-serif"
  },
  centerContainer: {
    backgroundColor: '#e8e2d5',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  loadingCard: {
    background: '#f7f4eb',
    padding: '30px',
    borderRadius: '20px',
    textAlign: 'center',
    border: '1px solid #d6cfc2'
  },
  card: {
    background: '#f7f4eb',
    padding: '30px 24px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(45, 42, 38, 0.06)',
    width: '100%',
    maxWidth: '480px',
    boxSizing: 'border-box',
    textAlign: 'center',
    border: '1px solid #d6cfc2',
    margin: '20px auto'
  },
  header: {
    marginBottom: '25px'
  },
  logo: {
    height: '50px',
    width: 'auto',
    maxWidth: '150px',
    marginBottom: '12px',
    objectFit: 'contain'
  },
  title: {
    fontSize: '1.6rem',
    color: '#dc2626',
    fontWeight: 800,
    margin: '0 0 8px 0',
    letterSpacing: '-0.025em'
  },
  subtitle: {
    color: '#5c5346',
    fontSize: '0.95rem',
    margin: 0,
    lineHeight: 1.5
  },
  techInfo: {
    backgroundColor: '#e8e2d5',
    padding: '10px 18px',
    borderRadius: '100px',
    marginBottom: '25px',
    fontSize: '0.9rem',
    color: '#2d2a26',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: '1px solid #d6cfc2'
  },
  ratingGroup: {
    marginBottom: '24px',
    textAlign: 'left'
  },
  ratingGroupTitle: {
    fontWeight: 700,
    color: '#2d2a26',
    margin: '0 0 4px 0',
    fontSize: '0.95rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  desc: {
    fontWeight: 'normal',
    color: '#5c5346',
    display: 'block',
    marginTop: '2px',
    fontSize: '0.82rem',
    lineHeight: 1.4
  },
  ratingOptions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '4px',
    marginTop: '12px'
  },
  ratingBtn: {
    flex: 1,
    maxWidth: '36px',
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #c8bfae',
    borderRadius: '50%',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#5c5346',
    fontSize: '0.85rem',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    userSelect: 'none',
    backgroundColor: '#f7f4eb',
    boxSizing: 'border-box'
  },
  ratingBtnSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: 'white',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
    transform: 'scale(1.08)'
  },
  ratingLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.72rem',
    color: '#8c806d',
    marginTop: '6px',
    fontWeight: 600
  },
  commentBox: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1.5px solid #c8bfae',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    marginTop: '10px',
    outline: 'none',
    resize: 'none',
    backgroundColor: '#f7f4eb',
    color: '#2d2a26'
  },
  btnSubmit: {
    width: '100%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    padding: '14px',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '1.05rem',
    cursor: 'pointer',
    marginTop: '15px',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
  },
  thanksPanel: {
    textAlign: 'center',
    padding: '20px 0'
  }
};
