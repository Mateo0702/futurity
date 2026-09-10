import React, { useState, useEffect } from 'react';

export default function AuditoriaVisitasTab({ token }) {
  const getTodayStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getTodayStr(d);
  };

  const [fechaInicio, setFechaInicio] = useState(getYesterdayStr());
  const [fechaFin, setFechaFin] = useState(getYesterdayStr());
  const [tecnico, setTecnico] = useState('TODOS');
  const [estadoContacto, setEstadoContacto] = useState('TODOS');
  const [solicitoNueva, setSolicitoNueva] = useState('TODOS');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tecnicosLista, setTecnicosLista] = useState([]);

  const [totales, setTotales] = useState({
    total_visitas: 0,
    total_auditadas: 0,
    total_pendientes: 0,
    total_no_contesta: 0,
    total_nueva_visita: 0,
    promedio_general: 0.0,
    porcentaje_auditadas: 0.0
  });

  const [visitas, setVisitas] = useState([]);

  // Modal de Auditoría
  const [modalVisita, setModalVisita] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states del modal
  const [formData, setFormData] = useState({
    id_visita: null,
    estado_contacto: 'CONTESTO',
    intentos_llamada: 1,
    visita_efectiva: 'SI',
    solicito_nueva_visita: 'NO',
    volver_a_llamar: 'NO',
    p1_servicio: 10,
    p2_velocidad: 10,
    p3_cobertura: 10,
    p4_explicacion_router: 10,
    p6_profesionalismo: 10,
    p6_motivo_profesionalismo: '',
    p7_cordialidad: 10,
    p8_orden_limpieza: 10,
    app_administrar_router: 'SI',
    app_cambio_wifi: 'SI',
    app_red_invitados: 'SI',
    app_control_parental: 'SI',
    instalo_grilla_canales: 'SI',
    sugerencia_cliente: '',
    observaciones: ''
  });

  const getToken = () => token || localStorage.getItem('token') || localStorage.getItem('session_token') || '';

  const cargarDatos = async () => {
    setLoading(true);
    setError('');
    try {
      const authToken = getToken();
      const params = new URLSearchParams();
      params.append('fecha_inicio', fechaInicio);
      params.append('fecha_fin', fechaFin);
      if (tecnico !== 'TODOS') params.append('tecnico', tecnico);
      if (estadoContacto !== 'TODOS') params.append('estado_contacto', estadoContacto);
      if (solicitoNueva !== 'TODOS') params.append('solicito_nueva_visita', solicitoNueva);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/calidad_visitas/lista?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setVisitas(data.visitas || []);
        setTotales(data.totales || {});
        if (data.tecnicos && data.tecnicos.length > 0) {
          setTecnicosLista(data.tecnicos);
        }
      } else {
        setError(data?.message || 'Error al consultar auditorías de visitas.');
      }
    } catch (e) {
      console.error("Error cargando auditorias:", e);
      setError('Error de conexión al cargar datos de auditoría.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin, tecnico, estadoContacto, solicitoNueva]);

  const handleQuickDate = (tipo) => {
    if (tipo === 'ayer') {
      const a = getYesterdayStr();
      setFechaInicio(a);
      setFechaFin(a);
    } else if (tipo === 'hoy') {
      const h = getTodayStr();
      setFechaInicio(h);
      setFechaFin(h);
    } else if (tipo === '7dias') {
      const fin = getTodayStr();
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const ini = getTodayStr(d);
      setFechaInicio(ini);
      setFechaFin(fin);
    }
  };

  const handleExportarExcel = () => {
    const authToken = getToken();
    const params = new URLSearchParams();
    params.append('fecha_inicio', fechaInicio);
    params.append('fecha_fin', fechaFin);
    if (tecnico !== 'TODOS') params.append('tecnico', tecnico);
    if (estadoContacto !== 'TODOS') params.append('estado_contacto', estadoContacto);
    if (solicitoNueva !== 'TODOS') params.append('solicito_nueva_visita', solicitoNueva);
    if (search.trim()) params.append('search', search.trim());

    window.open(`/api/admin/calidad_visitas/exportar_excel?${params.toString()}`, '_blank');
  };

  // Abrir Modal para auditar
  const abrirAuditoriaModal = (v) => {
    setModalVisita(v);
    setSaveSuccess(false);
    setFormData({
      id_visita: v.id_visita,
      estado_contacto: v.estado_contacto === 'PENDIENTE' ? 'CONTESTO' : v.estado_contacto,
      intentos_llamada: v.intentos_llamada ? v.intentos_llamada + 1 : 1,
      visita_efectiva: v.visita_efectiva || 'SI',
      solicito_nueva_visita: v.solicito_nueva_visita || 'NO',
      volver_a_llamar: v.volver_a_llamar || 'NO',
      p1_servicio: v.p1_servicio !== null && v.p1_servicio !== undefined ? v.p1_servicio : 10,
      p2_velocidad: v.p2_velocidad !== null && v.p2_velocidad !== undefined ? v.p2_velocidad : 10,
      p3_cobertura: v.p3_cobertura !== null && v.p3_cobertura !== undefined ? v.p3_cobertura : 10,
      p4_explicacion_router: v.p4_explicacion_router !== null && v.p4_explicacion_router !== undefined ? v.p4_explicacion_router : 10,
      p6_profesionalismo: v.p6_profesionalismo !== null && v.p6_profesionalismo !== undefined ? v.p6_profesionalismo : 10,
      p6_motivo_profesionalismo: v.p6_motivo_profesionalismo || '',
      p7_cordialidad: v.p7_cordialidad !== null && v.p7_cordialidad !== undefined ? v.p7_cordialidad : 10,
      p8_orden_limpieza: v.p8_orden_limpieza !== null && v.p8_orden_limpieza !== undefined ? v.p8_orden_limpieza : 10,
      app_administrar_router: v.app_administrar_router && v.app_administrar_router !== 'NA' ? v.app_administrar_router : 'SI',
      app_cambio_wifi: v.app_cambio_wifi && v.app_cambio_wifi !== 'NA' ? v.app_cambio_wifi : 'SI',
      app_red_invitados: v.app_red_invitados && v.app_red_invitados !== 'NA' ? v.app_red_invitados : 'SI',
      app_control_parental: v.app_control_parental && v.app_control_parental !== 'NA' ? v.app_control_parental : 'SI',
      instalo_grilla_canales: v.instalo_grilla_canales && v.instalo_grilla_canales !== 'NA' ? v.instalo_grilla_canales : 'SI',
      sugerencia_cliente: v.sugerencia_cliente || '',
      observaciones: v.observaciones || ''
    });
  };

  // Calcular promedio en vivo
  const calcularPromedioEnVivo = () => {
    const notas = [
      formData.p1_servicio,
      formData.p2_velocidad,
      formData.p3_cobertura,
      formData.p4_explicacion_router,
      formData.p6_profesionalismo,
      formData.p7_cordialidad,
      formData.p8_orden_limpieza
    ].filter(n => n !== null && n !== undefined && !isNaN(n));

    if (notas.length === 0) return 0.0;
    const sum = notas.reduce((acc, curr) => acc + Number(curr), 0);
    return (sum / notas.length).toFixed(2);
  };

  const handleGuardarAuditoria = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const authToken = getToken();
      const res = await fetch('/api/admin/calidad_visitas/guardar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setSaveSuccess(true);
        setTimeout(() => {
          setModalVisita(null);
          cargarDatos();
        }, 600);
      } else {
        alert(data?.message || 'Error al guardar auditoría.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar auditoría.');
    } finally {
      setSaving(false);
    }
  };

  // Selector visual de botones del 1 al 10
  const renderScaleSelector = (field, label, sublabel) => {
    const valActual = formData[field];
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{label}</strong>
            {sublabel && <small style={{ display: 'block', color: 'var(--sidebar-text)', fontSize: '0.74rem' }}>{sublabel}</small>}
          </div>
          <span style={{
            fontSize: '1rem',
            fontWeight: 900,
            color: valActual >= 8 ? '#10b981' : valActual >= 6 ? '#f59e0b' : '#ef4444',
            padding: '2px 8px',
            borderRadius: '6px',
            background: valActual >= 8 ? 'rgba(16, 185, 129, 0.15)' : valActual >= 6 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'
          }}>
            {valActual} / 10
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const isSelected = valActual === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setFormData({ ...formData, [field]: num })}
                style={{
                  flex: '1 1 0',
                  minWidth: '28px',
                  height: '32px',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #38bdf8' : '1px solid var(--border-color)',
                  background: isSelected ? '#1f497d' : 'var(--profile-bg)',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Selector SI / NO
  const renderYesNo = (field, label) => {
    const val = formData[field];
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--profile-bg)',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>{label}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, [field]: 'SI' })}
            style={{
              padding: '4px 14px',
              borderRadius: '6px',
              border: val === 'SI' ? '1px solid #10b981' : '1px solid var(--border-color)',
              background: val === 'SI' ? 'rgba(16, 185, 129, 0.2)' : 'var(--card-bg)',
              color: val === 'SI' ? '#10b981' : 'var(--sidebar-text)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            SÍ
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, [field]: 'NO' })}
            style={{
              padding: '4px 14px',
              borderRadius: '6px',
              border: val === 'NO' ? '1px solid #ef4444' : '1px solid var(--border-color)',
              background: val === 'NO' ? 'rgba(239, 68, 68, 0.2)' : 'var(--card-bg)',
              color: val === 'NO' ? '#ef4444' : 'var(--sidebar-text)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            NO
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 24px',
        borderRadius: '20px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-headset"></i>
            </span>
            Auditoría de Calidad Post-Visita (24h)
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
            Módulo de evaluación y feedback para Calidad: verificación de servicio, router, pruebas y atención técnica.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={cargarDatos}
            style={{
              padding: '9px 16px',
              borderRadius: '12px',
              background: 'var(--profile-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i> Refrescar
          </button>

          <button
            type="button"
            onClick={handleExportarExcel}
            style={{
              padding: '9px 16px',
              borderRadius: '12px',
              background: '#059669',
              border: 'none',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
            }}
          >
            <i className="fa-solid fa-file-excel"></i> Exportar a Excel
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '18px 22px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Selector de Rango de Fechas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
            📅 Visitas Desde:
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.84rem'
            }}
          />
          <label style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
            Hasta:
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.84rem'
            }}
          />
          <button
            type="button"
            onClick={() => handleQuickDate('ayer')}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: fechaInicio === getYesterdayStr() && fechaFin === getYesterdayStr() ? '1px solid #38bdf8' : '1px solid var(--border-color)',
              background: fechaInicio === getYesterdayStr() && fechaFin === getYesterdayStr() ? 'rgba(56, 189, 248, 0.15)' : 'var(--profile-bg)',
              color: fechaInicio === getYesterdayStr() && fechaFin === getYesterdayStr() ? '#38bdf8' : 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('hoy')}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: fechaInicio === getTodayStr() && fechaFin === getTodayStr() ? '1px solid #38bdf8' : '1px solid var(--border-color)',
              background: fechaInicio === getTodayStr() && fechaFin === getTodayStr() ? 'rgba(56, 189, 248, 0.15)' : 'var(--profile-bg)',
              color: fechaInicio === getTodayStr() && fechaFin === getTodayStr() ? '#38bdf8' : 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('7dias')}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            Últimos 7 días
          </button>
        </div>

        {/* Filtros Dropdowns y Buscador */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          {/* Selector de Técnico */}
          <select
            value={tecnico}
            onChange={(e) => setTecnico(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.82rem',
              minWidth: '170px'
            }}
          >
            <option value="TODOS">🧑‍🔧 Todos los Técnicos</option>
            {tecnicosLista.map((t, idx) => (
              <option key={idx} value={t}>{t}</option>
            ))}
          </select>

          {/* Estado de Contacto */}
          <select
            value={estadoContacto}
            onChange={(e) => setEstadoContacto(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.82rem',
              minWidth: '160px'
            }}
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="PENDIENTE">🕒 Pendientes</option>
            <option value="CONTESTO">✅ Contestó / Auditada</option>
            <option value="NO_CONTESTA">📵 No Contesta</option>
            <option value="VOLVER_A_LLAMAR">🔄 Volver a Llamar</option>
            <option value="NUMERO_EQUIVOCADO">❌ Número Equivocado</option>
            <option value="FUERA_SERVICIO">🚫 Fuera de Servicio</option>
          </select>

          {/* Re-visita */}
          <select
            value={solicitoNueva}
            onChange={(e) => setSolicitoNueva(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.82rem',
              minWidth: '150px'
            }}
          >
            <option value="TODOS">Re-visita: Todas</option>
            <option value="SI">🚨 Requiere Nueva Visita</option>
            <option value="NO">🟢 Conforme (Sin Re-visita)</option>
          </select>

          {/* Buscador */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargarDatos()}
            placeholder="Buscar Cliente, Contrato, #VT..."
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.82rem',
              minWidth: '180px'
            }}
          />
        </div>
      </div>

      {/* TARJETAS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Visitas del Período</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: 'var(--text-main)' }}>
              {totales.total_visitas || 0}
            </p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-calendar-check"></i>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Auditadas / Contacto</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: '#10b981' }}>
              {totales.total_auditadas || 0} <span style={{ fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>({totales.porcentaje_auditadas || 0}%)</span>
            </p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Promedio Calidad</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: (totales.promedio_general || 0) >= 8 ? '#10b981' : (totales.promedio_general || 0) >= 6 ? '#f59e0b' : '#ef4444' }}>
              {totales.promedio_general ? totales.promedio_general.toFixed(2) : '0.00'} <span style={{ fontSize: '0.85rem', color: 'var(--sidebar-text)' }}>/ 10</span>
            </p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-star"></i>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Re-visitas Solicitadas</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: totales.total_nueva_visita > 0 ? '#ef4444' : '#10b981' }}>
              {totales.total_nueva_visita || 0}
            </p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>
      </div>

      {/* TABLA DE VISITAS PARA AUDITORÍA */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-list-ul" style={{ color: '#3b82f6' }}></i> Bandeja de Visitas a Auditar ({visitas.length})
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
            Haz clic en "Auditar" para registrar la evaluación de calidad
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--sidebar-text)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '12px' }}></i>
            <div>Cargando visitas para auditoría...</div>
          </div>
        ) : visitas.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--sidebar-text)', background: 'rgba(0,0,0,0.1)', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
            <i className="fa-solid fa-clipboard-check" style={{ fontSize: '2.5rem', opacity: 0.4, marginBottom: '10px', display: 'block' }}></i>
            <strong style={{ fontSize: '0.95rem' }}>No se encontraron visitas finalizadas para el filtro seleccionado.</strong>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'var(--profile-bg)', borderBottom: '2px solid var(--border-color)', color: 'var(--sidebar-text)', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px', borderRadius: '10px 0 0 10px' }}>Ticket</th>
                <th style={{ padding: '12px 14px' }}>Fecha Visita</th>
                <th style={{ padding: '12px 14px' }}>Cliente / Contrato</th>
                <th style={{ padding: '12px 14px' }}>Teléfono</th>
                <th style={{ padding: '12px 14px' }}>Técnico</th>
                <th style={{ padding: '12px 14px' }}>Problema / Solución</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Estado Auditoría</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Nota (1-10)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', borderRadius: '0 10px 10px 0' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map((v) => {
                const est = v.estado_contacto || 'PENDIENTE';
                const prom = v.promedio_total;
                const reqNueva = v.solicito_nueva_visita === 'SI';

                return (
                  <tr
                    key={v.id_visita}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: reqNueva ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 900, color: 'var(--text-main)' }}>
                      #VT-{v.id_visita}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                      {v.fecha_visita || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{v.cliente}</div>
                      <small style={{ color: 'var(--sidebar-text)', fontWeight: 700 }}>Contrato #{v.contrato || 'S/C'}</small>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#38bdf8' }}>
                      {v.telefonos || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>🧑‍🔧 {v.tecnico_principal || 'S/A'}</div>
                      <small style={{ color: 'var(--sidebar-text)' }}>🚗 {v.placa_vehiculo || 'S/P'}</small>
                    </td>
                    <td style={{ padding: '12px 14px', maxWidth: '240px' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <strong>Motivo:</strong> {v.problema_inicial || '—'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <strong>Solución:</strong> {v.solucion_tecnico || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {est === 'PENDIENTE' && (
                        <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', fontWeight: 800, fontSize: '0.74rem' }}>
                          🕒 Pendiente
                        </span>
                      )}
                      {est === 'CONTESTO' && (
                        <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 900, fontSize: '0.74rem' }}>
                          ✅ Auditada
                        </span>
                      )}
                      {est === 'NO_CONTESTA' && (
                        <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 800, fontSize: '0.74rem' }}>
                          📵 No Contesta ({v.intentos_llamada || 1})
                        </span>
                      )}
                      {est === 'VOLVER_A_LLAMAR' && (
                        <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 800, fontSize: '0.74rem' }}>
                          🔄 Volver a Llamar
                        </span>
                      )}
                      {est === 'NUMERO_EQUIVOCADO' && (
                        <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800, fontSize: '0.74rem' }}>
                          ❌ Num. Equivocado
                        </span>
                      )}
                      {reqNueva && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#ef4444', color: '#ffffff', fontWeight: 900, fontSize: '0.68rem' }}>
                            🚨 RE-VISITA
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900 }}>
                      {prom !== null && prom !== undefined ? (
                        <span style={{
                          fontSize: '0.95rem',
                          color: prom >= 8 ? '#10b981' : prom >= 6 ? '#f59e0b' : '#ef4444'
                        }}>
                          ⭐ {Number(prom).toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--sidebar-text)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => abrirAuditoriaModal(v)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '10px',
                          background: est === 'PENDIENTE' ? '#1f497d' : 'var(--profile-bg)',
                          border: est === 'PENDIENTE' ? 'none' : '1px solid var(--border-color)',
                          color: est === 'PENDIENTE' ? 'white' : 'var(--text-main)',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: est === 'PENDIENTE' ? '0 4px 10px rgba(31, 73, 125, 0.25)' : 'none'
                        }}
                      >
                        <i className="fa-solid fa-pen-to-square"></i> {est === 'PENDIENTE' ? 'Auditar' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DE AUDITORÍA (FORMULARIO DE CARO) */}
      {modalVisita && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            {/* Header Modal */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#1f497d', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 900 }}>
                    #VT-{modalVisita.id_visita}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>
                    {modalVisita.cliente}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600, flexWrap: 'wrap' }}>
                  <span>Contrato: <strong style={{ color: 'var(--text-main)' }}>#{modalVisita.contrato || 'S/C'}</strong></span>
                  <span>Teléfonos: <strong style={{ color: '#38bdf8' }}>{modalVisita.telefonos || '—'}</strong></span>
                  <span>Técnico: <strong style={{ color: 'var(--text-main)' }}>{modalVisita.tecnico_principal}</strong></span>
                  <span>Fecha: <strong style={{ color: 'var(--text-main)' }}>{modalVisita.fecha_visita}</strong></span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#10b981', fontWeight: 700 }}>
                  Solución técnica: {modalVisita.solucion_tecnico || '—'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalVisita(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--sidebar-text)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Body Modal Form */}
            <form onSubmit={handleGuardarAuditoria} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
                
                {/* 1. ESTADO DE CONTACTO & INTENTOS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', background: 'var(--profile-bg)', padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sidebar-text)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Resultado del Contacto:
                    </label>
                    <select
                      value={formData.estado_contacto}
                      onChange={(e) => setFormData({ ...formData, estado_contacto: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        color: 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '0.86rem'
                      }}
                    >
                      <option value="CONTESTO">✅ Contestó (Realizar Encuesta)</option>
                      <option value="NO_CONTESTA">📵 No Contesta</option>
                      <option value="VOLVER_A_LLAMAR">🔄 Volver a Llamar</option>
                      <option value="NUMERO_EQUIVOCADO">❌ Número Equivocado</option>
                      <option value="FUERA_SERVICIO">🚫 Fuera de Servicio / Apagado</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sidebar-text)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      N° de Intentos de Llamada:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.intentos_llamada}
                      onChange={(e) => setFormData({ ...formData, intentos_llamada: parseInt(e.target.value) || 1 })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        color: 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '0.86rem'
                      }}
                    />
                  </div>
                </div>

                {/* SI CONTESTÓ -> DESPLEGAR CUESTIONARIO COMPLETO */}
                {formData.estado_contacto === 'CONTESTO' && (
                  <>
                    {/* SECCIÓN PREGUNTAS DEL 1 AL 10 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-star-half-stroke"></i> Evaluación del Servicio y Atención (Escala 1 al 10)
                      </div>

                      {renderScaleSelector(
                        'p1_servicio',
                        '1. Funcionamiento del Servicio',
                        '¿Cómo está funcionando el servicio (Internet, cable o Smart Home) después de la visita técnica o instalación?'
                      )}

                      {renderScaleSelector(
                        'p2_velocidad',
                        '2. Pruebas de Velocidad',
                        '¿Qué tan conforme quedó con las pruebas de velocidad realizadas por el técnico durante la visita?'
                      )}

                      {renderScaleSelector(
                        'p3_cobertura',
                        '3. Pruebas de Cobertura',
                        '¿Qué tan conforme quedó con las pruebas de cobertura realizadas por el técnico durante la visita?'
                      )}

                      {renderScaleSelector(
                        'p4_explicacion_router',
                        '4. Explicación del Router',
                        '¿Qué tan clara fue la explicación del técnico sobre el funcionamiento del router instalado en su domicilio?'
                      )}

                      {renderScaleSelector(
                        'p6_profesionalismo',
                        '5. Profesionalismo del Técnico',
                        '¿Qué tan profesional le pareció el técnico que realizó la instalación o revisión?'
                      )}

                      <div style={{ marginTop: '-4px' }}>
                        <input
                          type="text"
                          value={formData.p6_motivo_profesionalismo}
                          onChange={(e) => setFormData({ ...formData, p6_motivo_profesionalismo: e.target.value })}
                          placeholder="¿Por qué le pareció profesional / no profesional? (Opcional)..."
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--profile-bg)',
                            color: 'var(--text-main)',
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      {renderScaleSelector(
                        'p7_cordialidad',
                        '6. Cordialidad y Respeto',
                        '¿Qué tan cordial y respetuoso fue el técnico durante su visita?'
                      )}

                      {renderScaleSelector(
                        'p8_orden_limpieza',
                        '7. Orden y Limpieza',
                        '¿Qué tan ordenado y limpio fue el trabajo del técnico durante la instalación o soporte?'
                      )}
                    </div>

                    {/* SECCIÓN APP ROUTER (SI / NO) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-mobile-screen-button"></i> Funcionalidades de la App del Router
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--sidebar-text)' }}>
                        ¿El técnico le informó sobre las siguientes funcionalidades de la app que controla el router?
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                        {renderYesNo('app_administrar_router', 'Cómo administrar el Router')}
                        {renderYesNo('app_cambio_wifi', 'Cambio de contraseña y nombre de red')}
                        {renderYesNo('app_red_invitados', 'Cómo crear una red de invitados')}
                        {renderYesNo('app_control_parental', 'Sobre el control parental')}
                      </div>
                    </div>

                    {/* SECCIÓN GRILLA DE CANALES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-tv"></i> Grilla de Canales
                      </div>
                      {renderYesNo(
                        'instalo_grilla_canales',
                        '¿El técnico le instaló en su teléfono el enlace para acceder a la grilla de canales, indicando su funcionamiento?'
                      )}
                    </div>

                    {/* BANNER PROMEDIO CALCULADO */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(31, 73, 125, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
                      border: '1px solid #38bdf8',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block' }}>PROMEDIO TOTAL DE CALIDAD</strong>
                        <small style={{ color: 'var(--sidebar-text)' }}>Calculado automáticamente según las 7 preguntas escala 1-10</small>
                      </div>
                      <div style={{
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        color: Number(calcularPromedioEnVivo()) >= 8 ? '#10b981' : Number(calcularPromedioEnVivo()) >= 6 ? '#f59e0b' : '#ef4444'
                      }}>
                        ⭐ {calcularPromedioEnVivo()} <span style={{ fontSize: '0.9rem', color: 'var(--sidebar-text)' }}>/ 10</span>
                      </div>
                    </div>

                    {/* SUGERENCIA DEL CLIENTE */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                        💬 Sugerencia del Cliente para seguir mejorando con FUTURITY:
                      </label>
                      <textarea
                        rows="2"
                        value={formData.sugerencia_cliente}
                        onChange={(e) => setFormData({ ...formData, sugerencia_cliente: e.target.value })}
                        placeholder="Escribe aquí las sugerencias o comentarios que indicó el cliente..."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--profile-bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.84rem',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </>
                )}

                {/* GESTIÓN OPERATIVA & FLAGS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {renderYesNo('visita_efectiva', '¿Visita Efectiva / Concluida?')}
                  {renderYesNo('solicito_nueva_visita', '¿Se solicitó nueva visita / revisión?')}
                  {renderYesNo('volver_a_llamar', '¿Volver a llamar al cliente?')}
                </div>

                {/* OBSERVACIONES INTERNAS DEL AUDITOR */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    📝 Observaciones Internas del Auditor:
                  </label>
                  <textarea
                    rows="2"
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Notas internas del auditor sobre la llamada, compromisos o detalles técnicos..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--profile-bg)',
                      color: 'var(--text-main)',
                      fontSize: '0.84rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

              </div>

              {/* Footer Modal Buttons */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--profile-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => setModalVisita(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--sidebar-text)',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 28px',
                    borderRadius: '12px',
                    background: saveSuccess ? '#10b981' : '#1f497d',
                    border: 'none',
                    color: 'white',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    cursor: saving ? 'wait' : 'pointer',
                    boxShadow: '0 4px 14px rgba(31, 73, 125, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {saving ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</>
                  ) : saveSuccess ? (
                    <><i className="fa-solid fa-check"></i> ¡Guardado Exitoso!</>
                  ) : (
                    <><i className="fa-solid fa-floppy-disk"></i> Guardar Auditoría</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
