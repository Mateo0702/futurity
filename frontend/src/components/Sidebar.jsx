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
    if (tab === 'visitas' || tab === 'mapa-tecnicos' || tab === 'registro') {
      return ['ADMIN', 'ASESOR', 'CALIDAD'].includes(role);
    }
    if (tab === 'registro-atencion' || tab === 'buscar-cliente') {
      return ['ADMIN', 'ASESOR'].includes(role);
    }
    if (tab === 'metricas' || tab === 'reportes' || tab === 'control-calidad') {
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
      <div className="sidebar-area-selector" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', marginBottom: '15px' }}>
        {!collapsed && (
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sidebar-text)', marginBottom: '6px', fontWeight: 700 }}>
            <i className="fa-solid fa-network-wired"></i> Área Operativa
          </div>
        )}

        {['ADMIN', 'ASESOR'].includes(role) ? (
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
            <span><i class="fa-solid fa-bolt" style={{ color: '#3b82f6' }}></i> Powered by Atlas</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.7 }}><i class="fa-solid fa-code-branch"></i> Versión React v1.0</span>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Sidebar;
