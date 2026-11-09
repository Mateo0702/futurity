import React from 'react';

export default function TimelineResourcesList({
  tecnicos = [],
  visitasPorTecnico = {},
  techLayoutMap = {},
  dragOverTecnico = null,
  activeArea
}) {
  const getInitials = (name) => {
    if (!name) return 'TC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarGradient = (idx) => {
    const gradients = [
      'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      'linear-gradient(135deg, #059669 0%, #047857 100%)',
      'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
    ];
    return gradients[idx % gradients.length];
  };

  return (
    <div className="crono-resources-col">
      <div className="crono-resources-header">
        <span>Técnico / Cuadrilla</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
          {tecnicos.length} Activos
        </span>
      </div>

      {tecnicos.map((t, idx) => {
        const visitas = visitasPorTecnico[t.nombre] || [];
        const count = visitas.length;
        const hasOverdue = visitas.some(v => v._isOverdue);
        const hasEnRuta = visitas.some(v => v.estado === 'EN_RUTA');
        const hasEnSitio = visitas.some(v => v.estado === 'EN_SITIO' || v.estado === 'EN_PROGRESO');

        // Cálculo de horas reales programadas (jornada de 8 horas = 480 min)
        const totalMinutes = visitas.reduce((acc, v) => {
          if (v.ventana_inicio_min && v.ventana_fin_min && v.ventana_fin_min > v.ventana_inicio_min) {
            return acc + (v.ventana_fin_min - v.ventana_inicio_min);
          }
          if (v.preferencia_horaria) {
            const match = String(v.preferencia_horaria).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|a|hasta|\/)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (match) {
              let h1 = parseInt(match[1], 10);
              const m1 = match[2] ? parseInt(match[2], 10) : 0;
              let h2 = parseInt(match[4], 10);
              const m2 = match[5] ? parseInt(match[5], 10) : 0;
              if (h2 < h1 || (h2 >= 1 && h2 <= 7 && h1 >= 8)) h2 += 12;
              return acc + Math.max(30, (h2 * 60 + m2) - (h1 * 60 + m1));
            }
          }
          return acc + 90;
        }, 0);

        const totalHours = (totalMinutes / 60).toFixed(1).replace('.0', '');
        const apoyosCount = visitas.filter(v => v._esApoyo).length;

        let statusColor = '#10b981'; // Libre / Verde
        let statusText = 'Libre';
        if (hasOverdue) {
          statusColor = '#ef4444';
          statusText = 'Atrasado';
        } else if (hasEnSitio) {
          statusColor = '#8b5cf6';
          statusText = 'En Sitio';
        } else if (hasEnRuta) {
          statusColor = '#0284c7';
          statusText = 'En Ruta';
        } else if (apoyosCount > 0) {
          statusColor = '#0284c7';
          statusText = 'En Apoyo';
        }

        // Carga porcentual de 8 horas
        const loadPct = Math.min((totalMinutes / 480) * 100, 100);

        // Datos de sub-carriles y solapamientos
        const layout = (techLayoutMap && techLayoutMap[t.nombre]) || { maxLanes: 1, rowHeight: 94, conflictCount: 0 };
        const rowHeight = layout.rowHeight || 94;
        const hasConflict = (layout.conflictCount || 0) > 0 || layout.maxLanes > 1;

        return (
          <div
            key={t.id_tecnico || t.nombre}
            className={`crono-resource-row ${dragOverTecnico === t.nombre ? 'is-drag-target' : ''} ${hasOverdue ? 'has-overdue' : ''} ${hasConflict ? 'has-conflict' : ''}`}
            style={{
              height: `${rowHeight}px`,
              minHeight: '94px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Avatar */}
              <div
                className="crono-avatar-box"
                style={{ background: getAvatarGradient(idx) }}
              >
                {t.foto_perfil && t.foto_perfil !== 'default_avatar.png' ? (
                  <img
                    src={`/uploads/perfiles/${t.foto_perfil}`}
                    alt={t.nombre}
                    className="crono-avatar-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : null}
                <span>{getInitials(t.nombre)}</span>
                <span
                  className="crono-online-dot"
                  style={{ background: statusColor }}
                  title={`Estado: ${statusText}`}
                ></span>
              </div>

              {/* Info del técnico */}
              <div style={{ overflow: 'hidden', flexGrow: 1 }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {t.nombre}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.7rem',
                  color: 'var(--sidebar-text)',
                  marginTop: '1px'
                }}>
                  {t.placa_vehiculo && t.placa_vehiculo !== 'S/P' ? (
                    <span style={{
                      background: '#e2e8f0',
                      color: '#334155',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 700
                    }}>
                      🚙 {t.placa_vehiculo}
                    </span>
                  ) : (
                    <span>Técnico</span>
                  )}
                  <span style={{ color: statusColor, fontWeight: 700 }}>
                    • {statusText}
                  </span>
                  {hasConflict && (
                    <span
                      className="crono-conflict-tech-pill"
                      title="Atención: Este técnico tiene 2 o más visitas programadas al mismo tiempo"
                    >
                      <i className="fa-solid fa-bolt"></i> Solapado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Medidor de carga */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <div className="crono-workload-bar">
                <div
                  className="crono-workload-fill"
                  style={{
                    width: `${loadPct}%`,
                    background: loadPct > 85 ? '#ef4444' : loadPct > 50 ? '#f59e0b' : '#10b981'
                  }}
                ></div>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--sidebar-text)', whiteSpace: 'nowrap' }}>
                {count} vis ({totalHours}h){apoyosCount > 0 ? ` • 🤝 ${apoyosCount} apoyo` : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
