import React, { useState, useEffect } from 'react';

const MESES = [
  { id: 1, nombre: 'Enero', abrev: 'ENE' },
  { id: 2, nombre: 'Febrero', abrev: 'FEB' },
  { id: 3, nombre: 'Marzo', abrev: 'MAR' },
  { id: 4, nombre: 'Abril', abrev: 'ABR' },
  { id: 5, nombre: 'Mayo', abrev: 'MAY' },
  { id: 6, nombre: 'Junio', abrev: 'JUN' },
  { id: 7, nombre: 'Julio', abrev: 'JUL' },
  { id: 8, nombre: 'Agosto', abrev: 'AGO' },
  { id: 9, nombre: 'Septiembre', abrev: 'SEP' },
  { id: 10, nombre: 'Octubre', abrev: 'OCT' },
  { id: 11, nombre: 'Noviembre', abrev: 'NOV' },
  { id: 12, nombre: 'Diciembre', abrev: 'DIC' }
];

const ANIOS = [2024, 2025, 2026, 2027];

function formatHorasToHms(horasDecimal) {
  if (horasDecimal === null || horasDecimal === undefined || isNaN(horasDecimal)) return '00:00:00';
  const totalSegundos = Math.max(0, Math.round(horasDecimal * 3600));
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = totalSegundos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFechaArcotel(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})/);
  if (m) {
    const [_, y, mo, d, h, mi] = m;
    return `${parseInt(d, 10)}/${parseInt(mo, 10)}/${y} ${h}:${mi}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dia = d.getUTCDate();
      const mes = d.getUTCMonth() + 1;
      const anio = d.getUTCFullYear();
      const h = String(d.getUTCHours()).padStart(2, '0');
      const mi = String(d.getUTCMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${h}:${mi}`;
    }
  } catch (e) {}
  return s.replace('T', ' ');
}

