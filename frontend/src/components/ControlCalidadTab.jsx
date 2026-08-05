import React, { useState, useEffect, useRef } from 'react';

function ControlCalidadTab({ token }) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

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
      
      {/* Hero Header */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          <i className="fa-solid fa-award"></i>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Control de Calidad y Auditoría de Satisfacción
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Evaluación de encuestas de servicio, alertas críticas y ranking de desempeño de los técnicos de campo.
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
          <div style={{ display: 'flex', gap: '10px' }}>
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
                    {r.encuesta_rapidez !== null && (
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
                    )}
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
    </div>
  );
}

export default ControlCalidadTab;
