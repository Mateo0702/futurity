import React, { useState, useEffect, useRef } from 'react';

function MetricasTab({ token }) {
  // Date helpers
  const formatLocalIso = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getTodayIso = () => formatLocalIso(new Date());
  const getThreeMonthsAgoIso = () => {
    const ago = new Date();
    ago.setMonth(ago.getMonth() - 3);
    return formatLocalIso(ago);
  };

  // State filters
  const [desde, setDesde] = useState(getThreeMonthsAgoIso());
  const [hasta, setHasta] = useState(getTodayIso());
  const [tecnico, setTecnico] = useState('TODOS');
  const [tecnicosList, setTecnicosList] = useState([]);

  // Subtab navigation
  const [subTab, setSubTab] = useState('visitas'); // 'visitas', 'atenciones', 'tiempos'

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Data states
  const [dataVisitas, setDataVisitas] = useState(null);
  const [dataAtenciones, setDataAtenciones] = useState(null);
  const [dataTiempos, setDataTiempos] = useState(null);

  // Audit (Timeline) states
  const [contratoAudit, setContratoAudit] = useState('');
  const [auditDesde, setAuditDesde] = useState(getThreeMonthsAgoIso());
  const [auditHasta, setAuditHasta] = useState(getTodayIso());
  const [auditResults, setAuditResults] = useState(null); // original array

  // Chart references
  const chartsRef = useRef({});
  
  // Canvas elements refs
  const canvasEstadosRef = useRef(null);
  const canvasEvolucionRef = useRef(null);
  const canvasProblemasRef = useRef(null);

  const canvasCanalesRef = useRef(null);
  const canvasAtenEvolucionRef = useRef(null);
  const canvasAtenMotivosRef = useRef(null);
  const canvasAtenSolicitudesRef = useRef(null);

  const canvasComparativaTiemposRef = useRef(null);
  const canvasTiemposProblemaRef = useRef(null);
  const canvasEvolucionTiemposRef = useRef(null);

  // Fetch metrics data when filters change or subtab switches
  useEffect(() => {
    fetchMetrics();
  }, [desde, hasta, tecnico, subTab]);

  // Clean up charts on unmount
  useEffect(() => {
    return () => {
      destroyAllCharts();
    };
  }, []);

  const destroyAllCharts = () => {
    Object.values(chartsRef.current).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    chartsRef.current = {};
  };

  const fetchMetrics = async () => {
    setLoading(true);
    destroyAllCharts();

    try {
      if (subTab === 'visitas' || subTab === 'atenciones') {
        // Fetch Visitas and Atenciones global metrics in parallel
        const [resGlobal, resAten] = await Promise.all([
          fetch(`/api/admin/metricas_globales?fecha_inicio=${desde}&fecha_fin=${hasta}&tecnico=${tecnico}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/admin/metricas_atenciones?fecha_inicio=${desde}&fecha_fin=${hasta}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const dataG = await resGlobal.json();
        const dataA = await resAten.json();

        if (dataG.status === 'ok') {
          setDataVisitas(dataG);
          // Populate technician list
          if (dataG.tecnicos && tecnicosList.length === 0) {
            setTecnicosList(dataG.tecnicos);
          }
        }
        if (dataA.status === 'ok') {
          setDataAtenciones(dataA);
        }

        // Render charts depending on active subtab
        setTimeout(() => {
          if (subTab === 'visitas' && dataG.status === 'ok') {
            renderVisitasCharts(dataG);
          } else if (subTab === 'atenciones' && dataA.status === 'ok') {
            renderAtencionesCharts(dataA);
          }
        }, 150);

      } else if (subTab === 'tiempos') {
        // Fetch Tiempos metrics
        const res = await fetch(`/api/admin/metricas_tiempos?fecha_inicio=${desde}&fecha_fin=${hasta}&tecnico=${tecnico}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataT = await res.json();
        if (dataT.status === 'ok') {
          setDataTiempos(dataT);
          setTimeout(() => {
            renderTiemposCharts(dataT);
          }, 150);
        }
      }
    } catch (e) {
      console.error("Error al cargar métricas:", e);
    } finally {
      setLoading(false);
    }
  };

  // Render Visitas (VT) Charts
  const renderVisitasCharts = (data) => {
    if (!window.Chart || !data) return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Estados
    if (canvasEstadosRef.current) {
      const ctx = canvasEstadosRef.current.getContext('2d');
      chartsRef.current.estados = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Completadas', 'Reagendadas', 'Canceladas', 'Pendientes'],
          datasets: [{
            data: [
              data.estados?.FINALIZADA || 0,
              data.estados?.REAGENDADA || 0,
              data.estados?.CANCELADA || 0,
              data.estados?.PENDIENTE || 0
            ],
            backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#94a3b8'],
            borderWidth: isDark ? 2 : 1,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: textColor, font: { family: 'Inter', weight: 600 } }
            }
          }
        }
      });
    }

    // 2. Evolución
    if (canvasEvolucionRef.current) {
      const ctx = canvasEvolucionRef.current.getContext('2d');
      const evolucion = data.evolucion || [];
      chartsRef.current.evolucion = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: evolucion.map(e => e.label),
          datasets: [
            {
              label: 'Completadas',
              data: evolucion.map(e => e.completadas),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3
            },
            {
              label: 'Total Visitas',
              data: evolucion.map(e => e.total),
              borderColor: '#6366f1',
              borderWidth: 2,
              fill: false,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } }
          }
        }
      });
    }

    // 3. Problemas Comunes
    if (canvasProblemasRef.current) {
      const ctx = canvasProblemasRef.current.getContext('2d');
      const problemas = data.problemas || [];
      chartsRef.current.problemas = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: problemas.map(p => p.motivo),
          datasets: [{
            data: problemas.map(p => p.cantidad),
            backgroundColor: '#ef4444',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } }
          }
        }
      });
    }
  };

  // Render Atenciones Charts
  const renderAtencionesCharts = (data) => {
    if (!window.Chart || !data) return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Canales
    if (canvasCanalesRef.current) {
      const ctx = canvasCanalesRef.current.getContext('2d');
      const labels = Object.keys(data.medios || {});
      const values = Object.values(data.medios || {});
      chartsRef.current.canales = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8'],
            borderWidth: isDark ? 2 : 1,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: textColor, font: { family: 'Inter', weight: 600 } }
            }
          }
        }
      });
    }

    // 2. Evolución temporal
    if (canvasAtenEvolucionRef.current) {
      const ctx = canvasAtenEvolucionRef.current.getContext('2d');
      const evolucion = data.evolucion || [];
      chartsRef.current.atenEvolucion = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: evolucion.map(e => e.label),
          datasets: [{
            label: 'Atenciones',
            data: evolucion.map(e => e.total),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } }
          }
        }
      });
    }

    // 3. Motivos
    if (canvasAtenMotivosRef.current) {
      const ctx = canvasAtenMotivosRef.current.getContext('2d');
      const motivos = data.motivos || [];
      chartsRef.current.atenMotivos = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: motivos.map(m => m.motivo),
          datasets: [{
            data: motivos.map(m => m.cantidad),
            backgroundColor: '#10b981',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } }
          }
        }
      });
    }

    // 4. Solicitudes
    if (canvasAtenSolicitudesRef.current) {
      const ctx = canvasAtenSolicitudesRef.current.getContext('2d');
      const solicitudes = data.solicitudes || [];
      chartsRef.current.atenSolicitudes = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: solicitudes.map(s => s.solicitud),
          datasets: [{
            data: solicitudes.map(s => s.cantidad),
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } } }
          }
        }
      });
    }
  };

  // Render Tiempos Charts
  const renderTiemposCharts = (data) => {
    if (!window.Chart || !data) return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Comparativa
    if (canvasComparativaTiemposRef.current && tecnico === 'TODOS') {
      const ctx = canvasComparativaTiemposRef.current.getContext('2d');
      const comparativa = data.comparativa_tecnicos || [];
      chartsRef.current.comparativaTiempos = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: comparativa.map(t => t.tecnico),
          datasets: [
            {
              label: 'Minutos Traslado',
              data: comparativa.map(t => t.avg_traslado),
              backgroundColor: '#3b82f6',
              borderRadius: 6
            },
            {
              label: 'Minutos en Sitio',
              data: comparativa.map(t => t.avg_resolucion),
              backgroundColor: '#10b981',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 10 } }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } }
          }
        }
      });
    }

    // 2. Tiempos por Trabajo
    if (canvasTiemposProblemaRef.current) {
      const ctx = canvasTiemposProblemaRef.current.getContext('2d');
      const tiemposP = data.tiempos_problemas || [];
      chartsRef.current.tiemposProblema = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: tiemposP.map(p => p.categoria),
          datasets: [{
            label: 'Minutos en Sitio',
            data: tiemposP.map(p => p.avg_resolucion),
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } } }
          }
        }
      });
    }

    // 3. Evolución tiempos
    if (canvasEvolucionTiemposRef.current) {
      const ctx = canvasEvolucionTiemposRef.current.getContext('2d');
      const evolucion = data.evolucion || [];
      chartsRef.current.evolucionTiempos = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: evolucion.map(e => e.label),
          datasets: [
            {
              label: 'Promedio Traslado',
              data: evolucion.map(e => e.avg_traslado),
              borderColor: '#3b82f6',
              borderWidth: 2.5,
              fill: false,
              tension: 0.3
            },
            {
              label: 'Promedio en Sitio',
              data: evolucion.map(e => e.avg_resolucion),
              borderColor: '#10b981',
              borderWidth: 2.5,
              fill: false,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } }
          }
        }
      });
    }
  };

  // Submit client audit search
  const handleAuditSearch = async (e) => {
    e.preventDefault();
    if (!contratoAudit.trim()) {
      alert("Por favor, ingrese un número de contrato.");
      return;
    }

    setLoadingAudit(true);
    try {
      const url = `/api/admin/auditoria_cliente?contrato=${contratoAudit.trim()}&desde=${auditDesde}&hasta=${auditHasta}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAuditResults(data);
      } else {
        setAuditResults([]);
        if (data && data.status === 'error') {
          alert(data.message || "Error al consultar auditoría");
        }
      }
    } catch (err) {
      console.error("Error al buscar auditoría:", err);
      alert("Error de conexión al buscar el historial de auditoría.");
      setAuditResults([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Export PDF Report of Audit
  const handlePdfExport = async () => {
    if (!contratoAudit.trim()) return;
    setLoadingPdf(true);
    try {
      const url = `/api/admin/reporte_pdf?contrato=${contratoAudit.trim()}&desde=${auditDesde}&hasta=${auditHasta}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Reporte_Auditoria_${contratoAudit.trim()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert("Error al descargar el PDF de auditoría.");
    } finally {
      setLoadingPdf(false);
    }
  };

  // Filter audit timeline based on current sub-tab type
  const getFilteredAudit = () => {
    if (!Array.isArray(auditResults)) return [];
    if (subTab === 'visitas') {
      return auditResults.filter(v => v.tipo_registro === 'visita_tecnica');
    }
    // otherwise filter by 'atencion'
    return auditResults.filter(v => v.tipo_registro === 'atencion');
  };

  const filteredAudit = getFilteredAudit();

  return (
    <div id="tab-metricas" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      {/* Encabezado */}
      <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>Panel de Control y Auditoría</h1>
        <p style={{ marginTop: '5px', color: 'var(--sidebar-text)', fontSize: '0.95rem', fontWeight: 500 }}>Análisis de rendimiento global y seguimiento detallado por contrato.</p>
      </div>

      {/* Date and Tech Filters */}
      <div className="card" style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)', display: 'block', marginBottom: '6px' }}>Desde:</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="form-control"
            style={{ padding: '10px', width: '100%', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)', display: 'block', marginBottom: '6px' }}>Hasta:</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="form-control"
            style={{ padding: '10px', width: '100%', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
          />
        </div>
        <div style={{ flex: 1.5, minWidth: '200px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)', display: 'block', marginBottom: '6px' }}>Técnico Responsable:</label>
          <select
            value={tecnico}
            onChange={(e) => setTecnico(e.target.value)}
            className="form-control"
            style={{ padding: '10px', width: '100%', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
          >
            <option value="TODOS">👥 Todos los Técnicos</option>
            {tecnicosList.map((t, idx) => (
              <option key={idx} value={t}>👤 {t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-tabs bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSubTab('visitas')}
          style={{
            background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
            fontSize: '0.95rem',
            color: subTab === 'visitas' ? 'var(--primary)' : 'var(--sidebar-text)',
            borderBottom: subTab === 'visitas' ? '3px solid var(--primary)' : 'none',
            fontWeight: subTab === 'visitas' ? '800' : '700'
          }}
        >
          <i className="fa-solid fa-truck-ramp-box"></i> Visitas Técnicas (VT)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('atenciones')}
          style={{
            background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
            fontSize: '0.95rem',
            color: subTab === 'atenciones' ? 'var(--primary)' : 'var(--sidebar-text)',
            borderBottom: subTab === 'atenciones' ? '3px solid var(--primary)' : 'none',
            fontWeight: subTab === 'atenciones' ? '800' : '700'
          }}
        >
          <i className="fa-solid fa-headset"></i> Atenciones Diarias
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tiempos')}
          style={{
            background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
            fontSize: '0.95rem',
            color: subTab === 'tiempos' ? 'var(--primary)' : 'var(--sidebar-text)',
            borderBottom: subTab === 'tiempos' ? '3px solid var(--primary)' : 'none',
            fontWeight: subTab === 'tiempos' ? '800' : '700'
          }}
        >
          <i className="fa-solid fa-clock"></i> Tiempos y Rendimiento
        </button>
      </div>

      {/* Main Loader */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: '25px' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '15px', color: 'var(--sidebar-text)', fontWeight: '600' }}>Cargando métricas del período...</p>
        </div>
      )}

      {/* Dashboard Sub-tab panels */}
      {!loading && (
        <div style={{ marginBottom: '25px' }}>
          {/* 1. VISITAS SUBTAB */}
          {subTab === 'visitas' && dataVisitas && (
            <div>
              {/* KPIs Grid */}
              <div className="metric-kpi-grid">
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                    <i className="fa-solid fa-wrench"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataVisitas.kpis?.total_visitas || 0}</h3>
                    <p>Total Visitas</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataVisitas.kpis?.tasa_efectividad || 0}%</h3>
                    <p>Efectividad</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    <i className="fa-solid fa-clock"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataVisitas.kpis?.tiempo_promedio || 0} min</h3>
                    <p>Duración Promedio</p>
                  </div>
                </div>
              </div>

              {/* Charts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* States donut */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-chart-pie" style={{ color: '#64748b', marginRight: '8px' }}></i> Estados de Visitas
                    </h4>
                    <div style={{ position: 'relative', height: '180px', flex: 1 }}>
                      <canvas ref={canvasEstadosRef} id="chartEstados"></canvas>
                    </div>
                  </div>
                  {/* Top Critical Clients */}
                  <div className="card" style={{ padding: '20px', flex: 1.2 }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span><i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', marginRight: '8px' }}></i> Clientes Críticos (Top 3)</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(!dataVisitas.top_clientes || dataVisitas.top_clientes.length === 0) ? (
                        <p style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '15px 0', fontStyle: 'italic' }}>No hay clientes registrados en este periodo.</p>
                      ) : (
                        dataVisitas.top_clientes.map((c, idx) => (
                          <div className="top-client-item" key={idx} style={{ borderLeftColor: idx === 0 ? '#ef4444' : idx === 1 ? '#f59e0b' : '#3b82f6', background: 'var(--profile-bg)', borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                            <div>
                              <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 700 }}>{c.cliente}</h5>
                              <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>Contrato: #{c.contrato}</span>
                            </div>
                            <span style={{ background: idx === 0 ? '#fee2e2' : idx === 1 ? '#fef3c7' : '#dbeafe', color: idx === 0 ? '#b91c1c' : idx === 1 ? '#b45309' : '#1e40af', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {c.total_visitas} visitas
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Evolution */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-chart-line" style={{ color: '#dc2626', marginRight: '8px' }}></i> Evolución de Visitas (Semanas)
                    </h4>
                    <div style={{ position: 'relative', height: '160px', flex: 1 }}>
                      <canvas ref={canvasEvolucionRef} id="chartEvolucionGlobal"></canvas>
                    </div>
                  </div>
                  {/* Issues */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-list-check" style={{ color: '#0f172a', marginRight: '8px' }}></i> Problemas más Comunes
                    </h4>
                    <div style={{ position: 'relative', height: '160px', flex: 1 }}>
                      <canvas ref={canvasProblemasRef} id="chartProblemasComunes"></canvas>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ATENCIONES SUBTAB */}
          {subTab === 'atenciones' && dataAtenciones && (
            <div>
              {/* KPIs Grid */}
              <div className="metric-kpi-grid">
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                    <i className="fa-solid fa-headset"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataAtenciones.kpis?.total_atenciones || 0}</h3>
                    <p>Total Atenciones</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <i className="fa-solid fa-circle-info"></i>
                  </div>
                  <div className="metric-kpi-info" style={{ maxWidth: '170px', overflow: 'hidden' }}>
                    <h3 style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }} title={dataAtenciones.kpis?.motivo_principal || '-'}>
                      {dataAtenciones.kpis?.motivo_principal || '-'}
                    </h3>
                    <p>Motivo Principal</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    <i className="fa-solid fa-comments"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>
                      {(() => {
                        let maxCanal = '-';
                        let maxVal = 0;
                        if (dataAtenciones.medios) {
                          for (const [k, v] of Object.entries(dataAtenciones.medios)) {
                            if (v > maxVal) { maxVal = v; maxCanal = k; }
                          }
                        }
                        return maxCanal;
                      })()}
                    </h3>
                    <p>Canal Principal</p>
                  </div>
                </div>
              </div>

              {/* Charts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Channels donut */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-comments" style={{ marginRight: '8px' }}></i> Canales de Atención
                    </h4>
                    <div style={{ position: 'relative', height: '180px', flex: 1 }}>
                      <canvas ref={canvasCanalesRef} id="chartCanales"></canvas>
                    </div>
                  </div>
                  {/* Motivos list/bar */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-list-check" style={{ marginRight: '8px' }}></i> Motivos de Consulta
                    </h4>
                    <div style={{ position: 'relative', height: '180px', flex: 1 }}>
                      <canvas ref={canvasAtenMotivosRef} id="chartAtenMotivos"></canvas>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Evolution */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-chart-line" style={{ color: '#6366f1', marginRight: '8px' }}></i> Evolución de Atenciones
                    </h4>
                    <div style={{ position: 'relative', height: '160px', flex: 1 }}>
                      <canvas ref={canvasAtenEvolucionRef} id="chartAtenEvolucion"></canvas>
                    </div>
                  </div>
                  {/* Solicitudes */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-headset" style={{ marginRight: '8px' }}></i> Tipos de Solicitud
                    </h4>
                    <div style={{ position: 'relative', height: '160px', flex: 1 }}>
                      <canvas ref={canvasAtenSolicitudesRef} id="chartAtenSolicitudes"></canvas>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. TIEMPOS SUBTAB */}
          {subTab === 'tiempos' && dataTiempos && (
            <div>
              {/* KPIs Grid */}
              <div className="metric-kpi-grid">
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    <i className="fa-solid fa-car"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataTiempos.kpis?.avg_traslado || 0} min</h3>
                    <p>Traslado Promedio</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <i className="fa-solid fa-screwdriver-wrench"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataTiempos.kpis?.avg_resolucion || 0} min</h3>
                    <p>Resolución Promedio</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                    <i className="fa-solid fa-clock"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataTiempos.kpis?.avg_total || 0} min</h3>
                    <p>Tiempo Total Promedio</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataTiempos.kpis?.tasa_efectividad || 0}%</h3>
                    <p>Cumplimiento Estimado</p>
                  </div>
                </div>
              </div>

              {/* Charts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: tecnico === 'TODOS' ? '1.3fr 1fr' : '1fr', gap: '20px', marginBottom: '25px' }}>
                {tecnico === 'TODOS' && (
                  <div className="card" id="card-grafico-tecnicos" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fa-solid fa-users" style={{ marginRight: '8px' }}></i> Comparativa de Tiempos por Técnico (Minutos)
                    </h4>
                    <div style={{ position: 'relative', height: '220px', flex: 1 }}>
                      <canvas ref={canvasComparativaTiemposRef} id="chartComparativaTiempos"></canvas>
                    </div>
                  </div>
                )}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="fa-solid fa-screwdriver-wrench" style={{ marginRight: '8px' }}></i> Tiempos en Sitio por Trabajo
                  </h4>
                  <div style={{ position: 'relative', height: '220px', flex: 1 }}>
                    <canvas ref={canvasTiemposProblemaRef} id="chartTiemposProblema"></canvas>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '20px', marginBottom: '25px', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <i className="fa-solid fa-chart-line" style={{ marginRight: '8px' }}></i> Evolución Temporal de Tiempos (Minutos)
                </h4>
                <div style={{ position: 'relative', height: '180px', flex: 1 }}>
                  <canvas ref={canvasEvolucionTiemposRef} id="chartEvolucionTiempos"></canvas>
                </div>
              </div>

              {/* Bitácora Table */}
              <div className="card" style={{ padding: '25px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: 'var(--text-main)', fontWeight: 800 }}>
                  <i className="fa-solid fa-table-list" style={{ color: 'var(--primary)', marginRight: '8px' }}></i> Bitácora de Tiempos
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="historial-reciente-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Técnico</th>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Traslado</th>
                        <th>Resolución</th>
                        <th>Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!dataTiempos.bitacora || dataTiempos.bitacora.length === 0) ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '20px 0' }}>No hay registros de traslados en este período.</td>
                        </tr>
                      ) : (
                        dataTiempos.bitacora.map((b, idx) => {
                          const trasladoVal = b.tiempo_traslado != null ? `${b.tiempo_traslado} min` : '-';
                          const resolucionVal = b.tiempo_resolucion != null ? `${b.tiempo_resolucion} min` : '-';
                          const totalVal = (b.tiempo_traslado != null || b.tiempo_resolucion != null)
                            ? `${(b.tiempo_traslado || 0) + (b.tiempo_resolucion || 0)} min`
                            : '-';
                          const fechaVal = b.hora_inicio ? b.hora_inicio.substring(0, 10) : b.hora_en_ruta ? b.hora_en_ruta.substring(0, 10) : '-';

                          return (
                            <tr key={idx}>
                              <td>{fechaVal}</td>
                              <td style={{ fontWeight: 'bold' }}>{b.tecnico}</td>
                              <td>#{b.contrato}</td>
                              <td>{b.cliente}</td>
                              <td>{trasladoVal}</td>
                              <td>{resolucionVal}</td>
                              <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{totalVal}</td>
                              <td>
                                <span className={`badge ${b.estado === 'FINALIZADA' ? 'finalizada' : 'pendiente'}`} style={{ fontSize: '0.72rem' }}>
                                  {b.estado === 'FINALIZADA' ? 'Efectiva' : b.estado}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buscador de Auditoría */}
      <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '25px', marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700 }}><i className="fa-solid fa-magnifying-glass" style={{ marginRight: '8px', color: 'var(--primary)' }}></i> Auditoría por Contrato</h4>
        <form onSubmit={handleAuditSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)' }}>Desde:</label>
            <input
              type="date"
              value={auditDesde}
              onChange={(e) => setAuditDesde(e.target.value)}
              className="form-control"
              style={{ padding: '10px', width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-color)' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)' }}>Hasta:</label>
            <input
              type="date"
              value={auditHasta}
              onChange={(e) => setAuditHasta(e.target.value)}
              className="form-control"
              style={{ padding: '10px', width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-color)' }}
            />
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)' }}>Número de Contrato:</label>
            <input
              type="text"
              value={contratoAudit}
              onChange={(e) => setContratoAudit(e.target.value)}
              placeholder="Ej. 7587"
              className="form-control"
              style={{ padding: '10px', width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-color)' }}
            />
          </div>
          <button type="submit" className="btn" style={{ padding: '10px 25px', height: '45px', flex: '0 0 auto', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>
            <i className="fa-solid fa-search"></i> Buscar
          </button>
        </form>
      </div>

      {/* Historial de Auditoría de Contrato (Timeline) */}
      {auditResults && (
        <div id="resultados-auditoria" className="card" style={{ padding: '30px', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignContent: 'center', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '20px', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
                  <i className="fa-solid fa-file-contract" style={{ color: 'var(--primary)' }}></i> Historial del Contrato
                </h3>
                <p id="auditoria-contrato-sub" style={{ margin: '5px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
                  Historial del contrato <strong id="contrato-id-tag">#{contratoAudit}</strong> para el cliente <strong id="contrato-cliente-tag">{auditResults.length > 0 ? auditResults[0].cliente : 'No encontrado'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handlePdfExport}
                disabled={loadingPdf}
                className="btn"
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem', height: '36px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', border: 'none' }}
              >
                <i className="fa-solid fa-file-pdf"></i> {loadingPdf ? 'Generando...' : 'Exportar PDF'}
              </button>
            </div>
            
            {/* KPI Rápido de contrato */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visitas VT</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {Array.isArray(auditResults) ? auditResults.filter(v => v.tipo_registro === 'visita_tecnica').length : 0}
                </div>
              </div>
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atenciones</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#6366f1' }}>
                  {Array.isArray(auditResults) ? auditResults.filter(v => v.tipo_registro === 'atencion').length : 0}
                </div>
              </div>
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Promedio</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#eab308' }}>
                  {(() => {
                    if (!Array.isArray(auditResults)) return '-';
                    const calificadas = auditResults.filter(v => v.tipo_registro === 'visita_tecnica' && v.calificacion_estrellas != null);
                    if (calificadas.length > 0) {
                      const prom = calificadas.reduce((acc, v) => acc + v.calificacion_estrellas, 0) / calificadas.length;
                      return `${prom.toFixed(1)} ⭐`;
                    }
                    return '-';
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline list */}
          <div className="timeline-container" id="timeline-auditoria">
            {filteredAudit.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>
                No se encontraron registros de este tipo para el contrato #{contratoAudit} en el período seleccionado.
              </div>
            ) : (
              filteredAudit.map((v, idx) => {
                if (v.tipo_registro === 'atencion') {
                  const dateFormatted = new Date(v.fecha_programada + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  
                  let contactIcon = 'fa-solid fa-comment-dots';
                  let contactColor = '#6366f1';
                  if (v.tecnico_apoyo) {
                    const c_med = v.tecnico_apoyo.toUpperCase();
                    if (c_med.includes('WHATSAPP') || c_med.includes('WPP')) {
                      contactIcon = 'fa-brands fa-whatsapp';
                      contactColor = '#10b981';
                    } else if (c_med.includes('TELEFONO') || c_med.includes('LLAMADA')) {
                      contactIcon = 'fa-solid fa-phone';
                      contactColor = '#3b82f6';
                    } else if (c_med.includes('OFICINA') || c_med.includes('PRESENCIAL')) {
                      contactIcon = 'fa-solid fa-building';
                      contactColor = '#f59e0b';
                    }
                  }

                  return (
                    <div className="timeline-item atencion" key={idx} style={{ borderLeftColor: contactColor }}>
                      <div className="timeline-badge" style={{ backgroundColor: contactColor, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={contactIcon} style={{ fontSize: '0.75rem', color: 'white' }}></i>
                      </div>
                      <div className="timeline-content" style={{ borderLeft: `4px solid ${contactColor}` }}>
                        <div className="timeline-header">
                          <span className="timeline-date"><i className="fa-regular fa-calendar" style={{ marginRight: '5px' }}></i> {dateFormatted} {v.hora ? ` a las ${v.hora.substring(0, 5)}` : ''}</span>
                          <span className="timeline-status" style={{ background: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px' }}>SOPORTE</span>
                        </div>
                        <div className="timeline-body">
                          <h5 className="timeline-problem"><i className="fa-solid fa-headset" style={{ color: contactColor, fontSize: '0.9rem', marginRight: '5px' }}></i> Soporte: {v.problema || 'Atención general'}</h5>
                          <div className="timeline-solution" style={{ borderLeftColor: contactColor }}>
                            <strong>Acción:</strong> {v.solucion_tecnico || 'Consulta / Información'}
                            {v.observacion_tecnico && <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>"{v.observacion_tecnico}"</p>}
                          </div>
                        </div>
                        <div className="timeline-footer">
                          <div className="timeline-techs">
                            <span className="tech-pill"><i className="fa-solid fa-user-check"></i> Agente: {v.tecnico_principal || 'Importado'}</span>
                            <span className="tech-pill"><i className="fa-solid fa-comments"></i> Vía: {v.tecnico_apoyo || 'WhatsApp'}</span>
                            {v.olt && <span className="tech-pill"><i className="fa-solid fa-network-wired"></i> OLT: {v.olt}</span>}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace' }}>ID: #AT-{v.id_visita}</span>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const dateFormatted = new Date(v.fecha_programada + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  const colorClass = v.estado === 'FINALIZADA' ? 'finalizada' : v.estado === 'REAGENDADA' ? 'reagendada' : v.estado === 'PENDIENTE' ? 'pendiente' : 'cancelada';
                  
                  let statusBadge = v.estado;
                  if (v.estado === 'FINALIZADA') statusBadge = 'Efectiva';
                  else if (v.estado === 'SOLVENTADA_REMOTA') statusBadge = 'Solventada Remota';
                  else if (v.estado === 'EN_RUTA') statusBadge = 'Técnico en Camino';
                  else if (v.estado === 'EN_PROGRESO') statusBadge = 'Trabajo en Progreso';

                  return (
                    <div className={`timeline-item ${colorClass}`} key={idx}>
                      <div className="timeline-badge" style={{ backgroundColor: v.estado === 'FINALIZADA' ? '#10b981' : v.estado === 'REAGENDADA' ? '#3b82f6' : v.estado === 'PENDIENTE' ? '#94a3b8' : '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fa-solid ${v.estado === 'FINALIZADA' ? 'fa-check' : v.estado === 'REAGENDADA' ? 'fa-clock' : v.estado === 'PENDIENTE' ? 'fa-hourglass-start' : 'fa-xmark'}`} style={{ fontSize: '0.75rem', color: 'white' }}></i>
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-date"><i className="fa-regular fa-calendar" style={{ marginRight: '5px' }}></i> {dateFormatted}</span>
                          <span className={`timeline-status ${colorClass}`}>{statusBadge}</span>
                        </div>
                        <div className="timeline-body">
                          <h5 className="timeline-problem"><i className="fa-solid fa-wrench" style={{ color: '#b91c1c', fontSize: '0.9rem', marginRight: '5px' }}></i> Visita: {v.problema}</h5>
                          {v.solucion_tecnico ? (
                            <div className="timeline-solution">
                              <strong>Solución Aplicada:</strong> {v.solucion_tecnico}
                              {v.observacion_tecnico && <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>"{v.observacion_tecnico}"</p>}
                            </div>
                          ) : (
                            <div className="timeline-solution" style={{ borderLeftColor: '#cbd5e1', background: 'var(--profile-bg)', color: 'var(--sidebar-text)' }}>
                              <em>Sin solución registrada (visita pendiente, reprogramada o cancelada).</em>
                            </div>
                          )}
                          
                          {v.calificacion_estrellas && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', background: '#fef9c3', padding: '6px 12px', borderRadius: '8px', width: 'fit-content', border: '1px solid #fef08a' }}>
                              <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '2px' }}>
                                {'★'.repeat(v.calificacion_estrellas)}{'☆'.repeat(5 - v.calificacion_estrellas)}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#854d0e', fontWeight: 600, fontStyle: 'italic' }}>
                                {v.calificacion_comentario ? `"${v.calificacion_comentario}"` : 'Calificado'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="timeline-footer">
                          <div className="timeline-techs">
                            <span className="tech-pill"><i className="fa-solid fa-user-tie"></i> Técnico: {v.tecnico_principal || 'Sin asignar'}</span>
                            {v.tecnico_apoyo && <span className="tech-pill"><i className="fa-solid fa-user-group"></i> Apoyo: {v.tecnico_apoyo}</span>}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace' }}>ID: #VT-{v.id_visita}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricasTab;
