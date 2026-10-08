import React, { useState, useEffect, useRef } from 'react';
import AuditoriaVisitasTab from './AuditoriaVisitasTab';

const PREGUNTAS_ARCOTEL = [
  { key: 'p1', num: 1, dim: 'AMABILIDAD', label: 'El trato o actitud del personal hacia el usuario', color: '#0284c7', icon: 'fa-solid fa-handshake-angle' },
  { key: 'p2', num: 2, dim: 'AMABILIDAD', label: 'La paciencia para atender las quejas y sugerencias de los usuarios', color: '#06b6d4', icon: 'fa-solid fa-heart' },
  { key: 'p3', num: 3, dim: 'DISPONIBILIDAD', label: 'La disponibilidad del personal para ayudarle a solucionar sus requerimientos', color: '#8b5cf6', icon: 'fa-solid fa-user-clock' },
  { key: 'p4', num: 4, dim: 'RAPIDEZ', label: 'Agilidad o rapidez para resolver las consultas o reclamos formulados por el usuario', color: '#f59e0b', icon: 'fa-solid fa-bolt' },
  { key: 'p5', num: 5, dim: 'RAPIDEZ', label: 'Tiempo de espera para ser atendido, al momento de comunicar un reclamo o queja', color: '#10b981', icon: 'fa-solid fa-stopwatch' },
];

