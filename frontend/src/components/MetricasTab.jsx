import React, { useState, useEffect, useRef } from 'react';

function MetricasTab({ token, user }) {
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

  const role = user?.rol || user?.role || 'ASESOR';

  // State filters
  const [desde, setDesde] = useState(getThreeMonthsAgoIso());
  const [hasta, setHasta] = useState(getTodayIso());
  const [tecnico, setTecnico] = useState('TODOS');
  const [tecnicosList, setTecnicosList] = useState([]);
  const [tipoGraficaVisitas, setTipoGraficaVisitas] = useState('problemas'); // 'problemas' | 'soluciones'

  // Subtab navigation - Default to calidad-atc for SUPERVISOR_ATC
  const [subTab, setSubTab] = useState(() => {
    if (user?.rol === 'SUPERVISOR_ATC' || user?.role === 'SUPERVISOR_ATC') return 'calidad-atc';
    if (user?.rol === 'CALIDAD' || user?.role === 'CALIDAD') return 'tiempos';
    return 'visitas';
  }); // 'visitas', 'atenciones', 'tiempos', 'modernizacion', 'calidad-atc'

  // Call Center Advisor filter & data states
  const [asesorAtc, setAsesorAtc] = useState('TODOS');
  const [dataCalidadAtc, setDataCalidadAtc] = useState(null);

  // Quick Date Range Helper
  const handleQuickDate = (period) => {
    const now = new Date();
    if (period === 'este-mes') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDesde(formatLocalIso(start));
      setHasta(getTodayIso());
    } else if (period === 'mes-anterior') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setDesde(formatLocalIso(start));
      setHasta(formatLocalIso(end));
    } else if (period === '30-dias') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setDesde(formatLocalIso(start));
      setHasta(getTodayIso());
    } else if (period === '90-dias') {
      const start = new Date();
      start.setDate(start.getDate() - 90);
      setDesde(formatLocalIso(start));
      setHasta(getTodayIso());
    }
  };

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [exportingNodo, setExportingNodo] = useState(null);

  // Data states
  const [dataVisitas, setDataVisitas] = useState(null);
  const [dataAtenciones, setDataAtenciones] = useState(null);
  const [dataTiempos, setDataTiempos] = useState(null);
  const [dataModernizacion, setDataModernizacion] = useState(null);

  // Audit (Timeline) states
  const [contratoAudit, setContratoAudit] = useState('');
  const [auditDesde, setAuditDesde] = useState('');
  const [auditHasta, setAuditHasta] = useState('');
  const [auditResults, setAuditResults] = useState(null); // original array
  const [auditFiltroTipo, setAuditFiltroTipo] = useState('todos'); // 'todos', 'visitas', 'atenciones'

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

  const canvasModernizacionDoughnutRef = useRef(null);
  const canvasModernizacionBarrasRef = useRef(null);

  // Calidad ATC canvas refs
  const canvasAtcRankingRef = useRef(null);
  const canvasAtcRadarRef = useRef(null);
  const canvasAtcEvolucionRef = useRef(null);
  const canvasAtcContactRef = useRef(null);
  const canvasAtcAuditoresRef = useRef(null);

  // Fetch metrics data when filters change or subtab switches
  useEffect(() => {
    fetchMetrics();
  }, [desde, hasta, tecnico, subTab, asesorAtc]);

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
      } else if (subTab === 'modernizacion') {
        // Fetch Modernización de Equipos metrics
        const res = await fetch('/api/admin/metricas_equipos_modernizacion', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataM = await res.json();
        if (dataM.status === 'ok') {
          setDataModernizacion(dataM);
          setTimeout(() => {
            renderModernizacionCharts(dataM);
          }, 150);
        }
      } else if (subTab === 'calidad-atc') {
        // Fetch Calidad Call Center (Auditoría ATC) metrics
        const res = await fetch(`/api/atc/auditoria/metricas?fecha_inicio=${desde}&fecha_fin=${hasta}&asesor=${encodeURIComponent(asesorAtc)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataC = await res.json();
        if (dataC.status === 'ok') {
          setDataCalidadAtc(dataC);
          setTimeout(() => {
            renderCalidadAtcCharts(dataC);
          }, 150);
        }
      }
    } catch (e) {
      console.error("Error al cargar métricas:", e);
    } finally {
      setLoading(false);
    }
  };

  // Exportar listado de equipos obsoletos a Excel
  const handleExportarEquipos = async (ipNodo = '', nombreNodo = 'Toda la Red') => {
    setExportingNodo(ipNodo || 'GLOBAL');
    try {
      const url = `/api/admin/exportar_equipos_obsoletos?nodo=${encodeURIComponent(ipNodo)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Error al exportar listado");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanNombre = nombreNodo.replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `Campana_Cambio_Equipos_${cleanNombre}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error al exportar equipos obsoletos:", err);
      alert("Error al descargar el archivo Excel de campaña.");
    } finally {
      setExportingNodo(null);
    }
  };

  // Render Modernización de Equipos Charts
  const renderModernizacionCharts = (data) => {
    if (!window.Chart || !data) return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Doughnut: Homologados vs Obsoletos
    if (canvasModernizacionDoughnutRef.current && data.resumen_global) {
      const ctx = canvasModernizacionDoughnutRef.current.getContext('2d');
      chartsRef.current.modDoughnut = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Equipos Homologados (Vigentes)', 'Equipos Por Cambiar (Obsoletos)'],
          datasets: [{
            data: [
              data.resumen_global.homologados || 0,
              data.resumen_global.obsoletos || 0
            ],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 11 }, padding: 14 }
            }
          },
          cutout: '68%'
        }
      });
    }

    // 2. Bar Chart: Top 10 Modelos
    if (canvasModernizacionBarrasRef.current && data.modelos_top) {
      const ctx = canvasModernizacionBarrasRef.current.getContext('2d');
      const top10 = data.modelos_top.slice(0, 8);
      chartsRef.current.modBarras = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: top10.map(m => m.modelo),
          datasets: [{
            label: 'Cantidad de Equipos',
            data: top10.map(m => m.cantidad),
            backgroundColor: top10.map(m => m.tipo === 'HOMOLOGADO' ? '#10b981' : '#f59e0b'),
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 } } },
            y: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } } }
          }
        }
      });
    }
  };

  // Render Calidad Call Center (Auditoría ATC) Charts
  const renderCalidadAtcCharts = (data) => {
    if (!window.Chart || !data) return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const getShortName = (name = '') => {
      if (name.includes('Quezada') || name.includes('Guissella')) return 'Guissella Q.';
      if (name.includes('Mateo')) return 'Mateo S.';
      if (name.includes('Luis')) return 'Luis S.';
      return name.replace('CC. ', '');
    };

    // 1. Bar Chart: Ranking Comparativo Asesores (Notas y Volumen)
    if (canvasAtcRankingRef.current && Array.isArray(data.ranking_asesores)) {
      const ctx = canvasAtcRankingRef.current.getContext('2d');
      const asesores = data.ranking_asesores;
      chartsRef.current.atcRanking = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: asesores.map(a => getShortName(a.agente)),
          datasets: [
            {
              label: 'Nota Promedio (/10)',
              data: asesores.map(a => a.promedio_total || 0),
              backgroundColor: 'rgba(139, 92, 246, 0.85)',
              borderColor: '#8b5cf6',
              borderWidth: 1,
              borderRadius: 8,
              yAxisID: 'y'
            },
            {
              label: 'Llamadas Evaluadas',
              data: asesores.map(a => a.total_evaluadas || 0),
              backgroundColor: 'rgba(16, 185, 129, 0.75)',
              borderColor: '#10b981',
              borderWidth: 1,
              borderRadius: 8,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Inter', weight: 600 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (ctx.datasetIndex === 0) return ` Nota: ${ctx.raw} / 10`;
                  return ` Evaluadas: ${ctx.raw} llamadas`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: 'Inter', weight: 700 } }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              min: 0,
              max: 10,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
              title: { display: true, text: 'Nota Calidad', color: textColor, font: { size: 11, weight: 700 } }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
              title: { display: true, text: 'N° Evaluadas', color: textColor, font: { size: 11, weight: 700 } }
            }
          }
        }
      });
    }

    // 2. Radar Chart: Competencias P1 a P6 por Asesor
    if (canvasAtcRadarRef.current && Array.isArray(data.ranking_asesores)) {
      const ctx = canvasAtcRadarRef.current.getContext('2d');
      const radarLabels = ['P1 Claridad', 'P2 Amabilidad', 'P3 Rapidez', 'P4 Efectividad', 'P5 Satisfacción', 'P6 Facilidad'];
      
      const colors = [
        { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' },
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' }
      ];

      const datasets = data.ranking_asesores.map((a, idx) => {
        const c = colors[idx % colors.length];
        return {
          label: getShortName(a.agente),
          data: [
            a.p1_claridad || 0,
            a.p2_amabilidad || 0,
            a.p3_rapidez || 0,
            a.p4_efectividad || 0,
            a.p5_satisfaccion || 0,
            a.p6_facilidad || 0
          ],
          borderColor: c.border,
          backgroundColor: c.bg,
          borderWidth: 2,
          pointBackgroundColor: c.border,
          pointRadius: 3
        };
      });

      chartsRef.current.atcRadar = new window.Chart(ctx, {
        type: 'radar',
        data: {
          labels: radarLabels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 11 } }
            }
          },
          scales: {
            r: {
              min: 0,
              max: 10,
              ticks: { stepSize: 2, color: textColor, backdropColor: 'transparent', font: { size: 9 } },
              grid: { color: gridColor },
              angleLines: { color: gridColor },
              pointLabels: { color: textColor, font: { family: 'Inter', size: 11, weight: 700 } }
            }
          }
        }
      });
    }

    // 3. Line Chart: Evolución Temporal
    if (canvasAtcEvolucionRef.current && Array.isArray(data.evolucion_diaria)) {
      const ctx = canvasAtcEvolucionRef.current.getContext('2d');
      const evo = data.evolucion_diaria;
      chartsRef.current.atcEvolucion = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: evo.map(e => {
            const parts = e.fecha.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : e.fecha;
          }),
          datasets: [
            {
              label: 'Nota Promedio Diaria',
              data: evo.map(e => e.promedio_dia),
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              borderWidth: 2.5,
              tension: 0.3,
              fill: false,
              pointRadius: 3,
              pointHoverRadius: 6,
              yAxisID: 'y'
            },
            {
              label: 'Llamadas Auditadas',
              data: evo.map(e => e.total_evaluadas),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.25)',
              borderWidth: 1.5,
              fill: true,
              tension: 0.3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Inter', weight: 600 } }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
            },
            y: {
              type: 'linear',
              position: 'left',
              min: 0,
              max: 10,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
              title: { display: true, text: 'Nota Promedio', color: textColor, font: { size: 11, weight: 700 } }
            },
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
              title: { display: true, text: 'Auditadas', color: textColor, font: { size: 11, weight: 700 } }
            }
          }
        }
      });
    }

    // 4. Doughnut Chart: Contactabilidad
    if (canvasAtcContactRef.current && data.contactabilidad) {
      const ctx = canvasAtcContactRef.current.getContext('2d');
      const c = data.contactabilidad;
      chartsRef.current.atcContact = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Contestó (Auditada)', 'No Contesta', 'No Auditar (Descarte)', 'Equivocado / Fuera Serv.', 'Pendientes'],
          datasets: [{
            data: [
              c.contestaron || 0,
              c.no_contestaron || 0,
              c.no_auditadas || 0,
              (c.equivocados || 0) + (c.fuera_servicio || 0),
              c.pendientes || 0
            ],
            backgroundColor: ['#10b981', '#f59e0b', '#64748b', '#ef4444', '#cbd5e1'],
            borderWidth: isDark ? 2 : 1,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 11 }, padding: 10 }
            }
          },
          cutout: '62%'
        }
      });
    }

    // 5. Bar Chart: Productividad Auditoras ATC (Andrea vs Jennifer)
    if (canvasAtcAuditoresRef.current && Array.isArray(data.ranking_auditores)) {
      const ctx = canvasAtcAuditoresRef.current.getContext('2d');
      const auditores = data.ranking_auditores;
      chartsRef.current.atcAuditores = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: auditores.map(a => a.auditor || 'Sin Asignar'),
          datasets: [
            {
              label: 'Auditadas (Contestó)',
              data: auditores.map(a => a.contestadas || 0),
              backgroundColor: '#8b5cf6',
              borderRadius: 6
            },
            {
              label: 'No Contestó / Descarte',
              data: auditores.map(a => (a.no_contestadas || 0) + (a.no_auditadas || 0)),
              backgroundColor: '#94a3b8',
              borderRadius: 6
            },
            {
              label: 'Pendientes',
              data: auditores.map(a => a.pendientes || 0),
              backgroundColor: '#cbd5e1',
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
              labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 11 } }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: 'Inter', weight: 700 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter' } }
            }
          }
        }
      });
    }
  };
  const renderProblemasSolucionesChart = (data, tipo = tipoGraficaVisitas) => {
    if (!window.Chart || !canvasProblemasRef.current || !data) return;
    if (chartsRef.current.problemas) {
      chartsRef.current.problemas.destroy();
      delete chartsRef.current.problemas;
    }

    const ctx = canvasProblemasRef.current.getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const isSol = tipo === 'soluciones';
    const items = isSol ? (data.soluciones || data.top_soluciones || []) : (data.problemas || data.top_problemas || []);
    const labels = items.map(p => isSol ? (p.solucion || p.motivo || 'Sin especificar') : (p.problema || p.motivo || 'Sin especificar'));
    const counts = items.map(p => p.cantidad || 0);

    chartsRef.current.problemas = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: isSol ? '#0284c7' : '#ef4444',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.parsed.y} visitas (${isSol ? 'Solución' : 'Problema'})`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 9 }, maxRotation: 25, minRotation: 0 } },
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 9 }, precision: 0 } }
        }
      }
    });
  };

  const handleCambiarTipoGrafica = (nuevoTipo) => {
    setTipoGraficaVisitas(nuevoTipo);
    if (dataVisitas) {
      renderProblemasSolucionesChart(dataVisitas, nuevoTipo);
    }
  };

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
              data: evolucion.map(e => (e.completadas !== undefined ? e.completadas : (e.cantidad || 0))),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3
            },
            {
              label: 'Total Visitas',
              data: evolucion.map(e => (e.total !== undefined ? e.total : (e.cantidad || 0))),
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

    // 3. Problemas / Soluciones Comunes
    renderProblemasSolucionesChart(data, tipoGraficaVisitas);
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
            data: evolucion.map(e => (e.total !== undefined ? e.total : (e.cantidad || 0))),
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

  // Filter audit timeline based on local filter type (independent of top charts)
  const getFilteredAudit = () => {
    if (!Array.isArray(auditResults)) return [];
    let items = auditResults.filter(v => v.tipo_registro !== 'meta');

    // Ordenar cronológicamente (más reciente primero)
    items.sort((a, b) => {
      const fechaA = (a.fecha_programada || '') + ' ' + (a.hora || '00:00:00');
      const fechaB = (b.fecha_programada || '') + ' ' + (b.hora || '00:00:00');
      return fechaB.localeCompare(fechaA);
    });

    if (auditFiltroTipo === 'visitas') {
      return items.filter(v => v.tipo_registro === 'visita_tecnica');
    }
    if (auditFiltroTipo === 'atenciones') {
      return items.filter(v => v.tipo_registro === 'atencion');
    }
    return items;
  };

  const filteredAudit = getFilteredAudit();
  const totalAuditItems = Array.isArray(auditResults) ? auditResults.filter(v => v.tipo_registro !== 'meta').length : 0;
  const countVisitas = Array.isArray(auditResults) ? auditResults.filter(v => v.tipo_registro === 'visita_tecnica').length : 0;
  const countAtenciones = Array.isArray(auditResults) ? auditResults.filter(v => v.tipo_registro === 'atencion').length : 0;

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

        {/* Conditional Filter: Call Center Asesor for calidad-atc, Técnico for other subtabs */}
        {subTab === 'calidad-atc' ? (
          <div style={{ flex: 1.5, minWidth: '220px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)', display: 'block', marginBottom: '6px' }}>
              <i className="fa-solid fa-headset" style={{ color: '#8b5cf6', marginRight: '5px' }}></i> Asesor Call Center:
            </label>
            <select
              value={asesorAtc}
              onChange={(e) => setAsesorAtc(e.target.value)}
              className="form-control"
              style={{ padding: '10px', width: '100%', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
            >
              <option value="TODOS">👥 Todos los Asesores Call Center</option>
              <option value="CC. Mateo Samaniego">👨‍💼 CC. Mateo Samaniego</option>
              <option value="CC. Guissella Quezada">👩‍💼 CC. Guissella Quezada</option>
              <option value="CC. Luis Saenz">👨‍💼 CC. Luis Saenz</option>
            </select>
          </div>
        ) : (
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
        )}

        {/* Quick Date Pills */}
        <div style={{ width: '100%', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', marginRight: '5px' }}>
            <i className="fa-solid fa-bolt" style={{ color: '#f59e0b', marginRight: '4px' }}></i> Atajos de Fecha:
          </span>
          <button
            type="button"
            onClick={() => handleQuickDate('este-mes')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)', color: 'var(--text-main)', transition: 'all 0.15s'
            }}
          >
            📅 Este Mes
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('mes-anterior')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)', color: 'var(--text-main)', transition: 'all 0.15s'
            }}
          >
            ⏮️ Mes Anterior
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('30-dias')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)', color: 'var(--text-main)', transition: 'all 0.15s'
            }}
          >
            ⚡ Últimos 30 días
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('90-dias')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)', color: 'var(--text-main)', transition: 'all 0.15s'
            }}
          >
            🗓️ Últimos 90 días
          </button>
        </div>
      </div>

      {/* Sub-tabs bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {['ADMIN', 'SUPERVISOR_ATC'].includes(role) && (
          <button
            type="button"
            onClick={() => setSubTab('calidad-atc')}
            style={{
              background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
              fontSize: '0.95rem',
              color: subTab === 'calidad-atc' ? '#8b5cf6' : 'var(--sidebar-text)',
              borderBottom: subTab === 'calidad-atc' ? '3px solid #8b5cf6' : 'none',
              fontWeight: subTab === 'calidad-atc' ? '800' : '700'
            }}
          >
            <i className="fa-solid fa-star" style={{ color: '#8b5cf6' }}></i> Calidad Call Center
          </button>
        )}
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
        <button
          type="button"
          onClick={() => setSubTab('modernizacion')}
          style={{
            background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
            fontSize: '0.95rem',
            color: subTab === 'modernizacion' ? '#e11d48' : 'var(--sidebar-text)',
            borderBottom: subTab === 'modernizacion' ? '3px solid #e11d48' : 'none',
            fontWeight: subTab === 'modernizacion' ? '800' : '700'
          }}
        >
          <i className="fa-solid fa-microchip"></i> Plan Modernización de Equipos
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
                  {/* Issues & Solutions Toggle Card */}
                  <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className={tipoGraficaVisitas === 'soluciones' ? "fa-solid fa-screwdriver-wrench" : "fa-solid fa-list-check"} style={{ color: tipoGraficaVisitas === 'soluciones' ? '#0284c7' : '#ef4444' }}></i>
                        {tipoGraficaVisitas === 'soluciones' ? 'Soluciones más Comunes' : 'Problemas más Comunes'}
                      </h4>
                      {/* Switch Problemas / Soluciones */}
                      <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.06)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-color)' }}>
                        <button
                          type="button"
                          onClick={() => handleCambiarTipoGrafica('problemas')}
                          style={{
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '7px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: tipoGraficaVisitas === 'problemas' ? 'var(--card-bg)' : 'transparent',
                            color: tipoGraficaVisitas === 'problemas' ? '#ef4444' : 'var(--sidebar-text)',
                            boxShadow: tipoGraficaVisitas === 'problemas' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          📋 Problemas
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCambiarTipoGrafica('soluciones')}
                          style={{
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '7px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: tipoGraficaVisitas === 'soluciones' ? 'var(--card-bg)' : 'transparent',
                            color: tipoGraficaVisitas === 'soluciones' ? '#0284c7' : 'var(--sidebar-text)',
                            boxShadow: tipoGraficaVisitas === 'soluciones' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          🛠️ Soluciones
                        </button>
                      </div>
                    </div>
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

          {/* 4. PLAN DE MODERNIZACION SUBTAB */}
          {subTab === 'modernizacion' && dataModernizacion && (
            <div>
              {/* Hero Header & Progress */}
              <div className="card" style={{ padding: '25px', marginBottom: '25px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(225, 29, 72, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: '#e11d48', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.85rem' }}>PLAN RENOVE</span>
                      🚀 Avance de Modernización Tecnológica en Red
                    </h3>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.85rem' }}>
                      Meta de estandarización a Wi-Fi 6 Gigabit (TP-Link EX511, XX530v, XX231v y Huawei AX3).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportarEquipos('', 'Toda_la_Red')}
                    disabled={exportingNodo !== null}
                    style={{
                      background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
                      fontSize: '0.88rem'
                    }}
                  >
                    <i className="fa-solid fa-file-excel"></i>
                    {exportingNodo === 'GLOBAL' ? 'Generando Excel...' : 'Descargar Lista General de Campaña'}
                  </button>
                </div>

                {/* Progress Bar */}
                <div style={{ background: 'var(--profile-bg)', borderRadius: '12px', padding: '15px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                    <span style={{ color: '#10b981' }}>🟢 {dataModernizacion.resumen_global?.homologados || 0} Equipos Vigentes ({dataModernizacion.resumen_global?.porcentaje_homologados || 0}%)</span>
                    <span style={{ color: '#ef4444' }}>🔴 {dataModernizacion.resumen_global?.obsoletos || 0} Pendientes por Cambiar ({dataModernizacion.resumen_global?.porcentaje_obsoletos || 0}%)</span>
                  </div>
                  <div style={{ height: '14px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                    <div
                      style={{
                        width: `${dataModernizacion.resumen_global?.porcentaje_homologados || 0}%`,
                        background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                        borderRadius: '10px',
                        transition: 'width 0.8s ease-in-out'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* KPIs Grid */}
              <div className="metric-kpi-grid" style={{ marginBottom: '25px' }}>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: '#10b981' }}>{dataModernizacion.resumen_global?.homologados || 0}</h3>
                    <p>Equipos Homologados (Vigentes)</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: '#ef4444' }}>{dataModernizacion.resumen_global?.obsoletos || 0}</h3>
                    <p>Equipos por Reemplazar (Legacy)</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                    <i className="fa-solid fa-users"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: 'var(--text-main)' }}>{dataModernizacion.resumen_global?.total_clientes || 0}</h3>
                    <p>Total Clientes Activos Auditados</p>
                  </div>
                </div>
                <div className="metric-kpi-card">
                  <div className="metric-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <i className="fa-solid fa-chart-pie"></i>
                  </div>
                  <div className="metric-kpi-info">
                    <h3 style={{ color: '#f59e0b' }}>{dataModernizacion.resumen_global?.porcentaje_homologados || 0}%</h3>
                    <p>Índice Global de Modernización</p>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="fa-solid fa-chart-pie" style={{ marginRight: '8px' }}></i> Proporción de Equipos en Red
                  </h4>
                  <div style={{ position: 'relative', height: '230px', flex: 1 }}>
                    <canvas ref={canvasModernizacionDoughnutRef} id="chartModDoughnut"></canvas>
                  </div>
                </div>
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="fa-solid fa-server" style={{ marginRight: '8px' }}></i> Top Modelos de Routers Instalados
                  </h4>
                  <div style={{ position: 'relative', height: '230px', flex: 1 }}>
                    <canvas ref={canvasModernizacionBarrasRef} id="chartModBarras"></canvas>
                  </div>
                </div>
              </div>

              {/* Table per Node */}
              <div className="card" style={{ padding: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 800 }}>
                    <i className="fa-solid fa-network-wired" style={{ color: 'var(--primary)', marginRight: '8px' }}></i> Control y Avance de Modernización por Nodo / OLT
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Mostrando todos los nodos principales con IP Maestra
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="historial-reciente-table">
                    <thead>
                      <tr>
                        <th>Nodo / Sector</th>
                        <th>IP Maestra</th>
                        <th style={{ textAlign: 'center' }}>Total Clientes</th>
                        <th style={{ textAlign: 'center', color: '#10b981' }}>🟢 Vigentes</th>
                        <th style={{ textAlign: 'center', color: '#ef4444' }}>🔴 Por Cambiar</th>
                        <th style={{ width: '220px' }}>% Avance</th>
                        <th style={{ textAlign: 'center' }}>Acción de Campaña</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!dataModernizacion.nodos || dataModernizacion.nodos.length === 0) ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '20px 0' }}>No se encontraron registros de nodos.</td>
                        </tr>
                      ) : (
                        dataModernizacion.nodos.map((n, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                              🏢 {n.nodo}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', background: 'var(--profile-bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                {n.ip_nodo}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{n.total}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981' }}>{n.homologados}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#ef4444' }}>{n.obsoletos}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ flex: 1, height: '8px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${n.porcentaje}%`,
                                      height: '100%',
                                      background: n.porcentaje > 70 ? '#10b981' : n.porcentaje > 40 ? '#f59e0b' : '#ef4444',
                                      borderRadius: '6px'
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '40px' }}>{n.porcentaje}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleExportarEquipos(n.ip_nodo, n.nodo)}
                                disabled={exportingNodo !== null}
                                style={{
                                  background: 'rgba(2, 132, 199, 0.1)',
                                  color: '#0284c7',
                                  border: '1px solid rgba(2, 132, 199, 0.3)',
                                  padding: '5px 12px',
                                  borderRadius: '8px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <i className="fa-solid fa-download"></i>
                                {exportingNodo === n.ip_nodo ? 'Descargando...' : 'Descargar Lista'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. CALIDAD CALL CENTER (AUDITORÍA ATC) SUBTAB */}
          {subTab === 'calidad-atc' && (
            <div>
              {!dataCalidadAtc ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: '#8b5cf6', marginBottom: '15px' }}></i>
                  <h4 style={{ color: 'var(--text-main)', margin: '0 0 8px 0', fontWeight: 800 }}>Cargando Panel de Calidad Call Center...</h4>
                  <p style={{ color: 'var(--sidebar-text)', margin: 0, fontSize: '0.9rem' }}>Obteniendo métricas de auditoría para Mateo Samaniego, Guissella Quezada y Luis Saenz.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  {/* Executive Header Banner */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.06) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    padding: '24px 28px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1.4rem',
                        boxShadow: '0 8px 20px rgba(139, 92, 246, 0.35)'
                      }}>
                        <i className="fa-solid fa-star"></i>
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                          Control Ejecutivo de Calidad - Call Center
                        </h2>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.88rem', fontWeight: 600 }}>
                          Evaluaciones de calidad realizadas por ATC (Andrea & Jennifer) a las llamadas de Mateo Samaniego, Guissella Quezada y Luis Saenz.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: '#8b5cf6',
                        padding: '6px 14px',
                        borderRadius: '12px',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        border: '1px solid rgba(139, 92, 246, 0.3)'
                      }}>
                        <i className="fa-solid fa-filter" style={{ marginRight: '6px' }}></i>
                        {asesorAtc === 'TODOS' ? 'Todos los Asesores' : asesorAtc.replace('CC. ', '')}
                      </span>
                      <span style={{
                        background: 'var(--card-bg)',
                        color: 'var(--sidebar-text)',
                        padding: '6px 14px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        border: '1px solid var(--border-color)'
                      }}>
                        <i className="fa-regular fa-calendar-days" style={{ marginRight: '6px' }}></i>
                        {desde} al {hasta}
                      </span>
                    </div>
                  </div>

                  {/* Top 4 KPI Cards */}
                  {(() => {
                    const c = dataCalidadAtc.contactabilidad || {};
                    const p = dataCalidadAtc.promedios_preguntas || {};
                    const ranking = dataCalidadAtc.ranking_asesores || [];
                    const top = ranking.find(a => (a.promedio_total || 0) > 0) || ranking[0];

                    let notaBadgeColor = '#10b981';
                    let notaBadgeText = 'Excelente';
                    if (p.promedio_global < 7.0) {
                      notaBadgeColor = '#ef4444';
                      notaBadgeText = 'En Seguimiento';
                    } else if (p.promedio_global < 8.5) {
                      notaBadgeColor = '#f59e0b';
                      notaBadgeText = 'Satisfactorio';
                    }

                    return (
                      <div className="metric-kpi-grid">
                        {/* KPI 1: Total Evaluadas */}
                        <div className="metric-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
                          <div className="metric-kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                            <i className="fa-solid fa-phone-volume"></i>
                          </div>
                          <div className="metric-kpi-info">
                            <h3 style={{ color: 'var(--text-main)' }}>{c.contestaron || 0}</h3>
                            <p>Llamadas Auditadas</p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                              De {c.total_asignadas || 0} asignadas · {c.pendientes || 0} pendientes
                            </span>
                          </div>
                        </div>

                        {/* KPI 2: Contactabilidad */}
                        <div className="metric-kpi-card" style={{ borderLeft: '4px solid #0284c7' }}>
                          <div className="metric-kpi-icon" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
                            <i className="fa-solid fa-signal"></i>
                          </div>
                          <div className="metric-kpi-info">
                            <h3 style={{ color: 'var(--text-main)' }}>{c.pct_contestaron || 0}%</h3>
                            <p>Tasa de Contacto</p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                              {c.no_contestaron || 0} no contesta · {c.no_auditadas || 0} descartadas
                            </span>
                          </div>
                        </div>

                        {/* KPI 3: Calificación Global */}
                        <div className="metric-kpi-card" style={{ borderLeft: `4px solid ${notaBadgeColor}` }}>
                          <div className="metric-kpi-icon" style={{ background: `${notaBadgeColor}1a`, color: notaBadgeColor }}>
                            <i className="fa-solid fa-star"></i>
                          </div>
                          <div className="metric-kpi-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h3 style={{ color: 'var(--text-main)', margin: 0 }}>
                                {p.promedio_global ? p.promedio_global.toFixed(2) : '0.00'}
                              </h3>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: `${notaBadgeColor}20`,
                                color: notaBadgeColor
                              }}>
                                {notaBadgeText}
                              </span>
                            </div>
                            <p>Nota Promedio Calidad</p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                              Basado en {p.total_calificadas || 0} auditorías completas (/10)
                            </span>
                          </div>
                        </div>

                        {/* KPI 4: Asesor Destacado */}
                        <div className="metric-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                          <div className="metric-kpi-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                            <i className="fa-solid fa-crown"></i>
                          </div>
                          <div className="metric-kpi-info">
                            <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {top ? top.agente.replace('CC. ', '') : 'Sin datos'}
                            </h3>
                            <p>Asesor Destacado</p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                              {top?.promedio_total ? `Promedio: ${top.promedio_total} / 10 (${top.total_evaluadas} eval.)` : 'Pendiente de calificación'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Micro-KPI Strip: 6 Quality Dimensions (P1 a P6) */}
                  {dataCalidadAtc.promedios_preguntas && (
                    <div className="card" style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <i className="fa-solid fa-sliders" style={{ color: '#8b5cf6', marginRight: '8px' }}></i>
                          Desglose por Competencia Evaluada (Escala 1 a 10)
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                          Promedios consolidados del período
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
                        {[
                          { key: 'p1_claridad', label: 'P1. Claridad', icon: 'fa-comment-dots', color: '#3b82f6' },
                          { key: 'p2_amabilidad', label: 'P2. Amabilidad', icon: 'fa-heart', color: '#ec4899' },
                          { key: 'p3_rapidez', label: 'P3. Rapidez', icon: 'fa-bolt', color: '#f59e0b' },
                          { key: 'p4_efectividad', label: 'P4. Efectividad', icon: 'fa-circle-check', color: '#10b981' },
                          { key: 'p5_satisfaccion', label: 'P5. Satisfacción', icon: 'fa-face-smile', color: '#8b5cf6' },
                          { key: 'p6_facilidad', label: 'P6. Facilidad (CES)', icon: 'fa-thumbs-up', color: '#06b6d4' }
                        ].map((dim, idx) => {
                          const val = dataCalidadAtc.promedios_preguntas[dim.key] || 0;
                          const pct = Math.min(100, Math.max(0, (val / 10) * 100));
                          return (
                            <div key={idx} style={{
                              background: 'var(--profile-bg)',
                              padding: '14px 16px',
                              borderRadius: '14px',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  <i className={`fa-solid ${dim.icon}`} style={{ color: dim.color, marginRight: '6px' }}></i>
                                  {dim.label}
                                </span>
                                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: dim.color }}>
                                  {val > 0 ? val.toFixed(1) : '-'}
                                </span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(148, 163, 184, 0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: dim.color, borderRadius: '6px', transition: 'width 0.4s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Row 1 Charts: Comparative Bar Chart & Radar Chart */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                    {/* Chart 1: Ranking Comparativo */}
                    <div className="card" style={{ padding: '22px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <i className="fa-solid fa-chart-column" style={{ color: '#8b5cf6', marginRight: '8px' }}></i>
                          Comparativa de Asesores (Nota /10 vs Volumen)
                        </h4>
                      </div>
                      <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                        <canvas ref={canvasAtcRankingRef} id="chartAtcRanking"></canvas>
                      </div>
                    </div>

                    {/* Chart 2: Radar de Competencias */}
                    <div className="card" style={{ padding: '22px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <i className="fa-solid fa-chart-line" style={{ color: '#ec4899', marginRight: '8px' }}></i>
                          Radar Multidimensional de Competencias
                        </h4>
                      </div>
                      <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                        <canvas ref={canvasAtcRadarRef} id="chartAtcRadar"></canvas>
                      </div>
                    </div>
                  </div>

                  {/* Row 2 Charts: Timeline Evolution & Contactability Doughnut */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                    {/* Chart 3: Evolución Temporal */}
                    <div className="card" style={{ padding: '22px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <i className="fa-solid fa-arrow-trend-up" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                          Evolución Temporal de Calidad y Volumen
                        </h4>
                        <span style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>Día a Día</span>
                      </div>
                      <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                        <canvas ref={canvasAtcEvolucionRef} id="chartAtcEvolucion"></canvas>
                      </div>
                    </div>

                    {/* Chart 4: Contactabilidad & Descarte */}
                    <div className="card" style={{ padding: '22px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <i className="fa-solid fa-chart-pie" style={{ color: '#10b981', marginRight: '8px' }}></i>
                          Distribución de Contactabilidad
                        </h4>
                      </div>
                      <div style={{ position: 'relative', height: '210px', width: '100%' }}>
                        <canvas ref={canvasAtcContactRef} id="chartAtcContact"></canvas>
                      </div>

                      {/* Motivos de Descarte (No Auditar) */}
                      {Array.isArray(dataCalidadAtc.motivos_no_auditar) && dataCalidadAtc.motivos_no_auditar.length > 0 && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Top Motivos de Descarte (No Auditar):
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {dataCalidadAtc.motivos_no_auditar.map((m, idx) => (
                              <span key={idx} style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'var(--profile-bg)',
                                color: 'var(--text-main)',
                                padding: '3px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}>
                                <span>{m.motivo}</span>
                                <strong style={{ color: '#ef4444' }}>{m.total}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Auditor Productivity & Score Satisfaction Semaphore */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                    {/* Auditor Productivity */}
                    <div className="card" style={{ padding: '22px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <i className="fa-solid fa-users-gear" style={{ color: '#8b5cf6', marginRight: '8px' }}></i>
                          Productividad de Auditoras ATC (Andrea vs Jennifer)
                        </h4>
                      </div>
                      <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                        <canvas ref={canvasAtcAuditoresRef} id="chartAtcAuditores"></canvas>
                      </div>
                    </div>

                    {/* Semáforo de Satisfacción de Clientes */}
                    {dataCalidadAtc.distribucion_notas && (
                      <div className="card" style={{ padding: '22px', background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <i className="fa-solid fa-traffic-light" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
                            Semáforo de Satisfacción del Cliente
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 16px', borderRadius: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981' }}>🌟 Sobresaliente</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>{dataCalidadAtc.distribucion_notas.sobresaliente || 0}</span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)' }}>Nota 9.0 a 10.0</span>
                            </div>

                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '12px 16px', borderRadius: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#3b82f6' }}>👍 Bueno</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#3b82f6' }}>{dataCalidadAtc.distribucion_notas.bueno || 0}</span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)' }}>Nota 7.0 a 8.9</span>
                            </div>

                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px 16px', borderRadius: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b' }}>⚠️ Regular</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b' }}>{dataCalidadAtc.distribucion_notas.regular || 0}</span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)' }}>Nota 5.0 a 6.9</span>
                            </div>

                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' }}>🚨 Crítico</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ef4444' }}>{dataCalidadAtc.distribucion_notas.critico || 0}</span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)' }}>Nota &lt; 5.0</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--profile-bg)', borderRadius: '12px', fontSize: '0.76rem', color: 'var(--sidebar-text)', lineHeight: 1.4 }}>
                          <i className="fa-solid fa-circle-info" style={{ color: '#8b5cf6', marginRight: '6px' }}></i>
                          Las calificaciones críticas &lt; 7.0 son notificadas automáticamente al supervisor para retroalimentación con el asesor de call center.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comprehensive Table: Ranking Asesores Call Center */}
                  <div className="card" style={{ background: 'var(--card-bg)', borderRadius: '18px', border: '1px solid var(--border-color)', padding: '22px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-ranking-star" style={{ color: '#8b5cf6' }}></i>
                        Ranking General de Calidad - Call Center
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                        Mostrando los 3 asesores auditados
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--profile-bg)', borderBottom: '2px solid var(--border-color)' }}>
                            <th style={{ padding: '12px 14px', textAlign: 'center', width: '50px' }}>#</th>
                            <th style={{ padding: '12px 14px', textAlign: 'left' }}>Asesor Call Center</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center' }}>Asignadas</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', color: '#10b981' }}>Auditadas</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', color: '#f59e0b' }}>No Contesta</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center' }}>% Contacto</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.76rem' }}>P1 Claridad</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.76rem' }}>P2 Amab.</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.76rem' }}>P3 Rapid.</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.76rem' }}>P4 Efect.</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.76rem' }}>P5 Sat.</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.76rem' }}>P6 Facil.</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900 }}>Nota Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!dataCalidadAtc.ranking_asesores || dataCalidadAtc.ranking_asesores.length === 0) ? (
                            <tr>
                              <td colSpan="13" style={{ textAlign: 'center', padding: '30px', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>
                                No se encontraron evaluaciones registradas para los filtros seleccionados.
                              </td>
                            </tr>
                          ) : (
                            dataCalidadAtc.ranking_asesores.map((a, idx) => {
                              const rankIcons = ['🥇', '🥈', '🥉'];
                              const prom = a.promedio_total;
                              let pillColor = '#10b981';
                              let pillBg = 'rgba(16, 185, 129, 0.15)';
                              if (!prom) {
                                pillColor = 'var(--sidebar-text)';
                                pillBg = 'var(--profile-bg)';
                              } else if (prom < 7.0) {
                                pillColor = '#ef4444';
                                pillBg = 'rgba(239, 68, 68, 0.15)';
                              } else if (prom < 8.5) {
                                pillColor = '#f59e0b';
                                pillBg = 'rgba(245, 158, 11, 0.15)';
                              }

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                                    {rankIcons[idx] || (idx + 1)}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: idx === 0 ? 'rgba(139, 92, 246, 0.18)' : idx === 1 ? 'rgba(59, 130, 246, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                                        color: idx === 0 ? '#8b5cf6' : idx === 1 ? '#3b82f6' : '#10b981',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 900,
                                        fontSize: '0.82rem'
                                      }}>
                                        {a.agente.includes('Quezada') ? 'GQ' : a.agente.includes('Mateo') ? 'MS' : 'LS'}
                                      </div>
                                      <span>
                                        {a.agente.replace('CC. ', '')}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{a.total_asignadas}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981' }}>{a.total_evaluadas}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>{a.no_contestadas}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{a.tasa_efectividad}%</td>
                                  <td style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>{a.p1_claridad ? a.p1_claridad.toFixed(1) : '-'}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>{a.p2_amabilidad ? a.p2_amabilidad.toFixed(1) : '-'}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>{a.p3_rapidez ? a.p3_rapidez.toFixed(1) : '-'}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>{a.p4_efectividad ? a.p4_efectividad.toFixed(1) : '-'}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>{a.p5_satisfaccion ? a.p5_satisfaccion.toFixed(1) : '-'}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>{a.p6_facilidad ? a.p6_facilidad.toFixed(1) : '-'}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '4px 12px',
                                      borderRadius: '12px',
                                      background: pillBg,
                                      color: pillColor,
                                      fontWeight: 900,
                                      fontSize: '0.88rem'
                                    }}>
                                      {prom ? `${prom.toFixed(2)} ⭐` : 'Sin Calificar'}
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
        </div>
      )}

      {/* Buscador de Auditoría */}
      <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '25px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '8px', color: 'var(--primary)' }}></i> Auditoría por Contrato
          </h4>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { setAuditDesde(''); setAuditHasta(''); }}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: (!auditDesde && !auditHasta) ? 'var(--primary)' : 'var(--profile-bg)',
                color: (!auditDesde && !auditHasta) ? '#fff' : 'var(--sidebar-text)',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-infinity"></i> Todo el Historial
            </button>
            <button
              type="button"
              onClick={() => { setAuditDesde(getThreeMonthsAgoIso()); setAuditHasta(getTodayIso()); }}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: (auditDesde && auditDesde === getThreeMonthsAgoIso()) ? 'var(--primary)' : 'var(--profile-bg)',
                color: (auditDesde && auditDesde === getThreeMonthsAgoIso()) ? '#fff' : 'var(--sidebar-text)',
                cursor: 'pointer'
              }}
            >
              Últimos 3 Meses
            </button>
            <button
              type="button"
              onClick={() => { setAuditDesde(`${new Date().getFullYear()}-01-01`); setAuditHasta(getTodayIso()); }}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: (auditDesde && auditDesde === `${new Date().getFullYear()}-01-01`) ? 'var(--primary)' : 'var(--profile-bg)',
                color: (auditDesde && auditDesde === `${new Date().getFullYear()}-01-01`) ? '#fff' : 'var(--sidebar-text)',
                cursor: 'pointer'
              }}
            >
              Este Año
            </button>
          </div>
        </div>
        <form onSubmit={handleAuditSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)' }}>
              Desde: <span style={{ fontWeight: 'normal', fontSize: '0.7rem', color: '#94a3b8' }}>(Opcional)</span>
            </label>
            <input
              type="date"
              value={auditDesde}
              onChange={(e) => setAuditDesde(e.target.value)}
              className="form-control"
              style={{ padding: '10px', width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-color)' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sidebar-text)' }}>
              Hasta: <span style={{ fontWeight: 'normal', fontSize: '0.7rem', color: '#94a3b8' }}>(Opcional)</span>
            </label>
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
              placeholder="Ej. 7587 o 437F"
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
            
            {/* KPI Rápido de contrato - Ahora interactivos como filtros */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div 
                onClick={() => setAuditFiltroTipo('todos')}
                title="Mostrar todo el historial"
                style={{ 
                  background: auditFiltroTipo === 'todos' ? 'rgba(2, 132, 199, 0.16)' : 'var(--profile-bg)', 
                  border: auditFiltroTipo === 'todos' ? '2px solid #0284c7' : '1px solid var(--border-color)', 
                  padding: '10px 16px', 
                  borderRadius: '14px', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: auditFiltroTipo === 'todos' ? 'translateY(-2px)' : 'none',
                  boxShadow: auditFiltroTipo === 'todos' ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none'
                }}
              >
                <div style={{ fontSize: '0.65rem', color: auditFiltroTipo === 'todos' ? '#0284c7' : 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🌐 Total
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: auditFiltroTipo === 'todos' ? '#0284c7' : 'var(--text-main)' }}>
                  {totalAuditItems}
                </div>
              </div>

              <div 
                onClick={() => setAuditFiltroTipo('visitas')}
                title="Filtrar solo Visitas Técnicas"
                style={{ 
                  background: auditFiltroTipo === 'visitas' ? 'rgba(16, 185, 129, 0.16)' : 'var(--profile-bg)', 
                  border: auditFiltroTipo === 'visitas' ? '2px solid #10b981' : '1px solid var(--border-color)', 
                  padding: '10px 16px', 
                  borderRadius: '14px', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: auditFiltroTipo === 'visitas' ? 'translateY(-2px)' : 'none',
                  boxShadow: auditFiltroTipo === 'visitas' ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none'
                }}
              >
                <div style={{ fontSize: '0.65rem', color: auditFiltroTipo === 'visitas' ? '#10b981' : 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚐 Visitas VT
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: auditFiltroTipo === 'visitas' ? '#10b981' : 'var(--text-main)' }}>
                  {countVisitas}
                </div>
              </div>

              <div 
                onClick={() => setAuditFiltroTipo('atenciones')}
                title="Filtrar solo Atenciones Call Center"
                style={{ 
                  background: auditFiltroTipo === 'atenciones' ? 'rgba(99, 102, 241, 0.16)' : 'var(--profile-bg)', 
                  border: auditFiltroTipo === 'atenciones' ? '2px solid #6366f1' : '1px solid var(--border-color)', 
                  padding: '10px 16px', 
                  borderRadius: '14px', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: auditFiltroTipo === 'atenciones' ? 'translateY(-2px)' : 'none',
                  boxShadow: auditFiltroTipo === 'atenciones' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none'
                }}
              >
                <div style={{ fontSize: '0.65rem', color: auditFiltroTipo === 'atenciones' ? '#6366f1' : 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🎧 Atenciones
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#6366f1' }}>
                  {countAtenciones}
                </div>
              </div>

              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⭐ Promedio</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#eab308' }}>
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

          {/* Barra de Filtro Rápido del Historial del Cliente */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '22px',
            padding: '8px 12px',
            background: 'var(--profile-bg)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAuditFiltroTipo('todos')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: auditFiltroTipo === 'todos' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  color: auditFiltroTipo === 'todos' ? '#ffffff' : 'var(--sidebar-text)',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: auditFiltroTipo === 'todos' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none'
                }}
              >
                <i className="fa-solid fa-list-check"></i>
                <span>Ver Todo</span>
                <span style={{
                  background: auditFiltroTipo === 'todos' ? 'rgba(255,255,255,0.25)' : 'var(--card-bg)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '0.74rem',
                  fontWeight: 900
                }}>
                  {totalAuditItems}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAuditFiltroTipo('visitas')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: auditFiltroTipo === 'visitas' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                  color: auditFiltroTipo === 'visitas' ? '#ffffff' : 'var(--sidebar-text)',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: auditFiltroTipo === 'visitas' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none'
                }}
              >
                <i className="fa-solid fa-van-shuttle"></i>
                <span>Visitas Técnicas</span>
                <span style={{
                  background: auditFiltroTipo === 'visitas' ? 'rgba(255,255,255,0.25)' : 'var(--card-bg)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '0.74rem',
                  fontWeight: 900
                }}>
                  {countVisitas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAuditFiltroTipo('atenciones')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: auditFiltroTipo === 'atenciones' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  color: auditFiltroTipo === 'atenciones' ? '#ffffff' : 'var(--sidebar-text)',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: auditFiltroTipo === 'atenciones' ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none'
                }}
              >
                <i className="fa-solid fa-headset"></i>
                <span>Atenciones Call Center</span>
                <span style={{
                  background: auditFiltroTipo === 'atenciones' ? 'rgba(255,255,255,0.25)' : 'var(--card-bg)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '0.74rem',
                  fontWeight: 900
                }}>
                  {countAtenciones}
                </span>
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
              Mostrando: <strong style={{ color: 'var(--text-main)' }}>{filteredAudit.length}</strong> registro(s)
            </div>
          </div>

          {/* Timeline list */}
          <div className="timeline-container" id="timeline-auditoria">
            {filteredAudit.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>
                No se encontraron {auditFiltroTipo === 'visitas' ? 'visitas técnicas' : auditFiltroTipo === 'atenciones' ? 'atenciones de soporte' : 'registros'} para el contrato #{contratoAudit} en el período seleccionado.
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
