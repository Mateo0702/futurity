import React, { useState, useEffect, useRef } from 'react';

function AtencionesTab({ token, user, onNavigateToRegistroVisitas }) {
  // Today's Local Date helper
  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Form states
  const [contrato, setContrato] = useState('');
  const [cliente, setCliente] = useState('');
  const [telefono1, setTelefono1] = useState('');
  const [telefono2, setTelefono2] = useState('');
  const [sector, setSector] = useState('');
  const [fechaInstalacion, setFechaInstalacion] = useState('');
  
  const [tipoAtencion, setTipoAtencion] = useState('SERVICIO TÉCNICO');
  const [tipoSolicitud, setTipoSolicitud] = useState('SOPORTE TÉCNICO');
  const [medioContacto, setMedioContacto] = useState('WHATSAPP');
  const [accion, setAccion] = useState('SOPORTE MEDIANTE MENSAJES');
  const [motivo, setMotivo] = useState('');
  const [olt, setOlt] = useState('');
  const [observacion, setObservacion] = useState('');

  // UI state
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [contratoOk, setContratoOk] = useState(false);
  const [sectores, setSectores] = useState([]);
  
  // Multi-contract selector state & Plan metadata
  const [multiContratosList, setMultiContratosList] = useState([]);
  const [showMultiContratoModal, setShowMultiContratoModal] = useState(false);
  const [clientPlanInfo, setClientPlanInfo] = useState(null);

  // Right-side card states (Client history by contract)
  const [historialCliente, setHistorialCliente] = useState([]);
  const [contratoBusqueda, setContratoBusqueda] = useState('');
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  
  // Bottom card states (All agent atenciones for selected date)
  const [misAtenciones, setMisAtenciones] = useState([]);
  const [fechaBusqueda, setFechaBusqueda] = useState(getTodayLocal());
  const [loadingMisAtenciones, setLoadingMisAtenciones] = useState(false);
  
  // Bulk load (Carga Masiva) states
  const [showMasivoModal, setShowMasivoModal] = useState(false);
  const [masivoContratos, setMasivoContratos] = useState('');
  const [masivoFecha, setMasivoFecha] = useState('');
  const [masivoTipoAtencion, setMasivoTipoAtencion] = useState('SERVICIO TÉCNICO');
  const [masivoTipoSolicitud, setMasivoTipoSolicitud] = useState('SOPORTE TÉCNICO');
  const [masivoMedioContacto, setMasivoMedioContacto] = useState('WHATSAPP');
  const [masivoAccion, setMasivoAccion] = useState('SOPORTE MEDIANTE MENSAJES');
  const [masivoMotivo, setMasivoMotivo] = useState('');
  const [masivoOlt, setMasivoOlt] = useState('');
  const [masivoObservacion, setMasivoObservacion] = useState('');
  const [masivoResult, setMasivoResult] = useState(null);
  const [masivoLoading, setMasivoLoading] = useState(false);

  // Initial load
  useEffect(() => {
    fetchSectores();
    fetchMisAtenciones(fechaBusqueda);
  }, []);

  // Fetch active sectors
  const fetchSectores = async () => {
    try {
      const res = await fetch('/api/v2/sectores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSectores(data.sectores || []);
      }
    } catch (e) {
      console.error("Error al cargar sectores:", e);
    }
  };

  // Fetch agent atenciones for specific date
  const fetchMisAtenciones = async (targetDate) => {
    setLoadingMisAtenciones(true);
    try {
      const url = `/api/admin/atenciones/recientes?fecha=${encodeURIComponent(targetDate)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMisAtenciones(data.atenciones || []);
      } else if (Array.isArray(data)) {
        setMisAtenciones(data);
      } else {
        setMisAtenciones([]);
      }
    } catch (e) {
      console.error("Error al cargar mis atenciones:", e);
      setMisAtenciones([]);
    } finally {
      setLoadingMisAtenciones(false);
    }
  };

  // Fetch historical support tickets of a specific client by contract
  const fetchHistorialCliente = async (contractNumber) => {
    if (!contractNumber.trim()) return;
    setLoadingHistorial(true);
    try {
      const url = `/api/cliente/atenciones_recientes_contrato?contrato=${encodeURIComponent(contractNumber.trim())}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setHistorialCliente(data.atenciones || []);
      } else if (Array.isArray(data)) {
        setHistorialCliente(data);
      } else {
        setHistorialCliente([]);
      }
    } catch (e) {
      console.error("Error al cargar historial del cliente:", e);
      setHistorialCliente([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Apply selected contract details to form
  const aplicarDatosCliente = (cli) => {
    setContratoOk(true);
    const contractNum = cli.contrato || contrato;
    setContrato(contractNum);
    setCliente(cli.cliente || '');
    setTelefono1(cli.telefono1 || '');
    setTelefono2(cli.telefono2 || '');
    setSector(cli.sector || '');
    if (cli.fecha_instalacion) {
      setFechaInstalacion(cli.fecha_instalacion.substring(0, 10));
    }

    setClientPlanInfo({
      producto: cli.producto || '',
      velocidad_mbps: cli.velocidad_mbps || null,
      ip_cliente: cli.ip_cliente || '',
      ip_nodo: cli.ip_nodo || '',
      nodo_nombre: cli.nodo_nombre || '',
      numero_serie: cli.numero_serie || '',
      cedula: cli.cedula || '',
      modelo_ont: cli.modelo_ont || '',
      router_principal: cli.router_principal || '',
      router_secundario: cli.router_secundario || '',
      tipo_mesh: cli.tipo_mesh || '',
      cantidad_routers: cli.cantidad_routers || 1,
      modo_acceso: cli.modo_acceso || ''
    });

    // Auto-detect OLT / Nodo from IP or name
    if (cli.nodo_nombre && ['1.18', '1.50', '99.1', 'BAÑOS', 'AZOGUES', 'ESTADIO', 'FIBRACOM VALLE', 'FIBRACOM SANTA ANA'].includes(cli.nodo_nombre)) {
      setOlt(cli.nodo_nombre);
    } else if (cli.ip_nodo) {
      if (cli.ip_nodo.includes('1.18') || cli.ip_nodo === '10.101.18') setOlt('1.18');
      else if (cli.ip_nodo.includes('1.50')) setOlt('1.50');
      else if (cli.ip_nodo.includes('99.1')) setOlt('99.1');
      else if (cli.ip_nodo.includes('80.134')) setOlt('BAÑOS');
      else if (cli.ip_nodo.includes('200.52')) setOlt('AZOGUES');
      else if (cli.ip_nodo.includes('100.10')) setOlt('ESTADIO');
      else if (cli.ip_nodo.includes('21.2')) setOlt('FIBRACOM VALLE');
      else if (cli.ip_nodo.includes('20.2')) setOlt('FIBRACOM SANTA ANA');
    }

    if (cli.modelo_ont) setOnt(cli.modelo_ont);
    if (cli.router_principal) setRouter(cli.router_principal);

    // Load customer history in right side
    setContratoBusqueda(contractNum);
    fetchHistorialCliente(contractNum);
    setShowMultiContratoModal(false);
  };


  // Blur handler to autocomplete client from contract
  const handleContratoBlur = async () => {
    if (!contrato.trim()) return;
    setLoadingContrato(true);
    setContratoOk(false);

    try {
      const res = await fetch(`/api/cliente/buscar_contrato_json?contrato=${encodeURIComponent(contrato.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'multi_contrato' && data.contratos && data.contratos.length > 1) {
        setMultiContratosList(data.contratos);
        setShowMultiContratoModal(true);
      } else if (data.status === 'success' && data.cliente) {
        aplicarDatosCliente(data.cliente);
      }
    } catch (e) {
      console.error("Error de búsqueda de contrato:", e);
    } finally {
      setLoadingContrato(false);
    }
  };

  // Submit standard single attention registration
  const handleSingleSubmit = async (e, shouldGenerateVisit = false) => {
    if (e) e.preventDefault();
    if (!contrato.trim() || !cliente.trim() || !observacion.trim()) {
      alert("Por favor completa los campos obligatorios (Contrato, Cliente, Observación).");
      return;
    }

    try {
      const res = await fetch('/api/admin/atenciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contrato,
          cliente,
          telefono1,
          telefono2,
          sector,
          fecha_instalacion: fechaInstalacion,
          tipo_atencion: tipoAtencion,
          tipo_solicitud: tipoSolicitud,
          medio_contacto: medioContacto,
          accion,
          motivo,
          olt,
          observacion
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert("¡Atención registrada con éxito!");

        const visitData = {
          contrato: contrato.trim(),
          cliente: cliente.trim(),
          sector: sector.trim(),
          telefonos: [telefono1, telefono2].filter(Boolean).join(' / '),
          problema: motivo || 'VISITA TÉCNICA',
          observacionCallcenter: observacion
        };

        // Reset form
        setContrato('');
        setCliente('');
        setTelefono1('');
        setTelefono2('');
        setSector('');
        setFechaInstalacion('');
        setAccion('SOPORTE MEDIANTE MENSAJES');
        setMotivo('');
        setObservacion('');
        setOlt('');
        setContratoOk(false);
        fetchMisAtenciones(fechaBusqueda);

        // Auto-navigate to RegistroVisitasTab ONLY if explicitly requested via "Agendar Visita" button
        if (shouldGenerateVisit && onNavigateToRegistroVisitas) {
          onNavigateToRegistroVisitas(visitData);
        }
      } else {
        alert("Error al registrar: " + data.message);
      }
    } catch (err) {
      alert("Error de conexión al guardar la atención.");
    }
  };

  // Count contracts pasted in textarea
  const getMasivoContratosCount = () => {
    const list = masivoContratos.split(/[\r\n,;\s]+/).map(c => c.trim()).filter(c => c.length > 0);
    return [...new Set(list)].length;
  };

  // Submit Carga Masiva (Lote)
  const handleMasivoSubmit = async (e) => {
    e.preventDefault();
    if (!masivoContratos.trim()) {
      alert("Ingresa al menos un número de contrato.");
      return;
    }

    setMasivoLoading(true);
    setMasivoResult(null);

    try {
      const res = await fetch('/api/admin/atenciones/masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contratos: masivoContratos,
          fecha: masivoFecha,
          tipo_atencion: masivoTipoAtencion,
          tipo_solicitud: masivoTipoSolicitud,
          medio_contacto: masivoMedioContacto,
          accion: masivoAccion,
          motivo: masivoMotivo,
          olt: masivoOlt,
          observacion: masivoObservacion
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setMasivoResult({
          type: 'success',
          message: data.message || 'Lote procesado exitosamente.',
          creados: data.creados,
          noEncontrados: data.no_encontrados || []
        });
        setMasivoContratos('');
        const dateToFetch = masivoFecha || fechaBusqueda;
        if (masivoFecha && masivoFecha !== fechaBusqueda) {
          setFechaBusqueda(masivoFecha);
        }
        fetchMisAtenciones(dateToFetch);
      } else {
        setMasivoResult({
          type: 'error',
          message: data.message || 'Error al procesar el lote.'
        });
      }
    } catch (err) {
      setMasivoResult({
        type: 'error',
        message: 'Error de conexión con la API de Carga Masiva.'
      });
    } finally {
      setMasivoLoading(false);
    }
  };

  return (
    <div id="tab-registro-atencion" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Encabezado Principal */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-headset" style={{ color: 'var(--primary)' }}></i> Registro de Atenciones Diarias
          </h1>
          <p style={{ marginTop: '4px', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Gestión en tiempo real de llamadas, soportes de WhatsApp, atenciones de oficina y cargas en lote.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Botón Carga Masiva (Lote) */}
          <button
            type="button"
            onClick={() => {
              setMasivoFecha(getTodayLocal());
              setMasivoResult(null);
              setShowMasivoModal(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
          >
            <i className="fa-solid fa-layer-group" style={{ fontSize: '1rem' }}></i> Carga Masiva (Lote)
          </button>

          {/* Badge Agente Activo */}
          <div style={{ background: 'var(--profile-bg)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--sidebar-text)' }}>
              Agente: <strong style={{ color: 'var(--text-main)', marginLeft: '4px' }}>{user?.nombre || 'Call Center'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Formulario Form (Izquierda) + Stopwatch & History (Derecha) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '25px', alignItems: 'start' }}>
        
        {/* Lado Izquierdo: Formulario de Registro */}
        <div className="card" style={{ padding: '28px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <form onSubmit={handleSingleSubmit}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-pen-to-square"></i> Nueva Atención Individual
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Fila 1: Cédula o Contrato + Cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '16px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                  Cédula o Contrato: <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={contrato}
                    onChange={(e) => setContrato(e.target.value)}
                    onBlur={handleContratoBlur}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleContratoBlur(); } }}
                    placeholder="Ej: Cédula o Contrato (47d, 10F)"
                    className="form-control"
                    style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                    required
                  />
                  {loadingContrato && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} className="spinner"></span>}
                  {contratoOk && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }}><i className="fa-solid fa-circle-check"></i></span>}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                  Nombre del Cliente: <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre completo"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                  required
                />
              </div>
            </div>

            {/* Banner de Información Comercial / Plan / Velocidad / ONU / Equipos */}
            {clientPlanInfo && (clientPlanInfo.producto || clientPlanInfo.velocidad_mbps || clientPlanInfo.ip_cliente || clientPlanInfo.ip_nodo || clientPlanInfo.modelo_ont || clientPlanInfo.router_principal) && (
              <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: '12px', padding: '8px 14px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '0.8rem' }}>
                {clientPlanInfo.cedula && (
                  <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                    🪪 <strong>Cédula:</strong> {clientPlanInfo.cedula}
                  </span>
                )}
                {clientPlanInfo.producto && (
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>
                    📦 <strong>Plan:</strong> {clientPlanInfo.producto}
                  </span>
                )}
                {clientPlanInfo.velocidad_mbps !== null && clientPlanInfo.velocidad_mbps !== undefined && (
                  <span style={{ background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    ⚡ {clientPlanInfo.velocidad_mbps} Mbps
                  </span>
                )}
                {clientPlanInfo.ip_nodo && (
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>
                    🏢 <strong>Nodo:</strong> {clientPlanInfo.nodo_nombre || clientPlanInfo.ip_nodo}
                  </span>
                )}
                {clientPlanInfo.modelo_ont && (
                  <span style={{ color: '#059669', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                    🟢 <strong>ONT:</strong> {clientPlanInfo.modelo_ont}
                  </span>
                )}
                {clientPlanInfo.numero_serie && (
                  <span style={{ color: '#d97706', fontWeight: 700 }}>
                    🏷️ <strong>SN:</strong> {clientPlanInfo.numero_serie}
                  </span>
                )}
                {clientPlanInfo.router_principal && (
                  <span style={{ color: '#6366f1', fontWeight: 700, background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                    📶 <strong>Router:</strong> {clientPlanInfo.router_principal} {clientPlanInfo.modo_acceso ? `(${clientPlanInfo.modo_acceso})` : ''}
                  </span>
                )}
                {clientPlanInfo.tipo_mesh && (
                  <span style={{ color: '#8b5cf6', fontWeight: 700, background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                    🔁 <strong>Mesh:</strong> {clientPlanInfo.tipo_mesh}
                  </span>
                )}
                {clientPlanInfo.ip_cliente && (
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    🌐 <strong>IP:</strong> {clientPlanInfo.ip_cliente}
                  </span>
                )}
              </div>
            )}



            {/* Fila 2: Teléfono 1 + Teléfono 2 + Sector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Teléfono Principal:</label>
                <input
                  type="text"
                  value={telefono1}
                  onChange={(e) => setTelefono1(e.target.value)}
                  placeholder="Ej. 0992321716"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Teléfono Secundario:</label>
                <input
                  type="text"
                  value={telefono2}
                  onChange={(e) => setTelefono2(e.target.value)}
                  placeholder="Opcional"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Sector:</label>
                <input
                  type="text"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="form-control"
                  list="react-sectores-list"
                  placeholder="Seleccionar..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
                <datalist id="react-sectores-list">
                  {sectores.map((s, idx) => (
                    <option key={idx} value={s.nombre_sector}></option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* Clasificación del Soporte */}
            <div style={{ marginTop: '22px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h4 style={{ margin: 0, color: 'var(--sidebar-text)', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <i className="fa-solid fa-sliders" style={{ marginRight: '6px' }}></i> Clasificación de la Atención
              </h4>
            </div>

            {/* Fila 3: Tipo Atención + Solicitud + Medio + Acción */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Tipo de Atención:</label>
                <select
                  value={tipoAtencion}
                  onChange={(e) => setTipoAtencion(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="SERVICIO TÉCNICO">SERVICIO TÉCNICO</option>
                  <option value="ATENCIÓN AL CLIENTE">ATENCIÓN AL CLIENTE</option>
                  <option value="COBRANZAS">COBRANZAS</option>
                  <option value="VENTAS">VENTAS</option>
                  <option value="CANCELACIÓN">CANCELACIÓN</option>
                  <option value="OTROS">OTROS</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Tipo de Solicitud:</label>
                <select
                  value={tipoSolicitud}
                  onChange={(e) => setTipoSolicitud(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="SOPORTE TÉCNICO">SOPORTE TÉCNICO</option>
                  <option value="ACTUALIZACION DE DATOS">ACTUALIZACION DE DATOS</option>
                  <option value="ACTUALIZACION DE DEBITO">ACTUALIZACION DE DEBITO</option>
                  <option value="CAMBIO DE DOMICILIO">CAMBIO DE DOMICILIO</option>
                  <option value="ENTREGA DE EQUIPOS">ENTREGA DE EQUIPOS</option>
                  <option value="INCREMENTO MEGAS">INCREMENTO MEGAS</option>
                  <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                  <option value="MIGRACIÓN">MIGRACIÓN</option>
                  <option value="RETIRAR EQUIPOS">RETIRAR EQUIPOS</option>
                  <option value="CONSULTA">CONSULTA</option>
                  <option value="ENTREGAR EQUIPOS">ENTREGAR EQUIPOS</option>
                  <option value="ACUERDO DE PAGOS">ACUERDO DE PAGOS</option>
                  <option value="DEBITO DE CTA O T/C">DEBITO DE CTA O T/C</option>
                  <option value="PAGO FACTURA">PAGO FACTURA</option>
                  <option value="RECONEXION">RECONEXION</option>
                  <option value="RETIRO DE FACTURA">RETIRO DE FACTURA</option>
                  <option value="FACTURACION">FACTURACION</option>
                  <option value="INSTALACION ADICIONAL">INSTALACION ADICIONAL</option>
                  <option value="INSTALACION NUEVA">INSTALACION NUEVA</option>
                  <option value="VENTA DE ROUTER">VENTA DE ROUTER</option>
                  <option value="CONTRATA ZAPPING">CONTRATA ZAPPING</option>
                  <option value="CONTRATA DGO">CONTRATA DGO</option>
                  <option value="RECLAMO">RECLAMO</option>
                  <option value="RETENCIÓN">RETENCIÓN</option>
                  <option value="CANCELACIÓN DEFINITIVA">CANCELACIÓN DEFINITIVA</option>
                  <option value="CORTE VOLUNTARIO">CORTE VOLUNTARIO</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Medio de Contacto:</label>
                <select
                  value={medioContacto}
                  onChange={(e) => setMedioContacto(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="OFICINA">🏢 OFICINA</option>
                  <option value="TELEFONO">📞 TELÉFONO</option>
                  <option value="WHATSAPP">💬 WHATSAPP</option>
                  <option value="WHATSAPP + TELEFONO">💬📞 WHATSAPP + TELEFONO</option>
                  <option value="REDES SOCIALES">🌐 REDES SOCIALES</option>
                  <option value="CHAT INTERNO">💬 CHAT INTERNO</option>
                  <option value="CONTROL CALIDAD">🛡️ CONTROL CALIDAD</option>
                  <option value="WHATSAPP TECNICOS">📲 WHATSAPP TECNICOS</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Acción Realizada:</label>
                <select
                  value={accion}
                  onChange={(e) => setAccion(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="VISITA TECNICA">VISITA TECNICA</option>
                  <option value="VISITA TECNICA COBRADA">VISITA TECNICA COBRADA</option>
                  <option value="SOPORTE MEDIANTE LLAMADA">SOPORTE MEDIANTE LLAMADA</option>
                  <option value="LLAMADA SALIENTE">LLAMADA SALIENTE</option>
                  <option value="SMART OLT">SMART OLT</option>
                  <option value="SOPORTE MEDIANTE MENSAJES">SOPORTE MEDIANTE MENSAJES</option>
                  <option value="CORTE INTERNO DE SERVICIO">CORTE INTERNO DE SERVICIO</option>
                  <option value="SOPORTE EN OFICINAS">SOPORTE EN OFICINAS</option>
                  <option value="SOPORTE A TECNICO DE CAMPO">SOPORTE A TECNICO DE CAMPO</option>
                  <option value="TRANSFERIR / EXTENSIONES">TRANSFERIR / EXTENSIONES</option>
                  <option value="SE DA INFORMACION">SE DA INFORMACION</option>
                  <option value="ESCALAR A TECNOLOGIA">ESCALAR A TECNOLOGIA</option>
                  <option value="RETENCION">RETENCION</option>
                </select>
              </div>
            </div>

            {/* Motivo de Consulta & OLT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Motivo de Consulta:</label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Escribe para buscar motivo..."
                  className="form-control"
                  list="react-motivos-list"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                  required
                />
                <datalist id="react-motivos-list">
                  <option value="INFORMACION / PAGOS"></option>
                  <option value="Visita Radio Enlace"></option>
                  <option value="Visita Potencia Degradada"></option>
                  <option value="Visita Revisión de Servicio"></option>
                  <option value="Visita Equipo Alarmado"></option>
                  <option value="Visita Cambio de Router"></option>
                  <option value="Visita Colocación de Router"></option>
                  <option value="Visita Configuración de Equipos"></option>
                  <option value="Visita HFC"></option>
                  <option value="Visita Canales Borrosos"></option>
                  <option value="Visita Paso de Cable UTP"></option>
                  <option value="Visita Reubicación de equipos (Retención)"></option>
                  <option value="VISITA TECNICA Equipos no Encienden"></option>
                  <option value="VISITA TECNICA No Marca Velocidad Contratada"></option>
                  <option value="Visita Paso de Cable Fibra O. (Cobrado)"></option>
                  <option value="Visita Paso de Cable RG6 (Cobrado)"></option>
                  <option value="Visita Paso de Cable UTP (Cobrado)"></option>
                  <option value="Visita Configuración de Equipos (Cobrado)"></option>
                  <option value="Visita Reubicación de equipos (Cobrado)"></option>
                  <option value="Visita Cambio de ONU"></option>
                  <option value="Visita sin servicio de cable"></option>
                  <option value="Desconfiguración de Equipos"></option>
                  <option value="Equipos apagados"></option>
                  <option value="Equipos Inhibidos"></option>
                  <option value="Validación de Servicio"></option>
                  <option value="Problema con dispositivos del cliente"></option>
                  <option value="Configuración de Equipos ONU / Router"></option>
                  <option value="Migración / Potencia degradada"></option>
                  <option value="Configuración mediante ANY DESK"></option>
                  <option value="CUENTAS ZAPPING"></option>
                  <option value="Activación de Servicio"></option>
                  <option value="Cambio de Domicilio"></option>
                  <option value="Migración de Servicio"></option>
                  <option value="Actualización de Velocidad"></option>
                  <option value="Configuración de Equipos en instalación"></option>
                  <option value="Paso a Cartera"></option>
                  <option value="Paso a Ventas"></option>
                  <option value="Paso a soporte técnico"></option>
                  <option value="Corte de servicio - Reconexión Autorizada"></option>
                  <option value="Corte de servicio - Corte Autorizado"></option>
                  <option value="Valores a Pagar"></option>
                  <option value="Dirección y Horarios de Atención"></option>
                  <option value="Acuerdo de Pagos"></option>
                  <option value="Actualización de Pagos"></option>
                  <option value="Recepción de Equipos"></option>
                  <option value="Información"></option>
                  <option value="TICKET AL NOC / DAÑO HFC"></option>
                  <option value="TICKET AL NOC / DAÑO GPON"></option>
                  <option value="TICKET AL NOC / DAÑO RADIAL"></option>
                  <option value="TICKET AL NOC / SIN CANAL"></option>
                  <option value="TICKET AL NOC / PAGINAS BLOQUEADAS"></option>
                  <option value="TICKET AL NOC / NAT TIPO 3"></option>
                  <option value="TICKET AL NOC / CAIDA GENERAL"></option>
                  <option value="CAÍDA GENERAL / OLT"></option>
                  <option value="COBRO CON TARJETA"></option>
                  <option value="PASO A RETENCION"></option>
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Nodo / OLT:</label>
                <select
                  value={olt}
                  onChange={(e) => setOlt(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="">-- Sin Especificar / Ninguno --</option>
                  <option value="1.18">1.18</option>
                  <option value="1.50">1.50</option>
                  <option value="99.1">99.1</option>
                  <option value="BAÑOS">BAÑOS</option>
                  <option value="AZOGUES">AZOGUES</option>
                  <option value="ESTADIO">ESTADIO</option>
                  <option value="BASES">BASES</option>
                  <option value="RB">RB</option>
                  <option value="HFC">HFC</option>
                  <option value="FIBRACOM VALLE">FIBRACOM VALLE</option>
                  <option value="FIBRACOM SANTA ANA">FIBRACOM SANTA ANA</option>
                </select>
              </div>
            </div>

            {/* Banner Dinámico Alerta Visita Técnica */}
            {(accion.toUpperCase().includes('VISITA') || motivo.toLowerCase().includes('visita')) && (
              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid #c7d2fe', borderLeft: '5px solid #6366f1', padding: '16px', borderRadius: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                <div>
                  <strong style={{ color: '#4f46e5', display: 'block', fontSize: '0.88rem' }}><i className="fa-solid fa-circle-exclamation"></i> Visita Técnica Requerida</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)' }}>Esta atención está catalogada como Visita. Puedes agendarla de inmediato.</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => handleSingleSubmit(null, true)}
                  style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  <i className="fa-solid fa-calendar-plus"></i> Agendar Visita
                </button>
              </div>
            )}

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                Observación / Detalles: <span style={{ color: 'var(--primary)' }}>*</span>
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows="3"
                placeholder="Escribe la solución o detalle del contacto con el cliente..."
                className="form-control"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                required
              ></textarea>
            </div>

            <button
              type="submit"
              className="btn"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(225, 29, 72, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-floppy-disk"></i> Registrar Atención Diaria
            </button>
          </form>
        </div>

        {/* Lado Derecho: Historial del Cliente por Contrato */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Tarjeta Historial del Cliente */}
          <div className="card" style={{ padding: '24px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', minHeight: '540px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary)' }}></i> Historial por Contrato
            </h3>

            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)', fontSize: '0.85rem' }}></i>
              <input
                type="text"
                value={contratoBusqueda}
                onChange={(e) => setContratoBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchHistorialCliente(contratoBusqueda);
                  }
                }}
                placeholder="Buscar contrato..."
                className="form-control"
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px', flexGrow: 1, paddingRight: '4px' }}>
              {loadingHistorial ? (
                <div style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontSize: '0.85rem', padding: '30px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px auto' }}></div>
                  Buscando historial...
                </div>
              ) : historialCliente.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--sidebar-text)', fontSize: '0.82rem', padding: '30px 10px', fontStyle: 'italic' }}>
                  <i className="fa-solid fa-folder-open" style={{ display: 'block', fontSize: '1.6rem', marginBottom: '8px', opacity: 0.5 }}></i>
                  Ingresa un número de contrato para desplegar el historial de soportes previos del cliente.
                </div>
              ) : (
                historialCliente.map((at, idx) => {
                  let badgeBg = '#e0e7ff';
                  let badgeColor = '#4338ca';
                  let iconClass = 'fa-solid fa-headset';

                  if (at.medio_contacto === 'WHATSAPP') {
                    badgeBg = '#d1fae5';
                    badgeColor = '#065f46';
                    iconClass = 'fa-brands fa-whatsapp';
                  } else if (at.medio_contacto === 'TELEFONO') {
                    badgeBg = '#dbeafe';
                    badgeColor = '#1e40af';
                    iconClass = 'fa-solid fa-phone';
                  } else if (at.medio_contacto === 'OFICINA') {
                    badgeBg = '#fef3c7';
                    badgeColor = '#b45309';
                    iconClass = 'fa-solid fa-building';
                  }

                  return (
                    <div className="historial-item" key={idx} style={{ borderLeftColor: badgeColor }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                        <span><i className="fa-regular fa-calendar-days" style={{ marginRight: '4px' }}></i> {at.fecha ? at.fecha.split('-').reverse().join('/') : ''} {at.hora ? `a las ${at.hora.substring(0, 5)}` : ''}</span>
                        <span style={{ background: badgeBg, color: badgeColor, padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className={iconClass}></i> {at.medio_contacto || 'Otro'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem', marginBottom: '4px' }}>
                        {at.motivo || 'Atención general'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px' }}>
                        <i className="fa-solid fa-user-headset" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Atendido por: <span style={{ color: 'var(--text-main)', fontWeight: 800 }}>{at.agente || 'Call Center'}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, marginBottom: '6px' }}>
                        Acción: {at.accion || 'Soporte brindado'}
                      </div>
                      <div className="historial-item-obs">
                        "{at.observacion || 'Sin detalles'}"
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sección Inferior: Mis Atenciones Registradas del Día */}
      <div className="card" style={{ marginTop: '30px', padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-list-check" style={{ color: 'var(--primary)' }}></i> Registros del Día
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label htmlFor="aten_buscar_fecha" style={{ fontWeight: 700, color: 'var(--sidebar-text)', fontSize: '0.85rem' }}>Filtrar por Fecha:</label>
            <input
              type="date"
              id="aten_buscar_fecha"
              value={fechaBusqueda}
              onChange={(e) => {
                setFechaBusqueda(e.target.value);
                fetchMisAtenciones(e.target.value);
              }}
              className="form-control"
              style={{ padding: '8px 14px', fontSize: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', width: 'auto', fontWeight: 600 }}
            />
            <span className="badge badge-primary" style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>
              {misAtenciones.length} registros
            </span>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="historial-reciente-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Sector</th>
                <th>Atención</th>
                <th>Solicitud</th>
                <th>Medio</th>
                <th>Acción</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {loadingMisAtenciones ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '30px 0' }}>Cargando atenciones...</td>
                </tr>
              ) : misAtenciones.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--sidebar-text)', padding: '30px 0', fontStyle: 'italic' }}>No se encontraron registros de atenciones para la fecha seleccionada.</td>
                </tr>
              ) : (
                misAtenciones.map((at, idx) => {
                  const initials = at.cliente ? at.cliente.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : 'CL';
                  
                  let medioBadgeClass = 'pro-badge-neutral';
                  let medioIcon = 'fa-solid fa-comment-dots';
                  if (at.medio_contacto === 'WHATSAPP') {
                    medioBadgeClass = 'pro-badge-whatsapp';
                    medioIcon = 'fa-brands fa-whatsapp';
                  } else if (at.medio_contacto === 'TELEFONO') {
                    medioBadgeClass = 'pro-badge-phone';
                    medioIcon = 'fa-solid fa-phone';
                  } else if (at.medio_contacto === 'OFICINA') {
                    medioBadgeClass = 'pro-badge-office';
                    medioIcon = 'fa-solid fa-building';
                  }

                  return (
                    <tr key={idx}>
                      <td>
                        <span className="pro-time-tag">
                          <i className="fa-regular fa-clock"></i> {at.hora ? at.hora.substring(0, 5) : '-'}
                        </span>
                      </td>
                      <td>
                        <span className="pro-contract-pill">#{at.contrato || '-'}</span>
                      </td>
                      <td>
                        <div className="pro-client-cell">
                          <div className="pro-avatar-circle">{initials}</div>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{at.cliente}</span>
                        </div>
                      </td>
                      <td><span className="pro-badge-neutral"><i className="fa-solid fa-location-dot" style={{ marginRight: '4px', opacity: 0.6 }}></i> {at.sector || '-'}</span></td>
                      <td><span className="pro-badge-cyan">{at.tipo_atencion || '-'}</span></td>
                      <td><span className="pro-badge-amber">{at.tipo_solicitud || '-'}</span></td>
                      <td>
                        <span className={medioBadgeClass}>
                          <i className={medioIcon}></i> {at.medio_contacto || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981' }}>{at.accion || '-'}</td>
                      <td>
                        <div className="pro-obs-box" title={at.observacion}>
                          {at.observacion || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Carga Masiva (Lote) */}
      {showMasivoModal && (
        <div style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', color: 'var(--text-main)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', width: '46px', height: '46px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: 800 }}>Carga Masiva por Lote de Contratos</h3>
                  <p style={{ margin: '3px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.85rem' }}>Pega una lista de contratos desde Excel/Drive y asigna los parámetros del lote.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMasivoModal(false)}
                style={{ background: 'var(--profile-bg)', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--sidebar-text)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleMasivoSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* Lista de Contratos */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>Lista de Contratos (pegar de Excel/Drive):</label>
                    <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: '8px' }}>
                      {getMasivoContratosCount()} detectados
                    </span>
                  </div>
                  <textarea
                    value={masivoContratos}
                    onChange={(e) => setMasivoContratos(e.target.value)}
                    rows="11"
                    className="form-control"
                    placeholder="Pega aquí los números de contratos (uno por línea)...&#10;Ejemplo:&#10;38404&#10;41413&#10;032350&#10;20005"
                    required
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem', padding: '14px', lineHeight: '1.5', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)' }}
                  ></textarea>
                </div>

                {/* Campos Comunes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Fecha del Registro:</label>
                    <input
                      type="date"
                      value={masivoFecha}
                      onChange={(e) => setMasivoFecha(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Tipo de Atención:</label>
                    <select
                      value={masivoTipoAtencion}
                      onChange={(e) => setMasivoTipoAtencion(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <option value="SERVICIO TÉCNICO">SERVICIO TÉCNICO</option>
                      <option value="ATENCIÓN AL CLIENTE">ATENCIÓN AL CLIENTE</option>
                      <option value="COBRANZAS">COBRANZAS</option>
                      <option value="VENTAS">VENTAS</option>
                      <option value="CANCELACIÓN">CANCELACIÓN</option>
                      <option value="OTROS">OTROS</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Tipo de Solicitud:</label>
                    <select
                      value={masivoTipoSolicitud}
                      onChange={(e) => setMasivoTipoSolicitud(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <option value="SOPORTE TÉCNICO">SOPORTE TÉCNICO</option>
                      <option value="ACTUALIZACION DE DATOS">ACTUALIZACION DE DATOS</option>
                      <option value="ACTUALIZACION DE DEBITO">ACTUALIZACION DE DEBITO</option>
                      <option value="CAMBIO DE DOMICILIO">CAMBIO DE DOMICILIO</option>
                      <option value="ENTREGA DE EQUIPOS">ENTREGA DE EQUIPOS</option>
                      <option value="INCREMENTO MEGAS">INCREMENTO MEGAS</option>
                      <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                      <option value="MIGRACIÓN">MIGRACIÓN</option>
                      <option value="RETIRAR EQUIPOS">RETIRAR EQUIPOS</option>
                      <option value="CONSULTA">CONSULTA</option>
                      <option value="ENTREGAR EQUIPOS">ENTREGAR EQUIPOS</option>
                      <option value="ACUERDO DE PAGOS">ACUERDO DE PAGOS</option>
                      <option value="DEBITO DE CTA O T/C">DEBITO DE CTA O T/C</option>
                      <option value="PAGO FACTURA">PAGO FACTURA</option>
                      <option value="RECONEXION">RECONEXION</option>
                      <option value="RETIRO DE FACTURA">RETIRO DE FACTURA</option>
                      <option value="FACTURACION">FACTURACION</option>
                      <option value="INSTALACION ADICIONAL">INSTALACION ADICIONAL</option>
                      <option value="INSTALACION NUEVA">INSTALACION NUEVA</option>
                      <option value="VENTA DE ROUTER">VENTA DE ROUTER</option>
                      <option value="CONTRATA ZAPPING">CONTRATA ZAPPING</option>
                      <option value="CONTRATA DGO">CONTRATA DGO</option>
                      <option value="RECLAMO">RECLAMO</option>
                      <option value="RETENCIÓN">RETENCIÓN</option>
                      <option value="CANCELACIÓN DEFINITIVA">CANCELACIÓN DEFINITIVA</option>
                      <option value="CORTE VOLUNTARIO">CORTE VOLUNTARIO</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Medio de Contacto:</label>
                    <select
                      value={masivoMedioContacto}
                      onChange={(e) => setMasivoMedioContacto(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <option value="WHATSAPP">💬 WHATSAPP</option>
                      <option value="TELEFONO">📞 TELÉFONO</option>
                      <option value="OFICINA">🏢 OFICINA</option>
                      <option value="WHATSAPP + TELEFONO">💬📞 WHATSAPP + TELEFONO</option>
                      <option value="REDES SOCIALES">🌐 REDES SOCIALES</option>
                      <option value="CHAT INTERNO">💬 CHAT INTERNO</option>
                      <option value="CONTROL CALIDAD">🛡️ CONTROL CALIDAD</option>
                      <option value="WHATSAPP TECNICOS">📲 WHATSAPP TECNICOS</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Acción Realizada:</label>
                    <select
                      value={masivoAccion}
                      onChange={(e) => setMasivoAccion(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <option value="SOPORTE MEDIANTE MENSAJES">SOPORTE MEDIANTE MENSAJES</option>
                      <option value="SOPORTE MEDIANTE LLAMADA">SOPORTE MEDIANTE LLAMADA</option>
                      <option value="VISITA TECNICA">VISITA TECNICA</option>
                      <option value="VISITA TECNICA COBRADA">VISITA TECNICA COBRADA</option>
                      <option value="LLAMADA SALIENTE">LLAMADA SALIENTE</option>
                      <option value="SMART OLT">SMART OLT</option>
                      <option value="CORTE INTERNO DE SERVICIO">CORTE INTERNO DE SERVICIO</option>
                      <option value="SOPORTE EN OFICINAS">SOPORTE EN OFICINAS</option>
                      <option value="SOPORTE A TECNICO DE CAMPO">SOPORTE A TECNICO DE CAMPO</option>
                      <option value="TRANSFERIR / EXTENSIONES">TRANSFERIR / EXTENSIONES</option>
                      <option value="SE DA INFORMACION">SE DA INFORMACION</option>
                      <option value="ESCALAR A TECNOLOGIA">ESCALAR A TECNOLOGIA</option>
                      <option value="RETENCION">RETENCION</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Motivo de Consulta:</label>
                  <input
                    type="text"
                    value={masivoMotivo}
                    onChange={(e) => setMasivoMotivo(e.target.value)}
                    placeholder="Escribe para buscar motivo..."
                    className="form-control"
                    list="react-motivos-list"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Nodo / OLT:</label>
                  <select
                    value={masivoOlt}
                    onChange={(e) => setMasivoOlt(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">-- Sin Especificar / Ninguno --</option>
                    <option value="1.18">1.18</option>
                    <option value="1.50">1.50</option>
                    <option value="99.1">99.1</option>
                    <option value="BAÑOS">BAÑOS</option>
                    <option value="AZOGUES">AZOGUES</option>
                    <option value="ESTADIO">ESTADIO</option>
                    <option value="BASES">BASES</option>
                    <option value="RB">RB</option>
                    <option value="HFC">HFC</option>
                    <option value="FIBRACOM VALLE">FIBRACOM VALLE</option>
                    <option value="FIBRACOM SANTA ANA">FIBRACOM SANTA ANA</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Observación / Acción común:</label>
                  <input
                    type="text"
                    value={masivoObservacion}
                    onChange={(e) => setMasivoObservacion(e.target.value)}
                    placeholder="Opcional..."
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Resultados */}
              {masivoResult && (
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  borderRadius: '14px',
                  fontSize: '0.88rem',
                  background: masivoResult.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${masivoResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: masivoResult.type === 'success' ? '#065f46' : '#991b1b'
                }}>
                  <strong>{masivoResult.type === 'success' ? '¡Lote Procesado!' : 'Error:'}</strong> {masivoResult.message}
                  {masivoResult.creados && (
                    <div style={{ marginTop: '4px', fontWeight: 700 }}>
                      ✔ Se registraron {masivoResult.creados} atenciones correctamente.
                    </div>
                  )}
                  {masivoResult.noEncontrados && masivoResult.noEncontrados.length > 0 && (
                    <div style={{ marginTop: '8px', color: '#b45309', fontSize: '0.82rem' }}>
                      ⚠️ Nota: Los siguientes contratos no se encontraron en la BD: {masivoResult.noEncontrados.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowMasivoModal(false)}
                  style={{ background: 'var(--profile-bg)', color: 'var(--sidebar-text)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={masivoLoading}
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 800, fontSize: '0.88rem', cursor: masivoLoading ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i> {masivoLoading ? 'Procesando lote...' : 'Registrar Lote de Atenciones'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selector Multi-Contrato para Cédula con varios servicios */}
      {showMultiContratoModal && (

        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '92%', maxWidth: '680px', padding: '26px', boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-address-card"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 800 }}>
                    Cliente con Múltiples Contratos
                  </h3>
                  <p style={{ margin: 0, color: 'var(--sidebar-text)', fontSize: '0.82rem' }}>
                    Esta identificación tiene {multiContratosList.length} servicios registrados. Selecciona el contrato a gestionar:
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowMultiContratoModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '1.6rem', color: 'var(--sidebar-text)', cursor: 'pointer', padding: '0 6px' }}
              >
                &times;
              </button>
            </div>

            {/* Subheader info cliente */}
            {multiContratosList.length > 0 && (
              <div style={{ background: 'var(--profile-bg)', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  👤 {multiContratosList[0].cliente}
                </span>
                {multiContratosList[0].cedula && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                    🪪 Cédula: <strong>{multiContratosList[0].cedula}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Listado de Contratos */}
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {multiContratosList.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => aplicarDatosCliente(item)}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '16px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', fontWeight: 900, fontSize: '0.92rem', padding: '4px 10px', borderRadius: '8px' }}>
                        Contrato: {item.contrato}
                      </span>
                      <span style={{ background: item.empresa === 'FIBRACOM' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: item.empresa === 'FIBRACOM' ? '#a855f7' : '#2563eb', fontWeight: 800, fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px' }}>
                        {item.empresa || 'SERVICABLE'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); aplicarDatosCliente(item); }}
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-check"></i> Seleccionar
                    </button>
                  </div>

                  <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', display: 'grid', gridTemplateColumns: '1fr', gap: '4px', marginTop: '4px' }}>
                    <div>
                      <strong style={{ color: 'var(--sidebar-text)' }}>📍 Dirección: </strong>
                      <span>{item.direccion || 'Sin dirección registrada'}</span>
                      {item.sector && <span style={{ color: '#0284c7', fontWeight: 700 }}> ({item.sector})</span>}
                    </div>
                    {item.producto && (
                      <div>
                        <strong style={{ color: 'var(--sidebar-text)' }}>📦 Plan: </strong>
                        <span>{item.producto}</span>
                        {item.velocidad_mbps && (
                          <span style={{ marginLeft: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>
                            ⚡ {item.velocidad_mbps} Mbps
                          </span>
                        )}
                      </div>
                    )}
                    {(item.ip_cliente || item.ip_nodo || item.numero_serie) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: '0.78rem', color: 'var(--sidebar-text)', marginTop: '4px' }}>
                        {item.ip_cliente && <span>🌐 IP: <strong style={{ color: 'var(--text-main)' }}>{item.ip_cliente}</strong></span>}
                        {item.ip_nodo && <span>🏢 IP Nodo: <strong style={{ color: '#0284c7' }}>{item.ip_nodo}</strong></span>}
                        {item.numero_serie && <span>🏷️ SN: <strong style={{ color: '#d97706' }}>{item.numero_serie}</strong></span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: '14px', marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setShowMultiContratoModal(false)} 
                style={{ padding: '8px 18px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default AtencionesTab;
