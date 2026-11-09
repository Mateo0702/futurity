import React from 'react';
import { calculateOverdueMinutes } from './telegramAlertHelper';

export default function TimelineVisitCard({
  visita,
  leftPct,
  widthPct,
  isToday,
  now,
  onOpenEdit,
  onSendTelegramAlert
}) {
  const estado = (visita.estado || 'PENDIENTE').toUpperCase();
  const overdueMin = isToday && estado === 'PENDIENTE' ? calculateOverdueMinutes(visita, now) : 0;
  const isOverdue = overdueMin > 0;

  // Detección: El técnico cerró solicitando Cambio de FO
  const solUpper = (visita.solucion_tecnico || '').toUpperCase();
  const obsUpper = (visita.observacion_tecnico || '').toUpperCase();
  const resUpper = (visita.resolucion_final || '').toUpperCase();
  const isFOSolicitado = solUpper.includes('GENERAR CAMBIO DE FO') || 
                         solUpper.includes('REQUIERE CAMBIO DE FO') || 
                         obsUpper.includes('GENERAR CAMBIO DE FO');
  const isFOAgendado = resUpper.includes('CAMBIO DE FO AGENDADO');

  let estadoClass = 'estado-pendiente';
  if (isFOSolicitado && !isFOAgendado) estadoClass = 'estado-cambio-fo';
  else if (estado === 'FINALIZADA') estadoClass = 'estado-finalizada';
  else if (estado === 'EN_RUTA') estadoClass = 'estado-en-ruta';
  else if (estado === 'EN_SITIO' || estado === 'EN_PROGRESO') estadoClass = 'estado-en-sitio';
  else if (estado === 'REAGENDADA' || estado === 'CANCELADA') estadoClass = 'estado-reagendada';

  const handleDragStart = (e) => {
    const cardRect = e.currentTarget.getBoundingClientRect();
    const grabOffsetX = Math.max(0, e.clientX - cardRect.left);

    const dragPayload = {
      id_visita: visita.id_visita,
      tecnico_principal: visita.tecnico_principal,
      tecnico_apoyo: visita.tecnico_apoyo || '',
      contrato: visita.contrato,
      cliente: visita.cliente,
      preferencia_horaria: visita.preferencia_horaria,
      durationMin: visita.durationMin || 90,
      grabOffsetX: grabOffsetX
    };

    window.__cronoDragData = dragPayload;
    e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    window.__cronoDragData = null;
  };

  const esApoyo = !!visita._esApoyo;
  const titularNombre = visita._titularNombre || visita.tecnico_principal;

  // Propiedades de sub-carril y detección de solapamiento
  const maxLanes = visita.maxLanes || 1;
  const laneIndex = visita.laneIndex || 0;
  const hasConflict = !!visita.hasConflict;
  const isCompact = maxLanes > 1;

  const topPos = isCompact ? 8 + laneIndex * 46 : 8;
  const cardHeight = isCompact ? 40 : null;

  return (
    <div
      className={`crono-visit-card ${estadoClass} ${isOverdue ? 'is-overdue' : ''} ${esApoyo ? 'es-apoyo' : ''} ${hasConflict ? 'has-conflict' : ''} ${isCompact ? 'is-compact' : ''}`}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: `${topPos}px`,
        ...(isCompact ? { height: `${cardHeight}px` } : { bottom: '8px' }),
        minWidth: isCompact ? '110px' : '130px'
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onOpenEdit(visita)}
      title={`${hasConflict ? '⚠️ HORARIO SOLAPADO CON OTRA VISITA\n' : ''}${esApoyo ? '🤝 EN APOYO' : '👑 TITULAR'}\nTicket #${visita.contrato || visita.id_visita} - ${visita.cliente}\nHora: ${visita.preferencia_horaria || 'Flexible'}\n${esApoyo ? `Apoyando a: ${titularNombre}` : (visita.tecnico_apoyo ? `Con Apoyo: ${visita.tecnico_apoyo}` : 'Técnico Solo')}\nEstado: ${estado}\nArrastra para reasignar horario o técnico`}
    >
      {/* MODO COMPACTO: Cuando el técnico tiene visitas simultáneas/solapadas divididas en sub-carriles */}
      {isCompact ? (
        <div className="crono-compact-inner">
          {/* Línea 1: Contrato, Badges y Hora */}
          <div className="crono-compact-row1">
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden' }}>
              <strong style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                #{visita.contrato || visita.id_visita}
              </strong>
              {isFOSolicitado && !isFOAgendado && (
                <span className="crono-mini-badge" style={{ background: '#ea580c', color: '#fff', fontWeight: 800 }} title="Técnico cerró: Requiere Cambio de FO">
                  ⚡ FO
                </span>
              )}
              {visita.prioridad === 'ALTA' && (
                <span className="crono-mini-badge urgente" title="Prioridad Alta">URG</span>
              )}
              {hasConflict && (
                <span className="crono-mini-badge conflict" title="Solapado con otra visita a la misma hora">
                  <i className="fa-solid fa-bolt"></i> SOLAPADO
                </span>
              )}
              {esApoyo && (
                <span className="crono-mini-badge apoyo" title={`Apoyo a ${titularNombre}`}>🤝</span>
              )}
            </div>

            <span className="crono-compact-time">
              {isOverdue ? (
                <span style={{ color: '#ef4444', fontWeight: 800 }}>+{overdueMin}m</span>
              ) : (
                visita.preferencia_horaria || 'Flexible'
              )}
            </span>
          </div>

          {/* Línea 2: Nombre del cliente y Sector */}
          <div className="crono-compact-row2">
            <span className="crono-compact-client">
              {visita.cliente || 'Cliente'}
            </span>
            <span className="crono-compact-sector">
              📍 {visita.sector || 'S/S'}
            </span>
          </div>
        </div>
      ) : (
        /* MODO ESTÁNDAR COMPLETO: Altura normal cuando no hay solapamientos */
        <>
          {/* Cabecera de la tarjeta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              <strong style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                #{visita.contrato || visita.id_visita}
              </strong>

              {isFOSolicitado && !isFOAgendado && (
                <span style={{
                  background: '#ea580c',
                  color: 'white',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }} title="Técnico cerró solicitando Cambio de FO">
                  ⚡ CAMBIO FO
                </span>
              )}

              {hasConflict && (
                <span className="crono-mini-badge conflict" title="Conflicto horario con otra visita">
                  <i className="fa-solid fa-bolt"></i> SOLAPADO
                </span>
              )}

              {esApoyo ? (
                <span className="crono-apoyo-pill" title={`Técnico de apoyo asignado a la visita de ${titularNombre}`}>
                  <i className="fa-solid fa-hands-holding-circle"></i> APOYO
                </span>
              ) : visita.prioridad === 'ALTA' ? (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 4px',
                  borderRadius: '4px'
                }}>
                  URGENTE
                </span>
              ) : null}
            </div>

            {/* Badge de Atraso o Horario */}
            {isOverdue ? (
              <span className="crono-overdue-pill" title={`Retraso estimado de ${overdueMin} minutos`}>
                <i className="fa-solid fa-triangle-exclamation"></i> +{overdueMin}m
              </span>
            ) : (
              <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {visita.preferencia_horaria || 'Flexible'}
              </span>
            )}
          </div>

          {/* Nombre del Cliente */}
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '2px'
          }}>
            {visita.cliente || 'Cliente'}
          </div>

          {/* Pie de la tarjeta: Sector & Cuadrilla de 2 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '4px',
            marginTop: '4px',
            fontSize: '0.7rem'
          }}>
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: esApoyo ? '90px' : '120px',
              opacity: 0.85
            }}>
              📍 {visita.sector || 'Sin sector'}
            </span>

            {/* Indicador de técnico de apoyo o titular según el rol */}
            {esApoyo ? (
              <span className="crono-dual-tech-pill" title={`Apoyando al titular ${titularNombre}`}>
                <i className="fa-solid fa-user-check"></i> Titular: {titularNombre.split(' ')[0]}
              </span>
            ) : visita.tecnico_apoyo ? (
              <span className="crono-dual-tech-pill" title={`Con Apoyo de ${visita.tecnico_apoyo}`}>
                <i className="fa-solid fa-user-group"></i> +{visita.tecnico_apoyo.split(' ')[0]}
              </span>
            ) : null}

            {/* Botón rápido de alerta Telegram si está atrasada */}
            {isOverdue && onSendTelegramAlert && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendTelegramAlert(visita, overdueMin);
                }}
                title="Enviar alerta inmediata al grupo de Telegram de Operaciones"
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <i className="fa-brands fa-telegram"></i> Alerta
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
