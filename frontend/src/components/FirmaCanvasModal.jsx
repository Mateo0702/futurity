import React, { useRef, useState, useEffect } from 'react';

export default function FirmaCanvasModal({ isOpen, onClose, onSave, titulo = "Firma Digital de Conformidad", subtitulo = "Dibuja la firma en el recuadro para confirmar la entrega" }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Bloquear scroll de fondo mientras el modal está abierto
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set display size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
    isDrawingRef.current = false;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handleTouchStart = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      isDrawingRef.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setHasDrawn(true);
    };

    const handleTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (!isDrawingRef.current) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const handleTouchEnd = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      isDrawingRef.current = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    if (!hasDrawn) {
      alert("Por favor dibuje la firma antes de confirmar.");
      return;
    }
    const canvas = canvasRef.current;
    const base64 = canvas.toDataURL('image/png');
    onSave(base64);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '15px'
    }}>
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        color: 'var(--text-main, #1e293b)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: '1px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Cabecera */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
              ✍️ {titulo}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {subtitulo}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}
          >
            ✕
          </button>
        </div>

        {/* Lienzo de Firma */}
        <div style={{ padding: '20px' }}>
          <div style={{
            position: 'relative',
            border: '2px dashed #cbd5e1',
            borderRadius: '14px',
            background: '#f8fafc',
            height: '220px',
            overflow: 'hidden',
            touchAction: 'none'
          }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
            />
            {!hasDrawn && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                ✏️ Dibuja la firma aquí con el dedo o ratón
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'var(--hover-bg, #f1f5f9)',
                border: '1px solid #cbd5e1',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              🗑️ Limpiar Lienzo
            </button>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Firma digital válida para acta de entrega
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', background: 'var(--hover-bg, #f8fafc)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Confirmar y Entregar</span> ✅
          </button>
        </div>
      </div>
    </div>
  );
}
