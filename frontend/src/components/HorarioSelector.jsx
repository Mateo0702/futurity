import React, { useState, useEffect } from 'react';

// Generar lista de horas desde 07:30 hasta 19:30 en intervalos de 15 o 30 min
const HORAS_OPCIONES = [];
for (let h = 7; h <= 19; h++) {
  const hStr = String(h).padStart(2, '0');
  HORAS_OPCIONES.push(`${hStr}:00`);
  HORAS_OPCIONES.push(`${hStr}:30`);
}

const DURACIONES = [
  { label: '30 min', min: 30 },
  { label: '45 min', min: 45 },
  { label: '1 hora', min: 60 },
  { label: '1h 30m', min: 90 },
  { label: '2 horas', min: 120 },
  { label: '2h 30m', min: 150 },
  { label: '3 horas', min: 180 },
];

/**
 * Sugerencia automática de tiempo de solución según el problema o servicio
 */
export function obtenerDuracionSugerida(servicio = '', problema = '', activeArea = '') {
  const texto = `${servicio} ${problema} ${activeArea}`.toUpperCase();

  if (texto.includes('INSTALACI') || texto.includes('DOMICILIO') || texto.includes('CROSSELLING')) {
    return 120; // 2 horas para instalaciones nuevas o cambios de domicilio
  }
  if (texto.includes('CAMBIO DE FO') || texto.includes('CAMBIO DE FIBRA') || texto.includes('TENDIDO')) {
    return 90; // 1 hora 30 min para cambio de acometida / fibra
  }
  if (texto.includes('ATENUACI') || texto.includes('EMPALME') || texto.includes('CORTE') || texto.includes('FIBRA')) {
    return 60; // 1 hora para revisión y reparación de fibra
  }
  if (texto.includes('ROUTER') || texto.includes('ONT') || texto.includes('CONFIGURACI') || texto.includes('WIFI') || texto.includes('MESH')) {
    return 45; // 45 min para equipos / wifi / configuración
  }
  return 60; // 1 hora estándar para visitas generales
}

