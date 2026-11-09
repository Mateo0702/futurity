import React, { useState } from 'react';

export default function UnassignedBacklogDrawer({
  isOpen,
  onClose,
  visitas = [],
  onOpenAssignModal
}) {
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('TODAS');

  const visitasSinAsignar = visitas.filter(v => {
    const estado = (v.estado || 'PENDIENTE').toUpperCase();
    if (estado !== 'PENDIENTE') return false; // Visitas canceladas o finalizadas no van a la bandeja de pendientes
    const tech = (v.tecnico_principal || '').trim().toUpperCase();
    const pref = (v.preferencia_horaria || '').trim().toUpperCase();
    const isUnassignedTech = !tech || tech === 'NO TECNICO' || tech === 'SIN ASIGNAR' || tech === 'AUTO';
    const isCoordinar = pref.includes('COORDINAR') || pref === 'FLEXIBLE';
    return isUnassignedTech || isCoordinar;
  });

  const visitasFiltradas = visitasSinAsignar.filter(v => {
    if (filterPrioridad !== 'TODAS' && v.prioridad !== filterPrioridad) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const matchClient = (v.cliente || '').toLowerCase().includes(q);
      const matchContrato = String(v.contrato || '').toLowerCase().includes(q);
      const matchSector = (v.sector || '').toLowerCase().includes(q);
      return matchClient || matchContrato || matchSector;
    }
    return true;
  });

  const handleDragStart = (e, v) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id_visita: v.id_visita,
      contrato: v.contrato,
      cliente: v.cliente,
      sector: v.sector,
      preferencia_horaria: v.preferencia_horaria,
      tecnico_principal: 'NO TECNICO'
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={`crono-backlog-drawer ${isOpen ? '' : 'collapsed'}`}>
      {/* Cabecera del Drawer */}
      <div className="crono-backlog-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.12)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.95rem'
          }}>
            <i className="fa-solid fa-inbox"></i>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Bandeja Sin Asignar
            </h4>
            <span style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)' }}>
              {visitasSinAsignar.length} visita(s) pendientes de asignar
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      {/* Filtros de la bandeja */}
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Filtrar cliente o sector..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}
        />

        <div style={{ display: 'flex', gap: '6px' }}>
          {['TODAS', 'ALTA', 'MEDIA', 'BAJA'].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setFilterPrioridad(p)}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: filterPrioridad === p ? (p === 'ALTA' ? '#ef4444' : '#6366f1') : '#e2e8f0',
                color: filterPrioridad === p ? '#ffffff' : '#475569'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de visitas sin asignar */}
      <div className="crono-backlog-body">
        {visitasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--sidebar-text)', fontSize: '0.84rem' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '2rem', color: '#10b981', display: 'block', marginBottom: '8px' }}></i>
            ¡Excelente! No hay visitas sin asignar para este filtro.
          </div>
        ) : (
          visitasFiltradas.map(v => (
            <div
              key={v.id_visita}
              className="crono-backlog-card"
              draggable
              onDragStart={(e) => handleDragStart(e, v)}
              title="Arrastra esta tarjeta hacia cualquier técnico del cronograma para asignarla"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  #{v.contrato || v.id_visita}
                </strong>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: v.prioridad === 'ALTA' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  color: v.prioridad === 'ALTA' ? '#dc2626' : '#4f46e5'
                }}>
                  {v.prioridad || 'MEDIA'}
                </span>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                {v.cliente}
              </div>

              <div style={{ fontSize: '0.76rem', color: 'var(--sidebar-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <i className="fa-solid fa-location-dot"></i>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.sector || 'Sector no especificado'}
                </span>
              </div>

              <div style={{ fontSize: '0.74rem', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', marginBottom: '8px' }}>
                <strong>Problema:</strong> {v.problema || v.servicio || 'Revisión'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: (v.preferencia_horaria || '').toUpperCase().includes('COORDINAR') ? '#0284c7' : '#d97706'
                }}>
                  {(v.preferencia_horaria || '').toUpperCase().includes('COORDINAR') ? '📞 POR COORDINAR' : `⏰ ${v.preferencia_horaria || 'Flexible'}`}
                </span>

                <button
                  type="button"
                  onClick={() => onOpenAssignModal(v)}
                  style={{
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Asignar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
