import React, { useState, useEffect } from 'react';

function VisitasTab({ token, user }) {
  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  const [tecnicos, setTecnicos] = useState([]);
  
  // Expanded rows state (ID array)
  const [expandedRows, setExpandedRows] = useState({});

  // Modal FO schedule state
  const [modalFO, setModalFO] = useState({
    isOpen: false,
    idVisitaOrigen: '',
    contrato: '',
    cliente: '',
    sector: '',
    direccion: '',
    telefonos: '',
    empresa: 'SERVICABLE',
    servicio: 'INTERNET_GPON',
    fechaProgramada: '',
    preferenciaHoraria: 'COORDINAR',
    tecnicoPrincipal: 'NO TECNICO',
    observacionCallcenter: 'Coordinación previa de revisión técnica. Trabajo a realizar: CAMBIO DE FO'
  });

  // Action states for inline forms & edit modal
  const [activeActionForm, setActiveActionForm] = useState({}); // { [idVisita]: 'reagendar' | 'reasignar' | 'cancelar' | null }
  const [formReagendar, setFormReagendar] = useState({}); // { [id]: { fecha: '', prioridad: 'MEDIA', observacion: '' } }
  const [formReasignar, setFormReasignar] = useState({}); // { [id]: { tecnico: '', apoyo: '' } }
  const [formCancelar, setFormCancelar] = useState({}); // { [id]: { motivo: '', estado: 'CANCELADA' } }

  const [modalEditar, setModalEditar] = useState({
    isOpen: false,
    idVisita: '',
    cliente: '',
    contrato: '',
    telefonos: '',
    sector: '',
    direccion: '',
    latitud: '',
    longitud: '',
    fechaProgramada: '',
    preferenciaHoraria: '',
    servicio: '',
    velocidadMbps: '',
    problema: '',
    observacionCallcenter: '',
    infoCaja: '',
    infoHilo: '',
    infoIp: '',
    infoVlan: '',
    infoUsr: '',
    infoPas: '',
    estado: 'PENDIENTE'
  });

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

  useEffect(() => {
    const fetchTecnicos = async () => {
      try {
        const res = await fetch('/api/v2/tecnicos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setTecnicos(data.tecnicos || []);
        }
      } catch (e) {
        console.error("Error fetching tecnicos:", e);
      }
    };
    if (token) fetchTecnicos();
  }, [token]);

  const abrirModalCambioFO = (v) => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = getTodayLocal(manana);

    setModalFO({
      isOpen: true,
      idVisitaOrigen: v.id_visita,
      contrato: v.contrato,
      cliente: v.cliente,
      sector: v.sector,
      direccion: v.direccion,
      telefonos: v.telefonos,
      empresa: v.empresa || 'SERVICABLE',
      servicio: v.servicio || 'INTERNET_GPON',
      fechaProgramada: mananaStr,
      preferenciaHoraria: 'COORDINAR',
      tecnicoPrincipal: 'NO TECNICO',
      observacionCallcenter: 'Coordinación previa de revisión técnica. Trabajo a realizar: CAMBIO DE FO'
    });
  };

  const handleGuardarCambioFO = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/visitas/crear_cambio_fo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          id_visita_origen: modalFO.idVisitaOrigen,
          contrato: modalFO.contrato,
          cliente: modalFO.cliente,
          sector: modalFO.sector,
          direccion: modalFO.direccion,
          telefonos: modalFO.telefonos,
          empresa: modalFO.empresa,
          servicio: modalFO.servicio,
          fecha_programada: modalFO.fechaProgramada,
          preferencia_horaria: modalFO.preferenciaHoraria,
          tecnico_principal: modalFO.tecnicoPrincipal,
          observacion_callcenter: modalFO.observacionCallcenter
        })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert("¡Visita de Cambio de FO agendada con éxito!");
        setModalFO(prev => ({ ...prev, isOpen: false }));
        fetchVisitas();
      } else {
        alert("Error al agendar: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
    }
  };

  const handleReagendar = async (idVisita) => {
    const data = formReagendar[idVisita];
    if (!data || !data.fecha) {
      alert("Por favor selecciona una fecha válida.");
      return;
    }
    try {
      const res = await fetch(`/api/visitas/reagendar/${idVisita}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          nueva_fecha: data.fecha,
          nueva_prioridad: data.prioridad || 'MEDIA',
          observacion_reagendado: data.observacion || ''
        })
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        alert("¡Visita reagendada exitosamente!");
        setActiveActionForm(prev => ({ ...prev, [idVisita]: null }));
        fetchVisitas();
      } else {
        alert("Error al reagendar: " + (resData.message || ''));
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    }
  };

  const handleReasignar = async (idVisita) => {
    const data = formReasignar[idVisita];
    if (!data || !data.tecnico) {
      alert("Por favor selecciona al menos el técnico principal.");
      return;
    }
    try {
      const res = await fetch(`/api/visitas/${idVisita}/reasignar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          tecnico_principal: data.tecnico,
          tecnico_apoyo: data.apoyo || ''
        })
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        alert("¡Técnicos actualizados exitosamente!");
        setActiveActionForm(prev => ({ ...prev, [idVisita]: null }));
        fetchVisitas();
      } else {
        alert("Error al reasignar: " + (resData.message || ''));
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    }
  };

  const handleCancelar = async (idVisita) => {
    const data = formCancelar[idVisita];
    if (!data || !data.motivo) {
      alert("Por favor escribe el motivo.");
      return;
    }
    try {
      const res = await fetch(`/api/visitas/${idVisita}/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          motivo: data.motivo,
          estado_cancelacion: data.estado || 'CANCELADA'
        })
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        alert("¡Visita cerrada/cancelada exitosamente!");
        setActiveActionForm(prev => ({ ...prev, [idVisita]: null }));
        fetchVisitas();
      } else {
        alert("Error al cerrar: " + (resData.message || ''));
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    }
  };

  const abrirModalEditar = (v) => {
    let fecha = '';
    if (v.fecha_programada) {
      fecha = v.fecha_programada.substring(0, 10);
    }
    setModalEditar({
      isOpen: true,
      idVisita: v.id_visita,
      cliente: v.cliente || '',
      contrato: v.contrato || '',
      telefonos: v.telefonos || '',
      sector: v.sector || '',
      direccion: v.direccion || '',
      latitud: v.latitud || '',
      longitud: v.longitud || '',
      fechaProgramada: fecha,
      preferenciaHoraria: v.preferencia_horaria || '',
      servicio: v.servicio || '',
      velocidadMbps: v.velocidad_mbps || '',
      problema: v.problema || '',
      observacionCallcenter: v.observacion_callcenter || '',
      infoCaja: v.info_caja || '',
      infoHilo: v.info_hilo || '',
      infoIp: v.info_ip || '',
      infoVlan: v.info_vlan || '',
      infoUsr: v.info_usr || '',
      infoPas: v.info_pas || '',
      tecnicoPrincipal: v.tecnico_principal || '',
      tecnicoApoyo: v.tecnico_apoyo || '',
      estado: v.estado || 'PENDIENTE'
    });
  };

  const handleGuardarEditar = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/visitas/${modalEditar.idVisita}/editar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          cliente: modalEditar.cliente,
          contrato: modalEditar.contrato,
          telefonos: modalEditar.telefonos,
          sector: modalEditar.sector,
          direccion: modalEditar.direccion,
          latitud: modalEditar.latitud,
          longitud: modalEditar.longitud,
          fecha_programada: modalEditar.fechaProgramada,
          preferencia_horaria: modalEditar.preferenciaHoraria,
          servicio: modalEditar.servicio,
          velocidad_mbps: modalEditar.velocidadMbps,
          problema: modalEditar.problema,
          observacion_callcenter: modalEditar.observacionCallcenter,
          info_caja: modalEditar.infoCaja,
          info_hilo: modalEditar.infoHilo,
          info_ip: modalEditar.infoIp,
          info_vlan: modalEditar.infoVlan,
          info_usr: modalEditar.infoUsr,
          info_pas: modalEditar.infoPas,
          tecnico_principal: modalEditar.tecnicoPrincipal,
          tecnico_apoyo: modalEditar.tecnicoApoyo,
          estado: modalEditar.estado
        })
      });
      const data = await res.json();
      if (data.status === 'success' || data.status === 'ok') {
        alert("¡Visita modificada exitosamente!");
        setModalEditar(prev => ({ ...prev, isOpen: false }));
        fetchVisitas();
      } else {
        alert("Error al guardar: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
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
    let tecnicoDisplay = 'Cuadrilla asignada';
    if (visita.tecnico_principal && visita.tecnico_principal !== 'SIN ASIGNAR' && visita.tecnico_principal !== 'Auto' && visita.tecnico_principal.trim() !== '') {
      if (visita.tecnico_apoyo && visita.tecnico_apoyo !== 'SIN ASIGNAR' && visita.tecnico_apoyo.trim() !== '') {
        tecnicoDisplay = `${visita.tecnico_principal} y ${visita.tecnico_apoyo}`;
      } else {
        tecnicoDisplay = visita.tecnico_principal;
      }
    }

    const placa = visita.placa_vehiculo_principal ? ` (Vehículo: ${visita.placa_vehiculo_principal})` : '';

    const msg = `Estimado/a *${visita.cliente}*,\nLe saludamos de *Futurity Telecomunicaciones*.\n\n` +
      `Le informamos que su *${tipoVisita}* se encuentra programada para el día *${visita.fecha_programada}*.\n` +
      `⏰ Horario estimado: *${horarioPref}*\n` +
      `👤 Técnico asignado: *${tecnicoDisplay}*${placa}\n\n` +
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

                  const getFilaColorClass = (visita) => {
                    const estado = visita.estado || '';
                    const solucion = (visita.solucion_tecnico || visita.resolucion_final || '').toUpperCase();

                    if (solucion.includes('NO DESEA VISITA') || solucion.includes('SIN RESPUESTA') || estado === 'CANCELADA') {
                      return 'fila-roja';
                    }
                    if (estado === 'REAGENDADA' || solucion.includes('REAGENDADA')) {
                      return 'fila-celeste';
                    }
                    if (solucion.includes('GENERAR CAMBIO DE FO') || solucion.includes('REQUIERE CAMBIO DE FO')) {
                      return 'fila-naranja';
                    }
                    if (solucion.includes('SOLUCIÓN PARCIAL') || solucion.includes('SOLUCION PARCIAL') || solucion.includes('GESTIONAR ARREGLO')) {
                      return 'fila-morada';
                    }
                    if (solucion.includes('NOC')) {
                      return 'fila-amarilla';
                    }
                    if (solucion.includes('SATURACIÓN') || solucion.includes('SATURACION')) {
                      return 'fila-blanca';
                    }
                    if (estado === 'FINALIZADA' || estado === 'SOLVENTADA_REMOTA') {
                      return 'fila-verde';
                    }
                    return 'fila-pendiente';
                  };

                  const colorClass = getFilaColorClass(v);
                  const solUpper = (v.solucion_tecnico || '').toUpperCase();
                  const obsUpper = (v.observacion_tecnico || '').toUpperCase();
                  const isFOSolicitado = solUpper.includes('GENERAR CAMBIO DE FO') || solUpper.includes('REQUIERE CAMBIO DE FO') || obsUpper.includes('GENERAR CAMBIO DE FO');

                  return (
                    <React.Fragment key={v.id_visita}>
                      <tr className={colorClass} style={{ background: isExpanded ? 'rgba(99, 102, 241, 0.05)' : undefined, transition: 'background 0.2s' }}>
                        
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span className={estadoBadgeClass}>
                              {estadoText.replace('_', ' ')}
                            </span>
                            {isFOSolicitado && (
                              <span style={{
                                background: '#ffedd5',
                                color: '#c2410c',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                border: '1px solid #fed7aa',
                                display: 'inline-block'
                              }}>
                                🧡 FO Solicitado
                              </span>
                            )}
                          </div>
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
                                  <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                                    {v.observacion_callcenter || 'Sin observaciones registradas.'}
                                  </div>
                                </div>

                                {/* Motivo / Resolución según el estado */}
                                {v.resolucion_final && (
                                  <div>
                                    {v.estado === 'SOLVENTADA_REMOTA' ? (
                                      <>
                                        <strong style={{ color: '#059669' }}>💻 Solución Remota / Cierre:</strong>
                                        <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '8px', padding: '8px', fontWeight: 600 }}>
                                          {v.resolucion_final}
                                        </div>
                                      </>
                                    ) : v.estado === 'CANCELADA' ? (
                                      <>
                                        <strong style={{ color: '#dc2626' }}>🚫 Motivo de Cancelación:</strong>
                                        <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '8px', fontWeight: 600 }}>
                                          {v.resolucion_final}
                                        </div>
                                      </>
                                    ) : v.estado === 'REAGENDADA' ? (
                                      <>
                                        <strong style={{ color: '#d97706' }}>🗓️ Motivo Reagendado:</strong>
                                        <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', padding: '8px', fontWeight: 600 }}>
                                          {v.resolucion_final}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <strong>📋 Resolución Final:</strong>
                                        <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                                          {v.resolucion_final}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                {v.solucion_tecnico && (
                                  <div>
                                    <strong>🛠️ Solución Aplicada:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold', marginLeft: '6px' }}>{v.solucion_tecnico}</span>
                                  </div>
                                )}

                                {v.observacion_tecnico && (
                                  <div>
                                    <strong>📝 Observación Técnico:</strong>
                                    <div className="pro-obs-box" style={{ maxWidth: '100%', whiteSpace: 'normal', marginTop: '4px', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                                      {v.observacion_tecnico}
                                    </div>
                                  </div>
                                )}

                                {(v.modelo_onu || v.modelo_router) && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', background: 'var(--profile-bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                                    <div><strong>ONU Instalada:</strong> <span style={{ color: 'var(--sidebar-text)', marginLeft: '4px' }}>{v.modelo_onu || 'N/A'}</span></div>
                                    <div><strong>Router Instalado:</strong> <span style={{ color: 'var(--sidebar-text)', marginLeft: '4px' }}>{v.modelo_router || 'N/A'}</span></div>
                                  </div>
                                )}

                                {isFOSolicitado && (
                                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '10px 14px', borderRadius: '8px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ fontSize: '0.82rem', color: '#c2410c', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '0.95rem' }}></i> Requiere Cambio de Acometida / FO
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => abrirModalCambioFO(v)}
                                      style={{ 
                                        backgroundColor: '#ea580c', 
                                        color: 'white', 
                                        padding: '6px 14px', 
                                        fontSize: '0.78rem', 
                                        fontWeight: 'bold', 
                                        borderRadius: '6px', 
                                        cursor: 'pointer', 
                                        border: 'none', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)' 
                                      }}
                                    >
                                      🧡 Programar Cambio de FO
                                    </button>
                                  </div>
                                )}

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

                                {/* Evidencias de Cierre (Fotos de Equipos y Firma) */}
                                {(v.estado === 'FINALIZADA' || v.estado === 'SOLVENTADA_REMOTA') && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '12px' }}>
                                    
                                    {/* Fotos de Equipos */}
                                    <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                                        <i className="fa-solid fa-camera" style={{ color: 'var(--primary)' }}></i> Evidencia:
                                      </strong>
                                      {v.foto_equipos ? (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
                                          <div style={{ textAlign: 'center', flex: '1', minWidth: '80px' }}>
                                            <img 
                                              src={`/static/uploads/${v.foto_equipos}`} 
                                              alt="Equipo 1"
                                              onClick={() => window.open(`/static/uploads/${v.foto_equipos}`)}
                                              style={{ maxHeight: '90px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'cover', transition: 'transform 0.2s' }}
                                              onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                                              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                            />
                                            <div style={{ fontSize: '0.68rem', color: 'var(--sidebar-text)', marginTop: '4px' }}>
                                              {v.equipos_juntos ? 'ONU / Router' : 'ONU'}
                                            </div>
                                          </div>
                                          {!v.equipos_juntos && v.foto_equipos_2 && (
                                            <div style={{ textAlign: 'center', flex: '1', minWidth: '80px' }}>
                                              <img 
                                                src={`/static/uploads/${v.foto_equipos_2}`} 
                                                alt="Router"
                                                onClick={() => window.open(`/static/uploads/${v.foto_equipos_2}`)}
                                                style={{ maxHeight: '90px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'cover', transition: 'transform 0.2s' }}
                                                onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                                                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                              />
                                              <div style={{ fontSize: '0.68rem', color: 'var(--sidebar-text)', marginTop: '4px' }}>Router</div>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>Sin foto</span>
                                      )}
                                    </div>

                                    {/* Firma Cliente */}
                                    <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                                        <i className="fa-solid fa-signature" style={{ color: 'var(--primary)' }}></i> Firma:
                                      </strong>
                                      {v.firma_cliente ? (
                                        v.firma_cliente.startsWith('SIN_FIRMA') ? (
                                          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '8px 10px', borderRadius: '8px', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
                                            <i className="fa-solid fa-circle-info" style={{ marginRight: '5px' }}></i> Sin Firma:<br />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--sidebar-text)' }}>
                                              {v.firma_cliente.replace('SIN_FIRMA:', '').trim()}
                                            </span>
                                          </div>
                                        ) : (
                                          <div style={{ textAlign: 'center', width: '100%' }}>
                                            <img 
                                              src={`/static/uploads/${v.firma_cliente}`} 
                                              alt="Firma"
                                              onClick={() => window.open(`/static/uploads/${v.firma_cliente}`)}
                                              style={{ maxHeight: '75px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', padding: '4px', cursor: 'pointer' }}
                                            />
                                            <div style={{ fontSize: '0.68rem', color: 'var(--sidebar-text)', marginTop: '4px' }}>Cliente Conforme</div>
                                          </div>
                                        )
                                      ) : (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>Sin firma</span>
                                      )}
                                    </div>

                                  </div>
                                )}

                                {/* Botones de Acción (Editar, Reagendar, Reasignar, Cancelar) */}
                                {(v.estado === 'PENDIENTE' || v.estado === 'REAGENDADA' || v.estado === 'EN_RUTA') && (
                                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    
                                    {/* Botones de Selección */}
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                      {(v.estado === 'PENDIENTE' || v.estado === 'EN_RUTA') && (
                                        <button 
                                          type="button" 
                                          onClick={() => abrirModalEditar(v)}
                                          style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                          <i className="fa-solid fa-pen-to-square"></i> Editar Visita
                                        </button>
                                      )}

                                      {(v.estado === 'PENDIENTE' || v.estado === 'REAGENDADA') && (
                                        <>
                                          <button 
                                            type="button" 
                                            onClick={() => setActiveActionForm(prev => ({ ...prev, [v.id_visita]: activeActionForm[v.id_visita] === 'cancelar' ? null : 'cancelar' }))}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                            Terminar / Cancelar
                                          </button>
                                          
                                          <button 
                                            type="button" 
                                            onClick={() => setActiveActionForm(prev => ({ ...prev, [v.id_visita]: activeActionForm[v.id_visita] === 'reagendar' ? null : 'reagendar' }))}
                                            style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                            {activeArea === 'INSTALACIONES' ? 'Reagendar Instalación' : 'Reagendar Visita'}
                                          </button>

                                          <button 
                                            type="button" 
                                            onClick={() => setActiveActionForm(prev => ({ ...prev, [v.id_visita]: activeActionForm[v.id_visita] === 'reasignar' ? null : 'reasignar' }))}
                                            style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                            Cambiar Técnicos
                                          </button>
                                        </>
                                      )}
                                    </div>

                                    {/* Formulario Reagendar */}
                                    {activeActionForm[v.id_visita] === 'reagendar' && (
                                      <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid #fcd34d', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#d97706', marginBottom: '10px', fontSize: '0.88rem' }}>
                                          {activeArea === 'INSTALACIONES' ? 'Reagendar Instalación' : 'Reagendar Visita'}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
                                          <div>
                                            <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Nueva Fecha:</label>
                                            <input 
                                              type="date" 
                                              style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                              value={formReagendar[v.id_visita]?.fecha || ''}
                                              onChange={e => setFormReagendar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], fecha: e.target.value } }))}
                                            />
                                          </div>
                                          {activeArea !== 'INSTALACIONES' && (
                                            <div>
                                              <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Prioridad:</label>
                                              <select 
                                                style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                                value={formReagendar[v.id_visita]?.prioridad || 'MEDIA'}
                                                onChange={e => setFormReagendar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], prioridad: e.target.value } }))}
                                              >
                                                <option value="ALTA">ALTA</option>
                                                <option value="MEDIA">MEDIA</option>
                                                <option value="BAJA">BAJA</option>
                                              </select>
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ marginBottom: '10px' }}>
                                          <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Motivo del cambio:</label>
                                          <textarea 
                                            rows="2"
                                            placeholder="Ej: Cliente no estaba en casa / Pidió reagendar"
                                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                            value={formReagendar[v.id_visita]?.observacion || ''}
                                            onChange={e => setFormReagendar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], observacion: e.target.value } }))}
                                          />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                          <button 
                                            type="button" 
                                            onClick={() => handleReagendar(v.id_visita)}
                                            style={{ background: '#d97706', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                            Confirmar Reagendamiento
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Formulario Reasignar (Cambiar Técnicos) */}
                                    {activeActionForm[v.id_visita] === 'reasignar' && (
                                      <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid #c7d2fe', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#4f46e5', marginBottom: '10px', fontSize: '0.88rem' }}>Cambiar Técnicos Asignados</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '12px' }}>
                                          <div>
                                            <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Técnico Principal:</label>
                                            <select 
                                              style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                              value={formReasignar[v.id_visita]?.tecnico || v.tecnico_principal || ''}
                                              onChange={e => setFormReasignar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], tecnico: e.target.value } }))}
                                            >
                                              <option value="">-- Selecciona Técnico --</option>
                                              <option value="NO TECNICO">NO TECNICO (Sin Asignar)</option>
                                              {tecnicos.filter(t => t.nombre !== 'NO TECNICO').map(t => (
                                                <option key={t.id_tecnico} value={t.nombre}>{t.nombre}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Apoyo (Cuadrilla):</label>
                                            <select 
                                              style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                              value={formReasignar[v.id_visita]?.apoyo || v.tecnico_apoyo || ''}
                                              onChange={e => setFormReasignar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], apoyo: e.target.value } }))}
                                            >
                                              <option value="">-- Sin Apoyo --</option>
                                              <option value="NO TECNICO">NO TECNICO</option>
                                              {tecnicos.filter(t => t.nombre !== 'NO TECNICO').map(t => (
                                                <option key={t.id_tecnico} value={t.nombre}>{t.nombre}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                          <button 
                                            type="button" 
                                            onClick={() => handleReasignar(v.id_visita)}
                                            style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                            Actualizar Técnicos
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Formulario Terminar / Cancelar */}
                                    {activeActionForm[v.id_visita] === 'cancelar' && (
                                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #fca5a5', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#b91c1c', marginBottom: '10px', fontSize: '0.88rem' }}>Terminar / Cancelar Visita</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '12px' }}>
                                          <div>
                                            <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Motivo / Resolución:</label>
                                            <input 
                                              type="text" 
                                              placeholder="Ej: Se solventó remotamente / Cliente cancela"
                                              style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                              value={formCancelar[v.id_visita]?.motivo || ''}
                                              onChange={e => setFormCancelar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], motivo: e.target.value } }))}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: 'var(--text-main)' }}>Estado del Cierre:</label>
                                            <select 
                                              style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                              value={formCancelar[v.id_visita]?.estado || 'CANCELADA'}
                                              onChange={e => setFormCancelar(prev => ({ ...prev, [v.id_visita]: { ...prev[v.id_visita], estado: e.target.value } }))}
                                            >
                                              <option value="CANCELADA">Cliente cancela visita</option>
                                              <option value="SOLVENTADA_REMOTA">Solventado desde Call Center</option>
                                              <option value="SOLVENTADA_OTRO_DEP">Solventado por otro departamento</option>
                                            </select>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                          <button 
                                            type="button" 
                                            onClick={() => handleCancelar(v.id_visita)}
                                            style={{ background: '#b91c1c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                            Confirmar Cierre de Visita
                                          </button>
                                        </div>
                                      </div>
                                    )}

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

      {/* Modal Programar Cambio de FO */}
      {modalFO.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '20px', width: '90%', maxWidth: '550px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#ea580c', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧡 Programar Visita de Cambio de FO
              </h3>
              <button 
                type="button" 
                onClick={() => setModalFO(prev => ({ ...prev, isOpen: false }))} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--sidebar-text)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleGuardarCambioFO} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* Client Details Box */}
              <div style={{ background: 'rgba(234, 88, 12, 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(234, 88, 12, 0.1)', fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 6px 0', color: 'var(--text-main)' }}><strong>👤 Cliente:</strong> <span style={{ color: '#ea580c', fontWeight: 700 }}>{modalFO.cliente}</span></p>
                <p style={{ margin: '0 0 6px 0', color: 'var(--sidebar-text)' }}><strong>📄 Contrato:</strong> #{modalFO.contrato} ({modalFO.empresa})</p>
                <p style={{ margin: 0, color: 'var(--sidebar-text)' }}><strong>📍 Sector / Dir:</strong> {modalFO.sector} - {modalFO.direccion}</p>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>📅 Fecha Programada:</label>
                  <input 
                    type="date" 
                    required 
                    value={modalFO.fechaProgramada} 
                    onChange={e => setModalFO(prev => ({ ...prev, fechaProgramada: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>⏰ Horario / Turno:</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Mañana (9am - 12pm)" 
                    value={modalFO.preferenciaHoraria} 
                    onChange={e => setModalFO(prev => ({ ...prev, preferenciaHoraria: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>👨‍🔧 Técnico Asignado (Opcional):</label>
                <select 
                  value={modalFO.tecnicoPrincipal} 
                  onChange={e => setModalFO(prev => ({ ...prev, tecnicoPrincipal: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                >
                  <option value="NO TECNICO">-- Sin Asignar / Por Coordinar --</option>
                  {tecnicos.map(t => (
                    <option key={t.id_tecnico} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>🗣️ Observación Callcenter:</label>
                <textarea 
                  rows="3" 
                  value={modalFO.observacionCallcenter} 
                  onChange={e => setModalFO(prev => ({ ...prev, observacionCallcenter: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }}
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalFO(prev => ({ ...prev, isOpen: false }))} 
                  style={{ padding: '10px 18px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', color: 'var(--sidebar-text)', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 18px', border: 'none', borderRadius: '8px', background: '#ea580c', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-calendar-plus"></i> Agendar Cambio de FO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Visita */}
      {modalEditar.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '20px', width: '90%', maxWidth: '650px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-pen-to-square"></i> Editar Datos de Visita #VT-{modalEditar.idVisita}
              </h3>
              <button 
                type="button" 
                onClick={() => setModalEditar(prev => ({ ...prev, isOpen: false }))} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--sidebar-text)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleGuardarEditar} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Nombre Cliente:</label>
                  <input 
                    type="text" 
                    required 
                    value={modalEditar.cliente} 
                    onChange={e => setModalEditar(prev => ({ ...prev, cliente: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Contrato:</label>
                  <input 
                    type="text" 
                    required 
                    value={modalEditar.contrato} 
                    onChange={e => setModalEditar(prev => ({ ...prev, contrato: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Teléfonos:</label>
                  <input 
                    type="text" 
                    value={modalEditar.telefonos} 
                    onChange={e => setModalEditar(prev => ({ ...prev, telefonos: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Sector / Barrio:</label>
                  <input 
                    type="text" 
                    value={modalEditar.sector} 
                    onChange={e => setModalEditar(prev => ({ ...prev, sector: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Dirección Completa:</label>
                  <input 
                    type="text" 
                    value={modalEditar.direccion} 
                    onChange={e => setModalEditar(prev => ({ ...prev, direccion: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Latitud:</label>
                  <input 
                    type="text" 
                    value={modalEditar.latitud} 
                    onChange={e => setModalEditar(prev => ({ ...prev, latitud: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Longitud:</label>
                  <input 
                    type="text" 
                    value={modalEditar.longitud} 
                    onChange={e => setModalEditar(prev => ({ ...prev, longitud: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Fecha Programada:</label>
                  <input 
                    type="date" 
                    required 
                    value={modalEditar.fechaProgramada} 
                    onChange={e => setModalEditar(prev => ({ ...prev, fechaProgramada: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Turno / Horario:</label>
                  <input 
                    type="text" 
                    value={modalEditar.preferenciaHoraria} 
                    onChange={e => setModalEditar(prev => ({ ...prev, preferenciaHoraria: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Técnico Principal:</label>
                  <select 
                    value={modalEditar.tecnicoPrincipal} 
                    onChange={e => setModalEditar(prev => ({ ...prev, tecnicoPrincipal: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Sin Asignar --</option>
                    <option value="NO TECNICO">NO TECNICO (Sin Asignar / Por Coordinar)</option>
                    {tecnicos.filter(t => t.nombre !== 'NO TECNICO').map(t => (
                      <option key={t.id_tecnico} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Técnico Apoyo (Cuadrilla):</label>
                  <select 
                    value={modalEditar.tecnicoApoyo} 
                    onChange={e => setModalEditar(prev => ({ ...prev, tecnicoApoyo: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Sin Apoyo --</option>
                    <option value="NO TECNICO">NO TECNICO</option>
                    {tecnicos.filter(t => t.nombre !== 'NO TECNICO').map(t => (
                      <option key={t.id_tecnico} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                {activeArea === 'INSTALACIONES' ? (
                  <>
                    <div>
                      <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Servicio:</label>
                      <input 
                        type="text" 
                        value={modalEditar.servicio} 
                        onChange={e => setModalEditar(prev => ({ ...prev, servicio: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Velocidad (Mbps):</label>
                      <input 
                        type="number" 
                        value={modalEditar.velocidadMbps} 
                        onChange={e => setModalEditar(prev => ({ ...prev, velocidadMbps: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Problema Reportado:</label>
                    <input 
                      type="text" 
                      value={modalEditar.problema} 
                      onChange={e => setModalEditar(prev => ({ ...prev, problema: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>Observación Callcenter:</label>
                  <textarea 
                    rows="2" 
                    value={modalEditar.observacionCallcenter} 
                    onChange={e => setModalEditar(prev => ({ ...prev, observacionCallcenter: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  ></textarea>
                </div>
              </div>

              {/* Conexión (Poste/Nodo) Grid */}
              <div style={{ background: 'var(--profile-bg)', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '15px', marginTop: '5px' }}>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.82rem', display: 'block', marginBottom: '10px' }}>🔌 Datos de Conexión (Poste / Nodo):</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Caja/NAP:</label>
                    <input 
                      type="text" 
                      value={modalEditar.infoCaja} 
                      onChange={e => setModalEditar(prev => ({ ...prev, infoCaja: e.target.value }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Hilo/Puerto:</label>
                    <input 
                      type="text" 
                      value={modalEditar.infoHilo} 
                      onChange={e => setModalEditar(prev => ({ ...prev, infoHilo: e.target.value }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>IP Fija:</label>
                    <input 
                      type="text" 
                      value={modalEditar.infoIp} 
                      onChange={e => setModalEditar(prev => ({ ...prev, infoIp: e.target.value }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>VLAN:</label>
                    <input 
                      type="text" 
                      value={modalEditar.infoVlan} 
                      onChange={e => setModalEditar(prev => ({ ...prev, infoVlan: e.target.value }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>PPPoE Usr:</label>
                    <input 
                      type="text" 
                      value={modalEditar.infoUsr} 
                      onChange={e => setModalEditar(prev => ({ ...prev, infoUsr: e.target.value }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>PPPoE Pas:</label>
                    <input 
                      type="text" 
                      value={modalEditar.infoPas} 
                      onChange={e => setModalEditar(prev => ({ ...prev, infoPas: e.target.value }))}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalEditar(prev => ({ ...prev, isOpen: false }))} 
                  style={{ padding: '10px 18px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', color: 'var(--sidebar-text)', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 18px', border: 'none', borderRadius: '8px', background: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-save"></i> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisitasTab;
