import React from 'react';

export default function LiveTimeIndicator({
  isToday,
  now,
  startHour = 7,
  endHour = 21
}) {
  if (!isToday) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const totalMinutes = endMinutes - startMinutes;

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return null;
  }

  const leftPct = ((currentMinutes - startMinutes) / totalMinutes) * 100;
  
  const timeStr = now.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <div
      className="crono-live-line"
      style={{ left: `${leftPct}%` }}
    >
      <div className="crono-live-badge">
        <span className="crono-live-dot"></span>
        <span>{timeStr} EN VIVO</span>
      </div>
    </div>
  );
}
