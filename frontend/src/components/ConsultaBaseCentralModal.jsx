import React, { useState, useEffect } from 'react';

function ConsultaBaseCentralModal({
  isOpen,
  onClose,
  initialCedula = '',
  initialContrato = '',
  token,
  onClientImported
}) {
  const [cedulaInput, setCedulaInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [clientData, setClientData] = useState(null);
  const [importingContrato, setImportingContrato] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Initial setup when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchError('');
      setClientData(null);
      setSuccessMessage('');
      setImportingContrato(null);

      const cleanCedula = (initialCedula || '').trim();
      setCedulaInput(cleanCedula);

      // Si ya viene una identificación o código válido, consultar de inmediato
      if (cleanCedula.length >= 3) {
        ejecutarConsulta(cleanCedula);
      }
    }
  }, [isOpen, initialCedula]);

  if (!isOpen) return null;

  const ejecutarConsulta = async (cedulaVal) => {
    const clean = (cedulaVal || cedulaInput || '').trim();
    if (!clean || clean.length < 3) {
      setSearchError('Por favor ingrese una cédula, RUC o código válido (mínimo 3 caracteres).');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setClientData(null);
    setSuccessMessage('');

    try {
      const url = `/api/cliente/consultar_base_central?cedula=${encodeURIComponent(clean)}${initialContrato ? `&contrato=${encodeURIComponent(initialContrato)}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setClientData(data);
      } else {
        setSearchError(data.message || 'No se encontró el cliente con la identificación ingresada en la Base Central.');
      }
    } catch (err) {
      console.error('Error al consultar Base Central:', err);
      setSearchError('Error de red al intentar conectar con la Base Central (192.168.232.5:85).');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    ejecutarConsulta(cedulaInput);
  };

  const handleImportarContrato = async (cItem) => {
    if (!cItem || !clientData) return;
    setImportingContrato(cItem.contrato);
    setSearchError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/cliente/importar_base_central', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cedula: clientData.cliente?.cedula || cedulaInput,
          contrato: cItem.contrato
        })
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setSuccessMessage(`¡Contrato #${cItem.contrato} importado y cargado con éxito!`);
        setTimeout(() => {
          if (onClientImported) {
            onClientImported(data.cliente || cItem);
          }
          onClose();
        }, 900);
      } else {
        setSearchError(data.message || 'Error al guardar el cliente en la base local.');
      }
    } catch (err) {
      console.error('Error al importar contrato:', err);
      setSearchError('Error de red al intentar guardar en la base de datos local.');
    } finally {
      setImportingContrato(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem'
              }}>
                <i className="fa-solid fa-cloud-arrow-down"></i>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
                Consulta e Importación desde Base Central
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 46px', fontSize: '0.8rem', color: 'var(--sidebar-text, #64748b)' }}>
              Conexión directa con la base principal del sistema (192.168.232.5)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.3rem',
              color: 'var(--sidebar-text, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
            title="Cerrar ventana"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
          {/* Banner si viene de búsqueda de contrato fallida */}
          {initialContrato && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', fontSize: '1.2rem' }}></i>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main, #1e293b)' }}>
                El contrato <strong>#{initialContrato}</strong> no existe en tu base local.
                Ingresa la <strong>cédula, RUC o código</strong> del cliente (ej: FB677389) para buscarlo en la Base Central e importarlo automáticamente.
              </div>
            </div>
          )}

          {/* Formulario de Consulta */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <i className="fa-solid fa-id-card" style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--sidebar-text, #94a3b8)',
                fontSize: '1rem'
              }}></i>
              <input
                type="text"
                value={cedulaInput}
                onChange={(e) => setCedulaInput(e.target.value)}
                placeholder="Ingresa Cédula, RUC o Código de cliente (ej: 0101..., FB677389)..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color, #cbd5e1)',
                  background: 'var(--profile-bg, #f8fafc)',
                  color: 'var(--text-main, #1e293b)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              style={{
                padding: '0 22px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isSearching ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                opacity: isSearching ? 0.7 : 1
              }}
            >
              {isSearching ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Consultando...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <span>Consultar</span>
                </>
              )}
            </button>
          </form>

          {/* Mensajes de Alerta */}
          {searchError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '18px',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fa-solid fa-circle-xmark" style={{ fontSize: '1.1rem' }}></i>
              <span>{searchError}</span>
            </div>
          )}

          {successMessage && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '18px',
              fontSize: '0.9rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '1.2rem' }}></i>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Resultado de la Consulta */}
          {clientData && (
            <div>
              {/* Tarjeta de Información General del Cliente */}
              <div style={{
                background: 'var(--profile-bg, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--sidebar-text, #64748b)', fontWeight: 800, letterSpacing: '0.05em' }}>
                    Cliente Encontrado en Base Central
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main, #1e293b)', marginTop: '2px' }}>
                    {clientData.cliente?.nombres}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--sidebar-text, #64748b)' }}>
                      <i className="fa-solid fa-id-badge" style={{ marginRight: '5px' }}></i>
                      Cédula / RUC: <strong style={{ color: 'var(--text-main, #1e293b)' }}>{clientData.cliente?.cedula}</strong>
                    </span>
                    <span style={{ fontSize: '0.78rem', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>
                      {clientData.contratos?.length || 0} contrato(s)
                    </span>
                  </div>
                </div>

                {/* Resumen de Deuda */}
                {(() => {
                  const primerContrato = clientData.contratos?.[0];
                  const deuda = primerContrato ? primerContrato.deudatotal : 0;
                  const tieneDeuda = deuda > 0;
                  return (
                    <div style={{
                      textAlign: 'right',
                      padding: '8px 14px',
                      borderRadius: '12px',
                      background: tieneDeuda ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      border: `1px solid ${tieneDeuda ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
                    }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: tieneDeuda ? '#ef4444' : '#10b981' }}>
                        {tieneDeuda ? '⚠️ Deuda Central' : '✅ Estado Contable'}
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: tieneDeuda ? '#dc2626' : '#059669' }}>
                        ${deuda.toFixed(2)}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Lista de Contratos */}
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main, #1e293b)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-file-contract" style={{ color: '#0284c7' }}></i>
                <span>Contratos Disponibles para Importar / Cargar:</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {clientData.contratos?.map((cItem, idx) => {
                  const isMatching = initialContrato && (
                    cItem.contrato.toUpperCase() === initialContrato.toUpperCase() ||
                    cItem.contrato.replace(/F$/i, '').toUpperCase() === initialContrato.replace(/F$/i, '').toUpperCase()
                  );
                  const isImporting = importingContrato === cItem.contrato;

                  return (
                    <div
                      key={idx}
                      style={{
                        background: isMatching ? 'rgba(2, 132, 199, 0.04)' : 'var(--card-bg, #ffffff)',
                        border: isMatching ? '2px solid #0284c7' : '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '14px',
                        boxShadow: isMatching ? '0 4px 14px rgba(2, 132, 199, 0.15)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            color: '#0284c7',
                            background: 'rgba(2, 132, 199, 0.1)',
                            padding: '3px 10px',
                            borderRadius: '8px'
                          }}>
                            #{cItem.contrato}
                          </span>

                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: cItem.empresa === 'FIBRACOM' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: cItem.empresa === 'FIBRACOM' ? '#a855f7' : '#2563eb'
                          }}>
                            {cItem.empresa || 'SERVICABLE'}
                          </span>

                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: cItem.estado === 'ACTIVO' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: cItem.estado === 'ACTIVO' ? '#059669' : '#dc2626'
                          }}>
                            {cItem.estado || 'ACTIVO'}
                          </span>

                          {cItem.existe_local ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(100, 116, 139, 0.12)', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>
                              <i className="fa-solid fa-database" style={{ marginRight: '4px' }}></i>
                              Registrado localmente
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', color: '#059669', padding: '3px 8px', borderRadius: '6px' }}>
                              <i className="fa-solid fa-sparkles" style={{ marginRight: '4px' }}></i>
                              Nuevo en Atlas
                            </span>
                          )}
                        </div>

                        {/* Detalles de Plan y Ubicación */}
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-main, #334155)', marginBottom: '4px', fontWeight: 600 }}>
                          <i className="fa-solid fa-gauge-high" style={{ color: '#0284c7', marginRight: '6px', width: '16px' }}></i>
                          {cItem.producto || 'Plan no especificado'} {cItem.velocidad_mbps ? `(${cItem.velocidad_mbps} Mbps)` : ''}
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--sidebar-text, #64748b)', marginBottom: '4px' }}>
                          <i className="fa-solid fa-location-dot" style={{ color: '#ef4444', marginRight: '6px', width: '16px' }}></i>
                          {cItem.direccion || 'Dirección no registrada'} {cItem.sector ? `(${cItem.sector})` : ''}
                        </div>

                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--sidebar-text, #64748b)', flexWrap: 'wrap' }}>
                          <span>
                            <i className="fa-solid fa-phone" style={{ color: '#10b981', marginRight: '5px' }}></i>
                            {cItem.telefono1 || 'Sin teléfono'}
                          </span>
                          {cItem.ip_cliente && (
                            <span>
                              <i className="fa-solid fa-network-wired" style={{ color: '#6366f1', marginRight: '5px' }}></i>
                              IP: {cItem.ip_cliente}
                            </span>
                          )}
                          {cItem.nodo_nombre && (
                            <span>
                              <i className="fa-solid fa-server" style={{ color: '#8b5cf6', marginRight: '5px' }}></i>
                              Nodo: {cItem.nodo_nombre}
                            </span>
                          )}
                          {cItem.total_mensual && (
                            <span>
                              <i className="fa-solid fa-money-bill-wave" style={{ color: '#10b981', marginRight: '5px' }}></i>
                              ${cItem.total_mensual.toFixed(2)}/mes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botón de Importar / Seleccionar */}
                      <button
                        type="button"
                        onClick={() => handleImportarContrato(cItem)}
                        disabled={isImporting}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '12px',
                          border: 'none',
                          background: isMatching || !cItem.existe_local
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: isImporting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isImporting ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <span>Importando...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-cloud-arrow-down"></i>
                            <span>{cItem.existe_local ? 'Sincronizar y Cargar' : 'Importar y Cargar'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--profile-bg, #f8fafc)'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--sidebar-text, #64748b)' }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: '6px', color: '#10b981' }}></i>
            La información se sincroniza de forma segura directamente con tu servidor local.
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'transparent',
              color: 'var(--text-main, #334155)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Cancelar / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsultaBaseCentralModal;
