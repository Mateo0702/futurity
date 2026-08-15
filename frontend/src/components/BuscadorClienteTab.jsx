import React, { useState, useEffect, useRef } from 'react';

function BuscadorClienteTab({ token }) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // SmartOLT Diagnostic states
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [diagnosticError, setDiagnosticError] = useState('');
  
  const searchTimeoutRef = useRef(null);

  // Debounced Search Logic
  const handleSearchInput = (val) => {
    setQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const cleanVal = val.trim();
    if (!cleanVal || cleanVal.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cliente/buscar_completo_json?q=${encodeURIComponent(cleanVal)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success' && data.clientes) {
          setSearchResults(data.clientes);
          setShowDropdown(true);
        } else {
          setSearchResults([]);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Error buscando clientes:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setShowDropdown(false);
    setQuery('');
    // Reset Diagnostic state for newly selected client
    setDiagnosticResult(null);
    setDiagnosticError('');
    setIsMeasuring(false);
  };

  const handleRunDiagnostic = async () => {
    if (!selectedClient || !selectedClient.numero_serie || selectedClient.numero_serie === 'S/N') {
      setDiagnosticError("El cliente no tiene registrado un número de serie (SN) para consultar en la OLT.");
      return;
    }

    const sn = selectedClient.numero_serie.trim();
    setIsMeasuring(true);
    setDiagnosticError('');
    setDiagnosticResult(null);

    try {
      const res = await fetch(`/api/admin/smartolt/diagnostico/${encodeURIComponent(sn)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.diagnostico) {
        setDiagnosticResult(data.diagnostico);
      } else {
        setDiagnosticError(data.message || "No se pudo obtener el diagnóstico del equipo en SmartOLT.");
      }
    } catch (err) {
      setDiagnosticError("Error de conexión al servidor de diagnóstico SmartOLT.");
    } finally {
      setIsMeasuring(false);
    }
  };

  // Helper calculation for optical signal progress bars
  const getSignalBarProps = (valStr, isRx = true) => {
    if (!valStr || valStr === 'N/D' || valStr === 'DESCONECTADO' || valStr === '-') {
      return {
        width: '0%',
        color: '#ef4444',
        label: `🚨 ${isRx ? 'Enganche (Rx)' : 'Retorno (Tx)'} Desconectado / Sin Señal`
      };
    }

    const match = valStr.match(/-?\d+\.?\d*/);
    if (!match) {
      return {
        width: '0%',
        color: '#64748b',
        label: `Valor no válido: ${valStr}`
      };
    }

    const val = parseFloat(match[0]);
    if (val >= -25) {
      return {
        width: '90%',
        color: '#10b981',
        label: `🟢 Excelente (${val} dBm) - Nivel Óptimo`
      };
    } else if (val > -28) {
      return {
        width: '55%',
        color: '#f59e0b',
        label: `🟡 Atenuado (${val} dBm) - Alerta de Señal`
      };
    } else {
      return {
        width: '25%',
        color: '#ef4444',
        label: `🔴 Crítico (${val} dBm) - Falla Física o Doblez`
      };
    }
  };

  return (
    <div id="tab-buscar-cliente" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Hero Header */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          <i className="fa-solid fa-users-gear"></i>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Buscador y Diagnóstico de Clientes
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Busca fichas comerciales de clientes y realiza diagnósticos de señal óptica en tiempo real en la OLT.
          </p>
        </div>
      </div>

      {/* Buscador Principal Interactivo */}
      <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: '25px', position: 'relative' }}>
        <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', display: 'block', marginBottom: '10px' }}>
          🔍 Buscar Cliente (Contrato, Nombre, Teléfono o Identificación):
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-control"
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Escribe para buscar... Ej: 290, Marlene, 099232..."
            style={{ width: '100%', padding: '14px 44px 14px 20px', fontSize: '1rem', borderRadius: '14px', border: '1.5px solid var(--border-color)', fontWeight: 600, background: 'var(--card-bg)', color: 'var(--text-main)' }}
          />
          {isSearching && (
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.2rem' }}></i>
            </div>
          )}
        </div>

        {/* Dropdown flotante de resultados */}
        {showDropdown && (
          <div style={{ position: 'absolute', left: '24px', right: '24px', top: '100%', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 999, maxHeight: '280px', overflowY: 'auto', marginTop: '8px' }}>
            {searchResults.length > 0 ? (
              searchResults.map((cli, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectClient(cli)}
                  style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--profile-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', display: 'block' }}>{cli.cliente}</strong>
                    <span style={{ color: 'var(--sidebar-text)', fontSize: '0.78rem' }}>Sector: {cli.sector} | Plan: {cli.producto}</span>
                  </div>
                  <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 800, fontSize: '0.78rem', padding: '4px 10px', borderRadius: '8px' }}>
                    Contrato: {cli.contrato}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 600 }}>
                No se encontraron coincidencias.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenedor de Fichas (Ficha Comercial + SmartOLT) */}
      {selectedClient ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '25px', marginBottom: '30px' }}>
          
          {/* Ficha Comercial (Izquierda) */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '26px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 800, fontSize: '0.85rem', padding: '4px 12px', borderRadius: '8px', display: 'inline-block' }}>
                      CONTRATO: {selectedClient.contrato}
                    </span>
                    {selectedClient.empresa && (
                      <span style={{ background: selectedClient.empresa === 'FIBRACOM' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: selectedClient.empresa === 'FIBRACOM' ? '#a855f7' : '#2563eb', fontWeight: 800, fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px' }}>
                        {selectedClient.empresa}
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.35rem', fontWeight: 850, letterSpacing: '-0.01em' }}>
                    {selectedClient.cliente}
                  </h3>
                </div>
                {selectedClient.cedula && (
                  <span style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.82rem', padding: '5px 12px', borderRadius: '10px' }}>
                    🪪 {selectedClient.cedula}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>💵 Pago Mensual</strong>
                  <span style={{ color: '#059669', fontSize: '1.2rem', fontWeight: 800 }}>
                    {selectedClient.total_mensual ? `$${parseFloat(selectedClient.total_mensual).toFixed(2)}` : 'N/D'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>⚡ Velocidad Plan</strong>
                  <span style={{ color: '#0284c7', fontSize: '1.1rem', fontWeight: 800 }}>
                    {selectedClient.velocidad_mbps ? `${selectedClient.velocidad_mbps} Mbps` : 'N/D'}
                  </span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>📦 Paquete Contratado</strong>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 700 }}>
                    {selectedClient.producto || 'N/D'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>🌐 IP Cliente</strong>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.ip_cliente || 'N/D'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>🏢 IP Nodo</strong>
                  <span style={{ color: '#0284c7', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.ip_nodo || 'N/D'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>🏷️ Serie ONU (SN)</strong>
                  <span style={{ color: '#d97706', fontSize: '0.95rem', fontWeight: 700, wordBreak: 'break-all' }}>
                    {selectedClient.numero_serie || 'S/N'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>💳 Forma de Pago</strong>
                  <span style={{ color: '#6366f1', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.forma_pago || 'N/D'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>⏳ Antigüedad</strong>
                  <span style={{ color: '#0284c7', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.antiguedad_fmt || 'N/D'}
                  </span>
                </div>

                {selectedClient.vendedor && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>👤 Vendedor Asignado</strong>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600 }}>
                      {selectedClient.vendedor}
                    </span>
                  </div>
                )}
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>📍 Dirección y Sector</strong>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.4, display: 'block' }}>
                    {selectedClient.direccion}
                  </span>
                  <span style={{ color: 'var(--sidebar-text)', fontSize: '0.82rem', fontWeight: 700, marginTop: '3px', display: 'block' }}>
                    Sector: {selectedClient.sector}
                  </span>
                </div>
              </div>

            </div>

            {/* Teléfonos de contacto con botón de llamada en vivo */}
            <div style={{ marginTop: '25px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Teléfonos de Contacto</strong>
                <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 700 }}>
                  {selectedClient.telefonos}
                </span>
              </div>
              {selectedClient.telefonos && selectedClient.telefonos !== 'No registrado' && (
                <a
                  href={`tel:${selectedClient.telefonos.split(',')[0].trim()}`}
                  style={{ background: '#059669', color: 'white', padding: '10px 16px', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)' }}
                >
                  <i className="fa-solid fa-phone"></i> Llamar
                </a>
              )}
            </div>
          </div>

          {/* Diagnóstico SmartOLT (Derecha) */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '26px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 850, borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-network-wired" style={{ color: '#0284c7' }}></i> Diagnóstico OLT en Vivo
              </h3>

              {/* Botón de medición */}
              <div style={{ textAlign: 'center', padding: '10px 0 20px 0' }}>
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={isMeasuring}
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', border: 'none', padding: '14px 28px', fontSize: '1rem', fontWeight: 800, borderRadius: '14px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '10px', opacity: isMeasuring ? 0.7 : 1 }}
                >
                  {isMeasuring ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                  {isMeasuring ? 'Midiendo Señal...' : 'Medir Señal Óptica'}
                </button>
              </div>

              {/* Mensajes de error */}
              {diagnosticError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '14px', padding: '16px', marginBottom: '20px', color: '#dc2626', fontSize: '0.88rem', fontWeight: 700 }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i>
                  {diagnosticError}
                </div>
              )}

              {/* Loader visual de medición */}
              {isMeasuring && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: '#0284c7', fontSize: '2.5rem', marginBottom: '15px' }}></i>
                  <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.95rem' }}>Consultando potencia de fibra en la OLT...</p>
                </div>
              )}

              {/* Resultados de Diagnóstico */}
              {diagnosticResult && !isMeasuring && (
                <div>
                  {/* Estado y Potencia de Fibra */}
                  <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <span style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Estado</span>
                      <span style={{ display: 'inline-flex', fontSize: '0.82rem', padding: '6px 14px', borderRadius: '20px', fontWeight: 800, color: 'white', background: diagnosticResult.estado.toLowerCase() === 'online' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                        {diagnosticResult.estado.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1.5px solid var(--border-color)', paddingLeft: '12px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Enganche (Rx)</span>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>
                        {diagnosticResult.potencia_rx}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1.5px solid var(--border-color)', paddingLeft: '12px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Retorno (Tx)</span>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--sidebar-text)' }}>
                        {diagnosticResult.potencia_tx}
                      </strong>
                    </div>
                  </div>

                  {/* Barra de Enganche Rx */}
                  {(() => {
                    const rxProps = getSignalBarProps(diagnosticResult.potencia_rx, true);
                    return (
                      <div style={{ marginBottom: '18px', background: 'var(--profile-bg)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                          📶 Nivel de Enganche (Rx / Bajada)
                        </strong>
                        <div style={{ height: '10px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border-color)' }}>
                          <div style={{ height: '100%', width: rxProps.width, backgroundColor: rxProps.color, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginTop: '6px', color: rxProps.color }}>
                          {rxProps.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Barra de Retorno Tx */}
                  {(() => {
                    const txProps = getSignalBarProps(diagnosticResult.potencia_tx, false);
                    return (
                      <div style={{ marginBottom: '22px', background: 'var(--profile-bg)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                          🔄 Nivel de Retorno (Tx / Subida)
                        </strong>
                        <div style={{ height: '10px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border-color)' }}>
                          <div style={{ height: '100%', width: txProps.width, backgroundColor: txProps.color, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginTop: '6px', color: txProps.color }}>
                          {txProps.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Ficha Técnica OLT Metadata */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: '0.88rem', background: 'var(--profile-bg)', borderRadius: '16px', padding: '18px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>IP WAN:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.ip_wan}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Distancia:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.distancia}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>OLT Asignada:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.olt_name} ({diagnosticResult.pon_port})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Uptime:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.uptime}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Modelo ONU:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.modelo}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>VLAN ONU:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.vlan}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Estado Inicial / Vacío SmartOLT */}
              {!diagnosticResult && !isMeasuring && !diagnosticError && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sidebar-text)' }}>
                  <i className="fa-solid fa-wifi" style={{ fontSize: '3rem', marginBottom: '15px', display: 'block', color: 'var(--border-color)' }}></i>
                  <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>
                    Presiona el botón superior para realizar el diagnóstico óptico del cliente en tiempo real.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Estado Vacío General */
        <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '60px 20px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '4rem', color: 'var(--border-color)', marginBottom: '20px', display: 'block' }}></i>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: 800 }}>Escribe un cliente o contrato para iniciar</h3>
          <p style={{ margin: '8px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.95rem', fontWeight: 500 }}>
            Ingresa el número de contrato, nombre, teléfono o identificación en el buscador superior para desplegar su ficha técnica.
          </p>
        </div>
      )}
    </div>
  );
}

export default BuscadorClienteTab;
