import React, { useState, useEffect, useRef } from 'react';

const LISTA_HORARIOS_TURNO = [
  "LIBRE",
  "7AM - 2PM",
  "7 AM - 4PM",
  "7AM - 5PM",
  "8AM - 6PM",
  "10 AM - 6PM",
  "10 AM - 8PM",
  "1PM - 9PM",
  "9AM - 9PM",
  "2PM - 9PM",
  "8AM - 7PM",
  "8AM - 8PM"
];

function ReportesTab({ token, initialSubTab, initialFecha }) {

  const Chart = window.Chart;
  const getTodayStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Report Sub-tabs: 'calidad', 'actividades', 'dia-siguiente', 'cuadro-mando'
  const [reportSubTab, setReportSubTab] = useState(initialSubTab || 'calidad');

  // Filters
  const [fecha, setFecha] = useState(initialFecha || getTodayStr());
  const [tipoServicio, setTipoServicio] = useState('0'); // 0 = Soporte, 1 = Instalaciones
  const [calidadViewMode, setCalidadViewMode] = useState(localStorage.getItem('calidad_view_mode') || 'table'); // 'table' or 'cards'

  // Photo modal zoom
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Turnos Config for Cuadro de Mando
  const [agentesList, setAgentesList] = useState([]);
  const [agenteA, setAgenteA] = useState(localStorage.getItem('cm_saved_cm_agente_a') || '');
  const [agenteB, setAgenteB] = useState(localStorage.getItem('cm_saved_cm_agente_b') || '');
  const [agenteC, setAgenteC] = useState(localStorage.getItem('cm_saved_cm_agente_c') || '');

  const [horarioA, setHorarioA] = useState(localStorage.getItem('cm_saved_cm_horario_a') || '7 AM - 4 PM');
  const [horarioB, setHorarioB] = useState(localStorage.getItem('cm_saved_cm_horario_b') || '2 PM - 9 PM');
  const [horarioC, setHorarioC] = useState(localStorage.getItem('cm_saved_cm_horario_c') || '10 AM - 8 PM');

  const [soporteA, setSoporteA] = useState(parseInt(localStorage.getItem('cm_saved_cm_soporte_a')) || 0);
  const [soporteB, setSoporteB] = useState(parseInt(localStorage.getItem('cm_saved_cm_soporte_b')) || 0);
  const [soporteC, setSoporteC] = useState(parseInt(localStorage.getItem('cm_saved_cm_soporte_c')) || 0);

  // Data states
  const [loading, setLoading] = useState(true);
  const [dataCalidad, setDataCalidad] = useState([]);
  const [dataActividades, setDataActividades] = useState([]);
  const [dataDiaSiguiente, setDataDiaSiguiente] = useState([]);
  const [dataCuadroMando, setDataCuadroMando] = useState(null);

  // KPIs
  const [totalKpi, setTotalKpi] = useState(0);

  // Chart refs
  const chartAgenteRef = useRef(null);
  const chartTipoRef = useRef(null);
  const chartAgenteInstance = useRef(null);
  const chartTipoInstance = useRef(null);

  // Update browser URL state without reloading
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('tab', 'reportes');
    url.searchParams.set('subtab', reportSubTab);
    url.searchParams.set('fecha', fecha);
    window.history.replaceState({}, '', url);
  }, [reportSubTab, fecha]);

  useEffect(() => {
    loadReportData();
  }, [reportSubTab, fecha, tipoServicio, agenteA, agenteB, agenteC]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (reportSubTab === 'calidad') {
        const res = await fetch(`/api/admin/reporte_calidad/preview?fecha=${fecha}&es_instalacion=${tipoServicio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'ok') {
          const list = data.visitas || [];
          setDataCalidad(list);
          setTotalKpi(list.length);
        }
      } else if (reportSubTab === 'actividades') {
        const res = await fetch(`/api/admin/reporte_actividades/preview?fecha=${fecha}&es_instalacion=${tipoServicio}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'ok') {
          const list = data.reporte || [];
          setDataActividades(list);
          let sum = 0;
          list.forEach(g => { sum += (g.total || 0); });
          setTotalKpi(sum || list.length);
        }
      } else if (reportSubTab === 'dia-siguiente') {
        const res = await fetch(`/api/admin/reporte_dia_siguiente/preview?fecha=${fecha}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'ok') {
          const list = data.visitas || [];
          setDataDiaSiguiente(list);
          setTotalKpi(list.length);
        }
      } else if (reportSubTab === 'cuadro-mando') {
        let query = `/api/admin/cuadro_mando/preview?fecha=${fecha}`;
        if (agenteA) query += `&agente_a=${encodeURIComponent(agenteA)}`;
        if (agenteB) query += `&agente_b=${encodeURIComponent(agenteB)}`;
        if (agenteC) query += `&agente_c=${encodeURIComponent(agenteC)}`;

        const res = await fetch(query, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'ok') {
          setDataCuadroMando(data);
          setAgentesList(data.agentes_list || []);

          if (!agenteA && data.agente_a) setAgenteA(data.agente_a);
          if (!agenteB && data.agente_b) setAgenteB(data.agente_b);
          if (!agenteC && data.agente_c) setAgenteC(data.agente_c);

          setTotalKpi(data.kpis?.total_carga || 0);
        }
      }
    } catch (e) {
      console.error("Error al cargar reporte:", e);
    } finally {
      setLoading(false);
    }
  };

  // Render Charts for Cuadro de Mando
  useEffect(() => {
    if (reportSubTab === 'cuadro-mando' && dataCuadroMando && !loading) {
      renderCharts();
    }
  }, [reportSubTab, dataCuadroMando, loading, agenteA, agenteB, agenteC, soporteA, soporteB, soporteC]);

  const renderCharts = () => {
    if (!dataCuadroMando) return;
    const at = dataCuadroMando.atenciones;
    if (!at) return;

    const totA = (at.visitas_coordinadas?.[0] || 0) + (at.solventado_llamada?.[0] || 0) + (at.solventado_mensajes?.[0] || 0) + (at.solventado_oficina?.[0] || 0) + (soporteA || 0) + (at.otros?.[0] || 0);
    const totB = (at.visitas_coordinadas?.[1] || 0) + (at.solventado_llamada?.[1] || 0) + (at.solventado_mensajes?.[1] || 0) + (at.solventado_oficina?.[1] || 0) + (soporteB || 0) + (at.otros?.[1] || 0);
    const totC = (at.visitas_coordinadas?.[2] || 0) + (at.solventado_llamada?.[2] || 0) + (at.solventado_mensajes?.[2] || 0) + (at.solventado_oficina?.[2] || 0) + (soporteC || 0) + (at.otros?.[2] || 0);

    // Chart Agente
    if (chartAgenteRef.current) {
      if (chartAgenteInstance.current) chartAgenteInstance.current.destroy();
      chartAgenteInstance.current = new Chart(chartAgenteRef.current, {
        type: 'pie',
        data: {
          labels: [agenteA || 'Turno A', agenteB || 'Turno B', agenteC || 'Turno C'],
          datasets: [{
            data: [totA, totB, totC],
            backgroundColor: ['#4f46e5', '#10b981', '#ea580c'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }
        }
      });
    }

    // Chart Tipo
    if (chartTipoRef.current) {
      if (chartTipoInstance.current) chartTipoInstance.current.destroy();
      const catData = [
        (at.visitas_coordinadas?.[0] || 0) + (at.visitas_coordinadas?.[1] || 0) + (at.visitas_coordinadas?.[2] || 0),
        (at.solventado_llamada?.[0] || 0) + (at.solventado_llamada?.[1] || 0) + (at.solventado_llamada?.[2] || 0),
        (at.solventado_mensajes?.[0] || 0) + (at.solventado_mensajes?.[1] || 0) + (at.solventado_mensajes?.[2] || 0),
        (at.solventado_oficina?.[0] || 0) + (at.solventado_oficina?.[1] || 0) + (at.solventado_oficina?.[2] || 0),
        (soporteA + soporteB + soporteC),
        (at.otros?.[0] || 0) + (at.otros?.[1] || 0) + (at.otros?.[2] || 0)
      ];

      chartTipoInstance.current = new Chart(chartTipoRef.current, {
        type: 'pie',
        data: {
          labels: [
            "Visitas Coordinadas",
            "Solventado por Llamada",
            "Solventado por Mensajes",
            "Solventado en Oficina",
            "Soporte a Técnicos VT / INST",
            "Info / Transferencias - Otros"
          ],
          datasets: [{
            data: catData,
            backgroundColor: ['#6366f1', '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b', '#64748b'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } }
        }
      });
    }
  };

  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      let endpoint = '';
      let filename = `Reporte_${reportSubTab}_${fecha}.xlsx`;

      if (reportSubTab === 'calidad') {
        endpoint = `/api/admin/reporte_calidad/excel?fecha=${fecha}&es_instalacion=${tipoServicio}`;
        filename = `Reporte_Calidad_${fecha}.xlsx`;
      } else if (reportSubTab === 'actividades') {
        endpoint = `/api/admin/reporte_actividades/excel?fecha=${fecha}&es_instalacion=${tipoServicio}`;
        filename = `Reporte_Actividades_${fecha}.xlsx`;
      } else if (reportSubTab === 'dia-siguiente') {
        endpoint = `/api/admin/reporte_dia_siguiente/excel?fecha=${fecha}`;
        filename = `Reporte_Dia_Siguiente_${fecha}.xlsx`;
      } else if (reportSubTab === 'cuadro-mando') {
        let query = `fecha=${fecha}`;
        if (agenteA) query += `&agente_a=${encodeURIComponent(agenteA)}`;
        if (agenteB) query += `&agente_b=${encodeURIComponent(agenteB)}`;
        if (agenteC) query += `&agente_c=${encodeURIComponent(agenteC)}`;
        endpoint = `/api/admin/cuadro_mando/excel?${query}`;
        filename = `Reporte_Cuadro_Mando_${fecha}.xlsx`;
      }

      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Error en la respuesta del servidor al generar el Excel.");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar Excel:", err);
      alert("No se pudo descargar el archivo Excel. Por favor reintenta.");
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleShareLink = async () => {
    try {
      const res = await fetch(`/api/admin/cuadro_mando/share_link?fecha=${fecha}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok' && data.url) {
        let copied = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(data.url);
            copied = true;
          }
        } catch (clipErr) {
          console.warn("Clipboard write failed, using prompt fallback:", clipErr);
        }

        if (copied) {
          alert(`¡Enlace del Reporte Público Gerencial copiado al portapapeles! 🔗\n\n${data.url}`);
        } else {
          window.prompt("Copia el siguiente enlace del Reporte Público Gerencial:", data.url);
        }
      } else {
        alert(data.message || "No se pudo generar el enlace público.");
      }
    } catch (err) {
      console.error("Error al compartir el enlace:", err);
      alert("No se pudo obtener el enlace público. Por favor verifica la conexión.");
    }
  };

  const setViewModeHandler = (mode) => {
    setCalidadViewMode(mode);
    localStorage.setItem('calidad_view_mode', mode);
  };

  const fmtDt = (isoStr) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).substring(2);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div id="tab-reportes" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Hero Banner */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          <i className="fa-solid fa-file-excel"></i>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Módulo de Reportes Operativos
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Generación y previsualización de reportes operativos de Futurity para auditoría de calidad y despachos gerenciales.
          </p>
        </div>
      </div>

      {/* Sub-pestañas de Reportes */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setReportSubTab('calidad')}
          style={{
            background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
            color: reportSubTab === 'calidad' ? 'var(--primary)' : 'var(--sidebar-text)',
            borderBottom: reportSubTab === 'calidad' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <i className="fa-solid fa-clipboard-check"></i> Detalle de Visitas (Calidad)
        </button>

        <button
          type="button"
          onClick={() => setReportSubTab('actividades')}
          style={{
            background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
            color: reportSubTab === 'actividades' ? '#ea580c' : 'var(--sidebar-text)',
            borderBottom: reportSubTab === 'actividades' ? '3px solid #ea580c' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <i className="fa-solid fa-people-carry-box"></i> Resumen por Técnico
        </button>

        <button
          type="button"
          onClick={() => setReportSubTab('dia-siguiente')}
          style={{
            background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
            color: reportSubTab === 'dia-siguiente' ? '#0284c7' : 'var(--sidebar-text)',
            borderBottom: reportSubTab === 'dia-siguiente' ? '3px solid #0284c7' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <i className="fa-solid fa-calendar-day"></i> Visitas Día Siguiente
        </button>

        <button
          type="button"
          onClick={() => setReportSubTab('cuadro-mando')}
          style={{
            background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
            color: reportSubTab === 'cuadro-mando' ? '#1f497d' : 'var(--sidebar-text)',
            borderBottom: reportSubTab === 'cuadro-mando' ? '3px solid #1f497d' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <i className="fa-solid fa-gauge-high"></i> Reporte General
        </button>
      </div>

      {/* Filtros de Fecha y Acciones */}
      <div style={{ background: 'var(--card-bg)', padding: '20px 24px', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: '25px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>
              Fecha del Reporte:
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
            />
          </div>

          {(reportSubTab === 'calidad' || reportSubTab === 'actividades') && (
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>
                Tipo de Servicio:
              </label>
              <select
                value={tipoServicio}
                onChange={(e) => setTipoServicio(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, height: '44px' }}
              >
                <option value="0">Visitas de Soporte</option>
                <option value="1">Instalaciones</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={loadReportData}
              style={{ background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '11px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="fa-solid fa-arrows-rotate"></i> Actualizar Vista
            </button>

            {reportSubTab === 'cuadro-mando' && (
              <button
                type="button"
                onClick={handleShareLink}
                style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '11px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}
              >
                <i className="fa-solid fa-share-nodes"></i> Compartir Link
              </button>
            )}

            <button
              type="button"
              disabled={downloadingExcel}
              onClick={handleDownloadExcel}
              style={{
                background: reportSubTab === 'calidad' ? '#16a34a' : reportSubTab === 'actividades' ? '#ea580c' : reportSubTab === 'dia-siguiente' ? '#0284c7' : '#1f497d',
                color: 'white', border: 'none', padding: '11px 24px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: downloadingExcel ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', opacity: downloadingExcel ? 0.7 : 1
              }}
            >
              <i className={`fa-solid ${downloadingExcel ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i>
              {downloadingExcel ? 'Generando Excel...' : 'Descargar Reporte Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Configuración de Turnos del Cuadro de Mando (Visible solo en 'cuadro-mando') */}
      {reportSubTab === 'cuadro-mando' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '20px 24px', marginBottom: '25px', boxShadow: 'var(--shadow-sm)' }}>
          <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-sliders" style={{ color: '#4f46e5' }}></i> Configuración de Turnos y Gestión Manual
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {/* Turno A */}
            <div style={{ background: 'var(--profile-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <strong style={{ color: '#4f46e5', display: 'block', marginBottom: '10px', fontSize: '0.85rem' }}>TURNO A</strong>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Asesor:</label>
                <select value={agenteA} onChange={(e) => { setAgenteA(e.target.value); localStorage.setItem('cm_saved_cm_agente_a', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                  {agentesList.map((a, i) => <option key={i} value={a}>{a}</option>)}
                  <option value="Sin asignar">Sin asignar</option>
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Horario:</label>
                <select 
                  value={horarioA} 
                  onChange={(e) => { setHorarioA(e.target.value); localStorage.setItem('cm_saved_cm_horario_a', e.target.value); }} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                >
                  {LISTA_HORARIOS_TURNO.map((h, i) => <option key={i} value={h}>{h}</option>)}
                  {!LISTA_HORARIOS_TURNO.includes(horarioA) && horarioA && <option value={horarioA}>{horarioA}</option>}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Soporte Técnicos VT (Manual):</label>
                <input type="number" value={soporteA} onChange={(e) => { setSoporteA(parseInt(e.target.value) || 0); localStorage.setItem('cm_saved_cm_soporte_a', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }} />
              </div>
            </div>

            {/* Turno B */}
            <div style={{ background: 'var(--profile-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <strong style={{ color: '#10b981', display: 'block', marginBottom: '10px', fontSize: '0.85rem' }}>TURNO B</strong>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Asesor:</label>
                <select value={agenteB} onChange={(e) => { setAgenteB(e.target.value); localStorage.setItem('cm_saved_cm_agente_b', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                  {agentesList.map((a, i) => <option key={i} value={a}>{a}</option>)}
                  <option value="Sin asignar">Sin asignar</option>
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Horario:</label>
                <select 
                  value={horarioB} 
                  onChange={(e) => { setHorarioB(e.target.value); localStorage.setItem('cm_saved_cm_horario_b', e.target.value); }} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                >
                  {LISTA_HORARIOS_TURNO.map((h, i) => <option key={i} value={h}>{h}</option>)}
                  {!LISTA_HORARIOS_TURNO.includes(horarioB) && horarioB && <option value={horarioB}>{horarioB}</option>}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Soporte Técnicos VT (Manual):</label>
                <input type="number" value={soporteB} onChange={(e) => { setSoporteB(parseInt(e.target.value) || 0); localStorage.setItem('cm_saved_cm_soporte_b', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }} />
              </div>
            </div>

            {/* Turno C */}
            <div style={{ background: 'var(--profile-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <strong style={{ color: '#ea580c', display: 'block', marginBottom: '10px', fontSize: '0.85rem' }}>TURNO C</strong>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Asesor:</label>
                <select value={agenteC} onChange={(e) => { setAgenteC(e.target.value); localStorage.setItem('cm_saved_cm_agente_c', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                  {agentesList.map((a, i) => <option key={i} value={a}>{a}</option>)}
                  <option value="Sin asignar">Sin asignar</option>
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Horario:</label>
                <select 
                  value={horarioC} 
                  onChange={(e) => { setHorarioC(e.target.value); localStorage.setItem('cm_saved_cm_horario_c', e.target.value); }} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                >
                  {LISTA_HORARIOS_TURNO.map((h, i) => <option key={i} value={h}>{h}</option>)}
                  {!LISTA_HORARIOS_TURNO.includes(horarioC) && horarioC && <option value={horarioC}>{horarioC}</option>}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Soporte Técnicos VT (Manual):</label>
                <input type="number" value={soporteC} onChange={(e) => { setSoporteC(parseInt(e.target.value) || 0); localStorage.setItem('cm_saved_cm_soporte_c', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-text)', display: 'block', marginBottom: '4px' }}>Soporte Técnicos VT (Manual):</label>
                <input type="number" value={soporteC} onChange={(e) => { setSoporteC(parseInt(e.target.value) || 0); localStorage.setItem('cm_saved_cm_soporte_c', e.target.value); }} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Conteo Global */}
      {reportSubTab !== 'cuadro-mando' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '20px 24px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>
              Total Visitas / Actividades Registradas en Vista Previa
            </span>
            <h3 style={{ margin: 0, fontSize: '1.9rem', color: 'var(--text-main)', fontWeight: 900 }}>
              {totalKpi}
            </h3>
          </div>
        </div>
      )}

      {/* Previsualización de Datos */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '26px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-magnifying-glass-chart" style={{ color: 'var(--primary)' }}></i>
            {reportSubTab === 'calidad' && 'Previsualización: Detalle de Visitas (Calidad)'}
            {reportSubTab === 'actividades' && 'Previsualización: Resumen por Técnico'}
            {reportSubTab === 'dia-siguiente' && 'Previsualización: Visitas del Día Siguiente'}
            {reportSubTab === 'cuadro-mando' && 'Previsualización: Cuadro de Mando Diario'}
          </h3>

          {reportSubTab === 'calidad' && (
            <div style={{ display: 'flex', gap: '6px', background: 'var(--profile-bg)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setViewModeHandler('table')}
                style={{ border: 'none', background: calidadViewMode === 'table' ? 'var(--primary)' : 'transparent', color: calidadViewMode === 'table' ? 'white' : 'var(--sidebar-text)', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: '8px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-table"></i> Vista Tabla
              </button>
              <button
                type="button"
                onClick={() => setViewModeHandler('cards')}
                style={{ border: 'none', background: calidadViewMode === 'cards' ? 'var(--primary)' : 'transparent', color: calidadViewMode === 'cards' ? 'white' : 'var(--sidebar-text)', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: '8px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-table-cells-large"></i> Fichas de Auditoría
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--sidebar-text)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '15px' }}></i>
            <p style={{ margin: 0, fontWeight: 700 }}>Generando vista previa del reporte...</p>
          </div>
        ) : (
          <>
            {/* SUBTAB 1: CALIDAD */}
            {reportSubTab === 'calidad' && (
              <>
                {calidadViewMode === 'table' ? (
                  <div style={{ overflowX: 'auto', maxHeight: '550px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                          <th style={{ padding: '14px 16px', textAlign: 'center', width: '50px' }}>#</th>
                          <th style={{ padding: '14px 16px' }}>Fecha Registro</th>
                          <th style={{ padding: '14px 16px', textAlign: 'center' }}>Contrato</th>
                          <th style={{ padding: '14px 16px' }}>Cliente</th>
                          <th style={{ padding: '14px 16px' }}>Teléfonos</th>
                          <th style={{ padding: '14px 16px' }}>Sector</th>
                          <th style={{ padding: '14px 16px' }}>Servicio</th>
                          <th style={{ padding: '14px 16px' }}>Solución Técnico</th>
                          <th style={{ padding: '14px 16px' }}>Observación Técnico</th>
                          <th style={{ padding: '14px 16px' }}>Técnico(s)</th>
                          <th style={{ padding: '14px 16px' }}>Finalización</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataCalidad.length > 0 ? (
                          dataCalidad.map((v, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800 }}>{idx + 1}</td>
                              <td style={{ padding: '14px 16px', color: 'var(--sidebar-text)', whiteSpace: 'nowrap' }}>{fmtDt(v.fecha_registro)}</td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '4px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem' }}>
                                  {v.contrato || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-main)' }}>{v.cliente}</td>
                              <td style={{ padding: '14px 16px', color: 'var(--sidebar-text)' }}>{v.telefonos || ''}</td>
                              <td style={{ padding: '14px 16px', fontWeight: 700 }}>{v.sector}</td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                                  {v.servicio || ''}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', color: '#16a34a', fontWeight: 600, maxWidth: '200px' }}>{v.solucion_tecnico || ''}</td>
                              <td style={{ padding: '14px 16px', color: 'var(--sidebar-text)', fontStyle: 'italic', maxWidth: '220px' }}>{v.observacion_tecnico || 'Sin observaciones.'}</td>
                              <td style={{ padding: '14px 16px', fontWeight: 700, color: '#4f46e5' }}>
                                {v.tecnico_principal}{v.tecnico_apoyo ? ` / ${v.tecnico_apoyo}` : ''}
                              </td>
                              <td style={{ padding: '14px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDt(v.hora_fin_visita)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="11" style={{ padding: '50px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                              No hay visitas efectivas registradas en esta fecha.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Cards View */
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', maxHeight: '580px', overflowY: 'auto', paddingRight: '4px' }}>
                    {dataCalidad.length > 0 ? (
                      dataCalidad.map((v, idx) => (
                        <div key={idx} style={{ background: 'var(--profile-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--primary)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase' }}>Contrato #{v.contrato || '-'}</span>
                              <h4 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850 }}>{v.cliente}</h4>
                              <div style={{ fontSize: '0.85rem', color: 'var(--sidebar-text)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span>📞 {v.telefonos}</span>
                                <span>|</span>
                                <span>📍 Sector: {v.sector}</span>
                                <span>|</span>
                                <span>🆔 VT-{v.id_visita}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', display: 'inline-block', marginBottom: '4px' }}>{v.servicio}</span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)' }}>⏰ Cierre: {fmtDt(v.hora_fin_visita)}</div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', borderRight: '1px solid var(--border-color)', paddingRight: '15px' }}>
                              <div><strong>👥 Técnico(s):</strong> <span style={{ color: '#4f46e5', fontWeight: 700 }}>{v.tecnico_principal}{v.tecnico_apoyo ? ` / ${v.tecnico_apoyo}` : ''}</span></div>
                              <div><strong>🛠️ Solución Aplicada:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>{v.solucion_tecnico}</span></div>
                              <div><strong>📝 Observación Técnico:</strong> <span style={{ color: 'var(--sidebar-text)', fontStyle: 'italic' }}>{v.observacion_tecnico || 'Sin observaciones.'}</span></div>
                              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px', marginTop: '6px', fontSize: '0.8rem' }}>
                                <div><strong>ONU Instalada:</strong> {v.modelo_onu || 'N/A'}</div>
                                <div><strong>Router Instalado:</strong> {v.modelo_router || 'N/A'}</div>
                                {v.coordenadas_tecnico && (
                                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                                    <strong>📍 GPS Cierre:</strong> {v.coordenadas_tecnico}
                                    <a href={`https://maps.google.com/?q=${v.coordenadas_tecnico}`} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: '#0284c7', fontWeight: 800, textDecoration: 'none' }}>Ver Mapa</a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Evidencias Visuales */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <strong style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Evidencias de Cierre</strong>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Equipos:</div>
                                  {v.foto_equipos ? (
                                    <img src={`/static/uploads/${v.foto_equipos}`} alt="Equipos" style={{ maxHeight: '70px', maxWidth: '100%', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setPreviewPhoto(`/static/uploads/${v.foto_equipos}`)} />
                                  ) : <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)' }}>Sin foto</span>}
                                </div>

                                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Firma:</div>
                                  {v.firma_cliente ? (
                                    v.firma_cliente.includes('SIN_FIRMA') ? (
                                      <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 700 }}>⚠️ Sin Firma</span>
                                    ) : (
                                      <img src={`/static/uploads/${v.firma_cliente}`} alt="Firma" style={{ maxHeight: '65px', maxWidth: '100%', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setPreviewPhoto(`/static/uploads/${v.firma_cliente}`)} />
                                    )
                                  ) : <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)' }}>Sin firma</span>}
                                </div>

                                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Extras:</div>
                                  {v.foto_extra_1 ? (
                                    <img src={`/static/uploads/${v.foto_extra_1}`} alt="Extra" style={{ maxHeight: '70px', maxWidth: '100%', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setPreviewPhoto(`/static/uploads/${v.foto_extra_1}`)} />
                                  ) : <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)' }}>0 fotos</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '50px', color: 'var(--sidebar-text)', fontWeight: 600 }}>No hay visitas registradas para esta fecha.</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* SUBTAB 2: ACTIVIDADES */}
            {reportSubTab === 'actividades' && (
              <div style={{ overflowX: 'auto', maxHeight: '550px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(245, 158, 11, 0.12)', borderBottom: '1px solid var(--border-color)', color: '#ea580c', fontWeight: 800 }}>
                      <th style={{ padding: '14px 16px' }}>Técnico de Campo</th>
                      <th style={{ padding: '14px 16px' }}>Actividad Realizada</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Total Técnico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataActividades.length > 0 ? (
                      dataActividades.map((group, idx) => (
                        <React.Fragment key={idx}>
                          {group.actividades?.map((act, aIdx) => (
                            <tr key={aIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              {aIdx === 0 && (
                                <td rowSpan={group.actividades.length} style={{ padding: '14px 16px', fontWeight: 850, color: 'var(--text-main)', borderRight: '1px solid var(--border-color)', verticalAlign: 'middle', background: 'var(--profile-bg)' }}>
                                  🛠️ {group.tecnico}
                                </td>
                              )}
                              <td style={{ padding: '14px 16px', fontWeight: 600 }}>{act.actividad || act.nombre}</td>
                              <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>{act.cantidad}</td>
                              {aIdx === 0 && (
                                <td rowSpan={group.actividades.length} style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, color: '#ea580c', fontSize: '1.1rem', borderLeft: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                                  {group.total}
                                </td>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '50px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                          No hay actividades finalizadas en esta fecha.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 3: DÍA SIGUIENTE */}
            {reportSubTab === 'dia-siguiente' && (
              <div style={{ overflowX: 'auto', maxHeight: '550px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(2, 132, 199, 0.12)', borderBottom: '1px solid var(--border-color)', color: '#0284c7', fontWeight: 800 }}>
                      <th style={{ padding: '14px 16px', textAlign: 'center', width: '50px' }}>#</th>
                      <th style={{ padding: '14px 16px' }}>Fecha Registro / Estado</th>
                      <th style={{ padding: '14px 16px' }}>Cliente</th>
                      <th style={{ padding: '14px 16px' }}>Sector</th>
                      <th style={{ padding: '14px 16px' }}>Problema</th>
                      <th style={{ padding: '14px 16px' }}>Grupo de Coordinación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataDiaSiguiente.length > 0 ? (
                      dataDiaSiguiente.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{idx + 1}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--sidebar-text)', whiteSpace: 'nowrap' }}>{fmtDt(r.fecha_registro)}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-main)' }}>{r.cliente}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 700 }}>{r.sector}</td>
                          <td style={{ padding: '14px 16px', color: '#ef4444', fontWeight: 600 }}>{r.problema}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                            <span style={{ background: r.grupo === 'HOY' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: r.grupo === 'HOY' ? '#059669' : '#d97706', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem' }}>
                              {r.grupo === 'HOY' ? 'GENERADAS HOY' : 'REAGENDADAS Y ANTERIORES'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                          No hay visitas programadas para el día siguiente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 4: CUADRO DE MANDO COMPLETO */}
            {reportSubTab === 'cuadro-mando' && (
              <div>
                {dataCuadroMando ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    
                    {/* Grid: Call Center Table vs Field KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px', alignItems: 'start' }}>
                      {/* Left: Call Center Table */}
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--profile-bg)' }}>
                        <div style={{ background: '#1f497d', color: 'white', padding: '12px', fontSize: '0.92rem', fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>
                          ATENCIONES DIARIAS POR CALL CENTER
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '10px', textAlign: 'left', background: '#8064a2', color: 'white', fontWeight: 800 }}>HORARIO</th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#d9e1f2', color: '#000', fontWeight: 800 }}>HORARIO A<br/><span style={{ fontSize: '0.72rem', fontWeight: 500 }}>{horarioA}</span></th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#e2efda', color: '#000', fontWeight: 800 }}>HORARIO B<br/><span style={{ fontSize: '0.72rem', fontWeight: 500 }}>{horarioB}</span></th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#fce4d6', color: '#000', fontWeight: 800 }}>HORARIO C<br/><span style={{ fontSize: '0.72rem', fontWeight: 500 }}>{horarioC}</span></th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#f2f2f2', color: '#000', fontWeight: 800 }}>TOTAL CC</th>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '10px', textAlign: 'left', background: '#8064a2', color: 'white', fontWeight: 800 }}>AGENTE DE TURNO</th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#d9e1f2', color: '#000', fontWeight: 800 }}>{agenteA || '-'}</th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#e2efda', color: '#000', fontWeight: 800 }}>{agenteB || '-'}</th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#fce4d6', color: '#000', fontWeight: 800 }}>{agenteC || '-'}</th>
                                <th style={{ padding: '10px', textAlign: 'center', background: '#f2f2f2', color: '#1f497d', fontWeight: 900, fontSize: '1.1rem' }}>
                                  {
                                    (dataCuadroMando.atenciones?.visitas_coordinadas?.[0] || 0) + (dataCuadroMando.atenciones?.visitas_coordinadas?.[1] || 0) + (dataCuadroMando.atenciones?.visitas_coordinadas?.[2] || 0) +
                                    (dataCuadroMando.atenciones?.solventado_llamada?.[0] || 0) + (dataCuadroMando.atenciones?.solventado_llamada?.[1] || 0) + (dataCuadroMando.atenciones?.solventado_llamada?.[2] || 0) +
                                    (dataCuadroMando.atenciones?.solventado_mensajes?.[0] || 0) + (dataCuadroMando.atenciones?.solventado_mensajes?.[1] || 0) + (dataCuadroMando.atenciones?.solventado_mensajes?.[2] || 0) +
                                    (dataCuadroMando.atenciones?.solventado_oficina?.[0] || 0) + (dataCuadroMando.atenciones?.solventado_oficina?.[1] || 0) + (dataCuadroMando.atenciones?.solventado_oficina?.[2] || 0) +
                                    (soporteA + soporteB + soporteC) +
                                    (dataCuadroMando.atenciones?.otros?.[0] || 0) + (dataCuadroMando.atenciones?.otros?.[1] || 0) + (dataCuadroMando.atenciones?.otros?.[2] || 0)
                                  }
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: "VISITAS COORDINADAS", key: 'visitas_coordinadas' },
                                { label: "SOLVENTADO POR LLAMADA", key: 'solventado_llamada' },
                                { label: "SOLVENTADO POR MENSAJES", key: 'solventado_mensajes' },
                                { label: "SOLVENTADO EN OFICINA", key: 'solventado_oficina' },
                                { label: "SOPORTE A TÉCNICOS VT / INST", manual: [soporteA, soporteB, soporteC] },
                                { label: "INFO / TRANSFERENCIAS - OTROS", key: 'otros' }
                              ].map((row, rIdx) => {
                                const vals = row.manual ? row.manual : (dataCuadroMando.atenciones?.[row.key] || [0, 0, 0]);
                                const totalRow = vals[0] + vals[1] + vals[2];
                                return (
                                  <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 800, background: '#8064a2', color: 'white' }}>{row.label}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', background: '#d9e1f2', color: '#000', fontWeight: 700 }}>{vals[0]}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', background: '#e2efda', color: '#000', fontWeight: 700 }}>{vals[1]}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', background: '#fce4d6', color: '#000', fontWeight: 700 }}>{vals[2]}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', background: '#f2f2f2', color: '#1f497d', fontWeight: 900 }}>{totalRow}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {(() => {
                              const at = dataCuadroMando.atenciones || {};
                              const totA = (at.visitas_coordinadas?.[0] || 0) + (at.solventado_llamada?.[0] || 0) + (at.solventado_mensajes?.[0] || 0) + (at.solventado_oficina?.[0] || 0) + (soporteA || 0) + (at.otros?.[0] || 0);
                              const totB = (at.visitas_coordinadas?.[1] || 0) + (at.solventado_llamada?.[1] || 0) + (at.solventado_mensajes?.[1] || 0) + (at.solventado_oficina?.[1] || 0) + (soporteB || 0) + (at.otros?.[1] || 0);
                              const totC = (at.visitas_coordinadas?.[2] || 0) + (at.solventado_llamada?.[2] || 0) + (at.solventado_mensajes?.[2] || 0) + (at.solventado_oficina?.[2] || 0) + (soporteC || 0) + (at.otros?.[2] || 0);
                              const totGeneral = totA + totB + totC;
                              return (
                                <tfoot>
                                  <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 900 }}>
                                    <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 900, background: '#1f497d', color: 'white', textTransform: 'uppercase', fontSize: '0.8rem' }}>TOTAL DE GESTIONES POR ASESOR</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', background: '#d9e1f2', color: '#1f497d', fontWeight: 900, fontSize: '1.05rem' }}>{totA}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', background: '#e2efda', color: '#1f497d', fontWeight: 900, fontSize: '1.05rem' }}>{totB}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', background: '#fce4d6', color: '#1f497d', fontWeight: 900, fontSize: '1.05rem' }}>{totC}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', background: '#1f497d', color: 'white', fontWeight: 900, fontSize: '1.15rem' }}>{totGeneral}</td>
                                  </tr>
                                </tfoot>
                              );
                            })()}
                          </table>
                        </div>
                      </div>

                      {/* Right: Field Operative KPIs */}
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--profile-bg)' }}>
                        <div style={{ background: '#1f497d', color: 'white', padding: '12px', fontWeight: 900, fontSize: '0.88rem', textAlign: 'center', textTransform: 'uppercase' }}>
                          VISITAS TÉCNICAS POR TÉCNICO OPERADOR
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--sidebar-text)', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase' }}>Pendientes Anteriores</div>
                            <strong style={{ fontSize: '1.5rem', color: 'var(--text-main)', display: 'block', marginTop: '4px' }}>{dataCuadroMando.kpis?.pendientes_anteriores || 0}</strong>
                          </div>
                          <div style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--sidebar-text)', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase' }}>Generadas Hoy</div>
                            <strong style={{ fontSize: '1.5rem', color: '#0284c7', display: 'block', marginTop: '4px' }}>{dataCuadroMando.kpis?.generadas_hoy || 0}</strong>
                          </div>
                          <div style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--sidebar-text)', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase' }}>Total Carga Visitas</div>
                            <strong style={{ fontSize: '1.5rem', color: '#1f497d', display: 'block', marginTop: '4px' }}>{dataCuadroMando.kpis?.total_carga || 0}</strong>
                          </div>
                        </div>

                        <div style={{ background: '#1f497d', color: 'white', padding: '8px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' }}>
                          DETALLE DE VISITAS POR DAÑOS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                          <div style={{ padding: '14px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.15)', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>Atendidas & Solucionadas</div>
                            <strong style={{ fontSize: '1.6rem', color: '#2563eb', display: 'block', marginTop: '4px' }}>{dataCuadroMando.kpis?.atendidas_hoy || 0}</strong>
                          </div>
                          <div style={{ padding: '14px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.15)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Pendientes Mañana</div>
                            <strong style={{ fontSize: '1.6rem', color: '#059669', display: 'block', marginTop: '4px' }}>{dataCuadroMando.kpis?.pendientes_manana || 0}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fila de Listas Detalladas de Soluciones y Problemas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px' }}>
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--profile-bg)' }}>
                        <div style={{ background: '#ddebf7', color: '#1e3a8a', padding: '10px', fontWeight: 800, fontSize: '0.85rem', textAlign: 'center' }}>
                          PROBLEMA / SOLUCIÓN DE VISITAS DE HOY
                        </div>
                        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <tbody>
                              {Object.entries(dataCuadroMando.soluciones || {}).map(([name, val], idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '8px 12px', color: 'var(--text-main)', width: '80%' }}>{name}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'center', color: '#1e3a8a', width: '20%' }}>{val}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--profile-bg)' }}>
                        <div style={{ background: '#e2efda', color: '#14532d', padding: '10px', fontWeight: 800, fontSize: '0.85rem', textAlign: 'center' }}>
                          PROBLEMAS DE VISITAS PARA MAÑANA
                        </div>
                        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <tbody>
                              {Object.entries(dataCuadroMando.problemas || {}).map(([name, val], idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '8px 12px', color: 'var(--text-main)', width: '80%' }}>{name}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'center', color: '#14532d', width: '20%' }}>{val}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Gráficos Interactivos Chart.js */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.9rem' }}>GESTIÓN POR AGENTE</h5>
                        <div style={{ height: '250px', position: 'relative' }}>
                          <canvas ref={chartAgenteRef}></canvas>
                        </div>
                      </div>

                      <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.9rem' }}>TIPO DE ATENCIÓN</h5>
                        <div style={{ height: '250px', position: 'relative' }}>
                          <canvas ref={chartTipoRef}></canvas>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontWeight: 600 }}>Cargando Cuadro de Mando...</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Modal Zoom */}
      {previewPhoto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setPreviewPhoto(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={previewPhoto} alt="Evidencia Zoom" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
            <button type="button" onClick={() => setPreviewPhoto(null)} style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#ef4444', color: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontWeight: 800, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportesTab;
