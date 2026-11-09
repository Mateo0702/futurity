import React, { useState, useEffect } from 'react';

export default function FichaVisitaDrawer({
  isOpen,
  onClose,
  visita,
  token,
  tecnicos = [],
  onRefresh,
  onOpenAssignCuadrilla,
  onOpenEditModal,
  onSendTelegramAlert
}) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  
  // Panel activo de acción del Asesor: null | 'reagendar' | 'cancelar' | 'cambio_fo'
  const [activeAction, setActiveAction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Formulario Reagendar
  const [reagendarFecha, setReagendarFecha] = useState('');
  const [reagendarPrioridad, setReagendarPrioridad] = useState('MEDIA');
  const [reagendarMotivo, setReagendarMotivo] = useState('');

  // Formulario Cancelar / Cerrar
  const [cancelarEstado, setCancelarEstado] = useState('CANCELADA');
  const [cancelarMotivo, setCancelarMotivo] = useState('');

  // Formulario Programar Cambio de FO
  const [foFecha, setFoFecha] = useState('');
  const [foHorario, setFoHorario] = useState('COORDINAR');
  const [foTecnico, setFoTecnico] = useState('NO TECNICO');
  const [foObs, setFoObs] = useState('');

  // Helpers de fechas (mañana por defecto)
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Reset al cambiar de visita o abrir
  useEffect(() => {
    if (visita) {
      setActiveAction(null);
      setActionFeedback(null);
      setIsSubmitting(false);

      const manana = getTomorrowStr();
      setReagendarFecha(manana);
      setReagendarPrioridad(visita.prioridad || 'MEDIA');
      setReagendarMotivo('');

      setCancelarEstado('CANCELADA');
      setCancelarMotivo('');

      setFoFecha(manana);
      setFoHorario('COORDINAR');
      setFoTecnico('NO TECNICO');
      setFoObs('Coordinado por asesor tras revisión técnica. Trabajo a realizar: CAMBIO DE FO.');
    }
  }, [visita, isOpen]);

  if (!isOpen || !visita) return null;

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(clean || phone);
      }
    } catch (e) {
      console.warn("Clipboard failed", e);
    }
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleOpenWhatsApp = (visitaObj) => {
    const rawPhones = visitaObj.telefonos || '';
    const match = rawPhones.match(/\d{9,10}/);
    let cleanPhone = match ? match[0] : '';
    if (cleanPhone.startsWith('0')) cleanPhone = '593' + cleanPhone.substring(1);
    else if (cleanPhone.length === 9) cleanPhone = '593' + cleanPhone;

    const tipoVisita = visitaObj.es_instalacion ? 'INSTALACIÓN DE SERVICIO' : 'VISITA TÉCNICA DE SOPORTE';
    const horPref = visitaObj.preferencia_horaria || 'En el transcurso del día';
    const techDisp = visitaObj.tecnico_apoyo 
      ? `${visitaObj.tecnico_principal} y ${visitaObj.tecnico_apoyo}` 
      : (visitaObj.tecnico_principal || 'Cuadrilla asignada');

    const tokenSeguimiento = visitaObj.token_rastreo || visitaObj.token;
    const trackingLink = tokenSeguimiento 
      ? `\n📲 *Seguimiento y Datos del Técnico en Vivo:*\nPuede consultar los datos del técnico y seguir su llegada en tiempo real aquí:\n${window.location.origin}/seguimiento/${tokenSeguimiento}\n`
      : '';

    const msg = `Estimado/a *${visitaObj.cliente}*,\nLe saludamos de *Futurity*.\n\n` +
      `Le informamos que su *${tipoVisita}* está agendada para el día *${visitaObj.fecha_programada}*.\n` +
      `⏰ Horario estimado: *${horPref}*\n` +
      `👤 Personal técnico asignado: *${techDisp}*\n` +
      `${trackingLink}\n` +
      `Por favor, asegúrese de que alguien mayor de edad se encuentre en el domicilio. ¡Gracias!`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  // 1. Ejecutar Reagendamiento (Asesor)
  const handleConfirmReagendar = async (e) => {
    e.preventDefault();
    if (!reagendarFecha) {
      alert("Por favor selecciona una fecha válida.");
      return;
    }
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/visitas/reagendar/${visita.id_visita}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          nueva_fecha: reagendarFecha,
          nueva_prioridad: reagendarPrioridad || 'MEDIA',
          observacion_reagendado: reagendarMotivo || ''
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionFeedback({ type: 'success', message: '¡Visita reagendada con éxito para la nueva fecha!' });
        setTimeout(() => {
          if (onRefresh) onRefresh();
          onClose();
        }, 1200);
      } else {
        setActionFeedback({ type: 'error', message: data.message || 'Error al reagendar visita.' });
      }
    } catch (err) {
      console.error("Error al reagendar:", err);
      setActionFeedback({ type: 'error', message: 'Error de conexión con el servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Ejecutar Cancelación / Cierre (Asesor)
  const handleConfirmCancelar = async (e) => {
    e.preventDefault();
    if (!cancelarMotivo.trim()) {
      alert("Por favor ingresa el motivo o resolución del cierre.");
      return;
    }
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/visitas/${visita.id_visita}/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          motivo: cancelarMotivo,
          estado_cancelacion: cancelarEstado
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionFeedback({ type: 'success', message: '¡Visita cerrada / cancelada exitosamente!' });
        setTimeout(() => {
          if (onRefresh) onRefresh();
          onClose();
        }, 1200);
      } else {
        setActionFeedback({ type: 'error', message: data.message || 'Error al cancelar la visita.' });
      }
    } catch (err) {
      console.error("Error al cancelar:", err);
      setActionFeedback({ type: 'error', message: 'Error de conexión con el servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Ejecutar Programación de Cambio de FO (Asesor)
  const handleConfirmCambioFO = async (e) => {
    e.preventDefault();
    if (!foFecha) {
      alert("Por favor selecciona una fecha para el cambio de FO.");
      return;
    }
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await fetch('/api/visitas/crear_cambio_fo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          id_visita_origen: visita.id_visita,
          contrato: visita.contrato || '',
          cliente: visita.cliente || '',
          sector: visita.sector || '',
          direccion: visita.direccion || '',
          telefonos: visita.telefonos || '',
          empresa: visita.empresa || 'SERVICABLE',
          servicio: visita.servicio || 'INTERNET_GPON',
          velocidad_mbps: String(visita.velocidad_mbps || ''),
          latitud: String(visita.latitud || ''),
          longitud: String(visita.longitud || ''),
          fecha_programada: foFecha,
          preferencia_horaria: foHorario,
          tecnico_principal: foTecnico || 'NO TECNICO',
          observacion_callcenter: foObs
        })
      });
      const data = await res.json();
      if (data.status === 'ok' || data.status === 'success') {
        setActionFeedback({ type: 'success', message: '¡Visita de Cambio de FO programada exitosamente!' });
        setTimeout(() => {
          if (onRefresh) onRefresh();
          onClose();
        }, 1200);
      } else {
        setActionFeedback({ type: 'error', message: data.message || 'Error al programar cambio de FO.' });
      }
    } catch (err) {
      console.error("Error al crear cambio de FO:", err);
      setActionFeedback({ type: 'error', message: 'Error de conexión con el servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const estado = (visita.estado || 'PENDIENTE').toUpperCase();
  const esApoyo = !!visita._esApoyo;
  const titularNombre = visita._titularNombre || visita.tecnico_principal;

  // Detección: El técnico cerró solicitando Cambio de FO
  const solUpper = (visita.solucion_tecnico || '').toUpperCase();
  const obsTecUpper = (visita.observacion_tecnico || '').toUpperCase();
  const resUpper = (visita.resolucion_final || '').toUpperCase();
  const isFOSolicitado = solUpper.includes('GENERAR CAMBIO DE FO') || 
                         solUpper.includes('REQUIERE CAMBIO DE FO') || 
                         obsTecUpper.includes('GENERAR CAMBIO DE FO');
  const isFOAgendado = resUpper.includes('CAMBIO DE FO AGENDADO');

  let badgeColor = '#f59e0b';
  let badgeBg = 'rgba(245, 158, 11, 0.12)';
  if (isFOSolicitado && !isFOAgendado) {
    badgeColor = '#ea580c';
    badgeBg = 'rgba(234, 88, 12, 0.14)';
  } else if (estado === 'FINALIZADA') {
    badgeColor = '#10b981';
    badgeBg = 'rgba(16, 185, 129, 0.12)';
  } else if (estado === 'EN_RUTA') {
    badgeColor = '#0284c7';
    badgeBg = 'rgba(2, 132, 199, 0.12)';
  } else if (estado === 'EN_PROGRESO' || estado === 'EN_SITIO') {
    badgeColor = '#8b5cf6';
    badgeBg = 'rgba(139, 92, 246, 0.12)';
  } else if (visita._isOverdue) {
    badgeColor = '#ef4444';
    badgeBg = 'rgba(239, 68, 68, 0.12)';
  }

  // Lista de técnicos disponibles para select
  const listaTecnicosSelect = tecnicos.filter(t => t.activo && t.nombre !== 'NO TECNICO' && t.nombre !== 'TECNOLOGIA');

  return (
    <>
      {/* Backdrop semi-transparente */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 9998
        }}
        onClick={onClose}
      />

      {/* Panel lateral Ficha Operativa */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '460px',
          maxWidth: '94vw',
          background: 'var(--card-bg, #ffffff)',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.22)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-color, #e2e8f0)',
          animation: 'slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <div style={{
          padding: '18px 22px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                background: badgeBg,
                color: badgeColor,
                border: `1px solid ${badgeColor}`,
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                {visita._isOverdue ? '⚠️ CON ATRASO' : estado}
              </span>
              <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 700 }}>
                Ticket #{visita.contrato || visita.id_visita}
              </span>
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.18rem', fontWeight: 800 }}>
              {visita.cliente}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {visita.servicio || 'Servicio Técnico'} • {visita.empresa || 'Futurity'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Barra de Acciones del Asesor */}
        <div style={{
          padding: '10px 16px',
          background: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            onClick={() => setActiveAction(activeAction === 'reagendar' ? null : 'reagendar')}
            style={{
              padding: '6px 11px',
              borderRadius: '8px',
              border: activeAction === 'reagendar' ? '2px solid #d97706' : '1px solid #cbd5e1',
              background: activeAction === 'reagendar' ? '#fef3c7' : '#ffffff',
              color: '#b45309',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
          >
            <i className="fa-solid fa-calendar-day"></i> Reagendar
          </button>

          <button
            type="button"
            onClick={() => setActiveAction(activeAction === 'cancelar' ? null : 'cancelar')}
            style={{
              padding: '6px 11px',
              borderRadius: '8px',
              border: activeAction === 'cancelar' ? '2px solid #dc2626' : '1px solid #cbd5e1',
              background: activeAction === 'cancelar' ? '#fee2e2' : '#ffffff',
              color: '#b91c1c',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
          >
            <i className="fa-solid fa-ban"></i> Cancelar / Cerrar
          </button>
        </div>

        {/* Feedback visual si se ejecuta una acción */}
        {actionFeedback && (
          <div style={{
            margin: '12px 16px 0 16px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: actionFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: actionFeedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${actionFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`
          }}>
            <i className={`fa-solid ${actionFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
            {actionFeedback.message}
          </div>
        )}

        {/* Banner destacado: Si el técnico cerró la visita solicitando Cambio de FO */}
        {isFOSolicitado && (
          <div style={{
            margin: '12px 16px 0 16px',
            padding: '12px 14px',
            background: isFOAgendado ? '#ecfdf5' : '#fff7ed',
            border: `2px solid ${isFOAgendado ? '#10b981' : '#ea580c'}`,
            borderRadius: '12px',
            boxShadow: isFOAgendado ? 'none' : '0 2px 8px rgba(234, 88, 12, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: isFOAgendado ? '#10b981' : '#ea580c',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className={`fa-solid ${isFOAgendado ? 'fa-check-circle' : 'fa-triangle-exclamation'}`}></i>
                  {isFOAgendado ? 'CAMBIO DE FO YA PROGRAMADO' : 'TÉCNICO CERRÓ: REQUIERE CAMBIO DE FO'}
                </span>
              </div>

              {!isFOAgendado && (
                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'cambio_fo' ? null : 'cambio_fo')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeAction === 'cambio_fo' ? '#c2410c' : '#ea580c',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  <i className="fa-solid fa-calendar-plus"></i>
                  {activeAction === 'cambio_fo' ? 'Ocultar Formulario' : 'Programar Cambio de FO'}
                </button>
              )}
            </div>

            {visita.observacion_tecnico && (
              <div style={{
                marginTop: '8px',
                fontSize: '0.78rem',
                color: isFOAgendado ? '#065f46' : '#7c2d12',
                fontStyle: 'italic',
                background: isFOAgendado ? 'rgba(16, 185, 129, 0.08)' : '#ffedd5',
                padding: '6px 10px',
                borderRadius: '6px'
              }}>
                <strong>Detalle Técnico:</strong> "{visita.observacion_tecnico}"
              </div>
            )}
          </div>
        )}

        {/* Sección de Acción Activa Desplegada (Asesor) */}
        {activeAction === 'reagendar' && (
          <div style={{
            margin: '12px 16px 0 16px',
            padding: '14px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b45309' }}>
                <i className="fa-solid fa-calendar-plus" style={{ marginRight: '6px' }}></i>
                Reagendar Visita Técnica
              </span>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                style={{ background: 'transparent', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmReagendar} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350f', display: 'block', marginBottom: '3px' }}>
                    Nueva Fecha:
                  </label>
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={reagendarFecha}
                    onChange={(e) => setReagendarFecha(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350f', display: 'block', marginBottom: '3px' }}>
                    Prioridad:
                  </label>
                  <select
                    value={reagendarPrioridad}
                    onChange={(e) => setReagendarPrioridad(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350f', display: 'block', marginBottom: '3px' }}>
                  Motivo de Reagendamiento:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cliente solicita cambio de fecha por viaje / Sin moradores"
                  value={reagendarMotivo}
                  onChange={(e) => setReagendarMotivo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#d97706',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  Confirmar Reagendamiento
                </button>
              </div>
            </form>
          </div>
        )}

        {activeAction === 'cancelar' && (
          <div style={{
            margin: '12px 16px 0 16px',
            padding: '14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b91c1c' }}>
                <i className="fa-solid fa-circle-xmark" style={{ marginRight: '6px' }}></i>
                Cancelar / Cerrar Visita
              </span>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmCancelar} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                  Tipo de Cierre / Estado:
                </label>
                <select
                  value={cancelarEstado}
                  onChange={(e) => setCancelarEstado(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="CANCELADA">Cliente cancela visita / Desiste</option>
                  <option value="SOLVENTADA_REMOTA">Solventado por Call Center / Remotamente</option>
                  <option value="SOLVENTADA_OTRO_DEP">Solventado por otro departamento (NOC/Redes)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                  Motivo detallado / Resolución final:
                </label>
                <textarea
                  rows="2"
                  placeholder="Detalla la razón por la cual se cierra la orden..."
                  value={cancelarMotivo}
                  onChange={(e) => setCancelarMotivo(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-ban"></i>}
                  Confirmar Cancelación
                </button>
              </div>
            </form>
          </div>
        )}

        {activeAction === 'cambio_fo' && (
          <div style={{
            margin: '12px 16px 0 16px',
            padding: '14px',
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#6d28d9' }}>
                <i className="fa-solid fa-bolt" style={{ marginRight: '6px' }}></i>
                Programar Cambio de FO (Asesor)
              </span>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                style={{ background: 'transparent', border: 'none', color: '#5b21b6', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmCambioFO} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', display: 'block', marginBottom: '3px' }}>
                    Fecha Programada:
                  </label>
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={foFecha}
                    onChange={(e) => setFoFecha(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', display: 'block', marginBottom: '3px' }}>
                    Preferencia Horaria:
                  </label>
                  <select
                    value={foHorario}
                    onChange={(e) => setFoHorario(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="COORDINAR">Coordinar (Transcurso del día)</option>
                    <option value="MAÑANA (08:00 - 13:00)">Mañana (08:00 - 13:00)</option>
                    <option value="TARDE (13:00 - 18:00)">Tarde (13:00 - 18:00)</option>
                    <option value="08:00 - 10:00">08:00 - 10:00</option>
                    <option value="10:00 - 12:00">10:00 - 12:00</option>
                    <option value="14:00 - 16:00">14:00 - 16:00</option>
                    <option value="16:00 - 18:00">16:00 - 18:00</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', display: 'block', marginBottom: '3px' }}>
                  Asignar Cuadrilla / Técnico:
                </label>
                <select
                  value={foTecnico}
                  onChange={(e) => setFoTecnico(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="NO TECNICO">Dejar en Bandeja (Sin Asignar)</option>
                  {listaTecnicosSelect.map(t => (
                    <option key={t.id_tecnico || t.nombre} value={t.nombre}>
                      {t.nombre} {t.area_trabajo === 'INSTALACIONES' ? '⚡ (Instalador)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b21b6', display: 'block', marginBottom: '3px' }}>
                  Observación para la Cuadrilla:
                </label>
                <textarea
                  rows="2"
                  value={foObs}
                  onChange={(e) => setFoObs(e.target.value)}
                  placeholder="Detallar causa: rotura de drop, atenuación, reubicación de acometida..."
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#7c3aed',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                  Crear Visita Cambio FO
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cuerpo del Drawer con scroll suave */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Bloque 1: Cuadrilla & Horario Programado */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
                <i className="fa-solid fa-users-gear" style={{ color: '#6366f1', marginRight: '6px' }}></i>
                Cuadrilla & Turno
              </span>
              {esApoyo && (
                <span className="crono-apoyo-pill">
                  <i className="fa-solid fa-hands-holding-circle"></i> VISTA EN APOYO
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--sidebar-text)' }}>Técnico Titular:</span>
                <strong style={{ color: 'var(--text-main)' }}>{titularNombre || 'SIN ASIGNAR'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--sidebar-text)' }}>Técnico Apoyo:</span>
                <strong style={{ color: visita.tecnico_apoyo ? '#0284c7' : 'var(--sidebar-text)' }}>
                  {visita.tecnico_apoyo || 'Ninguno (Solo)'}
                </strong>
              </div>
              <div style={{ gridColumn: 'span 2', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--sidebar-text)' }}>Horario Estimado:</span>
                <strong style={{ color: '#d97706', fontSize: '0.88rem' }}>
                  ⏰ {visita.preferencia_horaria || 'Flexible en el transcurso del día'}
                </strong>
              </div>
            </div>
          </div>

          {/* Bloque 2: Contacto & Ubicación */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
              <i className="fa-solid fa-map-pin" style={{ color: '#ef4444', marginRight: '6px' }}></i>
              Contacto y Dirección
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
              {/* Teléfono */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--sidebar-text)' }}>Teléfono:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(visita.telefonos)}
                    style={{
                      background: copiedPhone ? '#dcfce7' : '#f1f5f9',
                      color: copiedPhone ? '#16a34a' : 'var(--text-main)',
                      border: '1px solid #cbd5e1',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <i className={`fa-solid ${copiedPhone ? 'fa-check' : 'fa-copy'}`}></i> {visita.telefonos || 'S/N'}
                  </button>

                  {visita.telefonos && (
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(visita)}
                      style={{
                        background: '#22c55e',
                        color: 'white',
                        border: 'none',
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem'
                      }}
                      title="Enviar mensaje por WhatsApp Web"
                    >
                      <i className="fa-brands fa-whatsapp"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Sector */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--sidebar-text)' }}>Sector:</span>
                <strong>{visita.sector || 'No especificado'}</strong>
              </div>

              {/* Dirección */}
              <div>
                <span style={{ color: 'var(--sidebar-text)', display: 'block', marginBottom: '2px' }}>Dirección Completa:</span>
                <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 600, background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  {visita.direccion || 'Sin dirección registrada'}
                </p>
              </div>
            </div>
          </div>

          {/* Bloque 3: Diagnóstico & Detalles Técnicos */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
              <i className="fa-solid fa-network-wired" style={{ color: '#0284c7', marginRight: '6px' }}></i>
              Diagnóstico y Red (NAP / Hilo)
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--sidebar-text)' }}>Problema:</span>
                <strong style={{ color: '#dc2626' }}>{visita.problema || 'Revisión técnica'}</strong>
              </div>

              {visita.observacion_callcenter && (
                <div>
                  <span style={{ color: 'var(--sidebar-text)', display: 'block', marginBottom: '2px', fontSize: '0.75rem' }}>Obs. Call Center:</span>
                  <p style={{ margin: 0, color: '#334155', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem' }}>
                    "{visita.observacion_callcenter}"
                  </p>
                </div>
              )}

              {visita.informacion_tecnico && (
                <div>
                  <span style={{ color: 'var(--sidebar-text)', display: 'block', marginBottom: '2px', fontSize: '0.75rem' }}>Datos Técnicos (Caja / Hilo / IP):</span>
                  <pre style={{
                    margin: 0,
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {visita.informacion_tecnico}
                  </pre>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Pie de acciones rápidas del Drawer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onOpenAssignCuadrilla(visita)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary, #e11d48)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-users"></i> Asignar / Apoyo
            </button>

            {onSendTelegramAlert && (
              <button
                type="button"
                onClick={() => onSendTelegramAlert(visita, visita._overdueMin || 15)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid #0284c7',
                  background: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284c7',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Despachar alerta de esta visita a Telegram"
              >
                <i className="fa-brands fa-telegram"></i> Telegram
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleOpenWhatsApp(visita)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #86efac',
                background: '#f0fdf4',
                color: '#15803d',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-brands fa-whatsapp"></i> Notificar WhatsApp
            </button>

            {onOpenEditModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditModal(visita);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: '#ffffff',
                  color: 'var(--text-main, #0f172a)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-pen-to-square"></i> Editar Todo
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
