import React, { useState, useEffect } from 'react';

function Sidebar({ user, activeTab, onTabChange, activeArea, onAreaChange, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed);
  }, [collapsed]);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const role = user.rol || 'ASESOR';
  const name = user.nombre || 'Asesor';

  const isVisible = (tab) => {
    if (tab === 'visitas') {
      return ['ADMIN', 'ASESOR', 'CALIDAD', 'ATC'].includes(role);
    }
    if (tab === 'mapa-tecnicos' || tab === 'registro') {
      return ['ADMIN', 'ASESOR', 'CALIDAD'].includes(role);
    }
    if (tab === 'registro-atencion' || tab === 'buscar-cliente') {
      return ['ADMIN', 'ASESOR', 'ATC'].includes(role);
    }
    if (tab === 'metricas') {
      return ['ADMIN', 'ASESOR', 'CALIDAD', 'ATC'].includes(role);
    }
    if (tab === 'reportes' || tab === 'control-calidad') {
      return ['ADMIN', 'ASESOR', 'CALIDAD'].includes(role);
    }
    if (tab === 'inventario') {
      return ['ADMIN', 'BODEGA'].includes(role);
    }
    if (tab === 'asignacion-busetas') {
      return ['ADMIN', 'ASESOR', 'BODEGA'].includes(role);
    }
    if (tab === 'usuarios') {
      return ['ADMIN', 'ASESOR'].includes(role);
    }
    return false;
  };

  // SN Quick Tracker State (Rol ADMIN y BODEGA)
  const [snQuery, setSnQuery] = useState('');
  const [modalSnInput, setModalSnInput] = useState('');
  const [buscandoSn, setBuscandoSn] = useState(false);
  const [snResultado, setSnResultado] = useState(null);
  const [showSnModal, setShowSnModal] = useState(false);

  const ejecutarRastreo = async (snParam) => {
    const term = (snParam || '').trim();
    if (!term) return;
    setBuscandoSn(true);
    setShowSnModal(true);
    setModalSnInput(term);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/inventario/rastreo_sn/${encodeURIComponent(term)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setSnResultado(data);
      } else {
        setSnResultado({
          status: 'error',
          sn_buscado: term,
          estado_global: 'NO_ENCONTRADO',
          resumen: {},
          clientes: [],
          retirados: [],
          visitas: []
        });
      }
    } catch (e) {
      console.error("Error al rastrear SN:", e);
      setSnResultado({
        status: 'error',
        sn_buscado: term,
        estado_global: 'ERROR_CONEXION',
        resumen: {},
        clientes: [],
        retirados: [],
        visitas: []
      });
    } finally {
      setBuscandoSn(false);
    }
  };

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ transition: 'all 0.2s ease', flexShrink: 0 }}>
      <div className="sidebar-header">
        <div className="logo-container" style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : '200px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease' }}>
          <img src="/img/logo_futurity.png" alt="Logo" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
            Futurity{' '}
            <span style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 900
            }}>
              Atlas
            </span>
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-toggle-btn"
          title="Contraer/Expandir menú"
        >
          <i className="fa-solid fa-bars"></i>
        </button>
      </div>

      {/* Conmutador de Área Operativa */}
      <div className="sidebar-area-selector" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', marginBottom: '10px' }}>
        {!collapsed && (
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sidebar-text)', marginBottom: '6px', fontWeight: 700 }}>
            <i className="fa-solid fa-network-wired"></i> Área Operativa
          </div>
        )}

        {['ADMIN', 'ASESOR', 'ATC'].includes(role) ? (
          <div className="segmented-control" id="area-switcher" style={{ height: collapsed ? '0px' : 'auto', overflow: 'hidden', opacity: collapsed ? 0 : 1, transition: 'all 0.2s ease' }}>
            <div
              className="segmented-slider"
              style={{
                transform: activeArea === 'INSTALACIONES' ? 'translateX(100%)' : 'translateX(0%)',
                transition: 'transform 0.2s ease'
              }}
            ></div>
            <button
              type="button"
              className={`segmented-btn ${activeArea === 'SOPORTE' ? 'active' : ''}`}
              onClick={() => onAreaChange('SOPORTE')}
            >
              🛠️ Soporte
            </button>
            <button
              type="button"
              className={`segmented-btn ${activeArea === 'INSTALACIONES' ? 'active' : ''}`}
              onClick={() => onAreaChange('INSTALACIONES')}
            >
              🔌 Calidad
            </button>
          </div>
        ) : (
          !collapsed && (
            <div className="static-area-badge">
              {activeArea === 'INSTALACIONES' ? '🔌 Calidad' : '🛠️ Soporte'}
            </div>
          )
        )}
      </div>

      {/* Buscador Rápido de SN (Sólo ADMIN y BODEGA) */}
      {['ADMIN', 'BODEGA'].includes(role) && (
        <div style={{ padding: collapsed ? '0 10px 10px 10px' : '0 18px 12px 18px', borderBottom: '1px solid var(--border-color)', marginBottom: '10px' }}>
          {!collapsed ? (
            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sidebar-text)', marginBottom: '6px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-barcode" style={{ color: '#1f497d' }}></i> Rastrear SN Router/ONU
              </div>
              <form onSubmit={(e) => { e.preventDefault(); ejecutarRastreo(snQuery); }} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={snQuery}
                  onChange={(e) => setSnQuery(e.target.value)}
                  placeholder="Ej. ZTEGC... / HWTC..."
                  style={{
                    width: '100%',
                    padding: '8px 30px 8px 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--profile-bg)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="submit"
                  disabled={buscandoSn}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    background: 'none',
                    border: 'none',
                    color: '#1f497d',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    padding: '2px 4px'
                  }}
                >
                  {buscandoSn ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                </button>
              </form>
            </div>
          ) : (
            <div
              className="nav-item"
              onClick={() => {
                setModalSnInput('');
                setSnResultado(null);
                setShowSnModal(true);
              }}
              title="Rastrear SN de Router / ONU"
              style={{ justifyContent: 'center', borderRadius: '10px', background: 'rgba(31, 73, 125, 0.08)', color: '#1f497d' }}
            >
              <i className="fa-solid fa-barcode" style={{ fontSize: '1.15rem' }}></i>
            </div>
          )}
        </div>
      )}

      {/* Menú de Navegación */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1, overflowY: 'auto' }}>
        {isVisible('visitas') && (
          <div
            className={`nav-item ${activeTab === 'visitas' ? 'active' : ''}`}
            onClick={() => onTabChange('visitas')}
          >
            <i className="fa-solid fa-calendar-days" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>
              {activeArea === 'INSTALACIONES' ? 'Instalaciones del Día' : 'Visitas del Día'}
            </span>
          </div>
        )}

        {isVisible('mapa-tecnicos') && (
          <div
            className={`nav-item ${activeTab === 'mapa-tecnicos' ? 'active' : ''}`}
            onClick={() => onTabChange('mapa-tecnicos')}
          >
            <i className="fa-solid fa-map-location-dot" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Mapa en Vivo</span>
          </div>
        )}

        {isVisible('registro') && (
          <div
            className={`nav-item ${activeTab === 'registro' ? 'active' : ''}`}
            onClick={() => onTabChange('registro')}
          >
            <i className="fa-solid fa-pen-to-square" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>
              {activeArea === 'INSTALACIONES' ? 'Registrar Instalación' : 'Registrar Visita'}
            </span>
          </div>
        )}

        {isVisible('registro-atencion') && (
          <div
            className={`nav-item ${activeTab === 'registro-atencion' ? 'active' : ''}`}
            onClick={() => onTabChange('registro-atencion')}
          >
            <i className="fa-solid fa-headset" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Registrar Atención</span>
          </div>
        )}

        {isVisible('buscar-cliente') && (
          <div
            className={`nav-item ${activeTab === 'buscar-cliente' ? 'active' : ''}`}
            onClick={() => onTabChange('buscar-cliente')}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Buscador de Clientes</span>
          </div>
        )}

        {isVisible('metricas') && (
          <div
            className={`nav-item ${activeTab === 'metricas' ? 'active' : ''}`}
            onClick={() => onTabChange('metricas')}
          >
            <i className="fa-solid fa-chart-line" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Auditoría Clientes</span>
          </div>
        )}

        {isVisible('reportes') && (
          <div
            className={`nav-item ${activeTab === 'reportes' ? 'active' : ''}`}
            onClick={() => onTabChange('reportes')}
          >
            <i className="fa-solid fa-file-invoice" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Reportes Calidad</span>
          </div>
        )}

        {isVisible('control-calidad') && (
          <div
            className={`nav-item ${activeTab === 'control-calidad' ? 'active' : ''}`}
            onClick={() => onTabChange('control-calidad')}
          >
            <i className="fa-solid fa-star" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Control de Calidad</span>
          </div>
        )}

        {isVisible('asignacion-busetas') && (
          <div
            className={`nav-item ${activeTab === 'asignacion-busetas' ? 'active' : ''}`}
            onClick={() => onTabChange('asignacion-busetas')}
          >
            <i className="fa-solid fa-truck-front" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Asignación de Furgonetas</span>
          </div>
        )}

        {isVisible('inventario') && (
          <div
            className={`nav-item ${activeTab === 'inventario' ? 'active' : ''}`}
            onClick={() => onTabChange('inventario')}
          >
            <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>Inventario / Bodega</span>
          </div>
        )}

        {isVisible('usuarios') && (
          <div
            className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`}
            onClick={() => onTabChange('usuarios')}
          >
            <i className="fa-solid fa-users-gear" style={{ fontSize: '1.1rem', width: '20px' }}></i>
            <span style={{ marginLeft: '10px', display: collapsed ? 'none' : 'inline' }}>
              {role === 'ADMIN' ? 'Usuarios y Técnicos' : 'Recordatorios y Bloqueos'}
            </span>
          </div>
        )}
      </div>

      {/* Footer del Sidebar con perfil y controles */}
      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
        <div className="profile-card" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="profile-avatar">
            {name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="profile-info">
              <div className="profile-role" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--sidebar-text)', fontWeight: '700' }}>
                {role} Activo
              </div>
              <div className="profile-name" style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {name}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '15px 20px 0 20px' }}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="theme-btn"
            title="Alternar Modo Oscuro"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '10px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', padding: '8px 10px', borderRadius: '8px', transition: 'all 0.2s' }}
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`} style={{ width: '20px' }}></i>
            {!collapsed && <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>

          <button
            onClick={onLogout}
            className="logout-link"
            title="Cerrar Sesión"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '10px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '8px 10px', borderRadius: '8px', transition: 'all 0.2s' }}
          >
            <i className="fa-solid fa-right-from-bracket" style={{ width: '20px' }}></i>
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>

        {!collapsed && (
          <div style={{ marginTop: '10px', padding: '10px 0 0 0', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.72rem', color: 'var(--sidebar-text)', opacity: 0.7, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
            <span><i className="fa-solid fa-bolt" style={{ color: '#3b82f6' }}></i> Powered by Atlas</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.7 }}><i className="fa-solid fa-code-branch"></i> Versión React v1.0</span>
          </div>
        )}
      </div>

      {/* MODAL: RASTREO Y TRAZABILIDAD 360° DE SN */}
      {showSnModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '100%', maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(31, 73, 125, 0.08) 0%, rgba(31, 73, 125, 0.18) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1f497d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-barcode"></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.18rem', fontWeight: 900 }}>
                    Rastreo y Trazabilidad 360° de Equipo
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>
                    Consulta el estado de custodia, clientes activos y visitas de cualquier Router u ONU
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSnModal(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: '1.6rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Search Bar Input */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--profile-bg)' }}>
              <form onSubmit={(e) => { e.preventDefault(); ejecutarRastreo(modalSnInput); }} style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    value={modalSnInput}
                    onChange={(e) => setModalSnInput(e.target.value)}
                    placeholder="Escribe o escanea el SN del equipo (ONU o Router)..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={buscandoSn}
                  style={{
                    padding: '10px 22px',
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
                    boxShadow: '0 2px 8px rgba(31, 73, 125, 0.25)'
                  }}
                >
                  {buscandoSn ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                  Buscar
                </button>
              </form>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {buscandoSn ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: '#1f497d', marginBottom: '14px' }}></i>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Rastreando número de serie en base de datos...</p>
                </div>
              ) : !snResultado ? (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--sidebar-text)' }}>
                  <i className="fa-solid fa-barcode" style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '14px', display: 'block' }}></i>
                  <h5 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 800 }}>
                    Ingresa un Número de Serie
                  </h5>
                  <p style={{ margin: 0, fontSize: '0.84rem' }}>
                    Puedes ingresar o escanear el código de barras/SN de una ONU o Router para ver su historial completo.
                  </p>
                </div>
              ) : (
                <>
                  {/* ESTADO GLOBAL BANNER */}
                  {snResultado.estado_global === 'INSTALADO_EN_CLIENTE' && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        <i className="fa-solid fa-house-signal"></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#10b981', color: 'white', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            🟢 Instalado en Cliente Activo
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--sidebar-text)' }}>
                            Coincide con: <strong>{snResultado.resumen?.equipo_coincide}</strong>
                          </span>
                        </div>
                        <h5 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          {snResultado.resumen?.cliente} (Contrato: {snResultado.resumen?.contrato})
                        </h5>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--sidebar-text)' }}>
                          📍 {snResultado.resumen?.direccion || 'Sin dirección registrada'}
                        </p>
                      </div>
                    </div>
                  )}

                  {snResultado.estado_global === 'RETIRADO_EN_CUSTODIA' && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        <i className="fa-solid fa-truck-pickup"></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f59e0b', color: 'white', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            🟡 Retirado - En Custodia de Vehículo
                          </span>
                        </div>
                        <h5 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          🚗 Placa: {snResultado.resumen?.placa || 'Sin placa'} — Técnico: {snResultado.resumen?.tecnico}
                        </h5>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--sidebar-text)' }}>
                          Motivo: <strong>{snResultado.resumen?.motivo}</strong> | Fecha Retiro: {snResultado.resumen?.fecha_retiro}
                        </p>
                      </div>
                    </div>
                  )}

                  {snResultado.estado_global === 'RETIRADO_DEVUELTO_BODEGA' && (
                    <div style={{ background: 'rgba(31, 73, 125, 0.1)', border: '1px solid rgba(31, 73, 125, 0.3)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#1f497d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        <i className="fa-solid fa-warehouse"></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#1f497d', color: 'white', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            🔵 Retirado y Devuelto a Bodega
                          </span>
                        </div>
                        <h5 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          Devuelto por: {snResultado.resumen?.tecnico} ({snResultado.resumen?.placa})
                        </h5>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--sidebar-text)' }}>
                          Recibido en Bodega por: <strong>{snResultado.resumen?.recibido_por || 'Administración'}</strong> | Fecha Devolución: {snResultado.resumen?.fecha_devolucion}
                        </p>
                      </div>
                    </div>
                  )}

                  {snResultado.estado_global === 'REGISTRADO_EN_VISITA' && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        <i className="fa-solid fa-clipboard-check"></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#6366f1', color: 'white', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            🟣 Registrado en Visita Técnica
                          </span>
                        </div>
                        <h5 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          Visita #{snResultado.resumen?.id_visita} ({snResultado.resumen?.cliente})
                        </h5>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--sidebar-text)' }}>
                          Técnico: <strong>{snResultado.resumen?.tecnico}</strong> | Fecha: {snResultado.resumen?.fecha}
                        </p>
                      </div>
                    </div>
                  )}

                  {snResultado.estado_global === 'NO_ENCONTRADO' && (
                    <div style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                      <i className="fa-solid fa-circle-question" style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '10px', display: 'block' }}></i>
                      <h5 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Número de Serie No Encontrado
                      </h5>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--sidebar-text)' }}>
                        No se encontraron coincidencias para <strong>"{snResultado.sn_buscado}"</strong> en clientes activos, custodias ni visitas.
                      </p>
                    </div>
                  )}

                  {/* SECCIÓN 1: COINCIDENCIAS EN DIRECTORIO DE CLIENTES */}
                  {snResultado.clientes && snResultado.clientes.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-user-check" style={{ color: '#10b981' }}></i>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          Clientes con este Equipo ({snResultado.clientes.length})
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                            <th style={{ padding: '10px 14px' }}>Contrato</th>
                            <th style={{ padding: '10px 14px' }}>Cliente / Cédula</th>
                            <th style={{ padding: '10px 14px' }}>Dirección</th>
                            <th style={{ padding: '10px 14px' }}>SN ONU</th>
                            <th style={{ padding: '10px 14px' }}>SN Router</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snResultado.clientes.map((cl, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 900, color: '#1f497d' }}>{cl.contrato}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                {cl.nombre_cliente}
                                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>C.I: {cl.cedula || '---'}</span>
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--sidebar-text)', fontSize: '0.78rem' }}>{cl.direccion || '---'}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: cl.onu_sn?.toLowerCase().includes(snResultado.sn_buscado.toLowerCase()) ? '#10b981' : 'var(--text-main)' }}>
                                {cl.onu_sn || '---'}
                              </td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: cl.router_sn?.toLowerCase().includes(snResultado.sn_buscado.toLowerCase()) ? '#10b981' : 'var(--text-main)' }}>
                                {cl.router_sn || '---'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SECCIÓN 2: REGISTRO DE EQUIPOS RETIRADOS / CUSTODIA */}
                  {snResultado.retirados && snResultado.retirados.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-dolly" style={{ color: '#f59e0b' }}></i>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          Historial de Desmontes / Retiros ({snResultado.retirados.length})
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                            <th style={{ padding: '10px 14px' }}>Fecha Retiro</th>
                            <th style={{ padding: '10px 14px' }}>Técnico / Placa</th>
                            <th style={{ padding: '10px 14px' }}>Tipo / Modelo</th>
                            <th style={{ padding: '10px 14px' }}>Motivo</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Estado Custodia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snResultado.retirados.map((ret, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>{ret.fecha_retiro ? ret.fecha_retiro.slice(0, 16) : '---'}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1f497d' }}>
                                {ret.tecnico}
                                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 700 }}>🚗 {ret.placa_vehiculo || 'Sin placa'}</span>
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                                <span style={{ padding: '2px 6px', borderRadius: '6px', background: 'rgba(31, 73, 125, 0.08)', color: '#1f497d', fontSize: '0.74rem', marginRight: '6px' }}>{ret.tipo_equipo}</span>
                                {ret.modelo || 'Genérico'}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--sidebar-text)', fontSize: '0.78rem' }}>
                                <strong>{ret.motivo_retiro}</strong>
                                {ret.observacion_retiro && <span style={{ display: 'block', fontSize: '0.72rem' }}>{ret.observacion_retiro}</span>}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 800, background: ret.estado_custodia === 'EN_VEHICULO' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(31, 73, 125, 0.15)', color: ret.estado_custodia === 'EN_VEHICULO' ? '#d97706' : '#1f497d' }}>
                                  {ret.estado_custodia === 'EN_VEHICULO' ? '🟡 EN VEHÍCULO' : '🔵 EN BODEGA'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SECCIÓN 3: HISTORIAL EN VISITAS TÉCNICAS */}
                  {snResultado.visitas && snResultado.visitas.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-clock-rotate-left" style={{ color: '#6366f1' }}></i>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          Visitas Técnicas Registradas ({snResultado.visitas.length})
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                            <th style={{ padding: '10px 14px' }}>Visita</th>
                            <th style={{ padding: '10px 14px' }}>Fecha</th>
                            <th style={{ padding: '10px 14px' }}>Cliente / Contrato</th>
                            <th style={{ padding: '10px 14px' }}>Técnico</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snResultado.visitas.map((v, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 900, color: '#6366f1' }}>#{v.id_visita}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>{v.fecha_programada ? v.fecha_programada.slice(0, 10) : '---'}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 800 }}>
                                {v.cliente}
                                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--sidebar-text)', fontWeight: 600 }}>Contrato: {v.contrato}</span>
                              </td>
                              <td style={{ padding: '10px 14px', color: '#1f497d', fontWeight: 700 }}>{v.tecnico_principal}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 800, background: v.estado === 'FINALIZADA' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: v.estado === 'FINALIZADA' ? '#10b981' : '#ef4444' }}>
                                  {v.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--profile-bg)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowSnModal(false)}
                style={{ padding: '10px 22px', background: '#1f497d', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cerrar Rastreador
              </button>
            </div>

          </div>
        </div>
      )}

    </nav>
  );
}

export default Sidebar;
