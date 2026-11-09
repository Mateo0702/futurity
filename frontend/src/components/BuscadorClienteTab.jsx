import React, { useState, useEffect, useRef } from 'react';
import ConsultaBaseCentralModal from './ConsultaBaseCentralModal';

function BuscadorClienteTab({ token, user }) {
  // Today's Local Date helper
  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Search states
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // KPIs states
  const [kpis, setKpis] = useState({ total: 0, activo: 0, cortado: 0, cancelado: 0 });
  const [loadingKpis, setLoadingKpis] = useState(false);

  // Historial unificado states (Atenciones + Visitas - Último Año)
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialFilter, setHistorialFilter] = useState('TODOS'); // 'TODOS' | 'ATENCION' | 'VISITA'

  // Deuda e info de Base Central para el cliente seleccionado
  const [clientDebtInfo, setClientDebtInfo] = useState({
    deudatotal: null,
    estado_central: null,
    loading: false
  });

  // SmartOLT Modal & Diagnostic states (Opción B: modal compacto)
  const [showOltModal, setShowOltModal] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [diagnosticError, setDiagnosticError] = useState('');

  // Technical Edit Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: '', text: '' });
  const [editForm, setEditForm] = useState({
    contrato: '',
    ip_cliente: '',
    ip_nodo: '',
    numero_serie: '',
    modelo_ont: '',
    router_principal: '',
    numero_serie_router: '',
    router_secundario: '',
    numero_serie_router_secundario: '',
    tipo_mesh: '',
    cantidad_routers: 1,
    modo_acceso: ''
  });

  // Central Database Modal state
  const [centralModal, setCentralModal] = useState({
    isOpen: false,
    initialCedula: '',
    initialContrato: ''
  });

  // Catalogs
  const [tecnicos, setTecnicos] = useState([]);
  const [problemas, setProblemas] = useState([]);
  const [sectores, setSectores] = useState([]);

  // Toast / Notification
  const [toast, setToast] = useState({ show: false, type: 'success', text: '' });
  const showToast = (text, type = 'success') => {
    setToast({ show: true, type, text });
    setTimeout(() => setToast({ show: false, type: 'success', text: '' }), 4000);
  };

  // Modal: Registrar Atención Rápida
  const [showAtencionModal, setShowAtencionModal] = useState(false);
  const [submittingAtencion, setSubmittingAtencion] = useState(false);
  const [atencionForm, setAtencionForm] = useState({
    tipo_atencion: 'SERVICIO TÉCNICO',
    tipoSolicitud: 'SOPORTE TÉCNICO',
    medio_contacto: 'WHATSAPP',
    accion: 'SOPORTE MEDIANTE MENSAJES',
    motivo: '',
    observacion: '',
    olt: '',
    telefono1: '',
    telefono2: ''
  });

  // Modal: Registrar Visita Rápida
  const [showVisitaModal, setShowVisitaModal] = useState(false);
  const [submittingVisita, setSubmittingVisita] = useState(false);
  const [visitaForm, setVisitaForm] = useState({
    fecha_programada: getTodayLocal(),
    preferencia_horaria: 'MAÑANA (09:00 - 13:00)',
    prioridad: 'MEDIA',
    tecnico_asignado: '',
    tecnico_apoyo: '',
    problema: 'SIN SERVICIO',
    observacion_callcenter: ''
  });

  // Modal: Carga Masiva de Atenciones
  const [showMasivoModal, setShowMasivoModal] = useState(false);
  const [masivoLoading, setMasivoLoading] = useState(false);
  const [masivoResult, setMasivoResult] = useState(null);
  const [masivoForm, setMasivoForm] = useState({
    contratos: '',
    fecha: getTodayLocal(),
    tipo_atencion: 'SERVICIO TÉCNICO',
    tipo_solicitud: 'SOPORTE TÉCNICO',
    medio_contacto: 'WHATSAPP',
    accion: 'SOPORTE MEDIANTE MENSAJES',
    motivo: 'NOTIFICACIÓN MASIVA',
    observacion: ''
  });

  // Modal: Mis Atenciones de Hoy
  const [showMisAtencionesModal, setShowMisAtencionesModal] = useState(false);
  const [misAtenciones, setMisAtenciones] = useState([]);
  const [misAtencionesFecha, setMisAtencionesFecha] = useState(getTodayLocal());
  const [misAtencionesLoading, setMisAtencionesLoading] = useState(false);

  const searchTimeoutRef = useRef(null);

  // Initial load: KPIs y Catálogos
  useEffect(() => {
    fetchKpis();
    fetchCatalogs();
  }, []);

  const fetchKpis = async () => {
    setLoadingKpis(true);
    try {
      const res = await fetch('/api/cliente/kpis_estado', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.kpis) {
        setKpis(data.kpis);
      }
    } catch (e) {
      console.error("Error al cargar KPIs:", e);
    } finally {
      setLoadingKpis(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const [secRes, tecRes, probRes] = await Promise.all([
        fetch('/api/v2/sectores', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v2/tecnicos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v2/problemas', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const secData = await secRes.json();
      const tecData = await tecRes.json();
      const probData = await probRes.json();

      if (secData.status === 'success') setSectores(secData.sectores || []);
      if (tecData.status === 'success') setTecnicos(tecData.tecnicos || []);
      if (probData.status === 'success') setProblemas(probData.problemas || []);
    } catch (e) {
      console.error("Error al cargar catálogos:", e);
    }
  };

  // Historial unificado (Último Año) para el cliente seleccionado
  const fetchHistorialUnificado = async (contratoNum, clienteNom) => {
    if (!contratoNum && !clienteNom) return;
    setLoadingHistorial(true);
    try {
      const url = `/api/cliente/historial_unificado?contrato=${encodeURIComponent(contratoNum || '')}&cliente=${encodeURIComponent(clienteNom || '')}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setHistorial(data.historial || []);
      } else {
        setHistorial([]);
      }
    } catch (e) {
      console.error("Error al cargar historial unificado:", e);
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Consultar Deuda y Estado en Base Central silenciosamente al seleccionar cliente
  const fetchDeudaBaseCentral = async (client) => {
    if (!client) return;
    const cedula = (client.cedula || '').trim();
    const contrato = (client.contrato || '').trim();

    if (!cedula && !contrato) return;

    setClientDebtInfo({ deudatotal: null, estado_central: null, loading: true });
    try {
      const url = `/api/cliente/consultar_base_central?cedula=${encodeURIComponent(cedula || contrato)}&contrato=${encodeURIComponent(contrato)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.contratos && data.contratos.length > 0) {
        // Buscar el contrato que coincide
        const targetContrato = contrato.replace(/F$/i, '').toUpperCase();
        const matched = data.contratos.find(c => {
          const cClean = String(c.contrato || '').replace(/F$/i, '').toUpperCase();
          return cClean === targetContrato;
        }) || data.contratos[0];

        setClientDebtInfo({
          deudatotal: typeof matched.deudatotal === 'number' ? matched.deudatotal : 0.0,
          estado_central: matched.estado || 'ACTIVO',
          loading: false
        });
      } else {
        setClientDebtInfo({
          deudatotal: 0.0,
          estado_central: client.estado || 'ACTIVO',
          loading: false
        });
      }
    } catch (err) {
      console.warn("No se pudo obtener deuda central en tiempo real:", err);
      setClientDebtInfo({
        deudatotal: null,
        estado_central: client.estado || 'ACTIVO',
        loading: false
      });
    }
  };

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
    // Reset OLT Diagnostic state
    setDiagnosticResult(null);
    setDiagnosticError('');
    setIsMeasuring(false);

    // Cargar Historial unificado del último año
    fetchHistorialUnificado(client.contrato, client.cliente);

    // Cargar Deuda y estado en Base Central
    fetchDeudaBaseCentral(client);
  };

  // SmartOLT Diagnostic
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

  // Technical Edit Modal
  const handleOpenEditModal = (client) => {
    if (!client) return;
    setEditForm({
      contrato: client.contrato || '',
      ip_cliente: client.ip_cliente || '',
      ip_nodo: client.ip_nodo || '',
      numero_serie: client.numero_serie === 'S/N' ? '' : (client.numero_serie || ''),
      modelo_ont: client.modelo_ont || '',
      router_principal: client.router_principal || '',
      numero_serie_router: client.numero_serie_router || '',
      router_secundario: client.router_secundario || '',
      numero_serie_router_secundario: client.numero_serie_router_secundario || '',
      tipo_mesh: client.tipo_mesh || '',
      cantidad_routers: client.cantidad_routers || 1,
      modo_acceso: client.modo_acceso || ''
    });
    setEditMessage({ type: '', text: '' });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSavingEdit(true);
    setEditMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/cliente/actualizar_datos_tecnicos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setEditMessage({ type: 'success', text: data.message || 'Datos actualizados con éxito.' });
        if (selectedClient && data.cliente_actualizado) {
          setSelectedClient(prev => ({
            ...prev,
            ...data.cliente_actualizado,
            numero_serie: data.cliente_actualizado.numero_serie || 'S/N'
          }));
        }
        setTimeout(() => {
          setShowEditModal(false);
        }, 1200);
      } else {
        setEditMessage({ type: 'error', text: data.message || 'Error al guardar los cambios.' });
      }
    } catch (err) {
      console.error("Error al actualizar datos técnicos:", err);
      setEditMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Submit Registrar Atención Rápida
  const handleSubmitAtencion = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!atencionForm.observacion.trim()) {
      alert("Por favor ingrese una observación o comentario de la atención.");
      return;
    }

    setSubmittingAtencion(true);
    try {
      const tel1 = (atencionForm.telefono1 || '').trim() || ((selectedClient.telefonos && selectedClient.telefonos !== 'No registrado') ? selectedClient.telefonos.split('/')[0].trim() : null);
      const tel2 = (atencionForm.telefono2 || '').trim() || ((selectedClient.telefonos && selectedClient.telefonos.includes('/')) ? selectedClient.telefonos.split('/')[1].trim() : null);
      const oltVal = (atencionForm.olt || '').trim() || null;

      const payload = {
        contrato: selectedClient.contrato,
        cliente: selectedClient.cliente,
        fecha: getTodayLocal(),
        hora: new Date().toTimeString().split(' ')[0],
        fecha_instalacion: selectedClient.fecha_instalacion && selectedClient.fecha_instalacion !== 'N/D' ? selectedClient.fecha_instalacion : null,
        sector: selectedClient.sector && selectedClient.sector !== 'N/D' ? selectedClient.sector : null,
        tipo_atencion: atencionForm.tipo_atencion,
        tipo_solicitud: atencionForm.tipoSolicitud,
        medio_contacto: atencionForm.medio_contacto,
        telefono1: tel1,
        telefono2: tel2,
        accion: atencionForm.accion,
        motivo: atencionForm.motivo,
        observacion: atencionForm.observacion.trim(),
        olt: oltVal
      };

      const res = await fetch('/api/admin/atenciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        showToast("¡Atención registrada exitosamente!");
        setShowAtencionModal(false);
        setAtencionForm(prev => ({ ...prev, observacion: '' }));
        // Recargar historial
        fetchHistorialUnificado(selectedClient.contrato, selectedClient.cliente);
      } else {
        alert(data.message || "Error al registrar la atención.");
      }
    } catch (err) {
      console.error("Error al registrar atención:", err);
      alert("Error de conexión al guardar la atención.");
    } finally {
      setSubmittingAtencion(false);
    }
  };

  // Submit Registrar Visita Rápida
  const handleSubmitVisita = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    if (!visitaForm.tecnico_asignado) {
      alert("Por favor seleccione un técnico asignado para la visita.");
      return;
    }

    setSubmittingVisita(true);
    try {
      const payload = {
        fecha_programada: visitaForm.fecha_programada,
        preferencia_horaria: visitaForm.preferencia_horaria,
        prioridad: visitaForm.prioridad,
        tecnico_asignado: visitaForm.tecnico_asignado,
        tecnico_apoyo: visitaForm.tecnico_apoyo || null,
        empresa: selectedClient.empresa || 'SERVICABLE',
        contrato: selectedClient.contrato,
        cliente: selectedClient.cliente,
        telefonos: selectedClient.telefonos || '',
        sector: selectedClient.sector || '',
        direccion: selectedClient.direccion || '',
        latitud: '',
        longitud: '',
        servicio: 'SERVICIO TÉCNICO',
        es_instalacion: 0,
        velocidad_mbps: selectedClient.velocidad_mbps || null,
        problema: visitaForm.problema,
        observacion_callcenter: visitaForm.observacion_callcenter.trim()
      };

      const res = await fetch('/api/v2/visitas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        showToast("¡Visita técnica agendada exitosamente!");
        setShowVisitaModal(false);
        setVisitaForm(prev => ({ ...prev, observacion_callcenter: '' }));
        // Recargar historial
        fetchHistorialUnificado(selectedClient.contrato, selectedClient.cliente);
      } else {
        alert(data.message || "Error al agendar la visita técnica.");
      }
    } catch (err) {
      console.error("Error al agendar visita:", err);
      alert("Error de conexión al programar la visita.");
    } finally {
      setSubmittingVisita(false);
    }
  };

  // Submit Carga Masiva
  const handleMasivoSubmit = async (e) => {
    e.preventDefault();
    if (!masivoForm.contratos.trim()) {
      alert("Por favor ingrese al menos un contrato.");
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
        body: JSON.stringify(masivoForm)
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setMasivoResult(data);
        showToast(`¡Carga masiva completada: ${data.total_registrados} contratos procesados!`);
        if (selectedClient) {
          fetchHistorialUnificado(selectedClient.contrato, selectedClient.cliente);
        }
      } else {
        alert(data.message || "Error al procesar la carga masiva.");
      }
    } catch (err) {
      console.error("Error en carga masiva:", err);
      alert("Error de red al procesar el lote.");
    } finally {
      setMasivoLoading(false);
    }
  };

  // Fetch Mis Atenciones de Hoy
  const fetchMisAtenciones = async (targetDate) => {
    setMisAtencionesLoading(true);
    try {
      const url = `/api/admin/atenciones/recientes?fecha=${encodeURIComponent(targetDate)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
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
      setMisAtencionesLoading(false);
    }
  };

  // Filtered Historial
  const filteredHistorial = historial.filter(item => {
    if (historialFilter === 'TODOS') return true;
    return item.tipo_registro === historialFilter;
  });

  const countAtenciones = historial.filter(h => h.tipo_registro === 'ATENCION').length;
  const countVisitas = historial.filter(h => h.tipo_registro === 'VISITA').length;

  return (
    <div id="tab-buscar-cliente" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>

      {/* Floating Toast Feedback */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '25px',
          right: '25px',
          background: toast.type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#ef4444',
          color: 'white',
          padding: '14px 24px',
          borderRadius: '14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          zIndex: 999999,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} style={{ fontSize: '1.2rem' }}></i>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Hero Header con Botones de Acción Superior */}
      <div style={{ background: 'var(--card-bg)', padding: '22px 28px', borderRadius: '20px', marginBottom: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
            <i className="fa-solid fa-users-gear"></i>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.7rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Buscador y Centro de Atención de Clientes
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.88rem', fontWeight: 500 }}>
              Ficha integral 360°, historial de tickets/visitas, registro directo y sincronización central.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas del Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setMasivoForm(prev => ({ ...prev, fecha: getTodayLocal() }));
              setMasivoResult(null);
              setShowMasivoModal(true);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}
            title="Registrar atenciones masivas por lote de contratos"
          >
            <i className="fa-solid fa-layer-group"></i>
            <span>Carga Masiva</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchMisAtenciones(misAtencionesFecha);
              setShowMisAtencionesModal(true);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-sm)'
            }}
            title="Ver mis atenciones registradas hoy"
          >
            <i className="fa-solid fa-clipboard-list" style={{ color: '#0284c7' }}></i>
            <span>Mis Atenciones de Hoy</span>
          </button>

          <button
            type="button"
            onClick={() => setCentralModal({ isOpen: true, initialCedula: '', initialContrato: '' })}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
            }}
            title="Buscar cliente directamente en el sistema central por Cédula"
          >
            <i className="fa-solid fa-cloud-arrow-down"></i>
            <span>Consultar Base Central</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Estado de Clientes (Directorio General) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        {/* KPI Total */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Clientes</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {loadingKpis ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.1rem' }}></i> : kpis.total.toLocaleString()}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            <i className="fa-solid fa-users"></i>
          </div>
        </div>

        {/* KPI Activos */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clientes Activos</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
              {loadingKpis ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.1rem' }}></i> : kpis.activo.toLocaleString()}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            <i className="fa-solid fa-user-check"></i>
          </div>
        </div>

        {/* KPI Cortados */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cortados / Suspendidos</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
              {loadingKpis ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.1rem' }}></i> : kpis.cortado.toLocaleString()}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            <i className="fa-solid fa-user-slash"></i>
          </div>
        </div>

        {/* KPI Cancelados */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cancelados / Retirados</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444', marginTop: '2px' }}>
              {loadingKpis ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.1rem' }}></i> : kpis.cancelado.toLocaleString()}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            <i className="fa-solid fa-user-xmark"></i>
          </div>
        </div>
      </div>

      {/* Buscador Principal Interactivo */}
      <div style={{ background: 'var(--card-bg)', padding: '22px', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: '22px', position: 'relative' }}>
        <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.92rem', display: 'block', marginBottom: '8px' }}>
          🔍 Buscar Cliente por Contrato, Nombre, Teléfono o Identificación:
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-control"
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Escribe para buscar... Ej: 290, Marlene, 099232, 0102758..."
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
          <div style={{ position: 'absolute', left: '22px', right: '22px', top: '100%', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 999, maxHeight: '280px', overflowY: 'auto', marginTop: '8px' }}>
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: (cli.estado || '').includes('CORT') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: (cli.estado || '').includes('CORT') ? '#ef4444' : '#10b981'
                    }}>
                      {cli.estado || 'ACTIVO'}
                    </span>
                    <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 800, fontSize: '0.78rem', padding: '4px 10px', borderRadius: '8px' }}>
                      Contrato: {cli.contrato}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sidebar-text)', fontSize: '0.9rem' }}>
                <div style={{ marginBottom: '10px', fontWeight: 600 }}>No se encontraron coincidencias en la base local.</div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    const cleanQ = query.trim();
                    const isContrato = /^\d{1,6}[Ff]?$/i.test(cleanQ);
                    const isCed = !isContrato && cleanQ.length >= 4;
                    setCentralModal({
                      isOpen: true,
                      initialCedula: isCed ? cleanQ : '',
                      initialContrato: isCed ? '' : cleanQ
                    });
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-down"></i>
                  <span>Consultar "{query}" en Base Central</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenedor Principal: Ficha Comercial (Izquierda) + Historial Unificado (Derecha) */}
      {selectedClient ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1.15fr) minmax(460px, 1.25fr)', gap: '22px', marginBottom: '30px', alignItems: 'stretch' }}>

          {/* COLUMNA IZQUIERDA: FICHA COMERCIAL Y TÉCNICA */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Header Ficha */}
              <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 800, fontSize: '0.85rem', padding: '4px 12px', borderRadius: '8px' }}>
                      CONTRATO: {selectedClient.contrato}
                    </span>
                    {selectedClient.empresa && (
                      <span style={{ background: selectedClient.empresa === 'FIBRACOM' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: selectedClient.empresa === 'FIBRACOM' ? '#a855f7' : '#2563eb', fontWeight: 800, fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px' }}>
                        {selectedClient.empresa}
                      </span>
                    )}
                    {/* Badge Estado Cliente */}
                    {(() => {
                      const st = (clientDebtInfo.estado_central || selectedClient.estado || 'ACTIVO').toUpperCase();
                      const isCortado = st.includes('CORT') || st.includes('SUSP') || st.includes('MOR');
                      const isCancelado = st.includes('CANC') || st.includes('RETIR') || st.includes('INACT');
                      let bg = 'rgba(16, 185, 129, 0.15)';
                      let col = '#059669';
                      let icon = 'fa-circle-check';

                      if (isCortado) {
                        bg = 'rgba(245, 158, 11, 0.15)';
                        col = '#d97706';
                        icon = 'fa-circle-exclamation';
                      } else if (isCancelado) {
                        bg = 'rgba(239, 68, 68, 0.15)';
                        col = '#ef4444';
                        icon = 'fa-circle-xmark';
                      }

                      return (
                        <span style={{ background: bg, color: col, fontWeight: 900, fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <i className={`fa-solid ${icon}`}></i> {st}
                        </span>
                      );
                    })()}
                  </div>

                  {selectedClient.cedula && (
                    <span style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.82rem', padding: '5px 12px', borderRadius: '10px' }}>
                      🪪 {selectedClient.cedula}
                    </span>
                  )}
                </div>

                <h3 style={{ margin: '0 0 14px 0', color: 'var(--text-main)', fontSize: '1.35rem', fontWeight: 850, letterSpacing: '-0.01em' }}>
                  {selectedClient.cliente}
                </h3>

                {/* Botones de acción del cliente */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* BOTÓN MEDIR SEÑAL ÓPTICA (OPCIÓN B) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOltModal(true);
                      if (!diagnosticResult && !isMeasuring) {
                        handleRunDiagnostic();
                      }
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                    }}
                    title="Abrir diagnóstico óptico en vivo en la OLT"
                  >
                    <i className="fa-solid fa-bolt"></i>
                    <span>⚡ Medir Señal Óptica</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedClient)}
                    style={{
                      background: 'var(--profile-bg)',
                      border: '1px solid var(--border-color)',
                      color: '#0284c7',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Modificar IP, Equipos, SN o Nodo de este cliente"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                    <span>Editar Datos Técnicos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCentralModal({
                        isOpen: true,
                        initialCedula: selectedClient.cedula || '',
                        initialContrato: selectedClient.contrato || ''
                      });
                    }}
                    style={{
                      background: 'var(--profile-bg)',
                      border: '1px solid var(--border-color)',
                      color: '#059669',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Consultar y actualizar con la Base Central en tiempo real"
                  >
                    <i className="fa-solid fa-cloud-arrow-down"></i>
                    <span>Sincronizar Central</span>
                  </button>
                </div>
              </div>

              {/* Grid de Datos del Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>💵 Pago Mensual</strong>
                  <span style={{ color: '#059669', fontSize: '1.2rem', fontWeight: 900 }}>
                    {selectedClient.total_mensual ? `$${parseFloat(selectedClient.total_mensual).toFixed(2)}` : 'N/D'}
                  </span>
                </div>

                {/* Deuda / Saldo Pendiente de Base Central */}
                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>⚠️ Saldo / Deuda Pendiente</strong>
                  {clientDebtInfo.loading ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                      <i className="fa-solid fa-spinner fa-spin"></i> Consultando...
                    </span>
                  ) : clientDebtInfo.deudatotal !== null && clientDebtInfo.deudatotal > 0 ? (
                    <span style={{ color: '#ef4444', fontSize: '1.2rem', fontWeight: 900, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '8px' }}>
                      ${clientDebtInfo.deudatotal.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ color: '#059669', fontSize: '1.05rem', fontWeight: 800 }}>
                      ✅ Al día ($0.00)
                    </span>
                  )}
                </div>

                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>⚡ Velocidad Plan</strong>
                  <span style={{ color: '#0284c7', fontSize: '1.1rem', fontWeight: 800 }}>
                    {selectedClient.velocidad_mbps ? `${selectedClient.velocidad_mbps} Mbps` : 'N/D'}
                  </span>
                </div>

                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>⏳ Antigüedad</strong>
                  <span style={{ color: '#0284c7', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.antiguedad_fmt || 'N/D'}
                  </span>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>📦 Paquete Contratado</strong>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.producto || 'N/D'}
                  </span>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>🌐 IP Cliente</strong>
                    <button 
                      type="button" 
                      onClick={() => handleOpenEditModal(selectedClient)}
                      style={{ background: 'transparent', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, padding: 0 }}
                      title="Editar IP"
                    >
                      ✏️
                    </button>
                  </div>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 800 }}>
                    {selectedClient.ip_cliente || 'N/D'}
                  </span>
                </div>

                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>🏢 IP Nodo / OLT</strong>
                  <span style={{ color: '#0284c7', fontSize: '0.92rem', fontWeight: 700 }}>
                    {selectedClient.ip_nodo ? `${selectedClient.ip_nodo}${selectedClient.nodo_nombre && selectedClient.nodo_nombre !== selectedClient.ip_nodo ? ` (${selectedClient.nodo_nombre})` : ''}` : (selectedClient.nodo_nombre || 'N/D')}
                  </span>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>🏷️ Serie ONU (SN)</strong>
                  <span style={{ color: '#d97706', fontSize: '0.95rem', fontWeight: 700, wordBreak: 'break-all' }}>
                    {selectedClient.numero_serie || 'S/N'}
                  </span>
                </div>

                {/* Bloque de Equipos e Inventario */}
                {(selectedClient.modelo_ont || selectedClient.router_principal || selectedClient.router_secundario) && (
                  <div style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-server"></i> Equipos Instalados
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {(() => {
                          const txt = `${selectedClient.modelo_ont || ''} ${selectedClient.router_principal || ''} ${selectedClient.router_secundario || ''}`.toUpperCase();
                          const esHomologado = ['511', '530', '231', 'AX3', 'AX3S', 'AX2S'].some(k => txt.includes(k));
                          if (esHomologado) {
                            return (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                🟢 Wi-Fi 6 Homologado
                              </span>
                            );
                          } else {
                            return (
                              <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                ⚠️ Plan Renove: Cambiar a EX511
                              </span>
                            );
                          }
                        })()}
                        <span style={{ background: selectedClient.cantidad_routers > 1 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(99, 102, 241, 0.15)', color: selectedClient.cantidad_routers > 1 ? '#c4b5fd' : '#a5b4fc', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                          {selectedClient.cantidad_routers > 1 ? `🔁 2 Routers` : `📶 1 Router`}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '6px 8px', borderRadius: '8px' }}>
                        <strong style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>🟢 ONT:</strong>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.84rem', fontWeight: 700 }}>{selectedClient.modelo_ont || 'N/D'}</span>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '6px 8px', borderRadius: '8px' }}>
                        <strong style={{ color: '#6366f1', fontSize: '0.7rem', fontWeight: 800, display: 'block', textTransform: 'uppercase' }}>📶 Router:</strong>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.84rem', fontWeight: 700 }}>{selectedClient.router_principal || 'N/D'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>💳 Forma de Pago</strong>
                  <span style={{ color: '#6366f1', fontSize: '0.9rem', fontWeight: 700 }}>
                    {selectedClient.forma_pago || 'N/D'}
                  </span>
                </div>

                <div>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>👤 Vendedor</strong>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}>
                    {selectedClient.vendedor || 'N/D'}
                  </span>
                </div>

                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '2px' }}>
                  <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>📍 Dirección y Sector</strong>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.35, display: 'block' }}>
                    {selectedClient.direccion}
                  </span>
                  <span style={{ color: 'var(--sidebar-text)', fontSize: '0.8rem', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                    Sector: {selectedClient.sector}
                  </span>
                </div>
              </div>
            </div>

            {/* Teléfonos de contacto con botón de llamada */}
            <div style={{ marginTop: '20px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem', fontWeight: 800, display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Teléfonos de Contacto</strong>
                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700 }}>
                  {selectedClient.telefonos}
                </span>
              </div>
              {selectedClient.telefonos && selectedClient.telefonos !== 'No registrado' && (
                <a
                  href={`tel:${selectedClient.telefonos.split('/')[0].split(',')[0].trim()}`}
                  style={{ background: '#059669', color: 'white', padding: '8px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)' }}
                >
                  <i className="fa-solid fa-phone"></i> Llamar
                </a>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: HISTORIAL DE ATENCIONES Y VISITAS (ÚLTIMO AÑO) */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Header Historial */}
              <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-clock-rotate-left" style={{ color: '#0284c7' }}></i>
                    Historial de Atenciones y Visitas
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Línea de tiempo de los últimos 12 meses ({historial.length} registros)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => fetchHistorialUnificado(selectedClient.contrato, selectedClient.cliente)}
                  disabled={loadingHistorial}
                  style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--sidebar-text)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                  title="Refrescar historial"
                >
                  <i className={`fa-solid fa-rotate-right ${loadingHistorial ? 'fa-spin' : ''}`}></i>
                </button>
              </div>

              {/* Filtros Tipo Pill: Todos / Atenciones / Visitas */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('TODOS')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: historialFilter === 'TODOS' ? '#0284c7' : 'var(--profile-bg)',
                    color: historialFilter === 'TODOS' ? 'white' : 'var(--sidebar-text)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Todos ({historial.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('ATENCION')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: historialFilter === 'ATENCION' ? '#6366f1' : 'var(--profile-bg)',
                    color: historialFilter === 'ATENCION' ? 'white' : 'var(--sidebar-text)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-headset"></i> Atenciones ({countAtenciones})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('VISITA')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: historialFilter === 'VISITA' ? '#059669' : 'var(--profile-bg)',
                    color: historialFilter === 'VISITA' ? 'white' : 'var(--sidebar-text)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-truck"></i> Visitas ({countVisitas})
                </button>
              </div>

              {/* Lista Scrollable de la Línea de Tiempo */}
              <div style={{ maxHeight: '430px', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loadingHistorial ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sidebar-text)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.8rem', color: '#0284c7', marginBottom: '10px' }}></i>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>Cargando atenciones y visitas del último año...</p>
                  </div>
                ) : filteredHistorial.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--sidebar-text)', border: '1.5px dashed var(--border-color)', borderRadius: '16px' }}>
                    <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '2.5rem', opacity: 0.35, marginBottom: '12px', display: 'block' }}></i>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block' }}>Sin registros en el último año</strong>
                    <span style={{ fontSize: '0.82rem' }}>No existen reportes ni visitas técnicas registradas para este cliente en los últimos 12 meses.</span>
                  </div>
                ) : (
                  filteredHistorial.map((item, idx) => {
                    const isAtencion = item.tipo_registro === 'ATENCION';
                    const isVisita = item.tipo_registro === 'VISITA';
                    const estado = (item.estado || '').toUpperCase();
                    const isFinalizada = estado === 'FINALIZADA' || estado === 'SOLVENTADA_REMOTA';

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          background: 'var(--profile-bg)',
                          border: '1px solid var(--border-color)',
                          borderLeft: `4px solid ${isAtencion ? '#6366f1' : (isFinalizada ? '#10b981' : '#f59e0b')}`,
                          borderRadius: '14px',
                          padding: '14px',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isAtencion ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: isAtencion ? '#4f46e5' : '#059669',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <i className={`fa-solid ${isAtencion ? 'fa-headset' : 'fa-truck-fast'}`}></i>
                              {isAtencion ? 'ATENCIÓN' : 'VISITA TÉCNICA'}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>
                              📅 {item.fecha} {item.hora ? `• ⏰ ${item.hora}` : ''}
                            </span>
                          </div>

                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isFinalizada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: isFinalizada ? '#059669' : '#d97706'
                          }}>
                            {item.estado}
                          </span>
                        </div>

                        {/* Título / Motivo */}
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '3px' }}>
                          {item.titulo}
                        </div>

                        {/* Subtítulo: Técnico o Medio */}
                        {item.subtitulo && (
                          <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 700, marginBottom: '6px' }}>
                            {item.subtitulo}
                          </div>
                        )}

                        {/* Detalle / Observación */}
                        {item.detalle && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.35, background: 'var(--card-bg)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                            {item.detalle}
                          </div>
                        )}

                        {/* Footer del ítem */}
                        <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--sidebar-text)', textAlign: 'right', fontWeight: 600 }}>
                          Registrado por: <strong>{item.responsable}</strong>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* BOTONES DE ACCIÓN RÁPIDA: REGISTRAR ATENCIÓN Y REGISTRAR VISITA */}
            <div style={{ marginTop: '20px', borderTop: '2px solid var(--border-color)', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  const t1 = (selectedClient.telefonos && selectedClient.telefonos !== 'No registrado') ? selectedClient.telefonos.split('/')[0].trim() : '';
                  const t2 = (selectedClient.telefonos && selectedClient.telefonos.includes('/')) ? selectedClient.telefonos.split('/')[1].trim() : '';
                  setAtencionForm({
                    tipo_atencion: 'SERVICIO TÉCNICO',
                    tipoSolicitud: 'SOPORTE TÉCNICO',
                    medio_contacto: 'WHATSAPP',
                    accion: 'SOPORTE MEDIANTE MENSAJES',
                    motivo: '',
                    observacion: '',
                    olt: selectedClient.ip_nodo ? (selectedClient.ip_nodo.includes('1.18') ? '1.18' : selectedClient.ip_nodo.includes('1.50') ? '1.50' : '') : '',
                    telefono1: t1,
                    telefono2: t2
                  });
                  setShowAtencionModal(true);
                }}
                style={{
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)'
                }}
              >
                <i className="fa-solid fa-headset"></i>
                <span>Registrar Atención</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVisitaForm({
                    fecha_programada: getTodayLocal(),
                    preferencia_horaria: 'MAÑANA (09:00 - 13:00)',
                    prioridad: 'MEDIA',
                    tecnico_asignado: tecnicos.length > 0 ? tecnicos[0].nombre : '',
                    tecnico_apoyo: '',
                    problema: problemas.length > 0 ? problemas[0].nombre_problema : 'SIN SERVICIO',
                    observacion_callcenter: ''
                  });
                  setShowVisitaModal(true);
                }}
                style={{
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
                }}
              >
                <i className="fa-solid fa-calendar-plus"></i>
                <span>Registrar Visita</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Estado Vacío General */
        <div style={{ background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '60px 20px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '4rem', color: 'var(--border-color)', marginBottom: '20px', display: 'block' }}></i>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: 800 }}>Escribe un cliente o contrato para iniciar</h3>
          <p style={{ margin: '8px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.95rem', fontWeight: 500 }}>
            Ingresa el número de contrato, nombre, teléfono o identificación en el buscador superior para desplegar su ficha y su historial.
          </p>
        </div>
      )}

      {/* MODAL COMPACTO: DIAGNÓSTICO SMARTOLT (OPCIÓN B) */}
      {showOltModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '580px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header Modal */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem' }}>
                  <i className="fa-solid fa-bolt"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Diagnóstico Óptico OLT en Vivo
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Contrato #{selectedClient?.contrato} — SN: {selectedClient?.numero_serie}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOltModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Body Modal */}
            <div style={{ padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={isMeasuring}
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', border: 'none', padding: '12px 26px', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px', cursor: isMeasuring ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: isMeasuring ? 0.7 : 1 }}
                >
                  {isMeasuring ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                  {isMeasuring ? 'Midiendo Señal...' : 'Medir Señal Óptica'}
                </button>
              </div>

              {/* Mensajes de error */}
              {diagnosticError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '12px', padding: '14px', marginBottom: '16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 700 }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i>
                  {diagnosticError}
                </div>
              )}

              {/* Loader */}
              {isMeasuring && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: '#0284c7', fontSize: '2.2rem', marginBottom: '12px' }}></i>
                  <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.9rem' }}>Consultando potencia de fibra en la OLT...</p>
                </div>
              )}

              {/* Resultados */}
              {diagnosticResult && !isMeasuring && (
                <div>
                  <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <span style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem', fontWeight: 800, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Estado</span>
                      <span style={{ display: 'inline-flex', fontSize: '0.78rem', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, color: 'white', background: diagnosticResult.estado.toLowerCase() === 'online' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                        {diagnosticResult.estado.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1.5px solid var(--border-color)', paddingLeft: '8px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem', fontWeight: 800, display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Enganche (Rx)</span>
                      <strong style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>
                        {diagnosticResult.potencia_rx}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1.5px solid var(--border-color)', paddingLeft: '8px' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontSize: '0.7rem', fontWeight: 800, display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>Retorno (Tx)</span>
                      <strong style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--sidebar-text)' }}>
                        {diagnosticResult.potencia_tx}
                      </strong>
                    </div>
                  </div>

                  {/* Barras Rx */}
                  {(() => {
                    const rxProps = getSignalBarProps(diagnosticResult.potencia_rx, true);
                    return (
                      <div style={{ marginBottom: '14px', background: 'var(--profile-bg)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                          📶 Nivel de Enganche (Rx / Bajada)
                        </strong>
                        <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border-color)' }}>
                          <div style={{ height: '100%', width: rxProps.width, backgroundColor: rxProps.color, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginTop: '4px', color: rxProps.color }}>
                          {rxProps.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Barras Tx */}
                  {(() => {
                    const txProps = getSignalBarProps(diagnosticResult.potencia_tx, false);
                    return (
                      <div style={{ marginBottom: '16px', background: 'var(--profile-bg)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                          🔄 Nivel de Retorno (Tx / Subida)
                        </strong>
                        <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border-color)' }}>
                          <div style={{ height: '100%', width: txProps.width, backgroundColor: txProps.color, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginTop: '4px', color: txProps.color }}>
                          {txProps.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Grid Técnico */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', fontSize: '0.82rem', background: 'var(--profile-bg)', borderRadius: '14px', padding: '14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>IP WAN:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.ip_wan}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Distancia:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.distancia}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>OLT:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.olt_name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Uptime:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.uptime}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Modelo ONU:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.modelo}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>VLAN:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{diagnosticResult.vlan}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowOltModal(false)}
                style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ATENCIÓN NORMAL / COMPLETA */}
      {showAtencionModal && selectedClient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                  <i className="fa-solid fa-headset"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Ingreso de Atención Diaria
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Contrato #{selectedClient.contrato} — {selectedClient.cliente}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAtencionModal(false)}
                style={{ background: 'var(--profile-bg)', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitAtencion} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* FILA 1: Tipo de Atención, Tipo de Solicitud y Medio de Contacto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Tipo de Atención: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={atencionForm.tipo_atencion}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, tipo_atencion: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                    required
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Tipo de Solicitud: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={atencionForm.tipoSolicitud}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, tipoSolicitud: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                    required
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Medio de Contacto: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={atencionForm.medio_contacto}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, medio_contacto: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                    required
                  >
                    <option value="WHATSAPP">WHATSAPP</option>
                    <option value="TELEFONO">TELÉFONO</option>
                    <option value="OFICINA">OFICINA</option>
                    <option value="WHATSAPP + TELEFONO">WHATSAPP + TELEFONO</option>
                    <option value="REDES SOCIALES">REDES SOCIALES</option>
                    <option value="CHAT INTERNO">CHAT INTERNO</option>
                    <option value="CONTROL CALIDAD">CONTROL CALIDAD</option>
                    <option value="WHATSAPP TECNICOS">WHATSAPP TECNICOS</option>
                  </select>
                </div>
              </div>

              {/* FILA 2: Acción Realizada y Nodo / OLT */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Acción Realizada: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={atencionForm.accion}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, accion: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                    required
                  >
                    <option value="SOPORTE MEDIANTE MENSAJES">SOPORTE MEDIANTE MENSAJES</option>
                    <option value="SOPORTE MEDIANTE LLAMADA">SOPORTE MEDIANTE LLAMADA</option>
                    <option value="LLAMADA SALIENTE">LLAMADA SALIENTE</option>
                    <option value="VISITA TECNICA">VISITA TECNICA</option>
                    <option value="VISITA TECNICA COBRADA">VISITA TECNICA COBRADA</option>
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Nodo / OLT:
                  </label>
                  <select
                    value={atencionForm.olt}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, olt: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
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

              {/* ALERTA DINÁMICA SI ES VISITA TÉCNICA */}
              {(atencionForm.accion === 'VISITA TECNICA' || atencionForm.accion === 'VISITA TECNICA COBRADA') && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div>
                    <strong style={{ color: '#4f46e5', display: 'block', fontSize: '0.88rem' }}>
                      <i className="fa-solid fa-circle-exclamation"></i> Visita Técnica Requerida
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)' }}>
                      Esta atención está catalogada como Visita. Puedes agendarla de inmediato.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAtencionModal(false);
                      setShowVisitaModal(true);
                    }}
                    style={{
                      background: '#6366f1',
                      color: 'white',
                      fontSize: '0.8rem',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-calendar-plus"></i> Agendar Visita
                  </button>
                </div>
              )}

              {/* FILA 3: Teléfonos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Teléfono Principal:
                  </label>
                  <input
                    type="text"
                    value={atencionForm.telefono1}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, telefono1: e.target.value }))}
                    placeholder="Ej. 0992321716"
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Teléfono Secundario:
                  </label>
                  <input
                    type="text"
                    value={atencionForm.telefono2}
                    onChange={(e) => setAtencionForm(prev => ({ ...prev, telefono2: e.target.value }))}
                    placeholder="Opcional"
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* FILA 4: Motivo de Consulta con DataList Completo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                  Motivo de Consulta: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={atencionForm.motivo}
                  onChange={(e) => setAtencionForm(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Escribe para buscar o ingresar motivo..."
                  className="form-control"
                  list="atencion-motivos-list"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
                  required
                />
                <datalist id="atencion-motivos-list">
                  <option value="INFORMACION / PAGOS" />
                  <option value="Visita Radio Enlace" />
                  <option value="Visita Potencia Degradada" />
                  <option value="Visita Revisión de Servicio" />
                  <option value="Visita Equipo Alarmado" />
                  <option value="Visita Cambio de Router" />
                  <option value="Visita Colocación de Router" />
                  <option value="Visita Configuración de Equipos" />
                  <option value="Visita HFC" />
                  <option value="Visita Canales Borrosos" />
                  <option value="Visita Paso de Cable UTP" />
                  <option value="Visita Reubicación de equipos (Retención)" />
                  <option value="VISITA TECNICA Equipos no Encienden" />
                  <option value="VISITA TECNICA No Marca Velocidad Contratada" />
                  <option value="Visita Paso de Cable Fibra O. (Cobrado)" />
                  <option value="Visita Paso de Cable RG6 (Cobrado)" />
                  <option value="Visita Paso de Cable UTP (Cobrado)" />
                  <option value="Visita Configuración de Equipos (Cobrado)" />
                  <option value="Visita Reubicación de equipos (Cobrado)" />
                  <option value="Visita Cambio de ONU" />
                  <option value="Visita sin servicio de cable" />
                  <option value="Desconfiguración de Equipos" />
                  <option value="Equipos apagados" />
                  <option value="Equipos Inhibidos" />
                  <option value="Validación de Servicio" />
                  <option value="Problema con dispositivos del cliente" />
                  <option value="Configuración de Equipos ONU / Router" />
                  <option value="Migración / Potencia degradada" />
                  <option value="Configuración mediante ANY DESK" />
                  <option value="CUENTAS ZAPPING" />
                  <option value="Activación de Servicio" />
                  <option value="Cambio de Domicilio" />
                  <option value="Migración de Servicio" />
                  <option value="Actualización de Velocidad" />
                  <option value="Configuración de Equipos en instalación" />
                  <option value="Paso a Cartera" />
                  <option value="Paso a Ventas" />
                  <option value="Paso a soporte técnico" />
                  <option value="Corte de servicio - Reconexión Autorizada" />
                  <option value="Corte de servicio - Corte Autorizado" />
                  <option value="Valores a Pagar" />
                  <option value="Dirección y Horarios de Atención" />
                  <option value="Acuerdo de Pagos" />
                  <option value="Actualización de Pagos" />
                  <option value="Recepción de Equipos" />
                  <option value="Información" />
                  <option value="TICKET AL NOC / DAÑO HFC" />
                  <option value="TICKET AL NOC / DAÑO GPON" />
                  <option value="TICKET AL NOC / DAÑO RADIAL" />
                  <option value="TICKET AL NOC / SIN CANAL" />
                  <option value="TICKET AL NOC / PAGINAS BLOQUEADAS" />
                  <option value="TICKET AL NOC / NAT TIPO 3" />
                  <option value="TICKET AL NOC / CAIDA GENERAL" />
                  <option value="CAÍDA GENERAL / OLT" />
                  <option value="COBRO CON TARJETA" />
                  <option value="PASO A RETENCION" />
                </datalist>
              </div>

              {/* FILA 5: Observación */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '5px' }}>
                  Comentario / Observación de la Atención: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={atencionForm.observacion}
                  onChange={(e) => setAtencionForm(prev => ({ ...prev, observacion: e.target.value }))}
                  rows="3"
                  placeholder="Describe detalladamente el soporte brindado o el acuerdo al que se llegó..."
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', resize: 'vertical', fontWeight: 600, fontSize: '0.88rem', boxSizing: 'border-box' }}
                  required
                ></textarea>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAtencionModal(false)}
                  disabled={submittingAtencion}
                  style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--sidebar-text)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAtencion}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: 800, cursor: submittingAtencion ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                >
                  {submittingAtencion ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                  {submittingAtencion ? 'Guardando...' : 'Registrar Atención Diaria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR VISITA RÁPIDA */}
      {showVisitaModal && selectedClient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(5, 150, 105, 0.15)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-calendar-plus"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Agendar Visita Técnica
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Contrato #{selectedClient.contrato} — {selectedClient.cliente}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVisitaModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitVisita} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Información Fija de Ubicación */}
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 14px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Dirección:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{selectedClient.direccion}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Sector:</span>
                  <strong style={{ color: '#0284c7' }}>{selectedClient.sector}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '5px' }}>
                    📅 Fecha Programada: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    min={getTodayLocal()}
                    value={visitaForm.fecha_programada}
                    onChange={(e) => setVisitaForm(prev => ({ ...prev, fecha_programada: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '5px' }}>
                    ⏰ Franja Horaria:
                  </label>
                  <select
                    value={visitaForm.preferencia_horaria}
                    onChange={(e) => setVisitaForm(prev => ({ ...prev, preferencia_horaria: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                  >
                    <option value="MAÑANA (09:00 - 13:00)">☀️ MAÑANA (09:00 - 13:00)</option>
                    <option value="TARDE (14:00 - 18:00)">⛅ TARDE (14:00 - 18:00)</option>
                    <option value="09:00 - 11:00">09:00 - 11:00</option>
                    <option value="11:00 - 13:00">11:00 - 13:00</option>
                    <option value="14:00 - 16:00">14:00 - 16:00</option>
                    <option value="16:00 - 18:00">16:00 - 18:00</option>
                    <option value="TODO EL DIA">TODO EL DÍA</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '5px' }}>
                    👷 Técnico Asignado: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={visitaForm.tecnico_asignado}
                    onChange={(e) => setVisitaForm(prev => ({ ...prev, tecnico_asignado: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                    required
                  >
                    <option value="">-- Seleccionar Técnico --</option>
                    {tecnicos.filter(t => t.activo === 1).map(t => (
                      <option key={t.id_tecnico || t.nombre} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '5px' }}>
                    Prioridad:
                  </label>
                  <select
                    value={visitaForm.prioridad}
                    onChange={(e) => setVisitaForm(prev => ({ ...prev, prioridad: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                  >
                    <option value="BAJA">🟢 BAJA</option>
                    <option value="MEDIA">🟡 MEDIA</option>
                    <option value="ALTA">🟠 ALTA</option>
                    <option value="URGENTE">🔴 URGENTE</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '5px' }}>
                  Problema / Diagnóstico Preliminar:
                </label>
                <input
                  type="text"
                  list="react-problemas-list"
                  value={visitaForm.problema}
                  onChange={(e) => setVisitaForm(prev => ({ ...prev, problema: e.target.value }))}
                  placeholder="Selecciona o escribe el problema reportado..."
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                  required
                />
                <datalist id="react-problemas-list">
                  {problemas.map((p, idx) => (
                    <option key={idx} value={p.nombre_problema}></option>
                  ))}
                  <option value="SIN SERVICIO"></option>
                  <option value="INTERNET LENTO"></option>
                  <option value="CORTE DE FIBRA"></option>
                  <option value="ROUTER DESCONFIGURADO"></option>
                  <option value="CAMBIO DE EQUIPO"></option>
                  <option value="POTENCIA ATENUADA"></option>
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '5px' }}>
                  Observación para el Técnico:
                </label>
                <textarea
                  value={visitaForm.observacion_callcenter}
                  onChange={(e) => setVisitaForm(prev => ({ ...prev, observacion_callcenter: e.target.value }))}
                  rows="3"
                  placeholder="Indicaciones sobre la ubicación, pruebas realizadas o detalles para el técnico en campo..."
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', resize: 'vertical', fontWeight: 600 }}
                ></textarea>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowVisitaModal(false)}
                  disabled={submittingVisita}
                  style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--sidebar-text)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingVisita}
                  style={{ padding: '9px 22px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white', fontWeight: 800, cursor: submittingVisita ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {submittingVisita ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-calendar-check"></i>}
                  {submittingVisita ? 'Agendando...' : 'Agendar Visita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CARGA MASIVA DE ATENCIONES (LOTE) */}
      {showMasivoModal && (
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
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#e0e7ff', color: '#6366f1', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 800 }}>
                    Carga Masiva por Lote de Contratos
                  </h3>
                  <p style={{ margin: '2px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.85rem' }}>
                    Pega una lista de contratos desde Excel/Drive y asigna los parámetros del lote.
                  </p>
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

            {/* Formulario */}
            <form onSubmit={handleMasivoSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* Lista de Contratos */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      Lista de Contratos (pegar de Excel/Drive):
                    </label>
                    <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                      {(() => {
                        const count = (masivoForm.contratos || '')
                          .split(/[\r\n,;\s]+/)
                          .map(c => c.trim())
                          .filter(c => c.length > 0);
                        return `${[...new Set(count)].length} detectados`;
                      })()}
                    </span>
                  </div>
                  <textarea
                    value={masivoForm.contratos}
                    onChange={(e) => setMasivoForm(prev => ({ ...prev, contratos: e.target.value }))}
                    rows="12"
                    className="form-control"
                    placeholder={"Pega aquí los números de contratos (uno por línea o separados por comas/espacios)...\nEjemplo:\n38404\n41413\n032350\n20005"}
                    required
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem', padding: '12px', lineHeight: '1.5', width: '100%', boxSizing: 'border-box' }}
                  ></textarea>
                  <small style={{ color: 'var(--sidebar-text)', marginTop: '6px', fontSize: '0.78rem' }}>
                    <i className="fa-solid fa-lightbulb" style={{ color: '#f59e0b' }}></i> Los nombres y datos de clientes se autocompletarán con la base de datos.
                  </small>
                </div>

                {/* Campos Comunes del Lote */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Fecha del Registro:</label>
                    <input
                      type="date"
                      value={masivoForm.fecha}
                      onChange={(e) => setMasivoForm(prev => ({ ...prev, fecha: e.target.value }))}
                      className="form-control"
                      style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Tipo de Atención:</label>
                    <select
                      value={masivoForm.tipo_atencion}
                      onChange={(e) => setMasivoForm(prev => ({ ...prev, tipo_atencion: e.target.value }))}
                      className="form-control"
                      style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
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
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Tipo de Solicitud:</label>
                    <select
                      value={masivoForm.tipo_solicitud}
                      onChange={(e) => setMasivoForm(prev => ({ ...prev, tipo_solicitud: e.target.value }))}
                      className="form-control"
                      style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
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

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Medio de Contacto:</label>
                    <select
                      value={masivoForm.medio_contacto}
                      onChange={(e) => setMasivoForm(prev => ({ ...prev, medio_contacto: e.target.value }))}
                      className="form-control"
                      style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="WHATSAPP">WHATSAPP</option>
                      <option value="TELEFONO">TELÉFONO</option>
                      <option value="OFICINA">OFICINA</option>
                      <option value="WHATSAPP + TELEFONO">WHATSAPP + TELEFONO</option>
                      <option value="REDES SOCIALES">REDES SOCIALES</option>
                      <option value="CONTROL CALIDAD">CONTROL CALIDAD</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Acción Realizada:</label>
                    <select
                      value={masivoForm.accion}
                      onChange={(e) => setMasivoForm(prev => ({ ...prev, accion: e.target.value }))}
                      className="form-control"
                      style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="SOPORTE MEDIANTE MENSAJES">SOPORTE MEDIANTE MENSAJES</option>
                      <option value="SOPORTE MEDIANTE LLAMADA">SOPORTE MEDIANTE LLAMADA</option>
                      <option value="LLAMADA SALIENTE">LLAMADA SALIENTE</option>
                      <option value="VISITA TECNICA">VISITA TECNICA</option>
                      <option value="CORTE INTERNO DE SERVICIO">CORTE INTERNO DE SERVICIO</option>
                      <option value="SE DA INFORMACION">SE DA INFORMACION</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fila Inferior: Motivo y Observación */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Motivo / Solución:</label>
                  <input
                    type="text"
                    value={masivoForm.motivo}
                    onChange={(e) => setMasivoForm(prev => ({ ...prev, motivo: e.target.value }))}
                    className="form-control"
                    list="masivo-motivos-list"
                    placeholder="Ej: VALIDACIÓN DE SC / CLIENTE CORTADO"
                    style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                  />
                  <datalist id="masivo-motivos-list">
                    <option value="VALIDACIÓN DE SC / CLIENTE CORTADO" />
                    <option value="INFORMACION / PAGOS" />
                    <option value="Visita Radio Enlace" />
                    <option value="Visita Potencia Degradada" />
                    <option value="Visita Revisión de Servicio" />
                    <option value="Visita Equipo Alarmado" />
                    <option value="Visita Cambio de Router" />
                    <option value="Visita Colocación de Router" />
                    <option value="Visita Configuración de Equipos" />
                    <option value="Desconfiguración de Equipos" />
                    <option value="Equipos apagados" />
                    <option value="Equipos Inhibidos" />
                    <option value="Validación de Servicio" />
                    <option value="Problema con dispositivos del cliente" />
                    <option value="Configuración de Equipos ONU / Router" />
                    <option value="NOTIFICACIÓN MASIVA" />
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-main)' }}>Observación / Acción común:</label>
                  <input
                    type="text"
                    value={masivoForm.observacion}
                    onChange={(e) => setMasivoForm(prev => ({ ...prev, observacion: e.target.value }))}
                    className="form-control"
                    placeholder="Ej: auditoría: se verifica cliente cortado"
                    style={{ fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Banner de Alertas/Resultados */}
              {masivoResult && (
                <div style={{
                  marginBottom: '20px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  background: masivoResult.status === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${masivoResult.status === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: masivoResult.status === 'success' ? '#065f46' : '#991b1b'
                }}>
                  <strong>
                    <i className={`fa-solid ${masivoResult.status === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>{' '}
                    {masivoResult.status === 'success' ? '¡Éxito!' : 'Error:'}
                  </strong>{' '}
                  {masivoResult.message || `Lote procesado: ${masivoResult.total_registrados} contratos.`}
                  {masivoResult.no_encontrados && masivoResult.no_encontrados.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#b45309' }}>
                      <strong>No encontrados en base local:</strong> {masivoResult.no_encontrados.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Acciones */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <button
                  type="button"
                  onClick={() => setShowMasivoModal(false)}
                  disabled={masivoLoading}
                  style={{ background: 'var(--profile-bg)', color: 'var(--sidebar-text)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={masivoLoading}
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: masivoLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                >
                  {masivoLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                  {masivoLoading ? 'Registrando lote...' : 'Registrar Lote de Atenciones'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MIS ATENCIONES DE HOY */}
      {showMisAtencionesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-clipboard-list"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Mis Atenciones del Día
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Registro de tickets atendidos por {user?.nombre || 'Call Center'} ({misAtenciones.length} tickets)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMisAtencionesModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>Fecha:</label>
                  <input
                    type="date"
                    value={misAtencionesFecha}
                    onChange={(e) => {
                      setMisAtencionesFecha(e.target.value);
                      fetchMisAtenciones(e.target.value);
                    }}
                    className="form-control"
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchMisAtenciones(misAtencionesFecha)}
                  style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  <i className={`fa-solid fa-rotate-right ${misAtencionesLoading ? 'fa-spin' : ''}`}></i> Refrescar
                </button>
              </div>

              {/* Tabla de atenciones */}
              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '14px' }}>
                {misAtencionesLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sidebar-text)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.8rem', color: '#0284c7', marginBottom: '10px' }}></i>
                    <p style={{ margin: 0, fontWeight: 600 }}>Cargando atenciones...</p>
                  </div>
                ) : misAtenciones.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sidebar-text)', fontStyle: 'italic' }}>
                    No hay atenciones registradas para la fecha seleccionada.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sidebar-text)' }}>Hora</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sidebar-text)' }}>Contrato</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sidebar-text)' }}>Cliente</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sidebar-text)' }}>Motivo / Acción</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sidebar-text)' }}>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misAtenciones.map((at, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0284c7' }}>{at.hora || '-'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>#{at.contrato}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>{at.cliente}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <strong style={{ color: 'var(--text-main)', display: 'block' }}>{at.motivo || at.tipo_solicitud}</strong>
                            <small style={{ color: 'var(--sidebar-text)' }}>{at.accion} ({at.medio_contacto})</small>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-main)', maxWidth: '280px', lineHeight: 1.3 }}>
                            {at.observacion || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowMisAtencionesModal(false)}
                style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--sidebar-text)', fontWeight: 700, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DE DATOS TÉCNICOS E IP */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                  <i className="fa-solid fa-network-wired"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Editar Datos Técnicos & IP
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Contrato #{editForm.contrato} — {selectedClient?.cliente}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveEdit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Alert Feedback */}
              {editMessage.text && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: editMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${editMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: editMessage.type === 'success' ? '#34d399' : '#f87171'
                }}>
                  <i className={`fa-solid ${editMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                  <span>{editMessage.text}</span>
                </div>
              )}

              {/* SECCIÓN 1: RED E IP */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-globe"></i> 1. Red & Conectividad IP
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      🌐 IP Cliente / Dispositivo:
                    </label>
                    <input
                      type="text"
                      value={editForm.ip_cliente}
                      onChange={(e) => setEditForm(prev => ({ ...prev, ip_cliente: e.target.value.trim() }))}
                      placeholder="Ej. 10.120.118.48"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      🏢 IP Nodo / OLT:
                    </label>
                    <input
                      type="text"
                      value={editForm.ip_nodo}
                      onChange={(e) => setEditForm(prev => ({ ...prev, ip_nodo: e.target.value.trim() }))}
                      placeholder="Ej. 10.101.1.18"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      ⚙️ Modo de Acceso:
                    </label>
                    <select
                      value={editForm.modo_acceso}
                      onChange={(e) => setEditForm(prev => ({ ...prev, modo_acceso: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box' }}
                    >
                      <option value="">-- No especificado --</option>
                      <option value="ROUTER (DHCP / PPPoE)">ROUTER (DHCP / PPPoE)</option>
                      <option value="BRIDGE">BRIDGE</option>
                      <option value="IP ESTATICA">IP ESTÁTICA</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: ONT / ONU */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-server"></i> 2. Equipo ONT / ONU
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      🟢 Modelo ONT / ONU:
                    </label>
                    <input
                      type="text"
                      value={editForm.modelo_ont}
                      onChange={(e) => setEditForm(prev => ({ ...prev, modelo_ont: e.target.value }))}
                      placeholder="Ej. HUAWEI, TP-LINK XX530V..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      🏷️ Serie GPON (SN ONU):
                    </label>
                    <input
                      type="text"
                      value={editForm.numero_serie}
                      onChange={(e) => setEditForm(prev => ({ ...prev, numero_serie: e.target.value.toUpperCase() }))}
                      placeholder="Ej. HWTC0811D192..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: '#d97706', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: ROUTERS WI-FI */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-wifi"></i> 3. Routers Wi-Fi & Mesh
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      📶 Router Principal:
                    </label>
                    <input
                      type="text"
                      value={editForm.router_principal}
                      onChange={(e) => setEditForm(prev => ({ ...prev, router_principal: e.target.value }))}
                      placeholder="Ej. Router Huawei AX3 / TP-Link EX511"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Serie / MAC Router Principal:
                    </label>
                    <input
                      type="text"
                      value={editForm.numero_serie_router}
                      onChange={(e) => setEditForm(prev => ({ ...prev, numero_serie_router: e.target.value.toUpperCase() }))}
                      placeholder="Opcional"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      🔁 Router Secundario / Mesh:
                    </label>
                    <input
                      type="text"
                      value={editForm.router_secundario}
                      onChange={(e) => setEditForm(prev => ({ ...prev, router_secundario: e.target.value }))}
                      placeholder="Dejar vacío si no tiene"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Serie Router Secundario:
                    </label>
                    <input
                      type="text"
                      value={editForm.numero_serie_router_secundario}
                      onChange={(e) => setEditForm(prev => ({ ...prev, numero_serie_router_secundario: e.target.value.toUpperCase() }))}
                      placeholder="Opcional"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Tipo Conexión Mesh:
                    </label>
                    <select
                      value={editForm.tipo_mesh}
                      onChange={(e) => setEditForm(prev => ({ ...prev, tipo_mesh: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box' }}
                    >
                      <option value="">-- Ninguno --</option>
                      <option value="CABLEADO">🔌 CABLEADO</option>
                      <option value="INALAMBRICO (MESH)">📶 INALÁMBRICO (MESH)</option>
                      <option value="REDES DISTINTAS (AP)">🔀 REDES DISTINTAS (AP)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Cantidad Total Routers:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={editForm.cantidad_routers}
                      onChange={(e) => setEditForm(prev => ({ ...prev, cantidad_routers: parseInt(e.target.value) || 1 }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box', textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSavingEdit}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--sidebar-text)',
                    fontWeight: 750,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  {isSavingEdit ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Consulta e Importación Base Central */}
      <ConsultaBaseCentralModal
        isOpen={centralModal.isOpen}
        onClose={() => setCentralModal({ isOpen: false, initialCedula: '', initialContrato: '' })}
        initialCedula={centralModal.initialCedula}
        initialContrato={centralModal.initialContrato}
        token={token}
        onClientImported={(importedClient) => {
          handleSelectClient(importedClient);
        }}
      />
    </div>
  );
}

export default BuscadorClienteTab;