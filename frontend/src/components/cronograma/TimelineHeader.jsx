import React from 'react';

export default function TimelineHeader({
  fechaFiltro,
  setFechaFiltro,
  stats,
  cantAtrasadas,
  cantSinAsignar,
  backlogOpen,
  setBacklogOpen,
  vistaModo,
  setVistaModo,
  onRefresh,
  loading,
  onOpenGlobalTelegramAlert
}) {
  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleStepDay = (step) => {
    try {
      const parts = fechaFiltro.split('-').map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      dt.setDate(dt.getDate() + step);
      setFechaFiltro(getTodayLocal(dt));
    } catch (e) {
      console.warn("Error changing date:", e);
    }
  };

  const isToday = fechaFiltro === getTodayLocal();

  const formattedDateStr = (() => {
    try {
      const parts = fechaFiltro.split('-').map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      return dt.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return fechaFiltro;
    }
  })();

  return (
    <div className="cronograma-toolbar">
      {/* Lado izquierdo: Selector de Fecha & Switch de Vista */}
      <div className="cronograma-toolbar-left">
        {/* Toggle de Modo: Tabla Clásica vs Cronograma Gantt */}
        <div className="crono-view-switcher">
          <button
            type="button"
            className={`crono-view-btn ${vistaModo === 'tabla' ? 'active' : ''}`}
            onClick={() => setVistaModo('tabla')}
          >
            <i className="fa-solid fa-table-list"></i>
            <span>Vista Tabla</span>
          </button>
          <button
            type="button"
            className={`crono-view-btn ${vistaModo === 'cronograma' ? 'active' : ''}`}
            onClick={() => setVistaModo('cronograma')}
          >
            <i className="fa-solid fa-chart-gantt"></i>
            <span>Cronograma Gantt</span>
          </button>
        </div>

        {/* Navegador de Fecha Rápida */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => handleStepDay(-1)}
            title="Día anterior"
            style={{ border: 'none', background: 'transparent', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          <button
            type="button"
            onClick={() => setFechaFiltro(getTodayLocal())}
            style={{
              border: 'none',
              background: isToday ? 'var(--primary)' : 'transparent',
              color: isToday ? '#ffffff' : '#0f172a',
              padding: '5px 12px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={() => handleStepDay(1)}
            title="Día siguiente"
            style={{ border: 'none', background: 'transparent', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        {/* Fecha con badge descriptivo */}
        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'capitalize' }}>
          📅 {formattedDateStr}
        </span>
      </div>

      {/* Lado derecho: Pills de KPIs en vivo & Botones */}
      <div className="cronograma-toolbar-right">
        {cantAtrasadas > 0 && (
          <span className="crono-kpi-pill danger" title="Visitas cuya ventana horaria ya venció y siguen pendientes">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{cantAtrasadas} Atrasada{cantAtrasadas > 1 ? 's' : ''}</span>
          </span>
        )}

        <span className="crono-kpi-pill info">
          <i className="fa-solid fa-route"></i>
          <span>{stats.pendientes} Pendientes</span>
        </span>

        <span className="crono-kpi-pill success">
          <i className="fa-solid fa-circle-check"></i>
          <span>{stats.finalizadas} Efectivas</span>
        </span>

        {/* Botón para notificar a Telegram Operaciones */}
        <button
          type="button"
          onClick={onOpenGlobalTelegramAlert}
          className="crono-btn"
          style={{
            borderColor: '#0284c7',
            color: '#0284c7',
            background: 'rgba(2, 132, 199, 0.08)'
          }}
          title="Preparar o enviar alerta a Telegram ante atrasos de la jornada"
        >
          <i className="fa-brands fa-telegram" style={{ fontSize: '1rem', color: '#0284c7' }}></i>
          <span>Telegram Alertas</span>
        </button>

        {/* Botón de Bandeja Sin Asignar (Drawer) */}
        <button
          type="button"
          onClick={() => setBacklogOpen(!backlogOpen)}
          className="crono-btn backlog-toggle"
          title="Bandeja de visitas sin asignar para arrastrar al cronograma"
        >
          <i className="fa-solid fa-inbox"></i>
          <span>Bandeja Backlog</span>
          {cantSinAsignar > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '9999px',
              padding: '1px 7px',
              fontSize: '0.72rem',
              fontWeight: 800,
              marginLeft: '4px'
            }}>
              {cantSinAsignar}
            </span>
          )}
        </button>

        {/* Botón de Refresco manual */}
        <button
          type="button"
          onClick={onRefresh}
          className="crono-btn"
          title="Actualizar datos del servidor"
          disabled={loading}
        >
          <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>
    </div>
  );
}
