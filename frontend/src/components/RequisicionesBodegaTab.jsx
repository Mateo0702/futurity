import React, { useState, useEffect } from 'react';
import FirmaCanvasModal from './FirmaCanvasModal';

export default function RequisicionesBodegaTab({ token: tokenProp, placas: placasProp, tecnicosVehiculos = [], materialesProp }) {
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroPlaca, setFiltroPlaca] = useState('TODAS');
  const [placas, setPlacas] = useState(placasProp || []);
  const [materialesCat, setMaterialesCat] = useState(materialesProp || []);

  // Modales
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [showAprobarModal, setShowAprobarModal] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);

  const [selectedReq, setSelectedReq] = useState(null);

  // Formulario Crear
  const [nuevaPlaca, setNuevaPlaca] = useState('');
  const [nuevoTecnico, setNuevoTecnico] = useState('');
  const [itemsSolicitud, setItemsSolicitud] = useState([{ id_material: '', cantidad_solicitada: 1 }]);
  const [obsSolicitud, setObsSolicitud] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Items para Aprobación
  const [itemsAprobando, setItemsAprobando] = useState([]);

  const authToken = tokenProp || localStorage.getItem('token') || localStorage.getItem('session_token');

  useEffect(() => {
    if (placasProp && placasProp.length > 0) {
      setPlacas(placasProp);
    }
    if (materialesProp && materialesProp.length > 0) {
      setMaterialesCat(materialesProp);
    }
  }, [placasProp, materialesProp]);

  useEffect(() => {
    cargarDatos();
    cargarCatalogos();
  }, [filtroEstado, filtroPlaca, authToken]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/requisiciones?estado=${filtroEstado}&placa=${filtroPlaca}`;
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data?.status === 'ok') {
        setRequisiciones(data.requisiciones || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cargarCatalogos = async () => {
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch('/api/admin/inventario', { headers });
      const data = await res.json();
      if (data?.status === 'ok') {
        setMaterialesCat(data.materiales || []);
        const plist = data.placas || data.tecnicos || [];
        if (plist.length > 0) {
          setPlacas(plist);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlacaSeleccionadaChange = (p) => {
    setNuevaPlaca(p);
    // Buscar tecnico asociado a la placa
    const tecFound = tecnicosVehiculos.find(tv => tv.placa_vehiculo === p || tv.placa_asignada_hoy === p);
    if (tecFound) {
      setNuevoTecnico(tecFound.nombre);
    }
  };

  const handleAddItemSolicitud = () => {
    setItemsSolicitud([...itemsSolicitud, { id_material: '', cantidad_solicitada: 1 }]);
  };

  const handleRemoveItemSolicitud = (idx) => {
    setItemsSolicitud(itemsSolicitud.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const next = [...itemsSolicitud];
    next[idx][field] = val;
    setItemsSolicitud(next);
  };

  const handleCrearRequisicion = async (e) => {
    e.preventDefault();
    if (!nuevaPlaca) {
      alert("Selecciona una placa de vehículo.");
      return;
    }
    const itemsValidos = itemsSolicitud.filter(it => it.id_material && Number(it.cantidad_solicitada) > 0);
    if (itemsValidos.length === 0) {
      alert("Agrega al menos un material con cantidad mayor a 0.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/admin/requisiciones/crear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          placa_vehiculo: nuevaPlaca,
          nombre_tecnico: nuevoTecnico,
          items: itemsValidos,
          observaciones: obsSolicitud
        })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message);
        setShowCrearModal(false);
        setItemsSolicitud([{ id_material: '', cantidad_solicitada: 1 }]);
        setObsSolicitud('');
        setNuevaPlaca('');
        setNuevoTecnico('');
        cargarDatos();
      } else {
        alert(data?.message || "Error al crear solicitud.");
      }
    } catch (e) {
      alert("Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  const abrirAprobarModal = (req) => {
    setSelectedReq(req);
    setItemsAprobando((req.items || []).map(it => ({
      id_item: it.id_item,
      nombre_material: it.nombre_material,
      codigo_material: it.codigo_material,
      unidad_medida: it.unidad_medida,
      cantidad_solicitada: it.cantidad_solicitada,
      cantidad_aprobada: it.cantidad_aprobada || it.cantidad_solicitada,
      stock_bodega: it.stock_bodega
    })));
    setShowAprobarModal(true);
  };

  const handleAprobarRequisicion = async () => {
    if (!selectedReq) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/admin/requisiciones/${selectedReq.id_requisicion}/aprobar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: itemsAprobando })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message || "Solicitud aprobada exitosamente.");
        setShowAprobarModal(false);
        cargarDatos();
      } else {
        alert(data?.message || "Error al aprobar.");
      }
    } catch (e) {
      alert("Error de conexión al aprobar la solicitud.");
    }
  };

  const abrirFirmaModal = (req) => {
    setSelectedReq(req);
    setShowFirmaModal(true);
  };

  const handleGuardarFirmaYEntregar = async (firmaBase64) => {
    if (!selectedReq) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/admin/requisiciones/${selectedReq.id_requisicion}/firmar_y_entregar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ firma_tecnico: firmaBase64 })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setShowFirmaModal(false);
        alert(data.message || "Material entregado exitosamente.");
        cargarDatos();
      } else {
        alert(data?.message || "Error al registrar entrega.");
      }
    } catch (e) {
      alert("Error de conexión al registrar la firma.");
    }
  };

  // Modal de Rechazo
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [reqParaRechazar, setReqParaRechazar] = useState(null);
  const [rechazando, setRechazando] = useState(false);

  const abrirComprobante = (req) => {
    setSelectedReq(req);
    setShowComprobanteModal(true);
  };

  const abrirModalRechazo = (req) => {
    setReqParaRechazar(req);
    setMotivoRechazo('');
    setShowRechazarModal(true);
  };

  const handleConfirmarRechazo = async (e) => {
    if (e) e.preventDefault();
    if (!reqParaRechazar) return;
    if (!motivoRechazo.trim()) {
      alert("Por favor ingresa el motivo del rechazo.");
      return;
    }
    setRechazando(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/admin/requisiciones/${reqParaRechazar.id_requisicion}/rechazar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ motivo_rechazo: motivoRechazo.trim() })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message || "Solicitud rechazada exitosamente.");
        setShowRechazarModal(false);
        setReqParaRechazar(null);
        cargarDatos();
      } else {
        alert(data?.message || "Error al rechazar.");
      }
    } catch (e) {
      alert("Error de conexión al procesar el rechazo.");
    } finally {
      setRechazando(false);
    }
  };

  const getBadgeEstado = (estado) => {
    switch (estado) {
      case 'PENDIENTE':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', border: '1px solid #3b82f6' }}>⏳ Pendiente Aprobación</span>;
      case 'LISTO_ENTREGA':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid #f59e0b' }}>📦 Listo para Entrega</span>;
      case 'ENTREGADA':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid #10b981' }}>✅ Entregada Conforme</span>;
      case 'RECHAZADA':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid #ef4444' }}>🔴 Rechazada</span>;
      default:
        return <span>{estado}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Barra de Filtros Compacta y Alineada */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'var(--card-bg, #ffffff)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>Estado:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '11.5px', fontWeight: 600, color: 'inherit', outline: 'none' }}
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="PENDIENTE">⏳ Pendientes de Aprobación</option>
            <option value="LISTO_ENTREGA">📦 Esperando Firma del Técnico</option>
            <option value="ENTREGADA">✅ Entregadas / Firmadas</option>
            <option value="RECHAZADA">🔴 Rechazadas</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>Placa:</span>
          <select
            value={filtroPlaca}
            onChange={(e) => setFiltroPlaca(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '11.5px', fontWeight: 600, color: 'inherit', outline: 'none' }}
          >
            <option value="TODAS">Todas las Placas</option>
            {placas.map((p, idx) => (
              <option key={idx} value={p}>🚐 {p}</option>
            ))}
          </select>
        </div>

        <button
          onClick={cargarDatos}
          style={{ background: 'var(--hover-bg, #f1f5f9)', border: '1px solid var(--border-color, #cbd5e1)', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}
          title="Refrescar datos"
        >
          🔄 Actualizar
        </button>

      </div>

      {/* Tabla de Requisiciones */}
      <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--hover-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}>
              <th style={{ padding: '14px 16px' }}>Nº Solicitud / Fecha</th>
              <th style={{ padding: '14px 16px' }}>Placa & Técnico</th>
              <th style={{ padding: '14px 16px' }}>Materiales Solicitados</th>
              <th style={{ padding: '14px 16px', textAlign: 'center' }}>Estado</th>
              <th style={{ padding: '14px 16px', textAlign: 'center' }}>Acciones de Bodega</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)' }}>
                  Cargando requisiciones...
                </td>
              </tr>
            ) : requisiciones.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted, #94a3b8)' }}>
                  No hay solicitudes de técnicos pendientes en este momento.
                </td>
              </tr>
            ) : (
              requisiciones.map((req) => (
                <tr key={req.id_requisicion} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '13px' }}>{req.numero_solicitud}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                      📅 {req.fecha_solicitud_fmt || req.fecha_solicitud}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'inline-block', background: '#1e293b', color: '#ffffff', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                      🚐 {req.placa_vehiculo}
                    </div>
                    <div style={{ fontWeight: '600', color: 'var(--text-main, #1e293b)', marginTop: '4px' }}>
                      👤 {req.nombre_tecnico}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '100px', overflowY: 'auto' }}>
                      {(req.items || []).map((it, idx) => (
                        <div key={idx} style={{ fontSize: '11.5px', color: 'var(--text-main, #334155)' }}>
                          • <strong style={{ color: '#0284c7' }}>{it.cantidad_aprobada || it.cantidad_solicitada} {it.unidad_medida}</strong> - {it.nombre_material}
                        </div>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {getBadgeEstado(req.estado)}
                    {req.estado === 'ENTREGADA' && req.fecha_entrega_fmt && (
                      <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: '600' }}>
                        Entregado: {req.fecha_entrega_fmt}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {req.estado === 'PENDIENTE' && (
                        <>
                          <button
                            onClick={() => abrirAprobarModal(req)}
                            style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#ffffff', fontWeight: 'bold', fontSize: '11.5px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(245,158,11,0.3)' }}
                          >
                            📦 Alistar & Aprobar
                          </button>
                          <button
                            onClick={() => abrirModalRechazo(req)}
                            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 'bold', fontSize: '11.5px', cursor: 'pointer' }}
                            title="Rechazar solicitud"
                          >
                            ✕
                          </button>
                        </>
                      )}

                      {req.estado === 'LISTO_ENTREGA' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                            📲 Esperando firma del técnico en su app
                          </span>
                          <button
                            onClick={() => abrirFirmaModal(req)}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '10.5px', cursor: 'pointer' }}
                            title="Firmar en mostrador"
                          >
                            ✍️ Firmar en mostrador
                          </button>
                        </div>
                      )}

                      {req.estado === 'ENTREGADA' && (
                        <button
                          onClick={() => abrirComprobante(req)}
                          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f1f5f9)', color: 'var(--text-main, #334155)', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
                        >
                          📄 Ver Acta Firmada
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CREAR REQUISICIÓN */}
      {showCrearModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' }}>
          <div style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #1e293b)', borderRadius: '20px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color, #e2e8f0)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>
                📦 Nueva Solicitud de Materiales para Buseta
              </h3>
              <button onClick={() => setShowCrearModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCrearRequisicion}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Placa de la Buseta *</label>
                  <select
                    required
                    value={nuevaPlaca}
                    onChange={(e) => handlePlacaSeleccionadaChange(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '12px', fontWeight: 600, color: 'inherit' }}
                  >
                    <option value="">-- Seleccionar Placa --</option>
                    {placas.map((p, idx) => (
                      <option key={idx} value={p}>🚐 {p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Técnico Solicitante</label>
                  <input
                    type="text"
                    placeholder="Nombre del técnico responsable"
                    value={nuevoTecnico}
                    onChange={(e) => setNuevoTecnico(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '12px', color: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Lista de Materiales a Pedir */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Materiales a Solicitar *</label>
                  <button
                    type="button"
                    onClick={handleAddItemSolicitud}
                    style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ➕ Agregar Material
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                  {itemsSolicitud.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 40px', gap: '10px', alignItems: 'center', background: 'var(--hover-bg, #f8fafc)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                      <select
                        required
                        value={it.id_material}
                        onChange={(e) => handleItemChange(idx, 'id_material', e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: '#ffffff', fontSize: '11.5px', color: 'inherit' }}
                      >
                        <option value="">-- Seleccionar Material --</option>
                        {materialesCat.map((m) => (
                          <option key={m.id_material} value={m.id_material}>
                            [{m.codigo_material}] {m.nombre_material} (Disp. Bodega: {m.stock_bodega} {m.unidad_medida})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Cant."
                        value={it.cantidad_solicitada}
                        onChange={(e) => handleItemChange(idx, 'cantidad_solicitada', e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: '#ffffff', fontSize: '11.5px', textAlign: 'center', color: 'inherit' }}
                      />

                      {itemsSolicitud.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemSolicitud(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1.1rem', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Observaciones (Opcional)</label>
                <textarea
                  rows="2"
                  placeholder="Motivo del pedido o detalles adicionales..."
                  value={obsSolicitud}
                  onChange={(e) => setObsSolicitud(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '12px', color: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCrearModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {enviando ? 'Enviando...' : 'Enviar Solicitud a Bodega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALISTAR & APROBAR EN BODEGA */}
      {showAprobarModal && selectedReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' }}>
          <div style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #1e293b)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color, #e2e8f0)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>
                  📦 Alistamiento en Bodega: {selectedReq.numero_solicitud}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Placa: <strong>{selectedReq.placa_vehiculo}</strong> | Solicitante: {selectedReq.nombre_tecnico}
                </p>
              </div>
              <button onClick={() => setShowAprobarModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--hover-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                    <th style={{ padding: '8px' }}>Material</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Disp. Bodega</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Pedido</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Aprobar Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsAprobando.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 'bold' }}>{it.nombre_material}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{it.codigo_material}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: it.stock_bodega < it.cantidad_solicitada ? '#ef4444' : '#10b981' }}>
                        {it.stock_bodega} {it.unidad_medida}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {it.cantidad_solicitada} {it.unidad_medida}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={it.stock_bodega}
                          value={it.cantidad_aprobada}
                          onChange={(e) => {
                            const next = [...itemsAprobando];
                            next[idx].cantidad_aprobada = e.target.value;
                            setItemsAprobando(next);
                          }}
                          style={{ width: '70px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center', fontWeight: 'bold' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowAprobarModal(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAprobarRequisicion}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#ffffff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Listo para Entrega en Mostrador ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FIRMA DIGITAL TÁCTIL */}
      <FirmaCanvasModal
        isOpen={showFirmaModal}
        onClose={() => setShowFirmaModal(false)}
        onSave={handleGuardarFirmaYEntregar}
        titulo={`Firma de Entrega: ${selectedReq?.numero_solicitud}`}
        subtitulo={`El técnico de la placa ${selectedReq?.placa_vehiculo} debe firmar para recibir los materiales.`}
      />

      {/* MODAL COMPROBANTE DE ENTREGA CON FIRMA */}
      {showComprobanteModal && selectedReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' }}>
          <div style={{ background: '#ffffff', color: '#1e293b', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1' }}>
            
            {/* Encabezado Acta */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem', fontWeight: 900 }}>
                ATLAS • ACTA DE ENTREGA DE MATERIALES
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Comprobante Digital Nº <strong>{selectedReq.numero_solicitud}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div><strong>Placa Buseta:</strong> {selectedReq.placa_vehiculo}</div>
              <div><strong>Técnico Receptor:</strong> {selectedReq.nombre_tecnico}</div>
              <div><strong>Fecha de Entrega:</strong> {selectedReq.fecha_entrega_fmt || selectedReq.fecha_entrega}</div>
              <div><strong>Entregado Por:</strong> {selectedReq.entregado_por || selectedReq.aprobado_por || 'Bodega'}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', color: '#334155' }}>
                DETALLE DE MATERIALES ENTREGADOS:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Código</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Descripción</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Cant. Entregada</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedReq.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', color: '#64748b' }}>{it.codigo_material}</td>
                      <td style={{ padding: '8px', fontWeight: '600' }}>{it.nombre_material}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#0284c7' }}>
                        {it.cantidad_aprobada || it.cantidad_solicitada} {it.unidad_medida}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Firma Incrustada */}
            <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>
                FIRMA DIGITAL DE CONFORMIDAD DEL TÉCNICO:
              </div>
              {selectedReq.firma_tecnico ? (
                <img
                  src={selectedReq.firma_tecnico}
                  alt="Firma del Técnico"
                  style={{ maxHeight: '110px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px', background: '#fafafa' }}
                />
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Sin firma registrada</div>
              )}
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b', marginTop: '6px' }}>
                {selectedReq.nombre_tecnico}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                🖨️ Imprimir Acta
              </button>
              <button
                onClick={() => setShowComprobanteModal(false)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1e293b', color: '#ffffff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECHAZAR SOLICITUD */}
      {showRechazarModal && reqParaRechazar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--card-bg, #ffffff)', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color, #e2e8f0)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✕</span> Rechazar Solicitud {reqParaRechazar.numero_solicitud}
              </h3>
              <button onClick={() => setShowRechazarModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            </div>

            <form onSubmit={handleConfirmarRechazo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main, #334155)' }}>
                  Motivo o Razón del Rechazo:
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Ej: Insumos agotados temporalmente, stock no disponible..."
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '12px', boxSizing: 'border-box', color: 'inherit', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowRechazarModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={rechazando}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#ffffff', fontWeight: 800, fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}
                >
                  {rechazando ? 'Procesando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
