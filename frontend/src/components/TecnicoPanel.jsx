import React, { useState, useEffect, useRef } from 'react';

function TecnicoPanel({ token, user, tecnicoNombreParam, onLogout }) {
  const tecnicoName = tecnicoNombreParam || user?.nombre || '';
  const tecnicoUrlName = tecnicoName.replace(/ /g, '_');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Panel Data
  const [visitas, setVisitas] = useState([]);
  const [tecnicoRealName, setTecnicoRealName] = useState(tecnicoName);
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [estadoActividad, setEstadoActividad] = useState('Disponible');
  const [areaTrabajo, setAreaTrabajo] = useState('SOPORTE');
  const [alertaPanico, setAlertaPanico] = useState(false);
  const [mensajePanico, setMensajePanico] = useState('');
  const [numeroGrua, setNumeroGrua] = useState('0958672088');
  
  // Catalogs
  const [soluciones, setSoluciones] = useState([]);
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [catalogoOnt, setCatalogoOnt] = useState([]);
  const [catalogoRouter, setCatalogoRouter] = useState([]);
  
  // Active Visit Details Overlay
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeVisita, setActiveVisita] = useState(null); // Visita object
  const [activeSubTab, setActiveSubTab] = useState('tab-cliente'); // 'tab-cliente' | 'tab-nodo' | 'tab-acciones'

  // OLT Measurement State
  const [oltLoading, setOltLoading] = useState(false);
  const [oltResult, setOltResult] = useState(null);

  // Client History Modal State
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialCliente, setHistorialCliente] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [nombreClienteHistorial, setNombreClienteHistorial] = useState('');

  // Panic Modal State
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [motivoPanic, setMotivoPanic] = useState('Vehículo Varado (Falla Mecánica)');
  const [motivoPanicOtro, setMotivoPanicOtro] = useState('');

  // Posponer Modal State
  const [showPosponerModal, setShowPosponerModal] = useState(false);
  const [posponerVisitaId, setPosponerVisitaId] = useState(null);
  const [motivoPosponer, setMotivoPosponer] = useState('Cliente ausente');
  const [motivoPosponerOtro, setMotivoPosponerOtro] = useState('');

  // QR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [qrClienteName, setQrClienteName] = useState('');

  // Traspaso Modal State
  const [showTraspasoModal, setShowTraspasoModal] = useState(false);
  const [tecnicosLista, setTecnicosLista] = useState([]);
  const [traspasoForm, setTraspasoForm] = useState({ tecnico_destino_nombre: '', id_material: '', cantidad: '' });
  const [traspasoLoading, setTraspasoLoading] = useState(false);

  const handleTraspasoSubmit = async (e) => {
    if (e) e.preventDefault();
    const { tecnico_destino_nombre, id_material, cantidad } = traspasoForm;
    if (!tecnico_destino_nombre || !id_material || !cantidad || parseInt(cantidad) <= 0) {
      alert("Por favor completa los datos requeridos para el traspaso.");
      return;
    }
    setTraspasoLoading(true);
    try {
      const res = await fetch('/api/tecnico/traspaso_material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tecnico_destino_nombre,
          id_material: parseInt(id_material),
          cantidad: parseInt(cantidad)
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Traspaso registrado exitosamente.");
        setShowTraspasoModal(false);
        setTraspasoForm({ tecnico_destino_nombre: '', id_material: '', cantidad: '' });
        await cargarDatosPanel();
      } else {
        alert("Error al traspasar: " + (data.message || "No se pudo realizar la transacción"));
      }
    } catch (err) {
      console.error("Error en traspaso:", err);
      alert("Error de conexión al realizar traspaso.");
    } finally {
      setTraspasoLoading(false);
    }
  };

  // Work Tab Forms State (indexed by visit ID)
  const [formCierre, setFormCierre] = useState({}); // { [visitaId]: { solucion_tecnico, observacion_tecnico, modelo_onu, modelo_router, metodo_firma, motivo_sin_firma, coordenadas_tecnico, equipos_juntos: true, foto_equipos_base64, foto_equipos_2_base64, foto_extra_1_base64, foto_extra_2_base64, foto_extra_3_base64, foto_extra_4_base64, firma_cliente_base64, materiales: [] } }

  // Canvas Ref for Signature Drawing
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load panel data
  useEffect(() => {
    cargarDatosPanel();
    
    // Auto-Ping interval (every 30 seconds)
    const pingInterval = setInterval(() => {
      enviarPingGeolocalizacion();
    }, 30000);
    
    return () => clearInterval(pingInterval);
  }, [tecnicoName]);

  // Manage body class for responsive mobile styling
  useEffect(() => {
    document.body.classList.add('body-tecnico');
    return () => {
      document.body.classList.remove('body-tecnico');
    };
  }, []);

  // Handle signature verification interval when waiting for Remote Signature
  useEffect(() => {
    let intervalId;
    if (activeVisita && activeVisita.estado === 'EN_PROGRESO') {
      const form = getFormState(activeVisita.id_visita);
      if (form.metodo_firma === 'REMOTA' && form.firma_recibida !== '1') {
        intervalId = setInterval(() => {
          verificarFirmaRemota(activeVisita.id_visita);
        }, 5000);
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeVisita, formCierre]);

  const cargarDatosPanel = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tecnico/panel/${tecnicoUrlName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setVisitas(data.visitas || []);
        setTecnicoRealName(data.tecnico);
        setFotoPerfil(data.foto_perfil || '');
        setEstadoActividad(data.estado_actividad);
        setAreaTrabajo(data.area_trabajo);
        setAlertaPanico(data.alerta_panico === 1 || data.alerta_panico === true);
        setMensajePanico(data.mensaje_panico || '');
        setNumeroGrua(data.numero_grua || '0958672088');
        
        setSoluciones(data.soluciones || []);
        setCatalogoMateriales(data.catalogo || []);
        setCatalogoOnt(data.catalogo_ont || []);
        setCatalogoRouter(data.catalogo_router || []);
        setTecnicosLista(data.tecnicos_lista || []);
        
        // Initialize form closures state, preserving any user input in progress
        setFormCierre(prev => {
          const nextForm = { ...prev };
          (data.visitas || []).forEach(v => {
            if (!nextForm[v.id_visita]) {
              nextForm[v.id_visita] = {
                solucion_tecnico: v.solucion_tecnico || '',
                observacion_tecnico: v.observacion_tecnico || '',
                modelo_onu: v.modelo_onu || v.modelo_ont || '',
                modelo_router: v.modelo_router || v.router_principal || '',
                numero_serie_onu: '',
                router_secundario: v.router_secundario || '',
                metodo_firma: 'REMOTA',
                motivo_sin_firma: 'TRABAJO_EXTERNO',
                coordenadas_tecnico: v.coordenadas_tecnico || '',
                equipos_juntos: true,
                foto_equipos_base64: '',
                foto_equipos_2_base64: '',
                firma_cliente_base64: '',
                firma_recibida: '0',
                foto_extra_1_base64: '',
                foto_extra_2_base64: '',
                foto_extra_3_base64: '',
                foto_extra_4_base64: '',
                materiales: []
              };

            }
          });
          return nextForm;
        });
      } else {
        setError(data.message || 'Error al obtener información de visitas.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con la API del panel técnico.');
    } finally {
      setLoading(false);
    }
  };

  const defaultFormState = {
    solucion_tecnico: '',
    observacion_tecnico: '',
    modelo_onu: '',
    modelo_router: '',
    metodo_firma: 'REMOTA',
    motivo_sin_firma: 'TRABAJO_EXTERNO',
    coordenadas_tecnico: '',
    equipos_juntos: true,
    foto_equipos_base64: '',
    foto_equipos_2_base64: '',
    firma_cliente_base64: '',
    firma_recibida: '0',
    foto_extra_1_base64: '',
    foto_extra_2_base64: '',
    foto_extra_3_base64: '',
    foto_extra_4_base64: '',
    materiales: []
  };

  const getFormState = (id) => {
    return formCierre[id] || defaultFormState;
  };

  const updateFormState = (id, fields) => {
    setFormCierre(prev => {
      const current = prev[id] || defaultFormState;
      return {
        ...prev,
        [id]: {
          ...current,
          ...fields
        }
      };
    });
  };

  const activeFormState = activeVisita ? getFormState(activeVisita.id_visita) : defaultFormState;

  // GPS Auto-Ping

  const enviarPingGeolocalizacion = () => {
    if (estadoActividad === 'En Descanso') {
      console.log("El técnico está en descanso. Saltando ping.");
      return;
    }

    if (window.AndroidBridge) {
      console.log("Solicitando ping global nativo Android...");
      try {
        window.AndroidBridge.requestSingleLocation("global");
      } catch (e) {
        console.error("Error al llamar requestSingleLocation nativo:", e);
        solicitarPingHTML5();
      }
    } else {
      solicitarPingHTML5();
    }
  };

  const solicitarPingHTML5 = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await fetch('/api/tecnico/ping_global', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                latitud: position.coords.latitude,
                longitud: position.coords.longitude,
                tecnico_nombre: tecnicoRealName
              })
            });
          } catch (err) {
            console.error('Error enviando ping global HTML5:', err);
          }
        },
        (err) => console.log('Ubicación HTML5 denegada o no disponible para ping: ' + err.message),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  };

  // Register native callback hook on window object for Android app interaction
  useEffect(() => {
    window.recibirUbicacionNativa = async (tipo, lat, lon) => {
      console.log("Recibida ubicación nativa desde Android:", tipo, lat, lon);
      if (tipo === 'global') {
        if (estadoActividad === 'En Descanso') {
          console.log("El técnico está en descanso. Saltando ping nativo.");
          return;
        }
        try {
          await fetch('/api/tecnico/ping_global', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              latitud: lat,
              longitud: lon,
              tecnico_nombre: tecnicoRealName
            })
          });
        } catch (err) {
          console.error("Error al enviar ping nativo:", err);
        }
      } else if (tipo && tipo.toString().startsWith('inicio_')) {
        if (window.recibirUbicacionNativaInicio) {
          window.recibirUbicacionNativaInicio(lat, lon);
        }
      } else {
        const visitaId = parseInt(tipo);
        if (!isNaN(visitaId)) {
          const c = `${lat}, ${lon}`;
          updateFormState(visitaId, { coordenadas_tecnico: c });
          alert(`Ubicación nativa capturada por GPS: ${c}`);
        }
      }
    };

    return () => {
      delete window.recibirUbicacionNativa;
    };
  }, [token, tecnicoRealName, estadoActividad]);

  // --- OLT SmartOLT Live Diagnosis ---
  const ejecutarMedicionOLT = async (sn) => {
    if (!sn || sn.trim() === '' || sn === 'S/N' || sn === 'None') {
      alert("Esta visita no tiene un número de serie (SN) registrado para consultar en la OLT.");
      return;
    }
    setOltLoading(true);
    setOltResult(null);
    try {
      const res = await fetch(`/api/admin/smartolt/diagnostico/${encodeURIComponent(sn.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setOltResult(data.diagnostico);
      } else {
        alert(data.message || 'Error al obtener diagnóstico de la OLT.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    } finally {
      setOltLoading(false);
    }
  };

  const getPowerRangeValues = (dbmStr) => {
    if (!dbmStr || dbmStr === 'N/D') return { pct: 0, color: 'rgba(255,255,255,0.1)', text: 'N/D' };
    const val = parseFloat(dbmStr.replace(/[^\d.-]/g, ''));
    if (isNaN(val)) return { pct: 0, color: 'rgba(255,255,255,0.1)', text: dbmStr };
    
    if (val >= -25.99 && val <= -15.00) {
      return { pct: 85, color: '#10b981', text: `🟢 Excelente (${val} dBm)` };
    } else if (val >= -28.99 && val <= -26.00) {
      return { pct: 55, color: '#f59e0b', text: `🟡 Atenuado (${val} dBm)` };
    } else {
      return { pct: 25, color: '#ef4444', text: `🔴 Crítico (${val} dBm)` };
    }
  };

  // --- Activity break shift ---
  const toggleDescanso = async () => {
    const proximaAccion = estadoActividad === 'En Descanso' ? 'terminar' : 'iniciar';
    try {
      const res = await fetch('/api/tecnico/descanso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          accion: proximaAccion,
          tecnico_nombre: tecnicoRealName 
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setEstadoActividad(data.estado);
      } else {
        alert(data.message || 'Error al modificar estado de descanso.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  // --- Work Area ---
  const cambiarAreaTrabajo = async (area) => {
    try {
      const res = await fetch('/api/tecnico/area_trabajo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          area_trabajo: area,
          tecnico_nombre: tecnicoRealName
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setAreaTrabajo(data.area_trabajo);
        await cargarDatosPanel();
      } else {
        alert(data.message || 'Error al cambiar área de trabajo.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  // --- Emergency / Panic Alerter ---
  const activarPanicAlerta = async () => {
    const msgFinal = motivoPanic === 'Otro motivo de emergencia' ? motivoPanicOtro : motivoPanic;
    if (!msgFinal.trim()) {
      alert('Por favor especifique el motivo.');
      return;
    }
    try {
      const res = await fetch('/api/tecnico/panico/activar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          mensaje: msgFinal,
          tecnico_nombre: tecnicoRealName
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setAlertaPanico(true);
        setMensajePanico(data.mensaje);
        setShowPanicModal(false);
        setMotivoPanic('Vehículo Varado (Falla Mecánica)');
        setMotivoPanicOtro('');
      } else {
        alert(data.message || 'Error al activar botón de pánico.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const desactivarPanicAlerta = async () => {
    try {
      const res = await fetch('/api/tecnico/panico/desactivar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tecnico_nombre: tecnicoRealName
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setAlertaPanico(false);
        setMensajePanico('');
      } else {
        alert(data.message || 'Error al desactivar pánico.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  // --- Customer historical visits ---
  const consultarHistorialCliente = async (nombreCliente, contrato = '') => {
    setNombreClienteHistorial(nombreCliente);
    setLoadingHistorial(true);
    setShowHistorialModal(true);
    setHistorialCliente([]);
    try {
      const url = contrato 
        ? `/api/cliente/historial/${encodeURIComponent(nombreCliente)}?contrato=${encodeURIComponent(contrato)}`
        : `/api/cliente/historial/${encodeURIComponent(nombreCliente)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        setHistorialCliente(data.historial || []);
      } else {
        alert(data.message || 'Error al cargar historial.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    } finally {
      setLoadingHistorial(false);
    }
  };

  // --- Phone calls & Maps navigate ---
  const abrirLlamada = (telefonos) => {
    if (!telefonos) return;
    const nums = telefonos.split('/').map(x => x.trim()).filter(Boolean);
    if (nums.length === 1) {
      window.location.href = `tel:${nums[0]}`;
    } else {
      const opt = window.confirm(`Seleccione número:\nAceptar: ${nums[0]}\nCancelar: ${nums[1] || ''}`);
      if (opt) window.location.href = `tel:${nums[0]}`;
      else if (nums[1]) window.location.href = `tel:${nums[1]}`;
    }
  };

  const abrirNavegadorGPS = (direccion = '', sector = '', coordenadas = '') => {
    const combinedStr = `${coordenadas || ''} ${direccion || ''}`;
    // Extract pure latitude and longitude numbers if present
    const regex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const match = combinedStr.match(regex);

    let query = '';
    if (match) {
      // Send ONLY pure lat,lon coordinates to Google Maps
      query = `${match[1]},${match[2]}`;
    } else {
      // Strip any parentheses text from address if present and search address
      const cleanAddress = (direccion || '').replace(/\([^)]*\)/g, '').trim();
      query = `${cleanAddress}, ${sector || ''}, Cuenca, Ecuador`;
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(mapsUrl, '_blank');
  };

  // --- Actions and state changes ---
  const registrarVoyEnCamino = async (idVisita) => {
    try {
      const res = await fetch(`/api/tecnico/en_camino/${idVisita}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        if (window.AndroidBridge) {
          try {
            window.AndroidBridge.startTracking(idVisita.toString(), window.location.origin);
          } catch (e) {
            console.error("Error al iniciar tracking AndroidBridge:", e);
          }
        }
        await cargarDatosPanel();
        // Refresh active visit
        const resV = await fetch(`/api/tecnico/panel/${tecnicoUrlName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dV = await resV.json();
        if (dV.ok || dV.status === 'ok') {
          const fresh = (dV.visitas || []).find(x => x.id_visita === idVisita);
          if (fresh) setActiveVisita(fresh);
        }
      } else {
        alert(data.message || 'Error al cambiar estado.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const registrarLlegueTrabajo = async (idVisita) => {
    if (window.AndroidBridge) {
      try {
        window.AndroidBridge.stopTracking();
      } catch (e) {
        console.error("Error al detener tracking en registrarLlegueTrabajo:", e);
      }
    }

    // Get GPS coords first
    let lat = null, lon = null;
    if (navigator.geolocation) {
      const pos = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000 });
      });
      if (pos) {
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }
    }
    
    try {
      const res = await fetch(`/api/tecnico/iniciar/${idVisita}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitud_inicio: lat,
          longitud_inicio: lon
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        await cargarDatosPanel();
        // Refresh active visit
        const resV = await fetch(`/api/tecnico/panel/${tecnicoUrlName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dV = await resV.json();
        if (dV.ok || dV.status === 'ok') {
          const fresh = (dV.visitas || []).find(x => x.id_visita === idVisita);
          if (fresh) setActiveVisita(fresh);
        }
      } else {
        alert(data.message || 'Error al cambiar estado.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const captureGPSCoordinates = (visitaId) => {
    if (window.AndroidBridge) {
      try {
        window.AndroidBridge.requestSingleLocation(visitaId.toString());
        return;
      } catch (e) {
        console.error("Error al solicitar ubicación única AndroidBridge:", e);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const c = `${position.coords.latitude}, ${position.coords.longitude}`;
          updateFormState(visitaId, { coordenadas_tecnico: c });
          alert(`Ubicación capturada: ${c}`);
        },
        (err) => {
          alert('No se pudo capturar la ubicación por GPS. Por favor verifique los permisos de su navegador.');
        }
      );
    }
  };

  // Posponer
  const posponerVisitaSubmit = async (e) => {
    e.preventDefault();
    const motivoFinal = motivoPosponer === 'Otro motivo' ? motivoPosponerOtro : motivoPosponer;
    if (!motivoFinal.trim()) {
      alert('Especifique el motivo.');
      return;
    }
    try {
      const res = await fetch(`/api/tecnico/posponer/${posponerVisitaId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          motivo: motivoFinal,
          tecnico_nombre: tecnicoRealName
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        if (window.AndroidBridge) {
          try {
            window.AndroidBridge.stopTracking();
          } catch (e) {
            console.error("Error al detener tracking en posponerVisitaSubmit:", e);
          }
        }
        setShowPosponerModal(false);
        setActiveVisita(null);
        await cargarDatosPanel();
      } else {
        alert(data.message || 'Error al posponer visita.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  // --- Photo compression and Base64 Conversion helper ---
  const comprimirYConvertirFoto = (visitaId, fileInput, key, previewId) => {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Draw to a canvas to compress
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Max size constraint (1024px)
        const MAX_SIZE = 1024;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export to Base64 JPEG with 0.75 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        
        // Set state
        updateFormState(visitaId, { [`${key}_base64`]: compressedBase64 });
        
        // Preview
        const preview = document.getElementById(previewId);
        if (preview) {
          preview.src = compressedBase64;
          preview.style.display = 'block';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- Normalizador y Escáner GPON SN ---
  const normalizarGponSn = (snRaw) => {
    if (!snRaw) return '';
    let sn = snRaw.trim().toUpperCase();
    const VENDOR_HEX_MAP = {
      '43444B54': 'CDKT', // C-Data / Kingtype
      '48575443': 'HWTC', // Huawei
      '54504C47': 'TPLG', // TP-Link
      '5A544547': 'ZTEG', // ZTE
      '46485454': 'FHTT', // Fiberhome
      '414C434C': 'ALCL', // Alcatel / Nokia
      '56534F4C': 'VSOL', // V-Sol
    };
    if (sn.length === 16) {
      const prefix8 = sn.substring(0, 8);
      if (VENDOR_HEX_MAP[prefix8]) {
        return VENDOR_HEX_MAP[prefix8] + sn.substring(8);
      }
      try {
        let ascii = '';
        for (let i = 0; i < 8; i += 2) {
          ascii += String.fromCharCode(parseInt(prefix8.substr(i, 2), 16));
        }
        if (/^[A-Z0-9]{4}$/i.test(ascii)) {
          return ascii.toUpperCase() + sn.substring(8);
        }
      } catch (e) {}
    }
    return sn;
  };

  const procesarFotoBarcode = async (file, visitaId) => {
    if (!file) return;
    try {
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'data_matrix', 'ean_13', 'ean_8']
        });
        const img = await createImageBitmap(file);
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          const snFormateado = normalizarGponSn(raw);
          updateFormState(visitaId, { numero_serie_onu: snFormateado });
          alert(`¡Código escaneado con éxito!\nDetectado: ${raw}\nSerie GPON: ${snFormateado}`);
          return;
        }
      }
      alert("No se pudo detectar automáticamente el código en la foto. Ingrésalo manualmente y el sistema lo convertirá.");
    } catch (err) {
      console.error("Error escaneando código de barras:", err);
      alert("No se pudo leer el código. Ingrésalo manualmente.");
    }
  };

  // --- Drawing / Signature Canvas ---

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse and touch
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startSignatureDrawing = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a'; // dark line
    ctx.lineCap = 'round';
    
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const drawSignatureLine = (e) => {
    if (!isDrawing) return;
    if (e && e.preventDefault) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const pos = getCanvasPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopSignatureDrawing = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsDrawing(false);
  };

  // Registrar listeners nativos con passive: false para bloquear gestos del navegador al firmar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      startSignatureDrawing(e);
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      drawSignatureLine(e);
    };
    const handleTouchEnd = (e) => {
      e.preventDefault();
      stopSignatureDrawing(e);
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [activeFormState?.metodo_firma, activeVisita?.id_visita, isDrawing]);

  const limpiarCanvasFirma = (visitaId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateFormState(visitaId, { firma_cliente_base64: '' });
  };

  const guardarFirmaDirecta = (visitaId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Verify if drawing is blank
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert("El panel de firma está en blanco. Por favor firme antes de guardar.");
      return;
    }
    
    const b64 = canvas.toDataURL('image/png');
    updateFormState(visitaId, { 
      firma_cliente_base64: b64, 
      firma_recibida: '1' 
    });
    alert("Firma capturada y guardada con éxito.");
  };

  // --- Remote Signature verification poll ---
  const verificarFirmaRemota = async (idVisita) => {
    try {
      const res = await fetch(`/api/tecnico/verificar_firma/${idVisita}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'firmado') {
        updateFormState(idVisita, { 
          firma_recibida: '1',
          firma_cliente_base64: data.firma_url // Store signature URL or confirmation
        });
      }
    } catch (err) {
      console.log('Error al verificar firma remota:', err);
    }
  };

  const getPublicDomain = () => {
    return 'http://atlas.futurity.com.ec:7565';
  };

  const enviarLinkFirmaWhatsApp = (telefonos, tecnico, tokenRastreo) => {
    if (!telefonos) return;
    const cleanTel = telefonos.split('/')[0].trim().replace(/[^\d+]/g, '');
    const msg = `Hola! Soy ${tecnico}, tu técnico asignado. Por favor, ingresa a este enlace para firmar tu conformidad del trabajo: ${getPublicDomain()}/firma-remota/${tokenRastreo}`;
    window.open(`https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const mostrarQRDeFirma = (tokenRastreo, clienteName) => {
    setQrToken(tokenRastreo);
    setQrClienteName(clienteName);
    setShowQRModal(true);
  };

  // --- Dynamic Materials List ---
  const addMaterialRow = (visitaId) => {
    if (catalogoMateriales.length === 0) return;
    const form = getFormState(visitaId);
    const item = {
      id_material: catalogoMateriales[0].id_material.toString(),
      cantidad: '1'
    };
    updateFormState(visitaId, {
      materiales: [...form.materiales, item]
    });
  };

  const removeMaterialRow = (visitaId, idx) => {
    const form = getFormState(visitaId);
    const filtered = form.materiales.filter((_, i) => i !== idx);
    updateFormState(visitaId, { materiales: filtered });
  };

  const updateMaterialRow = (visitaId, idx, fields) => {
    const form = getFormState(visitaId);
    const updated = form.materiales.map((m, i) => i === idx ? { ...m, ...fields } : m);
    updateFormState(visitaId, { materiales: updated });
  };

  // WhatsApp client arrival notification
  const abrirWhatsApp = (telefonos, tecnico, tokenRastreo) => {
    if (!telefonos) return;
    const cleanTel = telefonos.split('/')[0].trim().replace(/[^\d+]/g, '');
    const msg = `Estimado cliente, le saluda ${tecnico}. Le informo que ya voy en camino a su domicilio para realizar el trabajo. Puede seguir mi trayecto en tiempo real ingresando aquí: ${getPublicDomain()}/seguimiento/${tokenRastreo}`;
    window.open(`https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- FINALIZE WORK SUBMIT ---
  const handleFinalizeSubmit = async (e, idVisita) => {
    e.preventDefault();
    const form = getFormState(idVisita);
    
    // Validate Signature
    if (form.metodo_firma !== 'SIN_FIRMA' && form.firma_recibida !== '1') {
      alert("No se puede finalizar la visita sin capturar o recibir la firma de conformidad del cliente.");
      return;
    }
    
    if (!form.solucion_tecnico) {
      alert("Por favor seleccione la solución aplicada.");
      return;
    }
    
    if (!form.observacion_tecnico.trim()) {
      alert("Por favor detalle lo realizado en la observación.");
      return;
    }
    
    if (!form.coordenadas_tecnico) {
      alert("Por favor capture sus coordenadas GPS para el cierre.");
      return;
    }
    
    // Enforce base64 photo check
    if (!form.foto_equipos_base64 && form.equipos_juntos) {
      alert("Debe subir al menos la foto conjunta de los equipos.");
      return;
    }
    if (!form.equipos_juntos && (!form.foto_equipos_base64 || !form.foto_equipos_2_base64)) {
      alert("Debe subir tanto la foto de la ONU como la foto del Router por separado.");
      return;
    }

    try {
      const payload = {
        solucion_tecnico: form.solucion_tecnico,
        observacion_tecnico: form.observacion_tecnico,
        modelo_onu: form.modelo_onu,
        modelo_router: form.modelo_router,
        numero_serie_onu: form.numero_serie_onu ? normalizarGponSn(form.numero_serie_onu) : null,
        router_secundario: form.router_secundario || null,
        coordenadas_tecnico: form.coordenadas_tecnico,
        metodo_firma: form.metodo_firma,
        motivo_sin_firma: form.motivo_sin_firma,
        equipos_juntos: form.equipos_juntos ? '1' : '0',
        foto_equipos_base64: form.foto_equipos_base64,
        foto_equipos_2_base64: form.foto_equipos_2_base64,
        firma_cliente_base64: form.firma_cliente_base64,
        foto_extra_1_base64: form.foto_extra_1_base64,
        foto_extra_2_base64: form.foto_extra_2_base64,
        foto_extra_3_base64: form.foto_extra_3_base64,
        foto_extra_4_base64: form.foto_extra_4_base64,
        materiales: form.materiales.map(m => ({ id_material: parseInt(m.id_material), cantidad: parseInt(m.cantidad) }))
      };

      
      const res = await fetch(`/api/tecnico/finalizar/${idVisita}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert('Visita finalizada y registrada con éxito.');
        if (window.AndroidBridge) {
          try {
            window.AndroidBridge.stopTracking();
          } catch (e) {
            console.error("Error al detener tracking en handleFinalizeSubmit:", e);
          }
        }
        setActiveVisita(null);
        await cargarDatosPanel();
      } else {
        alert(data.message || 'Error al guardar el cierre de visita.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el servidor.');
    }
  };

  return (

    <div className="panel-container tecnico-scroll-container" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overscrollBehaviorY: 'none', overscrollBehavior: 'none', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
      
      {/* Clean Top Header (100% Mobile Responsive) */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '14px 16px',
        marginBottom: '16px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Top Bar: Avatar + Name + Menu Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div 
              onClick={() => setShowProfileModal(true)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 900,
                fontSize: '1.2rem',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                position: 'relative',
                flexShrink: 0,
                cursor: 'pointer'
              }}
            >
              {fotoPerfil && fotoPerfil !== 'default_avatar.png' ? (
                <img 
                  src={`/static/uploads/${fotoPerfil}`} 
                  alt={tecnicoRealName} 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                tecnicoRealName ? tecnicoRealName.charAt(0).toUpperCase() : 'T'
              )}
              <span style={{
                position: 'absolute',
                bottom: '1px',
                right: '1px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: estadoActividad === 'En Descanso' ? '#f59e0b' : '#10b981',
                border: '2px solid #0f172a'
              }}></span>
            </div>
            
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Hola, {tecnicoRealName}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-text)', fontWeight: 600, display: 'block', marginTop: '1px' }}>
                {areaTrabajo === 'INSTALACIONES' ? '🔌 Instalaciones' : '🛠️ Soporte Técnico'}
              </span>
            </div>
          </div>

          {/* Menu Button (Top Right Icon/Badge) */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            title="Perfil y Menú"
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--profile-bg)',
              color: 'var(--profile-text)',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-gear"></i>
            <span>Menú</span>
          </button>
        </div>

        {/* Status indicator bar & area toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', gap: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: estadoActividad === 'En Descanso' ? '#f59e0b' : '#10b981',
              flexShrink: 0
            }}></span>
            <span style={{ 
              fontSize: '0.8rem', 
              fontWeight: 800, 
              color: estadoActividad === 'En Descanso' ? '#f59e0b' : '#10b981',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0
            }} title={estadoActividad}>
              {estadoActividad}
            </span>
          </div>

          <button 
            type="button" 
            onClick={cargarDatosPanel} 
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            <span>Actualizar</span>
          </button>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="main-content" style={{ width: '100%', padding: 0 }}>

        {/* List of visits */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '12px' }}></i>
            <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 700 }}>Cargando agenda de hoy...</p>
          </div>
        ) : visitas.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <i className="fa-solid fa-calendar-check" style={{ fontSize: '3rem', color: 'var(--sidebar-text)', marginBottom: '15px', opacity: 0.4 }}></i>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 800 }}>No hay visitas pendientes</h3>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--sidebar-text)', fontWeight: 500 }}>
              {areaTrabajo === 'INSTALACIONES' ? 'No tienes instalaciones asignadas para hoy.' : 'No tienes visitas de soporte técnico asignadas para hoy.'} ¡Buen trabajo!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {visitas.map((v) => {
              const borderLeftColor = 
                v.estado === 'EN_RUTA' ? '#f59e0b' : 
                v.estado === 'EN_PROGRESO' ? '#3b82f6' : 
                v.estado === 'FINALIZADA' ? '#10b981' : '#94a3b8';
              
              return (
                <div 
                  key={v.id_visita} 
                  onClick={() => {
                    setActiveVisita(v);
                    setActiveSubTab('tab-cliente');
                    setOltResult(null);
                  }}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderLeft: `6px solid ${borderLeftColor}`, borderRadius: '14px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.15s ease', position: 'relative' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: '25px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 850, color: 'var(--text-main)' }}>
                        {v.es_instalacion === 1 ? `🔌 Instalación #${v.numero_parada}` : `🎫 Ticket #${v.numero_parada}`}
                      </h4>
                      <small style={{ color: 'var(--sidebar-text)', fontWeight: 600 }}>Ref: #VT-{v.id_visita}</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: v.estado === 'FINALIZADA' ? 'rgba(16, 185, 129, 0.15)' : v.estado === 'EN_PROGRESO' ? 'rgba(59, 130, 246, 0.15)' : v.estado === 'EN_RUTA' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: v.estado === 'FINALIZADA' ? '#10b981' : v.estado === 'EN_PROGRESO' ? '#3b82f6' : v.estado === 'EN_RUTA' ? '#f59e0b' : '#64748b' }}>
                        {v.estado.replace(/_/g, ' ')}
                      </span>
                      {v.prioridad === 'ALTA' && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>🔴 URGENTE</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <small style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Cliente</small>
                    <span style={{ fontSize: '0.95rem', fontWeight: 750, color: 'var(--text-main)' }}>{v.cliente}</span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <small style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Motivo</small>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: v.es_instalacion === 1 ? '#3b82f6' : '#dc2626' }}>
                        {v.es_instalacion === 1 ? `🔌 ${v.servicio}` : `🛠️ ${v.problema}`}
                      </span>
                    </div>
                  </div>

                  {/* Right indicator arrow */}
                  <div style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)', fontSize: '0.95rem' }}>
                    <i className="fa-solid fa-chevron-right"></i>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* FULLSCREEN VISIT DETAILS OVERLAY */}
      {activeVisita && (
        <div className="tecnico-scroll-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#0f172a', zIndex: 99999, display: 'flex', flexDirection: 'column', color: '#f8fafc', overscrollBehaviorY: 'contain', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
          
          {/* Header */}
          <div style={{ background: '#1e293b', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <button 
              type="button" 
              onClick={() => setActiveVisita(null)} 
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '6px' }}
            >
              <i className="fa-solid fa-chevron-left"></i> Volver
            </button>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
              {activeVisita.es_instalacion === 1 ? `🔌 Inst. #${activeVisita.numero_parada}` : `🎫 Ticket #${activeVisita.numero_parada}`}
            </span>

            <div style={{ width: '70px' }}></div>
          </div>

          {/* Sub tabs nav */}
          <div style={{ background: '#1e293b', display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <button 
              type="button" 
              onClick={() => setActiveSubTab('tab-cliente')} 
              className={`tab-btn ${activeSubTab === 'tab-cliente' ? 'active' : ''}`}
              style={{ flex: 1, background: 'transparent', border: 'none', padding: '14px 6px', color: activeSubTab === 'tab-cliente' ? '#38bdf8' : '#94a3b8', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', borderBottom: `3px solid ${activeSubTab === 'tab-cliente' ? '#38bdf8' : 'transparent'}` }}
            >
              <i className="fa-solid fa-user" style={{ marginRight: '4px' }}></i> CLIENTE
            </button>
            <button 
              type="button" 
              onClick={() => setActiveSubTab('tab-nodo')} 
              className={`tab-btn ${activeSubTab === 'tab-nodo' ? 'active' : ''}`}
              style={{ flex: 1, background: 'transparent', border: 'none', padding: '14px 6px', color: activeSubTab === 'tab-nodo' ? '#38bdf8' : '#94a3b8', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', borderBottom: `3px solid ${activeSubTab === 'tab-nodo' ? '#38bdf8' : 'transparent'}` }}
            >
              <i className="fa-solid fa-network-wired" style={{ marginRight: '4px' }}></i> CONEXIÓN
            </button>
            <button 
              type="button" 
              onClick={() => setActiveSubTab('tab-acciones')} 
              className={`tab-btn ${activeSubTab === 'tab-acciones' ? 'active' : ''}`}
              style={{ flex: 1, background: 'transparent', border: 'none', padding: '14px 6px', color: activeSubTab === 'tab-acciones' ? '#38bdf8' : '#94a3b8', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', borderBottom: `3px solid ${activeSubTab === 'tab-acciones' ? '#38bdf8' : 'transparent'}` }}
            >
              <i className="fa-solid fa-clipboard-check" style={{ marginRight: '4px' }}></i> TRABAJO
            </button>
          </div>

          {/* Details body */}
          <div className="tecnico-overlay-content" style={{ flex: 1, overflowY: 'auto', overscrollBehaviorY: 'contain', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', padding: '20px', background: '#0f172a' }}>
            
            {/* SUB TAB 1: CLIENTE */}
            {activeSubTab === 'tab-cliente' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* General Info Card */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Información del Cliente</span>
                  
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                    <div>
                      <strong style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Nombre del Cliente</strong>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>{activeVisita.cliente}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => consultarHistorialCliente(activeVisita.cliente, activeVisita.contrato)} 
                      style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid #475569', background: 'transparent', color: '#38bdf8', cursor: 'pointer', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-clock-rotate-left"></i> Historial
                    </button>

                  </div>

                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <strong style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Contrato / Referencia</strong>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                        Contrato: {activeVisita.contrato || 'N/A'} | Ref: #VT-{activeVisita.id_visita}
                      </span>
                    </div>
                    {activeVisita.cedula && (
                      <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                        🪪 {activeVisita.cedula}
                      </span>
                    )}
                  </div>

                  {/* Commercial & Technical Summary Grid */}
                  <div style={{ marginTop: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>📦 Plan Contratado</span>
                      <strong style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.3 }}>
                        {activeVisita.servicio || activeVisita.producto || 'N/D'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>⚡ Velocidad Plan</span>
                      <strong style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 900 }}>
                        {activeVisita.velocidad_mbps !== undefined && activeVisita.velocidad_mbps !== null ? `${activeVisita.velocidad_mbps} Mbps` : (activeVisita.velocidad || 'N/D')}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>💵 Pago Mensual</span>
                      <strong style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 800 }}>
                        {activeVisita.total_mensual ? `$${parseFloat(activeVisita.total_mensual).toFixed(2)}` : 'N/D'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>⌛ Antigüedad Cliente</span>
                      <strong style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 800 }}>
                        {activeVisita.antiguedad_fmt || 'N/D'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>👤 Generado / Coordinado</span>
                      <strong style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 800 }}>
                        {activeVisita.creado_por || activeVisita.agente || 'Call Center'}
                      </strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>🏷️ Serie ONU (SN)</span>
                      <strong style={{ color: '#f59e0b', fontSize: '0.82rem', fontWeight: 700, wordBreak: 'break-all' }}>
                        {activeVisita.numero_serie || 'S/N'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Telephone */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div>
                    <strong style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Teléfono(s)</strong>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>{activeVisita.telefonos || 'No registrado'}</span>
                  </div>
                  {activeVisita.telefonos && (
                    <button 
                      type="button" 
                      onClick={() => abrirLlamada(activeVisita.telefonos)} 
                      style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <i className="fa-solid fa-phone"></i> Llamar
                    </button>
                  )}
                </div>

                {/* Address */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ flexGrow: 1, paddingRight: '10px' }}>
                    <strong style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Dirección / Ubicación</strong>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>{activeVisita.direccion} ({activeVisita.sector})</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => abrirNavegadorGPS(activeVisita.direccion, activeVisita.sector, activeVisita.coordenadas)} 
                    style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
                  >
                    <i className="fa-solid fa-map-location-dot"></i> Ir al Mapa
                  </button>
                </div>

                {/* Motivo Principal Card (Psicología del Color - Alto Impacto Visual) */}
                <div style={{
                  background: activeVisita.es_instalacion === 1 
                    ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.22) 0%, rgba(3, 105, 161, 0.35) 100%)' 
                    : 'linear-gradient(135deg, rgba(244, 63, 94, 0.22) 0%, rgba(190, 18, 60, 0.35) 100%)',
                  border: `1px solid ${activeVisita.es_instalacion === 1 ? '#0284c7' : '#f43f5e'}`,
                  borderRadius: '16px',
                  padding: '18px 20px',
                  boxShadow: activeVisita.es_instalacion === 1 
                    ? '0 6px 20px rgba(2, 132, 199, 0.25)' 
                    : '0 6px 20px rgba(244, 63, 94, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: activeVisita.es_instalacion === 1 ? '#7dd3fc' : '#fda4af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className={activeVisita.es_instalacion === 1 ? "fa-solid fa-plug" : "fa-solid fa-triangle-exclamation"}></i>
                      MOTIVO PRINCIPAL DE LA VISITA
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '3px 10px', borderRadius: '20px', background: activeVisita.es_instalacion === 1 ? '#0284c7' : '#e11d48', color: '#ffffff' }}>
                      {activeVisita.es_instalacion === 1 ? 'INSTALACIÓN' : 'SOPORTE TÉCNICO'}
                    </span>
                  </div>
                  <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.2rem', lineHeight: '1.3', marginTop: '4px' }}>
                    {activeVisita.es_instalacion === 1 ? activeVisita.servicio : activeVisita.problema}
                  </span>
                </div>

                {/* Comentario del Call Center (Psicología del Color - Alerta Ámbar Calibrado) */}
                {activeVisita.observacion_callcenter && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(180, 83, 9, 0.28) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    borderLeft: '6px solid #f59e0b',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-comment-dots" style={{ fontSize: '1rem', color: '#f59e0b' }}></i>
                      COMENTARIO DE CALL CENTER / ASESOR
                    </span>
                    <p style={{ margin: 0, fontSize: '0.96rem', color: '#fef3c7', fontWeight: 700, lineHeight: 1.5, fontStyle: 'normal' }}>
                      "{activeVisita.observacion_callcenter}"
                    </p>
                  </div>
                )}

                {/* Comentario de Resolución / Cancelación / Solución Remota en Panel Técnico */}
                {activeVisita.resolucion_final && (
                  <div style={{
                    background: activeVisita.estado === 'SOLVENTADA_REMOTA' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.28) 100%)' : activeVisita.estado === 'CANCELADA' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.28) 100%)' : 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(29, 78, 216, 0.28) 100%)',
                    border: activeVisita.estado === 'SOLVENTADA_REMOTA' ? '1px solid rgba(16, 185, 129, 0.5)' : activeVisita.estado === 'CANCELADA' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(59, 130, 246, 0.5)',
                    borderLeft: activeVisita.estado === 'SOLVENTADA_REMOTA' ? '6px solid #10b981' : activeVisita.estado === 'CANCELADA' ? '6px solid #ef4444' : '6px solid #3b82f6',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: activeVisita.estado === 'SOLVENTADA_REMOTA' ? '#6ee7b7' : activeVisita.estado === 'CANCELADA' ? '#fca5a5' : '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className={`fa-solid ${activeVisita.estado === 'SOLVENTADA_REMOTA' ? 'fa-laptop-code' : activeVisita.estado === 'CANCELADA' ? 'fa-ban' : 'fa-clipboard-check'}`} style={{ fontSize: '1rem' }}></i>
                      {activeVisita.estado === 'SOLVENTADA_REMOTA' ? 'SOLUCIÓN REMOTA / CIERRE' : activeVisita.estado === 'CANCELADA' ? 'MOTIVO DE CANCELACIÓN' : 'RESOLUCIÓN / NOTA DE CIERRE'}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.96rem', color: '#ffffff', fontWeight: 700, lineHeight: 1.5 }}>
                      "{activeVisita.resolucion_final}"
                    </p>
                  </div>
                )}

              </div>
            )}

            {/* SUB TAB 2: CONEXIÓN */}
            {activeSubTab === 'tab-nodo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Equipment in Home Box */}
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                    <strong style={{ color: '#34d399', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-server"></i> Equipos en Domicilio
                    </strong>
                    {activeVisita.cantidad_routers > 1 && (
                      <span style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                        {activeVisita.cantidad_routers} Equipos
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>ONT / ONU:</span>
                    <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>{activeVisita.modelo_ont || 'No especificada'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Serie ONU (SN):</span>
                    <strong style={{ color: '#fbbf24', fontSize: '0.9rem' }}>{activeVisita.numero_serie || 'S/N'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Router Principal:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{activeVisita.router_principal || 'No especificado'} {activeVisita.modo_acceso ? `(${activeVisita.modo_acceso})` : ''}</strong>
                  </div>
                  {activeVisita.router_secundario && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Router Secundario / Mesh:</span>
                      <strong style={{ color: '#a78bfa', fontSize: '0.9rem' }}>{activeVisita.router_secundario} {activeVisita.tipo_mesh ? `(${activeVisita.tipo_mesh})` : ''}</strong>
                    </div>
                  )}
                </div>

                {/* Connection Details Box */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '0.92rem', marginBottom: '4px', display: 'block' }}>🔌 Datos de Conexión en Poste / Nodo</strong>

                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Caja/NAP:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{activeVisita.info_caja || 'No registrada'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Hilo/Puerto:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{activeVisita.info_hilo || 'No registrado'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>IP Fija / Cliente:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{activeVisita.info_ip || 'No asignada'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>IP Nodo:</span>
                    <strong style={{ color: '#38bdf8', fontSize: '0.9rem' }}>{activeVisita.ip_nodo || 'No asignada'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>VLAN:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{activeVisita.info_vlan || 'No asignada'}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Usuario PPPoE:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.95rem', wordBreak: 'break-all' }}>{activeVisita.info_usr || 'No asignado'}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Clave PPPoE:</span>
                    <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{activeVisita.info_pas || 'No asignada'}</strong>
                  </div>
                </div>

                {/* SmartOLT Live Diagnosis Section */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '0.92rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-square-poll-vertical"></i> Diagnóstico de Señal OLT (En Vivo)
                  </strong>

                  {!oltResult && !oltLoading && (
                    <button 
                      type="button" 
                      onClick={() => ejecutarMedicionOLT(activeVisita.numero_serie)} 
                      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, fontSize: '0.85rem', padding: '11px 18px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-bolt"></i> Medir Potencia en Central (SmartOLT)
                    </button>
                  )}

                  {oltLoading && (
                    <div style={{ textAlignment: 'center', padding: '15px 0' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ color: '#38bdf8', fontSize: '1.8rem', marginBottom: '8px' }}></i>
                      <p style={{ margin: 0, color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem' }}>Consultando potencia de fibra en la OLT...</p>
                    </div>
                  )}

                  {oltResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>ESTADO</span>
                          <strong style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>{oltResult.estado.toUpperCase()}</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px', textAlign: 'right' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>DISTANCIA</span>
                          <strong style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>{oltResult.distancia || 'N/D'}</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>ENGANCHE (RX)</span>
                          <strong style={{ fontSize: '1rem', fontWeight: 900, color: getPowerRangeValues(oltResult.potencia_rx).color }}>{oltResult.potencia_rx || 'N/D'}</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px', textAlign: 'right' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>RETORNO (TX)</span>
                          <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#cbd5e1' }}>{oltResult.potencia_tx || 'N/D'}</strong>
                        </div>
                      </div>

                      {/* Rx Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>
                          <span>Crítico (-29 a -35)</span>
                          <span>Excelente (-15 a -25)</span>
                        </div>
                        <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${getPowerRangeValues(oltResult.potencia_rx).pct}%`, backgroundColor: getPowerRangeValues(oltResult.potencia_rx).color, transition: 'width 0.4s ease' }}></div>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: getPowerRangeValues(oltResult.potencia_rx).color, display: 'block', marginTop: '4px' }}>
                          {getPowerRangeValues(oltResult.potencia_rx).text}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Uptime de la ONU:</span>
                        <strong style={{ color: '#f8fafc' }}>{oltResult.uptime || 'N/D'}</strong>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => ejecutarMedicionOLT(activeVisita.numero_serie)} 
                        style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 700, fontSize: '0.78rem', padding: '8px', background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', marginTop: '5px' }}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i> Volver a Medir
                      </button>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* SUB TAB 3: ACCIONES / TRABAJO */}
            {activeSubTab === 'tab-acciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. PENDIENTE STATE ACTIONS */}
                {(activeVisita.estado === 'PENDIENTE' || activeVisita.estado === 'REAGENDADA') && (
                  <button 
                    type="button" 
                    onClick={() => registrarVoyEnCamino(activeVisita.id_visita)} 
                    style={{ width: '100%', padding: '14px 20px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                  >
                    <i className="fa-solid fa-truck-fast"></i> Iniciar Traslado (Voy en Camino)
                  </button>
                )}

                {/* 2. EN_RUTA STATE ACTIONS */}
                {activeVisita.estado === 'EN_RUTA' && (
                  <div style={{ backgroundColor: 'rgba(251, 191, 36, 0.04)', padding: '18px', border: '1px solid #fbbf24', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, color: '#fbbf24', fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.4 }}>
                      ⏳ En Traslado: Notifique al cliente que se encuentra en camino.
                    </p>
                    <button 
                      type="button" 
                      onClick={() => abrirWhatsApp(activeVisita.telefonos, tecnicoRealName, activeVisita.token_rastreo)} 
                      style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', background: '#25d366', color: 'white', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.15rem' }}></i> Avisar Llegada por WhatsApp
                    </button>
                    <button 
                      type="button" 
                      onClick={() => registrarLlegueTrabajo(activeVisita.id_visita)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)' }}
                    >
                      <i className="fa-solid fa-play"></i> Llegué / Iniciar Trabajo
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => {
                        setPosponerVisitaId(activeVisita.id_visita);
                        setMotivoPosponer('Cliente ausente');
                        setMotivoPosponerOtro('');
                        setShowPosponerModal(true);
                      }} 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}
                    >
                      <i className="fa-solid fa-clock"></i> Posponer para más tarde hoy
                    </button>
                  </div>
                )}

                {/* 3. EN_PROGRESO STATE ACTIONS (FORM CLOSURE) */}
                {activeVisita.estado === 'EN_PROGRESO' && (
                  <form onSubmit={(e) => handleFinalizeSubmit(e, activeVisita.id_visita)} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.05rem', color: '#38bdf8', fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' }}>
                      Cierre de {activeVisita.es_instalacion === 1 ? 'Instalación' : 'Visita Técnica'}
                    </h3>

                    {/* Solutions list */}
                    <div>
                      <label style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '6px', color: '#94a3b8' }}>Solución Técnica Aplicada:</label>
                      <select 
                        value={activeFormState.solucion_tecnico} 
                        onChange={(e) => updateFormState(activeVisita.id_visita, { solucion_tecnico: e.target.value })} 
                        required 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                      >
                        <option value="">-- Seleccione la solución --</option>
                        {activeVisita.es_instalacion === 1 ? (
                          <>
                            <option value="INSTALACION EFECTIVA">INSTALACION EFECTIVA</option>
                            <option value="SOLUCION PARCIAL">SOLUCION PARCIAL</option>
                          </>
                        ) : (
                          soluciones.map((s, idx) => <option key={idx} value={s.nombre}>{s.nombre}</option>)
                        )}
                      </select>
                    </div>

                    {/* Observations */}
                    <div>
                      <label style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '6px', color: '#94a3b8' }}>Observación del Técnico:</label>
                      <textarea 
                        value={activeFormState.observacion_tecnico} 
                        onChange={(e) => updateFormState(activeVisita.id_visita, { observacion_tecnico: e.target.value })} 
                        rows="3" 
                        required 
                        placeholder="Escriba los detalles del trabajo realizado..." 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Models ONU and Router */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '6px', color: '#94a3b8' }}>Modelo ONU:</label>
                        <select 
                          value={activeFormState.modelo_onu} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { modelo_onu: e.target.value })} 
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.82rem' }}
                        >
                          <option value="">-- Ninguna --</option>
                          {catalogoOnt.map((o, idx) => <option key={idx} value={o.nombre}>{o.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '6px', color: '#94a3b8' }}>Modelo Router:</label>
                        <select 
                          value={activeFormState.modelo_router} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { modelo_router: e.target.value })} 
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.82rem' }}
                        >
                          <option value="">-- Ninguno --</option>
                          {catalogoRouter.map((r, idx) => <option key={idx} value={r.nombre}>{r.nombre}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Escaneo y Serie de ONU */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                          🏷️ Serie ONU (SN) {activeVisita.numero_serie ? `[Actual: ${activeVisita.numero_serie}]` : ''}:
                        </label>
                        <label style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-barcode"></i> Escanear Código
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                procesarFotoBarcode(e.target.files[0], activeVisita.id_visita);
                              }
                            }}
                          />
                        </label>
                      </div>
                      <input 
                        type="text" 
                        value={activeFormState.numero_serie_onu || ''} 
                        onChange={(e) => updateFormState(activeVisita.id_visita, { numero_serie_onu: e.target.value })} 
                        onBlur={(e) => {
                          if (e.target.value) {
                            const norm = normalizarGponSn(e.target.value);
                            updateFormState(activeVisita.id_visita, { numero_serie_onu: norm });
                          }
                        }}
                        placeholder="Ej. CDKT2A187B7D o escanea código de barra"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 800, boxSizing: 'border-box' }}
                      />
                    </div>


                    {/* Materials utilized list */}
                    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '10px' }}>
                        <h6 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>🛠️ Materiales Utilizados</h6>
                        <button 
                          type="button" 
                          onClick={() => addMaterialRow(activeVisita.id_visita)} 
                          style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 850, cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-plus"></i> Añadir
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {activeFormState.materiales.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>Ningún material utilizado.</p>
                        ) : (
                          activeFormState.materiales.map((mat, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <select 
                                value={mat.id_material} 
                                onChange={(e) => updateMaterialRow(activeVisita.id_visita, idx, { id_material: e.target.value })} 
                                style={{ flex: 1, padding: '6px', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid #475569', fontSize: '0.78rem' }}
                              >
                                {catalogoMateriales.map((cm, i) => <option key={i} value={cm.id_material}>{cm.nombre_material} ({cm.unidad_medida})</option>)}
                              </select>
                              <input 
                                type="number" 
                                value={mat.cantidad} 
                                onChange={(e) => updateMaterialRow(activeVisita.id_visita, idx, { cantidad: e.target.value })} 
                                min="1" 
                                style={{ width: '60px', padding: '6px', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid #475569', fontSize: '0.78rem', textAlign: 'center' }} 
                              />
                              <button 
                                type="button" 
                                onClick={() => removeMaterialRow(activeVisita.id_visita, idx)} 
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                              >
                                &times;
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Joint Router & ONU check */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={activeFormState.equipos_juntos} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { equipos_juntos: e.target.checked })} 
                          style={{ margin: 0, transform: 'scale(1.15)' }} 
                        />
                        <span>¿ONU y Router quedaron juntos?</span>
                      </label>
                    </div>

                    {/* Photo Captures Box */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                      <strong style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '8px', color: '#94a3b8' }}>📷 Evidencia Fotográfica (Obligatorio):</strong>
                      
                      {activeFormState.equipos_juntos ? (
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Foto conjunta de ONU y Router:</label>
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, 'foto_equipos', 'preview-foto-conjunta')} 
                            style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc', borderRadius: '6px' }} 
                          />
                          <div style={{ marginTop: '8px', textAlign: 'center' }}>
                            <img id="preview-foto-conjunta" style={{ maxWidth: '100%', maxHeight: '110px', display: activeFormState.foto_equipos_base64 ? 'block' : 'none', borderRadius: '6px', margin: '0 auto', border: '1px solid #475569' }} src={activeFormState.foto_equipos_base64} alt="Preview" />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Foto de ONU:</label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, 'foto_equipos', 'preview-foto-onu')} 
                              style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc', borderRadius: '6px' }} 
                            />
                            <div style={{ marginTop: '6px', textAlign: 'center' }}>
                              <img id="preview-foto-onu" style={{ maxWidth: '100%', maxHeight: '100px', display: activeFormState.foto_equipos_base64 ? 'block' : 'none', borderRadius: '6px', margin: '0 auto', border: '1px solid #475569' }} src={activeFormState.foto_equipos_base64} alt="ONU Preview" />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Foto de Router:</label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, 'foto_equipos_2', 'preview-foto-router')} 
                              style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc', borderRadius: '6px' }} 
                            />
                            <div style={{ marginTop: '6px', textAlign: 'center' }}>
                              <img id="preview-foto-router" style={{ maxWidth: '100%', maxHeight: '100px', display: activeFormState.foto_equipos_2_base64 ? 'block' : 'none', borderRadius: '6px', margin: '0 auto', border: '1px solid #475569' }} src={activeFormState.foto_equipos_2_base64} alt="Router Preview" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Optional extra photos */}
                      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 700 }}>📷 Fotos Adicionales (Opcional - Máx 4):</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {[1, 2, 3, 4].map(idx => (
                            <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                              <label style={{ fontSize: '0.65rem', color: '#cbd5e1', display: 'block', marginBottom: '2px', fontWeight: 800 }}>Extra {idx}:</label>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, `foto_extra_${idx}`, `preview-foto-extra-${idx}`)} 
                                style={{ width: '100%', fontSize: '0.68rem', color: 'white' }} 
                              />
                              <img id={`preview-foto-extra-${idx}`} style={{ display: activeFormState[`foto_extra_${idx}_base64`] ? 'block' : 'none', maxHeight: '50px', maxWidth: '100%', borderRadius: '4px', margin: '4px auto' }} src={activeFormState[`foto_extra_${idx}_base64`]} alt="" />
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Client Conformity Signature Method */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                      <strong style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '8px', color: '#94a3b8' }}>✍️ Firma de Conformidad:</strong>
                      
                      <select 
                        value={activeFormState.metodo_firma} 
                        onChange={(e) => updateFormState(activeVisita.id_visita, { metodo_firma: e.target.value, firma_recibida: '0', firma_cliente_base64: '' })} 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: '#f8fafc', fontSize: '0.82rem', marginBottom: '12px' }}
                      >
                        <option value="REMOTA">Firma Remota (QR o WhatsApp)</option>
                        <option value="DIRECTA">Firma Directa en Celular del Técnico</option>
                        <option value="SIN_FIRMA">Finalizar sin Firma (Cliente Ausente / Externo)</option>
                      </select>

                      {/* 1. Remote Signature Option */}
                      {activeFormState.metodo_firma === 'REMOTA' && (
                        <div>
                          {activeFormState.firma_recibida === '1' ? (
                            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800, marginBottom: '10px' }}>
                              <i className="fa-solid fa-circle-check"></i> ¡Firma recibida exitosamente!
                            </div>
                          ) : (
                            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', color: '#f59e0b', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-circle-notch fa-spin"></i> Esperando firma remota del cliente...
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              type="button" 
                              onClick={() => enviarLinkFirmaWhatsApp(activeVisita.telefonos, tecnicoRealName, activeVisita.token_rastreo)} 
                              style={{ flex: 1, padding: '9px', borderRadius: '6px', border: 'none', background: '#25d366', color: 'white', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <i className="fa-brands fa-whatsapp"></i> WhatsApp
                            </button>
                            <button 
                              type="button" 
                              onClick={() => mostrarQRDeFirma(activeVisita.token_rastreo, activeVisita.cliente)} 
                              style={{ flex: 1, padding: '9px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <i className="fa-solid fa-qrcode"></i> Mostrar QR
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Direct Signature Option (Canvas) */}
                      {activeFormState.metodo_firma === 'DIRECTA' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dibuje la firma del cliente abajo:</span>
                          
                          <div className="firma-canvas-container" style={{ background: '#fafafa', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', touchAction: 'none', overscrollBehavior: 'none' }}>
                            <canvas 
                              ref={canvasRef} 
                              width={320} 
                              height={150} 
                              onMouseDown={startSignatureDrawing}
                              onMouseMove={drawSignatureLine}
                              onMouseUp={stopSignatureDrawing}
                              onMouseLeave={stopSignatureDrawing}
                              style={{ display: 'block', width: '100%', height: '150px', cursor: 'crosshair', touchAction: 'none', overscrollBehavior: 'none' }}
                            />
                          </div>
                          
                          {activeFormState.firma_recibida === '1' && (
                            <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800, textAlign: 'center' }}>
                              ✓ Firma guardada localmente
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              type="button" 
                              onClick={() => limpiarCanvasFirma(activeVisita.id_visita)} 
                              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Limpiar
                            </button>
                            <button 
                              type="button" 
                              onClick={() => guardarFirmaDirecta(activeVisita.id_visita)} 
                              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Guardar Firma
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3. Close without signature reason dropdown */}
                      {activeFormState.metodo_firma === 'SIN_FIRMA' && (
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Motivo de cierre sin firma:</label>
                          <select 
                            value={activeFormState.motivo_sin_firma} 
                            onChange={(e) => updateFormState(activeVisita.id_visita, { motivo_sin_firma: e.target.value })} 
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '0.78rem' }}
                          >
                            <option value="TRABAJO_EXTERNO">Trabajo Externo (NAP / Poste)</option>
                            <option value="CLIENTE_AUSENTE">Cliente Ausente / No contesta</option>
                            <option value="SOPORTE_REMOTO">Soporte Lógico Remoto</option>
                            <option value="TERCERA_EDAD_DISCAPACIDAD_SIN_FIRMA">Cliente de Tercera Edad (No puede firmar)</option>
                            <option value="OTROS">Otros motivos (especificar en obs.)</option>
                          </select>
                        </div>
                      )}

                    </div>

                    {/* GPS closure Coordinates capture */}
                    <div>
                      <label style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '6px', color: '#94a3b8' }}>Coordenadas de Cierre (GPS):</label>
                      <input 
                        type="text" 
                        value={activeFormState.coordenadas_tecnico} 
                        readOnly 
                        required 
                        placeholder="Ubicación GPS pendiente" 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => captureGPSCoordinates(activeVisita.id_visita)} 
                        style={{ width: '100%', padding: '10px', marginTop: '8px', borderRadius: '8px', border: 'none', background: '#475569', color: 'white', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <i className="fa-solid fa-location-crosshairs"></i> Capturar Mi Ubicación Actual
                      </button>
                    </div>

                    {/* Finalize submit buttons */}
                    <div style={{ marginTop: '10px' }}>
                      <button 
                        type="submit" 
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
                      >
                        <i className="fa-solid fa-circle-check"></i> Guardar y Finalizar Visita
                      </button>
                      
                      <button 
                        type="button" 
                        onClick={() => {
                          setPosponerVisitaId(activeVisita.id_visita);
                          setMotivoPosponer('Cliente ausente');
                          setMotivoPosponerOtro('');
                          setShowPosponerModal(true);
                        }} 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', marginTop: '10px' }}
                      >
                        <i className="fa-solid fa-clock"></i> Posponer para más tarde hoy
                      </button>
                    </div>

                  </form>
                )}

                {/* 4. FINALIZADA STATE BANNER */}
                {activeVisita.estado === 'FINALIZADA' && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#10b981', padding: '16px', borderRadius: '12px', fontWeight: 800, fontSize: '0.98rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-check fa-lg"></i> Trabajo completado y registrado.
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DEL CLIENTE */}
      {showHistorialModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', maxHeight: '80vh', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <h5 style={{ margin: 0, color: '#38bdf8', fontSize: '1rem', fontWeight: 800 }}>⏱️ Historial de Visitas: {nombreClienteHistorial}</h5>
              <button type="button" onClick={() => setShowHistorialModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.6rem', cursor: 'pointer', padding: 0 }}>&times;</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1 }}>
              {loadingHistorial ? (
                <div style={{ textAlignment: 'center', padding: '20px 0', color: '#38bdf8', fontWeight: 'bold' }}>Consultando visitas pasadas de los últimos 3 meses...</div>
              ) : historialCliente.length === 0 ? (
                <div style={{ textAlignment: 'center', color: '#94a3b8', padding: '20px 0' }}>No se registraron visitas anteriores para este cliente en el periodo.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historialCliente.map((h, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>{h.fecha_programada}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: h.estado === 'FINALIZADA' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: h.estado === 'FINALIZADA' ? '#10b981' : '#ef4444' }}>{h.estado}</span>
                      </div>
                      <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>Motivo: {h.problema}</p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#cbd5e1' }}><strong style={{ color: '#94a3b8' }}>Solución:</strong> {h.solucion_tecnico || 'Sin especificar'}</p>
                      {h.observacion_tecnico && (
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>"{h.observacion_tecnico}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.02)' }}>
              <button type="button" onClick={() => setShowHistorialModal(false)} style={{ padding: '8px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR EMERGENCIA / PANICO */}
      {showPanicModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}>
              <h5 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-triangle-exclamation fa-beat"></i> Declarar Emergencia
              </h5>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.4 }}>
                Seleccione el motivo del auxilio en ruta. Esto notificará inmediatamente al panel del dashboard administrativo.
              </p>
              
              <div>
                <label style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>Motivo de Emergencia:</label>
                <select 
                  value={motivoPanic} 
                  onChange={(e) => setMotivoPanic(e.target.value)} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '0.85rem' }}
                >
                  <option value="Vehículo Varado (Falla Mecánica)">🚗 Vehículo Varado (Falla Mecánica)</option>
                  <option value="Sin Gasolina / Combustible">⛽ Sin Gasolina / Combustible</option>
                  <option value="Llanta pinchada / Neumático">🔧 Llanta pinchada / Neumático</option>
                  <option value="Accidente de Tránsito">⚠️ Accidente de Tránsito</option>
                  <option value="Problema / Incidente con Cliente">👤 Incidente con Cliente</option>
                  <option value="Otro motivo de emergencia">🚨 Otro motivo de emergencia</option>
                </select>
              </div>

              {motivoPanic === 'Otro motivo de emergencia' && (
                <div>
                  <label style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>Especifique la causa:</label>
                  <input 
                    type="text" 
                    value={motivoPanicOtro} 
                    onChange={(e) => setMotivoPanicOtro(e.target.value)} 
                    placeholder="Ej. Robo de herramientas, enfermedad, etc..." 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }} 
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowPanicModal(false)} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #475569', background: '#2d3748', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                <button type="button" onClick={activarPanicAlerta} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>Activar Alerta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POSPONER VISITA */}
      {showPosponerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: '#4b5563' }}>
              <h5 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 800 }}><i className="fa-solid fa-clock"></i> Posponer Visita</h5>
            </div>
            <form onSubmit={posponerVisitaSubmit} style={{ margin: 0 }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.4 }}>
                  La visita regresará al estado de pendiente de hoy para que puedas atender otras prioridades y resolverla más tarde.
                </p>
                <div>
                  <label style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>Seleccione Motivo:</label>
                  <select 
                    value={motivoPosponer} 
                    onChange={(e) => setMotivoPosponer(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '0.85rem' }}
                  >
                    <option value="Cliente ausente">Cliente ausente / No se encuentra</option>
                    <option value="Dirección incorrecta / Difícil acceso">Dirección incorrecta / Difícil acceso</option>
                    <option value="Falta de materiales o herramientas">Falta de materiales o herramientas</option>
                    <option value="Falla en poste / Daño mayor central">Falla en poste / Daño mayor central</option>
                    <option value="Otro motivo">Otro motivo (especificar)</option>
                  </select>
                </div>

                {motivoPosponer === 'Otro motivo' && (
                  <div>
                    <label style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>Describa la causa:</label>
                    <input 
                      type="text" 
                      value={motivoPosponerOtro} 
                      onChange={(e) => setMotivoPosponerOtro(e.target.value)} 
                      placeholder="Describa el motivo..." 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }} 
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowPosponerModal(false)} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #475569', background: '#2d3748', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                  <button type="submit" style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: '#64748b', color: 'white', fontWeight: 850, cursor: 'pointer', fontSize: '0.85rem' }}>Posponer</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE REMOTE SIGNATURE */}
      {showQRModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden', textAlignment: 'center' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <h5 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><i className="fa-solid fa-qrcode"></i> Escanear para Firmar</h5>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.4 }}>
                Pídale al cliente <strong>{qrClienteName}</strong> que escanee este código QR con la cámara de su celular para firmar la conformidad.
              </p>
              
              <div style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${getPublicDomain()}/firma-remota/${qrToken}`)}`} 
                  style={{ width: '180px', height: '180px', display: 'block' }} 
                  alt="QR Code" 
                />
              </div>

              <button type="button" onClick={() => setShowQRModal(false)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #475569', background: '#2d3748', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', marginTop: '5px' }}>Cerrar QR</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL Y CONFIGURACIÓN DEL TÉCNICO */}
      {showProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 200000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            animation: 'futurityToastSlideIn 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '1.1rem'
                }}>
                  {fotoPerfil && fotoPerfil !== 'default_avatar.png' ? (
                    <img 
                      src={`/static/uploads/${fotoPerfil}`} 
                      alt={tecnicoRealName} 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    tecnicoRealName ? tecnicoRealName.charAt(0).toUpperCase() : 'T'
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 900 }}>{tecnicoRealName}</h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Técnico de Campo</span>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}
              >
                ×
              </button>
            </div>

            {/* Modal Options */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Descanso Status */}
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <i className="fa-solid fa-mug-hot" style={{ marginRight: '6px', color: '#f59e0b' }}></i> Estado de Jornada
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 600 }}>Estado actual:</span>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, background: estadoActividad === 'En Descanso' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: estadoActividad === 'En Descanso' ? '#f59e0b' : '#34d399', textTransform: 'uppercase' }}>
                    {estadoActividad}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { toggleDescanso(); setShowProfileModal(false); }}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: estadoActividad === 'En Descanso' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {estadoActividad === 'En Descanso' ? <><i className="fa-solid fa-play"></i> Reanudar Trabajo</> : <><i className="fa-solid fa-mug-hot"></i> Tomar Descanso / Almuerzo</>}
                </button>
              </div>

              {/* Work Area Change */}
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <i className="fa-solid fa-briefcase" style={{ marginRight: '6px', color: '#38bdf8' }}></i> Departamento / Área de Trabajo
                </label>
                <select
                  value={areaTrabajo}
                  onChange={(e) => cambiarAreaTrabajo(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.88rem', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                >
                  <option value="SOPORTE">🛠️ Soporte Técnico</option>
                  <option value="INSTALACIONES">🔌 Instalaciones</option>
                </select>
              </div>

              {/* Asistencia / Panic Button */}
              <div style={{ background: alertaPanico ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.5)', border: alertaPanico ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
                <label style={{ fontSize: '0.72rem', color: alertaPanico ? '#ef4444' : '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px', color: '#ef4444' }}></i> Asistencia en Ruta
                </label>
                {alertaPanico ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#fca5a5', fontWeight: 700 }}>🚨 Alerta activa: {mensajePanico}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={`tel:${numeroGrua}`} style={{ flex: 1, textDecoration: 'none', textAlign: 'center', padding: '10px', background: '#ffffff', color: '#dc2626', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem' }}>
                        <i className="fa-solid fa-phone"></i> Grúa
                      </a>
                      <button type="button" onClick={desactivarPanicAlerta} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                        Apagar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowProfileModal(false); setShowPanicModal(true); }}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <i className="fa-solid fa-triangle-exclamation"></i> 🚨 Botón de Pánico
                  </button>
                )}
              </div>

              {/* Traspaso de Material entre Técnicos */}
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <i className="fa-solid fa-arrow-right-arrow-left" style={{ marginRight: '6px', color: '#10b981' }}></i> Transferencia de Insumos
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setShowTraspasoModal(true);
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-people-arrows"></i> 🔄 Traspaso de Material a Técnico
                </button>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => { setShowProfileModal(false); onLogout(); }}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', marginTop: '4px' }}
              >
                <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
              </button>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRASPASO DE MATERIAL ENTRE TÉCNICOS */}
      {showTraspasoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-arrow-right-arrow-left" style={{ color: '#10b981' }}></i> Traspaso de Material
              </h4>
              <button onClick={() => setShowTraspasoModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}>&times;</button>
            </div>

            <form onSubmit={handleTraspasoSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Técnico Destino (Quien recibe):</label>
                <select
                  value={traspasoForm.tecnico_destino_nombre}
                  onChange={(e) => setTraspasoForm({ ...traspasoForm, tecnico_destino_nombre: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}
                  required
                >
                  <option value="">-- Seleccione Técnico --</option>
                  {tecnicosLista.map((t, i) => (
                    <option key={i} value={t.nombre}>{t.nombre} ({t.placa})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Material a Transferir:</label>
                <select
                  value={traspasoForm.id_material}
                  onChange={(e) => setTraspasoForm({ ...traspasoForm, id_material: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}
                  required
                >
                  <option value="">-- Seleccione Material --</option>
                  {catalogoMateriales.map((m, i) => (
                    <option key={i} value={m.id_material}>{m.nombre_material} ({m.unidad_medida})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Cantidad:</label>
                <input
                  type="number"
                  value={traspasoForm.cantidad}
                  onChange={(e) => setTraspasoForm({ ...traspasoForm, cantidad: e.target.value })}
                  placeholder="Ej. 1"
                  min="1"
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.88rem', fontWeight: 800, boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowTraspasoModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={traspasoLoading} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {traspasoLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>} Transferir Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default TecnicoPanel;
