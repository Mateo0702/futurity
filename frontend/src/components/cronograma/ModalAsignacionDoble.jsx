import React, { useState, useEffect } from 'react';

export default function ModalAsignacionDoble({
  isOpen,
  onClose,
  visita,
  tecnicos = [],
  onConfirm
}) {
  const [tecnicoPrincipal, setTecnicoPrincipal] = useState('');
  const [tecnicoApoyo, setTecnicoApoyo] = useState('');
  const [tipoApoyo, setTipoApoyo] = useState('COMPLETO'); // 'COMPLETO' | 'REFUERZO'
  const [horaInicioRefuerzo, setHoraInicioRefuerzo] = useState('11:00');
  const [preferenciaHoraria, setPreferenciaHoraria] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visita) {
      setTecnicoPrincipal(visita.tecnico_principal || '');
      setTecnicoApoyo(visita.tecnico_apoyo || '');
      setPreferenciaHoraria(visita.preferencia_horaria || '');

      const note = `${visita.observacion_callcenter || ''} ${visita.preferencia_horaria || ''}`;
      const match = note.match(/(?:refuerzo|apoyo).*?(?:desde|a las)\s*(\d{1,2}:\d{2})/i);
      if (match) {
        setTipoApoyo('REFUERZO');
        setHoraInicioRefuerzo(match[1]);
      } else {
        setTipoApoyo('COMPLETO');
      }
    }
  }, [visita]);

  if (!isOpen || !visita) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tecnicoPrincipal || tecnicoPrincipal === 'NO TECNICO') {
      alert("Por favor selecciona al menos el Técnico Principal.");
      return;
    }
    if (tecnicoPrincipal === tecnicoApoyo) {
      alert("El técnico principal y el técnico de apoyo no pueden ser la misma persona.");
      return;
    }

    setGuardando(true);
    try {
      let horarioFinal = preferenciaHoraria;
      if (tecnicoApoyo && tipoApoyo === 'REFUERZO' && horaInicioRefuerzo) {
        // Añadir nota de incorporación a media visita si no estaba ya presente
        if (!horarioFinal.includes('Apoyo desde')) {
          horarioFinal = `${horarioFinal} (Apoyo desde las ${horaInicioRefuerzo})`.trim();
        }
      }

      await onConfirm({
        id_visita: visita.id_visita,
        tecnico_principal: tecnicoPrincipal,
        tecnico_apoyo: tecnicoApoyo || '',
        preferencia_horaria: horarioFinal,
        tipo_apoyo: tipoApoyo,
        hora_inicio_refuerzo: horaInicioRefuerzo
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al asignar visita: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const tecnicosActivos = tecnicos.filter(t => t.nombre !== 'NO TECNICO' && t.nombre !== 'TECNOLOGIA');

  return (
    <div className="crono-modal-overlay" onClick={onClose}>
      <div className="crono-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-users-gear" style={{ color: '#38bdf8' }}></i>
              Asignación de Cuadrilla & Turno
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', opacity: 0.85 }}>
              Ticket #{visita.contrato || visita.id_visita} • {visita.cliente}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{
            background: 'rgba(241, 245, 249, 0.7)',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '0.84rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--sidebar-text)' }}>Sector:</span>
              <strong>{visita.sector || 'No especificado'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--sidebar-text)' }}>Problema / Servicio:</span>
              <strong>{visita.problema || visita.servicio || 'Revisión'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--sidebar-text)' }}>Prioridad:</span>
              <span style={{
                color: visita.prioridad === 'ALTA' ? '#dc2626' : '#2563eb',
                fontWeight: 800
              }}>
                {visita.prioridad || 'MEDIA'}
              </span>
            </div>
          </div>

          {/* Técnico Principal */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
              <i className="fa-solid fa-user-tie" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>
              Técnico Principal (Líder) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={tecnicoPrincipal}
              onChange={(e) => setTecnicoPrincipal(e.target.value)}
              required
              className="form-select"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              <option value="">-- Seleccionar Técnico Titular --</option>
              {tecnicosActivos.map(t => (
                <option key={t.id_tecnico} value={t.nombre}>
                  {t.nombre} {t.placa_vehiculo ? `(${t.placa_vehiculo})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Técnico de Apoyo (Opcional - Cuadrilla de 2) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
              <i className="fa-solid fa-user-plus" style={{ color: '#0284c7', marginRight: '6px' }}></i>
              Técnico de Apoyo (Segunda persona en cuadrilla)
            </label>
            <select
              value={tecnicoApoyo}
              onChange={(e) => setTecnicoApoyo(e.target.value)}
              className="form-select"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                fontSize: '0.9rem'
              }}
            >
              <option value="">-- Sin Apoyo (Técnico Solo) --</option>
              {tecnicosActivos.filter(t => t.nombre !== tecnicoPrincipal).map(t => (
                <option key={t.id_tecnico} value={t.nombre}>
                  {t.nombre} (Apoyo)
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginTop: '4px' }}>
              Asigna a un segundo técnico cuando la visita requiera escalera pesada, tendido de fibra o asistencia en sitio.
            </span>

            {/* Modalidad de Apoyo / Refuerzo por complicación */}
            {tecnicoApoyo && (
              <div style={{
                background: 'rgba(2, 132, 199, 0.06)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginTop: '10px'
              }}>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', color: '#0369a1', marginBottom: '8px' }}>
                  <i className="fa-solid fa-clock-rotate-left"></i> Modalidad de Asignación del Apoyo:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="tipoApoyo"
                      value="COMPLETO"
                      checked={tipoApoyo === 'COMPLETO'}
                      onChange={() => setTipoApoyo('COMPLETO')}
                    />
                    <span><strong>Toda la visita:</strong> Participa desde el inicio junto a {tecnicoPrincipal || 'el titular'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="tipoApoyo"
                      value="REFUERZO"
                      checked={tipoApoyo === 'REFUERZO'}
                      onChange={() => setTipoApoyo('REFUERZO')}
                    />
                    <span><strong>Refuerzo en campo:</strong> Fue a asistir a media visita por complicación</span>
                  </label>
                </div>

                {tipoApoyo === 'REFUERZO' && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(2, 132, 199, 0.3)' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                      Hora en que se suma el apoyo:
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="time"
                        value={horaInicioRefuerzo}
                        onChange={(e) => setHoraInicioRefuerzo(e.target.value)}
                        className="form-control"
                        style={{ width: '130px', padding: '6px 10px', borderRadius: '8px', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.74rem', color: '#0369a1' }}>
                        En el cronograma se mostrará a {tecnicoApoyo.split(' ')[0]} ocupado a partir de esta hora.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Horario o Ventana de Tiempo */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
              <i className="fa-regular fa-clock" style={{ color: '#d97706', marginRight: '6px' }}></i>
              Horario / Bloque Estimado
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={preferenciaHoraria}
                onChange={(e) => setPreferenciaHoraria(e.target.value)}
                placeholder="Ej: 09:00 - 10:30 o 14:00"
                className="form-control"
                style={{
                  flexGrow: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem'
                }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPreferenciaHoraria('08:30 - 10:00')}
                  style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                >
                  Mañana (8:30)
                </button>
                <button
                  type="button"
                  onClick={() => setPreferenciaHoraria('11:00 - 12:30')}
                  style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                >
                  Mediodía
                </button>
                <button
                  type="button"
                  onClick={() => setPreferenciaHoraria('14:30 - 16:00')}
                  style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                >
                  Tarde (14:30)
                </button>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {guardando ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Guardando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i> Asignar al Cronograma
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
