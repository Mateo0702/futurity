import React from 'react';

export default function DescargarApp() {
  return (
    <div style={styles.body}>
      <div style={styles.glow1}></div>
      <div style={styles.glow2}></div>

      <div style={styles.container}>
        <div style={styles.brandHeader}>
          <img src="/static/img/logo_futurity.png" alt="Futurity Logo" style={styles.brandLogo} />
        </div>

        <div style={styles.appCard}>
          <div style={styles.appIconWrapper}>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>

          <h2 style={styles.appTitle}>
            Futurity <span style={styles.appTitleGradient}>Atlas</span>
          </h2>
          <p style={styles.appSubtitle}>
            Aplicación móvil oficial para técnicos de campo. Permite el registro de visitas, gestión de inventario y seguimiento de ubicación en ruta.
          </p>

          {/* Download Button */}
          <a href="/static/app/futurity_atlas.apk" style={styles.btnDownload} download="futurity_atlas.apk">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Descargar para Android (.apk)</span>
          </a>

          {/* Steps for Installation */}
          <div style={styles.instructionsTitle}>Instrucciones de instalación</div>
          <ul style={styles.instructionsList}>
            <li style={styles.instructionStep}>
              <div style={styles.stepNum}>1</div>
              <div style={styles.stepText}>
                Pulsa el botón de <strong>Descargar</strong> desde tu celular Android.
              </div>
            </li>
            <li style={styles.instructionStep}>
              <div style={styles.stepNum}>2</div>
              <div style={styles.stepText}>
                Si Android te advierte que el archivo puede ser dañino, selecciona <strong>"Descargar de todos modos"</strong>.
              </div>
            </li>
            <li style={styles.instructionStep}>
              <div style={styles.stepNum}>3</div>
              <div style={styles.stepText}>
                <strong>IMPORTANTE:</strong> Si ya tenías instalada una versión anterior de Futurity en tu celular, debes <strong>desinstalarla por completo</strong> antes de instalar esta nueva versión para evitar conflictos.
              </div>
            </li>
            <li style={styles.instructionStep}>
              <div style={styles.stepNum}>4</div>
              <div style={styles.stepText}>
                Abre el archivo descargado, concede los permisos de instalación si te los pide, y presiona <strong>Instalar</strong>.
              </div>
            </li>
          </ul>
        </div>

        <div style={styles.footer}>
          <p><a href="/" style={styles.footerLink}>Volver al portal de acceso</a></p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  body: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '40px 20px 60px 20px',
    boxSizing: 'border-box',
    position: 'relative',
    overflowY: 'auto'
  },
  glow1: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(225, 29, 72, 0.15) 0%, transparent 70%)',
    top: '-50px',
    left: '-50px',
    zIndex: 1,
    pointerEvents: 'none'
  },
  glow2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)',
    bottom: '-100px',
    right: '-100px',
    zIndex: 1,
    pointerEvents: 'none'
  },
  container: {
    width: '100%',
    maxWidth: '480px',
    zIndex: 2,
    textAlign: 'center'
  },
  brandHeader: {
    marginBottom: '25px'
  },
  brandLogo: {
    maxWidth: '160px',
    height: 'auto',
    marginBottom: '10px'
  },
  appCard: {
    background: 'rgba(30, 41, 59, 0.7)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '35px 25px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
  },
  appIconWrapper: {
    width: '80px',
    height: '80px',
    background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px auto',
    boxShadow: '0 8px 20px rgba(225, 29, 72, 0.4)',
    color: 'white'
  },
  appTitle: {
    fontSize: '1.8rem',
    fontWeight: 700,
    marginBottom: '8px',
    letterSpacing: '-0.5px',
    color: '#f8fafc'
  },
  appTitleGradient: {
    background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 900
  },
  appSubtitle: {
    fontSize: '0.95rem',
    color: '#94a3b8',
    marginBottom: '30px',
    lineHeight: 1.5
  },
  btnDownload: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    backgroundColor: '#e11d48',
    color: 'white',
    textDecoration: 'none',
    padding: '16px 24px',
    borderRadius: '16px',
    fontWeight: 600,
    fontSize: '1.05rem',
    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '25px',
    boxSizing: 'border-box'
  },
  instructionsTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    textAlign: 'left',
    marginBottom: '15px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '8px',
    color: '#38bdf8'
  },
  instructionsList: {
    textAlign: 'left',
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  instructionStep: {
    display: 'flex',
    gap: '12px',
    marginBottom: '14px',
    fontSize: '0.88rem',
    lineHeight: 1.45
  },
  stepNum: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#38bdf8',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.78rem',
    flexShrink: 0
  },
  stepText: {
    color: '#94a3b8'
  },
  footer: {
    marginTop: '25px',
    fontSize: '0.75rem',
    color: '#94a3b8'
  },
  footerLink: {
    color: '#94a3b8',
    textDecoration: 'underline'
  }
};
