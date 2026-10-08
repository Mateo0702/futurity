import { useState, useEffect } from 'react';

const ESCALA_LABELS = {
  1: { label: 'Muy Malo', color: '#ef4444', emoji: '😞' },
  2: { label: 'Malo', color: '#f97316', emoji: '🙁' },
  3: { label: 'Aceptable', color: '#eab308', emoji: '😐' },
  4: { label: 'Bueno', color: '#3b82f6', emoji: '🙂' },
  5: { label: 'Muy Bueno', color: '#10b981', emoji: '🌟' }
};

export default function EncuestaCliente({ token }) {
  const [loading, setLoading] = useState(true);
  const [visita, setVisita] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state oficial ARCOTEL (escala 1 a 5)
  const [p1, setP1] = useState(null); // Trato o actitud
  const [p2, setP2] = useState(null); // Paciencia
  const [p3, setP3] = useState(null); // Disponibilidad
  const [p4, setP4] = useState(null); // Agilidad / Rapidez
  const [p5, setP5] = useState(null); // Tiempo de espera
  const [sugerencia, setSugerencia] = useState('');

  useEffect(() => {
    const fetchVisitaInfo = async () => {
      try {
        const res = await fetch(`/api/cliente/encuesta_info/${token}`);
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          setVisita(data.visita);
          if (data.ya_respondida) {
            setSubmitted(true);
          }
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

  const respondidasCount = [p1, p2, p3, p4, p5].filter(v => v !== null).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!p1 || !p2 || !p3 || !p4 || !p5) {
      alert('Por favor califique las 5 preguntas antes de enviar la encuesta.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        arcotel_p1_trato: p1,
        arcotel_p2_paciencia: p2,
        arcotel_p3_disponibilidad: p3,
        arcotel_p4_agilidad: p4,
        arcotel_p5_tiempo_espera: p5,
        arcotel_sugerencia: sugerencia.trim()
      };

      const res = await fetch(`/api/cliente/calificar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setSubmitted(true);
      } else {
        alert(data.message || 'Error al guardar la encuesta.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al enviar las respuestas. Por favor intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.loadingCard}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.4rem', color: '#1f497d', marginBottom: '14px' }}></i>
          <p style={{ margin: 0, fontWeight: 700, color: '#334155' }}>Cargando encuesta de calidad...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.card}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '16px' }}></i>
          <h2 style={{ color: '#ef4444', margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 900 }}>Enlace no disponible</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>{error}</p>
        </div>
      </div>
    );
  }

  const tecnicoNombreDisplay = () => {
    if (!visita) return 'Personal Técnico Futurity';
    if (visita.tecnico_principal && visita.tecnico_apoyo) {
      return `${visita.tecnico_principal.split(' ')[0]} y ${visita.tecnico_apoyo.split(' ')[0]}`;
    }
    return visita.tecnico_principal || 'Personal Técnico Futurity';
  };

  const renderRatingRow = (valActual, onChange) => {
    return (
      <div>
        <div style={styles.ratingOptions}>
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = valActual === num;
            const item = ESCALA_LABELS[num];
            return (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                style={{
                  ...styles.ratingBtn,
                  ...(isSelected ? {
                    backgroundColor: item.color,
                    borderColor: item.color,
                    color: '#ffffff',
                    transform: 'scale(1.08)',
                    boxShadow: `0 4px 12px ${item.color}40`
                  } : {})
                }}
              >
                {num}
              </button>
            );
          })}
        </div>
        <div style={styles.ratingLabels}>
          <span style={{ color: '#ef4444' }}>1. Muy Malo ❌</span>
          {valActual && (
            <span style={{ fontWeight: 800, color: ESCALA_LABELS[valActual].color, fontSize: '0.78rem' }}>
              {ESCALA_LABELS[valActual].emoji} {ESCALA_LABELS[valActual].label}
            </span>
          )}
          <span style={{ color: '#10b981' }}>5. Muy Bueno ⭐</span>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.bodyBg}>
      <div style={styles.card}>
        {!submitted ? (
          <div>
            {/* Header con Logo y Saludo Automatizado */}
            <div style={styles.header}>
              <img src="/static/img/logo_futurity.png" alt="Futurity Logo" style={styles.logo} />
              <h2 style={styles.title}>
                ¡Hola, {visita?.cliente ? visita.cliente.split(' ')[0] : 'Cliente'}! 👋
              </h2>
              <p style={styles.subtitle}>
                En base a la escala indicada, califique los siguientes aspectos del servicio de internet relacionados con la atención al cliente:
              </p>
            </div>

            {/* Ficha Informativa de la Visita (Automatizada) */}
            <div style={styles.techInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🧑‍🔧</span>
                <div style={{ textAlign: 'left' }}>
                  <small style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Técnico Asignado:</small>
                  <strong style={{ color: '#1e293b', fontSize: '0.88rem' }}>{tecnicoNombreDisplay()}</strong>
                </div>
              </div>
              {visita?.contrato && (
                <div style={{ textAlign: 'right', borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
                  <small style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Contrato:</small>
                  <strong style={{ color: '#1f497d', fontSize: '0.88rem' }}>#{visita.contrato}</strong>
                </div>
              )}
            </div>

            {/* Tabla de Referencia Escala Oficial ARCOTEL */}
            <div style={styles.scaleGuide}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px', textTransform: 'uppercase' }}>
                Escala de Calificación Oficial:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', padding: '3px 6px', borderRadius: '6px', fontWeight: 700 }}>1: Muy Malo</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(249, 115, 22, 0.1)', color: '#c2410c', padding: '3px 6px', borderRadius: '6px', fontWeight: 700 }}>2: Malo</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(234, 179, 8, 0.15)', color: '#854d0e', padding: '3px 6px', borderRadius: '6px', fontWeight: 700 }}>3: Aceptable</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', padding: '3px 6px', borderRadius: '6px', fontWeight: 700 }}>4: Bueno</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#047857', padding: '3px 6px', borderRadius: '6px', fontWeight: 800 }}>5: Muy Bueno</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
              
              {/* DIMENSIÓN 1: AMABILIDAD */}
              <div style={styles.sectionHeader}>
                <i className="fa-solid fa-heart" style={{ color: '#ec4899' }}></i> AMABILIDAD
              </div>

              {/* Pregunta 1 */}
              <div style={styles.questionCard}>
                <p style={styles.questionTitle}>
                  <strong>1.</strong> El trato o actitud del personal hacia el usuario. <span style={{ color: '#ef4444' }}>*</span>
                </p>
                {renderRatingRow(p1, setP1)}
              </div>

              {/* Pregunta 2 */}
              <div style={styles.questionCard}>
                <p style={styles.questionTitle}>
                  <strong>2.</strong> La paciencia para atender las quejas y sugerencias de los usuarios. <span style={{ color: '#ef4444' }}>*</span>
                </p>
                {renderRatingRow(p2, setP2)}
              </div>

              {/* DIMENSIÓN 2: DISPONIBILIDAD */}
              <div style={styles.sectionHeader}>
                <i className="fa-solid fa-hand-holding-hand" style={{ color: '#3b82f6' }}></i> DISPONIBILIDAD
              </div>

              {/* Pregunta 3 */}
              <div style={styles.questionCard}>
                <p style={styles.questionTitle}>
                  <strong>3.</strong> La disponibilidad del personal para ayudarle a solucionar sus requerimientos. <span style={{ color: '#ef4444' }}>*</span>
                </p>
                {renderRatingRow(p3, setP3)}
              </div>

              {/* DIMENSIÓN 3: RAPIDEZ */}
              <div style={styles.sectionHeader}>
                <i className="fa-solid fa-bolt" style={{ color: '#f59e0b' }}></i> RAPIDEZ
              </div>

              {/* Pregunta 4 */}
              <div style={styles.questionCard}>
                <p style={styles.questionTitle}>
                  <strong>4.</strong> Agilidad o rapidez para resolver las consultas o reclamos formulados por el usuario. <span style={{ color: '#ef4444' }}>*</span>
                </p>
                {renderRatingRow(p4, setP4)}
              </div>

              {/* Pregunta 5 */}
              <div style={styles.questionCard}>
                <p style={styles.questionTitle}>
                  <strong>5.</strong> Tiempo de espera para ser atendido, al momento de comunicar un reclamo o queja. <span style={{ color: '#ef4444' }}>*</span>
                </p>
                {renderRatingRow(p5, setP5)}
              </div>

              {/* COMENTARIO / SUGERENCIA */}
              <div style={styles.questionCard}>
                <p style={styles.questionTitle}>
                  💬 Sugerencia o comentario para mejorar nuestra atención al cliente:
                </p>
                <textarea
                  rows="3"
                  value={sugerencia}
                  onChange={(e) => setSugerencia(e.target.value)}
                  placeholder="Tu opinión nos ayuda a mejorar día a día..."
                  style={styles.commentBox}
                />
              </div>

              {/* BARRA DE PROGRESO Y BOTÓN ENVIAR */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#64748b', fontWeight: 700 }}>
                  <span>Progreso de la encuesta:</span>
                  <span style={{ color: respondidasCount === 5 ? '#10b981' : '#f59e0b' }}>
                    {respondidasCount} de 5 preguntas calificadas
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...styles.btnSubmit,
                    opacity: respondidasCount === 5 ? 1 : 0.85
                  }}
                >
                  {submitting ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Enviando calificación...</>
                  ) : (
                    <><i className="fa-solid fa-paper-plane"></i> Enviar Encuesta</>
                  )}
                </button>
              </div>

            </form>
          </div>
        ) : (
          <div style={styles.thanksPanel}>
            <div style={{ fontSize: '3.8rem', marginBottom: '12px' }}>🎉</div>
            <h3 style={{ color: '#1e293b', fontSize: '1.6rem', fontWeight: 900, margin: '0 0 10px 0' }}>
              ¡Muchas Gracias!
            </h3>
            <p style={{ color: '#475569', fontSize: '0.96rem', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              Tus respuestas han sido registradas exitosamente. En <strong>FUTURITY</strong> nos esforzamos diariamente para brindarte la mejor atención y calidad de conexión. 💙
            </p>
            <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', fontWeight: 800, fontSize: '0.82rem' }}>
              ✓ Encuesta Oficial Registrada
            </div>
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
    padding: '20px 14px 40px 14px',
    boxSizing: 'border-box',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  centerContainer: {
    backgroundColor: '#0f172a',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box'
  },
  loadingCard: {
    background: '#1e293b',
    padding: '36px',
    borderRadius: '24px',
    textAlign: 'center',
    border: '1px solid #334155',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    color: '#f8fafc'
  },
  card: {
    background: '#ffffff',
    padding: '28px 20px',
    borderRadius: '24px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
    width: '100%',
    maxWidth: '520px',
    boxSizing: 'border-box',
    textAlign: 'center',
    border: '1px solid #e2e8f0'
  },
  header: {
    marginBottom: '18px'
  },
  logo: {
    height: '46px',
    width: 'auto',
    maxWidth: '160px',
    marginBottom: '10px',
    objectFit: 'contain'
  },
  title: {
    fontSize: '1.45rem',
    color: '#1f497d',
    fontWeight: 900,
    margin: '0 0 6px 0',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    color: '#475569',
    fontSize: '0.84rem',
    margin: 0,
    lineHeight: 1.45
  },
  techInfo: {
    backgroundColor: '#f8fafc',
    padding: '10px 14px',
    borderRadius: '14px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #e2e8f0',
    gap: '10px'
  },
  scaleGuide: {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '10px 12px',
    textAlign: 'left',
    marginBottom: '18px'
  },
  sectionHeader: {
    fontSize: '0.78rem',
    fontWeight: 900,
    color: '#1f497d',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    textAlign: 'left',
    margin: '18px 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  questionCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '14px',
    marginBottom: '12px',
    textAlign: 'left'
  },
  questionTitle: {
    fontSize: '0.86rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 10px 0',
    lineHeight: 1.4
  },
  ratingOptions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px'
  },
  ratingBtn: {
    flex: 1,
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #cbd5e1',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 900,
    color: '#334155',
    fontSize: '1rem',
    transition: 'all 0.15s ease',
    userSelect: 'none',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box'
  },
  ratingLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    marginTop: '6px'
  },
  commentBox: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    fontSize: '0.86rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none',
    backgroundColor: '#ffffff',
    color: '#1e293b'
  },
  btnSubmit: {
    width: '100%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: '14px',
    fontWeight: 900,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  thanksPanel: {
    textAlign: 'center',
    padding: '30px 10px'
  }
};
