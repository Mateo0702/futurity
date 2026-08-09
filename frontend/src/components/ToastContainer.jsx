import React, { useState, useEffect } from 'react';

// Global function to trigger toasts dynamically anywhere
export function showToast(message, type = 'success', duration = 3200) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('futurity-toast', {
      detail: { message, type, duration, id: Date.now() + Math.random() }
    }));
  }
}

// Global window.alert override so all existing alert() calls automatically become elegant self-destructing toasts!
if (typeof window !== 'undefined' && !window.__toastAlertOverridden) {
  window.__toastAlertOverridden = true;
  window.nativeAlert = window.alert;
  window.alert = (msg) => {
    if (!msg) return;
    const strMsg = String(msg);
    let type = 'info';
    if (
      strMsg.includes('éxito') || 
      strMsg.includes('exitos') || 
      strMsg.includes('cread') || 
      strMsg.includes('guardad') || 
      strMsg.includes('actualizad') || 
      strMsg.includes('registrad') || 
      strMsg.includes('agendad') ||
      strMsg.includes('cerrad') ||
      strMsg.includes('finalizad')
    ) {
      type = 'success';
    } else if (
      strMsg.includes('Error') || 
      strMsg.includes('error') || 
      strMsg.includes('falló') || 
      strMsg.includes('inválid') || 
      strMsg.includes('denegado') ||
      strMsg.includes('No se pudo')
    ) {
      type = 'error';
    } else if (
      strMsg.includes('Por favor') || 
      strMsg.includes('Atención') || 
      strMsg.includes('Campos') ||
      strMsg.includes('selecciona')
    ) {
      type = 'warning';
    }
    showToast(strMsg, type);
  };
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const newToast = e.detail;
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 3200);
    };

    window.addEventListener('futurity-toast', handleToast);
    return () => window.removeEventListener('futurity-toast', handleToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '420px',
        width: '90%',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => {
        let bgColor = 'rgba(15, 23, 42, 0.92)';
        let borderColor = '#3b82f6';
        let icon = 'fa-circle-info';
        let iconColor = '#60a5fa';

        if (toast.type === 'success') {
          bgColor = 'rgba(6, 78, 59, 0.94)';
          borderColor = '#10b981';
          icon = 'fa-circle-check';
          iconColor = '#34d399';
        } else if (toast.type === 'error') {
          bgColor = 'rgba(127, 29, 29, 0.94)';
          borderColor = '#ef4444';
          icon = 'fa-circle-xmark';
          iconColor = '#f87171';
        } else if (toast.type === 'warning') {
          bgColor = 'rgba(120, 53, 15, 0.94)';
          borderColor = '#f59e0b';
          icon = 'fa-triangle-exclamation';
          iconColor = '#fbbf24';
        }

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: bgColor,
              color: '#ffffff',
              borderLeft: `5px solid ${borderColor}`,
              borderRadius: '14px',
              padding: '12px 16px',
              boxShadow: '0 12px 24px -6px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              animation: 'futurityToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              fontSize: '0.88rem',
              fontWeight: 600,
              letterSpacing: '0.01em'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <i className={`fa-solid ${icon}`} style={{ fontSize: '1.2rem', color: iconColor, flexShrink: 0 }}></i>
              <span style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '6px',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
