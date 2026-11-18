import React, { useState, useRef } from 'react';
import { calculateOverdueMinutes } from './telegramAlertHelper';
import { formatMinutesToTime } from './timelineLayoutHelper';

export default function TimelineVisitCard({
  visita,
  leftPct,
  widthPct,
  isToday,
  now,
  startHour = 7,
  endHour = 21,
  onResizeVisit,
  onOpenEdit
}) {
  const [resizingEndMin, setResizingEndMin] = useState(null);
  const justResizedRef = useRef(false);

  const estado = (visita.estado || 'PENDIENTE').toUpperCase();
  const currentMin = now ? now.getHours() * 60 + now.getMinutes() : 0;

  let overdueMin = 0;
  if (isToday) {
    if (estado === 'PENDIENTE' || estado === 'ASIGNADA') {
      const diffIni = calculateOverdueMinutes(visita, now);
      if (diffIni >= 5) overdueMin = diffIni;
    } else if (estado === 'EN_RUTA' || estado === 'EN_SITIO' || estado === 'EN_PROGRESO') {
      if (visita.endMin && currentMin >= visita.endMin + 5) {
        overdueMin = currentMin - visita.endMin;
      }
    }
  }
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
  const canResize = !!onResizeVisit && !esApoyo && estado !== 'FINALIZADA' && estado !== 'CANCELADA';
  const totalMinutes = (endHour - startHour) * 60;

  const effectiveWidthPct = resizingEndMin !== null
    ? Math.max(3.5, Math.min(((resizingEndMin - visita.startMin) / totalMinutes) * 100, 100 - leftPct))
    : widthPct;

  const displayTimeLabel = resizingEndMin !== null
    ? `${formatMinutesToTime(visita.startMin)} - ${formatMinutesToTime(resizingEndMin)}`
    : (visita.displayTimeStr || visita.preferencia_horaria || 'Flexible');

  const handleResizeMouseDown = (e) => {
    if (!canResize) return;
    e.stopPropagation();
    e.preventDefault();

    const rowEl = e.currentTarget.closest('.crono-grid-row');
    if (!rowEl) return;
    const rowRect = rowEl.getBoundingClientRect();
    let latestSnappedEnd = visita.endMin;

    const onMouseMove = (moveEvent) => {
      const relX = Math.max(0, Math.min(moveEvent.clientX - rowRect.left, rowRect.width));
      const pct = relX / rowRect.width;
      const rawEndMin = startHour * 60 + pct * totalMinutes;
      const snapped = Math.max(
        visita.startMin + 30,
        Math.min(Math.round(rawEndMin / 15) * 15, endHour * 60)
      );
      latestSnappedEnd = snapped;
      setResizingEndMin(snapped);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setResizingEndMin(null);
      justResizedRef.current = true;
      setTimeout(() => { justResizedRef.current = false; }, 120);

      if (latestSnappedEnd && latestSnappedEnd !== visita.endMin) {
        onResizeVisit(visita, latestSnappedEnd);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Propiedades de sub-carril y detección de solapamiento
  const maxLanes = visita.maxLanes || 1;
  const laneIndex = visita.laneIndex || 0;
  const hasConflict = !!visita.hasConflict;
  const isCompact = maxLanes > 1;

  const topPos = isCompact ? 8 + laneIndex * 46 : 8;
  const cardHeight = isCompact ? 40 : null;

  return (
    <div
      className={`crono-visit-card ${estadoClass} ${isOverdue ? 'is-overdue' : ''} ${esApoyo ? 'es-apoyo' : ''} ${hasConflict ? 'has-conflict' : ''} ${isCompact ? 'is-compact' : ''} ${resizingEndMin !== null ? 'is-resizing' : ''}`}
      style={{
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(max(${effectiveWidthPct}%, 4.5%) - 6px)`,
        top: `${topPos}px`,
        ...(isCompact ? { height: `${cardHeight}px` } : { bottom: '8px' }),
        minWidth: isCompact ? '75px' : '88px',
        zIndex: resizingEndMin !== null ? 30 : undefined
      }}
      draggable={resizingEndMin === null}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (justResizedRef.current) return;
        onOpenEdit(visita);
      }}
      title={`${hasConflict ? '⚠️ HORARIO SOLAPADO CON OTRA VISITA\n' : ''}${esApoyo ? '🤝 EN APOYO' : '👑 TITULAR'}\nTicket #${visita.contrato || visita.id_visita} - ${visita.cliente}\nHora: ${displayTimeLabel}${visita.adjustedByFinish ? ` (Programada: ${visita.preferencia_horaria || ''})` : ''}\n${esApoyo ? `Apoyando a: ${titularNombre}` : (visita.tecnico_apoyo ? `Con Apoyo: ${visita.tecnico_apoyo}` : 'Técnico Solo')}\nEstado: ${estado}\nArrastra para mover${canResize ? ' • Arrastra el borde derecho para extender/acortar' : ''}`}
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
              {resizingEndMin !== null ? (
                <span style={{ color: '#4f46e5', fontWeight: 800 }}>{displayTimeLabel}</span>
              ) : isOverdue ? (
                <span style={{ color: '#ef4444', fontWeight: 800 }}>+{overdueMin}m</span>
              ) : (
                displayTimeLabel
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
            {resizingEndMin !== null ? (
              <span style={{ background: '#4f46e5', color: '#fff', fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '5px', whiteSpace: 'nowrap' }}>
                ↔ {displayTimeLabel}
              </span>
            ) : isOverdue ? (
              <span className="crono-overdue-pill" title={`Retraso estimado de ${overdueMin} minutos`}>
                <i className="fa-solid fa-triangle-exclamation"></i> +{overdueMin}m
              </span>
            ) : (
              <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {displayTimeLabel}
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
              maxWidth: '100%',
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
          </div>
        </>
      )}

      {/* Tirador derecho para extender / acortar duración directamente en el Gantt */}
      {canResize && (
        <div
          className="crono-resize-handle"
          onMouseDown={handleResizeMouseDown}
          onClick={(e) => e.stopPropagation()}
          title="Arrastra hacia la derecha o izquierda para extender/acortar la duración de esta visita"
        />
      )}
    </div>
  );
}
