import React, { useState, useEffect } from 'react';

function VisitasTab({ token, user }) {
  const getTodayLocal = () => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    const hoyLocal = new Date(hoy.getTime() - (offset * 60 * 1000));
    return hoyLocal.toISOString().split('T')[0];
  };

  // Main state
  const [fechaFiltro, setFechaFiltro] = useState(getTodayLocal());
  const [buscarCliente, setBuscarCliente] = useState('');
  const [activeArea, setActiveArea] = useState('SOPORTE');
  
  const [loading, setLoading] = useState(false);
  const [visitas, setVisitas] = useState([]);
  const [stats, setStats] = useState({ pendientes: 0, finalizadas: 0, reagendadas: 0, canceladas: 0 });
  const [cantPendientesAtrasadas, setCantPendientesAtrasadas] = useState(0);
  const [ayerFecha, setAyerFecha] = useState('');
  const [recordatorios, setRecordatorios] = useState([]);
  
  // Expanded rows state (ID array)
  const [expandedRows, setExpandedRows] = useState({});

  // Initial load & filter effect + auto-refresh every 30s
  useEffect(() => {
    fetchVisitas();
    
    const interval = setInterval(() => {
      fetchVisitas(fechaFiltro, buscarCliente, activeArea, true);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fechaFiltro, activeArea, buscarCliente]);

  const fetchVisitas = async (targetFecha = fechaFiltro, targetSearch = buscarCliente, targetArea = activeArea, isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const url = `/api/v2/visitas?fecha=${encodeURIComponent(targetFecha)}&buscar=${encodeURIComponent(targetSearch)}&area=${encodeURIComponent(targetArea)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setVisitas(data.visitas || []);
        setStats(data.stats || { pendientes: 0, finalizadas: 0, reagendadas: 0, canceladas: 0 });
        setCantPendientesAtrasadas(data.cant_pendientes_atrasadas || 0);
        setAyerFecha(data.ayer_fecha || '');
        setRecordatorios(data.recordatorios || []);
      }
    } catch (e) {
      console.error("Error al cargar visitas del día:", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchVisitas();
  };

  const toggleDetalles = (idVisita) => {
    setExpandedRows(prev => ({
      ...prev,
      [idVisita]: !prev[idVisita]
    }));
  };

  const marcarRecordatorioAtendido = async (idRecordatorio) => {
    try {
      const res = await fetch('/api/v2/recordatorio/atendido', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_recordatorio: idRecordatorio })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRecordatorios(prev => prev.filter(r => r.id_recordatorio !== idRecordatorio));
      }
    } catch (e) {
      console.error("Error al marcar recordatorio como atendido:", e);
    }
  };

  // WhatsApp Agenda Notification Helper
  const enviarNotificacionWhatsApp = (visita) => {
    const rawPhones = visita.telefonos || '';
    const firstPhoneMatch = rawPhones.match(/\d{9,10}/);
    let cleanPhone = firstPhoneMatch ? firstPhoneMatch[0] : '';
    
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '593' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9) {
      cleanPhone = '593' + cleanPhone;
    }

    const tipoVisita = visita.es_instalacion ? 'INSTALACIÓN DE SERVICIO' : 'VISITA TÉCNICA DE SOPORTE';
    const horarioPref = visita.preferencia_horaria || 'En el transcurso del día';
    const tecnico = visita.tecnico_principal || 'Cuadrilla asignada';
    const placa = visita.placa_vehiculo_principal ? ` (Vehículo: ${visita.placa_vehiculo_principal})` : '';

    const msg = `Estimado/a *${visita.cliente}*,\nLe saludamos de *Futurity Telecomunicaciones*.\n\n` +
      `Le informamos que su *${tipoVisita}* se encuentra programada para el día *${visita.fecha_programada}*.\n` +
      `⏰ Horario estimado: *${horarioPref}*\n` +
      `👤 Técnico asignado: *${tecnico}*${placa}\n\n` +
      `Por favor, asegúrese de estar en el domicilio para recibir al personal técnico. ¡Gracias por preferirnos!`;

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div id="tab-visitas" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Hero Header de Centro de Comando */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-[#6366f1] fa-route" style={{ color: 'var(--primary)' }}></i>
            Centro de Comando ({activeArea === 'INSTALACIONES' ? 'Calidad & Instalaciones' : 'Soporte Técnico'})
          </h1>
          <p style={{ marginTop: '4px', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Monitoreo operativo de visitas, cuadrillas, rutas geográficas y estados en tiempo real.
          </p>
        </div>

        {/* Controles de Filtros & Área */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Selector de Área (Soporte vs Instalaciones) */}
          <div style={{ background: 'var(--profile-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex' }}>
            <button
              type="button"
              onClick={() => setActiveArea('SOPORTE')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: activeArea === 'SOPORTE' ? 'var(--primary)' : 'transparent',
                color: activeArea === 'SOPORTE' ? 'white' : 'var(--sidebar-text)',
                transition: 'all 0.2s'
              }}
            >
              🛠️ Soporte
            </button>
            <button
              type="button"
              onClick={() => setActiveArea('INSTALACIONES')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: activeArea === 'INSTALACIONES' ? '#6366f1' : 'transparent',
                color: activeArea === 'INSTALACIONES' ? 'white' : 'var(--sidebar-text)',
                transition: 'all 0.2s'
              }}
            >
              📡 Instalaciones
            </button>
          </div>

          {/* Formulario de Búsqueda y Fecha */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <i className="fa-regular fa-calendar-days" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)', fontSize: '0.85rem' }}></i>
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="form-control"
                style={{ padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)', fontSize: '0.85rem' }}></i>
              <input
                type="text"
                value={buscarCliente}
                onChange={(e) => setBuscarCliente(e.target.value)}
                placeholder="Buscar cliente, sector o contrato..."
                className="form-control"
                style={{ width: '220px', padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>

            <button
              type="submit"
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* Banner 1: Visitas pendientes atrasadas de ayer */}
      {cantPendientesAtrasadas > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderLeft: '5px solid #ef4444', borderRadius: '16px', padding: '18px 24px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ color: '#ef4444', fontSize: '1.5rem' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#ef4444', fontSize: '1.05rem', fontWeight: 800 }}>Visitas pendientes del día de ayer</h4>
              <p style={{ margin: '2px 0 0 0', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 500 }}>
                Quedaron <strong>{cantPendientesAtrasadas}</strong> visita(s) pendiente(s) de ayer sin reagendar o finalizar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFechaFiltro(ayerFecha)}
            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fa-solid fa-calendar-day"></i> Ver Visitas de Ayer ({ayerFecha})
          </button>
        </div>
      )}

      {/* Banner 2: Recordatorios y Bloqueos de Hoy */}
      {recordatorios.length > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.12)', borderLeft: '5px solid #f59e0b', borderRadius: '16px', padding: '18px 24px', marginBottom: '25px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#d97706', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-bell"></i> Recordatorios y Bloqueos de Hoy ({recordatorios.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recordatorios.map((rec) => (
              <div key={rec.id_recordatorio} style={{ background: 'var(--card-bg)', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    [{rec.tipo === 'RECORDATORIO_TECNICO' ? `Técnico: ${rec.tecnico_nombre}` : rec.tipo}] {rec.titulo}
                  </strong>
                  {rec.descripcion && <p style={{ margin: '3px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.83rem' }}>{rec.descripcion}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="pro-badge-amber">
                    <i className="fa-regular fa-clock"></i> {rec.hora_inicio_str || 'Todo el día'} {rec.hora_fin_str ? `- ${rec.hora_fin_str}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => marcarRecordatorioAtendido(rec.id_recordatorio)}
                    style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-check"></i> Atendido
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de KPIs (4 Tarjetas) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        
        {/* Pendientes */}
        <div className="card" style={{ padding: '20px 24px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pendientes</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-clock"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '12px' }}>
            {stats.pendientes}
          </div>
        </div>

        {/* Efectivas */}
        <div className="card" style={{ padding: '20px 24px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Efectivas</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981', marginTop: '12px' }}>
            {stats.finalizadas}
          </div>
        </div>

        {/* Reagendadas */}
        <div className="card" style={{ padding: '20px 24px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reagendadas</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-calendar-days"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', marginTop: '12px' }}>
            {stats.reagendadas}
          </div>
        </div>

        {/* Canceladas */}
        <div className="card" style={{ padding: '20px 24px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Canceladas</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-circle-xmark"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ef4444', marginTop: '12px' }}>
            {stats.canceladas}
          </div>
        </div>
      </div>

      {/* Tabla Pro Data Table de Visitas */}
      <div className="card" style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-list" style={{ color: 'var(--primary)' }}></i> Lista de Visitas ({visitas.length})
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
            {new Date(fechaFiltro + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="historial-reciente-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textCenter: 'center', width: '90px' }}>#Parada</th>
                <th>Cliente / Horario</th>
                <th>Sector</th>
                <th>Técnico Asignado</th>
                <th>{activeArea === 'INSTALACIONES' ? 'Servicio / Producto' : 'Problema'}</th>
                <th>Estado & Marcas</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '35px 0' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px auto' }}></div>
                    Cargando visitas operativas...
                  </td>
                </tr>
              ) : visitas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '35px 0', fontStyle: 'italic' }}>
                    No hay visitas registradas para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                visitas.map((v) => {
                  const isExpanded = !!expandedRows[v.id_visita];
                  const initials = v.cliente ? v.cliente.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : 'VT';

                  let estadoBadgeClass = 'pro-badge-neutral';
                  let estadoText = v.estado || 'PENDIENTE';

                  if (estadoText === 'FINALIZADA') estadoBadgeClass = 'pro-badge-whatsapp';
                  else if (estadoText === 'EN_RUTA') estadoBadgeClass = 'pro-badge-phone';
                  else if (estadoText === 'EN_SITIO') estadoBadgeClass = 'pro-badge-amber';
                  else if (estadoText === 'CANCELADA') estadoBadgeClass = 'pro-contract-pill';
                  else if (estadoText === 'REAGENDADA') estadoBadgeClass = 'pro-badge-office';

                  return (
                    <React.Fragment key={v.id_visita}>
                      <tr style={{ background: isExpanded ? 'rgba(99, 102, 241, 0.05)' : 'transparent', transition: 'background 0.2s' }}>
                        
                        {/* Parada & ID */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '6px' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Parada</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>#{v.numero_parada || 0}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', marginTop: '3px', fontWeight: 700 }}>VT-{v.id_visita}</div>
                          </div>
                          {v.prioridad && (
                            <div style={{ marginTop: '6px' }}>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: v.prioridad === 'ALTA' ? 'rgba(239, 68, 68, 0.15)' : v.prioridad === 'BAJA' ? 'rgba(100, 116, 139, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: v.prioridad === 'ALTA' ? '#ef4444' : v.prioridad === 'BAJA' ? '#64748b' : '#f59e0b'
                              }}>
                                {v.prioridad}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Cliente + Horario */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div className="pro-client-cell">
                            <div className="pro-avatar-circle">{initials}</div>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>{v.cliente}</div>
                              {v.preferencia_horaria && (
                                <div className="pro-badge-amber" style={{ marginTop: '4px', fontSize: '0.7rem' }}>
                                  ⏰ {v.preferencia_horaria}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Sector */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <span className="pro-badge-neutral">
                            <i className="fa-solid fa-location-dot" style={{ marginRight: '4px', opacity: 0.7 }}></i>
                            {v.sector || 'Sin sector'}
                          </span>
                        </td>

                        {/* Técnico Asignado */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                            👨‍🔧 {v.tecnico_principal || 'Auto / Sin Asignar'}
                          </div>
                          {v.placa_vehiculo_principal && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', marginTop: '2px' }}>
                              🚗 Placa: <strong>{v.placa_vehiculo_principal}</strong>
                            </div>
                          )}
                        </td>

                        {/* Servicio / Problema */}
                        <td style={{ verticalAlign: 'middle', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {activeArea === 'INSTALACIONES' ? `${v.servicio || '-'} / ${v.producto || '-'}` : (v.problema || '-')}
                        </td>

                        {/* Estado */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <span className={estadoBadgeClass}>
                            {estadoText.replace('_', ' ')}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', marginTop: '4px', lineHeight: '1.4' }}>
                            {(() => {
                              const parseDate = (str) => {
                                if (!str) return null;
                                return new Date(str.replace(' ', 'T'));
                              };
                              
                              if (v.estado === 'FINALIZADA') {
                                const enRuta = parseDate(v.hora_en_ruta);
                                const inicio = parseDate(v.hora_inicio_visita);
                                const fin = parseDate(v.hora_fin_visita);
                                
                                let trasladoMin = 0;
                                let trabajoMin = 0;
                                
                                if (enRuta && inicio) {
                                  trasladoMin = Math.max(0, Math.round((inicio - enRuta) / 60000));
                                }
                                if (inicio && fin) {
                                  trabajoMin = Math.max(0, Math.round((fin - inicio) / 60000));
                                }
                                
                                return (
                                  <>
                                    {v.hora_en_ruta && <div>🚚 Traslado: {trasladoMin} min</div>}
                                    {v.hora_inicio_visita && <div>📍 Trabajo: {trabajoMin} min</div>}
                                    {v.hora_fin_visita && <div>🏁 Fin: {v.hora_fin_visita.substring(11, 16)}</div>}
                                  </>
                                );
                              } else if (v.estado === 'EN_RUTA' && v.hora_en_ruta) {
                                const enRuta = parseDate(v.hora_en_ruta);
                                const diffMin = Math.max(0, Math.floor((new Date() - enRuta) / 60000));
                                return <div>🚚 Traslado: {diffMin} min...</div>;
                              } else if (v.estado === 'EN_PROGRESO' && v.hora_inicio_visita) {
                                const inicio = parseDate(v.hora_inicio_visita);
                                const diffMin = Math.max(0, Math.floor((new Date() - inicio) / 60000));
                                return (
                                  <>
                                    {v.hora_en_ruta && <div>🚚 En ruta: {v.hora_en_ruta.substring(11, 16)}</div>}
                                    <div>📍 Trabajo: {diffMin} min...</div>
                                  </>
                                );
                              } else if (v.estado === 'PENDIENTE') {
                                return <div style={{ fontStyle: 'italic', color: '#94a3b8' }}>💤 Sin iniciar</div>;
                              } else {
                                return (
                                  <>
                                    {v.hora_en_ruta && <div>🚚 En ruta: {v.hora_en_ruta.substring(11, 16)}</div>}
                                    {v.hora_inicio_visita && <div>📍 En sitio: {v.hora_inicio_visita.substring(11, 16)}</div>}
                                    {v.hora_fin_visita && <div>🏁 Fin: {v.hora_fin_visita.substring(11, 16)}</div>}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </td>

                        {/* Botón Detalles */}
                        <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggleDetalles(v.id_visita)}
                            style={{
                              background: isExpanded ? '#6366f1' : 'var(--profile-bg)',
                              color: isExpanded ? 'white' : 'var(--sidebar-text)',
                              border: '1px solid var(--border-color)',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-circle-info'}`}></i>
                            {isExpanded ? 'Ocultar' : 'Detalles'}
                          </button>
                        </td>
                      </tr>

                      {/* Fila Desplegable de Detalles */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" style={{ padding: '20px 25px', background: 'rgba(99, 102, 241, 0.03)', borderBottom: '2px solid var(--border-color)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', fontSize: '0.88rem' }}>
                              
                              {/* Columna Izquierda: Información de Cliente y Contrato */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div><strong>👤 Creado por:</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{v.creado_por || 'Sistema'}</span></div>
                                <div><strong>📄 Contrato:</strong> <span className="pro-contract-pill">#{v.contrato}</span> ({v.empresa || 'Futurity'})</div>
                                <div>
                                  <strong>📞 Contacto:</strong> {v.telefonos || 'Sin teléfono'}
                                  <button
                                    type="button"
                                    onClick={() => enviarNotificacionWhatsApp(v)}
                                    style={{ background: '#25d366', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <i className="fa-brands fa-whatsapp"></i> Avisar Agenda WhatsApp
                                  </button>
                                </div>
                                <div><strong>📍 Dirección:</strong> {v.direccion || '-'}</div>
                                <div><strong>⏰ Horario Cliente:</strong> {v.preferencia_horaria || 'Flexible'}</div>

                                {/* Bloque Comercial (Pago Mensual, Antigüedad, Serie) */}
                                <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block' }}>💵 Pago Mensual</span>
                                    <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{v.total_mensual ? `$${v.total_mensual.toFixed(2)}` : 'N/D'}</strong>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block' }}>⏳ Antigüedad</span>
                                    <strong style={{ color: '#0284c7', fontSize: '0.85rem' }}>{v.antiguedad_fmt || 'N/D'}</strong>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block' }}>🏷️ SN (Serie)</span>
                                    <strong style={{ color: '#f59e0b', fontSize: '0.82rem', wordBreak: 'break-all' }}>{v.numero_serie || 'S/N'}</strong>
                                  </div>
                                </div>
                              </div>

                              {/* Columna Derecha: Información Técnica y Observación */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                  <strong>📡 Servicio:</strong> {v.servicio || '-'} {v.velocidad_mbps ? `(${v.velocidad_mbps} Mbps)` : ''}
                                </div>

                                <div>
                                  <strong>🗣️ Observación Callcenter:</strong>
                                  <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px' }}>
                                    {v.observacion_callcenter || 'Sin observaciones registradas.'}
                                  </div>
                                </div>

                                {/* Datos de Conexión Poste/Nodo */}
                                {(v.info_caja || v.info_hilo || v.info_ip || v.info_vlan || v.info_usr) && (
                                  <div style={{ background: 'var(--profile-bg)', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '12px', marginTop: '6px' }}>
                                    <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>
                                      🔌 Datos de Conexión (Poste / Nodo)
                                    </strong>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.82rem' }}>
                                      {v.info_caja && <div><span style={{ color: 'var(--sidebar-text)' }}>Caja/NAP:</span> <strong>{v.info_caja}</strong></div>}
                                      {v.info_hilo && <div><span style={{ color: 'var(--sidebar-text)' }}>Hilo/Puerto:</span> <strong>{v.info_hilo}</strong></div>}
                                      {v.info_ip && <div><span style={{ color: 'var(--sidebar-text)' }}>IP Fija:</span> <strong>{v.info_ip}</strong></div>}
                                      {v.info_vlan && <div><span style={{ color: 'var(--sidebar-text)' }}>VLAN:</span> <strong>{v.info_vlan}</strong></div>}
                                      {v.info_usr && (
                                        <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                                          <span style={{ color: 'var(--sidebar-text)' }}>PPPoE:</span> <strong>{v.info_usr}</strong> {v.info_pas ? `| Clave: ${v.info_pas}` : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default VisitasTab;
