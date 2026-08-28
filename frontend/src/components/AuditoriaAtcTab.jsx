import React, { useState, useEffect } from 'react';

export default function AuditoriaAtcTab({ token, user }) {
  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [fecha, setFecha] = useState(getTodayLocal());
  const [filtroAuditor, setFiltroAuditor] = useState('MIS_ASIGNADAS');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [auditorias, setAuditorias] = useState([]);
  const [metricas, setMetricas] = useState({
    contactabilidad: { total_asignadas: 0, contestaron: 0, no_contestaron: 0, equivocados: 0, fuera_servicio: 0, pendientes: 0, pct_contestaron: 0 },
    promedios_preguntas: { p1_claridad: 0, p2_amabilidad: 0, p3_rapidez: 0, p4_efectividad: 0, p5_satisfaccion: 0, p6_facilidad: 0, promedio_global: 0, total_calificadas: 0 },
    ranking_asesores: [],
    ranking_auditores: []
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Modal Auditoría / Calificación
  const [showModal, setShowModal] = useState(false);
  const [ticketActivo, setTicketActivo] = useState(null);
  const [formData, setFormData] = useState({
    estado_contacto: 'CONTESTO',
    p1_claridad: null,
    p2_amabilidad: null,
    p3_rapidez: null,
    p4_efectividad: null,
    p5_satisfaccion: null,
    p6_facilidad: null,
    respuesta_facilidad: '',
    recomendacion_cliente: '',
    observaciones: ''
  });
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const authHeader = { 'Authorization': `Bearer ${token}` };
      
      // 1. Cargar Lista
      const resLista = await fetch(`/api/atc/auditoria/lista?fecha=${fecha}&filtro_auditor=${filtroAuditor}&estado=${filtroEstado}&search=${encodeURIComponent(busqueda)}`, { headers: authHeader });
      const dataLista = await resLista.json();
      if (dataLista?.status === 'ok') {
        setAuditorias(dataLista.auditorias || []);
      }

      // 2. Cargar Métricas
      const resMetr = await fetch(`/api/atc/auditoria/metricas?fecha_inicio=${fecha}&fecha_fin=${fecha}`, { headers: authHeader });
      const dataMetr = await resMetr.json();
      if (dataMetr?.status === 'ok') {
        setMetricas(dataMetr);
      }
    } catch (e) {
      console.error('Error cargando auditoría ATC:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fecha, filtroAuditor, filtroEstado, busqueda]);

  const handleSincronizarDia = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/atc/auditoria/sincronizar_dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ fecha })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message || 'Atenciones sincronizadas.');
        cargarDatos();
      } else {
        alert(data?.message || 'Error al sincronizar.');
      }
    } catch (e) {
      alert('Error de conexión al sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const abrirAuditoria = (item) => {
    setTicketActivo(item);
    setFormData({
      estado_contacto: item.estado_contacto === 'PENDIENTE' ? 'CONTESTO' : item.estado_contacto,
      p1_claridad: item.p1_claridad || null,
      p2_amabilidad: item.p2_amabilidad || null,
      p3_rapidez: item.p3_rapidez || null,
      p4_efectividad: item.p4_efectividad || null,
      p5_satisfaccion: item.p5_satisfaccion || null,
      p6_facilidad: item.p6_facilidad || null,
      respuesta_facilidad: item.respuesta_facilidad || '',
      recomendacion_cliente: item.recomendacion_cliente || '',
      observaciones: item.observaciones || ''
    });
    setShowModal(true);
  };

  const calcularPromedioEnVivo = () => {
    const notas = [formData.p1_claridad, formData.p2_amabilidad, formData.p3_rapidez, formData.p4_efectividad, formData.p5_satisfaccion, formData.p6_facilidad]
      .filter(n => n !== null && n !== undefined);
    if (notas.length === 0) return 0;
    return (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2);
  };

  const handleGuardarAuditoria = async (e) => {
    e.preventDefault();
    if (!ticketActivo) return;
    setGuardando(true);
    try {
      const payload = {
        id_auditoria: ticketActivo.id_auditoria,
        estado_contacto: formData.estado_contacto,
        p1_claridad: formData.estado_contacto === 'CONTESTO' ? formData.p1_claridad : null,
        p2_amabilidad: formData.estado_contacto === 'CONTESTO' ? formData.p2_amabilidad : null,
        p3_rapidez: formData.estado_contacto === 'CONTESTO' ? formData.p3_rapidez : null,
        p4_efectividad: formData.estado_contacto === 'CONTESTO' ? formData.p4_efectividad : null,
        p5_satisfaccion: formData.estado_contacto === 'CONTESTO' ? formData.p5_satisfaccion : null,
        p6_facilidad: formData.estado_contacto === 'CONTESTO' ? formData.p6_facilidad : null,
        respuesta_facilidad: formData.respuesta_facilidad,
        recomendacion_cliente: formData.recomendacion_cliente,
        observaciones: formData.observaciones
      };

      const res = await fetch('/api/atc/auditoria/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setShowModal(false);
        setTicketActivo(null);
        cargarDatos();
      } else {
        alert(data?.message || 'Error al guardar');
      }
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const [copiadoKey, setCopiadoKey] = useState('');

  const copiarAlPortapapeles = (texto, key) => {
    if (!texto) return;
    const clean = String(texto).trim();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(clean).then(() => {
        setCopiadoKey(key);
        setTimeout(() => setCopiadoKey(''), 2000);
      }).catch(() => fallbackCopy(clean, key));
    } else {
      fallbackCopy(clean, key);
    }
  };

  const fallbackCopy = (texto, key) => {
    try {
      const el = document.createElement('textarea');
      el.value = texto;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiadoKey(key);
      setTimeout(() => setCopiadoKey(''), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const getBadgeColor = (nota) => {
    if (!nota || nota === 0) return '#6b7280';
    if (nota >= 9.0) return '#10b981'; // Verde
    if (nota >= 8.0) return '#3b82f6'; // Azul
    if (nota >= 7.0) return '#f59e0b'; // Amarillo
    return '#ef4444'; // Rojo
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'CONTESTO':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', whiteSpace: 'nowrap' }}>
            🟢 Contestó
          </span>
        );
      case 'NO_CONTESTA':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', whiteSpace: 'nowrap' }}>
            🔴 No Contesta
          </span>
        );
      case 'NUMERO_EQUIVOCADO':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b', whiteSpace: 'nowrap' }}>
            🟡 Equivocado
          </span>
        );
      case 'FUERA_SERVICIO':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: '1px solid #9ca3af', whiteSpace: 'nowrap' }}>
            ⚪ Fuera Serv.
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid #3b82f6', whiteSpace: 'nowrap' }}>
            ⏳ Pendiente
          </span>
        );
    }
  };

  const renderChipsNota = (campo, valorActual) => {
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const activo = valorActual === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => setFormData({ ...formData, [campo]: num })}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: activo ? '2px solid #2563eb' : '1px solid var(--border-color, #d1d5db)',
                background: activo ? '#2563eb' : 'var(--card-bg, #ffffff)',
                color: activo ? '#ffffff' : 'var(--text-main, #1f2937)',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {num}
            </button>
          );
        })}
      </div>
    );
  };

  const contact = metricas.contactabilidad || {};
  const proms = metricas.promedios_preguntas || {};
  const asesores = metricas.ranking_asesores || [];

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', background: 'var(--bg-main, #f8fafc)', color: 'var(--text-main, #1e293b)' }}>
      {/* Header Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📞</span> Control de Calidad y Auditoría ATC
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
            Evaluación diaria de atenciones telefónicas y satisfacción de clientes de Call Center.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg, #ffffff)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>📅 Fecha:</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'inherit', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={handleSincronizarDia}
            disabled={syncing}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <span>🔄</span> {syncing ? 'Sincronizando...' : 'Sincronizar Día'}
          </button>
        </div>
      </div>

      {/* DASHBOARD DE MÉTRICAS Y GRÁFICOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Tarjeta 1: Contactabilidad */}
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main, #1e293b)' }}>📊 Contactabilidad del Día</span>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>{contact.pct_contestaron || 0}%</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Medidor visual */}
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: `conic-gradient(#10b981 ${contact.pct_contestaron || 0}%, #e2e8f0 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--card-bg, #ffffff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                {contact.contestaron || 0}/{contact.total_asignadas || 0}
              </div>
            </div>

            {/* Desglose */}
            <div style={{ flex: 1, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🟢 Contestaron (Encuesta):</span>
                <span style={{ fontWeight: 'bold' }}>{contact.contestaron || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🔴 No Contestaron:</span>
                <span style={{ fontWeight: 'bold' }}>{contact.no_contestaron || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🟡 Equivocado / Fuera de Serv.:</span>
                <span style={{ fontWeight: 'bold' }}>{(contact.equivocados || 0) + (contact.fuera_servicio || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>⏳ Pendientes de Llamar:</span>
                <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{contact.pendientes || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Promedio General y Preguntas */}
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main, #1e293b)' }}>⭐ Promedios por Pregunta</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>Global:</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: getBadgeColor(proms.promedio_global) }}>
                {proms.promedio_global ? proms.promedio_global.toFixed(2) : '0.00'}/10
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '11.5px' }}>
            {[
              { label: 'P1 Claridad de Explicación', val: proms.p1_claridad },
              { label: 'P2 Amabilidad y Respeto', val: proms.p2_amabilidad },
              { label: 'P3 Tiempo de Respuesta', val: proms.p3_rapidez },
              { label: 'P4 Efectividad de Solución', val: proms.p4_efectividad },
              { label: 'P5 Satisfacción General', val: proms.p5_satisfaccion },
              { label: 'P6 Facilidad de Contacto', val: proms.p6_facilidad },
            ].map((p, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>{p.label}:</span>
                  <span style={{ fontWeight: 'bold', color: getBadgeColor(p.val) }}>{p.val ? p.val.toFixed(2) : '0.00'}</span>
                </div>
                <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
                  <div style={{ width: `${(p.val || 0) * 10}%`, height: '100%', background: getBadgeColor(p.val), borderRadius: '3px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta 3: Calificación por Asesor Evaluado */}
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main, #1e293b)' }}>🏆 Promedio por Asesor Evaluado</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>{asesores.length} asesores</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '175px', overflowY: 'auto' }}>
            {asesores.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '12px', padding: '20px 0' }}>
                Sin encuestas completadas hoy para calcular promedios.
              </div>
            ) : (
              asesores.map((as, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '8px', background: 'var(--hover-bg, #f1f5f9)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{as.agente}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>{as.total_evaluadas} llamadas evaluadas</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: getBadgeColor(as.promedio_total) }}>
                      {as.promedio_total ? as.promedio_total.toFixed(2) : '0.00'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>/10</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', padding: '14px 18px', border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Tabs de Asignación */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--hover-bg, #f1f5f9)', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setFiltroAuditor('MIS_ASIGNADAS')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              background: filtroAuditor === 'MIS_ASIGNADAS' ? '#2563eb' : 'transparent',
              color: filtroAuditor === 'MIS_ASIGNADAS' ? '#ffffff' : 'inherit'
            }}
          >
            👤 Mis Asignadas ({auditorias.filter(a => a.auditor_asignado === (user?.nombre || '')).length || 0})
          </button>

          <button
            onClick={() => setFiltroAuditor('TODAS')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              background: filtroAuditor === 'TODAS' ? '#2563eb' : 'transparent',
              color: filtroAuditor === 'TODAS' ? '#ffffff' : 'inherit'
            }}
          >
            📋 Todas las del Día
          </button>
        </div>

        {/* Filtros de Estado y Búsqueda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit', fontSize: '12px', fontWeight: 'bold' }}
          >
            <option value="">Todos los Estados</option>
            <option value="PENDIENTE">⏳ Pendientes</option>
            <option value="CONTESTO">🟢 Contestó</option>
            <option value="NO_CONTESTA">🔴 No Contesta</option>
            <option value="NUMERO_EQUIVOCADO">🟡 Número Equivocado</option>
            <option value="FUERA_SERVICIO">⚪ Fuera de Servicio</option>
          </select>

          <input
            type="text"
            placeholder="Buscar por cliente, contrato, asesor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit', fontSize: '12px', width: '240px' }}
          />
        </div>

      </div>

      {/* TABLA DE ATENCIONES PARA AUDITAR */}
      <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--hover-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}>
              <th style={{ padding: '12px 14px', minWidth: '180px' }}>Contrato / Cliente</th>
              <th style={{ padding: '12px 14px', minWidth: '170px' }}>Teléfonos</th>
              <th style={{ padding: '12px 14px', minWidth: '140px' }}>Asesor Atendió</th>
              <th style={{ padding: '12px 14px', minWidth: '140px' }}>Motivo</th>
              <th style={{ padding: '12px 14px', minWidth: '130px' }}>Auditor Asignado</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', minWidth: '120px', whiteSpace: 'nowrap' }}>Estado</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', minWidth: '90px', whiteSpace: 'nowrap' }}>Nota Global</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', minWidth: '100px', whiteSpace: 'nowrap' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted, #94a3b8)' }}>
                  Cargando atenciones...
                </td>
              </tr>
            ) : auditorias.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)' }}>
                  No se encontraron atenciones para auditar con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              auditorias.map((item) => {
                const tel1Limpio = item.telefono1 ? item.telefono1.replace(/\D/g, '') : '';
                const key1 = `t1_${item.id_auditoria}`;
                const key2 = `t2_${item.id_auditoria}`;
                const copiado1 = copiadoKey === key1;
                const copiado2 = copiadoKey === key2;

                return (
                  <tr key={item.id_auditoria} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 'bold', color: '#2563eb' }}>Contrato #{item.contrato || 'S/C'}</div>
                      <div style={{ fontWeight: '600', color: 'var(--text-main, #1e293b)' }}>{item.cliente}</div>
                      {item.sector && <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>📍 {item.sector}</div>}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {item.telefono1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '12.5px', color: 'var(--text-main, #1e293b)', userSelect: 'all' }}>
                              📞 {item.telefono1}
                            </span>
                            <button
                              type="button"
                              onClick={() => copiarAlPortapapeles(item.telefono1, key1)}
                              title="Copiar número"
                              style={{
                                background: copiado1 ? '#10b981' : 'var(--hover-bg, #f1f5f9)',
                                color: copiado1 ? '#ffffff' : 'inherit',
                                border: '1px solid var(--border-color, #cbd5e1)',
                                borderRadius: '6px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: copiado1 ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {copiado1 ? '✅ Copiado' : '📋'}
                            </button>
                            {tel1Limpio && (
                              <a
                                href={`https://web.whatsapp.com/send?phone=593${tel1Limpio.startsWith('0') ? tel1Limpio.substring(1) : tel1Limpio}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ background: '#10b981', color: '#ffffff', borderRadius: '6px', padding: '2px 7px', fontSize: '10.5px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                title="Abrir WhatsApp Web"
                              >
                                <span>💬</span> WA
                              </a>
                            )}
                          </div>
                        )}
                        {item.telefono2 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', userSelect: 'all' }}>
                              📞 {item.telefono2}
                            </span>
                            <button
                              type="button"
                              onClick={() => copiarAlPortapapeles(item.telefono2, key2)}
                              title="Copiar número secundario"
                              style={{
                                background: copiado2 ? '#10b981' : 'transparent',
                                color: copiado2 ? '#ffffff' : 'inherit',
                                border: '1px solid var(--border-color, #cbd5e1)',
                                borderRadius: '6px',
                                padding: '1px 5px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              {copiado2 ? '✅' : '📋'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', fontWeight: '500' }}>
                      👤 {item.agente_evaluado || 'Call Center'}
                    </td>

                    <td style={{ padding: '12px 14px', color: 'var(--text-muted, #475569)' }}>
                      {item.motivo_atencion || 'Soporte Técnico'}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#0284c7' }}>
                        {item.auditor_asignado || 'Sin Asignar'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {getEstadoBadge(item.estado_contacto)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {item.promedio_total ? (
                        <span style={{ fontSize: '13px', fontWeight: '900', color: getBadgeColor(item.promedio_total) }}>
                          {item.promedio_total.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted, #94a3b8)' }}>-</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => abrirAuditoria(item)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: item.estado_contacto === 'PENDIENTE' ? '#2563eb' : '#475569',
                          color: '#ffffff',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.estado_contacto === 'PENDIENTE' ? '📞 Auditar' : '✏️ Editar'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE ENCUESTA Y CALIFICACIÓN */}
      {showModal && ticketActivo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' }}>
          <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', maxWidth: '680px', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: '1px solid var(--border-color, #e2e8f0)' }}>
            
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                  📞 Encuesta de Control de Calidad
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                  Cliente: <strong style={{ color: 'var(--text-main, #1e293b)' }}>{ticketActivo.cliente}</strong> | Contrato: <strong>#{ticketActivo.contrato}</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  Asesor Evaluado: <strong style={{ color: '#2563eb' }}>{ticketActivo.agente_evaluado}</strong> | Tel: <strong>{ticketActivo.telefono1}</strong>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarAuditoria}>
              {/* Selector de Estado de Llamada */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                  RESULTADO DE LA LLAMADA:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'CONTESTO', label: '🟢 Contestó', desc: 'Realizó Encuesta' },
                    { id: 'NO_CONTESTA', label: '🔴 No Contesta', desc: 'Sin Respuesta' },
                    { id: 'NUMERO_EQUIVOCADO', label: '🟡 Equivocado', desc: 'No Corresponde' },
                    { id: 'FUERA_SERVICIO', label: '⚪ Fuera Serv.', desc: 'Apagado' }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, estado_contacto: st.id })}
                      style={{
                        padding: '8px',
                        borderRadius: '10px',
                        border: formData.estado_contacto === st.id ? '2px solid #2563eb' : '1px solid var(--border-color, #cbd5e1)',
                        background: formData.estado_contacto === st.id ? 'rgba(37, 99, 235, 0.1)' : 'var(--card-bg, #ffffff)',
                        color: formData.estado_contacto === st.id ? '#2563eb' : 'inherit',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div>{st.label}</div>
                      <div style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text-muted, #64748b)' }}>{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Si contestó, desplegar las 6 preguntas */}
              {formData.estado_contacto === 'CONTESTO' && (
                <div style={{ background: 'var(--hover-bg, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '18px' }}>
                  
                  {/* Banner de Promedio en Vivo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg, #ffffff)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>⭐ Promedio Total Calculado:</span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: getBadgeColor(parseFloat(calcularPromedioEnVivo())) }}>
                      {calcularPromedioEnVivo()} / 10
                    </span>
                  </div>

                  {/* P1 */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      1. ¿Qué tan claro fue el asesor al explicarle la información o solución? (1 al 10)
                    </label>
                    {renderChipsNota('p1_claridad', formData.p1_claridad)}
                  </div>

                  {/* P2 */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      2. ¿Qué tan amable y respetuoso fue el asesor que lo atendió? (1 al 10)
                    </label>
                    {renderChipsNota('p2_amabilidad', formData.p2_amabilidad)}
                  </div>

                  {/* P3 */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      3. ¿Qué tan rápido fue el tiempo de respuesta desde que se comunicó? (1 al 10)
                    </label>
                    {renderChipsNota('p3_rapidez', formData.p3_rapidez)}
                  </div>

                  {/* P4 */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      4. ¿Qué tan útil o efectiva fue la solución brindada a su requerimiento? (1 al 10)
                    </label>
                    {renderChipsNota('p4_efectividad', formData.p4_efectividad)}
                  </div>

                  {/* P5 */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      5. En general, ¿qué tan satisfecho está con la atención recibida? (1 al 10)
                    </label>
                    {renderChipsNota('p5_satisfaccion', formData.p5_satisfaccion)}
                  </div>

                  {/* P6 */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      6. ¿Qué tan fácil fue comunicarse con nuestro call center? (1 al 10)
                    </label>
                    {renderChipsNota('p6_facilidad', formData.p6_facilidad)}
                  </div>

                  {/* Comentario P6 */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                      RESPUESTA SOBRE FACILIDAD DE COMUNICACIÓN (¿Por qué?):
                    </label>
                    <input
                      type="text"
                      placeholder="Motivo de facilidad o dificultad de comunicación..."
                      value={formData.respuesta_facilidad}
                      onChange={(e) => setFormData({ ...formData, respuesta_facilidad: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit', fontSize: '12px' }}
                    />
                  </div>

                  {/* Recomendación del cliente */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                      RECOMENDACIÓN / SUGERENCIA DEL CLIENTE:
                    </label>
                    <input
                      type="text"
                      placeholder="Sugerencias del cliente para mejorar el servicio..."
                      value={formData.recomendacion_cliente}
                      onChange={(e) => setFormData({ ...formData, recomendacion_cliente: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit', fontSize: '12px' }}
                    />
                  </div>

                </div>
              )}

              {/* Observaciones generales */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  OBSERVACIONES DE LA AUDITORÍA:
                </label>
                <textarea
                  rows="2"
                  placeholder="Detalles adicionales o comentarios de la llamada..."
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--card-bg, #ffffff)', color: 'inherit', fontSize: '12px' }}
                />
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', color: 'inherit', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: guardando ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {guardando ? 'Guardando...' : '💾 Guardar Calificación'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
