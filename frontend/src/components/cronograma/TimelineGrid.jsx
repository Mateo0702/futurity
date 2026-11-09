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
  onOpenEdit,
  onSendTelegramAlert
}) {
  const [dragPreview, setDragPreview] = useState(null);

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
    if (dragOverTecnico !== techNombre) {
      setDragOverTecnico(techNombre);
    }

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;

    let grabOffset = 0;
    let cardDuration = 90;
    if (window.__cronoDragData) {
      grabOffset = window.__cronoDragData.grabOffsetX || 0;
      cardDuration = window.__cronoDragData.durationMin || 90;
    }

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
    const horaStr = `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')} - ${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;

    const previewLeftPct = ((snappedStartMin - startHour * 60) / totalMinutes) * 100;
    const previewWidthPct = ((snappedEndMin - snappedStartMin) / totalMinutes) * 100;

    setDragPreview({
      techNombre,
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
      const durationMin = data.durationMin || 90;
      const snappedStartMin = Math.max(startHour * 60, Math.min(Math.round(rawMinutes / 15) * 15, endHour * 60 - 30));
      const snappedEndMin = Math.min(endHour * 60, snappedStartMin + durationMin);

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
          rowHeight: 94
        };
        const visitas = layout.visitasConLayout;
        const rowHeight = layout.rowHeight || 94;

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

            {visitas.map(v => {
              return (
                <TimelineVisitCard
                  key={`${v.id_visita}-${v._esApoyo ? 'apoyo' : 'titular'}`}
                  visita={v}
                  leftPct={v.leftPct}
                  widthPct={v.widthPct}
                  isToday={isToday}
                  now={now}
                  onOpenEdit={onOpenEdit}
                  onSendTelegramAlert={onSendTelegramAlert}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
