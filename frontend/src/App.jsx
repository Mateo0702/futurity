import { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import AtencionesTab from './components/AtencionesTab';
import MetricasTab from './components/MetricasTab';
import VisitasTab from './components/VisitasTab';
import RegistroVisitasTab from './components/RegistroVisitasTab';
import BuscadorClienteTab from './components/BuscadorClienteTab';
import UsuariosTab from './components/UsuariosTab';
import MapaTecnicosTab from './components/MapaTecnicosTab';
import ControlCalidadTab from './components/ControlCalidadTab';
import ReportesTab from './components/ReportesTab';
import PublicoCuadroMando from './components/PublicoCuadroMando';
import InventarioTab from './components/InventarioTab';
import TecnicoPanel from './components/TecnicoPanel';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);
  
  // Parse URL search parameters on app initialization
  const searchParams = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;

  let initialTabFromUrl = searchParams.get('tab');
  const initialSubTabFromUrl = searchParams.get('subtab');
  let initialFechaFromUrl = searchParams.get('fecha');
  let publicTokenFromUrl = searchParams.get('token');

  // Check if public report link is accessed via URL path
  if (pathname.includes('/publico/cuadro_mando/')) {
    const parts = pathname.split('/publico/cuadro_mando/')[1].split('/');
    if (parts.length >= 2) {
      initialTabFromUrl = 'publico-cuadro-mando';
      initialFechaFromUrl = parts[0];
      publicTokenFromUrl = parts[1];
    }
  }

  // Check if technician panel is accessed via URL path
  let initialTecnicoNombre = '';
  if (pathname.startsWith('/tecnico/')) {
    const parts = pathname.split('/tecnico/');
    if (parts.length >= 2) {
      initialTabFromUrl = 'tecnico-panel';
      initialTecnicoNombre = decodeURIComponent(parts[1]).replace(/_/g, ' ');
    }
  }

  // Navigation states matching Flask session variables
  const [activeTab, setActiveTab] = useState(initialTabFromUrl || 'visitas');
  const [activeArea, setActiveArea] = useState('SOPORTE');
  const [tecnicoNombre, setTecnicoNombre] = useState(initialTecnicoNombre);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setInitialized(true);
  }, []);

  // Sincronizar el estado activeTab con la URL del navegador
  useEffect(() => {
    if (!initialized) return;
    
    const params = new URLSearchParams(window.location.search);
    
    if (activeTab === 'visitas') {
      // Limpiar parámetros para la pestaña visitas (que es la principal/defecto)
      params.delete('tab');
      params.delete('subtab');
      params.delete('fecha');
    } else {
      params.set('tab', activeTab);
      // Solo mantener subtab y fecha si estamos en la pestaña de reportes
      if (activeTab !== 'reportes') {
        params.delete('subtab');
        params.delete('fecha');
      }
    }
    
    const newSearch = params.toString();
    const newPath = newSearch ? `?${newSearch}` : window.location.pathname;
    window.history.replaceState(null, '', newPath);
  }, [activeTab, initialized]);

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  if (!initialized) {
    return (
      <div style={styles.loading}>
        <div>Cargando sesión...</div>
      </div>
    );
  }

  // Handle Public Report without demanding login
  if (activeTab === 'publico-cuadro-mando') {
    return <PublicoCuadroMando fecha={initialFechaFromUrl} token={publicTokenFromUrl} />;
  }

  // Render content depending on activeTab
  const renderTabContent = () => {
    if (activeTab === 'registro-atencion') {
      return <AtencionesTab token={token} user={user} />;
    }
    if (activeTab === 'buscar-cliente') {
      return <BuscadorClienteTab token={token} />;
    }
    if (activeTab === 'mapa-tecnicos') {
      return <MapaTecnicosTab token={token} activeArea={activeArea} />;
    }
    if (activeTab === 'registro') {
      return <RegistroVisitasTab token={token} user={user} activeArea={activeArea} />;
    }
    if (activeTab === 'visitas') {
      return <VisitasTab token={token} user={user} />;
    }
    if (activeTab === 'metricas') {
      return <MetricasTab token={token} />;
    }
    if (activeTab === 'reportes') {
      return <ReportesTab token={token} initialSubTab={initialSubTabFromUrl} initialFecha={initialFechaFromUrl} />;
    }
    if (activeTab === 'control-calidad') {
      return <ControlCalidadTab token={token} />;
    }
    if (activeTab === 'usuarios') {
      return <UsuariosTab token={token} user={user} />;
    }
    if (activeTab === 'inventario') {
      return <InventarioTab token={token} />;
    }
    
    // Placeholder for tabs that are not migrated yet
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sidebar-text)', flexGrow: 1 }}>
        <i className="fa-solid fa-screwdriver-wrench" style={{ fontSize: '3rem', marginBottom: '20px', display: 'block', color: 'var(--primary)' }}></i>
        <h2>Pestaña en Migración</h2>
        <p style={{ marginTop: '10px' }}>
          La pestaña <strong>"{activeTab.toUpperCase()}"</strong> está siendo migrada a React. 
          Pronto estará disponible con la nueva interfaz de usuario.
        </p>
      </div>
    );
  };

  return (
    <>
      {token && user ? (
        user.role === 'TECNICO' || activeTab === 'tecnico-panel' ? (
          <TecnicoPanel token={token} user={user} tecnicoNombreParam={tecnicoNombre} />
        ) : (
          <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            {/* Barra Lateral (Sidebar) */}
            <Sidebar
              user={user}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              activeArea={activeArea}
              onAreaChange={setActiveArea}
              onLogout={handleLogout}
            />
            
            {/* Contenido Principal (Main Area) */}
            <main className="main-content" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', overflow: 'hidden', background: 'var(--bg-color)' }}>
              {renderTabContent()}
            </main>
          </div>
        )
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

const styles = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0f172a',
    color: '#94a3b8',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '18px',
  },
};

export default App;
