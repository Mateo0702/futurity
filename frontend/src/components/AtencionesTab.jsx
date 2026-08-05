import React, { useState, useEffect, useRef } from 'react';

function AtencionesTab({ token, user }) {
  // Today's Local Date helper
  const getTodayLocal = () => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    const hoyLocal = new Date(hoy.getTime() - (offset * 60 * 1000));
    return hoyLocal.toISOString().split('T')[0];
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
  const [motivo, setMotivo] = useState('VALIDACIÓN DE SERVICIO');
  const [observacion, setObservacion] = useState('');

  // UI state
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [contratoOk, setContratoOk] = useState(false);
  const [sectores, setSectores] = useState([]);
  
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
  const [masivoMotivo, setMasivoMotivo] = useState('VALIDACIÓN DE SC');
  const [masivoObservacion, setMasivoObservacion] = useState('auditoría: se verifica cliente cortado');
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
      if (data.status === 'success') {
        setContratoOk(true);
        setCliente(data.cliente.cliente || '');
        setTelefono1(data.cliente.telefono1 || '');
        setTelefono2(data.cliente.telefono2 || '');
        setSector(data.cliente.sector || '');
        if (data.cliente.fecha_instalacion) {
          setFechaInstalacion(data.cliente.fecha_instalacion.substring(0, 10));
        }
        
        // Sincronizar y cargar el historial del cliente en la tarjeta derecha
        setContratoBusqueda(contrato.trim());
        fetchHistorialCliente(contrato.trim());
      }
    } catch (e) {
      console.error("Error de búsqueda de contrato:", e);
    } finally {
      setLoadingContrato(false);
    }
  };

  // Submit standard single attention registration
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
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
          observacion
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert("¡Atención registrada con éxito!");
        // Reset form
        setContrato('');
        setCliente('');
        setTelefono1('');
        setTelefono2('');
        setSector('');
        setFechaInstalacion('');
        setAccion('SOPORTE MEDIANTE MENSAJES');
        setObservacion('');
        setContratoOk(false);
        // Refresh bottom table
        fetchMisAtenciones(fechaBusqueda);
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
        fetchMisAtenciones(fechaBusqueda);
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

            {/* Fila 1: Contrato + Cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                  Contrato: <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={contrato}
                    onChange={(e) => setContrato(e.target.value)}
                    onBlur={handleContratoBlur}
                    placeholder="Ej: 47d"
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
                  <option value="MIGRACIÓN">MIGRACIÓN</option>
                  <option value="CONSULTA">CONSULTA</option>
                  <option value="ACUERDO DE PAGOS">ACUERDO DE PAGOS</option>
                  <option value="PAGO FACTURA">PAGO FACTURA</option>
                  <option value="RECONEXION">RECONEXION</option>
                  <option value="RECLAMO">RECLAMO</option>
                  <option value="RETENCIÓN">RETENCIÓN</option>
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
                  <option value="WHATSAPP">💬 WHATSAPP</option>
                  <option value="TELEFONO">📞 TELÉFONO</option>
                  <option value="OFICINA">🏢 OFICINA</option>
                  <option value="WHATSAPP + TELEFONO">💬📞 WHATSAPP + TELEFONO</option>
                  <option value="REDES SOCIALES">🌐 REDES SOCIALES</option>
                  <option value="CONTROL CALIDAD">🛡️ CONTROL CALIDAD</option>
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
                  <option value="SOPORTE MEDIANTE MENSAJES">SOPORTE MEDIANTE MENSAJES</option>
                  <option value="SOPORTE MEDIANTE LLAMADA">SOPORTE MEDIANTE LLAMADA</option>
                  <option value="LLAMADA SALIENTE">LLAMADA SALIENTE</option>
                  <option value="VISITA TECNICA">VISITA TÉCNICA</option>
                  <option value="CORTE INTERNO DE SERVICIO">CORTE INTERNO DE SERVICIO</option>
                  <option value="SE DA INFORMACION">SE DA INFORMACIÓN</option>
                </select>
              </div>
            </div>

            {/* Motivo & Observación */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Motivo de Consulta:</label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: VALIDACIÓN DE SERVICIO..."
                className="form-control"
                list="react-motivos-list"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                required
              />
              <datalist id="react-motivos-list">
                <option value="INFORMACIÓN / PAGOS"></option>
                <option value="Visita Revisión de Servicio"></option>
                <option value="Desconfiguración de Equipos"></option>
                <option value="Validación de Servicio"></option>
                <option value="Configuración de Equipos ONU / Router"></option>
              </datalist>
            </div>

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
                      <option value="WHATSAPP">WHATSAPP</option>
                      <option value="TELEFONO">TELÉFONO</option>
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
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Motivo / Solución:</label>
                  <input
                    type="text"
                    value={masivoMotivo}
                    onChange={(e) => setMasivoMotivo(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--sidebar-text)', marginBottom: '4px' }}>Observación / Acción común:</label>
                  <input
                    type="text"
                    value={masivoObservacion}
                    onChange={(e) => setMasivoObservacion(e.target.value)}
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
    </div>
  );
}

export default AtencionesTab;