export default function HorarioSelector({
  value = '',
  onChange,
  servicio = '',
  problema = '',
  activeArea = ''
}) {
  const [modo, setModo] = useState('ESPECIFICO'); // 'ESPECIFICO' | 'COORDINAR' | 'MANUAL'
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [duracionMin, setDuracionMin] = useState(60);
  const [manualText, setManualText] = useState('');

  // Sugerir duración al cambiar servicio o problema si aún no se ha modificado manualmente
  useEffect(() => {
    const sugerida = obtenerDuracionSugerida(servicio, problema, activeArea);
    if (sugerida && modo === 'ESPECIFICO') {
      setDuracionMin(sugerida);
    }
  }, [servicio, problema, activeArea]);

  // Parsear valor inicial si ya viene con un rango o texto
  useEffect(() => {
    if (!value) {
      setModo('ESPECIFICO');
      return;
    }

    const valLower = value.toLowerCase().trim();
    if (valLower.includes('coordinar') || valLower.includes('flexible') || valLower === 'sin horario') {
      setModo('COORDINAR');
      return;
    }

    // Probar si tiene rango tipo "11:30 - 14:00" o "11:30 a 14:00"
    const match = value.match(/(\d{1,2}):(\d{2})\s*(?:-|a)\s*(\d{1,2}):(\d{2})/);
    if (match) {
      const h1 = match[1].padStart(2, '0');
      const m1 = match[2];
      const h2 = parseInt(match[3], 10);
      const m2 = parseInt(match[4], 10);

      const iniMin = parseInt(h1, 10) * 60 + parseInt(m1, 10);
      const finMin = h2 * 60 + m2;
      const diff = finMin - iniMin;

      setHoraInicio(`${h1}:${m1}`);
      if (diff > 0) setDuracionMin(diff);
      setModo('ESPECIFICO');
    } else {
      setManualText(value);
      // Si no es rango estándar ni coordinar, mantener en manual
    }
  }, [value]);

  // Calcular Hora Fin en base a Hora Inicio + Duración
  const calcularHoraFin = (inicioStr, durMin) => {
    const [h, m] = inicioStr.split(':').map(Number);
    const totalMin = h * 60 + m + durMin;
    const finH = Math.floor(totalMin / 60);
    const finM = totalMin % 60;
    return `${String(finH).padStart(2, '0')}:${String(finM).padStart(2, '0')}`;
  };

  const horaFinCalculada = calcularHoraFin(horaInicio, duracionMin);

  // Actualizar el valor hacia el componente padre
  const notificarCambio = (nuevoModo, nuevaHoraIni, nuevaDurMin, textoLibre) => {
    if (nuevoModo === 'COORDINAR') {
      onChange('COORDINAR');
    } else if (nuevoModo === 'ESPECIFICO') {
      const fin = calcularHoraFin(nuevaHoraIni, nuevaDurMin);
      onChange(`${nuevaHoraIni} - ${fin}`);
    } else if (nuevoModo === 'MANUAL') {
      onChange(textoLibre);
    }
  };

  const handleSeleccionarModo = (nuevoModo) => {
    setModo(nuevoModo);
    notificarCambio(nuevoModo, horaInicio, duracionMin, manualText);
  };

  const handleCambioHoraInicio = (nuevaHora) => {
    setHoraInicio(nuevaHora);
    notificarCambio('ESPECIFICO', nuevaHora, duracionMin, manualText);
  };

  const handleCambioDuracion = (nuevaDur) => {
    setDuracionMin(nuevaDur);
    notificarCambio('ESPECIFICO', horaInicio, nuevaDur, manualText);
  };

  const handleCambioHoraFinDirecto = (nuevaHoraFin) => {
    const [h1, m1] = horaInicio.split(':').map(Number);
    const [h2, m2] = nuevaHoraFin.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff > 0) {
      setDuracionMin(diff);
      notificarCambio('ESPECIFICO', horaInicio, diff, manualText);
    }
  };

  return (
    <div style={{
      background: 'var(--profile-bg, #f8fafc)',
      border: '1px solid var(--border-color, #e2e8f0)',
      borderRadius: '12px',
      padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    }}>
      {/* Botones de Modo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleSeleccionarModo('ESPECIFICO')}
          style={{
            flex: '1 1 auto',
            padding: '8px 14px',
            borderRadius: '9px',
            border: modo === 'ESPECIFICO' ? '2px solid var(--primary, #e11d48)' : '1px solid var(--border-color, #cbd5e1)',
            background: modo === 'ESPECIFICO' ? '#fff1f2' : '#ffffff',
            color: modo === 'ESPECIFICO' ? 'var(--primary, #e11d48)' : 'var(--text-main, #334155)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-clock"></i> Asignar Horario Específico (Cita)
        </button>

        <button
          type="button"
          onClick={() => handleSeleccionarModo('COORDINAR')}
          style={{
            flex: '1 1 auto',
            padding: '8px 14px',
            borderRadius: '9px',
            border: modo === 'COORDINAR' ? '2px solid #0284c7' : '1px solid var(--border-color, #cbd5e1)',
            background: modo === 'COORDINAR' ? '#f0f9ff' : '#ffffff',
            color: modo === 'COORDINAR' ? '#0369a1' : 'var(--text-main, #334155)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-phone"></i> Dejar Por Coordinar (Flexible)
        </button>
      </div>

      {/* MODO 1: HORARIO ESPECÍFICO */}
      {modo === 'ESPECIFICO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {/* Hora de Inicio */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>
                Hora de Inicio:
              </label>
              <select
                value={horaInicio}
                onChange={(e) => handleCambioHoraInicio(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
              >
                {HORAS_OPCIONES.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Duración Sugerida */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', margin: 0 }}>
                  Duración Estimada:
                </label>
                <span style={{ fontSize: '0.68rem', color: '#6366f1', fontWeight: 700 }}>
                  (Sugerida)
                </span>
              </div>
              <select
                value={duracionMin}
                onChange={(e) => handleCambioDuracion(Number(e.target.value))}
                className="form-control"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}
              >
                {DURACIONES.map(d => (
                  <option key={d.min} value={d.min}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Hora de Fin (Calculada automáticamente o ajustable) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>
                Hora Fin (Aproximada):
              </label>
              <select
                value={horaFinCalculada}
                onChange={(e) => handleCambioHoraFinDirecto(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem', color: '#0369a1' }}
              >
                {HORAS_OPCIONES.filter(h => h > horaInicio).map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Previsualización en vivo del Bloque */}
          <div style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}>
            <span style={{ color: 'var(--sidebar-text)' }}>Bloque en el Cronograma:</span>
            <strong style={{ color: 'var(--primary, #e11d48)', fontSize: '0.9rem' }}>
              ⏰ {horaInicio} - {horaFinCalculada} ({Math.floor(duracionMin / 60) > 0 ? `${Math.floor(duracionMin / 60)}h ` : ''}{duracionMin % 60 > 0 ? `${duracionMin % 60}m` : ''})
            </strong>
          </div>
        </div>
      )}

      {/* MODO 2: POR COORDINAR */}
      {modo === 'COORDINAR' && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#0369a1',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fa-solid fa-circle-info" style={{ fontSize: '1.1rem' }}></i>
          <div>
            <strong>Visita sin hora fija (Por Coordinar):</strong>
            <div style={{ fontSize: '0.76rem', color: '#0c4a6e', marginTop: '2px' }}>
              Quedará disponible en la <strong>Bandeja de Pendientes</strong> del cronograma. Podrán arrastrarla al carril del técnico cuando se acuerde la hora con el cliente.
            </div>
          </div>
        </div>
      )}

      {/* Toggle para texto libre opcional */}
      <div style={{ marginTop: '8px', textAlign: 'right' }}>
        <button
          type="button"
          onClick={() => {
            const nuevoModo = modo === 'MANUAL' ? 'ESPECIFICO' : 'MANUAL';
            setModo(nuevoModo);
            if (nuevoModo === 'MANUAL') {
              notificarCambio('MANUAL', horaInicio, duracionMin, manualText || value);
            } else {
              notificarCambio('ESPECIFICO', horaInicio, duracionMin, manualText);
            }
          }}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.72rem', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {modo === 'MANUAL' ? 'Volver a selector de horario' : 'Escribir texto libremente'}
        </button>
      </div>

      {modo === 'MANUAL' && (
        <div style={{ marginTop: '8px' }}>
          <input
            type="text"
            value={manualText}
            onChange={(e) => {
              setManualText(e.target.value);
              notificarCambio('MANUAL', horaInicio, duracionMin, e.target.value);
            }}
            placeholder="Ej: de 11:30 a 14:00 o coordinar..."
            className="form-control"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
          />
        </div>
      )}
    </div>
  );
}
