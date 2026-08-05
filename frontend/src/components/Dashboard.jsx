import React from 'react';

function Dashboard({ user, onLogout }) {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.avatarCircle}>
            {user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}
          </div>
          <h2 style={styles.title}>¡Bienvenido, {user.nombre || 'Usuario'}!</h2>
          <p style={styles.subtitle}>Sesión iniciada con éxito a través de JWT</p>
        </div>

        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>ID Usuario:</span>
            <span style={styles.infoValue}>{user.id || 'N/A'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Nombre Completo:</span>
            <span style={styles.infoValue}>{user.nombre || 'N/A'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Rol Asignado:</span>
            <span style={{ ...styles.infoValue, ...styles.badge }}>
              {user.rol || 'ASESOR'}
            </span>
          </div>
        </div>

        <div style={styles.statusBox}>
          <div style={styles.statusDot}></div>
          <span style={styles.statusText}>Servicio API v2: Conectado</span>
        </div>

        <button onClick={handleLogout} style={styles.button}>
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a)',
    color: '#f8fafc',
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    background: 'rgba(30, 41, 59, 0.7)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '45px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  header: {
    marginBottom: '32px',
  },
  avatarCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    fontSize: '32px',
    fontWeight: '800',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  infoBox: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '20px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginBottom: '30px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
  },
  infoLabel: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  infoValue: {
    color: '#ffffff',
    fontWeight: '700',
  },
  badge: {
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    color: '#a5b4fc',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '30px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  statusText: {
    fontSize: '13px',
    color: '#10b981',
    fontWeight: '700',
  },
  button: {
    background: '#334155',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s',
  },
};

export default Dashboard;
