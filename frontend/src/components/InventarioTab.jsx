import React, { useState, useEffect } from 'react';

function InventarioTab({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data from API
  const [materiales, setMateriales] = useState([]);
  const [tecnicos, setTecnicos] = useState([]); // List of vehicle plates
  const [inventarioTecnicos, setInventarioTecnicos] = useState({}); // { plate: { id_material: { cantidad_disponible, total_usado } } }
  
  // KPIs
  const [kpiBodega, setKpiBodega] = useState(0);
  const [kpiCustodia, setKpiCustodia] = useState(0);
  const [kpiConsumo, setKpiConsumo] = useState(0);

  // Filter
  const [filtroTecnico, setFiltroTecnico] = useState('');

  // Modals Visibility
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);

  // Form States
  const [formIngreso, setFormIngreso] = useState({ id_material: '', cantidad: '' });
  const [formEntrega, setFormEntrega] = useState({ tecnico_nombre: '', id_material: '', cantidad: '' });
  const [formDevolucion, setFormDevolucion] = useState({ tecnico_nombre: '', id_material: '', cantidad: '' });

  useEffect(() => {
    cargarInventario();
  }, []);

  const cargarInventario = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/inventario', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setMateriales(data.materiales || []);
        setTecnicos(data.tecnicos || []);
        setInventarioTecnicos(data.inventario_tecnicos || {});

        // Set default filter if plates exist
        if (data.tecnicos && data.tecnicos.length > 0) {
          setFiltroTecnico((prev) => {
            if (data.tecnicos.includes(prev)) return prev;
            return data.tecnicos[0];
          });
        }

        // Calculate KPIs
        let totalB = 0;
        let totalC = 0;
        let totalU = 0;

        (data.materiales || []).forEach(m => {
          totalB += (m.stock_bodega || 0);
        });

        Object.values(data.inventario_tecnicos || {}).forEach(tecInv => {
          Object.values(tecInv || {}).forEach(info => {
            totalC += (info.cantidad_disponible || 0);
            totalU += (info.total_usado || 0);
          });
        });

        setKpiBodega(totalB);
        setKpiCustodia(totalC);
        setKpiConsumo(totalU);
      } else {
        setError(data.message || 'Error al obtener datos de inventario.');
      }
    } catch (err) {
      console.error('Error al conectar con la API de inventario:', err);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // --- Transacciones ---

  const handleIngresoSubmit = async (e) => {
    e.preventDefault();
    const idMat = formIngreso.id_material || (materiales[0]?.id_material);
    const cant = parseInt(formIngreso.cantidad);

    if (!idMat || isNaN(cant) || cant <= 0) {
      alert('Por favor ingrese parámetros válidos.');
      return;
    }

    try {
      const res = await fetch('/api/admin/inventario/bodega/ingreso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_material: parseInt(idMat), cantidad: cant })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setShowIngresoModal(false);
        setFormIngreso({ id_material: '', cantidad: '' });
        await cargarInventario();
      } else {
        alert(data.message || 'Error al registrar ingreso.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const handleEntregaSubmit = async (e) => {
    e.preventDefault();
    const tec = formEntrega.tecnico_nombre || tecnicos[0];
    const idMat = formEntrega.id_material || (materiales[0]?.id_material);
    const cant = parseInt(formEntrega.cantidad);

    if (!tec || !idMat || isNaN(cant) || cant <= 0) {
      alert('Por favor ingrese parámetros válidos.');
      return;
    }

    try {
      const res = await fetch('/api/admin/inventario/tecnico/entrega', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tecnico_nombre: tec, id_material: parseInt(idMat), cantidad: cant })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setShowEntregaModal(false);
        setFormEntrega({ tecnico_nombre: '', id_material: '', cantidad: '' });
        await cargarInventario();
      } else {
        alert(data.message || 'Error al registrar entrega.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const handleDevolucionSubmit = async (e) => {
    e.preventDefault();
    const tec = formDevolucion.tecnico_nombre || tecnicos[0];
    const idMat = formDevolucion.id_material || (materiales[0]?.id_material);
    const cant = parseInt(formDevolucion.cantidad);

    if (!tec || !idMat || isNaN(cant) || cant <= 0) {
      alert('Por favor ingrese parámetros válidos.');
      return;
    }

    try {
      const res = await fetch('/api/admin/inventario/tecnico/devolucion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tecnico_nombre: tec, id_material: parseInt(idMat), cantidad: cant })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setShowDevolucionModal(false);
        setFormDevolucion({ tecnico_nombre: '', id_material: '', cantidad: '' });
        await cargarInventario();
      } else {
        alert(data.message || 'Error al registrar devolución.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const tecInventoryDetails = inventarioTecnicos[filtroTecnico] || {};

  return (
    <div id="tab-inventario" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Header Banner */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'rgba(31, 73, 125, 0.12)', color: '#1f497d', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          <i className="fa-solid fa-warehouse"></i>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Control de Inventario y Bodega
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Administración de stock en bodega principal y control de materiales en custodia de técnicos.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '15px' }}></i>
          <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 600 }}>Cargando estado del inventario...</p>
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '24px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
          <div>{error}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* KPIs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ background: 'rgba(31, 73, 125, 0.1)', color: '#1f497d', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                <i className="fa-solid fa-warehouse"></i>
              </div>
              <div>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{kpiBodega}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Stock en Bodega</p>
              </div>
            </div>
            
            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                <i className="fa-solid fa-people-carry-box"></i>
              </div>
              <div>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{kpiCustodia}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Custodia por Placa</p>
              </div>
            </div>
            
            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                <i className="fa-solid fa-wrench"></i>
              </div>
              <div>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{kpiConsumo}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Consumo Total</p>
              </div>
            </div>
          </div>

          {/* Columns Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '25px' }}>
            
            {/* Bodega Principal Card */}
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-boxes-stacked"></i> Stock en Bodega Principal
                </h3>
                <button 
                  type="button" 
                  onClick={() => {
                    if (materiales.length > 0) {
                      setFormIngreso({ id_material: materiales[0].id_material.toString(), cantidad: '' });
                    }
                    setShowIngresoModal(true);
                  }} 
                  style={{ padding: '8px 15px', fontSize: '0.85rem', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-plus"></i> Ingresar Material
                </button>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Material</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>U. Medida</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiales.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>{m.nombre_material}</td>
                        <td style={{ padding: '12px 15px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{m.unidad_medida}</td>
                        <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: '#1f497d', fontSize: '1rem' }}>{m.stock_bodega}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asignación y Custodia por Placa Card */}
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-people-carry-box"></i> Custodia por Placa de Vehículo
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (tecnicos.length > 0 && materiales.length > 0) {
                        setFormEntrega({ tecnico_nombre: tecnicos[0], id_material: materiales[0].id_material.toString(), cantidad: '' });
                      }
                      setShowEntregaModal(true);
                    }} 
                    style={{ padding: '8px 14px', fontSize: '0.82rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-truck-ramp-box"></i> Entregar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (tecnicos.length > 0 && materiales.length > 0) {
                        setFormDevolucion({ tecnico_nombre: tecnicos[0], id_material: materiales[0].id_material.toString(), cantidad: '' });
                      }
                      setShowDevolucionModal(true);
                    }} 
                    style={{ padding: '8px 14px', fontSize: '0.82rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-rotate-left"></i> Devolución
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Filtrar por Placa de Vehículo:</label>
                <select 
                  value={filtroTecnico} 
                  onChange={(e) => setFiltroTecnico(e.target.value)} 
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, outline: 'none' }}
                >
                  {tecnicos.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Material</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>U. Medida</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>En Custodia</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Consumido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiales.map((m, i) => {
                      const info = tecInventoryDetails[m.id_material.toString()] || { cantidad_disponible: 0, total_usado: 0 };
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>{m.nombre_material}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{m.unidad_medida}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: '#6366f1', fontSize: '1rem' }}>{info.cantidad_disponible}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{info.total_usado}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: INGRESO A BODEGA */}
      {showIngresoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#1f497d', fontSize: '1.05rem', fontWeight: 850 }}><i className="fa-solid fa-plus-circle"></i> Ingresar Material a Bodega</h5>
              <button type="button" onClick={() => setShowIngresoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleIngresoSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Material:</label>
                  <select 
                    value={formIngreso.id_material} 
                    onChange={(e) => setFormIngreso({ ...formIngreso, id_material: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {materiales.map((m, idx) => <option key={idx} value={m.id_material}>{m.nombre_material} ({m.unidad_medida})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Cantidad a Ingresar:</label>
                  <input 
                    type="number" 
                    value={formIngreso.cantidad} 
                    onChange={(e) => setFormIngreso({ ...formIngreso, cantidad: e.target.value })} 
                    placeholder="Ej. 100" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600, boxSizing: 'border-box' }}
                    min="1"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowIngresoModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '10px 20px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Guardar Ingreso</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ENTREGAR A TÉCNICO / PLACA */}
      {showEntregaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#6366f1', fontSize: '1.05rem', fontWeight: 850 }}><i className="fa-solid fa-truck-ramp-box"></i> Entregar Material a Placa</h5>
              <button type="button" onClick={() => setShowEntregaModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleEntregaSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Placa:</label>
                  <select 
                    value={formEntrega.tecnico_nombre} 
                    onChange={(e) => setFormEntrega({ ...formEntrega, tecnico_nombre: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {tecnicos.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Material:</label>
                  <select 
                    value={formEntrega.id_material} 
                    onChange={(e) => setFormEntrega({ ...formEntrega, id_material: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {materiales.map((m, idx) => <option key={idx} value={m.id_material}>{m.nombre_material} ({m.unidad_medida})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Cantidad a Entregar:</label>
                  <input 
                    type="number" 
                    value={formEntrega.cantidad} 
                    onChange={(e) => setFormEntrega({ ...formEntrega, cantidad: e.target.value })} 
                    placeholder="Ej. 50" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600, boxSizing: 'border-box' }}
                    min="1"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowEntregaModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Entregar Material</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DEVOLUCIÓN DE TÉCNICO */}
      {showDevolucionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#ef4444', fontSize: '1.05rem', fontWeight: 850 }}><i className="fa-solid fa-rotate-left"></i> Devolución de Insumos a Bodega</h5>
              <button type="button" onClick={() => setShowDevolucionModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleDevolucionSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Placa:</label>
                  <select 
                    value={formDevolucion.tecnico_nombre} 
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, tecnico_nombre: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {tecnicos.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Material:</label>
                  <select 
                    value={formDevolucion.id_material} 
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, id_material: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {materiales.map((m, idx) => <option key={idx} value={m.id_material}>{m.nombre_material} ({m.unidad_medida})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Cantidad a Devolver:</label>
                  <input 
                    type="number" 
                    value={formDevolucion.cantidad} 
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, cantidad: e.target.value })} 
                    placeholder="Ej. 10" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600, boxSizing: 'border-box' }}
                    min="1"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowDevolucionModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Devolver a Bodega</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default InventarioTab;