export default function ReporteArcotelSubTab({ token }) {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [excluir24h, setExcluir24h] = useState(true);
  const [activeReportTab, setActiveReportTab] = useState('gpon'); // 'gpon', 'hfc', 'velocidad'

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({
    totales: { gpon: 0, hfc: 0, velocidad: 0, total_general: 0 },
    gpon: [],
    hfc: [],
    velocidad: [],
    trimestre: 'TERCERO',
    mes_nombre: 'JULIO'
  });

  // Filas editables localmente
  const [filasGpon, setFilasGpon] = useState([]);
  const [filasHfc, setFilasHfc] = useState([]);
  const [filasVel, setFilasVel] = useState([]);

  // Búsqueda en tabla
  const [searchQuery, setSearchQuery] = useState('');
  const [descargando, setDescargando] = useState(false);

  // Cargar datos al cambiar mes, año o filtro de 24h
  useEffect(() => {
    cargarDatos();
  }, [mes, anio, excluir24h]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reportes_arcotel/preview?mes=${mes}&anio=${anio}&excluir_24h=${excluir24h ? '1' : '0'}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setReportData(data);
        setFilasGpon(data.gpon || []);
        setFilasHfc(data.hfc || []);
        setFilasVel(data.velocidad || []);
      } else {
        setError(data.message || 'Error al obtener los datos de ARCOTEL.');
      }
    } catch (e) {
      console.error("Error cargando reporte ARCOTEL:", e);
      setError("Error al conectar con el servidor para generar el reporte de ARCOTEL.");
    } finally {
      setLoading(false);
    }
  };

  // Cálculo de tiempos promedio
  const calcularPromedioHoras = (lista) => {
    if (!lista || lista.length === 0) return 0;
    const suma = lista.reduce((acc, curr) => acc + (curr.dur_horas || 0), 0);
    return (suma / lista.length).toFixed(2);
  };

  const promedioGpon = calcularPromedioHoras(filasGpon);
  const promedioHfc = calcularPromedioHoras(filasHfc);

  // Descargar archivo Excel individual o personalizado
  const handleDescargarExcel = async (tipo) => {
    setDescargando(true);
    try {
      let filas = [];
      if (tipo === 'gpon') filas = filasGpon;
      else if (tipo === 'hfc') filas = filasHfc;
      else if (tipo === 'velocidad') filas = filasVel;

      const res = await fetch('/api/admin/reportes_arcotel/descargar_personalizado', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo,
          mes,
          anio,
          filas
        })
      });

      if (!res.ok) throw new Error("Error en la descarga del archivo.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const mesObj = MESES.find(m => m.id === Number(mes)) || { nombre: 'MES', abrev: 'M' };
      if (tipo === 'gpon') a.download = `GPON-${mesObj.nombre.toUpperCase()}-${anio}.xlsx`;
      else if (tipo === 'hfc') a.download = `HFC_${mesObj.abrev}_${anio}.xlsx`;
      else if (tipo === 'velocidad') a.download = `VELOCIDAD-${mesObj.nombre.toUpperCase()}-${anio}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Hubo un error al descargar el archivo Excel.");
    } finally {
      setDescargando(false);
    }
  };

  // Descargar paquete ZIP
  const handleDescargarZip = async () => {
    setDescargando(true);
    try {
      const res = await fetch(`/api/admin/reportes_arcotel/descargar?tipo=zip&mes=${mes}&anio=${anio}&excluir_24h=${excluir24h ? '1' : '0'}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Error al generar el ZIP de ARCOTEL.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const mesObj = MESES.find(m => m.id === Number(mes)) || { nombre: 'MES' };
      a.download = `REPORTES_ARCOTEL_${mesObj.nombre.toUpperCase()}_${anio}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Hubo un error al descargar el paquete ZIP.");
    } finally {
      setDescargando(false);
    }
  };

  // Manejo de edición en celdas
  const handleEditVelocidad = (idx, field, value) => {
    const updated = [...filasVel];
    updated[idx][field] = value;
    setFilasVel(updated);
  };

  const handleEditGpon = (idx, field, value) => {
    const updated = [...filasGpon];
    updated[idx][field] = value;
    setFilasGpon(updated);
  };

  const handleEditHfc = (idx, field, value) => {
    const updated = [...filasHfc];
    updated[idx][field] = value;
    setFilasHfc(updated);
  };

  // Filtro de búsqueda
  const filtrarFilas = (lista) => {
    if (!searchQuery.trim()) return lista;
    const q = searchQuery.toLowerCase().trim();
    return lista.filter(r => 
      (r.cliente && r.cliente.toLowerCase().includes(q)) ||
      (r.telefonos && r.telefonos.includes(q)) ||
      (r.averia && r.averia.toLowerCase().includes(q)) ||
      (r.categoria && r.categoria.toLowerCase().includes(q)) ||
      (r.solucion && r.solucion.toLowerCase().includes(q)) ||
      (r.id_visita && String(r.id_visita).includes(q))
    );
  };

  const filasGponFiltradas = filtrarFilas(filasGpon);
  const filasHfcFiltradas = filtrarFilas(filasHfc);
  const filasVelFiltradas = filtrarFilas(filasVel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Banner Superior Regulatorio ARCOTEL */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
        color: '#f8fafc',
        padding: '24px 28px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
          }}>
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Módulo Regulatorio ARCOTEL
              </h2>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                NORMA TPRA
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.88rem' }}>
              Generación automatizada de los 3 reportes mensuales: <strong>GPON/Radial</strong>, <strong>Cable/HFC (SAV-Q-001)</strong> y <strong>Velocidad</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDescargarZip}
            disabled={descargando || loading}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 22px',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: (descargando || loading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s ease',
              opacity: (descargando || loading) ? 0.7 : 1
            }}
          >
            <i className="fa-solid fa-file-zipper"></i>
            {descargando ? 'Generando Paquete...' : 'Descargar los 3 Reportes (.ZIP)'}
          </button>
        </div>
      </div>

      {/* Controles de Período y Filtro de 24 Horas */}
      <div style={{
        background: 'var(--card-bg)',
        padding: '20px 24px',
        borderRadius: '18px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Selector de Mes y Año */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Mes de Reporte:
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              style={{
                padding: '9px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              {MESES.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Año:
            </label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              style={{
                padding: '9px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              {ANIOS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading}
            style={{
              marginTop: '22px',
              padding: '9px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            Recargar
          </button>
        </div>

        {/* Interruptor Excluir > 24 Horas */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: excluir24h ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          padding: '10px 18px',
          borderRadius: '14px',
          border: `1px solid ${excluir24h ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          <input
            type="checkbox"
            id="chk-excluir-24h"
            checked={excluir24h}
            onChange={(e) => setExcluir24h(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
          />
          <label htmlFor="chk-excluir-24h" style={{ cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', color: excluir24h ? '#059669' : '#dc2626' }}>
              {excluir24h ? '✓ Excluir averías > 24 horas (Requisito ARCOTEL)' : '⚠️ Incluyendo averías > 24 horas'}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)' }}>
              {excluir24h 
                ? 'Garantiza que el 100% de los casos reportados cumplan con la norma de resolución < 24h.' 
                : 'Se mostrarán todas las visitas finalizadas del mes sin filtrar por duración.'}
            </span>
          </label>
        </div>
      </div>

      {/* Tarjetas KPI Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* KPI GPON */}
        <div 
          onClick={() => setActiveReportTab('gpon')}
          style={{
            background: activeReportTab === 'gpon' ? 'rgba(37, 99, 235, 0.08)' : 'var(--card-bg)',
            border: `2px solid ${activeReportTab === 'gpon' ? 'var(--primary)' : 'var(--border-color)'}`,
            padding: '18px 20px',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
              1. GPON / Radial
            </span>
            <span style={{ background: '#2563eb', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
              11 Cols
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {filasGpon.length}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700 }}>
              Promedio: {promedioGpon} h
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', marginTop: '4px', display: 'block' }}>
            Tiempo Promedio de Reparación de Averías
          </span>
        </div>

        {/* KPI HFC */}
        <div 
          onClick={() => setActiveReportTab('hfc')}
          style={{
            background: activeReportTab === 'hfc' ? 'rgba(234, 88, 12, 0.08)' : 'var(--card-bg)',
            border: `2px solid ${activeReportTab === 'hfc' ? '#ea580c' : 'var(--border-color)'}`,
            padding: '18px 20px',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
              2. Cable / HFC
            </span>
            <span style={{ background: '#ea580c', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
              SAV-Q-001 (8 Cols)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {filasHfc.length}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700 }}>
              Promedio: {promedioHfc} h
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', marginTop: '4px', display: 'block' }}>
            Trimestre: {reportData.trimestre}
          </span>
        </div>

        {/* KPI VELOCIDAD */}
        <div 
          onClick={() => setActiveReportTab('velocidad')}
          style={{
            background: activeReportTab === 'velocidad' ? 'rgba(147, 51, 234, 0.08)' : 'var(--card-bg)',
            border: `2px solid ${activeReportTab === 'velocidad' ? '#9333ea' : 'var(--border-color)'}`,
            padding: '18px 20px',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
              3. Reclamos Velocidad
            </span>
            <span style={{ background: '#9333ea', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
              10 Cols
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {filasVel.length}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#9333ea', fontWeight: 700 }}>
              Kbps (Kbps contratados)
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', marginTop: '4px', display: 'block' }}>
            Capacidad Suministrada (20% por defecto)
          </span>
        </div>

        {/* KPI TOTAL GENERAL */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          padding: '18px 20px',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
              Cumplimiento Regulatorio
            </span>
            <span style={{ background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
              100% &lt; 24h
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
              {reportData.totales?.total_general || 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
              casos auditados
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', marginTop: '4px', display: 'block' }}>
            {MESES.find(m => m.id === Number(mes))?.nombre.toUpperCase()} {anio}
          </span>
        </div>

      </div>

      {/* Pestañas de Visualización de las 3 Plantillas */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        
        {/* Barra superior de pestañas y acciones */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveReportTab('gpon')}
              style={{
                background: activeReportTab === 'gpon' ? 'var(--primary)' : 'var(--bg-main)',
                color: activeReportTab === 'gpon' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-network-wired"></i> GPON / Radial ({filasGpon.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('hfc')}
              style={{
                background: activeReportTab === 'hfc' ? '#ea580c' : 'var(--bg-main)',
                color: activeReportTab === 'hfc' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-tv"></i> Cable / HFC ({filasHfc.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('velocidad')}
              style={{
                background: activeReportTab === 'velocidad' ? '#9333ea' : 'var(--bg-main)',
                color: activeReportTab === 'velocidad' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-gauge-high"></i> Velocidad ({filasVel.length})
            </button>
          </div>

          {/* Buscador y Botón de Descarga Individual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--sidebar-text)' }}></i>
              <input
                type="text"
                placeholder="Filtrar cliente, teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => handleDescargarExcel(activeReportTab)}
              disabled={descargando || loading}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: (descargando || loading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              <i className="fa-solid fa-file-excel"></i>
              {descargando ? 'Generando...' : `Descargar ${activeReportTab.toUpperCase()} (.xlsx)`}
            </button>
          </div>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '16px',
            fontWeight: 600,
            fontSize: '0.9rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        {/* Tablas de Previsualización según pestaña activa */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--sidebar-text)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px', color: 'var(--primary)' }}></i>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Procesando y homologando visitas para ARCOTEL...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '550px' }}>

            {/* TABLA GPON (11 Columnas) */}
            {activeReportTab === 'gpon' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#d9e1f2', color: '#1e293b', borderBottom: '1px solid #cbd5e1' }}>
                    <th colSpan={6} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, borderRight: '2px solid #94a3b8' }}>
                      1) DATOS DEL INGRESO DEL RECLAMO
                    </th>
                    <th colSpan={5} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, background: '#fce4d6' }}>
                      2) DETALLES DEL RECLAMO
                    </th>
                  </tr>
                  <tr style={{ background: 'var(--bg-main)', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '50px' }}>ITEM</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>PROVINCIA</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>CLIENTE</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>TELÉFONO</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>CONEXIÓN</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>CANAL</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>TIPO DE AVERÍA</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>FECHA REPORTE</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>FECHA REPARACIÓN</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>TIEMPO (H)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>DESCRIPCIÓN SOLUCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {filasGponFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                        No se encontraron registros de GPON/Radial para este período con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filasGponFiltradas.map((r, idx) => (
                      <tr key={r.id_visita || idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700 }}>{r.item}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.provincia}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.cliente}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.telefonos}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.8rem' }}>{r.tipo_conexion}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>{r.canal}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            value={r.averia || ''}
                            onChange={(e) => handleEditGpon(idx, 'averia', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {formatFechaArcotel(r.fecha_registro)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {formatFechaArcotel(r.hora_fin_visita)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: r.dur_horas > 24 ? '#dc2626' : '#059669' }}>
                          {formatHorasToHms(r.dur_horas)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            value={r.solucion || ''}
                            onChange={(e) => handleEditGpon(idx, 'solucion', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* TABLA HFC (8 Columnas - SAV-Q-001) */}
            {activeReportTab === 'hfc' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#1e293b', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '50px' }}>N°. ITEM</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>NOMBRE Y APELLIDO DEL SUSCRIPTOR</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>TELÉFONO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>FORMA DE RECLAMO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>CATEGORÍA</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>DESCRIPCIÓN DEL REQUERIMIENTO</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>FECHA INGRESO</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>FECHA SOLUCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {filasHfcFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                        No se encontraron registros de Cable / HFC para este período.
                      </td>
                    </tr>
                  ) : (
                    filasHfcFiltradas.map((r, idx) => (
                      <tr key={r.id_visita || idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700 }}>{r.item}</td>
                        <td style={{ padding: '8px 14px', fontWeight: 600 }}>{r.cliente}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.telefonos}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.canal}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            value={r.categoria || ''}
                            onChange={(e) => handleEditHfc(idx, 'categoria', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <input
                            type="text"
                            value={r.solucion || ''}
                            onChange={(e) => handleEditHfc(idx, 'solucion', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {formatFechaArcotel(r.fecha_registro)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {formatFechaArcotel(r.hora_fin_visita)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* TABLA VELOCIDAD (10 Columnas) */}
            {activeReportTab === 'velocidad' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#d9e1f2', color: '#1e293b', borderBottom: '1px solid #cbd5e1' }}>
                    <th colSpan={5} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, borderRight: '2px solid #94a3b8' }}>
                      1) DATOS DEL INGRESO DEL RECLAMO
                    </th>
                    <th colSpan={5} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, background: '#fce4d6' }}>
                      2) DETALLES DEL RECLAMO
                    </th>
                  </tr>
                  <tr style={{ background: 'var(--bg-main)', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '50px' }}>ITEM</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>PROVINCIA</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>FECHA REGISTRO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>NOMBRE RECLAMANTE</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>TELÉFONO</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>CANAL</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>CAPACIDAD (Kbps)</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>COMP.</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>% SUMINISTRADO (Kbps)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>DESCRIPCIÓN SOLUCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVelFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                        No se encontraron reclamos de velocidad para este período con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filasVelFiltradas.map((r, idx) => (
                      <tr key={r.id_visita || idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700 }}>{r.item}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.provincia}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {formatFechaArcotel(r.fecha_registro)}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.cliente}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>{r.telefonos}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.canal}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                          <input
                            type="number"
                            value={r.capacidad_kbps || ''}
                            onChange={(e) => handleEditVelocidad(idx, 'capacidad_kbps', Number(e.target.value))}
                            style={{
                              width: '90px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              textAlign: 'center',
                              fontWeight: 700
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>{r.comparticion}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={r.objeto_reclamo_kbps || ''}
                            onChange={(e) => handleEditVelocidad(idx, 'objeto_reclamo_kbps', Number(e.target.value))}
                            title="Editable: valor objeto del reclamo en Kbps (por defecto 20%)"
                            style={{
                              width: '90px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid #9333ea',
                              background: 'var(--card-bg)',
                              color: '#9333ea',
                              textAlign: 'center',
                              fontWeight: 800
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            value={r.solucion || ''}
                            onChange={(e) => handleEditVelocidad(idx, 'solucion', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
