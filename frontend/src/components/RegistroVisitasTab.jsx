import React, { useState, useEffect, useRef } from 'react';

function RegistroVisitasTab({ token, user, activeArea, initialVisitData, onClearInitialData }) {
  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Form Fields
  const [fechaProgramada, setFechaProgramada] = useState(getTodayLocal());
  const [prioridad, setPrioridad] = useState('MEDIA');
  const [tecnicoAsignado, setTecnicoAsignado] = useState('');
  const [tecnicoApoyo, setTecnicoApoyo] = useState('');
  const [empresa, setEmpresa] = useState('SERVICABLE');
  const [contrato, setContrato] = useState('');
  const [cliente, setCliente] = useState('');
  const [telefonos, setTelefonos] = useState('');
  const [sector, setSector] = useState('');
  const [direccion, setDireccion] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [preferenciaHoraria, setPreferenciaHoraria] = useState('');
  
  // Condicionales por area (Soporte vs Instalacion)
  const [servicio, setServicio] = useState(activeArea === 'INSTALACIONES' ? 'INSTALACIÓN NUEVA' : '');
  const [producto, setProducto] = useState('INTERNET');
  const [tipoInstalacion, setTipoInstalacion] = useState('NORMAL');
  const [vendedor, setVendedor] = useState('');
  const [recibidoCoordinacion, setRecibidoCoordinacion] = useState('');
  const [velocidadMbps, setVelocidadMbps] = useState('');
  const [problema, setProblema] = useState('');
  const [observacionCallcenter, setObservacionCallcenter] = useState('');
  
  // Connection details
  const [infoCaja, setInfoCaja] = useState('');
  const [infoHilo, setInfoHilo] = useState('');
  const [infoIp, setInfoIp] = useState('');
  const [infoVlan, setInfoVlan] = useState('');
  const [infoUsr, setInfoUsr] = useState('');
  const [infoPas, setInfoPas] = useState('');

  // Catalog / Loaded lists
  const [tecnicos, setTecnicos] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [problemas, setProblemas] = useState([]);
  
  // UI states
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [contratoOk, setContratoOk] = useState(false);
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [loadingTecnicosCercanos, setLoadingTecnicosCercanos] = useState(false);
  const [tecnicosCercanos, setTecnicosCercanos] = useState([]);
  const [showRecomendados, setShowRecomendados] = useState(false);
  const [conflictos, setConflictos] = useState([]);
  
  // Multi-contract selector state & Plan metadata
  const [multiContratosList, setMultiContratosList] = useState([]);
  const [showMultiContratoModal, setShowMultiContratoModal] = useState(false);
  const [clientPlanInfo, setClientPlanInfo] = useState(null);

  // Client history modal state
  const [modalHistorial, setModalHistorial] = useState({
    isOpen: false,
    loading: false,
    cliente: '',
    lista: []
  });
  
  // Map References
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapContainerId = "mapa-registro";

  // Initial catalogs fetch
  useEffect(() => {
    fetchCatalogs();
  }, []);

  // Populate initialVisitData transferred from AtencionesTab
  useEffect(() => {
    if (initialVisitData) {
      if (initialVisitData.contrato) {
        setContrato(initialVisitData.contrato);
      }
      if (initialVisitData.cliente) setCliente(initialVisitData.cliente);
      if (initialVisitData.sector) setSector(initialVisitData.sector);
      if (initialVisitData.telefonos) setTelefonos(initialVisitData.telefonos);
      if (initialVisitData.problema) setProblema(initialVisitData.problema);
      if (initialVisitData.observacionCallcenter) setObservacionCallcenter(initialVisitData.observacionCallcenter);

      if (onClearInitialData) onClearInitialData();
    }
  }, [initialVisitData]);

  // Update default states when area changes
  useEffect(() => {
    setServicio(activeArea === 'INSTALACIONES' ? 'INSTALACIÓN NUEVA' : '');
    setProblema(activeArea === 'INSTALACIONES' ? 'INSTALACIÓN NUEVA' : '');
  }, [activeArea]);

  // Apply client details & auto-fill service, speed, IP, ONU series
  const aplicarDatosCliente = (data) => {
    setContratoOk(true);
    if (data.contrato) setContrato(data.contrato);
    if (data.empresa) setEmpresa(data.empresa);
    if (data.cliente) setCliente(data.cliente);
    if (data.telefonos) setTelefonos(data.telefonos);
    if (data.direccion) setDireccion(data.direccion);

    // Save enriched plan metadata for UI display
    setClientPlanInfo({
      producto: data.producto || '',
      velocidad_mbps: data.velocidad_mbps || null,
      ip_cliente: data.ip_cliente || '',
      ip_nodo: data.ip_nodo || '',
      numero_serie: data.numero_serie || '',
      cedula: data.cedula || ''
    });

    // Auto-select Sector and geolocate map marker
    if (data.zona_excel) {
      const matchedSector = sectores.find(s => s.nombre_sector.toUpperCase() === data.zona_excel.trim().toUpperCase());
      if (matchedSector) {
        setSector(matchedSector.nombre_sector);
        setLatitud(matchedSector.latitud_defecto || '');
        setLongitud(matchedSector.longitud_defecto || '');
        updateMapMarker(matchedSector.latitud_defecto, matchedSector.longitud_defecto, 15);
      } else {
        setSector(data.zona_excel);
      }
    }

    // Cargar Plan / Paquete comercial completo directo en Servicio
    if (activeArea !== 'INSTALACIONES') {
      setServicio(data.producto || 'SERVICIO TÉCNICO');
    }

    // Auto-populate Speed in Mbps (0 if no speed plan / only cable)
    if (data.velocidad_mbps !== undefined && data.velocidad_mbps !== null) {
      setVelocidadMbps(data.velocidad_mbps);
    } else {
      setVelocidadMbps(0);
    }

    // Auto-populate IP address
    if (data.ip_cliente) {
      setInfoIp(data.ip_cliente);
    }


    // Auto-populate Vendor if present
    if (data.vendedor) {
      setVendedor(data.vendedor);
    }

    setShowMultiContratoModal(false);
  };

  // Initial Leaflet Map Setup
  useEffect(() => {
    if (!window.L) return;

    let defaultLat = -2.9001;
    let defaultLon = -78.9959;

    // Load initial map view
    mapRef.current = window.L.map(mapContainerId).setView([defaultLat, defaultLon], 14);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    markerRef.current = window.L.marker([defaultLat, defaultLon], {
      draggable: true
    }).addTo(mapRef.current);

    // Marker drag updates lat/lon state
    markerRef.current.on('dragend', (e) => {
      const pos = markerRef.current.getLatLng();
      setLatitud(pos.lat.toFixed(6));
      setLongitud(pos.lng.toFixed(6));
    });

    // Map click moves marker
    mapRef.current.on('click', (e) => {
      markerRef.current.setLatLng(e.latlng);
      setLatitud(e.latlng.lat.toFixed(6));
      setLongitud(e.latlng.lng.toFixed(6));
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync coords from state input back to Leaflet marker & view
  const updateMapMarker = (lat, lon, zoom = 16) => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (!isNaN(latNum) && !isNaN(lonNum) && mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latNum, lonNum]);
      mapRef.current.setView([latNum, lonNum], zoom);
    }
  };

  const handleCoordsChange = (e, type) => {
    const val = e.target.value;
    if (type === 'lat') {
      setLatitud(val);
      updateMapMarker(val, longitud);
    } else {
      setLongitud(val);
      updateMapMarker(latitud, val);
    }
  };

  // Conflict checking on assign parameter change
  useEffect(() => {
    verificarConflictosAgenda();
  }, [fechaProgramada, tecnicoAsignado, preferenciaHoraria]);

  const fetchCatalogs = async () => {
    try {
      // Fetch sectors
      const secRes = await fetch('/api/v2/sectores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const secData = await secRes.json();
      if (secData.status === 'success') setSectores(secData.sectores || []);

      // Fetch technicians
      const tecRes = await fetch('/api/v2/tecnicos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tecData = await tecRes.json();
      if (tecData.status === 'success') setTecnicos(tecData.tecnicos || []);

      // Fetch problems
      const probRes = await fetch('/api/v2/problemas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const probData = await probRes.json();
      if (probData.status === 'success') setProblemas(probData.problemas || []);
    } catch (e) {
      console.error("Error al cargar catálogos:", e);
    }
  };

  // Autocomplete client details by contract or cedula
  const handleContratoBlur = async () => {
    if (!contrato.trim()) return;
    setLoadingContrato(true);
    setContratoOk(false);

    try {
      const url = `/api/cliente/${encodeURIComponent(contrato.trim())}?empresa=${encodeURIComponent(empresa)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'multi_contrato' && data.contratos && data.contratos.length > 1) {
          // Multiple contracts found for this Cedula
          setMultiContratosList(data.contratos);
          setShowMultiContratoModal(true);
        } else {
          // Single match
          aplicarDatosCliente(data);
        }
      }
    } catch (e) {
      console.error("Error buscando cliente/contrato en directorio:", e);
    } finally {
      setLoadingContrato(false);
    }
  };

  // Nomimatim address geocoding search
  const buscarDireccionEnMapa = async () => {
    if (!direccion.trim()) {
      alert("Por favor ingresa una dirección exacta primero.");
      return;
    }

    setLoadingGeocode(true);
    const query = `${direccion.replace(/\s+y\s+/gi, ' & ').trim()}, Cuenca, Ecuador`;

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setLatitud(lat.toFixed(6));
        setLongitud(lon.toFixed(6));
        updateMapMarker(lat, lon, 17);
      } else {
        alert("No se encontró una ubicación precisa. Intenta ubicar el marcador arrastrándolo manualmente.");
      }
    } catch (err) {
      alert("Error al conectar con el servicio de geocodificación.");
    } finally {
      setLoadingGeocode(false);
    }
  };

  // On sector select change
  const handleSectorChange = (e) => {
    const val = e.target.value;
    setSector(val);
    const matched = sectores.find(s => s.nombre_sector === val);
    if (matched && matched.latitud_defecto && matched.longitud_defecto) {
      setLatitud(matched.latitud_defecto);
      setLongitud(matched.longitud_defecto);
      updateMapMarker(matched.latitud_defecto, matched.longitud_defecto, 15);
      setConflictos([]);
    }
  };

  // Recommend closest active tech
  const recomendarTecnicoCercano = async () => {
    if (!latitud || !longitud) {
      alert("Selecciona un sector o coordenadas de ubicación primero.");
      return;
    }

    setLoadingTecnicosCercanos(true);
    setShowRecomendados(true);
    try {
      const url = `/api/admin/tecnicos/mas_cercano?lat=${latitud}&lon=${longitud}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setTecnicosCercanos(data.recomendados || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTecnicosCercanos(false);
    }
  };

  // Verification conflicts
  const verificarConflictosAgenda = async () => {
    if (!fechaProgramada || !tecnicoAsignado) {
      setConflictos([]);
      return;
    }

    try {
      const url = `/api/admin/recordatorios/verificar?fecha=${encodeURIComponent(fechaProgramada)}&tecnico=${encodeURIComponent(tecnicoAsignado)}&preferencia=${encodeURIComponent(preferenciaHoraria)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setConflictos(data.conflictos || []);
      } else {
        setConflictos([]);
      }
    } catch (e) {
      console.error("Conflict verification failed:", e);
    }
  };

  const handleVerHistorial = async () => {
    if (!cliente || !cliente.trim()) {
      alert("Por favor, ingresa el nombre del cliente primero.");
      return;
    }
    setModalHistorial({ isOpen: true, loading: true, cliente: cliente.trim(), lista: [] });
    try {
      const res = await fetch(`/api/cliente/historial/${encodeURIComponent(cliente.trim())}?contrato=${encodeURIComponent(contrato || '')}`, {

        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.status === 'ok') {
        setModalHistorial(prev => ({ ...prev, loading: false, lista: data.historial || [] }));
      } else {
        alert("Error al cargar el historial.");
        setModalHistorial(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
      setModalHistorial(prev => ({ ...prev, loading: false }));
    }
  };

  // Submit visit payload
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cliente.trim() || !sector.trim() || !direccion.trim()) {
      alert("Por favor completa los campos requeridos (Cliente, Sector, Dirección).");
      return;
    }

    const payload = {
      fecha_programada: fechaProgramada,
      prioridad,
      tecnico_asignado: tecnicoAsignado,
      tecnico_apoyo: tecnicoApoyo,
      empresa,
      contrato,
      cliente,
      telefonos,
      sector,
      direccion,
      latitud,
      longitud,
      preferencia_horaria: preferenciaHoraria,
      servicio,
      es_instalacion: activeArea === 'INSTALACIONES' ? 1 : 0,
      
      // Instalación specific fields
      producto: activeArea === 'INSTALACIONES' ? producto : null,
      tipo_instalacion: activeArea === 'INSTALACIONES' ? tipoInstalacion : null,
      vendedor: activeArea === 'INSTALACIONES' ? vendedor : null,
      recibido_coordinacion: activeArea === 'INSTALACIONES' ? recibidoCoordinacion : null,
      
      // Soporte specific fields
      velocidad_mbps: activeArea === 'SOPORTE' ? velocidadMbps : null,
      problema: activeArea === 'INSTALACIONES' ? 'INSTALACIÓN NUEVA' : problema,
      observacion_callcenter: observacionCallcenter,

      // Connection details
      info_caja: infoCaja,
      info_hilo: infoHilo,
      info_ip: infoIp,
      info_vlan: infoVlan,
      info_usr: infoUsr,
      info_pas: infoPas
    };

    try {
      const res = await fetch('/api/v2/visitas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert("¡Visita guardada exitosamente!");
        // Reset form
        setContrato('');
        setCliente('');
        setTelefonos('');
        setSector('');
        setDireccion('');
        setLatitud('');
        setLongitud('');
        setPreferenciaHoraria('');
        setObservacionCallcenter('');
        setInfoCaja('');
        setInfoHilo('');
        setInfoIp('');
        setInfoVlan('');
        setInfoUsr('');
        setInfoPas('');
        setContratoOk(false);
        setConflictos([]);
      } else {
        alert("Error al guardar: " + data.message);
      }
    } catch (err) {
      alert("Error al conectar con la base de datos.");
    }
  };

  return (
    <div id="tab-registro" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Encabezado Principal */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-calendar-plus" style={{ color: 'var(--primary)' }}></i>
            {activeArea === 'INSTALACIONES' ? 'Registrar Nueva Instalación (Calidad)' : 'Registrar Nueva Visita (Soporte)'}
          </h1>
          <p style={{ marginTop: '4px', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Asigna turnos, vincula contratos, geolocaliza el domicilio en mapa y optimiza la agenda del equipo técnico.
          </p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="card" style={{ padding: '28px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSubmit} autoComplete="off">

          {/* SECCIÓN 1: Datos del Cliente */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>
              <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i> Datos del Cliente
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '15px' }}>
            {/* Empresa */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Empresa:</label>
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
              >
                <option value="SERVICABLE">SERVICABLE</option>
                <option value="FIBRACOM">FIBRACOM</option>
              </select>
            </div>

            {/* Cédula o Contrato */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                Cédula o Contrato:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={contrato}
                  onChange={(e) => setContrato(e.target.value)}
                  onBlur={handleContratoBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleContratoBlur(); } }}
                  placeholder="Ej: Cédula (010...) o Contrato (47d, 10F)"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                />
                {loadingContrato && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} className="spinner"></span>}
                {contratoOk && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }}><i className="fa-solid fa-circle-check"></i></span>}
              </div>
            </div>

            {/* Nombre del Cliente */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>Nombre del Cliente:</label>
                {activeArea !== 'INSTALACIONES' && (
                  <button
                    type="button"
                    onClick={handleVerHistorial}
                    style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <i className="fa-solid fa-clock-rotate-left"></i> Ver Historial
                  </button>
                )}
              </div>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre completo"
                required
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
              />
            </div>

            {/* Teléfonos */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Teléfonos:</label>
              <input
                type="text"
                value={telefonos}
                onChange={(e) => setTelefonos(e.target.value)}
                placeholder="Ej. 0992321716"
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>

          {/* Banner de Información Comercial / Plan / Velocidad / ONU */}
          {clientPlanInfo && (clientPlanInfo.producto || clientPlanInfo.velocidad_mbps || clientPlanInfo.ip_cliente || clientPlanInfo.ip_nodo) && (
            <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: '12px', padding: '10px 16px', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: '0.82rem' }}>
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
              {clientPlanInfo.ip_cliente && (
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                  🌐 <strong>IP:</strong> {clientPlanInfo.ip_cliente}
                </span>
              )}
              {clientPlanInfo.ip_nodo && (
                <span style={{ color: '#0284c7', fontWeight: 600 }}>
                  🏢 <strong>IP Nodo:</strong> {clientPlanInfo.ip_nodo}
                </span>
              )}
              {clientPlanInfo.numero_serie && (
                <span style={{ color: '#d97706', fontWeight: 700 }}>
                  🏷️ <strong>ONU SN:</strong> {clientPlanInfo.numero_serie}
                </span>
              )}
            </div>
          )}


          {/* SECCIÓN 2: Datos de Asignación de Ruta */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '20px', marginTop: '30px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>
              <i className="fa-solid fa-user-gear" style={{ marginRight: '6px' }}></i> Datos de Asignación de Ruta
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            
            {/* Fecha Programada */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                Fecha Programada (Día de la Visita):
              </label>
              <input
                type="date"
                min={getTodayLocal()}
                value={fechaProgramada}
                onChange={(e) => setFechaProgramada(e.target.value)}
                required
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
              />
            </div>

            {/* Prioridad (Solo Soporte) */}
            {activeArea !== 'INSTALACIONES' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                  Prioridad de Atención:
                </label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                >
                  <option value="ALTA">🔴 ALTA</option>
                  <option value="MEDIA">🟡 MEDIA</option>
                  <option value="BAJA">⚪ BAJA</option>
                </select>
              </div>
            )}

            {/* Técnico Principal */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                  Técnico Principal:
                </label>
                <button
                  type="button"
                  onClick={recomendarTecnicoCercano}
                  style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="fa-solid fa-location-crosshairs"></i> Recomendar Cercano
                </button>
              </div>
              <select
                value={tecnicoAsignado}
                onChange={(e) => setTecnicoAsignado(e.target.value)}
                required
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
              >
                <option value="">-- Seleccione Técnico Responsable --</option>
                <option value="NO TECNICO">NO TECNICO (Sin Asignar / Por Coordinar)</option>
                {tecnicos.filter(t => t.nombre !== 'NO TECNICO').map((tec) => (
                  <option key={tec.id_tecnico} value={tec.nombre}>{tec.nombre}</option>
                ))}
              </select>
            </div>

            {/* Técnico de Apoyo */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                Técnico de Apoyo (Opcional):
              </label>
              <select
                value={tecnicoApoyo}
                onChange={(e) => setTecnicoApoyo(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
              >
                <option value="">-- Sin Apoyo --</option>
                <option value="NO TECNICO">NO TECNICO</option>
                {tecnicos.filter(t => t.nombre !== 'NO TECNICO').map((tec) => (
                  <option key={tec.id_tecnico} value={tec.nombre}>{tec.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recomendaciones de Técnicos Cercanos */}
          {showRecomendados && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', padding: '16px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ color: '#065f46', fontSize: '0.88rem' }}>📍 Técnicos de {activeArea.toLowerCase()} más cercanos hoy:</strong>
                <button
                  type="button"
                  onClick={() => setShowRecomendados(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#065f46', fontWeight: 800 }}
                >
                  <i className="fa-solid fa-xmark"></i> Cerrar
                </button>
              </div>
              {loadingTecnicosCercanos ? (
                <div style={{ fontSize: '0.82rem', color: '#065f46' }}><i className="fa-solid fa-spinner fa-spin"></i> Geolocalizando cuadrillas...</div>
              ) : tecnicosCercanos.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#c2410c' }}><i className="fa-solid fa-circle-info"></i> No hay cuadrillas activas con señal GPS hoy.</div>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 0, paddingLeft: '15px' }}>
                  {tecnicosCercanos.map((tec, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>
                        <strong>{tec.nombre}</strong> (a {tec.distancia_km} km)
                        <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#dcfce7', color: '#166534', fontWeight: 800, borderRadius: '4px', fontSize: '0.72rem' }}>{tec.estado}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTecnicoAsignado(tec.nombre);
                          setShowRecomendados(false);
                        }}
                        style={{ background: '#166534', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Asignar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Conflictos de Agenda detectados */}
          {conflictos.length > 0 && (
            <div style={{ background: 'rgba(245, 158, 11, 0.12)', borderLeft: '5px solid #f59e0b', borderRadius: '12px', padding: '16px', marginBottom: '25px', color: '#78350f', fontSize: '0.85rem' }}>
              <strong>⚠️ Conflicto detectado en la Agenda del Técnico:</strong>
              <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px', lineHeight: '1.5' }}>
                {conflictos.map((conf, idx) => (
                  <li key={idx}>{conf}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SECCIÓN 3: Ubicación y Mapa */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '20px', marginTop: '30px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>
              <i className="fa-solid fa-map-location-dot" style={{ marginRight: '6px' }}></i> Ubicación y Geolocalización
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Sector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Sector:</label>
              <input
                type="text"
                value={sector}
                onChange={handleSectorChange}
                placeholder="Escribe sector..."
                required
                className="form-control"
                list="react-sectores-list-registro"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
              />
              <datalist id="react-sectores-list-registro">
                {sectores.map((s, idx) => (
                  <option key={idx} value={s.nombre_sector} />
                ))}
              </datalist>
            </div>

            {/* Dirección Exacta */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>Dirección Exacta:</label>
                <button
                  type="button"
                  onClick={buscarDireccionEnMapa}
                  disabled={loadingGeocode}
                  style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {loadingGeocode ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-location"></i>}
                  Buscar en Mapa
                </button>
              </div>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle principal, secundaria y referencias de ubicación"
                required
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Latitud:</label>
              <input
                type="text"
                value={latitud}
                onChange={(e) => handleCoordsChange(e, 'lat')}
                placeholder="-2.897"
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Longitud:</label>
              <input
                type="text"
                value={longitud}
                onChange={(e) => handleCoordsChange(e, 'lon')}
                placeholder="-78.998"
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>

          {/* Leaflet Map Widget container */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
              Ubicación en el Mapa (Haz clic o arrastra el marcador para precisar):
            </label>
            <div id={mapContainerId} style={{ height: '280px', borderRadius: '14px', border: '1px solid var(--border-color)', zIndex: 1 }} />
          </div>

          {/* Preferencia Horaria */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
              Preferencia Horaria (Cliente):
            </label>
            <input
              type="text"
              value={preferenciaHoraria}
              onChange={(e) => setPreferenciaHoraria(e.target.value)}
              placeholder="Ej. mañana, tarde, de 14:00 a 16:00..."
              required
              className="form-control"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
            />
          </div>

          {/* SECCIÓN 4: Detalles Técnicos / Instalación */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '20px', marginTop: '30px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>
              <i className="fa-solid fa-sliders" style={{ marginRight: '6px' }}></i> Detalles del Servicio
            </h3>
          </div>

          {activeArea === 'INSTALACIONES' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Servicio a Realizar:</label>
                <select
                  value={servicio}
                  onChange={(e) => setServicio(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="INSTALACIÓN NUEVA">INSTALACIÓN NUEVA</option>
                  <option value="CAMBIO DE DOMICILIO">CAMBIO DE DOMICILIO</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Producto:</label>
                <select
                  value={producto}
                  onChange={(e) => setProducto(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="INTERNET">INTERNET</option>
                  <option value="CABLE">CABLE</option>
                  <option value="COMBO">COMBO</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Tipo de Instalación:</label>
                <select
                  value={tipoInstalacion}
                  onChange={(e) => setTipoInstalacion(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="DUCTOS">DUCTOS</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Vendedor:</label>
                <input
                  type="text"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  placeholder="Nombre vendedor"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Recibido en Coordinación (Fecha):</label>
                <input
                  type="date"
                  value={recibidoCoordinacion}
                  onChange={(e) => setRecibidoCoordinacion(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>
                  Plan / Paquete Contratado:
                </label>
                <input
                  type="text"
                  value={servicio}
                  onChange={(e) => setServicio(e.target.value)}
                  placeholder="Ej. INTERNET GPON 400 MEGAS, CABLE..."
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Velocidad Mbps:</label>
                <input
                  type="number"
                  value={velocidadMbps}
                  onChange={(e) => setVelocidadMbps(e.target.value)}
                  placeholder="0"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                />
              </div>


              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Problema Reportado:</label>
                <input
                  type="text"
                  value={problema}
                  onChange={(e) => setProblema(e.target.value)}
                  placeholder="Escribe el inconveniente..."
                  required
                  className="form-control"
                  list="react-problemas-list"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                />
                <datalist id="react-problemas-list">
                  {problemas.map((prob, idx) => (
                    <option key={idx} value={prob.nombre} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {/* Observación Callcenter */}
          {activeArea !== 'INSTALACIONES' && (
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Observación Callcenter:</label>
              <textarea
                value={observacionCallcenter}
                onChange={(e) => setObservacionCallcenter(e.target.value)}
                rows="2"
                placeholder="Cliente indica problemas con..."
                className="form-control"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', resize: 'vertical' }}
              />
            </div>
          )}

          {/* Conexión NAP / Hilo / IP */}
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--sidebar-text)', fontWeight: 800, marginBottom: '15px' }}>
              {activeArea === 'INSTALACIONES' ? '🔌 Caja más cercana (Opcional):' : '🔌 Datos de Conexión en Domicilio (Opcional):'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>CAJA:</label>
                <input
                  type="text"
                  value={infoCaja}
                  onChange={(e) => setInfoCaja(e.target.value)}
                  placeholder="Ej. NAP-01"
                  className="form-control"
                />
              </div>

              {activeArea !== 'INSTALACIONES' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>HILO:</label>
                    <input
                      type="text"
                      value={infoHilo}
                      onChange={(e) => setInfoHilo(e.target.value)}
                      placeholder="Ej. 12"
                      className="form-control"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>IP (Estática):</label>
                    <input
                      type="text"
                      value={infoIp}
                      onChange={(e) => setInfoIp(e.target.value)}
                      placeholder="192.168.x.x"
                      className="form-control"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>VLAN:</label>
                    <input
                      type="text"
                      value={infoVlan}
                      onChange={(e) => setInfoVlan(e.target.value)}
                      placeholder="Ej. 100"
                      className="form-control"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Usuario (PPPoE):</label>
                    <input
                      type="text"
                      value={infoUsr}
                      onChange={(e) => setInfoUsr(e.target.value)}
                      placeholder="Usuario"
                      className="form-control"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Clave (PPPoE):</label>
                    <input
                      type="text"
                      value={infoPas}
                      onChange={(e) => setInfoPas(e.target.value)}
                      placeholder="Contraseña"
                      className="form-control"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Botón de Enviar */}
          <button
            type="submit"
            className="btn"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: activeArea === 'INSTALACIONES' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--primary)',
              color: 'white',
              border: 'none',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: activeArea === 'INSTALACIONES' ? '0 4px 14px rgba(99, 102, 241, 0.3)' : '0 4px 14px rgba(225, 29, 72, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-circle-check"></i>
            {activeArea === 'INSTALACIONES' ? 'Guardar Asignación de Instalación' : 'Guardar Registro de Visita'}
          </button>
        </form>
      </div>

      {/* Modal Historial de Reportes */}
      {modalHistorial.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '20px', width: '90%', maxWidth: '500px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary)' }}></i> Historial de Reportes
              </h3>
              <button 
                type="button" 
                onClick={() => setModalHistorial(prev => ({ ...prev, isOpen: false }))} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--sidebar-text)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body / Scroll area */}
            <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ marginBottom: '15px', fontSize: '0.9rem', color: 'var(--sidebar-text)' }}>
                Cliente: <strong style={{ color: 'var(--text-main)' }}>{modalHistorial.cliente}</strong>
              </div>

              {modalHistorial.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--sidebar-text)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--primary)' }}></i>
                  <span>Buscando reportes de los últimos 3 meses...</span>
                </div>
              ) : modalHistorial.lista.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#16a34a', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  ✓ Cliente sin reportes en los últimos 3 meses (Excelente).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {modalHistorial.lista.map((visita, idx) => {
                    const fecha = new Date(visita.fecha_programada).toLocaleDateString('es-ES');
                    const isFinalizada = visita.estado === 'FINALIZADA';
                    const colorEstado = isFinalizada ? '#10b981' : '#ef4444';

                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          backgroundColor: 'var(--profile-bg)', 
                          padding: '14px', 
                          borderRadius: '12px', 
                          border: '1px solid var(--border-color)', 
                          borderLeft: `4px solid ${colorEstado}` 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 'bold' }}>📅 {fecha}</span>
                          <span style={{ 
                            backgroundColor: isFinalizada ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                            color: colorEstado, 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontWeight: 800, 
                            fontSize: '0.68rem',
                            textTransform: 'uppercase'
                          }}>
                            {visita.estado.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h6 style={{ color: 'var(--text-main)', margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 800 }}>
                          Problema: <span style={{ color: '#ef4444', fontWeight: 700 }}>{visita.problema}</span>
                        </h6>
                        <p style={{ fontSize: '0.8rem', margin: '0 0 6px 0', color: 'var(--text-main)', lineHeight: '1.4' }}>
                          <strong>Solución:</strong> {visita.solucion_tecnico || 'Sin registrar'}
                        </p>
                        {visita.observacion_tecnico && (
                          <p style={{ fontSize: '0.8rem', margin: '0 0 6px 0', color: 'var(--sidebar-text)', fontStyle: 'italic', lineHeight: '1.4' }}>
                            <strong>Obs. Técnico:</strong> "{visita.observacion_tecnico}"
                          </p>
                        )}
                        <div style={{ color: 'var(--sidebar-text)', fontSize: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '6px' }}>
                          Técnico: <strong>{visita.tecnico_principal}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setModalHistorial(prev => ({ ...prev, isOpen: false }))} 
                style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Entendido
              </button>
            </div>

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
                    Esta identificación tiene {multiContratosList.length} servicios registrados. Selecciona cuál deseas atender:
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
                      {item.zona_excel && <span style={{ color: '#0284c7', fontWeight: 700 }}> ({item.zona_excel})</span>}
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

export default RegistroVisitasTab;

