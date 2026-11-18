import React, { useState } from 'react';
import LiveTimeIndicator from './LiveTimeIndicator';
import TimelineVisitCard from './TimelineVisitCard';
import { computeVisitTimes } from './timelineLayoutHelper';

export default function TimelineGrid({
  tecnicos = [],
  visitasPorTecnico = {},
  techLayoutMap = {},
  isToday,
  now,
  startHour = 7,
  endHour = 21,
  dragOverTecnico,
  setDragOverTecnico,
  onDropVisit,
  onSaveLunch,
  onResizeVisit,
  onOpenEdit
}) {
  const [dragPreview, setDragPreview] = useState(null);
  const currentMin = now ? now.getHours() * 60 + now.getMinutes() : 0;

  // Bloques horarios de 60m: de startHour a endHour (ej. 07:00 a 20:00 con submárgenes :30)
  const hours = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  const totalMinutes = (endHour - startHour) * 60;

  // Manejo de DragOver sobre la fila de un técnico con cálculo de previsualización en vivo
  const handleDragOver = (e, techNombre) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragData = window.__cronoDragData || {};
    const targetTech = dragData.type === 'LUNCH' ? (dragData.techNombre || techNombre) : techNombre;

    if (dragOverTecnico !== targetTech) {
      setDragOverTecnico(targetTech);
    }

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;

    const grabOffset = dragData.grabOffsetX || 0;
    const cardDuration = dragData.durationMin || (dragData.type === 'LUNCH' ? 60 : 90);

    const effectiveX = Math.max(0, e.clientX - rect.left - grabOffset);
    const pct = Math.max(0, Math.min(effectiveX / rect.width, 1));
    const rawMin = startHour * 60 + pct * totalMinutes;

    // Redondeo exacto a intervalos de 15 minutos
    const snappedStartMin = Math.max(startHour * 60, Math.min(Math.round(rawMin / 15) * 15, endHour * 60 - 30));
    const snappedEndMin = Math.min(endHour * 60, snappedStartMin + cardDuration);

    const h1 = Math.floor(snappedStartMin / 60);
    const m1 = snappedStartMin % 60;
    const h2 = Math.floor(snappedEndMin / 60);
    const m2 = snappedEndMin % 60;
    const horaStr = `${dragData.type === 'LUNCH' ? '🍽️ ' : ''}${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')} - ${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;

    const previewLeftPct = ((snappedStartMin - startHour * 60) / totalMinutes) * 100;
    const previewWidthPct = ((snappedEndMin - snappedStartMin) / totalMinutes) * 100;

    setDragPreview({
      techNombre: targetTech,
      snappedStartMin,
      snappedEndMin,
      leftPct: previewLeftPct,
      widthPct: previewWidthPct,
      horaStr
    });
  };

  const handleDragLeave = (e, techNombre) => {
    e.preventDefault();
    // Evitar parpadeos cuando el ratón pasa por encima de tarjetas hijas dentro de la fila
    if (e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    if (dragOverTecnico === techNombre) {
      setDragOverTecnico(null);
      setDragPreview(null);
    }
  };

  const handleDrop = (e, techNombre) => {
    e.preventDefault();
    setDragOverTecnico(null);
    setDragPreview(null);

    const dataRaw = e.dataTransfer.getData('text/plain');
    window.__cronoDragData = null;
    if (!dataRaw) return;

    try {
      const data = JSON.parse(dataRaw);
      const rect = e.currentTarget.getBoundingClientRect();
      const grabOffset = data.grabOffsetX || 0;
      const effectiveX = Math.max(0, e.clientX - rect.left - grabOffset);
      const pct = Math.max(0, Math.min(effectiveX / rect.width, 1));

      const rawMinutes = startHour * 60 + pct * totalMinutes;
      const durationMin = data.durationMin || (data.type === 'LUNCH' ? 60 : 90);
      const snappedStartMin = Math.max(startHour * 60, Math.min(Math.round(rawMinutes / 15) * 15, endHour * 60 - 30));
      const snappedEndMin = Math.min(endHour * 60, snappedStartMin + durationMin);

      // Si es un bloque de Almuerzo movible
      if (data.type === 'LUNCH') {
        const targetTech = data.techNombre || techNombre;
        if (onSaveLunch) {
          onSaveLunch(targetTech, snappedStartMin, snappedEndMin, false);
        }
        return;
      }

      const h1 = Math.floor(snappedStartMin / 60);
      const m1 = snappedStartMin % 60;
      const h2 = Math.floor(snappedEndMin / 60);
      const m2 = snappedEndMin % 60;

      const horaInicioStr = `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`;
      const horaFinStr = `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
      const nuevaPrefHoraria = `${horaInicioStr} - ${horaFinStr}`;

      onDropVisit({
        id_visita: data.id_visita,
        nuevo_tecnico: techNombre,
        tecnico_apoyo: data.tecnico_apoyo || '',
        nueva_preferencia_horaria: nuevaPrefHoraria,
        ventana_inicio_min: snappedStartMin,
        ventana_fin_min: snappedEndMin
      });
    } catch (err) {
      console.error("Error al procesar drop en cronograma:", err);
    }
  };

  return (
    <div className="crono-grid-canvas" style={{ '--crono-hours': hours.length }}>
      {/* Cabecera de Horas (07:00 a 20:00 exactas) */}
      <div className="crono-timeline-header">
        {hours.map(h => (
          <div key={h} className="crono-hour-cell">
            <span className="crono-hour-label">{String(h).padStart(2, '0')}:00</span>
            <span className="sub-tick">{String(h).padStart(2, '0')}:30</span>
          </div>
        ))}
      </div>

      {/* Barrita en vivo vertical */}
      <LiveTimeIndicator
        isToday={isToday}
        now={now}
        startHour={startHour}
        endHour={endHour}
      />

      {/* Filas de la grilla por técnico */}
      {tecnicos.map(t => {
        const layout = (techLayoutMap && techLayoutMap[t.nombre]) || {
          visitasConLayout: (visitasPorTecnico[t.nombre] || []).map(v => ({ ...v, ...computeVisitTimes(v, startHour, endHour), laneIndex: 0, maxLanes: 1 })),
          maxLanes: 1,
          rowHeight: 94,
          lunchSlot: null,
          travelSegments: []
        };
        const visitas = layout.visitasConLayout;
        const rowHeight = layout.rowHeight || 94;
        const lunchSlot = layout.lunchSlot;
        const travelSegments = layout.travelSegments || [];

        // Estado dinámico del almuerzo en vivo
        const isCurrentlyInLunch = isToday && lunchSlot && currentMin >= lunchSlot.startMin && currentMin <= lunchSlot.endMin;
        const isEndingSoon = isToday && lunchSlot && currentMin >= lunchSlot.endMin - 5 && currentMin <= lunchSlot.endMin;

        return (
          <div
            key={t.id_tecnico || t.nombre}
            className={`crono-grid-row ${dragOverTecnico === t.nombre ? 'drag-over' : ''}`}
            style={{
              height: `${rowHeight}px`,
              minHeight: '94px'
            }}
            onDragOver={(e) => handleDragOver(e, t.nombre)}
            onDragLeave={(e) => handleDragLeave(e, t.nombre)}
            onDrop={(e) => handleDrop(e, t.nombre)}
          >
            {/* Guía visual interactiva de destino de soltado (Drop Guide) */}
            {dragPreview && dragPreview.techNombre === t.nombre && (
              <div
                className="crono-drop-preview-box"
                style={{
                  left: `${dragPreview.leftPct}%`,
                  width: `${dragPreview.widthPct}%`
                }}
              >
                <span className="crono-drop-preview-badge">
                  <i className="fa-regular fa-clock"></i> {dragPreview.horaStr}
                </span>
              </div>
            )}

            {/* Conectores de Movilización / Traslado entre visitas */}
            {travelSegments.map(seg => (
              <div
                key={seg.id}
                className="crono-travel-pill"
                style={{
                  left: `calc(${seg.leftPct}% + 2px)`,
                  width: `calc(${seg.widthPct}% - 4px)`
                }}
                title={`🚗 Traslado Estimado: ${seg.durationMin} min\nDe: ${seg.fromSector}\nA: ${seg.toSector}${seg.sameSector ? ' (Mismo sector)' : ''}`}
              >
                <span className="crono-travel-content">
                  🚗 {seg.durationMin}m{seg.widthPct > 6 ? (seg.sameSector ? ' local' : ' ruta') : ''}
                </span>
              </div>
            ))}

            {/* Bloque Movible de Almuerzo (arrastrable como cualquier visita) */}
            {lunchSlot && (
              <div
                className={`crono-lunch-block ${isEndingSoon ? 'is-ending-soon' : ''} ${isCurrentlyInLunch ? 'is-in-lunch' : ''}`}
                style={{
                  left: `calc(${lunchSlot.leftPct}% + 3px)`,
                  width: `calc(${lunchSlot.widthPct}% - 6px)`,
                  top: '8px',
                  bottom: '8px',
                  cursor: 'grab'
                }}
                draggable
                onDragStart={(e) => {
                  const cardRect = e.currentTarget.getBoundingClientRect();
                  const grabOffsetX = Math.max(0, e.clientX - cardRect.left);
                  const payload = {
                    type: 'LUNCH',
                    techNombre: t.nombre,
                    durationMin: lunchSlot.durationMin || 60,
                    grabOffsetX
                  };
                  window.__cronoDragData = payload;
                  e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  window.__cronoDragData = null;
                }}
                title={`🍽️ Bloque Movible de Almuerzo (${lunchSlot.horaStr})\nArrastra horizontalmente para cambiar el horario del técnico.\n${isEndingSoon ? '⚠️ FINALIZA EN MENOS DE 5 MINUTOS' : isCurrentlyInLunch ? 'En descanso de almuerzo' : 'Programado'}${lunchSlot.nextVisit ? `\nSiguiente visita: #${lunchSlot.nextVisit.contrato || lunchSlot.nextVisit.id_visita}` : ''}`}
              >
                <div className="crono-lunch-inner">
                  <div className="crono-lunch-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.9rem' }}>🍽️</span>
                      <strong className="crono-lunch-title">ALMUERZO</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isEndingSoon && (
                        <span className="crono-lunch-alert-pill">
                          <i className="fa-solid fa-bell fa-shake"></i> 5m
                        </span>
                      )}
                      {onSaveLunch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSaveLunch(t.nombre, lunchSlot.startMin, lunchSlot.endMin, true);
                          }}
                          title="Quitar bloque de almuerzo (ej. técnico entró almorzado)"
                          style={{
                            background: 'rgba(148, 163, 184, 0.22)',
                            border: 'none',
                            borderRadius: '4px',
                            width: '18px',
                            height: '18px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#475569',
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="crono-lunch-footer">
                    <span className="crono-lunch-hours">{lunchSlot.horaStr}</span>
                    <span className="crono-lunch-duration">{lunchSlot.durationMin}m</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tarjetas de Visitas Técnicas */}
            {visitas.map(v => {
              return (
                <TimelineVisitCard
                  key={`${v.id_visita}-${v._esApoyo ? 'apoyo' : 'titular'}`}
                  visita={v}
                  leftPct={v.leftPct}
                  widthPct={v.widthPct}
                  isToday={isToday}
                  now={now}
                  startHour={startHour}
                  endHour={endHour}
                  onResizeVisit={onResizeVisit}
                  onOpenEdit={onOpenEdit}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