function ControlCalidadTab({ token }) {
  const [subTab, setSubTab] = useState('auditoria-visitas');

  const getTodayStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [fechaInicio, setFechaInicio] = useState(getTodayStr());
  const [fechaFin, setFechaFin] = useState(getTodayStr());
  const [clienteFilter, setClienteFilter] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');

  const [loading, setLoading] = useState(true);

  // Data states
  const [kpis, setKpis] = useState({
    promedio_global: 0.0,
    total_calificadas: 0,
    alertas_criticas: 0,
    promedio_rapidez: 0.0,
    promedio_atencion: 0.0,
    promedio_explicacion: 0.0
  });

  const [ranking, setRanking] = useState([]);
  const [resenas, setResenas] = useState([]);
  const [tabulacionArcotel, setTabulacionArcotel] = useState(null);

  // Chart ref
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const fetchCalidadData = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/control_calidad/datos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&cliente=${encodeURIComponent(clienteFilter)}&es_instalacion=${tipoServicio}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setKpis(data.kpis || {});
        setRanking(data.ranking || []);
        setResenas(data.resenas || []);
        setTabulacionArcotel(data.tabulacion_arcotel || null);
        renderChart(data.ranking || []);
      }
    } catch (e) {
      console.error("Error cargando control de calidad:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalidadData();
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchCalidadData();
  };

  const handleLimpiarFiltros = () => {
    const today = getTodayStr();
    setFechaInicio(today);
    setFechaFin(today);
    setClienteFilter('');
    setTipoServicio('');
    setTimeout(fetchCalidadData, 50);
  };

  const handleExportarExcelArcotel = () => {
    const params = new URLSearchParams();
    params.append('fecha_inicio', fechaInicio);
    params.append('fecha_fin', fechaFin);
    if (clienteFilter.trim()) params.append('cliente', clienteFilter.trim());
    if (tipoServicio) params.append('es_instalacion', tipoServicio);
    window.open(`/api/admin/control_calidad/exportar_arcotel_excel?${params.toString()}`, '_blank');
  };

  // Render Chart.js Stacked Bar Chart for Technician Ranking
  const renderChart = (rankingData) => {
    if (!chartRef.current || !window.Chart) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const nombres = rankingData.map(t => t.nombre);
    const buenas = rankingData.map(t => t.buenas);
    const malas = rankingData.map(t => t.malas);

    const ctx = chartRef.current.getContext('2d');
    chartInstanceRef.current = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: nombres,
        datasets: [
          {
            label: 'Positivas (≥7 / 10)',
            data: buenas,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Críticas (≤6 / 10)',
            data: malas,
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            grid: { color: 'var(--border-color)' },
            ticks: { color: 'var(--sidebar-text)', font: { family: 'system-ui', size: 10 } }
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: 'var(--text-main)', font: { family: 'system-ui', size: 11, weight: 'bold' } }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: 'var(--text-main)', font: { family: 'system-ui', weight: 'bold', size: 11 } }
          }
        }
      }
    });
  };

  return (
    <div id="tab-control-calidad" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>

      {/* Sub-Tabs Switcher */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        background: 'var(--card-bg)',
        padding: '8px 12px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        width: 'fit-content'
      }}>
        <button
          type="button"
          onClick={() => setSubTab('auditoria-visitas')}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: subTab === 'auditoria-visitas' ? 'none' : '1px solid transparent',
            background: subTab === 'auditoria-visitas' ? '#1f497d' : 'transparent',
            color: subTab === 'auditoria-visitas' ? '#ffffff' : 'var(--sidebar-text)',
            fontWeight: 900,
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: subTab === 'auditoria-visitas' ? '0 4px 12px rgba(31, 73, 125, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-clipboard-check"></i> 📋 Auditoría de Visitas 24h
        </button>

        <button
          type="button"
          onClick={() => setSubTab('momento-verdad')}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: subTab === 'momento-verdad' ? 'none' : '1px solid transparent',
            background: subTab === 'momento-verdad' ? '#1f497d' : 'transparent',
            color: subTab === 'momento-verdad' ? '#ffffff' : 'var(--sidebar-text)',
            fontWeight: 900,
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: subTab === 'momento-verdad' ? '0 4px 12px rgba(31, 73, 125, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-chart-simple"></i> 📊 Momento de Verdad (En Caliente)
        </button>
      </div>

      {subTab === 'auditoria-visitas' ? (
        <AuditoriaVisitasTab token={token} />
      ) : (
        <>
          {/* Hero Header */}
          <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
              <i className="fa-solid fa-award"></i>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Momento de Verdad - Encuestas en Caliente
              </h1>
              <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
                Respuestas inmediatas enviadas por los clientes desde su celular al finalizar la visita técnica.
              </p>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div style={{ background: 'var(--card-bg)', padding: '20px 24px', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: '25px', boxShadow: 'var(--shadow-sm)' }}>
            <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Desde (Fecha):</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Hasta (Fecha):</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                />
              </div>
              <div style={{ flex: 2, minWidth: '200px' }}>
                <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Buscar Cliente:</label>
                <input
                  type="text"
                  value={clienteFilter}
                  onChange={(e) => setClienteFilter(e.target.value)}
                  placeholder="Nombre del cliente..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Tipo de Servicio:</label>
                <select
                  value={tipoServicio}
                  onChange={(e) => setTipoServicio(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, height: '44px' }}
                >
                  <option value="">-- Todos los Servicios --</option>
                  <option value="0">Visitas de Soporte</option>
                  <option value="1">Instalaciones</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', height: '44px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-filter"></i> Filtrar
                </button>
                <button
                  type="button"
                  onClick={handleLimpiarFiltros}
                  style={{ background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', height: '44px' }}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleExportarExcelArcotel}
                  title="Descargar matriz consolidada y detalle de respuestas para ARCOTEL en Excel"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <i className="fa-solid fa-file-excel"></i> Exportar ARCOTEL (.xlsx)
                </button>
              </div>
            </form>
          </div>

          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div style={{ background: 'var(--card-bg)', padding: '22px', borderRadius: '20px', border: '1px solid var(--border-color)', borderLeft: '6px solid #0284c7', boxShadow: 'var(--shadow-sm)' }}>
              <h6 style={{ margin: '0 0 6px 0', color: 'var(--sidebar-text)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Promedio Global</h6>
              <h3 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-main)', fontWeight: 900 }}>
                {parseFloat(kpis.promedio_global || 0).toFixed(2)} <span style={{ fontSize: '1rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>/ 10</span>
              </h3>
            </div>
            <div style={{ background: 'var(--card-bg)', padding: '22px', borderRadius: '20px', border: '1px solid var(--border-color)', borderLeft: '6px solid #10b981', boxShadow: 'var(--shadow-sm)' }}>
              <h6 style={{ margin: '0 0 6px 0', color: 'var(--sidebar-text)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Total Calificadas</h6>
              <h3 style={{ margin: 0, fontSize: '2.2rem', color: '#10b981', fontWeight: 900 }}>
                {kpis.total_calificadas || 0}
              </h3>
            </div>
            <div style={{ background: 'var(--card-bg)', padding: '22px', borderRadius: '20px', border: '1px solid var(--border-color)', borderLeft: '6px solid #ef4444', boxShadow: 'var(--shadow-sm)' }}>
              <h6 style={{ margin: '0 0 6px 0', color: 'var(--sidebar-text)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Alertas Críticas (≤6 / 10)</h6>
              <h3 style={{ margin: 0, fontSize: '2.2rem', color: '#ef4444', fontWeight: 900 }}>
                {kpis.alertas_criticas || 0}
              </h3>
            </div>
          </div>

          {/* Desglose por Categoría */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '24px', marginBottom: '25px', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '10px' }}>
              📊 Desglose de Calificaciones por Categoría (Escala 1 al 10)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              {/* Rapidez */}
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px' }}>
                <span style={{ color: 'var(--sidebar-text)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>⚡ Promedio Rapidez</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#0284c7' }}>
                    {parseFloat(kpis.promedio_rapidez || 0).toFixed(1)}
                  </strong>
                  <span style={{ color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.9rem' }}>/ 10</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (kpis.promedio_rapidez || 0) * 10)}%`, backgroundColor: '#0284c7', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Atención */}
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px' }}>
                <span style={{ color: 'var(--sidebar-text)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>😊 Promedio Atención</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981' }}>
                    {parseFloat(kpis.promedio_atencion || 0).toFixed(1)}
                  </strong>
                  <span style={{ color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.9rem' }}>/ 10</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (kpis.promedio_atencion || 0) * 10)}%`, backgroundColor: '#10b981', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Explicación */}
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px' }}>
                <span style={{ color: 'var(--sidebar-text)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>📢 Promedio Explicación</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b' }}>
                    {parseFloat(kpis.promedio_explicacion || 0).toFixed(1)}
                  </strong>
                  <span style={{ color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.9rem' }}>/ 10</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (kpis.promedio_explicacion || 0) * 10)}%`, backgroundColor: '#f59e0b', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* TABULACIÓN OFICIAL ARCOTEL */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '24px', marginBottom: '25px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-building-columns" style={{ color: '#0284c7' }}></i> Tabulación Oficial ARCOTEL (Escala 1 al 5)
                </h4>
                <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.84rem', fontWeight: 600 }}>
                  Consolidado oficial de satisfacción por dimensión para auditorías regulatorias
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportarExcelArcotel}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <i className="fa-solid fa-file-excel"></i> Descargar Reporte ARCOTEL (.xlsx)
              </button>
            </div>

            {tabulacionArcotel && tabulacionArcotel.total_arcotel > 0 ? (
              <>
                {/* Resumen Superior ARCOTEL */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px' }}>
                    <span style={{ color: 'var(--sidebar-text)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Encuestas ARCOTEL</span>
                    <h3 style={{ margin: 0, fontSize: '1.9rem', color: 'var(--text-main)', fontWeight: 900 }}>
                      {tabulacionArcotel.total_arcotel}
                    </h3>
                  </div>
                  <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px' }}>
                    <span style={{ color: 'var(--sidebar-text)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Promedio Global ARCOTEL</span>
                    <h3 style={{ margin: 0, fontSize: '1.9rem', color: '#0284c7', fontWeight: 900 }}>
                      {(
                        ((parseFloat(tabulacionArcotel.p1_prom || 0) +
                          parseFloat(tabulacionArcotel.p2_prom || 0) +
                          parseFloat(tabulacionArcotel.p3_prom || 0) +
                          parseFloat(tabulacionArcotel.p4_prom || 0) +
                          parseFloat(tabulacionArcotel.p5_prom || 0)) / 5.0).toFixed(2)
                      )} <span style={{ fontSize: '0.9rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>/ 5.00</span>
                    </h3>
                  </div>
                  <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px' }}>
                    <span style={{ color: 'var(--sidebar-text)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>% Nivel de Satisfacción</span>
                    {(() => {
                      const totalRatings = (tabulacionArcotel.total_arcotel || 1) * 5;
                      const goodRatings = (
                        (tabulacionArcotel.p1_5 || 0) + (tabulacionArcotel.p1_4 || 0) +
                        (tabulacionArcotel.p2_5 || 0) + (tabulacionArcotel.p2_4 || 0) +
                        (tabulacionArcotel.p3_5 || 0) + (tabulacionArcotel.p3_4 || 0) +
                        (tabulacionArcotel.p4_5 || 0) + (tabulacionArcotel.p4_4 || 0) +
                        (tabulacionArcotel.p5_5 || 0) + (tabulacionArcotel.p5_4 || 0)
                      );
                      const pct = totalRatings > 0 ? ((goodRatings / totalRatings) * 100).toFixed(1) : '0.0';
                      return (
                        <h3 style={{ margin: 0, fontSize: '1.9rem', color: parseFloat(pct) >= 80 ? '#10b981' : parseFloat(pct) >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 900 }}>
                          {pct}%
                        </h3>
                      );
                    })()}
                  </div>
                </div>

                {/* Tabla Matriz ARCOTEL */}
                <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>#</th>
                        <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>Dimensión</th>
                        <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)', minWidth: '280px' }}>Pregunta ARCOTEL</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#10b981' }}>5 (Muy Bueno)</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>4 (Bueno)</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#f59e0b' }}>3 (Aceptable)</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#ea580c' }}>2 (Malo)</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#ef4444' }}>1 (Muy Malo)</th>
                        <th style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>Total</th>
                        <th style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>Promedio</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>% Satisfacción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PREGUNTAS_ARCOTEL.map((p, idx) => {
                        const c5 = tabulacionArcotel[`${p.key}_5`] || 0;
                        const c4 = tabulacionArcotel[`${p.key}_4`] || 0;
                        const c3 = tabulacionArcotel[`${p.key}_3`] || 0;
                        const c2 = tabulacionArcotel[`${p.key}_2`] || 0;
                        const c1 = tabulacionArcotel[`${p.key}_1`] || 0;
                        const totalP = c5 + c4 + c3 + c2 + c1;
                        const prom = parseFloat(tabulacionArcotel[`${p.key}_prom`] || 0).toFixed(2);
                        const satisfaccionPct = totalP > 0 ? (((c5 + c4) / totalP) * 100).toFixed(1) : '0.0';

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--card-bg)' : 'var(--profile-bg)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--sidebar-text)' }}>{p.num}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ background: `${p.color}15`, color: p.color, padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                <i className={p.icon} style={{ marginRight: '5px' }}></i>{p.dim}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 600 }}>{p.label}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{c5}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{c4}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>{c3}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#ea580c' }}>{c2}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#ef4444' }}>{c1}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>{totalP}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 900, color: '#0284c7' }}>{prom} / 5</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span style={{
                                background: parseFloat(satisfaccionPct) >= 80 ? 'rgba(16, 185, 129, 0.15)' : parseFloat(satisfaccionPct) >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: parseFloat(satisfaccionPct) >= 80 ? '#059669' : parseFloat(satisfaccionPct) >= 60 ? '#d97706' : '#dc2626',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontWeight: 800,
                                fontSize: '0.78rem'
                              }}>
                                {satisfaccionPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 20px', background: 'var(--profile-bg)', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
                <i className="fa-solid fa-clipboard-check" style={{ fontSize: '2.5rem', color: 'var(--sidebar-text)', opacity: 0.5, marginBottom: '10px', display: 'block' }}></i>
                <h5 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontWeight: 800 }}>Aún no hay encuestas ARCOTEL en el rango seleccionado</h5>
                <p style={{ margin: 0, color: 'var(--sidebar-text)', fontSize: '0.85rem' }}>
                  Cuando los clientes completen la encuesta móvil al finalizar las visitas, las respuestas se tabularán aquí en tiempo real y podrás descargarlas en Excel para auditoría.
                </p>
              </div>
            )}
          </div>

          {/* Dual Charts & Reviews Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '25px', marginBottom: '30px' }}>

            {/* Gráfico Ranking de Satisfacción (Izquierda) */}
            <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-trophy" style={{ color: '#f59e0b' }}></i> Ranking de Satisfacción de Técnicos
              </h3>
              <div style={{ position: 'relative', height: '360px' }}>
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* Reseñas de Clientes (Derecha) */}
            <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-comments" style={{ color: '#0284c7' }}></i> Últimas Reseñas de Clientes
              </h3>

              <div style={{ overflowY: 'auto', maxHeight: '360px', paddingRight: '4px', flexGrow: 1 }}>
                {resenas.length > 0 ? (
                  resenas.map((r, idx) => {
                    let promReview = 0;
                    if (r.encuesta_rapidez !== null && r.encuesta_atencion !== null && r.encuesta_explicacion !== null) {
                      promReview = (parseFloat(r.encuesta_rapidez) + parseFloat(r.encuesta_atencion) + parseFloat(r.encuesta_explicacion)) / 3.0;
                    } else {
                      promReview = parseFloat(r.calificacion_estrellas || 0) * 2.0;
                    }

                    const isGood = promReview >= 7.0;
                    const borderCol = isGood ? '#10b981' : '#ef4444';

                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--profile-bg)',
                          borderLeft: `5px solid ${borderCol}`,
                          borderRadius: '14px',
                          padding: '16px',
                          marginBottom: '14px',
                          borderTop: '1px solid var(--border-color)',
                          borderRight: '1px solid var(--border-color)',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 800 }}>{r.cliente}</strong>
                          <span style={{ background: isGood ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: isGood ? '#047857' : '#b91c1c', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.82rem' }}>
                            {promReview.toFixed(1)} / 10
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 10px 0', color: 'var(--text-main)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                          "{r.calificacion_comentario || 'Sin comentarios adicionales.'}"
                        </p>
                        <div style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span>Técnico: <strong style={{ color: 'var(--text-main)' }}>{r.tecnico_principal}</strong></span>
                          <span>Sector: <strong>{r.sector}</strong></span>
                        </div>

                        {/* Encuestas Detalladas Pills */}
                        {r.arcotel_p1_trato !== null ? (
                          <div style={{ marginTop: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <i className="fa-solid fa-award"></i> Oficial ARCOTEL (Escala 1 a 5):
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: r.arcotel_sugerencia ? '8px' : '0' }}>
                              <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                1. Trato: {r.arcotel_p1_trato}/5
                              </span>
                              <span style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#0891b2', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                2. Paciencia: {r.arcotel_p2_paciencia}/5
                              </span>
                              <span style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                3. Disponibilidad: {r.arcotel_p3_disponibilidad}/5
                              </span>
                              <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                4. Agilidad: {r.arcotel_p4_agilidad}/5
                              </span>
                              <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                                5. Espera: {r.arcotel_p5_tiempo_espera}/5
                              </span>
                            </div>
                            {r.arcotel_sugerencia && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', background: 'rgba(2, 132, 199, 0.05)', padding: '6px 10px', borderRadius: '6px', fontStyle: 'italic', borderLeft: '3px solid #0284c7' }}>
                                <strong>Sugerencia ARCOTEL:</strong> "{r.arcotel_sugerencia}"
                              </div>
                            )}
                          </div>
                        ) : r.encuesta_rapidez !== null ? (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                              ⚡ Rapidez: {r.encuesta_rapidez}/10
                            </span>
                            <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                              😊 Atención: {r.encuesta_atencion}/10
                            </span>
                            <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                              📢 Explicación: {r.encuesta_explicacion}/10
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    {loading ? 'Cargando reseñas...' : 'No hay reseñas registradas en este periodo.'}
                  </div>
                )}
              </div>
            </div>

          </div>

        </>
      )}
    </div>
  );
}

export default ControlCalidadTab;

