import React, { useState, useEffect } from 'react';

export default function LiquidacionMensualTab({ token: tokenProp, placas: placasProp, tecnicosVehiculos = [], materialesProp }) {
  const [placaSeleccionada, setPlacaSeleccionada] = useState('');
  const [placas, setPlacas] = useState(placasProp || []);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [datosLiquidacion, setDatosLiquidacion] = useState(null);
  const [itemsEditable, setItemsEditable] = useState([]);
  const [historialCierres, setHistorialCierres] = useState([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showConfirmCierreModal, setShowConfirmCierreModal] = useState(false);
  const [cierreObservaciones, setCierreObservaciones] = useState('');
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [selectedCierreDetalle, setSelectedCierreDetalle] = useState(null);

  const authToken = tokenProp || localStorage.getItem('token') || localStorage.getItem('session_token');

  useEffect(() => {
    if (placasProp && placasProp.length > 0) {
      setPlacas(placasProp);
      if (!placaSeleccionada) {
        setPlacaSeleccionada(placasProp[0]);
      }
    }
  }, [placasProp]);

  useEffect(() => {
    // Inicializar fechas por defecto (del 27 mes anterior al 26 mes actual)
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth(); // 0-indexed

    let dIni, dFin;
    dFin = new Date(y, m, 26);
    if (m === 0) {
      dIni = new Date(y - 1, 11, 27);
    } else {
      dIni = new Date(y, m - 1, 27);
    }

    setFechaInicio(dIni.toISOString().split('T')[0]);
    setFechaFin(dFin.toISOString().split('T')[0]);

    cargarPlacas();
  }, [authToken]);

  const cargarPlacas = async () => {
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch('/api/admin/inventario', { headers });
      const data = await res.json();
      if (data?.status === 'ok') {
        const plist = data.placas || data.tecnicos || [];
        if (plist.length > 0) {
          setPlacas(plist);
          setPlacaSeleccionada(prev => prev || plist[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const calcularLiquidacion = async () => {
    if (!placaSeleccionada) {
      alert("Selecciona una placa.");
      return;
    }
    setLoading(true);
    try {
      const url = `/api/admin/inventario/liquidacion_mensual?placa=${placaSeleccionada}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data?.status === 'ok') {
        setDatosLiquidacion(data);
        setItemsEditable((data.items || []).map(it => ({
          ...it,
          conteo_fisico: it.stock_teorico, // Default inicial
          diferencia: 0
        })));
      } else {
        alert(data?.message || "Error al calcular liquidación.");
      }
    } catch (e) {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleConteoChange = (idx, valor) => {
    const next = [...itemsEditable];
    const valNum = Number(valor) || 0;
    next[idx].conteo_fisico = valNum;
    next[idx].diferencia = valNum - Number(next[idx].stock_teorico);
    setItemsEditable(next);
  };

  const handleEjecutarCierre = async () => {
    if (!datosLiquidacion) return;
    setGuardandoCierre(true);
    try {
      const res = await fetch('/api/admin/inventario/cierre_mensual/guardar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          placa_vehiculo: datosLiquidacion.placa,
          periodo_mes: datosLiquidacion.periodo_nombre,
          fecha_inicio: datosLiquidacion.fecha_inicio,
          fecha_fin: datosLiquidacion.fecha_fin,
          tecnico_responsable: datosLiquidacion.tecnico_responsable,
          items: itemsEditable,
          observaciones: cierreObservaciones
        })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message);
        setShowConfirmCierreModal(false);
        setCierreObservaciones('');
        calcularLiquidacion(); // Recalcular con el nuevo corte
      } else {
        alert(data?.message || "Error al guardar cierre.");
      }
    } catch (e) {
      alert("Error de conexión");
    } finally {
      setGuardandoCierre(false);
    }
  };

  const cargarHistorialCierres = async () => {
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(`/api/admin/inventario/cierres_historico?placa=${placaSeleccionada}`, {
        headers
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setHistorialCierres(data.cierres || []);
        setShowHistorialModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalFaltantes = itemsEditable.filter(it => it.diferencia < 0).length;
  const totalSobrantes = itemsEditable.filter(it => it.diferencia > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Controles de Período y Placa */}
      <div style={{ background: 'var(--card-bg, #ffffff)', padding: '18px 22px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>Placa de Vehículo</label>
            <select
              value={placaSeleccionada}
              onChange={(e) => setPlacaSeleccionada(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '13px', fontWeight: 700, color: 'inherit' }}
            >
              {placas.map((p, idx) => (
                <option key={idx} value={p}>🚐 {p}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>Fecha Inicio (Corte 27)</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '12px', color: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>Fecha Fin (Corte 26)</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f8fafc)', fontSize: '12px', color: 'inherit' }}
            />
          </div>

          <button
            onClick={calcularLiquidacion}
            disabled={loading}
            style={{
              marginTop: '18px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #1f497d 0%, #112d52 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(31, 73, 125, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {loading ? 'Calculando...' : '🔍 Calcular Liquidación de Placa'}
          </button>
        </div>

        <button
          onClick={cargarHistorialCierres}
          style={{
            marginTop: '18px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #cbd5e1)',
            background: 'var(--hover-bg, #f1f5f9)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          📜 Historial de Cierres Anteriores
        </button>
      </div>

      {/* KPI Banners si hay datos calculados */}
      {datosLiquidacion && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '1.8rem' }}>🚐</span>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>PLACA EVALUADA</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b' }}>{datosLiquidacion.placa}</div>
              <div style={{ fontSize: '10.5px', color: '#0284c7' }}>{datosLiquidacion.tecnico_responsable}</div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '1.8rem' }}>📅</span>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>PERÍODO DE CORTE</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>{datosLiquidacion.periodo_nombre}</div>
              <div style={{ fontSize: '10.5px', color: '#64748b' }}>{itemsEditable.length} materiales evaluados</div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '1.8rem' }}>{totalFaltantes === 0 ? '🟢' : '🔴'}</span>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>ESTADO DE CUADRE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: totalFaltantes === 0 ? '#10b981' : '#ef4444' }}>
                {totalFaltantes === 0 ? 'TODO CUADRADO' : `${totalFaltantes} FALTANTES`}
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b' }}>{totalSobrantes > 0 ? `${totalSobrantes} sobrantes` : '0 sobrantes'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla Matriz de Liquidación */}
      {datosLiquidacion && (
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
              📊 Matriz de Liquidación & Conteo Físico
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--hover-bg, #f1f5f9)', fontWeight: 700, fontSize: '11.5px', cursor: 'pointer' }}
              >
                🖨️ Imprimir Acta
              </button>
              <button
                onClick={() => setShowConfirmCierreModal(true)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', fontWeight: 800, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}
              >
                🔒 Cerrar Mes & Fijar Nuevo Stock
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--hover-bg, #f8fafc)', borderBottom: '2px solid var(--border-color, #cbd5e1)', color: 'var(--text-muted, #475569)' }}>
                <th style={{ padding: '12px 14px' }}>Material / Código</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Stock Inicial</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', color: '#0284c7' }}>Entregas (+)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', color: '#ef4444' }}>Gastado (-)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Devuelto (-)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', background: 'rgba(59, 130, 246, 0.05)' }}>Stock Teórico</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', background: 'rgba(245, 158, 11, 0.08)' }}>Conteo Físico Buseta</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {itemsEditable.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)' }}>
                    No hay movimientos registrados para esta placa en el período seleccionado.
                  </td>
                </tr>
              ) : (
                itemsEditable.map((it, idx) => {
                  const dif = it.diferencia;
                  let colorDif = '#10b981';
                  let textoDif = '0 (Cuadrado)';
                  if (dif < 0) {
                    colorDif = '#ef4444';
                    textoDif = `${dif} (Faltante)`;
                  } else if (dif > 0) {
                    colorDif = '#f59e0b';
                    textoDif = `+${dif} (Sobrante)`;
                  }

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-main, #1e293b)' }}>{it.nombre_material}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{it.codigo_material} • ({it.unidad_medida})</div>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600' }}>
                        {it.stock_inicial}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#0284c7' }}>
                        +{it.entregas_bodega}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                        -{it.consumo_visitas}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>
                        -{it.devoluciones}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900', fontSize: '12px', background: 'rgba(59, 130, 246, 0.05)', color: '#1e293b' }}>
                        {it.stock_teorico}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', background: 'rgba(245, 158, 11, 0.08)' }}>
                        <input
                          type="number"
                          min="0"
                          value={it.conteo_fisico}
                          onChange={(e) => handleConteoChange(idx, e.target.value)}
                          style={{
                            width: '80px',
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid #f59e0b',
                            textAlign: 'center',
                            fontWeight: '900',
                            fontSize: '12px',
                            background: '#ffffff',
                            color: '#1e293b'
                          }}
                        />
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '10px',
                          fontWeight: '800',
                          fontSize: '11px',
                          color: colorDif,
                          background: dif === 0 ? 'rgba(16, 185, 129, 0.12)' : (dif < 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'),
                          border: `1px solid ${colorDif}`
                        }}>
                          {textoDif}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN DE CIERRE MENSUAL */}
      {showConfirmCierreModal && datosLiquidacion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' }}>
          <div style={{ background: '#ffffff', color: '#1e293b', borderRadius: '20px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem' }}>🔒</span>
              <h3 style={{ margin: '8px 0 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#1e293b' }}>
                Confirmar Cierre Mensual
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Placa: <strong>{datosLiquidacion.placa}</strong> • Período: <strong>{datosLiquidacion.periodo_nombre}</strong>
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ marginBottom: '6px' }}>• <strong>Ítems Auditados:</strong> {itemsEditable.length} materiales</div>
              <div style={{ marginBottom: '6px', color: totalFaltantes > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                • <strong>Faltantes a Descontar:</strong> {totalFaltantes} materiales con faltante
              </div>
              <div style={{ color: '#0284c7' }}>
                • <strong>Efecto Automático:</strong> El <em>Conteo Físico Real</em> ingresado se convertirá en el nuevo Stock Inicial de la buseta.
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 'bold', marginBottom: '6px' }}>Observaciones del Cierre (Opcional)</label>
              <textarea
                rows="2"
                placeholder="Detalle de acuerdos, descuentos o justificaciones de stock..."
                value={cierreObservaciones}
                onChange={(e) => setCierreObservaciones(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmCierreModal(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoCierre}
                onClick={handleEjecutarCierre}
                style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
              >
                {guardandoCierre ? 'Guardando...' : 'Confirmar y Cerrar Mes ✅'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE CIERRES ANTERIORES */}
      {showHistorialModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' }}>
          <div style={{ background: '#ffffff', color: '#1e293b', borderRadius: '20px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
                📜 Historial de Cierres Mensuales Archivados
              </h3>
              <button onClick={() => setShowHistorialModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {historialCierres.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No hay cierres mensuales archivados para esta placa.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {historialCierres.map((c) => (
                  <div key={c.id_cierre} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <strong>{c.periodo_mes}</strong> (🚐 {c.placa_vehiculo})
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Cerrado por: {c.cerrado_por} el {c.fecha_cierre_fmt}</div>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', background: c.total_faltantes === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: c.total_faltantes === 0 ? '#10b981' : '#ef4444' }}>
                        {c.total_faltantes === 0 ? '✅ Sin Faltantes' : `🔴 ${c.total_faltantes} Faltantes`}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#475569', maxHeight: '100px', overflowY: 'auto' }}>
                      {(c.items || []).map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '3px 0' }}>
                          <span>{it.nombre_material}</span>
                          <span>Teórico: {it.stock_teorico} | Conteo: <strong>{it.conteo_fisico}</strong> ({it.diferencia >= 0 ? `+${it.diferencia}` : it.diferencia})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowHistorialModal(false)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
