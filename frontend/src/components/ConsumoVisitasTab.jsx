import React, { useState, useEffect } from 'react';

export default function ConsumoVisitasTab({ token, tecnicosVehiculosProp = [] }) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [fecha, setFecha] = useState(getTodayStr());
  const [tecnico, setTecnico] = useState('TODOS');
  const [estado, setEstado] = useState('TODOS');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [dataReporte, setDataReporte] = useState({
    fecha: getTodayStr(),
    tecnicos: [],
    totales: {
      visitas_total: 0,
      visitas_finalizadas: 0,
      visitas_en_progreso: 0,
      total_insumos_consumidos: 0,
      onus_instaladas: 0,
      routers_instalados: 0,
      equipos_instalados_total: 0,
      equipos_retirados_total: 0,
      materiales_resumen: []
    },
    visitas: []
  });

  const [listaTecnicos, setListaTecnicos] = useState(tecnicosVehiculosProp);

  const getToken = () => token || localStorage.getItem('token') || localStorage.getItem('session_token') || '';

  const cargarTecnicos = async () => {
    try {
      const authToken = getToken();
      const res = await fetch('/api/admin/tecnicos', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data?.status === 'ok' && Array.isArray(data.tecnicos)) {
        setListaTecnicos(data.tecnicos);
      } else if (Array.isArray(data)) {
        setListaTecnicos(data);
      }
    } catch (e) {
      console.warn("Usando tecnicos desde reporte o props:", e);
    }
  };

  const cargarReporte = async () => {
    setLoading(true);
    setError('');
    try {
      const authToken = getToken();
      const params = new URLSearchParams();
      params.append('fecha', fecha);
      if (tecnico !== 'TODOS') params.append('tecnico', tecnico);
      if (estado !== 'TODOS') params.append('estado', estado);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/visitas_materiales_reporte?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setDataReporte(data);
        if (data.tecnicos && data.tecnicos.length > 0) {
          setListaTecnicos(data.tecnicos);
        }
      } else {
        setError(data?.message || 'Error al cargar reporte de materiales.');
      }
    } catch (e) {
      console.error("Error cargando reporte:", e);
      setError('Error de conexión al cargar datos de visitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTecnicos();
  }, []);

  useEffect(() => {
    if (tecnicosVehiculosProp && tecnicosVehiculosProp.length > 0 && listaTecnicos.length === 0) {
      setListaTecnicos(tecnicosVehiculosProp);
    }
  }, [tecnicosVehiculosProp]);

  useEffect(() => {
    cargarReporte();
  }, [fecha, tecnico, estado]);

  const handleQuickDate = (type) => {
    const d = new Date();
    if (type === 'ayer') {
      d.setDate(d.getDate() - 1);
    }
    setFecha(d.toISOString().split('T')[0]);
  };

  const handlePrint = () => {
    window.print();
  };

  const totales = dataReporte?.totales || {};
  const visitas = dataReporte?.visitas || [];
  const materialesResumen = totales?.materiales_resumen || [];

  // Lista consolidada de técnicos para el selector
  const tecnicosFinales = (dataReporte?.tecnicos && dataReporte.tecnicos.length > 0)
    ? dataReporte.tecnicos
    : (listaTecnicos && listaTecnicos.length > 0)
      ? listaTecnicos
      : tecnicosVehiculosProp;

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
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: 'white',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-clipboard-check"></i>
            </span>
            Consumo de Materiales en Visitas Técnicas
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
            Auditoría diaria para Bodega: insumos descontados en calle, ONUs y Routers instalados o retirados.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={cargarReporte}
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
            onClick={handlePrint}
            style={{
              padding: '9px 16px',
              borderRadius: '12px',
              background: '#1f497d',
              border: 'none',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(31, 73, 125, 0.25)'
            }}
          >
            <i className="fa-solid fa-print"></i> Imprimir Reporte
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
        {/* Selector de Fecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
            📅 Fecha:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.86rem'
            }}
          />
          <button
            type="button"
            onClick={() => handleQuickDate('hoy')}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: fecha === getTodayStr() ? '1px solid #38bdf8' : '1px solid var(--border-color)',
              background: fecha === getTodayStr() ? 'rgba(56, 189, 248, 0.15)' : 'var(--profile-bg)',
              color: fecha === getTodayStr() ? '#38bdf8' : 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('ayer')}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            Ayer
          </button>
        </div>

        {/* Filtros Dropdowns y Buscador */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          {/* Selector de Técnico */}
          <select
            value={tecnico}
            onChange={(e) => setTecnico(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.82rem',
              minWidth: '200px'
            }}
          >
            <option value="TODOS">🧑‍🔧 Todos los Técnicos</option>
            {tecnicosFinales.map((t, idx) => {
              const nombre = t.nombre || t.tecnico || `Técnico ${idx + 1}`;
              const placaStr = t.placa || t.placa_asignada_hoy || t.placa_vehiculo || 'S/P';
              return (
                <option key={t.id_tecnico || idx} value={nombre}>
                  {nombre} ({placaStr})
                </option>
              );
            })}
          </select>

          {/* Estado de Visita */}
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.82rem',
              minWidth: '170px'
            }}
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="FINALIZADA">✅ Solo Finalizadas</option>
            <option value="EN_PROGRESO">⏳ En Progreso / Ruta</option>
            <option value="PENDIENTE">🕒 Pendientes</option>
          </select>

          {/* Buscador */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargarReporte()}
            placeholder="Buscar Cliente, Contrato..."
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.82rem',
              minWidth: '200px'
            }}
          />
        </div>
      </div>

      {/* METRICAS KPI DEL DÍA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Visitas Finalizadas</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: '#10b981' }}>
              {totales.visitas_finalizadas || 0} <span style={{ fontSize: '0.9rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>/ {totales.visitas_total || 0}</span>
            </p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-list-check"></i>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Insumos Descontados</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: '#38bdf8' }}>
              {totales.total_insumos_consumidos || 0} <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>uds/mts</span>
            </p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-boxes-packing"></i>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Equipos Instalados</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: '#8b5cf6' }}>
              {totales.equipos_instalados_total || 0}
            </p>
            <small style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 700 }}>
              ONUs: {totales.onus_instaladas || 0} | Routers: {totales.routers_instalados || 0}
            </small>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-tower-broadcast"></i>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Equipos Retirados / Daño</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.7rem', fontWeight: 900, color: '#ef4444' }}>
              {totales.equipos_retirados_total || 0}
            </p>
            <small style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 700 }}>
              En custodia / bodega
            </small>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-recycle"></i>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: RESUMEN CONSOLIDADO DE MATERIALES USADOS EN LA FECHA */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-cubes-stacked" style={{ color: '#0ea5e9' }}></i> Resumen Total de Materiales Consumidos ({fecha})
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
            {materialesResumen.length} insumos distintos utilizados
          </span>
        </div>

        {materialesResumen.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--sidebar-text)', background: 'rgba(0,0,0,0.1)', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>No se han registrado consumos de materiales para la fecha seleccionada.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {materialesResumen.map((mat) => {
              const unidadTexto = mat.unidad_medida === 'METROS' ? 'mts' : 'uds';
              return (
                <div
                  key={mat.id_material}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: 'var(--profile-bg)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block' }}>
                      [{mat.codigo_material}]
                    </span>
                    <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.86rem', marginTop: '2px', lineHeight: 1.25 }}>
                      {mat.nombre_material}
                    </strong>
                    <small style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                      En {mat.visitas_count} visita(s)
                    </small>
                  </div>
                  
                  {/* Badge de Cantidad y Unidad Nunca Cortado */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    background: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.35)',
                    color: '#38bdf8',
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{mat.cantidad_total}</span>
                    <span style={{ fontSize: '0.74rem', textTransform: 'lowercase', opacity: 0.9 }}>{unidadTexto}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: DESGLOSE DETALLADO VISITA POR VISITA */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-list-ul" style={{ color: '#10b981' }}></i> Detalle por Visita Técnica ({visitas.length})
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
            Insumos y equipos auditados visita a visita
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--sidebar-text)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '12px' }}></i>
            <div>Cargando detalle de visitas...</div>
          </div>
        ) : visitas.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--sidebar-text)', background: 'rgba(0,0,0,0.1)', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
            <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '2.5rem', opacity: 0.4, marginBottom: '10px', display: 'block' }}></i>
            <strong style={{ fontSize: '0.95rem' }}>No se encontraron visitas registradas para los filtros aplicados.</strong>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visitas.map((v) => {
              const tieneMateriales = v.materiales && v.materiales.length > 0;
              const tieneRetirados = v.equipos_retirados && v.equipos_retirados.length > 0;
              const tieneONU = v.numero_serie_onu && v.numero_serie_onu !== 'None' && v.numero_serie_onu !== 'S/N';
              const tieneRouter = v.numero_serie_router && v.numero_serie_router !== 'None' && v.numero_serie_router !== 'S/N';

              return (
                <div
                  key={v.id_visita}
                  style={{
                    background: 'var(--profile-bg)',
                    border: '1px solid var(--border-color)',
                    borderLeft: v.estado === 'FINALIZADA' ? '5px solid #10b981' : v.estado === 'EN_PROGRESO' ? '5px solid #3b82f6' : '5px solid #94a3b8',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Encabezado de la Visita */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{v.cliente}</strong>
                        <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 800 }}>
                          Contrato #{v.contrato || 'N/A'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                          Ref: #VT-{v.id_visita}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                        📍 {v.direccion || 'Sin dirección'} {v.sector ? `(${v.sector})` : ''}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        background: v.estado === 'FINALIZADA' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: v.estado === 'FINALIZADA' ? '#10b981' : '#3b82f6'
                      }}>
                        {v.estado}
                      </span>
                    </div>
                  </div>

                  {/* Técnico & Solución */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>Técnico & Placa:</span>
                      <strong style={{ color: '#38bdf8' }}>🧑‍🔧 {v.tecnico_principal || 'No asignado'}</strong>
                      <span style={{ marginLeft: '6px', color: 'var(--sidebar-text)', fontWeight: 700 }}>🚗 {v.placa_vehiculo || 'S/P'}</span>
                    </div>

                    <div>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>Solución / Motivo:</span>
                      <strong style={{ color: '#10b981' }}>{v.solucion_tecnico || v.problema || 'N/D'}</strong>
                      {v.observacion_tecnico && (
                        <small style={{ color: 'var(--sidebar-text)', display: 'block', marginTop: '2px' }}>
                          <em>"{v.observacion_tecnico}"</em>
                        </small>
                      )}
                    </div>
                  </div>

                  {/* Materiales Descontados */}
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--sidebar-text)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                      📦 Insumos Utilizados en esta Visita:
                    </span>
                    {tieneMateriales ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {v.materiales.map((m, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: 'rgba(14, 165, 233, 0.12)',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                              color: '#0284c7',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <i className="fa-solid fa-check" style={{ fontSize: '0.7rem' }}></i>
                            {m.nombre_material}: <strong>{m.cantidad_usada} {m.unidad_medida === 'METROS' ? 'mts' : 'uds'}</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>
                        No se registraron insumos en esta visita.
                      </span>
                    )}
                  </div>

                  {/* Equipos Nuevos Instalados y Retirados */}
                  {(tieneONU || tieneRouter || tieneRetirados) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                      {tieneONU && (
                        <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', fontWeight: 800 }}>
                          🔌 ONT Instalada: {v.modelo_onu || ''} S/N: <strong style={{ fontFamily: 'monospace' }}>{v.numero_serie_onu}</strong>
                        </span>
                      )}
                      {tieneRouter && (
                        <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 800 }}>
                          📶 Router Instalado: {v.modelo_router || ''} S/N: <strong style={{ fontFamily: 'monospace' }}>{v.numero_serie_router}</strong>
                        </span>
                      )}
                      {tieneRetirados && (
                        v.equipos_retirados.map((er, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800 }}>
                            ♻️ Retirado ({er.tipo_equipo}): <strong style={{ fontFamily: 'monospace' }}>{er.numero_serie}</strong> ({er.motivo_retiro})
                          </span>
                        ))
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
