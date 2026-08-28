import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [tempUserData, setTempUserData] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passModalError, setPassModalError] = useState('');
  const [passModalLoading, setPassModalLoading] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/v2/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // Verificar si es primer ingreso obligatorio
        if (data.usuario && (data.usuario.primer_ingreso === 1 || data.usuario.primer_ingreso === true)) {
          setTempToken(data.token);
          setTempUserData(data.usuario);
          setShowFirstLoginModal(true);
          return;
        }

        // Login normal
        finishLoginSession(data.token, data.usuario);
      } else {
        const errorMsg = data.errors ? data.errors.join(', ') : (data.message || 'Credenciales incorrectas');
        setError(errorMsg);
      }
    } catch (err) {
      setError('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  const finishLoginSession = (token, usuario) => {
    localStorage.setItem('token', token);
    localStorage.setItem('session_token', token);
    localStorage.setItem('user', JSON.stringify(usuario));
    if (usuario && usuario.nombre) {
      localStorage.setItem('user_name', usuario.nombre);
    }
    if (usuario && usuario.rol) {
      localStorage.setItem('user_role', usuario.rol);
    }
    onLoginSuccess(token, usuario);
  };

  const handleFirstLoginPasswordSubmit = async (e) => {
    e.preventDefault();
    setPassModalError('');

    const hasLength = newPass.length >= 8;
    const hasUpper = /[A-Z]/.test(newPass);
    const hasLower = /[a-z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPass);
    const isMatching = confirmPass.length > 0 && newPass === confirmPass;

    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      setPassModalError('La contraseña no cumple con todos los requisitos de seguridad.');
      return;
    }

    if (!isMatching) {
      setPassModalError('Las contraseñas no coinciden. Por favor verifica.');
      return;
    }

    setPassModalLoading(true);

    try {
      const res = await fetch('/api/v2/cambiar_password_primer_ingreso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ new_password: newPass })
      });

      const resData = await res.json();
      if (res.ok && resData.status === 'success') {
        const updatedUser = { ...tempUserData, primer_ingreso: 0 };
        setShowFirstLoginModal(false);
        finishLoginSession(tempToken, updatedUser);
      } else {
        setPassModalError(resData.message || 'No se pudo actualizar la contraseña.');
      }
    } catch (err) {
      setPassModalError('Error de conexión con el servidor.');
    } finally {
      setPassModalLoading(false);
    }
  };

  // --- VISTA PANTALLA COMPLETA: CAMBIAR CONTRASEÑA (MIGRADA DE cambiar_password.html) ---
  if (showFirstLoginModal) {
    const hasLength = newPass.length >= 8;
    const hasUpper = /[A-Z]/.test(newPass);
    const hasLower = /[a-z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPass);
    const isMatching = confirmPass.length > 0 && newPass === confirmPass;
    const canSubmit = hasLength && hasUpper && hasLower && hasNumber && hasSymbol && isMatching;

    return (
      <div 
        id="cambiar-password-page"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh', 
          width: '100vw',
          background: 'linear-gradient(135deg, #07090e 0%, #0f172a 100%)', 
          color: '#f8fafc',
          padding: '20px', 
          boxSizing: 'border-box',
          fontFamily: 'Outfit, system-ui'
        }}
      >
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '24px', maxWidth: '460px', width: '100%', flexDirection: 'column', padding: '32px 28px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="/img/logo_futurity.png" alt="Futurity Logo" style={{ height: '48px', objectFit: 'contain', marginBottom: '12px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc' }}>Seguridad Futurity</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Establece tu contraseña personal</p>
          </div>

          <div style={{ marginBottom: '20px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '0.82rem', lineHeight: 1.4, fontWeight: 600 }}>
            <strong>Cambio Obligatorio:</strong> Para proteger la información de la plataforma, debes actualizar tu contraseña inicial por una contraseña segura y personalizada.
          </div>

          {passModalError && (
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', fontSize: '0.82rem', fontWeight: 600 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i> {passModalError}
            </div>
          )}

          <form onSubmit={handleFirstLoginPasswordSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: '#cbd5e1' }}>Nueva Contraseña</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Ingresa tu nueva contraseña"
                  style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '12px', background: '#1e293b', border: '1px solid #475569', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  aria-label="Mostrar u ocultar contraseña"
                >
                  <i className={`fa-solid ${showNewPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Lista de Requisitos en tiempo real */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: '#cbd5e1', fontSize: '0.8rem' }}>Requisitos de contraseña segura:</div>
              <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: hasLength ? '#34d399' : '#64748b', fontWeight: hasLength ? 700 : 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: hasLength ? 'rgba(52, 211, 153, 0.2)' : 'transparent', border: `1px solid ${hasLength ? '#34d399' : '#475569'}`, marginRight: '8px', fontSize: '0.7rem' }}>{hasLength ? '✓' : '•'}</span>
                  Mínimo 8 caracteres
                </li>
                <li style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: hasUpper ? '#34d399' : '#64748b', fontWeight: hasUpper ? 700 : 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: hasUpper ? 'rgba(52, 211, 153, 0.2)' : 'transparent', border: `1px solid ${hasUpper ? '#34d399' : '#475569'}`, marginRight: '8px', fontSize: '0.7rem' }}>{hasUpper ? '✓' : '•'}</span>
                  Al menos una letra mayúscula (A-Z)
                </li>
                <li style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: hasLower ? '#34d399' : '#64748b', fontWeight: hasLower ? 700 : 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: hasLower ? 'rgba(52, 211, 153, 0.2)' : 'transparent', border: `1px solid ${hasLower ? '#34d399' : '#475569'}`, marginRight: '8px', fontSize: '0.7rem' }}>{hasLower ? '✓' : '•'}</span>
                  Al menos una letra minúscula (a-z)
                </li>
                <li style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: hasNumber ? '#34d399' : '#64748b', fontWeight: hasNumber ? 700 : 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: hasNumber ? 'rgba(52, 211, 153, 0.2)' : 'transparent', border: `1px solid ${hasNumber ? '#34d399' : '#475569'}`, marginRight: '8px', fontSize: '0.7rem' }}>{hasNumber ? '✓' : '•'}</span>
                  Al menos un número (0-9)
                </li>
                <li style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: hasSymbol ? '#34d399' : '#64748b', fontWeight: hasSymbol ? 700 : 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: hasSymbol ? 'rgba(52, 211, 153, 0.2)' : 'transparent', border: `1px solid ${hasSymbol ? '#34d399' : '#475569'}`, marginRight: '8px', fontSize: '0.7rem' }}>{hasSymbol ? '✓' : '•'}</span>
                  Al menos un signo o carácter especial
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: '#cbd5e1' }}>Confirmar Contraseña</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '12px', background: '#1e293b', border: '1px solid #475569', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  aria-label="Mostrar u ocultar contraseña"
                >
                  <i className={`fa-solid ${showConfirmPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {confirmPass.length > 0 && !isMatching && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '6px', fontWeight: 600 }}>
                  Las contraseñas no coinciden.
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit || passModalLoading}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', background: (canSubmit && !passModalLoading) ? 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' : '#334155', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: (canSubmit && !passModalLoading) ? 'pointer' : 'not-allowed', opacity: (canSubmit && !passModalLoading) ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: (canSubmit && !passModalLoading) ? '0 4px 15px rgba(225, 29, 72, 0.4)' : 'none' }}
            >
              <span>{passModalLoading ? 'Actualizando...' : 'Actualizar Contraseña'}</span>
              <i className="fa-solid fa-shield-halved"></i>
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '15px', borderTop: '1px solid #334155', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Futurity Portal • Seguridad Atlas
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-split-card">
        {/* Panel Izquierdo: Visual & Características */}
        <div className="login-split-left">
          <div className="login-left-content">
            <div className="login-shield-container" style={{ width: '130px', height: '130px', margin: '0 auto 20px auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="login-shield-glow" style={{ position: 'absolute', inset: '-10px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, rgba(225, 29, 72, 0.15) 60%, transparent 80%)', filter: 'blur(20px)', borderRadius: '50%', zIndex: 0 }}></div>
              <img
                src="/img/new_atlas.png"
                alt="Atlas Platform Logo"
                style={{
                  width: '110px',
                  height: '110px',
                  objectFit: 'contain',
                  position: 'relative',
                  zIndex: 1,
                  filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))'
                }}
              />
            </div>
            <h1 className="login-left-title" style={{ fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
              <span style={{ background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f43f5e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900, fontSize: '2.2rem' }}>ATLAS</span>
            </h1>
            <p className="login-left-desc" style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto' }}>
              Plataforma inteligente de optimización de rutas, trazabilidad de equipos y control de calidad para ISPs.
            </p>
          </div>

          {/* Características del sistema al pie */}
          <div className="login-features-grid">
            <div className="login-feature-item">
              <div className="login-feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div className="login-feature-title">Seguro</div>
              <div className="login-feature-desc">Datos protegidos</div>
            </div>
            <div className="login-feature-item">
              <div className="login-feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <div className="login-feature-title">Rápido</div>
              <div className="login-feature-desc">Acceso en segundos</div>
            </div>
            <div className="login-feature-item">
              <div className="login-feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
              </div>
              <div className="login-feature-title">Móvil</div>
              <div className="login-feature-desc">Panel de Técnicos</div>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Formulario de Login */}
        <div className="login-split-right">
          <div className="login-logo-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
            <img src="/img/logo_futurity.png" alt="Futurity Logo" style={{ height: '36px', objectFit: 'contain' }} />
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Futurity <span style={{ background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>Atlas</span>
            </span>
          </div>

          <div className="login-right-header">
            <h2>Portal de Acceso</h2>
            <p>Inicia sesión para acceder al centro de control o panel técnico</p>
          </div>

          <div>
            {error && (
              <div className="login-alert login-alert-error" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-form-group">
                <label htmlFor="email">Correo Corporativo</label>
                <div className="input-with-icon-wrapper">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@futurity.com"
                    className="login-input"
                  />
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="login-form-group">
                <label htmlFor="password">Contraseña</label>
                <div className="input-with-icon-wrapper password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                  />
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="toggle-password-btn"
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-btn"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}
              >
                <span>{loading ? 'Autenticando...' : 'Ingresar al Sistema'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </button>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.8rem' }}>
            <a href="/descargar_app" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              Descargar App Futurity Atlas
            </a>
          </div>

          <div style={{ textAlign: 'center', marginTop: '35px', paddingTop: '15px', borderTop: '1px solid var(--border-color)', fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
            <span><i className="fa-solid fa-bolt" style={{ color: '#2563eb', marginRight: '4px' }}></i> Powered by Atlas Enterprise</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>Futurity Portal • React SPA v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
