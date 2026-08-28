import React, { useState, useEffect, useRef } from 'react';

export default function EquiposBodegaTab() {
  const [resumen, setResumen] = useState({
    totales: { en_bodega: 0, en_vehiculo: 0, instalados: 0, retirados: 0, total: 0 },
    modelos: [],
    placas: []
  });
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogoModelosOnt, setCatalogoModelosOnt] = useState([]);
  const [catalogoModelosRouter, setCatalogoModelosRouter] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('EN_BODEGA');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Subpestañas Principales ('trazabilidad' | 'retirados')
  const [subTabEquipos, setSubTabEquipos] = useState('trazabilidad');

  // Estado Equipos Retirados por Técnicos
  const [equiposRetirados, setEquiposRetirados] = useState([]);
  const [loadingRetirados, setLoadingRetirados] = useState(false);
  const [filtroCustodiaRetirados, setFiltroCustodiaRetirados] = useState('TODOS');
  const [filtroPlacaRetirados, setFiltroPlacaRetirados] = useState('TODAS');
  const [busquedaRetirados, setBusquedaRetirados] = useState('');

  // Modales
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showDespachoModal, setShowDespachoModal] = useState(false);

  // Formulario de Ingreso Masivo
  const [ingresoTipo, setIngresoTipo] = useState('ROUTER');
  const [ingresoModelo, setIngresoModelo] = useState('Router TPLink EX511');
  const [ingresoMarca, setIngresoMarca] = useState('TP-LINK');
  const [ingresoSerialInput, setIngresoSerialInput] = useState('');
  const [ingresoSeriales, setIngresoSeriales] = useState([]);
  const [ingresoObservacion, setIngresoObservacion] = useState('');
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);

  // Formulario de Despacho a Buseta
  const [despachoPlaca, setDespachoPlaca] = useState('');
  const [despachoSerialInput, setDespachoSerialInput] = useState('');
  const [despachoSeriales, setDespachoSeriales] = useState([]);
  const [guardandoDespacho, setGuardandoDespacho] = useState(false);

  const inputIngresoRef = useRef(null);
  const inputDespachoRef = useRef(null);

  const getToken = () => localStorage.getItem('token') || localStorage.getItem('session_token') || '';

  // Sonido de confirmación con Web Audio API al escanear
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const playErrorSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  useEffect(() => {
    cargarCatalogos();
    cargarResumen();
    cargarEquipos();
  }, []);

  useEffect(() => {
    cargarEquipos();
  }, [filtroEstado, filtroModelo, filtroPlaca, filtroTipo, busqueda]);

  const cargarCatalogos = async () => {
    const token = getToken();

    // 1. Cargar Vehículos / Placas
    try {
      const resVeh = await fetch('/api/admin/vehiculos', { headers: { 'Authorization': `Bearer ${token}` } });
      const dataVeh = await resVeh.json();
      if (dataVeh?.status === 'ok' && dataVeh.vehiculos?.length > 0) {
        setVehiculos(dataVeh.vehiculos);
        setDespachoPlaca(dataVeh.vehiculos[0].placa);
      } else {
        // Fallback si no hay vehiculos en la API
        const defaultPlacas = [
          { id_vehiculo: 1, placa: 'ABE-9377', descripcion: 'Buseta ABE-9377' },
          { id_vehiculo: 2, placa: 'ABF-7051', descripcion: 'Buseta ABF-7051' },
          { id_vehiculo: 3, placa: 'ABF-8597', descripcion: 'Buseta ABF-8597' },
          { id_vehiculo: 4, placa: 'ABJ-3789', descripcion: 'Buseta ABJ-3789' },
          { id_vehiculo: 5, placa: 'ABJ-3796', descripcion: 'Buseta ABJ-3796' },
          { id_vehiculo: 6, placa: 'ABC-9839', descripcion: 'Furgoneta Ventas' },
          { id_vehiculo: 7, placa: 'S/P', descripcion: 'Sin Placa / Apoyo' },
        ];
        setVehiculos(defaultPlacas);
        setDespachoPlaca(defaultPlacas[0].placa);
      }
    } catch (e) {
      console.error('Error cargando vehículos:', e);
      const defaultPlacas = [
        { id_vehiculo: 1, placa: 'ABE-9377', descripcion: 'Buseta ABE-9377' },
        { id_vehiculo: 2, placa: 'ABF-7051', descripcion: 'Buseta ABF-7051' },
        { id_vehiculo: 3, placa: 'ABF-8597', descripcion: 'Buseta ABF-8597' },
        { id_vehiculo: 4, placa: 'ABJ-3789', descripcion: 'Buseta ABJ-3789' },
        { id_vehiculo: 5, placa: 'ABJ-3796', descripcion: 'Buseta ABJ-3796' },
        { id_vehiculo: 6, placa: 'ABC-9839', descripcion: 'Furgoneta Ventas' },
        { id_vehiculo: 7, placa: 'S/P', descripcion: 'Sin Placa / Apoyo' },
      ];
      setVehiculos(defaultPlacas);
      setDespachoPlaca(defaultPlacas[0].placa);
    }

    // 2. Cargar Catálogos ONT y Router
    const defaultRouters = [
      { id_router: 13, nombre: 'Router TPLink EX511' },
      { id_router: 12, nombre: 'Router Huawei AX3' },
      { id_router: 14, nombre: 'Router Huawei AX2' },
      { id_router: 15, nombre: 'ROUTER MERCUSYS MR70X' },
      { id_router: 3, nombre: 'TPLINK WIFI 6' },
      { id_router: 17, nombre: 'Router Tp-Link Archer AX10' },
      { id_router: 16, nombre: 'Router TPLink 840n' },
      { id_router: 6, nombre: 'MIKROTIK' },
      { id_router: 7, nombre: 'OTROS' }
    ];
    const defaultOnts = [
      { id_ont: 15, nombre: 'XX231v' },
      { id_ont: 14, nombre: 'XX530v' },
      { id_ont: 2, nombre: 'HUAWEI' },
      { id_ont: 3, nombre: 'TP-LINK' },
      { id_ont: 4, nombre: 'CDATA' },
      { id_ont: 20, nombre: 'XZ000-G7' },
      { id_ont: 21, nombre: 'XN020-G3v' },
      { id_ont: 1, nombre: 'KINGTYPE' },
      { id_ont: 22, nombre: 'ZHIYI' },
      { id_ont: 9, nombre: 'OTROS' }
    ];

    try {
      const resOnt = await fetch('/api/admin/catalogo_ont', { headers: { 'Authorization': `Bearer ${token}` } });
      const dataOnt = await resOnt.json();
      if (dataOnt?.catalogos && dataOnt.catalogos.length > 0) {
        setCatalogoModelosOnt(dataOnt.catalogos);
      } else {
        setCatalogoModelosOnt(defaultOnts);
      }
    } catch (e) {
      console.error('Error cargando catalogo ONT:', e);
      setCatalogoModelosOnt(defaultOnts);
    }

    try {
      const resRouter = await fetch('/api/admin/catalogo_router', { headers: { 'Authorization': `Bearer ${token}` } });
      const dataRouter = await resRouter.json();
      if (dataRouter?.catalogos && dataRouter.catalogos.length > 0) {
        setCatalogoModelosRouter(dataRouter.catalogos);
      } else {
        setCatalogoModelosRouter(defaultRouters);
      }
    } catch (e) {
      console.error('Error cargando catalogo Router:', e);
      setCatalogoModelosRouter(defaultRouters);
    }
  };

  const cargarResumen = async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/equipos/resumen', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setResumen(data);
      }
    } catch (e) {
      console.error('Error cargando resumen:', e);
    }
  };

  const cargarEquipos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroModelo) params.append('modelo', filtroModelo);
      if (filtroPlaca) params.append('placa', filtroPlaca);
      if (filtroTipo) params.append('tipo', filtroTipo);
      if (busqueda) params.append('search', busqueda);

      const token = getToken();
      const res = await fetch(`/api/equipos/lista?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        setEquipos(data.equipos || []);
      }
    } catch (e) {
      console.error('Error cargando lista de equipos:', e);
    } finally {
      setLoading(false);
    }
  };

  const cargarEquiposRetirados = async () => {
    setLoadingRetirados(true);
    try {
      const token = getToken();
      let url = `/api/admin/equipos_retirados?estado_custodia=${filtroCustodiaRetirados}&placa=${filtroPlacaRetirados}&search=${encodeURIComponent(busquedaRetirados)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.status === 'ok') {
        setEquiposRetirados(data.equipos_retirados || []);
      }
    } catch (e) {
      console.error('Error cargando equipos retirados:', e);
    } finally {
      setLoadingRetirados(false);
    }
  };

  const handleRecibirEquipoRetirado = async (id_retiro) => {
    if (!window.confirm("¿Confirmas la recepción física de este equipo en Bodega Central?")) return;
    try {
      const token = getToken();
      const res = await fetch(`/api/admin/equipos_retirados/${id_retiro}/recibir_bodega`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'ok') {
        alert(data.message || "Equipo recibido en Bodega.");
        cargarEquiposRetirados();
        cargarResumen();
      } else {
        alert(data?.message || "Error al recibir equipo");
      }
    } catch (e) {
      alert("Error de conexión");
    }
  };

  useEffect(() => {
    cargarEquiposRetirados();
  }, [filtroCustodiaRetirados, filtroPlacaRetirados, busquedaRetirados]);

  // Manejador de escaneo en Ingreso Masivo
  const handleKeyDownIngreso = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sn = ingresoSerialInput.trim().toUpperCase();
      if (!sn) return;

      if (ingresoSeriales.includes(sn)) {
        playErrorSound();
        alert(`⚠️ El número de serie "${sn}" ya está en la lista de escaneo actual.`);
        setIngresoSerialInput('');
        return;
      }

      playBeep();
      setIngresoSeriales([sn, ...ingresoSeriales]);
      setIngresoSerialInput('');
    }
  };

  // Guardar Lote en Bodega
  const handleGuardarIngreso = async () => {
    if (ingresoSeriales.length === 0) {
      alert('Por favor pistolea o escribe al menos un número de serie.');
      return;
    }
    setGuardandoIngreso(true);
    try {
      const token = getToken();
      const res = await fetch('/api/equipos/ingreso_masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo_equipo: ingresoTipo,
          modelo: ingresoModelo,
          marca: ingresoMarca,
          seriales: ingresoSeriales,
          observacion: ingresoObservacion
        })
      });
      const data = await res.json();

      if (data?.status === 'ok') {
        alert(`✅ ${data.message}`);
        setShowIngresoModal(false);
        setIngresoSeriales([]);
        setIngresoSerialInput('');
        setIngresoObservacion('');
        cargarResumen();
        cargarEquipos();
      } else {
        alert(`❌ ${data.message || 'Error al guardar'}`);
      }
    } catch (e) {
      alert(`❌ Error al guardar: ${e.message}`);
    } finally {
      setGuardandoIngreso(false);
    }
  };

  // Manejador de escaneo en Despacho a Buseta
  const handleKeyDownDespacho = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sn = despachoSerialInput.trim().toUpperCase();
      if (!sn) return;

      if (despachoSeriales.includes(sn)) {
        playErrorSound();
        alert(`⚠️ El serial "${sn}" ya fue escaneado.`);
        setDespachoSerialInput('');
        return;
      }

      playBeep();
      setDespachoSeriales([sn, ...despachoSeriales]);
      setDespachoSerialInput('');
    }
  };

  // Guardar Despacho a Buseta
  const handleGuardarDespacho = async () => {
    if (despachoSeriales.length === 0) {
      alert('Por favor pistolea al menos un equipo a despachar.');
      return;
    }
    if (!despachoPlaca) {
      alert('Selecciona la placa de la buseta.');
      return;
    }

    setGuardandoDespacho(true);
    try {
      const token = getToken();
      const res = await fetch('/api/equipos/despacho_buseta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          placa_vehiculo: despachoPlaca,
          seriales: despachoSeriales
        })
      });
      const data = await res.json();

      if (data?.status === 'ok') {
        alert(`🚐 ${data.message}`);
        setShowDespachoModal(false);
        setDespachoSeriales([]);
        setDespachoSerialInput('');
        cargarResumen();
        cargarEquipos();
      } else {
        alert(`❌ ${data.message || 'Error al despachar'}`);
      }
    } catch (e) {
      alert(`❌ Error al despachar: ${e.message}`);
    } finally {
      setGuardandoDespacho(false);
    }
  };

  const handleEliminarEquipo = async (id, sn) => {
    if (!window.confirm(`¿Estás seguro de eliminar el equipo con serial "${sn}"?`)) return;
    try {
      const token = getToken();
      await fetch(`/api/equipos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      cargarResumen();
      cargarEquipos();
    } catch (e) {
      alert('Error eliminando equipo');
    }
  };

  const modelosRapidos = [
    { label: 'EX511 (Wi-Fi 6)', modelo: 'Router TPLink EX511', tipo: 'ROUTER', marca: 'TP-LINK' },
    { label: 'XX231v (ONT GPON)', modelo: 'XX231v', tipo: 'ONT', marca: 'TP-LINK' },
    { label: 'XX530v (ONT Dual Band)', modelo: 'XX530v', tipo: 'ONT', marca: 'TP-LINK' },
    { label: 'Huawei AX3', modelo: 'Router Huawei AX3', tipo: 'ROUTER', marca: 'HUAWEI' },
    { label: 'Huawei AX2', modelo: 'Router Huawei AX2', tipo: 'ROUTER', marca: 'HUAWEI' },
    { label: 'Mercusys MR70X', modelo: 'ROUTER MERCUSYS MR70X', tipo: 'ROUTER', marca: 'MERCUSYS' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* HEADER Y BOTONES DE ACCIÓN */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 24px',
        borderRadius: '20px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#10b981',
              color: 'white',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-barcode"></i>
            </span>
            Control de Equipos (ONUs y Routers)
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
            Trazabilidad por código de barras / serial desde Bodega hasta la Buseta y el Cliente.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button
            onClick={() => {
              setShowIngresoModal(true);
              setTimeout(() => inputIngresoRef.current?.focus(), 150);
            }}
            style={{
              padding: '10px 18px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              transition: 'transform 0.1s'
            }}
          >
            <i className="fa-solid fa-qrcode"></i> Ingreso con Lector (Pistola)
          </button>

          <button
            onClick={() => {
              setShowDespachoModal(true);
              setTimeout(() => inputDespachoRef.current?.focus(), 150);
            }}
            style={{
              padding: '10px 18px',
              background: '#1f497d',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(31, 73, 125, 0.25)',
              transition: 'transform 0.1s'
            }}
          >
            <i className="fa-solid fa-truck-ramp-box"></i> Despacho a Buseta
          </button>
        </div>
      </div>

      {/* METRICAS GENERALES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div
          onClick={() => setFiltroEstado('EN_BODEGA')}
          style={{ cursor: 'pointer', background: 'var(--card-bg)', border: filtroEstado === 'EN_BODEGA' ? '2px solid #10b981' : '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>En Bodega Central</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>{resumen.totales.en_bodega}</p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-warehouse"></i>
          </div>
        </div>

        <div
          onClick={() => setFiltroEstado('EN_VEHICULO')}
          style={{ cursor: 'pointer', background: 'var(--card-bg)', border: filtroEstado === 'EN_VEHICULO' ? '2px solid #1f497d' : '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>En Busetas</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 900, color: '#1f497d' }}>{resumen.totales.en_vehiculo}</p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(31, 73, 125, 0.12)', color: '#1f497d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-van-shuttle"></i>
          </div>
        </div>

        <div
          onClick={() => setFiltroEstado('INSTALADO_CLIENTE')}
          style={{ cursor: 'pointer', background: 'var(--card-bg)', border: filtroEstado === 'INSTALADO_CLIENTE' ? '2px solid #8b5cf6' : '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Instalados Clientes</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 900, color: '#8b5cf6' }}>{resumen.totales.instalados}</p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-house-signal"></i>
          </div>
        </div>

        <div
          onClick={() => setFiltroEstado('RETIRADO_AVERIA')}
          style={{ cursor: 'pointer', background: 'var(--card-bg)', border: filtroEstado === 'RETIRADO_AVERIA' ? '2px solid #ef4444' : '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>Retirados / Avería</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>{resumen.totales.retirados}</p>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>
      </div>

      {/* TARJETAS DE STOCK POR MODELOS Y MARCAS */}
      {filtroEstado !== 'RETIRADO_AVERIA' && (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.82rem', fontWeight: 900, color: 'var(--sidebar-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🏷️ Stock en Bodega por Modelo
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
            {resumen.modelos.map((m, idx) => (
              <div
                key={idx}
                onClick={() => setFiltroModelo(filtroModelo === m.modelo ? '' : m.modelo)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: filtroModelo === m.modelo ? 'rgba(16, 185, 129, 0.12)' : 'var(--card-bg)',
                  border: filtroModelo === m.modelo ? '2px solid #10b981' : '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', background: 'var(--profile-bg)', color: '#1f497d', padding: '2px 6px', borderRadius: '6px' }}>
                    {m.tipo_equipo}
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>{m.en_bodega} u.</span>
                </div>
                <p style={{ margin: '8px 0 2px 0', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.modelo}
                </p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>{m.marca}</p>
              </div>
            ))}
            {resumen.modelos.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--sidebar-text)', background: 'var(--card-bg)', borderRadius: '14px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                No hay equipos registrados aún. Haz clic en "Ingreso con Lector" para empezar a registrar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLA PRINCIPAL Y FILTROS */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
        {/* Barra de Filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { id: 'EN_BODEGA', label: '🏢 En Bodega' },
              { id: 'EN_VEHICULO', label: '🚐 En Busetas' },
              { id: 'INSTALADO_CLIENTE', label: '🏠 Instalados' },
              { id: 'RETIRADO_AVERIA', label: `⚠️ Retirados (${resumen.totales.retirados || 0})` }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFiltroEstado(st.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: filtroEstado === st.id ? (st.id === 'RETIRADO_AVERIA' ? '#ef4444' : '#1f497d') : 'var(--profile-bg)',
                  color: filtroEstado === st.id ? 'white' : 'var(--text-main)',
                  transition: 'all 0.15s'
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 250px', maxWidth: '350px' }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={filtroEstado === 'RETIRADO_AVERIA' ? "Buscar Serial, Técnico, Cliente..." : "Buscar Serial, Contrato, Cliente..."}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--profile-bg)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 700,
                boxSizing: 'border-box'
              }}
            />
            {filtroModelo && (
              <button
                onClick={() => setFiltroModelo('')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '10px',
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ✕ {filtroModelo}
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 900 }}>
                <th style={{ padding: '10px 14px', width: '30px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '10px 14px' }}>Tipo / Marca</th>
                <th style={{ padding: '10px 14px' }}>Modelo</th>
                <th style={{ padding: '10px 14px' }}>Número de Serie (SN)</th>
                <th style={{ padding: '10px 14px' }}>Estado / Ubicación</th>
                <th style={{ padding: '10px 14px' }}>{filtroEstado === 'RETIRADO_AVERIA' ? 'Cliente / Motivo Retiro' : 'Cliente / Contrato'}</th>
                <th style={{ padding: '10px 14px' }}>{filtroEstado === 'RETIRADO_AVERIA' ? 'Fecha Retiro' : 'Fecha Ingreso'}</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((eq, i) => (
                <tr key={eq.id_equipo || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      background: eq.tipo_equipo === 'ONU' || eq.tipo_equipo === 'ONT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      color: eq.tipo_equipo === 'ONU' || eq.tipo_equipo === 'ONT' ? '#34d399' : '#a5b4fc',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      marginRight: eq.marca && eq.marca !== eq.tipo_equipo ? '6px' : '0'
                    }}>
                      {eq.tipo_equipo}
                    </span>
                    {eq.marca && eq.marca !== eq.tipo_equipo && (
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{eq.marca}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>{eq.modelo}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontFamily: 'monospace', padding: '3px 8px', borderRadius: '6px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: filtroEstado === 'RETIRADO_AVERIA' ? '#f59e0b' : '#10b981', fontWeight: 900 }}>
                      {eq.numero_serie}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', minWidth: '170px' }}>
                    {eq.estado === 'EN_BODEGA' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        🏢 En Bodega Central
                      </span>
                    )}
                    {eq.estado === 'EN_VEHICULO' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(31, 73, 125, 0.15)', color: '#38bdf8', fontWeight: 800, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        🚐 Buseta: {eq.ubicacion_placa}
                      </span>
                    )}
                    {eq.estado === 'INSTALADO_CLIENTE' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', fontWeight: 800, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        🏠 Instalado
                      </span>
                    )}
                    {eq.estado === 'RETIRADO_AVERIA' && (
                      eq.estado_custodia === 'EN_VEHICULO' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: 800, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                            🚐 En Buseta: {eq.ubicacion_placa || 'S/P'}
                          </span>
                          {eq.tecnico_entrega && (
                            <small style={{ color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.72rem' }}>
                              Resp: {eq.tecnico_entrega}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 800, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                          🏢 Devuelto a Bodega
                        </span>
                      )
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {filtroEstado === 'RETIRADO_AVERIA' ? (
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem' }}>{eq.nombre_cliente || 'N/A'}</div>
                        <div style={{ fontSize: '0.74rem', color: '#ef4444', fontWeight: 700 }}>
                          Motivo: {eq.motivo_retiro || 'AVERÍA'}
                          {eq.observacion_retiro ? ` (${eq.observacion_retiro})` : ''}
                        </div>
                      </div>
                    ) : eq.contrato_cliente ? (
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>Contrato #{eq.contrato_cliente}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)' }}>{eq.nombre_cliente}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--sidebar-text)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    {eq.fecha_ingreso_bodega ? eq.fecha_ingreso_bodega.substring(0, 16).replace('T', ' ') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    {filtroEstado === 'RETIRADO_AVERIA' ? (
                      eq.estado_custodia === 'EN_VEHICULO' ? (
                        <button
                          type="button"
                          onClick={() => handleRecibirEquipoRetirado(eq.id_retiro)}
                          style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}
                        >
                          <i className="fa-solid fa-inbox"></i> Recibir
                        </button>
                      ) : (
                        <span style={{ color: 'var(--sidebar-text)', fontSize: '0.72rem', fontWeight: 700 }}>
                          Recibido por {eq.recibido_por || 'Bodega'}
                        </span>
                      )
                    ) : (
                      <button
                        onClick={() => handleEliminarEquipo(eq.id_equipo, eq.numero_serie)}
                        style={{ padding: '4px 8px', background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer', borderRadius: '6px' }}
                        title="Eliminar registro"
                      >
                        <i className="fa-solid fa-trash-can" style={{ color: '#ef4444' }}></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {equipos.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    No se encontraron equipos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: INGRESO MASIVO CON LECTOR DE CÓDIGOS DE BARRA */}
      {/* ============================================================ */}
      {showIngresoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-qrcode" style={{ color: '#10b981' }}></i> Ingreso de Lote con Pistola de Barras
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                  Selecciona la marca/modelo y pistolea los números de serie en ráfaga.
                </p>
              </div>
              <button
                onClick={() => setShowIngresoModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
              {/* Selección de Tipo y Modelo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tipo de Equipo
                  </label>
                  <select
                    value={ingresoTipo}
                    onChange={(e) => {
                      setIngresoTipo(e.target.value);
                      if (e.target.value === 'ONT' && catalogoModelosOnt.length > 0) {
                        setIngresoModelo(catalogoModelosOnt[0].nombre);
                      } else if (e.target.value === 'ROUTER' && catalogoModelosRouter.length > 0) {
                        setIngresoModelo(catalogoModelosRouter[0].nombre);
                      }
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 800 }}
                  >
                    <option value="ROUTER">ROUTER</option>
                    <option value="ONT">ONT / ONU</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Modelo Exacto
                  </label>
                  <select
                    value={ingresoModelo}
                    onChange={(e) => setIngresoModelo(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 800 }}
                  >
                    {ingresoTipo === 'ROUTER'
                      ? catalogoModelosRouter.map((r) => <option key={r.id_router} value={r.nombre}>{r.nombre}</option>)
                      : catalogoModelosOnt.map((o) => <option key={o.id_ont} value={o.nombre}>{o.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* Botones de Modelos Frecuentes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Modelos Frecuentes:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {modelosRapidos.map((mr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIngresoTipo(mr.tipo);
                        setIngresoModelo(mr.modelo);
                        setIngresoMarca(mr.marca);
                        inputIngresoRef.current?.focus();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: ingresoModelo === mr.modelo ? '#10b981' : 'var(--profile-bg)',
                        color: ingresoModelo === mr.modelo ? 'white' : 'var(--text-main)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {mr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Pistola */}
              <div style={{ padding: '16px', borderRadius: '16px', border: '2px dashed #10b981', background: 'var(--profile-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>
                    ⚡ Pistolear Código de Barras / SN
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>
                    {ingresoSeriales.length} escaneados
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={inputIngresoRef}
                    type="text"
                    value={ingresoSerialInput}
                    onChange={(e) => setIngresoSerialInput(e.target.value)}
                    onKeyDown={handleKeyDownIngreso}
                    placeholder="Pistolea el serial aquí..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const sn = ingresoSerialInput.trim().toUpperCase();
                      if (sn && !ingresoSeriales.includes(sn)) {
                        playBeep();
                        setIngresoSeriales([sn, ...ingresoSeriales]);
                        setIngresoSerialInput('');
                      }
                    }}
                    style={{ padding: '0 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {/* Lista escaneada */}
              {ingresoSeriales.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                    <span>Seriales en este lote ({ingresoSeriales.length}):</span>
                    <button type="button" onClick={() => setIngresoSeriales([])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}>
                      Limpiar lista
                    </button>
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--profile-bg)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    {ingresoSeriales.map((sn, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>{sn}</span>
                        <button
                          type="button"
                          onClick={() => setIngresoSeriales(ingresoSeriales.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowIngresoModal(false)}
                style={{ padding: '10px 18px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarIngreso}
                disabled={guardandoIngreso || ingresoSeriales.length === 0}
                style={{
                  padding: '10px 22px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  opacity: (guardandoIngreso || ingresoSeriales.length === 0) ? 0.5 : 1
                }}
              >
                {guardandoIngreso ? 'Guardando...' : `Guardar ${ingresoSeriales.length} Equipos en Bodega`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: DESPACHO A BUSETA / VEHÍCULO */}
      {/* ============================================================ */}
      {showDespachoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-van-shuttle" style={{ color: '#1f497d' }}></i> Despacho de Equipos a Buseta
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                  Selecciona la placa y pistolea los equipos que suben al vehículo.
                </p>
              </div>
              <button
                onClick={() => setShowDespachoModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Placa de la Buseta / Vehículo
                </label>
                <select
                  value={despachoPlaca}
                  onChange={(e) => setDespachoPlaca(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 900, fontSize: '0.9rem' }}
                >
                  {vehiculos.map((v) => (
                    <option key={v.id_vehiculo} value={v.placa}>
                      {v.placa} — {v.descripcion || 'Sin descripción'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Pistola */}
              <div style={{ padding: '16px', borderRadius: '16px', border: '2px dashed #1f497d', background: 'var(--profile-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1f497d', textTransform: 'uppercase' }}>
                    🚐 Pistolear Equipos a Entregar
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, background: '#1f497d', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>
                    {despachoSeriales.length} equipos
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={inputDespachoRef}
                    type="text"
                    value={despachoSerialInput}
                    onChange={(e) => setDespachoSerialInput(e.target.value)}
                    onKeyDown={handleKeyDownDespacho}
                    placeholder="Pistolea el equipo aquí..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const sn = despachoSerialInput.trim().toUpperCase();
                      if (sn && !despachoSeriales.includes(sn)) {
                        playBeep();
                        setDespachoSeriales([sn, ...despachoSeriales]);
                        setDespachoSerialInput('');
                      }
                    }}
                    style={{ padding: '0 16px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {/* Lista escaneada */}
              {despachoSeriales.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                    <span>Equipos a transferir ({despachoSeriales.length}):</span>
                    <button type="button" onClick={() => setDespachoSeriales([])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}>
                      Limpiar lista
                    </button>
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--profile-bg)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    {despachoSeriales.map((sn, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1f497d' }}>{sn}</span>
                        <button
                          type="button"
                          onClick={() => setDespachoSeriales(despachoSeriales.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDespachoModal(false)}
                style={{ padding: '10px 18px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarDespacho}
                disabled={guardandoDespacho || despachoSeriales.length === 0}
                style={{
                  padding: '10px 22px',
                  background: '#1f497d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  opacity: (guardandoDespacho || despachoSeriales.length === 0) ? 0.5 : 1
                }}
              >
                {guardandoDespacho ? 'Transfiriendo...' : `Confirmar Despacho a ${despachoPlaca}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
