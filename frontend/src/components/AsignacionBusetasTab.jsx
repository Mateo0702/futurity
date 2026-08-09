import React, { useState, useEffect } from 'react';

function AsignacionBusetasTab({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data
  const [tecnicosVehiculos, setTecnicosVehiculos] = useState([]);
  const [traspasosHistorial, setTraspasosHistorial] = useState([]);
  const [listaVehiculos, setListaVehiculos] = useState([]);

  // Subtab
  const [subTab, setSubTab] = useState('asignacion'); // 'asignacion' | 'vehiculos' | 'traspasos'

  // Reassignment Modal State
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState(null);
  const [nuevaPlacaInput, setNuevaPlacaInput] = useState('');
  const [transferirInventario, setTransferirInventario] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New Vehicle Modal / Form State
  const [showCrearVehiculoModal, setShowCrearVehiculoModal] = useState(false);
  const [formVehiculo, setFormVehiculo] = useState({ placa: '', descripcion: '' });
  const [creandoVehiculo, setCreandoVehiculo] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Cargar lista de técnicos con sus placas
      const resInv = await fetch('/api/admin/inventario', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataInv = await resInv.json();
      if (resInv.ok && dataInv.status === 'ok') {
        setTecnicosVehiculos(dataInv.tecnicos_vehiculos || []);
      } else {
        setError(dataInv.message || 'Error al obtener lista de vehículos.');
      }

      // 2. Cargar vehículos registrados
      await cargarVehiculos();

      // 3. Cargar historial de traspasos
      await cargarTraspasosHistorial();
    } catch (err) {
      console.error('Error al conectar con la API:', err);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const cargarVehiculos = async () => {
    try {
      const res = await fetch('/api/admin/vehiculos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setListaVehiculos(data.vehiculos || []);
      }
    } catch (e) {
      console.error("Error al cargar lista de vehículos:", e);
    }
  };

  const handleCrearVehiculoSubmit = async (e) => {
    if (e) e.preventDefault();
    const p = formVehiculo.placa.trim().toUpperCase();
    if (!p) {
      alert("Por favor ingresa una placa válida.");
      return;
    }
    setCreandoVehiculo(true);
    try {
      const res = await fetch('/api/admin/vehiculos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ placa: p, descripcion: formVehiculo.descripcion })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Vehículo registrado correctamente.");
        setShowCrearVehiculoModal(false);
        setFormVehiculo({ placa: '', descripcion: '' });
        setNuevaPlacaInput(p); // auto-select new plate
        await cargarVehiculos();
      } else {
        alert(data.message || "Error al registrar vehículo.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al guardar vehículo.");
    } finally {
      setCreandoVehiculo(false);
    }
  };

  const cargarTraspasosHistorial = async () => {
    try {
      const res = await fetch('/api/admin/traspasos_historial', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setTraspasosHistorial(data.traspasos || []);
      }
    } catch (e) {
      console.error("Error al cargar historial de traspasos:", e);
    }
  };

  const handleReasignarSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTecnico) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/tecnicos/reasignar_vehiculo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id_tecnico: selectedTecnico.id_tecnico,
          placa_asignada_hoy: nuevaPlacaInput,
          transferir_inventario: transferirInventario
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Asignación de buseta actualizada con éxito.");
        setShowReasignarModal(false);
        setSelectedTecnico(null);
        setNuevaPlacaInput('');
        await cargarDatos();
      } else {
        alert(data.message || "Error al actualizar asignación.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al reasignar vehículo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetTitular = async (tec) => {
    if (!tec) return;
    const transferir = window.confirm("¿Deseas devolver la custodia física de los insumos a la buseta titular?");
    try {
      const res = await fetch('/api/admin/tecnicos/reasignar_vehiculo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id_tecnico: tec.id_tecnico,
          placa_asignada_hoy: 'RESET',
          transferir_inventario: transferir
        })
      });
      if (res.ok) {
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="tab-asignacion-busetas" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>

      {/* Header Banner */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'rgba(31, 73, 125, 0.12)', color: '#1f497d', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          <i className="fa-solid fa-truck-front"></i>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Asignación de Furgonetas
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Gestión diaria de vehículos para la cuadrilla técnica (Call Center / Admins) y control de traspasos.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '15px' }}></i>
          <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 600 }}>Cargando asignación de vehículos...</p>
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '24px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
          <div>{error}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

          {/* Navigation Subtabs Bar */}
          <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setSubTab('asignacion')}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: subTab === 'asignacion' ? 'var(--primary)' : 'var(--profile-bg)',
                color: subTab === 'asignacion' ? 'white' : 'var(--text-main)',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-truck-front"></i> Asignación de Placas
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('vehiculos');
                cargarVehiculos();
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: subTab === 'vehiculos' ? 'var(--primary)' : 'var(--profile-bg)',
                color: subTab === 'vehiculos' ? 'white' : 'var(--text-main)',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-car"></i> Catálogo Furgonetas
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('traspasos');
                cargarTraspasosHistorial();
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: subTab === 'traspasos' ? 'var(--primary)' : 'var(--profile-bg)',
                color: subTab === 'traspasos' ? 'white' : 'var(--text-main)',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-arrow-right-arrow-left"></i> Historial de Traspasos
            </button>
          </div>

          {/* VISTA 1: Asignación de Placas */}
          {subTab === 'asignacion' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-truck-front"></i> Placa de Vehículo Asignada a Cada Técnico
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Si un técnico sale en otra buseta por choque o mantenimiento, cámbiala aquí para descontar correctamente los insumos.
                  </span>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Técnico</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Placa Titular</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Placa Asignada Hoy</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Estado Buseta</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Acciones (Call Center / Admin)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tecnicosVehiculos.map((tec, i) => {
                      const tieneReasignacion = tec.placa_asignada_hoy && tec.placa_asignada_hoy !== tec.placa_vehiculo;
                      const placaActiva = tec.placa_asignada_hoy || tec.placa_vehiculo || 'S/P';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>
                            <i className="fa-solid fa-user-gear" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
                            {tec.nombre}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                            {tec.placa_vehiculo || 'S/P'}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900 }}>
                            <span style={{ padding: '4px 10px', borderRadius: '8px', background: tieneReasignacion ? '#fef3c7' : '#e0e7ff', color: tieneReasignacion ? '#b45309' : '#3730a3', fontSize: '0.82rem' }}>
                              <i className="fa-solid fa-car-side" style={{ marginRight: '4px' }}></i>
                              {placaActiva}
                            </span>
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            {tieneReasignacion ? (
                              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', fontWeight: 800 }}>
                                ⚠️ Temporal (Reasignado)
                              </span>
                            ) : (
                              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontSize: '0.72rem', fontWeight: 800 }}>
                                🟢 Titular Habitual
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTecnico(tec);
                                  setNuevaPlacaInput(tec.placa_asignada_hoy || tec.placa_vehiculo || '');
                                  setShowReasignarModal(true);
                                }}
                                style={{ padding: '6px 12px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                <i className="fa-solid fa-pen-to-square"></i> Cambiar Buseta
                              </button>
                              {tieneReasignacion && (
                                <button
                                  type="button"
                                  onClick={() => handleResetTitular(tec)}
                                  style={{ padding: '6px 12px', background: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  <i className="fa-solid fa-rotate-left"></i> Restablecer Titular
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISTA 2: Catálogo / Flota de Furgonetas */}
          {subTab === 'vehiculos' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-car"></i> Catálogo Base de Furgonetas
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Registro oficial de placas de vehículos de la flota para evitar errores de digitación.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormVehiculo({ placa: '', descripcion: '' });
                    setShowCrearVehiculoModal(true);
                  }}
                  style={{ padding: '8px 16px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-plus-circle"></i> Registrar Nueva Placa
                </button>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Placa</th>
                      <th style={{ padding: '12px 15px' }}>Descripción / Nombre Furgoneta</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaVehiculos.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '25px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                          No hay vehículos registrados en la base de datos.
                        </td>
                      </tr>
                    ) : (
                      listaVehiculos.map((v, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 900, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            <i className="fa-solid fa-truck-front" style={{ marginRight: '8px', color: '#1f497d' }}></i>
                            {v.placa}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 600, color: 'var(--sidebar-text)' }}>
                            {v.descripcion || 'Sin descripción'}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            {v.activo === 1 ? (
                              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#dcfce7', color: '#166534', fontSize: '0.75rem', fontWeight: 800 }}>
                                🟢 Activa
                              </span>
                            ) : (
                              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '0.75rem', fontWeight: 800 }}>
                                🔴 Inactiva / Taller
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/admin/vehiculos/${v.id_vehiculo}/toggle`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  await cargarVehiculos();
                                }
                              }}
                              style={{ padding: '5px 12px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              {v.activo === 1 ? 'Desactivar' : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISTA 3: Historial de Traspasos */}
          {subTab === 'traspasos' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-arrow-right-arrow-left"></i> Historial Auditables de Traspasos entre Cuadrillas
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Registro en tiempo real de insumos prestados/transferidos directamente entre técnicos en campo.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cargarTraspasosHistorial}
                  style={{ padding: '6px 12px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-arrows-rotate"></i> Actualizar Listado
                </button>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Fecha y Hora</th>
                      <th style={{ padding: '12px 15px' }}>Técnico Origen</th>
                      <th style={{ padding: '12px 15px' }}>Técnico Destino</th>
                      <th style={{ padding: '12px 15px' }}>Material Transferido</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traspasosHistorial.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>
                          No se registran traspasos de materiales entre furgonetas hasta el momento.
                        </td>
                      </tr>
                    ) : (
                      traspasosHistorial.map((tr, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                            <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i> {tr.fecha_hora}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#ef4444' }}>
                            {tr.tecnico_origen} <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>({tr.placa_origen})</span>
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#10b981' }}>
                            {tr.tecnico_destino} <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>({tr.placa_destino})</span>
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {tr.nombre_material}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#d1fae5', color: '#065f46' }}>
                              +{tr.cantidad}
                            </span>
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                            {tr.agente_registro}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: REASIGNAR BUSETA A TÉCNICO */}
      {showReasignarModal && selectedTecnico && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#1f497d', fontSize: '1.05rem', fontWeight: 850 }}>
                <i className="fa-solid fa-truck-front"></i> Cambiar Buseta: {selectedTecnico.nombre}
              </h5>
              <button type="button" onClick={() => setShowReasignarModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleReasignarSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--sidebar-text)', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>Placa Titular Registrada:</label>
                  <input type="text" value={selectedTecnico.placa_vehiculo || 'S/P'} disabled style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--sidebar-text)', fontWeight: 700 }} />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      Seleccione Nueva Buseta / Placa:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormVehiculo({ placa: '', descripcion: '' });
                        setShowCrearVehiculoModal(true);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      + Nueva Placa
                    </button>
                  </div>

                  {/* ComboBox Dropdown de Placas Registradas */}
                  <select
                    value={nuevaPlacaInput}
                    onChange={(e) => setNuevaPlacaInput(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 800, outline: 'none' }}
                    required
                  >
                    <option value="">-- Seleccione Placa de la Flota --</option>
                    {listaVehiculos.filter(v => v.activo === 1).map((v, idx) => (
                      <option key={idx} value={v.placa}>
                        🚘 {v.placa} ({v.descripcion || 'Buseta de flota'})
                      </option>
                    ))}
                  </select>

                  <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', marginTop: '4px', display: 'block' }}>
                    * El consumo de insumos de las visitas de hoy se descontará de esta placa.
                  </span>
                </div>

                <div style={{ marginBottom: '20px', background: 'var(--profile-bg)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                    <input
                      type="checkbox"
                      checked={transferirInventario}
                      onChange={(e) => setTransferirInventario(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span>🚚 Trasladar insumos de la buseta anterior a esta buseta</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', display: 'block', marginTop: '4px', marginLeft: '26px' }}>
                    Si el técnico sacó sus materiales de la buseta averiada y los pasó a la buseta libre, marca esta opción para sincronizar el stock.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowReasignarModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" disabled={submitting} style={{ padding: '10px 20px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                    {submitting ? 'Guardando...' : 'Guardar Cambio'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREAR NUEVA PLACA EN LA BASE DE DATOS */}
      {showCrearVehiculoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#1f497d', fontSize: '1.05rem', fontWeight: 850 }}>
                <i className="fa-solid fa-plus-circle"></i> Registrar Nueva Furgoneta / Placa
              </h5>
              <button type="button" onClick={() => setShowCrearVehiculoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleCrearVehiculoSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Placa del Vehículo:</label>
                  <input
                    type="text"
                    value={formVehiculo.placa}
                    onChange={(e) => setFormVehiculo({ ...formVehiculo, placa: e.target.value.toUpperCase() })}
                    placeholder="Ej. PBA-4512"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 800, boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Descripción / Nombre Furgoneta:</label>
                  <input
                    type="text"
                    value={formVehiculo.descripcion}
                    onChange={(e) => setFormVehiculo({ ...formVehiculo, descripcion: e.target.value })}
                    placeholder="Ej. Chevrolet N300 - Furgoneta Libre #3"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowCrearVehiculoModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" disabled={creandoVehiculo} style={{ padding: '10px 20px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                    {creandoVehiculo ? 'Guardando...' : 'Guardar Placa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AsignacionBusetasTab;
