import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { createWorker } from 'tesseract.js';
import FirmaCanvasModal from './FirmaCanvasModal';

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

  // Main Navigation Tab State ('agenda' | 'pedidos' | 'vehiculo')
  const [activeMainTab, setActiveMainTab] = useState('agenda');

  // Inventario Móvil / Vehículo State
  const [showInventarioVehiculoModal, setShowInventarioVehiculoModal] = useState(false);
  const [inventarioVehiculoData, setInventarioVehiculoData] = useState({
    tecnico: '',
    placa: '',
    materiales: [],
    equipos_retirados: []
  });
  const [loadingInventarioVehiculo, setLoadingInventarioVehiculo] = useState(false);
  const [tabInventarioVehiculo, setTabInventarioVehiculo] = useState('materiales'); // 'materiales' | 'retirados'
  const [devolviendoEquipos, setDevolviendoEquipos] = useState(false);

  const cargarInventarioVehiculo = async () => {
    setLoadingInventarioVehiculo(true);
    try {
      const res = await fetch('/api/tecnico/mi_inventario', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setInventarioVehiculoData({
          tecnico: data.tecnico || '',
          placa: data.placa || 'S/P',
          materiales: data.materiales || [],
          equipos_retirados: data.equipos_retirados || []
        });
      }
    } catch (e) {
      console.error("Error al cargar inventario del vehículo:", e);
    } finally {
      setLoadingInventarioVehiculo(false);
    }
  };

  const handleDevolverEquiposBodega = async (idsRetiro) => {
    if (!idsRetiro || idsRetiro.length === 0) return;
    if (!confirm(`¿Confirmas la devolución física de ${idsRetiro.length} equipo(s) a Bodega Central?`)) return;
    setDevolviendoEquipos(true);
    try {
      const res = await fetch('/api/tecnico/devolver_equipos_bodega', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids_retiro: idsRetiro })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Equipos devueltos a Bodega Central exitosamente.");
        await cargarInventarioVehiculo();
      } else {
        alert("Error al devolver equipos: " + (data.message || "No se pudo realizar la transacción"));
      }
    } catch (err) {
      console.error("Error en devolución de equipos:", err);
      alert("Error de conexión al devolver equipos.");
    } finally {
      setDevolviendoEquipos(false);
    }
  };

  // Traspaso Modal State
  const [showTraspasoModal, setShowTraspasoModal] = useState(false);
  const [tecnicosLista, setTecnicosLista] = useState([]);
  const [traspasoForm, setTraspasoForm] = useState({ tecnico_destino_nombre: '', id_material: '', cantidad: '' });
  const [traspasoLoading, setTraspasoLoading] = useState(false);

  // Solicitud a Bodega Modal State
  const [showSolicitudBodegaModal, setShowSolicitudBodegaModal] = useState(false);
  const [solicitudBodegaItems, setSolicitudBodegaItems] = useState([{ id_material: '', cantidad_solicitada: 1 }]);
  const [solicitudBodegaObs, setSolicitudBodegaObs] = useState('');
  const [enviandoSolicitudBodega, setEnviandoSolicitudBodega] = useState(false);

  const handleAddItemSolicitudBodega = () => {
    setSolicitudBodegaItems([...solicitudBodegaItems, { id_material: '', cantidad_solicitada: 1 }]);
  };

  const handleRemoveItemSolicitudBodega = (idx) => {
    setSolicitudBodegaItems(solicitudBodegaItems.filter((_, i) => i !== idx));
  };

  const handleItemChangeSolicitudBodega = (idx, field, val) => {
    const next = [...solicitudBodegaItems];
    next[idx][field] = val;
    setSolicitudBodegaItems(next);
  };

  const handleEnviarSolicitudBodegaSubmit = async (e) => {
    if (e) e.preventDefault();
    const placaActual = inventarioVehiculoData.placa;
    if (!placaActual || placaActual === 'S/P') {
      alert("No tienes una placa asignada para solicitar materiales. Contacta al administrador.");
      return;
    }
    const validItems = solicitudBodegaItems.filter(it => it.id_material && Number(it.cantidad_solicitada) > 0);
    if (validItems.length === 0) {
      alert("Agrega al menos un material con cantidad válida.");
      return;
    }

    setEnviandoSolicitudBodega(true);
    try {
      const res = await fetch('/api/admin/requisiciones/crear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          placa_vehiculo: placaActual,
          nombre_tecnico: tecnicoRealName,
          items: validItems,
          observaciones: solicitudBodegaObs
        })
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message || "¡Solicitud enviada a bodega exitosamente!");
        setShowSolicitudBodegaModal(false);
        await cargarMisRequisiciones();
      } else {
        alert(data?.message || "Error al enviar solicitud a bodega.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al enviar la solicitud.");
    } finally {
      setEnviandoSolicitudBodega(false);
    }
  };

  // Mis Requisiciones (Seguimiento y Firma en Celular) State
  const [misRequisiciones, setMisRequisiciones] = useState([]);
  const [totalListasParaFirmar, setTotalListasParaFirmar] = useState(0);
  const [selectedReqParaFirmar, setSelectedReqParaFirmar] = useState(null);
  const [showFirmaReqModal, setShowFirmaReqModal] = useState(false);

  const cargarMisRequisiciones = async () => {
    try {
      const res = await fetch('/api/tecnico/mis_requisiciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setMisRequisiciones(data.requisiciones || []);
        setTotalListasParaFirmar(data.total_listas_para_firmar || 0);
      }
    } catch (e) {
      console.error("Error al cargar requisiciones del técnico:", e);
    }
  };

  const handleAbrirFirmaReq = (req) => {
    setSelectedReqParaFirmar(req);
    setShowFirmaReqModal(true);
  };

  const handleGuardarFirmaReq = async (firmaBase64) => {
    if (!selectedReqParaFirmar) return;
    try {
      const res = await fetch(`/api/tecnico/requisiciones/${selectedReqParaFirmar.id_requisicion}/firmar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ firma_tecnico: firmaBase64 })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setShowFirmaReqModal(false);
        setSelectedReqParaFirmar(null);
        alert(data.message || "¡Firma registrada con éxito! Materiales ingresados a tu vehículo.");
        await cargarInventarioVehiculo();
        await cargarMisRequisiciones();
      } else {
        alert(data.message || "Error al registrar la firma.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al guardar la firma.");
    }
  };

  // Live Camera Scanner State
  const [scannerLiveModal, setScannerLiveModal] = useState({
    isOpen: false,
    visitaId: null,
    campo: '',
    isGpon: false,
    title: ''
  });
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanningStatus, setScanningStatus] = useState('Buscando código de barras...');
  const scannerVideoRef = useRef(null);
  const scannerStreamRef = useRef(null);
  const scannerActiveRef = useRef(false);

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
        if (showInventarioVehiculoModal) {
          await cargarInventarioVehiculo();
        }
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
  const [formCierre, setFormCierre] = useState({});

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

  const cargarDatosPanel = async (manual = false) => {
    setLoading(true);
    setError('');
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/tecnico/panel/${tecnicoUrlName}?_t=${timestamp}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        const freshVisitas = data.visitas || [];
        setVisitas(freshVisitas);
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

        // Cargar requisiciones activas y estado de entregas
        cargarMisRequisiciones();
        cargarInventarioVehiculo();

        // Sync activeVisita with fresh server state
        setActiveVisita(prevActive => {
          if (!prevActive) return null;
          const fresh = freshVisitas.find(x => x.id_visita === prevActive.id_visita);
          return fresh || prevActive;
        });
        
        // Initialize form closures state, updating fields from fresh visit data
        setFormCierre(prev => {
          const nextForm = { ...prev };
          freshVisitas.forEach(v => {
            if (!nextForm[v.id_visita]) {
              nextForm[v.id_visita] = {
                solucion_tecnico: v.solucion_tecnico || '',
                observacion_tecnico: v.observacion_tecnico || '',
                modelo_onu: v.modelo_onu || v.modelo_ont || '',
                numero_serie_onu: '',
                modelo_router: v.modelo_router || v.router_principal || '',
                numero_serie_router: v.numero_serie_router || '',
                tiene_mesh: !!(v.router_secundario || v.tipo_mesh),
                router_secundario: v.router_secundario || '',
                numero_serie_router_secundario: v.numero_serie_router_secundario || '',
                tipo_mesh: v.tipo_mesh || 'CABLEADO',
                cantidad_routers: v.cantidad_routers || 1,
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

        if (manual) {
          if (navigator.vibrate) navigator.vibrate(60);
        }

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
    hubo_cambio_onu: false,
    sn_retirado_onu: '',
    modelo_retirado_onu: '',
    motivo_retiro_onu: 'DANADO_FALLA',
    obs_retiro_onu: '',
    hubo_cambio_router: false,
    sn_retirado_router: '',
    modelo_retirado_router: '',
    motivo_retiro_router: 'DANADO_FALLA',
    obs_retiro_router: '',
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
    // Validación preventiva en frontend
    const visitaActiva = visitas.find(v => v.id_visita !== idVisita && (v.estado === 'EN_RUTA' || v.estado === 'EN_PROGRESO'));
    if (visitaActiva) {
      const estTxt = visitaActiva.estado === 'EN_RUTA' ? 'en ruta' : 'en progreso';
      alert(`⚠️ Ya tienes la visita #${visitaActiva.id_visita} (${visitaActiva.cliente}) ${estTxt}.\nDebes finalizarla o posponerla antes de iniciar otra.`);
      return;
    }

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
    const visitaActiva = visitas.find(v => v.id_visita !== idVisita && v.estado === 'EN_PROGRESO');
    if (visitaActiva) {
      alert(`⚠️ Ya tienes la visita #${visitaActiva.id_visita} (${visitaActiva.cliente}) en progreso.\nDebes finalizarla o posponerla antes de iniciar otra.`);
      return;
    }

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

  const procesarFotoBarcodeParaCampo = async (file, visitaId, campo, isGpon = false) => {
    if (!file) return;
    try {
      // 1. Cargar imagen en memoria
      const img = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.ITF
      ]);
      const codeReader = new BrowserMultiFormatReader(hints);

      // Probar en 4 orientaciones: 0°, 90°, 270°, 180°
      const angles = [0, 90, 270, 180];
      const foundSet = new Set();
      const pad = 35; // Quiet zone blanca para permitir lectura de fotos recortadas

      for (const angle of angles) {
        const rawW = (angle === 90 || angle === 270) ? img.height : img.width;
        const rawH = (angle === 90 || angle === 270) ? img.width : img.height;

        const canvas = document.createElement('canvas');
        canvas.width = rawW + pad * 2;
        canvas.height = rawH + pad * 2;
        const ctx = canvas.getContext('2d');

        // Fondo blanco (Quiet Zone indispensable para códigos 1D como Code 128)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // A) BarcodeDetector nativo (detecta múltiples códigos a la vez en la etiqueta)
        if ('BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({
              formats: ['code_128', 'code_39', 'qr_code', 'data_matrix', 'ean_13', 'ean_8']
            });
            const barcodes = await detector.detect(canvas);
            if (barcodes && barcodes.length > 0) {
              barcodes.forEach(b => {
                if (b.rawValue && b.rawValue.trim()) foundSet.add(b.rawValue.trim());
              });
            }
          } catch (e) {}
        }

        // B) ZXing decode del canvas completo
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const result = await codeReader.decodeFromImageUrl(dataUrl);
          if (result && result.getText()) {
            foundSet.add(result.getText().trim());
          }
        } catch (e) {}

        // C) ZXing escaneo por franjas horizontales (Top, Middle, Bottom) para separar códigos apilados
        const slices = [
          { y1: 0, y2: Math.floor(canvas.height * 0.45) },
          { y1: Math.floor(canvas.height * 0.28), y2: Math.floor(canvas.height * 0.72) },
          { y1: Math.floor(canvas.height * 0.55), y2: canvas.height }
        ];

        for (const s of slices) {
          try {
            const sCanvas = document.createElement('canvas');
            sCanvas.width = canvas.width;
            sCanvas.height = (s.y2 - s.y1) + 40;
            const sCtx = sCanvas.getContext('2d');
            sCtx.fillStyle = '#ffffff';
            sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);
            sCtx.drawImage(canvas, 0, s.y1, canvas.width, s.y2 - s.y1, 0, 20, canvas.width, s.y2 - s.y1);

            const sDataUrl = sCanvas.toDataURL('image/jpeg', 0.95);
            const sRes = await codeReader.decodeFromImageUrl(sDataUrl);
            if (sRes && sRes.getText()) {
              foundSet.add(sRes.getText().trim());
            }
          } catch (e) {}
        }
      }

      // Si aún no encontró, intentar con binarización/aumento de contraste y padding
      if (foundSet.size === 0) {
        for (const angle of [90, 270, 0, 180]) {
          const rawW = (angle === 90 || angle === 270) ? img.height : img.width;
          const rawH = (angle === 90 || angle === 270) ? img.width : img.height;

          const canvas = document.createElement('canvas');
          canvas.width = rawW + pad * 2;
          canvas.height = rawH + pad * 2;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
            const v = gray > 130 ? 255 : 0;
            d[i] = v; d[i+1] = v; d[i+2] = v;
          }
          ctx.putImageData(imgData, 0, 0);

          try {
            const dataUrl = canvas.toDataURL('image/png');
            const result = await codeReader.decodeFromImageUrl(dataUrl);
            if (result && result.getText()) {
              foundSet.add(result.getText().trim());
              break;
            }
          } catch (e) {}
        }
      }

      const allDecoded = Array.from(foundSet);
      let confirmedSn = null;

      // 1. Verificar si en los códigos de barra leídos está la SN GPON
      if (isGpon || campo === 'numero_serie_onu') {
        const gponVendorMatch = allDecoded.find(c => {
          const cleaned = c.replace(/^(SN|S\/N|GPON)[:\s\-_]*/i, '').trim().toUpperCase();
          return /^(48575443|43444B54|54504C47|5A544547|46485454|414C434C|56534F4C|HWTC|CDKT|TPLG|ZTEG|FHTT|ALCL|VSOL)/i.test(cleaned);
        });

        if (gponVendorMatch) {
          confirmedSn = gponVendorMatch;
        } else {
          const snCandidate = allDecoded.find(c => {
            const cleaned = c.replace(/^(SN|S\/N|GPON)[:\s\-_]*/i, '').trim().toUpperCase();
            const isMac = c.includes('-A0') || c.includes(':') || c.startsWith('MAC');
            const isProd = c.startsWith('21500') || c.includes('PROD');
            return !isMac && !isProd && (cleaned.length === 16 || cleaned.length === 12);
          });
          if (snCandidate) confirmedSn = snCandidate;
        }
      } else if (campo === 'numero_serie_router' || campo === 'numero_serie_router_secundario') {
        const macMatch = allDecoded.find(c => c.includes('-A0') || c.includes(':') || c.startsWith('MAC') || c.length === 12);
        if (macMatch) confirmedSn = macMatch;
        else if (allDecoded.length > 0) confirmedSn = allDecoded[0];
      }

      if (confirmedSn) {
        let valorFinal = confirmedSn.trim().replace(/^(SN|S\/N|GPON|MAC|PROD\s*ID)[:\s\-_]*/i, '').trim().toUpperCase();
        if (isGpon || campo === 'numero_serie_onu') {
          valorFinal = normalizarGponSn(valorFinal);
        }
        updateFormState(visitaId, { [campo]: valorFinal });
        if (navigator.vibrate) navigator.vibrate(100);
        alert(`¡Código escaneado con éxito!\nDetectado: ${confirmedSn}${isGpon ? '\nSerie GPON: ' + valorFinal : ''}`);
        return;
      }

      // 2. OCR Fallback con Tesseract.js (Lectura de texto óptico de la etiqueta: SN: ... / MAC: ...)
      try {
        const worker = await createWorker('eng');
        for (const angle of [90, 270, 0, 180]) {
          const canvas = document.createElement('canvas');
          const rawW = (angle === 90 || angle === 270) ? img.height : img.width;
          const rawH = (angle === 90 || angle === 270) ? img.width : img.height;
          canvas.width = rawW;
          canvas.height = rawH;
          const ctx = canvas.getContext('2d');
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);

          const ocrDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const ret = await worker.recognize(ocrDataUrl);
          const txt = ret?.data?.text || '';

          if (isGpon || campo === 'numero_serie_onu') {
            const m1 = txt.match(/S\/?N[:\s\-_]*([0-9A-Z]{12,18})/i);
            const m2 = txt.match(/(48575443|43444B54|54504C47|5A544547|46485454|414C434C|56534F4C)[0-9A-F]{8}/i);
            const m3 = txt.match(/(HWTC|CDKT|TPLG|ZTEG|FHTT|ALCL|VSOL)[0-9A-Z]{8}/i);
            const cand = (m1 ? m1[1] : (m2 ? m2[0] : (m3 ? m3[0] : null)));
            if (cand) {
              await worker.terminate();
              let valorFinal = cand.trim().replace(/^(SN|S\/N|GPON)[:\s\-_]*/i, '').trim().toUpperCase();
              valorFinal = normalizarGponSn(valorFinal);
              updateFormState(visitaId, { [campo]: valorFinal });
              if (navigator.vibrate) navigator.vibrate(100);
              alert(`¡Etiqueta leída con éxito (OCR)!\nTexto detectado: ${cand}\nSerie GPON: ${valorFinal}`);
              return;
            }
          } else if (campo === 'numero_serie_router' || campo === 'numero_serie_router_secundario') {
            const macM = txt.match(/MAC[:\s\-_]*([0-9A-Z\-()]{12,22})/i);
            if (macM) {
              await worker.terminate();
              const valorFinal = macM[1].trim().toUpperCase();
              updateFormState(visitaId, { [campo]: valorFinal });
              if (navigator.vibrate) navigator.vibrate(100);
              alert(`¡MAC leída con éxito (OCR)!\nSerie/MAC: ${valorFinal}`);
              return;
            }
          }
        }
        await worker.terminate();
      } catch (ocrErr) {
        console.warn("OCR fallback error:", ocrErr);
      }

      alert("No se pudo detectar automáticamente la Serie en la foto. Ingrésala manualmente.");
    } catch (err) {
      console.error("Error escaneando código de barras:", err);
      alert("No se pudo leer la imagen. Ingrésala manualmente.");
    }
  };

  // --- Live Camera Scanner Methods & Effects ---
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const abrirEscanerEnVivo = (visitaId, campo, isGpon = false, title = 'Escanear Código') => {
    setCameraError('');
    setTorchOn(false);
    setHasTorch(false);
    setScanningStatus('Iniciando cámara...');
    setScannerLiveModal({
      isOpen: true,
      visitaId,
      campo,
      isGpon,
      title
    });
  };

  const cerrarEscanerEnVivo = () => {
    scannerActiveRef.current = false;
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(t => t.stop());
      scannerStreamRef.current = null;
    }
    setScannerLiveModal({ isOpen: false, visitaId: null, campo: '', isGpon: false, title: '' });
  };

  const toggleTorch = async () => {
    if (!scannerStreamRef.current) return;
    const track = scannerStreamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Torch no soportado:', e);
      }
    }
  };

  const validarYFiltrarCodigoEscaneado = (rawCode, isGpon, campo) => {
    if (!rawCode) return { valido: false, razon: 'Buscando código...' };
    const clean = rawCode.trim();
    const upper = clean.toUpperCase();

    // 1. Descartar patrones evidentes de PROD ID, Model, Part Number o IMEI
    if (
      /^(PROD|PRODUCT|MODEL|MOD|P\/N|PN|PID|INPUT|POWER|IMEI|SSID|WIFI|WLAN)[:\s\-_]*/i.test(clean) ||
      upper.startsWith('21500') || // Huawei Product ID (ej: 2150083456...)
      upper.startsWith('HG8') || upper.startsWith('EG8') || upper.startsWith('FD511') || upper.startsWith('F670') || upper.startsWith('F680')
    ) {
      return { valido: false, razon: '⚠️ Ignorando Código de Producto / Modelo' };
    }

    // 2. Si estamos escaneando GPON SN (ONU)
    if (isGpon || campo === 'numero_serie_onu') {
      // Descartar si es dirección MAC evidente
      if (
        /^MAC[:\s\-_]*/i.test(clean) || 
        /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i.test(clean) || 
        /^[0-9A-F]{2}(-[0-9A-F]{2}){5}$/i.test(clean) || 
        upper.endsWith('-A0') || 
        upper.endsWith('-A1')
      ) {
        return { valido: false, razon: '⚠️ Ignorando MAC. Apunta a la Serie GPON (SN)' };
      }

      const hasSnPrefix = /^(SN|S\/N|GPON|GPON\s*SN)[:\s\-_]*/i.test(clean);
      let candidate = upper.replace(/^(SN|S\/N|GPON|GPON\s*SN)[:\s\-_]*/i, '').trim();

      // Prefijos conocidos de fabricantes GPON (ASCII o HEX de 8 caracteres)
      const GPON_PREFIXES = /^(48575443|43444B54|54504C47|5A544547|46485454|414C434C|56534F4C|534D4253|HWTC|CDKT|TPLG|ZTEG|FHTT|ALCL|VSOL|SMBS|ISKT|VNPT|CATA|ELTX|DSNW|GNMS|BDCM|ZTE)/i;
      
      if (GPON_PREFIXES.test(candidate)) {
        const normalized = normalizarGponSn(candidate);
        return { valido: true, valor: normalized };
      }

      // Si el código tenía explícitamente el prefijo "SN:" o "S/N:" en el código de barras
      if (hasSnPrefix && candidate.length >= 8 && candidate.length <= 20) {
        const normalized = normalizarGponSn(candidate);
        return { valido: true, valor: normalized };
      }

      // Si es un código hexadecimal de 12 caracteres sin prefijo GPON (es una MAC address en la etiqueta)
      if (/^[0-9A-F]{12}$/i.test(candidate)) {
        return { valido: false, razon: '⚠️ Ignorando MAC. Apunta a la Serie GPON (SN)' };
      }

      return { valido: false, razon: 'Apunta el recuadro verde a la Serie (SN)...' };
    }

    // 3. Si estamos escaneando Router (Principal o Secundario)
    if (campo === 'numero_serie_router' || campo === 'numero_serie_router_secundario') {
      // Descartar si es dirección MAC evidente
      if (
        /^MAC[:\s\-_]*/i.test(clean) || 
        /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i.test(clean) || 
        /^[0-9A-F]{2}(-[0-9A-F]{2}){5}$/i.test(clean) || 
        upper.endsWith('-A0') || 
        upper.endsWith('-A1')
      ) {
        return { valido: false, razon: '⚠️ Ignorando MAC. Apunta a la Serie (S/N) del Router' };
      }

      // Descartar códigos de modelos comunes de routers
      const ROUTER_MODELS = /^(ARCHER|MR30G|MR50G|MR70X|AX3|AX10|AX12|AX20|AX50|AC1200|AC1900|AC750|WR840N|WR841N|WR940N|DIR-|MW305|MW301|F3|F6|F9|AC6|AC10|MW325R|EX220|EC220|HX220|WS7000|WS7001)/i;
      if (ROUTER_MODELS.test(upper)) {
        return { valido: false, razon: '⚠️ Ignorando Modelo del Router' };
      }

      // Descartar PINs, WPS, Contraseñas o Voltajes
      if (/^(PIN|WPS|WPA|KEY|PASS|PWD|SSID|WIRELESS|12V|9V|1A|1\.5A|2A|REV|VER|V1|V2|V3)[:\s\-_]*/i.test(clean)) {
        return { valido: false, razon: '⚠️ Ignorando PIN / Clave / Modelo' };
      }

      const hasSnPrefix = /^(SN|S\/N|SERIAL|SERIAL\s*NO|SERIAL\s*NUMBER|ROUTER\s*SN)[:\s\-_]*/i.test(clean);
      let candidate = upper.replace(/^(SN|S\/N|SERIAL|SERIAL\s*NO|SERIAL\s*NUMBER|ROUTER\s*SN)[:\s\-_]*/i, '').trim();

      // Si el código tenía explícitamente el prefijo "S/N:" o "SN:"
      if (hasSnPrefix && candidate.length >= 8 && candidate.length <= 24) {
        return { valido: true, valor: candidate };
      }

      // Si es un código hexadecimal de 12 caracteres sin prefijo SN (es una dirección MAC en el router)
      if (/^[0-9A-F]{12}$/i.test(candidate)) {
        return { valido: false, razon: '⚠️ Ignorando MAC. Apunta a la Serie (S/N) del Router' };
      }

      // Formato típico de serie de router (TP-Link, Mercusys, Huawei, Tenda, etc. de 13 a 22 caracteres)
      if (/^[0-9A-Z]{13,24}$/i.test(candidate)) {
        return { valido: true, valor: candidate };
      }

      return { valido: false, razon: 'Apunta el recuadro a la Serie (S/N) del Router...' };
    }

    return { valido: true, valor: clean.toUpperCase() };
  };

  useEffect(() => {
    if (!scannerLiveModal.isOpen) return;
    let stream = null;
    scannerActiveRef.current = true;

    const startCamera = async () => {
      try {
        setScanningStatus('Accediendo a la cámara trasera...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 }
          },
          audio: false
        });
        scannerStreamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          const caps = track.getCapabilities();
          if (caps && caps.torch) {
            setHasTorch(true);
          }
        }

        if (scannerVideoRef.current) {
          scannerVideoRef.current.srcObject = stream;
          await scannerVideoRef.current.play();
          setScanningStatus('Apunta el recuadro a la Serie (SN)...');
          iniciarBucleEscaneo();
        }
      } catch (err) {
        console.error('Error accediendo a cámara:', err);
        setCameraError('No se pudo abrir la cámara. Revisa los permisos o usa la opción de Galería/Foto.');
      }
    };

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.ITF
    ]);
    const zxingReader = new BrowserMultiFormatReader(hints);
    const hasNativeBarcodeDetector = 'BarcodeDetector' in window;
    let nativeDetector = null;
    if (hasNativeBarcodeDetector) {
      try {
        nativeDetector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'data_matrix', 'ean_13', 'ean_8']
        });
      } catch (e) {}
    }

    const onCodeFound = (finalValue) => {
      if (!scannerActiveRef.current) return;
      scannerActiveRef.current = false;
      playBeep();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      updateFormState(scannerLiveModal.visitaId, { [scannerLiveModal.campo]: finalValue });
      cerrarEscanerEnVivo();
    };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = async () => {
      if (!scannerActiveRef.current || !scannerVideoRef.current) return;
      const video = scannerVideoRef.current;
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        // 1. Detección nativa por GPU/Hardware
        if (nativeDetector) {
          try {
            const detected = await nativeDetector.detect(video);
            if (detected && detected.length > 0) {
              for (const item of detected) {
                if (item.rawValue && item.rawValue.trim()) {
                  const check = validarYFiltrarCodigoEscaneado(item.rawValue, scannerLiveModal.isGpon, scannerLiveModal.campo);
                  if (check.valido) {
                    onCodeFound(check.valor);
                    return;
                  } else if (check.razon) {
                    setScanningStatus(check.razon);
                  }
                }
              }
            }
          } catch (e) {}
        }

        // 2. Detección con ZXing en canvas enfocado en la zona central (viewfinder)
        if (scannerActiveRef.current) {
          try {
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            
            // Recorte enfocado en el centro (75% ancho, 45% alto)
            const cropW = Math.floor(vw * 0.75);
            const cropH = Math.floor(vh * 0.45);
            const cropX = Math.floor((vw - cropW) / 2);
            const cropY = Math.floor((vh - cropH) / 2);

            canvas.width = cropW;
            canvas.height = cropH;
            ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const imgData = ctx.getImageData(0, 0, cropW, cropH);
            const result = await zxingReader.decodeFromImageData(imgData);
            if (result && result.getText() && result.getText().trim()) {
              const check = validarYFiltrarCodigoEscaneado(result.getText(), scannerLiveModal.isGpon, scannerLiveModal.campo);
              if (check.valido) {
                onCodeFound(check.valor);
                return;
              } else if (check.razon) {
                setScanningStatus(check.razon);
              }
            }
          } catch (e) {}
        }
      }

      if (scannerActiveRef.current) {
        setTimeout(scanFrame, 70);
      }
    };

    const iniciarBucleEscaneo = () => {
      setTimeout(scanFrame, 150);
    };

    startCamera();

    return () => {
      scannerActiveRef.current = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [scannerLiveModal.isOpen]);







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
    if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
      return window.location.origin;
    }
    return 'https://atlas.futurity.com.ec';
  };

  const enviarLinkFirmaWhatsApp = (telefonos, tecnico, tokenRastreo, idVisita) => {
    if (!telefonos) return;
    const tokenFinal = tokenRastreo || idVisita;
    const cleanTel = telefonos.split('/')[0].trim().replace(/[^\d+]/g, '');
    const msg = `Hola! Soy ${tecnico}, tu técnico asignado. Por favor, ingresa a este enlace para firmar tu conformidad del trabajo: ${getPublicDomain()}/firma-remota/${tokenFinal}`;
    window.open(`https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const mostrarQRDeFirma = (tokenRastreo, clienteName, idVisita) => {
    const tokenFinal = tokenRastreo || idVisita;
    setQrToken(tokenFinal);
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
  const abrirWhatsApp = async (telefonos, tecnico, tokenRastreo, idVisita) => {
    if (!telefonos) return;
    let finalToken = tokenRastreo;

    // Si aún no se ha generado el token de rastreo, iniciamos "voy en camino" primero
    if (!finalToken && idVisita) {
      try {
        await registrarVoyEnCamino(idVisita);
        const resV = await fetch(`/api/tecnico/panel/${tecnicoUrlName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dV = await resV.json();
        if (dV.ok || dV.status === 'ok') {
          const fresh = (dV.visitas || []).find(x => x.id_visita === idVisita);
          if (fresh && fresh.token_rastreo) finalToken = fresh.token_rastreo;
        }
      } catch (e) {
        console.warn("Error generando token para WhatsApp:", e);
      }
    }

    const cleanTel = telefonos.split('/')[0].trim().replace(/[^\d+]/g, '');
    let msg = `Estimado cliente, le saluda ${tecnico}. Le informo que ya voy en camino a su domicilio para realizar el trabajo.`;
    if (finalToken && finalToken !== 'null' && finalToken !== 'undefined') {
      msg += ` Puede seguir mi trayecto en tiempo real ingresando aquí: ${getPublicDomain()}/seguimiento/${finalToken}`;
    }
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
        numero_serie_onu: form.numero_serie_onu ? normalizarGponSn(form.numero_serie_onu) : null,
        modelo_router: form.modelo_router,
        numero_serie_router: form.numero_serie_router || null,
        router_secundario: form.tiene_mesh ? form.router_secundario : null,
        numero_serie_router_secundario: form.tiene_mesh ? form.numero_serie_router_secundario : null,
        tipo_mesh: form.tiene_mesh ? form.tipo_mesh : null,
        cantidad_routers: form.tiene_mesh ? (parseInt(form.cantidad_routers) || 2) : 1,
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
        hubo_cambio_onu: !!form.hubo_cambio_onu,
        sn_retirado_onu: form.sn_retirado_onu ? normalizarGponSn(form.sn_retirado_onu) : '',
        modelo_retirado_onu: form.modelo_retirado_onu || '',
        motivo_retiro_onu: form.motivo_retiro_onu || 'DANADO_FALLA',
        obs_retiro_onu: form.obs_retiro_onu || '',
        hubo_cambio_router: !!form.hubo_cambio_router,
        sn_retirado_router: form.sn_retirado_router || '',
        modelo_retirado_router: form.modelo_retirado_router || '',
        motivo_retiro_router: form.motivo_retiro_router || 'DANADO_FALLA',
        obs_retiro_router: form.obs_retiro_router || '',
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

    <div className="panel-container tecnico-scroll-container" style={{ padding: '16px 16px 90px 16px', maxWidth: '800px', margin: '0 auto', width: '100%', minHeight: '100%', boxSizing: 'border-box', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
      
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
              textOverflow: 'ellipsis'
            }}>
              {estadoActividad}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={() => {
                cargarDatosPanel();
                cargarMisRequisiciones();
                cargarInventarioVehiculo();
              }} 
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

        {/* TOP LEVEL NAVIGATION TABS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          padding: '4px',
          marginTop: '10px',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveMainTab('agenda')}
            style={{
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: activeMainTab === 'agenda' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
              color: activeMainTab === 'agenda' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-calendar-day"></i> Agenda ({visitas.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMainTab('pedidos');
              cargarMisRequisiciones();
            }}
            style={{
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: activeMainTab === 'pedidos' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
              color: activeMainTab === 'pedidos' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <i className="fa-solid fa-boxes-packing"></i> Pedidos ({misRequisiciones.length})
            {totalListasParaFirmar > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '4px',
                background: '#10b981',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 900,
                borderRadius: '8px',
                padding: '1px 5px',
                boxShadow: '0 2px 6px rgba(16,185,129,0.5)'
              }}>
                {totalListasParaFirmar} FIRMAR
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMainTab('vehiculo');
              cargarInventarioVehiculo();
            }}
            style={{
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: activeMainTab === 'vehiculo' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
              color: activeMainTab === 'vehiculo' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-truck-moving"></i> Mi Vehículo
          </button>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="main-content" style={{ width: '100%', padding: 0 }}>

        {/* TAB 1: AGENDA DE VISITAS */}
        {activeMainTab === 'agenda' && (
          <div>
            {totalListasParaFirmar > 0 && (
              <div style={{ margin: '14px 0', padding: '14px 18px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.35) 100%)', border: '2px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.6rem' }}>📦</span>
                  <div>
                    <strong style={{ color: '#fbbf24', fontSize: '0.9rem', display: 'block' }}>
                      ¡Pedido de Insumos Aprobado por Bodega!
                    </strong>
                    <span style={{ color: '#f8fafc', fontSize: '0.78rem' }}>
                      {totalListasParaFirmar === 1 ? 'Tienes 1 pedido listo en bodega. Firma para recibir.' : `Tienes ${totalListasParaFirmar} pedidos listos. Firma para recibir.`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const reqList = misRequisiciones.find(r => r.estado === 'LISTO_ENTREGA');
                    if (reqList) handleAbrirFirmaReq(reqList);
                  }}
                  style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)' }}
                >
                  <span>✍️ Firmar Recepción</span>
                </button>
              </div>
            )}

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
        )}

        {/* TAB 2: PESTAÑA DEDICADA DE PEDIDOS A BODEGA */}
        {activeMainTab === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Header de la pestaña */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-boxes-packing"></i> Mis Pedidos a Bodega
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                  🚐 Buseta: <strong style={{ color: '#38bdf8' }}>{inventarioVehiculoData.placa || 'S/P'}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSolicitudBodegaModal(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.4)'
                }}
              >
                <i className="fa-solid fa-plus-circle"></i> + Solicitar Insumos a Bodega
              </button>
            </div>

            {/* Listado de Pedidos */}
            {misRequisiciones.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                <i className="fa-solid fa-box-open" style={{ fontSize: '3rem', color: 'var(--sidebar-text)', opacity: 0.4, marginBottom: '12px' }}></i>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 800 }}>No tienes solicitudes registradas</h4>
                <p style={{ margin: '6px 0 16px 0', color: 'var(--sidebar-text)', fontSize: '0.82rem' }}>
                  Puedes pedir materiales cuando necesites reponer stock para tus instalaciones o soporte.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSolicitudBodegaModal(true)}
                  style={{ padding: '8px 16px', borderRadius: '10px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Hacer mi primera solicitud
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {misRequisiciones.map((req) => (
                  <div 
                    key={req.id_requisicion}
                    style={{
                      background: 'var(--card-bg)',
                      border: req.estado === 'LISTO_ENTREGA' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: req.estado === 'LISTO_ENTREGA' ? '0 4px 18px rgba(16, 185, 129, 0.25)' : 'var(--shadow-sm)',
                      position: 'relative'
                    }}
                  >
                    {/* Encabezado del Pedido */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8' }}>{req.numero_solicitud}</span>
                        <small style={{ color: 'var(--sidebar-text)', fontSize: '0.74rem', display: 'block', marginTop: '2px' }}>
                          📅 Solicitado: {req.fecha_solicitud_fmt || req.fecha_solicitud}
                        </small>
                      </div>

                      <div>
                        {req.estado === 'PENDIENTE' && (
                          <span style={{ padding: '4px 10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 900 }}>
                            ⏳ En preparación Bodega
                          </span>
                        )}
                        {req.estado === 'LISTO_ENTREGA' && (
                          <span style={{ padding: '4px 12px', borderRadius: '10px', background: '#10b981', color: '#ffffff', fontSize: '0.78rem', fontWeight: 900, boxShadow: '0 2px 8px rgba(16,185,129,0.4)' }}>
                            📦 ¡APROBADO! LISTO PARA FIRMA
                          </span>
                        )}
                        {req.estado === 'ENTREGADA' && (
                          <span style={{ padding: '4px 10px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 900 }}>
                            ✅ Recibido en Buseta
                          </span>
                        )}
                        {req.estado === 'RECHAZADA' && (
                          <span style={{ padding: '4px 10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 900 }}>
                            🔴 Rechazado por Bodega
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lista de Insumos */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Materiales:</span>
                      {(req.items || []).map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                          <span>• {it.nombre_material}</span>
                          <strong style={{ color: req.estado === 'LISTO_ENTREGA' ? '#34d399' : '#38bdf8' }}>
                            {it.cantidad_aprobada || it.cantidad_solicitada} {it.unidad_medida}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {/* Observaciones o Motivo de Rechazo */}
                    {req.motivo_rechazo && (
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.78rem' }}>
                        <strong>Motivo de Rechazo:</strong> {req.motivo_rechazo}
                      </div>
                    )}

                    {/* Acciones del Técnico */}
                    {req.estado === 'LISTO_ENTREGA' && (
                      <div style={{ marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleAbrirFirmaReq(req)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                          }}
                        >
                          <i className="fa-solid fa-signature"></i> ✍️ FIRMAR Y CONFIRMAR RECEPCIÓN
                        </button>
                      </div>
                    )}

                    {req.estado === 'ENTREGADA' && req.fecha_entrega_fmt && (
                      <small style={{ color: '#10b981', fontWeight: 700, fontSize: '0.74rem' }}>
                        Entrega finalizada el {req.fecha_entrega_fmt}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PESTAÑA DEDICADA DE MI VEHÍCULO */}
        {activeMainTab === 'vehiculo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Header del Vehículo */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-truck-moving"></i> Mi Bodega Móvil / Vehículo
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                  🚗 Placa: <strong style={{ color: '#38bdf8' }}>{inventarioVehiculoData.placa || 'S/P'}</strong> &bull; {inventarioVehiculoData.tecnico}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowTraspasoModal(true)}
                  style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-arrow-right-arrow-left"></i> Traspasar / Devolver
                </button>
                <button
                  type="button"
                  onClick={cargarInventarioVehiculo}
                  style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-arrows-rotate"></i>
                </button>
              </div>
            </div>

            {/* Listado de Materiales en Camioneta */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Insumos Disponibles ({inventarioVehiculoData.materiales.length}):
              </h4>

              {inventarioVehiculoData.materiales.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
                  <p style={{ margin: 0, color: 'var(--sidebar-text)', fontSize: '0.86rem', fontWeight: 600 }}>No hay materiales asignados a este vehículo ({inventarioVehiculoData.placa}).</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inventarioVehiculoData.materiales.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.88rem', display: 'block' }}>{m.nombre_material}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{m.categoria || 'Consumible'} &bull; Cod: {m.codigo_material || 'N/A'}</span>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', fontWeight: 900, fontSize: '0.88rem' }}>
                        {m.cantidad_disponible} {m.unidad_medida || 'uds'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Listado de Equipos Retirados */}
            {inventarioVehiculoData.equipos_retirados.length > 0 && (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Equipos Retirados en Custodia ({inventarioVehiculoData.equipos_retirados.length}):
                  </h4>
                  <button
                    type="button"
                    disabled={devolviendoEquipos}
                    onClick={() => handleDevolverEquiposBodega(inventarioVehiculoData.equipos_retirados.map(x => x.id_retiro))}
                    style={{ padding: '6px 12px', borderRadius: '8px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', color: 'white', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    {devolviendoEquipos ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-building-circle-arrow-right"></i>} Devolver a Bodega
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inventarioVehiculoData.equipos_retirados.map((eq, idx) => (
                    <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', marginRight: '6px' }}>{eq.tipo_equipo}</span>
                          <strong style={{ color: '#f8fafc', fontSize: '0.9rem', fontFamily: 'monospace' }}>{eq.numero_serie}</strong>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 700 }}>{eq.motivo_retiro}</span>
                      </div>
                      <small style={{ color: '#94a3b8', fontSize: '0.74rem' }}>Cliente: {eq.cliente || 'N/A'}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            <button 
              type="button" 
              onClick={() => cargarDatosPanel(true)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #475569', color: '#38bdf8', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
              <span>Refrescar</span>
            </button>
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
                  {activeVisita.numero_serie_router && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Serie Router:</span>
                      <strong style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>{activeVisita.numero_serie_router}</strong>
                    </div>
                  )}
                  {activeVisita.router_secundario && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Router Secundario / Mesh:</span>
                        <strong style={{ color: '#a78bfa', fontSize: '0.9rem' }}>{activeVisita.router_secundario} {activeVisita.tipo_mesh ? `(${activeVisita.tipo_mesh})` : ''}</strong>
                      </div>
                      {activeVisita.numero_serie_router_secundario && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Serie Mesh:</span>
                          <strong style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>{activeVisita.numero_serie_router_secundario}</strong>
                        </div>
                      )}
                    </>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 700 }}>Estado GPON:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 850, padding: '4px 10px', borderRadius: '6px', background: oltResult.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: oltResult.status === 'ONLINE' ? '#34d399' : '#f87171' }}>
                          {oltResult.status || 'DESCONOCIDO'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                        <div>
                          <small style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Potencia Rx (ONU)</small>
                          <strong style={{ fontSize: '0.95rem', color: (parseFloat(oltResult.rx_power) < -27 || parseFloat(oltResult.rx_power) > -8) ? '#f87171' : '#38bdf8' }}>
                            {oltResult.rx_power ? `${oltResult.rx_power} dBm` : 'N/D'}
                          </strong>
                        </div>
                        <div>
                          <small style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Potencia Tx (OLT)</small>
                          <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>
                            {oltResult.tx_power ? `${oltResult.tx_power} dBm` : 'N/D'}
                          </strong>
                        </div>
                      </div>

                      {oltResult.detalles && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px' }}>
                          {oltResult.detalles}
                        </p>
                      )}

                      <button 
                        type="button" 
                        onClick={() => ejecutarMedicionOLT(activeVisita.numero_serie)} 
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i> Volver a medir
                      </button>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* SUB TAB 3: TRABAJO (CIERRE & REPORTES) */}
            {activeSubTab === 'tab-acciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* 1. ASIGNADA / PENDIENTE STATE ACTIONS */}
                {(activeVisita.estado === 'ASIGNADA' || activeVisita.estado === 'PENDIENTE') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button 
                      type="button" 
                      onClick={() => registrarVoyEnCamino(activeVisita.id_visita)} 
                      style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', fontWeight: 850, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
                    >
                      <i className="fa-solid fa-route"></i> Voy en Camino
                    </button>
                    
                    {activeVisita.telefonos && (
                      <button 
                        type="button" 
                        onClick={() => abrirWhatsApp(activeVisita.telefonos, tecnicoRealName, activeVisita.token_rastreo, activeVisita.id_visita)} 
                        style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(34, 197, 94, 0.2)' }}
                      >
                        <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Avisar "Voy en Camino" por WhatsApp
                      </button>
                    )}

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

                {/* 2. EN_RUTA STATE ACTIONS */}
                {activeVisita.estado === 'EN_RUTA' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem' }}>🚗 En Ruta al Domicilio</span>
                      <small style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>El GPS está activo y el cliente puede seguir tu llegada.</small>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => registrarLlegueTrabajo(activeVisita.id_visita)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)' }}
                    >
                      <i className="fa-solid fa-play"></i> Llegué / Iniciar Trabajo
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

                    {/* --- SECCIÓN DE EQUIPOS EN DOMICILIO --- */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                        <h6 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 850, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-server"></i> Registro y Configuración de Equipos
                        </h6>
                      </div>

                      {/* 1. ONT / ONU */}
                      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#10b981', margin: 0 }}>🟢 Modelo ONT / ONU:</label>
                          {['XX530V', 'XX231V', 'XPON'].some(m => (activeFormState.modelo_onu || '').toUpperCase().includes(m)) && (
                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                              ONU COMBO (Wi-Fi Integrado)
                            </span>
                          )}
                        </div>
                        <select 
                          value={activeFormState.modelo_onu} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { modelo_onu: e.target.value })} 
                          style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.82rem' }}
                        >
                          <option value="">-- Ninguna --</option>
                          {catalogoOnt.map((o, idx) => <option key={idx} value={o.nombre}>{o.nombre}</option>)}
                        </select>

                        {/* Serie ONU (SN) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '6px' }}>
                          <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                            Serie GPON (SN) {activeVisita.numero_serie ? `[Actual: ${activeVisita.numero_serie}]` : ''}:
                          </label>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => abrirEscanerEnVivo(activeVisita.id_visita, 'numero_serie_onu', true, 'Escanear Serie GPON (ONU)')}
                              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <i className="fa-solid fa-camera"></i> 📷 Cámara
                            </button>
                            <label style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-images"></i> Foto
                              <input 
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    procesarFotoBarcodeParaCampo(e.target.files[0], activeVisita.id_visita, 'numero_serie_onu', true);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <input 
                          type="text" 
                          value={activeFormState.numero_serie_onu || ''} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { numero_serie_onu: e.target.value })} 
                          onBlur={(e) => {
                            if (e.target.value) {
                              updateFormState(activeVisita.id_visita, { numero_serie_onu: normalizarGponSn(e.target.value) });
                            }
                          }}
                          placeholder="Ej. CDKT2A187B7D o escanea con cámara"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 800, boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* 2. ROUTER PRINCIPAL */}
                      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#6366f1', margin: 0 }}>📶 Router Principal:</label>
                        <select 
                          value={activeFormState.modelo_router} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { modelo_router: e.target.value })} 
                          style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.82rem' }}
                        >
                          <option value="">-- Ninguno --</option>
                          {catalogoRouter.map((r, idx) => <option key={idx} value={r.nombre}>{r.nombre}</option>)}
                        </select>

                        {/* Serie Router Principal */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '6px' }}>
                          <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                            Serie Router Principal {activeVisita.numero_serie_router ? `[Actual: ${activeVisita.numero_serie_router}]` : ''}:
                          </label>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => abrirEscanerEnVivo(activeVisita.id_visita, 'numero_serie_router', false, 'Escanear Router Principal')}
                              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <i className="fa-solid fa-camera"></i> 📷 Cámara
                            </button>
                            <label style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-images"></i> Foto
                              <input 
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    procesarFotoBarcodeParaCampo(e.target.files[0], activeVisita.id_visita, 'numero_serie_router', false);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <input 
                          type="text" 
                          value={activeFormState.numero_serie_router || ''} 
                          onChange={(e) => updateFormState(activeVisita.id_visita, { numero_serie_router: e.target.value.toUpperCase() })} 
                          placeholder="Opcional: Serie/MAC del Router Principal"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* 3. ADICIONAR ROUTER SECUNDARIO / MESH */}
                      {!activeFormState.tiene_mesh ? (
                        <button 
                          type="button" 
                          onClick={() => updateFormState(activeVisita.id_visita, { tiene_mesh: true, cantidad_routers: 2, tipo_mesh: activeFormState.tipo_mesh || 'CABLEADO' })} 
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px dashed #8b5cf6', background: 'rgba(139, 92, 246, 0.08)', color: '#c4b5fd', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <i className="fa-solid fa-plus"></i> + Adicionar Router Secundario / Mesh
                        </button>
                      ) : (
                        <div style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                            <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#c4b5fd', margin: 0 }}>🔁 Router Secundario / Mesh:</label>
                            <button 
                              type="button" 
                              onClick={() => updateFormState(activeVisita.id_visita, { tiene_mesh: false, router_secundario: '', numero_serie_router_secundario: '', cantidad_routers: 1 })} 
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                              <i className="fa-solid fa-trash"></i> Quitar
                            </button>
                          </div>

                          <select 
                            value={activeFormState.router_secundario} 
                            onChange={(e) => updateFormState(activeVisita.id_visita, { router_secundario: e.target.value })} 
                            style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.82rem' }}
                          >
                            <option value="">-- Seleccionar Router Secundario --</option>
                            {catalogoRouter.map((r, idx) => <option key={idx} value={r.nombre}>{r.nombre}</option>)}
                          </select>

                          {/* Serie Router Secundario */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                              Serie Router Secundario:
                            </label>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => abrirEscanerEnVivo(activeVisita.id_visita, 'numero_serie_router_secundario', false, 'Escanear Router Secundario')}
                                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                              >
                                <i className="fa-solid fa-camera"></i> 📷 Cámara
                              </button>
                              <label style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-images"></i> Foto
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      procesarFotoBarcodeParaCampo(e.target.files[0], activeVisita.id_visita, 'numero_serie_router_secundario', false);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                          <input 
                            type="text" 
                            value={activeFormState.numero_serie_router_secundario || ''} 
                            onChange={(e) => updateFormState(activeVisita.id_visita, { numero_serie_router_secundario: e.target.value.toUpperCase() })} 
                            placeholder="Opcional: Serie/MAC del Router Secundario"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                          />





                          {/* Tipo de Conexión Mesh */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Tipo de Conexión:</label>
                              <select 
                                value={activeFormState.tipo_mesh || 'CABLEADO'} 
                                onChange={(e) => updateFormState(activeVisita.id_visita, { tipo_mesh: e.target.value })} 
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.8rem' }}
                              >
                                <option value="CABLEADO">🔌 CABLEADO</option>
                                <option value="INALAMBRICO (MESH)">📶 INALÁMBRICO (MESH)</option>
                                <option value="REDES DISTINTAS (AP)">🔀 REDES DISTINTAS (AP)</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Cantidad Total Routers:</label>
                              <input 
                                type="number" 
                                min="1" 
                                max="10" 
                                value={activeFormState.cantidad_routers || 2} 
                                onChange={(e) => updateFormState(activeVisita.id_visita, { cantidad_routers: parseInt(e.target.value) || 1 })} 
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.8rem', textAlign: 'center', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* --- SECCIÓN INTELIGENTE: EQUIPOS RETIRADOS (CAMBIO / REEMPLAZO) --- */}
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                          <h6 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 850, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-box-archive"></i> ¿Hubo Retiro o Reemplazo de Equipos?
                          </h6>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Pasan a tu custodia móvil</span>
                        </div>

                        {/* Checkbox Retiro ONU */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 800, color: activeFormState.hubo_cambio_onu ? '#fca5a5' : '#cbd5e1' }}>
                            <input 
                              type="checkbox"
                              checked={!!activeFormState.hubo_cambio_onu}
                              onChange={(e) => updateFormState(activeVisita.id_visita, { 
                                hubo_cambio_onu: e.target.checked,
                                sn_retirado_onu: e.target.checked ? (activeFormState.sn_retirado_onu || activeVisita.numero_serie || '') : ''
                              })}
                              style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer' }}
                            />
                            📦 Se retiró una ONT / ONU anterior de este domicilio
                          </label>

                          {activeFormState.hubo_cambio_onu && (
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#fca5a5', margin: 0 }}>
                                  Serie (SN) ONU Retirada {activeVisita.numero_serie ? `[Anterior: ${activeVisita.numero_serie}]` : ''}:
                                </label>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => abrirEscanerEnVivo(activeVisita.id_visita, 'sn_retirado_onu', true, 'Escanear ONU Retirada')}
                                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <i className="fa-solid fa-camera"></i> 📷 Cámara
                                  </button>
                                  <label style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="fa-solid fa-images"></i> Foto
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          procesarFotoBarcodeParaCampo(e.target.files[0], activeVisita.id_visita, 'sn_retirado_onu', true);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                              <input 
                                type="text"
                                value={activeFormState.sn_retirado_onu || ''}
                                onChange={(e) => updateFormState(activeVisita.id_visita, { sn_retirado_onu: e.target.value })}
                                onBlur={(e) => {
                                  if (e.target.value) {
                                    updateFormState(activeVisita.id_visita, { sn_retirado_onu: normalizarGponSn(e.target.value) });
                                  }
                                }}
                                placeholder="SN de la ONU que retiras"
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ef4444', background: '#0f172a', color: '#fca5a5', fontSize: '0.85rem', fontWeight: 800, boxSizing: 'border-box' }}
                              />

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                  <label style={{ fontWeight: 700, fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Motivo de Retiro / Estado:</label>
                                  <select
                                    value={activeFormState.motivo_retiro_onu || 'DANADO_FALLA'}
                                    onChange={(e) => updateFormState(activeVisita.id_visita, { motivo_retiro_onu: e.target.value })}
                                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.8rem' }}
                                  >
                                    <option value="DANADO_FALLA">⚡ Dañado / Falla / Rayo (Garantía)</option>
                                    <option value="REEMPLAZO_UPGRADE">🔄 Operativo / Reemplazo (Reutilizable)</option>
                                    <option value="DANADO_CLIENTE">💧 Dañado por Cliente (Agua/Golpe)</option>
                                    <option value="OTRO">❓ Otro Motivo</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontWeight: 700, fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Detalle / Observación:</label>
                                  <input 
                                    type="text"
                                    value={activeFormState.obs_retiro_onu || ''}
                                    onChange={(e) => updateFormState(activeVisita.id_visita, { obs_retiro_onu: e.target.value })}
                                    placeholder="Ej. No enciende / Puerto PON quemado"
                                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.8rem', boxSizing: 'border-box' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Checkbox Retiro Router */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 800, color: activeFormState.hubo_cambio_router ? '#fca5a5' : '#cbd5e1' }}>
                            <input 
                              type="checkbox"
                              checked={!!activeFormState.hubo_cambio_router}
                              onChange={(e) => updateFormState(activeVisita.id_visita, { 
                                hubo_cambio_router: e.target.checked,
                                sn_retirado_router: e.target.checked ? (activeFormState.sn_retirado_router || activeVisita.numero_serie_router || '') : ''
                              })}
                              style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer' }}
                            />
                            📦 Se retiró un Router anterior de este domicilio
                          </label>

                          {activeFormState.hubo_cambio_router && (
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.78rem', color: '#fca5a5', margin: 0 }}>
                                  Serie (SN / MAC) Router Retirado {activeVisita.numero_serie_router ? `[Anterior: ${activeVisita.numero_serie_router}]` : ''}:
                                </label>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => abrirEscanerEnVivo(activeVisita.id_visita, 'sn_retirado_router', false, 'Escanear Router Retirado')}
                                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <i className="fa-solid fa-camera"></i> 📷 Cámara
                                  </button>
                                  <label style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="fa-solid fa-images"></i> Foto
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          procesarFotoBarcodeParaCampo(e.target.files[0], activeVisita.id_visita, 'sn_retirado_router', false);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                              <input 
                                type="text"
                                value={activeFormState.sn_retirado_router || ''}
                                onChange={(e) => updateFormState(activeVisita.id_visita, { sn_retirado_router: e.target.value.toUpperCase() })}
                                placeholder="SN / MAC del Router que retiras"
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ef4444', background: '#0f172a', color: '#fca5a5', fontSize: '0.85rem', fontWeight: 800, boxSizing: 'border-box' }}
                              />

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                  <label style={{ fontWeight: 700, fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Motivo de Retiro / Estado:</label>
                                  <select
                                    value={activeFormState.motivo_retiro_router || 'DANADO_FALLA'}
                                    onChange={(e) => updateFormState(activeVisita.id_visita, { motivo_retiro_router: e.target.value })}
                                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.8rem' }}
                                  >
                                    <option value="DANADO_FALLA">⚡ Dañado / No Enciende (Garantía)</option>
                                    <option value="REEMPLAZO_UPGRADE">🔄 Operativo / Reemplazo (Reutilizable)</option>
                                    <option value="DANADO_CLIENTE">💧 Dañado por Cliente (Agua/Golpe)</option>
                                    <option value="OTRO">❓ Otro Motivo</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontWeight: 700, fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Detalle / Observación:</label>
                                  <input 
                                    type="text"
                                    value={activeFormState.obs_retiro_router || ''}
                                    onChange={(e) => updateFormState(activeVisita.id_visita, { obs_retiro_router: e.target.value })}
                                    placeholder="Ej. Reemplazado por Gigabit / Falla Wi-Fi"
                                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '0.8rem', boxSizing: 'border-box' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

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
                      <strong style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '8px', color: '#94a3b8' }}>📷 Evidencia Fotográfica:</strong>
                      
                      {activeFormState.equipos_juntos ? (
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Foto conjunta de ONU y Router:</label>
                          <label style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: '#f8fafc', border: '1px solid #475569', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                            <i className="fa-solid fa-images" style={{ color: '#38bdf8' }}></i> Seleccionar Foto (Galería)
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, 'foto_equipos', 'preview-foto-conjunta')} 
                              style={{ display: 'none' }}
                            />
                          </label>
                          <div style={{ marginTop: '8px', textAlign: 'center' }}>
                            <img id="preview-foto-conjunta" style={{ maxWidth: '100%', maxHeight: '110px', display: activeFormState.foto_equipos_base64 ? 'block' : 'none', borderRadius: '6px', margin: '0 auto', border: '1px solid #475569' }} src={activeFormState.foto_equipos_base64} alt="Preview" />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Foto de ONU:</label>
                            <label style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: '#f8fafc', border: '1px solid #475569', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                              <i className="fa-solid fa-images" style={{ color: '#38bdf8' }}></i> Seleccionar Foto ONU (Galería)
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, 'foto_equipos', 'preview-foto-onu')} 
                                style={{ display: 'none' }}
                              />
                            </label>
                            <div style={{ marginTop: '6px', textAlign: 'center' }}>
                              <img id="preview-foto-onu" style={{ maxWidth: '100%', maxHeight: '100px', display: activeFormState.foto_equipos_base64 ? 'block' : 'none', borderRadius: '6px', margin: '0 auto', border: '1px solid #475569' }} src={activeFormState.foto_equipos_base64} alt="ONU Preview" />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Foto de Router:</label>
                            <label style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: '#f8fafc', border: '1px solid #475569', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                              <i className="fa-solid fa-images" style={{ color: '#38bdf8' }}></i> Seleccionar Foto Router (Galería)
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, 'foto_equipos_2', 'preview-foto-router')} 
                                style={{ display: 'none' }}
                              />
                            </label>
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
                              <label style={{ display: 'block', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid #475569', padding: '6px 4px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                                <i className="fa-solid fa-images" style={{ color: '#38bdf8' }}></i> Galería
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => comprimirYConvertirFoto(activeVisita.id_visita, e.target, `foto_extra_${idx}`, `preview-foto-extra-${idx}`)} 
                                  style={{ display: 'none' }} 
                                />
                              </label>
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
                              onClick={() => enviarLinkFirmaWhatsApp(activeVisita.telefonos, tecnicoRealName, activeVisita.token_rastreo, activeVisita.id_visita)} 
                              style={{ flex: 1, padding: '9px', borderRadius: '6px', border: 'none', background: '#25d366', color: 'white', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <i className="fa-brands fa-whatsapp"></i> WhatsApp
                            </button>
                            <button 
                              type="button" 
                              onClick={() => mostrarQRDeFirma(activeVisita.token_rastreo, activeVisita.cliente, activeVisita.id_visita)} 
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', flexShrink: 0 }}>
              <h5 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-triangle-exclamation fa-beat"></i> Declarar Emergencia
              </h5>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain', flex: 1 }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: '#4b5563', flexShrink: 0 }}>
              <h5 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 800 }}><i className="fa-solid fa-clock"></i> Posponer Visita</h5>
            </div>
            <form onSubmit={posponerVisitaSubmit} style={{ margin: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain', flex: 1 }}>
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
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '420px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            animation: 'futurityToastSlideIn 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
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
                  fontSize: '1.1rem',
                  flexShrink: 0
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
                type="button"
                onClick={() => setShowProfileModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.6rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Options (Con scroll táctil completo en móviles) */}
            <div style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
              flex: 1
            }}>
              
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

              {/* Navegación Rápida a Pestañas del Panel */}
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Acceso Rápido
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setActiveMainTab('vehiculo');
                    cargarInventarioVehiculo();
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-truck-moving"></i> 🚐 Ir a Mi Vehículo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setActiveMainTab('pedidos');
                    cargarMisRequisiciones();
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-boxes-packing"></i> 📦 Ir a Mis Pedidos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setShowTraspasoModal(true);
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#38bdf8', fontWeight: 800, cursor: 'pointer', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-arrow-right-arrow-left"></i> 🔄 Traspasar / Devolver
                </button>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => { setShowProfileModal(false); onLogout(); }}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.18)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontWeight: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.92rem', marginTop: '6px', marginBottom: '10px', flexShrink: 0 }}
              >
                <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
              </button>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR MATERIALES A BODEGA (DESDE EL CELULAR DEL TÉCNICO) */}
      {showSolicitudBodegaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            
            {/* Header */}
            <div style={{ padding: '18px 22px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-boxes-packing" style={{ color: '#38bdf8' }}></i> Pedido de Insumos a Bodega
                </h4>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                  🚗 Buseta: <strong style={{ color: '#38bdf8' }}>{inventarioVehiculoData.placa || 'S/P'}</strong>
                </span>
              </div>
              <button onClick={() => setShowSolicitudBodegaModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}>&times;</button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleEnviarSolicitudBodegaSubmit} style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                    Materiales Requeridos:
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemSolicitudBodega}
                    style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    + Agregar Ítem
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                  {solicitudBodegaItems.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: '8px', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <select
                        required
                        value={it.id_material}
                        onChange={(e) => handleItemChangeSolicitudBodega(idx, 'id_material', e.target.value)}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '0.8rem' }}
                      >
                        <option value="">-- Elegir Material --</option>
                        {(catalogoMateriales || []).map((m) => (
                          <option key={m.id_material} value={m.id_material}>
                            {m.nombre_material} ({m.unidad_medida})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Cant"
                        value={it.cantidad_solicitada}
                        onChange={(e) => handleItemChangeSolicitudBodega(idx, 'cantidad_solicitada', e.target.value)}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}
                      />

                      {solicitudBodegaItems.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemSolicitudBodega(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '1rem', cursor: 'pointer' }}
                        >
                          &times;
                        </button>
                      ) : <div></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Nota / Motivo del Pedido (Opcional):
                </label>
                <textarea
                  rows="2"
                  placeholder="Ej: Reposición para jornada de la tarde..."
                  value={solicitudBodegaObs}
                  onChange={(e) => setSolicitudBodegaObs(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowSolicitudBodegaModal(false)}
                  style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoSolicitudBodega}
                  style={{ padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: 'white', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}
                >
                  {enviandoSolicitudBodega ? 'Enviando...' : 'Enviar Pedido a Bodega 🚀'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRASPASO DE MATERIAL ENTRE TÉCNICOS / BODEGA */}
      {showTraspasoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 200000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', width: '100%', maxWidth: '420px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-arrow-right-arrow-left" style={{ color: '#10b981' }}></i> Transferencia o Devolución
              </h4>
              <button type="button" onClick={() => setShowTraspasoModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.6rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>&times;</button>
            </div>

            <form onSubmit={handleTraspasoSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain', flex: 1 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Destino (Quien recibe):</label>
                <select
                  value={traspasoForm.tecnico_destino_nombre}
                  onChange={(e) => setTraspasoForm({ ...traspasoForm, tecnico_destino_nombre: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}
                  required
                >
                  <option value="">-- Seleccione Destino --</option>
                  <option value="BODEGA_CENTRAL" style={{ background: '#1e3a8a', color: '#60a5fa', fontWeight: 800 }}>🏢 BODEGA CENTRAL (Devolución)</option>
                  <optgroup label="Técnicos Cuadrilla">
                    {tecnicosLista.map((t, i) => (
                      <option key={i} value={t.nombre}>{t.nombre} ({t.placa})</option>
                    ))}
                  </optgroup>
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
                  {traspasoLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>} Procesar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ESCÁNER DE CÁMARA EN VIVO PARA CÓDIGOS DE BARRA / SN */}
      {scannerLiveModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 300000, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          
          {/* Header */}
          <div style={{ width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>📷</span>
              <h4 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: 800 }}>
                {scannerLiveModal.title || 'Escáner en Vivo'}
              </h4>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  style={{ background: torchOn ? '#fbbf24' : 'rgba(255,255,255,0.15)', color: torchOn ? '#000' : '#fff', border: 'none', width: '38px', height: '38px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}
                  title="Encender / Apagar Linterna"
                >
                  <i className="fa-solid fa-lightbulb"></i>
                </button>
              )}
              <button
                type="button"
                onClick={cerrarEscanerEnVivo}
                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', width: '38px', height: '38px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900 }}
              >
                &times;
              </button>
            </div>
          </div>

          {/* Viewfinder Container */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '440px', flex: 1, margin: '16px 0', borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={scannerVideoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Target Box Overlay */}
            <div style={{ position: 'absolute', width: '82%', height: '48%', border: '2px dashed #10b981', borderRadius: '16px', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '10px', boxSizing: 'border-box' }}>
              <div style={{ width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, #10b981, transparent)', animation: 'scannerLaser 2s infinite ease-in-out', position: 'absolute', top: 0, left: 0 }} />
              <span style={{ background: 'rgba(0,0,0,0.7)', color: '#a7f3d0', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Enfoca la Serie / Código de Barras
              </span>
            </div>

            {cameraError && (
              <div style={{ position: 'absolute', padding: '20px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #ef4444', borderRadius: '16px', textAlign: 'center', color: '#fca5a5', maxWidth: '85%' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 700 }}>{cameraError}</p>
                <button
                  type="button"
                  onClick={cerrarEscanerEnVivo}
                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', zIndex: 10 }}>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center' }}>
              {scanningStatus}
            </p>
            <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
              <button
                type="button"
                onClick={cerrarEscanerEnVivo}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
              <label style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <i className="fa-solid fa-images"></i> Elegir Foto
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      cerrarEscanerEnVivo();
                      procesarFotoBarcodeParaCampo(file, scannerLiveModal.visitaId, scannerLiveModal.campo, scannerLiveModal.isGpon);
                    }
                  }}
                />
              </label>
            </div>
          </div>

        </div>
      )}

      {/* MODAL DE FIRMA DIGITAL PARA RECEPCIÓN DE REQUISICIÓN */}
      <FirmaCanvasModal
        isOpen={showFirmaReqModal}
        onClose={() => {
          setShowFirmaReqModal(false);
          setSelectedReqParaFirmar(null);
        }}
        onSave={handleGuardarFirmaReq}
        titulo={`Firma de Recepción: ${selectedReqParaFirmar?.numero_solicitud || ''}`}
        subtitulo={`Confirmo la entrega y recepción física de los materiales aprobados para el vehículo ${selectedReqParaFirmar?.placa_vehiculo || ''}`}
      />

    </div>
  );
}

export default TecnicoPanel;

