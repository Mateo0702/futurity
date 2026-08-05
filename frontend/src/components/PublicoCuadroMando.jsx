import React, { useState, useEffect, useRef } from 'react';

function PublicoCuadroMando({ fecha, token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tab-general'); // 'tab-general', 'tab-manana', 'tab-actividades'

  const chartAgenteRef = useRef(null);
  const chartTipoRef = useRef(null);
  const chartAgenteInstance = useRef(null);
  const chartTipoInstance = useRef(null);

  const Chart = window.Chart;

  useEffect(() => {
    fetchPublicData();
  }, [fecha, token]);

  const fetchPublicData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/publico/cuadro_mando/${fecha}/${token}`);
      const result = await res.json();
      if (res.ok && result.status === 'ok') {
        setData(result);
      } else {
        setError(result.message || "El enlace es inválido, ha expirado o ha sido modificado.");
      }
    } catch (err) {
      console.error("Error al cargar cuadro de mando público:", err);
      setError("Error de conexión al servidor del informe público.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data && activeTab === 'tab-general' && !loading && Chart) {
      renderCharts();
    }
  }, [data, activeTab, loading]);

  const renderCharts = () => {
    if (!data) return;

    const nameA = data.agente_a || 'Turno A';
    const nameB = data.agente_b || 'Turno B';
    const nameC = data.agente_c || 'Turno C';

    const totA = data.agente_totals?.[0] || 0;
    const totB = data.agente_totals?.[1] || 0;
    const totC = data.agente_totals?.[2] || 0;

    // 1. Chart Agente
    if (chartAgenteRef.current) {
      if (chartAgenteInstance.current) chartAgenteInstance.current.destroy();
      chartAgenteInstance.current = new Chart(chartAgenteRef.current, {
        type: 'pie',
        data: {
          labels: [nameA, nameB, nameC],
          datasets: [{
            data: [totA, totB, totC],
            backgroundColor: ['#4f46e5', '#10b981', '#fb923c'],
            borderWidth: 1.5,
            borderColor: '#111827'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#cbd5e1', font: { size: 11 } }
            }
          }
        }
      });
    }

    // 2. Chart Tipo
    if (chartTipoRef.current) {
      if (chartTipoInstance.current) chartTipoInstance.current.destroy();
      
      const catCounts = {
        "Visitas Coord.": 0,
        "Solventado Llamada": 0,
        "Solventado Mensajes": 0,
        "Solventado Oficina": 0,
        "Soporte VT/Inst": 0,
        "Otros": 0
      };

      (data.rows_atenciones || []).forEach(row => {
        const lbl = row.label;
        const total = row.total || 0;
        if (lbl.includes("VISITAS COORDINADAS")) catCounts["Visitas Coord."] += total;
        else if (lbl.includes("LLAMADAS")) catCounts["Solventado Llamada"] += total;
        else if (lbl.includes("MENSAJES")) catCounts["Solventado Mensajes"] += total;
        else if (lbl.includes("OFICINA")) catCounts["Solventado Oficina"] += total;
        else if (lbl.includes("SOPORTE")) catCounts["Soporte VT/Inst"] += total;
        else catCounts["Otros"] += total;
      });

      chartTipoInstance.current = new Chart(chartTipoRef.current, {
        type: 'pie',
        data: {
          labels: Object.keys(catCounts),
          datasets: [{
            data: Object.values(catCounts),
            backgroundColor: ['#6366f1', '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b', '#64748b'],
            borderWidth: 1.5,
            borderColor: '#111827'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#cbd5e1', font: { size: 10 } }
            }
          }
        }
      });
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: 'linear-gradient(135deg, #07090e 0%, #0f172a 100%)', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, system-ui' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#6366f1', marginBottom: '16px' }}></i>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Cargando Reporte Operativo Diario...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: 'linear-gradient(135deg, #07090e 0%, #0f172a 100%)', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Outfit, system-ui' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '24px', padding: '40px 24px', maxWidth: '480px', textAlign: 'center', boxShadow: '0 15px 35px rgba(0, 0, 0, 0.3)' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '3.5rem', color: '#ef4444', marginBottom: '20px' }}></i>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 12px 0', color: '#f8fafc' }}>Acceso Denegado</h2>
          <p style={{ fontSize: '0.95rem', color: '#94a3b8', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const rowsAtenciones = data?.rows_atenciones || [];
  const agenteTotals = data?.agente_totals || [0, 0, 0];
  const visitasManana = data?.visitas_manana || [];
  const actividadesTecnicos = data?.actividades_tecnicos || [];

  return (
    <div 
      id="publico-cuadro-mando-container" 
      style={{ 
        height: '100vh', 
        width: '100vw', 
        background: 'linear-gradient(135deg, #07090e 0%, #0f172a 100%)', 
        color: '#f1f5f9', 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        overflowY: 'auto', 
        fontFamily: 'Outfit, system-ui',
        boxSizing: 'border-box'
      }}
    >
      {/* LOCAL STYLES TO OVERRIDE APP GLOBAL STYLESHEET TABLE COLORS */}
      <style dangerouslySetInnerHTML={{__html: `
        #publico-cuadro-mando-container table,
        #publico-cuadro-mando-container tr,
        #publico-cuadro-mando-container th,
        #publico-cuadro-mando-container td {
          background: transparent !important;
          background-color: transparent !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
        }
        #publico-cuadro-mando-container .td-label {
          background-color: rgba(139, 92, 246, 0.12) !important;
          color: #d8b4fe !important;
        }
        #publico-cuadro-mando-container .cc-total-row {
          background-color: rgba(0, 0, 0, 0.4) !important;
          color: #ffffff !important;
        }
        #publico-cuadro-mando-container .detail-sol-val {
          background-color: rgba(56, 189, 248, 0.04) !important;
          color: #38bdf8 !important;
        }
        #publico-cuadro-mando-container .detail-prob-val {
          background-color: rgba(52, 211, 153, 0.04) !important;
          color: #34d399 !important;
        }
      `}} />

      <div style={{ width: '100%', maxWidth: '950px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '60px' }}>
        
        {/* HEADER */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', flexWrap: 'wrap', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '2px', background: 'linear-gradient(90deg, #dc2626, #6366f1, #10b981)' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(220, 38, 38, 0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <i className="fa-solid fa-gauge-high" style={{ fontSize: '1.4rem', color: 'white' }}></i>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                FUTURITY
              </h1>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Reporte Diario Call Center & Campo
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '10px 18px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-regular fa-calendar-days" style={{ color: '#38bdf8' }}></i>
            <span>{data?.fecha || fecha}</span>
          </div>
        </div>

        {/* PREMIUM TAB BAR */}
        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '6px', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.05)', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('tab-general')}
            style={{ flex: 1, padding: '12px 8px', borderRadius: '14px', border: activeTab === 'tab-general' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none', background: activeTab === 'tab-general' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'transparent', color: activeTab === 'tab-general' ? '#ffffff' : '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            📊 Cuadro de Mando
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tab-manana')}
            style={{ flex: 1, padding: '12px 8px', borderRadius: '14px', border: activeTab === 'tab-manana' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none', background: activeTab === 'tab-manana' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'transparent', color: activeTab === 'tab-manana' ? '#ffffff' : '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            📅 Visitas Mañana ({visitasManana.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tab-actividades')}
            style={{ flex: 1, padding: '12px 8px', borderRadius: '14px', border: activeTab === 'tab-actividades' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none', background: activeTab === 'tab-actividades' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'transparent', color: activeTab === 'tab-actividades' ? '#ffffff' : '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            🛠️ Actividades ({actividadesTecnicos.length})
          </button>
        </div>

        {/* TAB 1: CUADRO DE MANDO GENERAL */}
        {activeTab === 'tab-general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* MAIN TABLES GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              
              {/* Call Center Card */}
              <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', fontSize: '0.92rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', color: 'white', background: '#1e3a8a' }}>
                  Atenciones Diarias por Call Center
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '2px solid rgba(255, 255, 255, 0.1)', fontWeight: 800 }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', width: '38%', color: '#cbd5e1' }}>Horario / Agente</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', background: 'rgba(96, 165, 250, 0.08)', color: '#93c5fd', fontSize: '0.75rem' }}>7 AM - 4 PM<br/><span style={{ fontWeight: 500 }}>A</span></th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', background: 'rgba(74, 222, 128, 0.08)', color: '#86efac', fontSize: '0.75rem' }}>2 PM - 9 PM<br/><span style={{ fontWeight: 500 }}>B</span></th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', background: 'rgba(251, 146, 60, 0.08)', color: '#ffedd5', fontSize: '0.75rem' }}>10 AM - 8 PM<br/><span style={{ fontWeight: 500 }}>C</span></th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(255, 255, 255, 0.04)', color: 'white' }}>Total CC</th>
                      </tr>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.04)', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', color: '#cbd5e1', fontWeight: 700 }}>AGENTE DE TURNO</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', color: '#60a5fa', fontWeight: 700 }}>{data?.agente_a || '-'}</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>{data?.agente_b || '-'}</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', color: '#fb923c', fontWeight: 700 }}>{data?.agente_c || '-'}</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.95rem', fontWeight: 900, color: 'white' }}>{data?.total_cc_general || 0}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsAtenciones.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td className="td-label" style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'left', width: '38%' }}>{row.label}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#cbd5e1', fontWeight: 600 }}>{row.vals?.[0] || 0}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#cbd5e1', fontWeight: 600 }}>{row.vals?.[1] || 0}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#cbd5e1', fontWeight: 600 }}>{row.vals?.[2] || 0}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.03)' }}>{row.total || 0}</td>
                        </tr>
                      ))}
                      <tr className="cc-total-row" style={{ color: '#ffffff', fontWeight: 900 }}>
                        <td style={{ padding: '14px 12px', textAlign: 'left', fontWeight: 800 }}>TOTAL DE GESTIONES AL DÍA</td>
                        <td style={{ padding: '14px 12px', textAlign: 'center', color: '#60a5fa' }}>{agenteTotals[0] || 0}</td>
                        <td style={{ padding: '14px 12px', textAlign: 'center', color: '#4ade80' }}>{agenteTotals[1] || 0}</td>
                        <td style={{ padding: '14px 12px', textAlign: 'center', color: '#fb923c' }}>{agenteTotals[2] || 0}</td>
                        <td style={{ padding: '14px 12px', textAlign: 'center', background: '#1e3a8a', color: 'white' }}>{data?.total_cc_general || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Field Tech KPIs Card */}
              <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', fontSize: '0.92rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', color: 'white', background: '#1f2937' }}>
                  Desempeño Operador de Campo (VT)
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>Pendientes<br/>Anteriores</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: '6px', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{kpis.pendientes_anteriores || 0}</div>
                  </div>
                  <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>Generadas<br/>Hoy</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: '6px', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{kpis.generadas_hoy || 0}</div>
                  </div>
                  <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>Carga Total<br/>Visitas</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: '6px', background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{kpis.total_carga || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(30, 58, 138, 0.15)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', color: '#93c5fd', textAlign: 'center' }}>Resueltas Hoy<br/>+ Cambios FO</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: '6px', background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{kpis.atendidas_hoy || 0}</div>
                  </div>
                  <div style={{ padding: '16px 12px', textAlign: 'center', background: 'rgba(20, 83, 45, 0.12)' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', color: '#86efac', textAlign: 'center' }}>Pendientes<br/>Mañana</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: '6px', background: 'linear-gradient(135deg, #4ade80 0%, #15803d 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{kpis.pendientes_manana || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* PROBLEMS AND SOLUTIONS EXPANSIONS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Today's Solutions */}
              <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', color: 'white', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-circle-check"></i> Soluciones Realizadas Hoy
                </div>
                <div style={{ flex: 1, maxHeight: '250px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <tbody>
                      {data?.soluciones && Object.keys(data.soluciones).length > 0 ? (
                        Object.entries(data.soluciones).map(([name, val], idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '10px 14px', textAlign: 'left', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 500 }}>{name}</td>
                            <td className="detail-sol-val" style={{ padding: '10px 14px', fontWeight: 800, width: '70px', fontSize: '0.9rem', textAlign: 'center' }}>{val}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>No hay soluciones registradas hoy</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tomorrow's Problems */}
              <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', color: 'white', background: '#14532d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-clock"></i> Visitas Pendientes para Mañana
                </div>
                <div style={{ flex: 1, maxHeight: '250px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <tbody>
                      {data?.problemas && Object.keys(data.problemas).length > 0 ? (
                        Object.entries(data.problemas).map(([name, val], idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '10px 14px', textAlign: 'left', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 500 }}>{name}</td>
                            <td className="detail-prob-val" style={{ padding: '10px 14px', fontWeight: 800, width: '70px', fontSize: '0.9rem', textAlign: 'center' }}>{val}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>No hay visitas agendadas para mañana</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* CHARTS SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: '24px', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)', textAlign: 'center' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '20px', letterSpacing: '0.06em' }}>Gestión por Agente</h3>
                <div style={{ height: '230px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <canvas ref={chartAgenteRef}></canvas>
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: '24px', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)', textAlign: 'center' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '20px', letterSpacing: '0.06em' }}>Tipo de Atención</h3>
                <div style={{ height: '230px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <canvas ref={chartTipoRef}></canvas>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: VISITAS MAÑANA */}
        {activeTab === 'tab-manana' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: '20px', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ background: '#1e3a8a', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '14px', marginBottom: '16px' }}>
              <i className="fa-solid fa-calendar-day" style={{ fontSize: '1.1rem', color: '#60a5fa' }}></i>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Visitas Planificadas para el Día Siguiente</h2>
            </div>

            {visitasManana.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, color: '#f8fafc' }}>
                      <th style={{ padding: '12px 16px', width: '50px' }}>#</th>
                      <th style={{ padding: '12px 16px' }}>Cliente</th>
                      <th style={{ padding: '12px 16px' }}>Sector / Zona</th>
                      <th style={{ padding: '12px 16px' }}>Daño / Problema</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitasManana.map((v, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 500 }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>{v.cliente}</td>
                        <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{v.sector || 'No registrado'}</td>
                        <td style={{ padding: '12px 16px', color: '#f87171', fontWeight: 600 }}>{v.problema || 'No detallado'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {v.estado || 'PENDIENTE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontStyle: 'italic' }}>
                <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.1)', marginBottom: '12px', display: 'block' }}></i>
                No hay visitas agendadas para el día siguiente.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIVIDADES REALIZADAS */}
        {activeTab === 'tab-actividades' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: '20px', boxShadow: '0 15px 30px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ background: '#14532d', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '14px', marginBottom: '16px' }}>
              <i className="fa-solid fa-screwdriver-wrench" style={{ fontSize: '1.1rem', color: '#4ade80' }}></i>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Resumen de Actividades de Técnicos Realizadas Hoy</h2>
            </div>

            {actividadesTecnicos.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, color: '#f8fafc' }}>
                      <th style={{ padding: '12px 16px' }}>Técnico Principal</th>
                      <th style={{ padding: '12px 16px' }}>Técnico Apoyo</th>
                      <th style={{ padding: '12px 16px' }}>Solución Aplicada</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Área</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actividadesTecnicos.map((a, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>{a.tecnico_principal}</td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{a.tecnico_apoyo || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#cbd5e1', fontWeight: 600 }}>{a.solucion_tecnico}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {a.es_instalacion === 1 ? (
                            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>Instalación</span>
                          ) : (
                            <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>Soporte VT</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{a.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontStyle: 'italic' }}>
                <i className="fa-solid fa-list-check" style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.1)', marginBottom: '12px', display: 'block' }}></i>
                No se registran actividades finalizadas para el día de hoy.
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: 'center', padding: '20px 0 40px 0', fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
          Futurity Routing Optimizer © 2026
        </div>

      </div>
    </div>
  );
}

export default PublicoCuadroMando;
