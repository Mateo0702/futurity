import React, { useState, useEffect } from 'react';
import EquiposBodegaTab from './EquiposBodegaTab';
import RequisicionesBodegaTab from './RequisicionesBodegaTab';
import LiquidacionMensualTab from './LiquidacionMensualTab';
import ConsumoVisitasTab from './ConsumoVisitasTab';

function InventarioTab({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data from API
  const [materiales, setMateriales] = useState([]);
  const [tecnicos, setTecnicos] = useState([]); // List of vehicle plates
  const [tecnicosVehiculos, setTecnicosVehiculos] = useState([]); // Detailed technicians with assigned plates
  const [inventarioTecnicos, setInventarioTecnicos] = useState({}); // { plate: { id_material: { cantidad_disponible, total_usado } } }
  const [traspasosHistorial, setTraspasosHistorial] = useState([]);
  
  // Navigation Subtabs
  const [invSubTab, setInvSubTab] = useState('matriz'); // 'matriz' | 'catalogo' | 'vehiculos' | 'traspasos'

  // Catalog State & Filters
  const [searchProducto, setSearchProducto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [isEditProductoMode, setIsEditProductoMode] = useState(false);
  const [formProducto, setFormProducto] = useState({
    id_material: null,
    codigo_material: '',
    nombre_material: '',
    unidad_medida: 'UNIDADES',
    categoria: 'GENERAL',
    stock_bodega: 0,
    stock_minimo: 0
  });

  // Reassignment Form Modal
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState(null);
  const [nuevaPlacaInput, setNuevaPlacaInput] = useState('');
  
  // KPIs
  const [kpiBodega, setKpiBodega] = useState(0);
  const [kpiCustodia, setKpiCustodia] = useState(0);
  const [kpiConsumo, setKpiConsumo] = useState(0);

  // Filter
  const [filtroTecnico, setFiltroTecnico] = useState('');

  // Modals Visibility
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);

  // Form States
  const [formIngreso, setFormIngreso] = useState({ id_material: '', cantidad: '' });
  const [formEntrega, setFormEntrega] = useState({ tecnico_nombre: '', id_material: '', cantidad: '' });
  const [formDevolucion, setFormDevolucion] = useState({ tecnico_nombre: '', id_material: '', cantidad: '' });

  // Helper para generar número de requisición automático
  const generateReqNumber = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `REQ-${y}${m}${d}-${rand}`;
  };

  // Compras / Ingreso Múltiple State
  const [comprasForm, setComprasForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    documento: '',
    proveedor: '',
    comentario: ''
  });
  const [compraSearchTerm, setCompraSearchTerm] = useState('');
  const [compraItemInput, setCompraItemInput] = useState({
    id_material: '',
    cantidad: ''
  });
  const [compraItemsList, setCompraItemsList] = useState([]);
  const [guardandoCompra, setGuardandoCompra] = useState(false);

  // Requisiciones / Entrega Múltiple a Placas State
  const [entregaForm, setEntregaForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    placa_vehiculo: '',
    tecnico_responsable: '',
    documento: generateReqNumber(),
    comentario: ''
  });
  const [entregaSearchTerm, setEntregaSearchTerm] = useState('');
  const [entregaItemInput, setEntregaItemInput] = useState({
    id_material: '',
    cantidad: ''
  });
  const [entregaItemsList, setEntregaItemsList] = useState([]);
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);

  // Proveedores State
  const [proveedores, setProveedores] = useState([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [isEditProveedorMode, setIsEditProveedorMode] = useState(false);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [formProveedor, setFormProveedor] = useState({
    id_proveedor: null,
    ruc: '',
    nombre_empresa: '',
    contacto_nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    observaciones: ''
  });

  // Historial de Compras State
  const [comprasHistorial, setComprasHistorial] = useState([]);
  const [selectedCompraDetalle, setSelectedCompraDetalle] = useState(null);
  const [compraDetalleItems, setCompraDetalleItems] = useState([]);
  const [cargandoDetalleCompra, setCargandoDetalleCompra] = useState(false);

  // Historial de Requisiciones State
  const [requisicionesHistorial, setRequisicionesHistorial] = useState([]);
  const [selectedReqDetalle, setSelectedReqDetalle] = useState(null);
  const [reqDetalleItems, setReqDetalleItems] = useState([]);
  const [cargandoDetalleReq, setCargandoDetalleReq] = useState(false);

  useEffect(() => {
    cargarInventario();
    cargarTraspasosHistorial();
    cargarProveedores();
    cargarComprasHistorial();
    cargarRequisicionesHistorial();
  }, []);

  const handleGuardarProductoSubmit = async (e) => {
    e.preventDefault();
    if (!formProducto.codigo_material || !formProducto.nombre_material) {
      alert("Código y nombre son obligatorios.");
      return;
    }

    try {
      const url = isEditProductoMode 
        ? `/api/admin/materiales/${formProducto.id_material}` 
        : '/api/admin/materiales';
      const method = isEditProductoMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formProducto)
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || 'Producto guardado con éxito');
        setShowProductoModal(false);
        await cargarInventario();
      } else {
        alert(data.message || 'Error al guardar el producto.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar producto.');
    }
  };

  const handleDesactivarProducto = async (idMat, nombre) => {
    if (!window.confirm(`¿Está seguro de desactivar del catálogo el producto "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/admin/materiales/${idMat}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message);
        await cargarInventario();
      } else {
        alert(data.message || 'Error al desactivar producto');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  };

  const cargarTraspasosHistorial = async () => {
    try {
      const res = await fetch('/api/admin/traspasos_historial', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setTraspasosHistorial(data.traspasos || []);
      }
    } catch (e) {
      console.error("Error al cargar historial de traspasos:", e);
    }
  };

  const cargarProveedores = async () => {
    try {
      const res = await fetch('/api/admin/proveedores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setProveedores(data.proveedores || []);
      }
    } catch (e) {
      console.error("Error al cargar proveedores:", e);
    }
  };

  const cargarComprasHistorial = async () => {
    try {
      const res = await fetch('/api/admin/inventario/compras', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setComprasHistorial(data.compras || []);
      }
    } catch (e) {
      console.error("Error al cargar compras:", e);
    }
  };

  const cargarRequisicionesHistorial = async () => {
    try {
      const res = await fetch('/api/admin/inventario/requisiciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setRequisicionesHistorial(data.requisiciones || []);
      }
    } catch (e) {
      console.error("Error al cargar requisiciones:", e);
    }
  };

  const verDetalleCompra = async (compra) => {
    setSelectedCompraDetalle(compra);
    setCargandoDetalleCompra(true);
    setCompraDetalleItems([]);
    try {
      const res = await fetch(`/api/admin/inventario/compras/${compra.id_ingreso}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setCompraDetalleItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoDetalleCompra(false);
    }
  };

  const verDetalleRequisicion = async (req) => {
    setSelectedReqDetalle(req);
    setCargandoDetalleReq(true);
    setReqDetalleItems([]);
    try {
      const res = await fetch(`/api/admin/inventario/requisiciones/${req.id_requisicion}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setReqDetalleItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoDetalleReq(false);
    }
  };

  const handleGuardarProveedorSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formProveedor.nombre_empresa.trim()) {
      alert("El nombre o razón social del proveedor es obligatorio.");
      return;
    }
    setGuardandoProveedor(true);
    try {
      const url = isEditProveedorMode 
        ? `/api/admin/proveedores/${formProveedor.id_proveedor}`
        : '/api/admin/proveedores';
      const method = isEditProveedorMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formProveedor)
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Proveedor guardado exitosamente.");
        setShowProveedorModal(false);
        setFormProveedor({ id_proveedor: null, ruc: '', nombre_empresa: '', contacto_nombre: '', telefono: '', email: '', direccion: '', observaciones: '' });
        await cargarProveedores();
      } else {
        alert(data.message || "Error al guardar proveedor.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al guardar proveedor.");
    } finally {
      setGuardandoProveedor(false);
    }
  };

  const handleDeleteProveedor = async (id) => {
    if (!confirm("¿Está seguro de eliminar este proveedor del catálogo?")) return;
    try {
      const res = await fetch(`/api/admin/proveedores/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        await cargarProveedores();
      } else {
        alert(data.message || "Error al eliminar proveedor.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReasignarSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTecnico) return;

    try {
      const res = await fetch('/api/admin/tecnicos/reasignar_vehiculo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id_tecnico: selectedTecnico.id_tecnico,
          placa_asignada_hoy: nuevaPlacaInput
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Asignación de buseta actualizada con éxito.");
        setShowReasignarModal(false);
        setSelectedTecnico(null);
        setNuevaPlacaInput('');
        await cargarInventario();
      } else {
        alert(data.message || "Error al actualizar asignación.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al reasignar vehículo.");
    }
  };

  const cargarInventario = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/inventario', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setMateriales(data.materiales || []);
        setTecnicos(data.tecnicos || []);
        setTecnicosVehiculos(data.tecnicos_vehiculos || []);
        setInventarioTecnicos(data.inventario_tecnicos || {});

        // Set default filter if plates exist
        if (data.tecnicos && data.tecnicos.length > 0) {
          setFiltroTecnico((prev) => {
            if (data.tecnicos.includes(prev)) return prev;
            return data.tecnicos[0];
          });
        }

        // Calculate KPIs
        let totalB = 0;
        let totalC = 0;
        let totalU = 0;

        (data.materiales || []).forEach(m => {
          totalB += (m.stock_bodega || 0);
        });

        Object.values(data.inventario_tecnicos || {}).forEach(tecInv => {
          Object.values(tecInv || {}).forEach(info => {
            totalC += (info.cantidad_disponible || 0);
            totalU += (info.total_usado || 0);
          });
        });

        setKpiBodega(totalB);
        setKpiCustodia(totalC);
        setKpiConsumo(totalU);
      } else {
        setError(data.message || 'Error al obtener datos de inventario.');
      }
    } catch (err) {
      console.error('Error al conectar con la API de inventario:', err);
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // --- Transacciones ---

  const handleAddCompraItem = () => {
    const mId = parseInt(compraItemInput.id_material);
    const cant = parseInt(compraItemInput.cantidad);
    if (!mId || isNaN(cant) || cant <= 0) {
      alert("Seleccione un material y especifique una cantidad mayor a 0.");
      return;
    }
    const matObj = materiales.find(m => m.id_material === mId);
    if (!matObj) return;

    setCompraItemsList(prev => {
      const existingIndex = prev.findIndex(item => item.id_material === mId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          cantidad: updated[existingIndex].cantidad + cant
        };
        return updated;
      } else {
        return [...prev, {
          id_material: matObj.id_material,
          codigo_material: matObj.codigo_material,
          nombre_material: matObj.nombre_material,
          unidad_medida: matObj.unidad_medida,
          stock_bodega: matObj.stock_bodega || 0,
          cantidad: cant
        }];
      }
    });

    setCompraItemInput({ id_material: '', cantidad: '' });
  };

  const handleUpdateCompraItemCantidad = (id_material, newCant) => {
    const val = parseInt(newCant);
    if (isNaN(val) || val <= 0) return;
    setCompraItemsList(prev => prev.map(item => item.id_material === id_material ? { ...item, cantidad: val } : item));
  };

  const handleRemoveCompraItem = (id_material) => {
    setCompraItemsList(prev => prev.filter(item => item.id_material !== id_material));
  };

  const handleLimpiarCompraForm = () => {
    setComprasForm({
      fecha: new Date().toISOString().split('T')[0],
      documento: '',
      proveedor: '',
      comentario: ''
    });
    setCompraSearchTerm('');
    setCompraItemInput({ id_material: '', cantidad: '' });
    setCompraItemsList([]);
  };

  const handleGuardarCompraSubmit = async (e) => {
    if (e) e.preventDefault();
    if (compraItemsList.length === 0) {
      alert("Debe agregar al menos un material a la lista de compras/ingreso.");
      return;
    }

    setGuardandoCompra(true);
    try {
      const payload = {
        fecha: comprasForm.fecha,
        documento: comprasForm.documento.trim() || null,
        proveedor: comprasForm.proveedor.trim() || null,
        comentario: comprasForm.comentario.trim() || null,
        items: compraItemsList.map(it => ({
          id_material: it.id_material,
          cantidad: it.cantidad
        }))
      };

      const res = await fetch('/api/admin/inventario/bodega/ingreso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Ingreso de compras procesado exitosamente.");
        setShowIngresoModal(false);
        handleLimpiarCompraForm();
        await cargarInventario();
        await cargarComprasHistorial();
      } else {
        alert("Error al procesar compras: " + (data.message || "Error desconocido"));
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al registrar compras.");
    } finally {
      setGuardandoCompra(false);
    }
  };

  const handleAddEntregaItem = () => {
    const mId = parseInt(entregaItemInput.id_material);
    const cant = parseInt(entregaItemInput.cantidad);
    if (!mId || isNaN(cant) || cant <= 0) {
      alert("Seleccione un material y especifique una cantidad mayor a 0.");
      return;
    }
    const matObj = materiales.find(m => m.id_material === mId);
    if (!matObj) return;

    const stockBodega = matObj.stock_bodega || 0;
    
    // Calculate currently added quantity in the list
    const existingItem = entregaItemsList.find(item => item.id_material === mId);
    const totalWanted = (existingItem ? existingItem.cantidad : 0) + cant;

    if (totalWanted > stockBodega) {
      alert(`Stock insuficiente en Bodega Central para '${matObj.nombre_material}'.\nDisponible en Bodega: ${stockBodega} ${matObj.unidad_medida}\nIntentas entregar en total: ${totalWanted} ${matObj.unidad_medida}`);
      return;
    }

    // Get current vehicle stock if vehicle is selected
    const placaSel = entregaForm.placa_vehiculo;
    const stockVehiculo = (placaSel && inventarioTecnicos[placaSel]?.[mId]?.cantidad_disponible) || 0;

    setEntregaItemsList(prev => {
      const existingIndex = prev.findIndex(item => item.id_material === mId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          cantidad: totalWanted
        };
        return updated;
      } else {
        return [...prev, {
          id_material: matObj.id_material,
          codigo_material: matObj.codigo_material,
          nombre_material: matObj.nombre_material,
          unidad_medida: matObj.unidad_medida,
          stock_bodega: stockBodega,
          stock_vehiculo_actual: stockVehiculo,
          cantidad: cant
        }];
      }
    });

    setEntregaItemInput({ id_material: '', cantidad: '' });
  };

  const handleUpdateEntregaItemCantidad = (id_material, newCant) => {
    const val = parseInt(newCant);
    if (isNaN(val) || val <= 0) return;
    const matObj = materiales.find(m => m.id_material === id_material);
    const stockBodega = matObj?.stock_bodega || 0;
    if (val > stockBodega) {
      alert(`No puedes entregar más del stock disponible en Bodega (${stockBodega} ${matObj?.unidad_medida || ''}).`);
      return;
    }
    setEntregaItemsList(prev => prev.map(item => item.id_material === id_material ? { ...item, cantidad: val } : item));
  };

  const handleRemoveEntregaItem = (id_material) => {
    setEntregaItemsList(prev => prev.filter(item => item.id_material !== id_material));
  };

  const handleLimpiarEntregaForm = () => {
    const initialPlaca = tecnicos[0] || '';
    const tecObj = tecnicosVehiculos.find(tv => tv.placa_asignada_hoy === initialPlaca || tv.placa_vehiculo === initialPlaca);
    setEntregaForm({
      fecha: new Date().toISOString().split('T')[0],
      placa_vehiculo: initialPlaca,
      tecnico_responsable: tecObj ? tecObj.nombre : initialPlaca,
      documento: generateReqNumber(),
      comentario: ''
    });
    setEntregaSearchTerm('');
    setEntregaItemInput({ id_material: '', cantidad: '' });
    setEntregaItemsList([]);
  };

  const handleGuardarEntregaSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!entregaForm.placa_vehiculo) {
      alert("Seleccione la placa del vehículo que recibe los materiales.");
      return;
    }
    if (entregaItemsList.length === 0) {
      alert("Debe agregar al menos un material a la lista de entrega.");
      return;
    }

    setGuardandoEntrega(true);
    try {
      const payload = {
        placa_vehiculo: entregaForm.placa_vehiculo,
        tecnico_responsable: entregaForm.tecnico_responsable || entregaForm.placa_vehiculo,
        fecha: entregaForm.fecha,
        documento: entregaForm.documento.trim() || null,
        comentario: entregaForm.comentario.trim() || null,
        items: entregaItemsList.map(it => ({
          id_material: it.id_material,
          cantidad: it.cantidad
        }))
      };

      const res = await fetch('/api/admin/inventario/tecnico/entrega', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        alert(data.message || "Entrega de materiales registrada con éxito.");
        setShowEntregaModal(false);
        handleLimpiarEntregaForm();
        await cargarInventario();
        await cargarTraspasosHistorial();
        await cargarRequisicionesHistorial();
      } else {
        alert("Error al entregar materiales: " + (data.message || "Error desconocido"));
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al procesar entrega.");
    } finally {
      setGuardandoEntrega(false);
    }
  };

  const handleDevolucionSubmit = async (e) => {
    e.preventDefault();
    const tec = formDevolucion.tecnico_nombre || tecnicos[0];
    const idMat = formDevolucion.id_material || (materiales[0]?.id_material);
    const cant = parseInt(formDevolucion.cantidad);

    if (!tec || !idMat || isNaN(cant) || cant <= 0) {
      alert('Por favor ingrese parámetros válidos.');
      return;
    }

    try {
      const res = await fetch('/api/admin/inventario/tecnico/devolucion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tecnico_nombre: tec, id_material: parseInt(idMat), cantidad: cant })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setShowDevolucionModal(false);
        setFormDevolucion({ tecnico_nombre: '', id_material: '', cantidad: '' });
        await cargarInventario();
      } else {
        alert(data.message || 'Error al registrar devolución.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  };

  const tecInventoryDetails = inventarioTecnicos[filtroTecnico] || {};

  return (
    <div id="tab-inventario" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Header Banner */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'rgba(31, 73, 125, 0.12)', color: '#1f497d', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          <i className="fa-solid fa-warehouse"></i>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Control de Inventario y Bodega
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            Administración de stock en bodega principal, gestión del catálogo de productos y custodia por vehículo.
          </p>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setInvSubTab('matriz')}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'matriz' ? '#1f497d' : 'var(--card-bg)',
            color: invSubTab === 'matriz' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'matriz' ? '0 4px 12px rgba(31, 73, 125, 0.2)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-boxes-stacked"></i> Stock y Bodega
        </button>

        <button
          onClick={() => setInvSubTab('catalogo')}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'catalogo' ? '#1f497d' : 'var(--card-bg)',
            color: invSubTab === 'catalogo' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'catalogo' ? '0 4px 12px rgba(31, 73, 125, 0.2)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-box-open"></i> Catálogo de Productos ({materiales.length})
        </button>

        <button
          onClick={() => setInvSubTab('proveedores')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'proveedores' ? '#1f497d' : 'var(--card-bg)',
            color: invSubTab === 'proveedores' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'proveedores' ? '0 4px 12px rgba(31, 73, 125, 0.2)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-building-user"></i> Proveedores ({proveedores.length})
        </button>

        <button
          onClick={() => setInvSubTab('compras')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'compras' ? '#1f497d' : 'var(--card-bg)',
            color: invSubTab === 'compras' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'compras' ? '0 4px 12px rgba(31, 73, 125, 0.2)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-cart-flatbed"></i> Historial Compras ({comprasHistorial.length})
        </button>

        <button
          onClick={() => setInvSubTab('traspasos')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'traspasos' ? '#1f497d' : 'var(--card-bg)',
            color: invSubTab === 'traspasos' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'traspasos' ? '0 4px 12px rgba(31, 73, 125, 0.2)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-arrow-right-arrow-left"></i> Traspasos ({traspasosHistorial.length})
        </button>

        <button
          onClick={() => setInvSubTab('requisiciones')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'requisiciones' ? '#2563eb' : 'var(--card-bg)',
            color: invSubTab === 'requisiciones' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'requisiciones' ? '0 4px 14px rgba(37, 99, 235, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-file-signature"></i> 📦 Requisiciones & Despachos
        </button>

        <button
          onClick={() => setInvSubTab('liquidacion')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'liquidacion' ? '#0d9488' : 'var(--card-bg)',
            color: invSubTab === 'liquidacion' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'liquidacion' ? '0 4px 14px rgba(13, 148, 136, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-calculator"></i> 📊 Cierre Mensual (26-27)
        </button>

        <button
          onClick={() => setInvSubTab('consumo_visitas')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'consumo_visitas' ? '#0ea5e9' : 'var(--card-bg)',
            color: invSubTab === 'consumo_visitas' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'consumo_visitas' ? '0 4px 14px rgba(14, 165, 233, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-clipboard-check"></i> 📋 Materiales por Visita
        </button>

        <button
          onClick={() => setInvSubTab('equipos')}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: invSubTab === 'equipos' ? '#10b981' : 'var(--card-bg)',
            color: invSubTab === 'equipos' ? 'white' : 'var(--text-main)',
            boxShadow: invSubTab === 'equipos' ? '0 4px 14px rgba(16, 185, 129, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-barcode"></i> Equipos (ONUs / Routers)
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '15px' }}></i>
          <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 600 }}>Cargando estado del inventario...</p>
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '24px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
          <div>{error}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* VIEW: CONSUMO DE MATERIALES POR VISITA DIARIA */}
          {invSubTab === 'consumo_visitas' && (
            <ConsumoVisitasTab 
              token={token} 
              tecnicosVehiculosProp={tecnicosVehiculos}
            />
          )}

          {/* VIEW: REQUISICIONES DIGITALES Y DESPACHOS CON FIRMA */}
          {invSubTab === 'requisiciones' && (
            <RequisicionesBodegaTab 
              token={token}
              placas={tecnicos}
              tecnicosVehiculos={tecnicosVehiculos}
              materialesProp={materiales}
            />
          )}

          {/* VIEW: LIQUIDACION Y CIERRE MENSUAL POR PLACA */}
          {invSubTab === 'liquidacion' && (
            <LiquidacionMensualTab 
              token={token}
              placas={tecnicos}
              tecnicosVehiculos={tecnicosVehiculos}
              materialesProp={materiales}
            />
          )}

          {/* VIEW 0: CONTROL DE EQUIPOS CON PISTOLA DE CÓDIGO DE BARRAS */}
          {invSubTab === 'equipos' && (
            <EquiposBodegaTab />
          )}

          {/* VIEW 1: MATRIZ DE STOCK Y CUSTODIAS */}
          {invSubTab === 'matriz' && (
            <>
              {/* KPIs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ background: 'rgba(31, 73, 125, 0.1)', color: '#1f497d', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    <i className="fa-solid fa-warehouse"></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{kpiBodega}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Stock en Bodega</p>
                  </div>
                </div>
                
                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    <i className="fa-solid fa-people-carry-box"></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{kpiCustodia}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Custodia por Placa</p>
                  </div>
                </div>
                
                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    <i className="fa-solid fa-wrench"></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{kpiConsumo}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 800, textTransform: 'uppercase' }}>Consumo Total</p>
                  </div>
                </div>
              </div>

              {/* Columns Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '25px' }}>
                
                {/* Bodega Principal Card */}
                <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-boxes-stacked"></i> Stock en Bodega Principal
                    </h3>
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowIngresoModal(true);
                      }} 
                      style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(31, 73, 125, 0.25)' }}
                    >
                      <i className="fa-solid fa-cart-flatbed"></i> + Registrar Compras / Ingreso
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                          <th style={{ padding: '12px 15px' }}>Código / Material</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>U. Medida</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>Disponible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiales.map((m, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>
                              <span style={{ display: 'inline-block', padding: '2px 6px', background: 'rgba(31, 73, 125, 0.08)', color: '#1f497d', borderRadius: '6px', fontSize: '0.75rem', marginRight: '8px', fontFamily: 'monospace' }}>
                                {m.codigo_material || 'N/A'}
                              </span>
                              {m.nombre_material}
                            </td>
                            <td style={{ padding: '12px 15px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{m.unidad_medida}</td>
                            <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: m.stock_bodega <= (m.stock_minimo || 0) ? '#ef4444' : '#1f497d', fontSize: '1rem' }}>{m.stock_bodega}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Asignación y Custodia por Placa Card */}
                <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-people-carry-box"></i> Custodia por Placa de Vehículo
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          const initialPlaca = filtroTecnico || (tecnicos[0] || '');
                          const tecObj = tecnicosVehiculos.find(tv => tv.placa === initialPlaca);
                          setEntregaForm({
                            fecha: new Date().toISOString().split('T')[0],
                            placa_vehiculo: initialPlaca,
                            tecnico_responsable: tecObj ? tecObj.nombre : initialPlaca,
                            documento: '',
                            comentario: ''
                          });
                          setShowEntregaModal(true);
                        }} 
                        style={{ padding: '8px 16px', fontSize: '0.82rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)' }}
                      >
                        <i className="fa-solid fa-truck-ramp-box"></i> + Requisición / Entregar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (tecnicos.length > 0 && materiales.length > 0) {
                            setFormDevolucion({ tecnico_nombre: tecnicos[0], id_material: materiales[0].id_material.toString(), cantidad: '' });
                          }
                          setShowDevolucionModal(true);
                        }} 
                        style={{ padding: '8px 14px', fontSize: '0.82rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <i className="fa-solid fa-rotate-left"></i> Devolución
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Filtrar por Placa de Vehículo:</label>
                    <select 
                      value={filtroTecnico} 
                      onChange={(e) => setFiltroTecnico(e.target.value)} 
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, outline: 'none' }}
                    >
                      {tecnicos.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                          <th style={{ padding: '12px 15px' }}>Material</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>U. Medida</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>En Custodia</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>Consumido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiales.map((m, i) => {
                          const info = tecInventoryDetails[m.id_material.toString()] || { cantidad_disponible: 0, total_usado: 0 };
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>{m.nombre_material}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{m.unidad_medida}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: '#6366f1', fontSize: '1rem' }}>{info.cantidad_disponible}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{info.total_usado}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </>
          )}

          {/* VIEW 2: CATÁLOGO DE PRODUCTOS */}
          {invSubTab === 'catalogo' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              
              {/* Header Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-box-open"></i> Catálogo Maestro de Productos
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--sidebar-text)' }}>
                    Administra el inventario de ítems con sus códigos, categorías y niveles mínimos.
                  </p>
                </div>

                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditProductoMode(false);
                    setFormProducto({
                      id_material: null,
                      codigo_material: '',
                      nombre_material: '',
                      unidad_medida: 'UNIDADES',
                      categoria: 'GENERAL',
                      stock_bodega: 0,
                      stock_minimo: 10
                    });
                    setShowProductoModal(true);
                  }} 
                  style={{ padding: '10px 18px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-plus"></i> Crear Nuevo Producto
                </button>
              </div>

              {/* Filters & Search */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar por código o descripción..."
                    value={searchProducto}
                    onChange={(e) => setSearchProducto(e.target.value)}
                    style={{ width: '100%', padding: '11px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ width: '220px' }}>
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    style={{ width: '100%', padding: '11px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 700, outline: 'none' }}
                  >
                    {['TODAS', ...Array.from(new Set(materiales.map(m => m.categoria || 'GENERAL'))).sort()].map((cat, idx) => (
                      <option key={idx} value={cat}>{cat === 'TODAS' ? '📁 Todas las Categorías' : `🏷️ ${cat}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '14px 16px' }}>Código</th>
                      <th style={{ padding: '14px 16px' }}>Descripción / Producto</th>
                      <th style={{ padding: '14px 16px' }}>Categoría</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>U. Medida</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Stock Bodega</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Stock Mínimo</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiales
                      .filter(m => {
                        const matchSearch = (m.codigo_material || '').toLowerCase().includes(searchProducto.toLowerCase()) ||
                                            (m.nombre_material || '').toLowerCase().includes(searchProducto.toLowerCase());
                        const matchCat = filtroCategoria === 'TODAS' || (m.categoria || 'GENERAL') === filtroCategoria;
                        return matchSearch && matchCat;
                      })
                      .map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 900, fontFamily: 'monospace', color: '#1f497d', fontSize: '0.9rem' }}>
                            {m.codigo_material || 'S/C'}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {m.nombre_material}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontWeight: 700, fontSize: '0.75rem' }}>
                              {m.categoria || 'GENERAL'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                            {m.unidad_medida}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', color: m.stock_bodega <= (m.stock_minimo || 0) ? '#ef4444' : '#10b981' }}>
                            {m.stock_bodega} {m.stock_bodega <= (m.stock_minimo || 0) && <span title="¡Alerta de Stock Mínimo!" style={{ marginLeft: '4px' }}>⚠️</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                            {m.stock_minimo || 0}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  setIsEditProductoMode(true);
                                  setFormProducto({
                                    id_material: m.id_material,
                                    codigo_material: m.codigo_material || '',
                                    nombre_material: m.nombre_material || '',
                                    unidad_medida: m.unidad_medida || 'UNIDADES',
                                    categoria: m.categoria || 'GENERAL',
                                    stock_bodega: m.stock_bodega || 0,
                                    stock_minimo: m.stock_minimo || 0
                                  });
                                  setShowProductoModal(true);
                                }}
                                title="Editar producto"
                                style={{ padding: '6px 10px', background: 'rgba(31, 73, 125, 0.1)', color: '#1f497d', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              <button
                                onClick={() => handleDesactivarProducto(m.id_material, m.nombre_material)}
                                title="Desactivar producto"
                                style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* VIEW 3: HISTORIAL DE TRASPASOS */}
          {invSubTab === 'traspasos' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-arrow-right-arrow-left"></i> Historial de Traspasos entre Vehículos / Técnicos
              </h3>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Fecha</th>
                      <th style={{ padding: '12px 15px' }}>Origen</th>
                      <th style={{ padding: '12px 15px' }}>Destino</th>
                      <th style={{ padding: '12px 15px' }}>Material</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '12px 15px' }}>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traspasosHistorial.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                          No hay registros de traspasos.
                        </td>
                      </tr>
                    ) : (
                      traspasosHistorial.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 700, color: 'var(--sidebar-text)' }}>{t.fecha_hora}</td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>{t.tecnico_origen} ({t.placa_origen})</td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#6366f1' }}>{t.tecnico_destino} ({t.placa_destino})</td>
                          <td style={{ padding: '12px 15px', fontWeight: 800 }}>{t.nombre_material}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: '#1f497d' }}>{t.cantidad}</td>
                          <td style={{ padding: '12px 15px', color: 'var(--sidebar-text)' }}>{t.agente_registro}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 4: CATÁLOGO DE PROVEEDORES */}
          {invSubTab === 'proveedores' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-building-user"></i> Catálogo de Proveedores
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Registro oficial de distribuidores y empresas proveedoras de insumos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditProveedorMode(false);
                    setFormProveedor({ id_proveedor: null, ruc: '', nombre_empresa: '', contacto_nombre: '', telefono: '', email: '', direccion: '', observaciones: '' });
                    setShowProveedorModal(true);
                  }}
                  style={{ padding: '10px 18px', fontSize: '0.85rem', background: '#1f497d', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(31, 73, 125, 0.25)' }}
                >
                  <i className="fa-solid fa-plus"></i> + Registrar Proveedor
                </button>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px', width: '30px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '12px 15px' }}>RUC</th>
                      <th style={{ padding: '12px 15px' }}>Empresa / Razón Social</th>
                      <th style={{ padding: '12px 15px' }}>Contacto / Vendedor</th>
                      <th style={{ padding: '12px 15px' }}>Teléfono</th>
                      <th style={{ padding: '12px 15px' }}>Email</th>
                      <th style={{ padding: '12px 15px' }}>Dirección</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '90px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedores.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                          <i className="fa-solid fa-building-circle-exclamation" style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '10px', display: 'block' }}></i>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>No hay proveedores registrados aún.</span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>El catálogo está listo para agregar tus empresas proveedoras cuando lo desees.</p>
                        </td>
                      </tr>
                    ) : (
                      proveedores.map((p, idx) => (
                        <tr key={p.id_proveedor || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 800, color: 'var(--sidebar-text)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 15px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--sidebar-text)' }}>{p.ruc || '---'}</td>
                          <td style={{ padding: '12px 15px', fontWeight: 900, color: 'var(--text-main)' }}>{p.nombre_empresa}</td>
                          <td style={{ padding: '12px 15px', color: 'var(--text-main)', fontWeight: 600 }}>{p.contacto_nombre || '---'}</td>
                          <td style={{ padding: '12px 15px', color: 'var(--sidebar-text)', fontWeight: 700 }}>{p.telefono || '---'}</td>
                          <td style={{ padding: '12px 15px', color: '#2563eb', fontWeight: 600 }}>{p.email || '---'}</td>
                          <td style={{ padding: '12px 15px', color: 'var(--sidebar-text)', fontSize: '0.8rem' }}>{p.direccion || '---'}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditProveedorMode(true);
                                  setFormProveedor({ ...p });
                                  setShowProveedorModal(true);
                                }}
                                title="Editar Proveedor"
                                style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#6366f1', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProveedor(p.id_proveedor)}
                                title="Eliminar Proveedor"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 5: HISTORIAL DE COMPRAS */}
          {invSubTab === 'compras' && (
            <div style={{ padding: '25px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1f497d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-cart-flatbed"></i> Historial de Compras e Ingresos a Bodega
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Registro de facturas, guías de remisión y lotes de insumos recibidos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIngresoModal(true)}
                  style={{ padding: '10px 18px', fontSize: '0.85rem', background: '#1f497d', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(31, 73, 125, 0.25)' }}
                >
                  <i className="fa-solid fa-plus"></i> + Registrar Compra / Ingreso
                </button>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '12px 15px' }}>Fecha Ingreso</th>
                      <th style={{ padding: '12px 15px' }}>Nº Factura / Doc</th>
                      <th style={{ padding: '12px 15px' }}>Proveedor</th>
                      <th style={{ padding: '12px 15px' }}>Observación</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Tipos Insumo</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center' }}>Total Unidades</th>
                      <th style={{ padding: '12px 15px' }}>Registrado por</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '110px' }}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprasHistorial.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                          <i className="fa-solid fa-boxes-packing" style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '10px', display: 'block' }}></i>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>No hay compras registradas en el historial.</span>
                        </td>
                      </tr>
                    ) : (
                      comprasHistorial.map((c, idx) => (
                        <tr key={c.id_ingreso || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {c.fecha_ingreso ? String(c.fecha_ingreso).slice(0, 10) : '---'}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 900, fontFamily: 'monospace', color: '#1f497d' }}>
                            {c.documento || '---'}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {c.proveedor || 'Proveedor no especificado'}
                          </td>
                          <td style={{ padding: '12px 15px', color: 'var(--sidebar-text)', fontSize: '0.82rem' }}>
                            {c.comentario || '---'}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>
                            {c.total_items} items
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 900, fontSize: '0.85rem' }}>
                              +{c.total_unidades} uds
                            </span>
                          </td>
                          <td style={{ padding: '12px 15px', color: 'var(--sidebar-text)', fontSize: '0.82rem' }}>
                            {c.registrado_por}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => verDetalleCompra(c)}
                              style={{ padding: '6px 12px', background: 'rgba(31, 73, 125, 0.1)', border: '1px solid rgba(31, 73, 125, 0.25)', color: '#1f497d', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <i className="fa-solid fa-eye"></i> Ver Lote
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: REGISTRO DE COMPRAS / INGRESO MÚLTIPLE A BODEGA */}
      {showIngresoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '850px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(31, 73, 125, 0.08) 0%, rgba(31, 73, 125, 0.18) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#1f497d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-cart-flatbed"></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 900 }}>
                    Registro de Compras / Ingreso de Stock a Bodega
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Recepción de lotes de insumos y actualización masiva de inventario
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowIngresoModal(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Sección 1: Datos Generales de la Compra / Recepción */}
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-calendar-day" style={{ color: '#1f497d', marginRight: '5px' }}></i> Fecha Recepción:
                  </label>
                  <input 
                    type="date"
                    value={comprasForm.fecha}
                    onChange={(e) => setComprasForm({ ...comprasForm, fecha: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-file-invoice" style={{ color: '#1f497d', marginRight: '5px' }}></i> Nº Factura / Guía:
                  </label>
                  <input 
                    type="text"
                    value={comprasForm.documento}
                    onChange={(e) => setComprasForm({ ...comprasForm, documento: e.target.value })}
                    placeholder="Ej. FAC-001-8492"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-truck" style={{ color: '#1f497d', marginRight: '5px' }}></i> Proveedor:
                  </label>
                  <input 
                    type="text"
                    list="listaProveedoresSelect"
                    value={comprasForm.proveedor}
                    onChange={(e) => setComprasForm({ ...comprasForm, proveedor: e.target.value })}
                    placeholder="Ej. Dipropan / FibraMarket"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                  <datalist id="listaProveedoresSelect">
                    {proveedores.map((p, idx) => (
                      <option key={idx} value={p.nombre_empresa}>
                        {p.nombre_empresa} {p.ruc ? `(RUC: ${p.ruc})` : ''}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-comment-dots" style={{ color: '#1f497d', marginRight: '5px' }}></i> Observación / Motivo:
                  </label>
                  <input 
                    type="text"
                    value={comprasForm.comentario}
                    onChange={(e) => setComprasForm({ ...comprasForm, comentario: e.target.value })}
                    placeholder="Ej. Reposición mensual cuadrillas"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Sección 2: Selector y Botón de Adición Rápida (+) */}
              <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.08) 100%)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '16px', padding: '18px' }}>
                <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px', letterSpacing: '0.04em' }}>
                  <i className="fa-solid fa-plus-circle" style={{ marginRight: '5px' }}></i> Añadir Producto al Lote de Recepción:
                </span>

                {/* Buscador Rápido de Material con Lupa */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid #3b82f6', borderRadius: '10px', padding: '7px 12px', gap: '8px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ color: '#2563eb', fontSize: '0.9rem' }}></i>
                    <input 
                      type="text"
                      placeholder="Buscar por código o nombre (ej. AMA, fibra, patchcord)..."
                      value={compraSearchTerm}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCompraSearchTerm(val);
                        const filtered = materiales.filter(m => 
                          (m.codigo_material && m.codigo_material.toLowerCase().includes(val.toLowerCase())) ||
                          (m.nombre_material && m.nombre_material.toLowerCase().includes(val.toLowerCase()))
                        );
                        if (filtered.length === 1) {
                          setCompraItemInput(prev => ({ ...prev, id_material: filtered[0].id_material.toString() }));
                        }
                      }}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
                    />
                    {compraSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setCompraSearchTerm('')}
                        style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 900, padding: 0 }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 120px auto', gap: '10px', alignItems: 'end' }}>
                  
                  {/* Selector Material */}
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                      Material / Insumo ({materiales.filter(m => !compraSearchTerm || (m.codigo_material && m.codigo_material.toLowerCase().includes(compraSearchTerm.toLowerCase())) || m.nombre_material.toLowerCase().includes(compraSearchTerm.toLowerCase())).length}):
                    </label>
                    <select
                      value={compraItemInput.id_material}
                      onChange={(e) => setCompraItemInput({ ...compraItemInput, id_material: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, outline: 'none' }}
                    >
                      <option value="">-- Seleccionar Material --</option>
                      {materiales
                        .filter(m => !compraSearchTerm || (m.codigo_material && m.codigo_material.toLowerCase().includes(compraSearchTerm.toLowerCase())) || m.nombre_material.toLowerCase().includes(compraSearchTerm.toLowerCase()))
                        .map((m, idx) => (
                          <option key={idx} value={m.id_material}>
                            [{m.codigo_material || 'N/A'}] {m.nombre_material} (Stock: {m.stock_bodega} {m.unidad_medida})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Unidad Info */}
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Unidad:</label>
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 800, minWidth: '70px', textAlign: 'center' }}>
                      {materiales.find(m => m.id_material === parseInt(compraItemInput.id_material))?.unidad_medida || '---'}
                    </div>
                  </div>

                  {/* Cantidad Input */}
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Cantidad:</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder="Ej. 100"
                      value={compraItemInput.cantidad}
                      onChange={(e) => setCompraItemInput({ ...compraItemInput, cantidad: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCompraItem();
                        }
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #3b82f6', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 800, textAlign: 'center', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Botón Añadir */}
                  <button
                    type="button"
                    onClick={handleAddCompraItem}
                    style={{ padding: '10px 18px', borderRadius: '10px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 850, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '42px' }}
                  >
                    <i className="fa-solid fa-plus"></i> Añadir
                  </button>
                </div>
              </div>

              {/* Sección 3: Grilla Interactiva de Productos Agregados */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h6 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 850, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-list-check" style={{ color: '#10b981' }}></i> Lista de Insumos a Ingresar ({compraItemsList.length})
                  </h6>
                  {compraItemsList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCompraItemsList([])}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <i className="fa-solid fa-trash-can"></i> Vaciar Lista
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--card-bg)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--sidebar-text)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px', width: '30px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px 14px' }}>Código / Material</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>U. Medida</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Stock Actual</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', width: '130px' }}>Cant. Ingreso</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Nuevo Stock</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compraItemsList.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                            <i className="fa-solid fa-box-open" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }}></i>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>No hay productos en el lote de recepción.</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>Selecciona materiales arriba y agrégalos a la lista.</p>
                          </td>
                        </tr>
                      ) : (
                        compraItemsList.map((item, idx) => {
                          const nuevoStock = (item.stock_bodega || 0) + item.cantidad;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--sidebar-text)' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                <span style={{ display: 'inline-block', padding: '2px 6px', background: 'rgba(31, 73, 125, 0.08)', color: '#1f497d', borderRadius: '6px', fontSize: '0.74rem', marginRight: '8px', fontFamily: 'monospace' }}>
                                  {item.codigo_material || 'N/A'}
                                </span>
                                {item.nombre_material}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.8rem' }}>
                                {item.unidad_medida}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                                {item.stock_bodega}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCompraItemCantidad(item.id_material, Math.max(1, item.cantidad - 1))}
                                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number"
                                    min="1"
                                    value={item.cantidad}
                                    onChange={(e) => handleUpdateCompraItemCantidad(item.id_material, e.target.value)}
                                    style={{ width: '60px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 900, textAlign: 'center', boxSizing: 'border-box' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCompraItemCantidad(item.id_material, item.cantidad + 1)}
                                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 900, fontSize: '0.88rem' }}>
                                  {nuevoStock} {item.unidad_medida}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCompraItem(item.id_material)}
                                  title="Quitar de la lista"
                                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Resumen Totalizador */}
                {compraItemsList.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px 18px', borderRadius: '12px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                      Total de tipos de producto: <strong style={{ color: 'var(--text-main)' }}>{compraItemsList.length} items</strong>
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#10b981' }}>
                      Total unidades a ingresar: {compraItemsList.reduce((acc, it) => acc + (parseInt(it.cantidad) || 0), 0).toLocaleString()} unidades
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleLimpiarCompraForm}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--sidebar-text)', borderRadius: '10px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-broom"></i> Limpiar Todo
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowIngresoModal(false)}
                  style={{ padding: '10px 18px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardandoCompra || compraItemsList.length === 0}
                  onClick={handleGuardarCompraSubmit}
                  style={{ padding: '10px 22px', background: compraItemsList.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #1f497d 0%, #17375e 100%)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.88rem', cursor: compraItemsList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: compraItemsList.length === 0 ? 'none' : '0 4px 12px rgba(31, 73, 125, 0.3)' }}
                >
                  {guardandoCompra ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                  Guardar e Ingresar Stock
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: REQUISICIONES / ENTREGA MÚLTIPLE DE MATERIALES A PLACAS */}
      {showEntregaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '850px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.18) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-truck-ramp-box"></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 900 }}>
                    Requisición de Materiales / Despacho a Vehículo
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Entrega de lote de insumos a la placa y custodia del técnico
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEntregaModal(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Sección 1: Datos de la Requisición / Vehículo */}
              <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-calendar-day" style={{ color: '#6366f1', marginRight: '5px' }}></i> Fecha Entrega:
                  </label>
                  <input 
                    type="date"
                    value={entregaForm.fecha}
                    onChange={(e) => setEntregaForm({ ...entregaForm, fecha: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-truck" style={{ color: '#6366f1', marginRight: '5px' }}></i> Placa Vehículo Destino:
                  </label>
                  <select
                    value={entregaForm.placa_vehiculo}
                    onChange={(e) => {
                      const pl = e.target.value;
                      const tecObj = tecnicosVehiculos.find(tv => tv.placa_asignada_hoy === pl || tv.placa_vehiculo === pl);
                      setEntregaForm(prev => ({ 
                        ...prev, 
                        placa_vehiculo: pl,
                        tecnico_responsable: tecObj ? tecObj.nombre : prev.tecnico_responsable
                      }));
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 800, outline: 'none' }}
                    required
                  >
                    <option value="">-- Seleccionar Placa --</option>
                    {tecnicos.map((t, idx) => {
                      const tecObj = tecnicosVehiculos.find(tv => tv.placa_asignada_hoy === t || tv.placa_vehiculo === t);
                      return (
                        <option key={idx} value={t}>
                          🚗 {t} {tecObj ? `(${tecObj.nombre})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <i className="fa-solid fa-user-check" style={{ color: '#6366f1', marginRight: '5px' }}></i> Técnico Responsable:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text"
                      list="listaTecnicosNombres"
                      value={entregaForm.tecnico_responsable}
                      onChange={(e) => {
                        const val = e.target.value;
                        const tecObj = tecnicosVehiculos.find(tv => tv.nombre.toLowerCase() === val.toLowerCase());
                        setEntregaForm(prev => ({
                          ...prev,
                          tecnico_responsable: val,
                          placa_vehiculo: (tecObj?.placa_asignada_hoy || tecObj?.placa_vehiculo) || prev.placa_vehiculo
                        }));
                      }}
                      placeholder="Selecciona o escribe el técnico..."
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                    <datalist id="listaTecnicosNombres">
                      {tecnicosVehiculos.map((tv, idx) => (
                        <option key={idx} value={tv.nombre}>
                          {tv.nombre} [Placa: {tv.placa_asignada_hoy || tv.placa_vehiculo || 'Sin asignar'}]
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <i className="fa-solid fa-clipboard-list" style={{ color: '#6366f1', marginRight: '5px' }}></i> Nº Requisición:
                    </label>
                    <button
                      type="button"
                      onClick={() => setEntregaForm(prev => ({ ...prev, documento: generateReqNumber() }))}
                      title="Generar nuevo número correlativo"
                      style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: '#6366f1', fontSize: '0.72rem', fontWeight: 800, borderRadius: '6px', padding: '2px 6px', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-arrows-rotate"></i> Auto
                    </button>
                  </div>
                  <input 
                    type="text"
                    value={entregaForm.documento}
                    onChange={(e) => setEntregaForm({ ...entregaForm, documento: e.target.value })}
                    placeholder="Ej. REQ-20260821-4821"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Sección 2: Selector y Adición Rápida (+) */}
              <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(79, 70, 229, 0.08) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '16px', padding: '18px' }}>
                <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px', letterSpacing: '0.04em' }}>
                  <i className="fa-solid fa-plus-circle" style={{ marginRight: '5px' }}></i> Añadir Insumo a la Requisición:
                </span>

                {/* Buscador Rápido de Insumo con Lupa */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid #6366f1', borderRadius: '10px', padding: '7px 12px', gap: '8px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ color: '#6366f1', fontSize: '0.9rem' }}></i>
                    <input 
                      type="text"
                      placeholder="Buscar por código o nombre de insumo (ej. AMA, conector, cable)..."
                      value={entregaSearchTerm}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEntregaSearchTerm(val);
                        const filtered = materiales.filter(m => 
                          (m.codigo_material && m.codigo_material.toLowerCase().includes(val.toLowerCase())) ||
                          (m.nombre_material && m.nombre_material.toLowerCase().includes(val.toLowerCase()))
                        );
                        if (filtered.length === 1) {
                          setEntregaItemInput(prev => ({ ...prev, id_material: filtered[0].id_material.toString() }));
                        }
                      }}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
                    />
                    {entregaSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setEntregaSearchTerm('')}
                        style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 900, padding: 0 }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 120px auto', gap: '10px', alignItems: 'end' }}>
                  
                  {/* Selector Material */}
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                      Material / Insumo ({materiales.filter(m => !entregaSearchTerm || (m.codigo_material && m.codigo_material.toLowerCase().includes(entregaSearchTerm.toLowerCase())) || m.nombre_material.toLowerCase().includes(entregaSearchTerm.toLowerCase())).length}):
                    </label>
                    <select
                      value={entregaItemInput.id_material}
                      onChange={(e) => setEntregaItemInput({ ...entregaItemInput, id_material: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 700, outline: 'none' }}
                    >
                      <option value="">-- Seleccionar Material --</option>
                      {materiales
                        .filter(m => !entregaSearchTerm || (m.codigo_material && m.codigo_material.toLowerCase().includes(entregaSearchTerm.toLowerCase())) || m.nombre_material.toLowerCase().includes(entregaSearchTerm.toLowerCase()))
                        .map((m, idx) => (
                          <option key={idx} value={m.id_material}>
                            [{m.codigo_material || 'N/A'}] {m.nombre_material} (Disp. Bodega: {m.stock_bodega} {m.unidad_medida})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Stock en Bodega Info */}
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>En Bodega:</label>
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#6366f1', fontSize: '0.82rem', fontWeight: 900, minWidth: '85px', textAlign: 'center' }}>
                      {(() => {
                        const selMat = materiales.find(m => m.id_material === parseInt(entregaItemInput.id_material));
                        return selMat ? `${selMat.stock_bodega} ${selMat.unidad_medida}` : '---';
                      })()}
                    </div>
                  </div>

                  {/* Cantidad Input */}
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Cant. Entregar:</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder="Ej. 20"
                      value={entregaItemInput.cantidad}
                      onChange={(e) => setEntregaItemInput({ ...entregaItemInput, cantidad: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEntregaItem();
                        }
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 800, textAlign: 'center', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Botón Añadir */}
                  <button
                    type="button"
                    onClick={handleAddEntregaItem}
                    style={{ padding: '10px 18px', borderRadius: '10px', background: '#6366f1', color: 'white', border: 'none', fontWeight: 850, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '42px' }}
                  >
                    <i className="fa-solid fa-plus"></i> Añadir
                  </button>
                </div>
              </div>

              {/* Sección 3: Grilla Interactiva de Entrega a Vehículo */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h6 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 850, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-boxes-packing" style={{ color: '#6366f1' }}></i> Insumos a Despachar ({entregaItemsList.length}) {entregaForm.placa_vehiculo ? `a [${entregaForm.placa_vehiculo}]` : ''}
                  </h6>
                  {entregaItemsList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEntregaItemsList([])}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <i className="fa-solid fa-trash-can"></i> Vaciar Lista
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--card-bg)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--sidebar-text)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px', width: '30px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px 14px' }}>Código / Material</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>U. Medida</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Disp. Bodega</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', width: '130px' }}>Cant. Entregar</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Nuevo Stock Vehículo</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entregaItemsList.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                            <i className="fa-solid fa-truck-ramp-box" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }}></i>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>No hay insumos en la orden de entrega.</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>Selecciona la placa arriba, añade materiales y confirma el despacho.</p>
                          </td>
                        </tr>
                      ) : (
                        entregaItemsList.map((item, idx) => {
                          const placaSel = entregaForm.placa_vehiculo;
                          const stockActualVehiculo = (placaSel && inventarioTecnicos[placaSel]?.[item.id_material]?.cantidad_disponible) || 0;
                          const nuevoStockVehiculo = stockActualVehiculo + item.cantidad;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--sidebar-text)' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                <span style={{ display: 'inline-block', padding: '2px 6px', background: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', borderRadius: '6px', fontSize: '0.74rem', marginRight: '8px', fontFamily: 'monospace' }}>
                                  {item.codigo_material || 'N/A'}
                                </span>
                                {item.nombre_material}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700, fontSize: '0.8rem' }}>
                                {item.unidad_medida}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: item.stock_bodega < item.cantidad ? '#ef4444' : '#1f497d' }}>
                                {item.stock_bodega}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateEntregaItemCantidad(item.id_material, Math.max(1, item.cantidad - 1))}
                                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number"
                                    min="1"
                                    max={item.stock_bodega}
                                    value={item.cantidad}
                                    onChange={(e) => handleUpdateEntregaItemCantidad(item.id_material, e.target.value)}
                                    style={{ width: '60px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #6366f1', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 900, textAlign: 'center', boxSizing: 'border-box' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateEntregaItemCantidad(item.id_material, item.cantidad + 1)}
                                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--profile-bg)', color: 'var(--text-main)', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 900, fontSize: '0.88rem' }}>
                                  {nuevoStockVehiculo} {item.unidad_medida}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEntregaItem(item.id_material)}
                                  title="Quitar de la lista"
                                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Resumen Totalizador */}
                {entregaItemsList.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px 18px', borderRadius: '12px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                      Total de tipos de insumos: <strong style={{ color: 'var(--text-main)' }}>{entregaItemsList.length} items</strong>
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#6366f1' }}>
                      Total unidades a entregar: {entregaItemsList.reduce((acc, it) => acc + (parseInt(it.cantidad) || 0), 0).toLocaleString()} unidades
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleLimpiarEntregaForm}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--sidebar-text)', borderRadius: '10px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-broom"></i> Limpiar Todo
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEntregaModal(false)}
                  style={{ padding: '10px 18px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardandoEntrega || entregaItemsList.length === 0}
                  onClick={handleGuardarEntregaSubmit}
                  style={{ padding: '10px 22px', background: entregaItemsList.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.88rem', cursor: entregaItemsList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: entregaItemsList.length === 0 ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)' }}
                >
                  {guardandoEntrega ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-truck-ramp-box"></i>}
                  Confirmar y Despachar a Placa
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: DEVOLUCIÓN DE TÉCNICO */}
      {showDevolucionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#ef4444', fontSize: '1.05rem', fontWeight: 850 }}><i className="fa-solid fa-rotate-left"></i> Devolución de Insumos a Bodega</h5>
              <button type="button" onClick={() => setShowDevolucionModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleDevolucionSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Placa:</label>
                  <select 
                    value={formDevolucion.tecnico_nombre} 
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, tecnico_nombre: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {tecnicos.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Seleccione Material:</label>
                  <select 
                    value={formDevolucion.id_material} 
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, id_material: e.target.value })} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
                    required
                  >
                    {materiales.map((m, idx) => <option key={idx} value={m.id_material}>{m.nombre_material} ({m.unidad_medida})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Cantidad a Devolver:</label>
                  <input 
                    type="number" 
                    value={formDevolucion.cantidad} 
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, cantidad: e.target.value })} 
                    placeholder="Ej. 10" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600, boxSizing: 'border-box' }}
                    min="1"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowDevolucionModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Devolver a Bodega</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREAR / EDITAR PRODUCTO */}
      {showProductoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#1f497d', fontSize: '1.05rem', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-box"></i> {isEditProductoMode ? 'Editar Producto del Catálogo' : 'Crear Nuevo Producto en Catálogo'}
              </h5>
              <button type="button" onClick={() => setShowProductoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleGuardarProductoSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.78rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Código SKU / Item:</label>
                    <input 
                      type="text" 
                      value={formProducto.codigo_material} 
                      onChange={(e) => setFormProducto({ ...formProducto, codigo_material: e.target.value.toUpperCase() })} 
                      placeholder="Ej. AMA0001" 
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, fontFamily: 'monospace', boxSizing: 'border-box' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.78rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Categoría:</label>
                    <input 
                      type="text" 
                      value={formProducto.categoria} 
                      onChange={(e) => setFormProducto({ ...formProducto, categoria: e.target.value.toUpperCase() })} 
                      placeholder="Ej. CABLES, CONECTORES" 
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.78rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Descripción / Nombre del Producto:</label>
                  <input 
                    type="text" 
                    value={formProducto.nombre_material} 
                    onChange={(e) => setFormProducto({ ...formProducto, nombre_material: e.target.value.toUpperCase() })} 
                    placeholder="Ej. AMARRAS INSTALACIONES" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Unidad Medida:</label>
                    <select 
                      value={formProducto.unidad_medida} 
                      onChange={(e) => setFormProducto({ ...formProducto, unidad_medida: e.target.value })} 
                      style={{ width: '100%', padding: '10px 8px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      <option value="UNIDADES">UNIDADES</option>
                      <option value="METROS">METROS</option>
                      <option value="ROLLOS">ROLLOS</option>
                      <option value="CAJAS">CAJAS</option>
                      <option value="PAQUETES">PAQUETES</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Stock Bodega:</label>
                    <input 
                      type="number" 
                      value={formProducto.stock_bodega} 
                      onChange={(e) => setFormProducto({ ...formProducto, stock_bodega: parseInt(e.target.value) || 0 })} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                      min="0"
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Stock Mínimo:</label>
                    <input 
                      type="number" 
                      value={formProducto.stock_minimo} 
                      onChange={(e) => setFormProducto({ ...formProducto, stock_minimo: parseInt(e.target.value) || 0 })} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                      min="0"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowProductoModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '10px 20px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                    {isEditProductoMode ? 'Guardar Cambios' : 'Crear Producto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREAR / EDITAR PROVEEDOR */}
      {showProveedorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '20px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--profile-bg)' }}>
              <h5 style={{ margin: 0, color: '#1f497d', fontSize: '1.1rem', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-building-user"></i> {isEditProveedorMode ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
              </h5>
              <button type="button" onClick={() => setShowProveedorModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleGuardarProveedorSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>RUC / Cédula:</label>
                    <input 
                      type="text" 
                      value={formProveedor.ruc} 
                      onChange={(e) => setFormProveedor({ ...formProveedor, ruc: e.target.value })} 
                      placeholder="Ej. 1792834891001" 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Empresa / Razón Social *:</label>
                    <input 
                      type="text" 
                      value={formProveedor.nombre_empresa} 
                      onChange={(e) => setFormProveedor({ ...formProveedor, nombre_empresa: e.target.value })} 
                      placeholder="Ej. Dipropan S.A." 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 800, boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Contacto / Asesor:</label>
                    <input 
                      type="text" 
                      value={formProveedor.contacto_nombre} 
                      onChange={(e) => setFormProveedor({ ...formProveedor, contacto_nombre: e.target.value })} 
                      placeholder="Ej. Ing. Carlos Pérez" 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Teléfono / Celular:</label>
                    <input 
                      type="text" 
                      value={formProveedor.telefono} 
                      onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })} 
                      placeholder="Ej. 0987654321" 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Correo Electrónico:</label>
                  <input 
                    type="email" 
                    value={formProveedor.email} 
                    onChange={(e) => setFormProveedor({ ...formProveedor, email: e.target.value })} 
                    placeholder="Ej. ventas@dipropan.com" 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Dirección / Observaciones:</label>
                  <input 
                    type="text" 
                    value={formProveedor.direccion} 
                    onChange={(e) => setFormProveedor({ ...formProveedor, direccion: e.target.value })} 
                    placeholder="Ej. Av. 10 de Agosto y Colón" 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowProveedorModal(false)} style={{ padding: '10px 18px', background: 'var(--profile-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" disabled={guardandoProveedor} style={{ padding: '10px 20px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                    {guardandoProveedor ? <i className="fa-solid fa-spinner fa-spin"></i> : (isEditProveedorMode ? 'Guardar Cambios' : 'Registrar Proveedor')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DETALLE DE LOTE DE COMPRA */}
      {selectedCompraDetalle && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(31, 73, 125, 0.08) 0%, rgba(31, 73, 125, 0.18) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#1f497d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 900 }}>
                    Detalle de Factura / Compra ({selectedCompraDetalle.documento || 'Ingreso'})
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Proveedor: <strong>{selectedCompraDetalle.proveedor || 'No especificado'}</strong> | Fecha: {selectedCompraDetalle.fecha_ingreso ? String(selectedCompraDetalle.fecha_ingreso).slice(0, 10) : '---'}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedCompraDetalle(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {selectedCompraDetalle.comentario && (
                <div style={{ padding: '12px 16px', background: 'var(--profile-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.84rem', color: 'var(--text-main)' }}>
                  <strong style={{ color: '#1f497d' }}>Observación:</strong> {selectedCompraDetalle.comentario}
                </div>
              )}

              {cargandoDetalleCompra ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#1f497d', marginBottom: '10px' }}></i>
                  <div>Cargando detalle de ítems...</div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--sidebar-text)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px', width: '30px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px 14px' }}>Código / Material</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Unidad</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Cant. Recibida</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Stock Ant.</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Stock Nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compraDetalleItems.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--sidebar-text)' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                            <span style={{ display: 'inline-block', padding: '2px 6px', background: 'rgba(31, 73, 125, 0.08)', color: '#1f497d', borderRadius: '6px', fontSize: '0.74rem', marginRight: '8px', fontFamily: 'monospace' }}>
                              {it.codigo_material || 'N/A'}
                            </span>
                            {it.nombre_material}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{it.unidad_medida}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 900, fontSize: '0.88rem' }}>
                              +{it.cantidad}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{it.stock_anterior}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#1f497d' }}>{it.stock_nuevo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderRadius: '12px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                  Total ítems en lote: <strong style={{ color: 'var(--text-main)' }}>{compraDetalleItems.length}</strong>
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#10b981' }}>
                  Total recibido: {compraDetalleItems.reduce((acc, it) => acc + (it.cantidad || 0), 0)} unidades
                </span>
              </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedCompraDetalle(null)}
                style={{ padding: '10px 20px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 6: DETALLE DE REQUISICIÓN / VALE */}
      {selectedReqDetalle && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.18) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-clipboard-check"></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 900 }}>
                    Vale de Requisición ({selectedReqDetalle.documento_req || 'Despacho'})
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Vehículo: 🚗 <strong>{selectedReqDetalle.placa_vehiculo}</strong> ({selectedReqDetalle.tecnico_responsable || 'Sin técnico'}) | Fecha: {selectedReqDetalle.fecha_entrega ? String(selectedReqDetalle.fecha_entrega).slice(0, 10) : '---'}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedReqDetalle(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {selectedReqDetalle.comentario && (
                <div style={{ padding: '12px 16px', background: 'var(--profile-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.84rem', color: 'var(--text-main)' }}>
                  <strong style={{ color: '#6366f1' }}>Observación:</strong> {selectedReqDetalle.comentario}
                </div>
              )}

              {cargandoDetalleReq ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#6366f1', marginBottom: '10px' }}></i>
                  <div>Cargando insumos despachados...</div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--sidebar-text)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px', width: '30px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px 14px' }}>Código / Material</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Unidad</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Cant. Entregada</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Stock Bodega Ant.</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Stock Bodega Nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqDetalleItems.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: 'var(--sidebar-text)' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                            <span style={{ display: 'inline-block', padding: '2px 6px', background: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', borderRadius: '6px', fontSize: '0.74rem', marginRight: '8px', fontFamily: 'monospace' }}>
                              {it.codigo_material || 'N/A'}
                            </span>
                            {it.nombre_material}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{it.unidad_medida}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 900, fontSize: '0.88rem' }}>
                              {it.cantidad}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--sidebar-text)', fontWeight: 700 }}>{it.stock_bodega_anterior}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#1f497d' }}>{it.stock_bodega_nuevo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderRadius: '12px', background: 'var(--profile-bg)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sidebar-text)' }}>
                  Total tipos de insumos: <strong style={{ color: 'var(--text-main)' }}>{reqDetalleItems.length}</strong>
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#6366f1' }}>
                  Total despachado: {reqDetalleItems.reduce((acc, it) => acc + (it.cantidad || 0), 0)} unidades
                </span>
              </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedReqDetalle(null)}
                style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cerrar Vale
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );

}

export default InventarioTab;
