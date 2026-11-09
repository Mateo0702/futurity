/**
 * Helper para cálculo de tiempos, detección de solapamientos (conflictos)
 * y empaquetado inteligente en sub-carriles (multi-lane interval packing).
 */

// Extrae minuto de inicio (0-1440), duración y porcentajes horizontal (leftPct, widthPct)
export function computeVisitTimes(v, startHour = 7, endHour = 21) {
  const totalMinutes = (endHour - startHour) * 60;
  let startMin = null;
  let endMin = null;
  let durationMin = 90; // Duración base por defecto

  let hasExplicitRange = false;

  // 1. Extraer rango horario desde preferencia_horaria (ej: "08:00 - 10:00", "09:15 - 10:45", "11:30 - 14:00", "11h30 - 14h00")
  if (v.preferencia_horaria) {
    const raw = String(v.preferencia_horaria).toLowerCase().trim();
    const rangeMatch = raw.match(/(\d{1,2})(?:[:hH](\d{2}))?\s*(am|pm)?\s*(?:-|a|hasta|\/)\s*(\d{1,2})(?:[:hH](\d{2}))?\s*(am|pm)?/i);

    if (rangeMatch) {
      let h1 = parseInt(rangeMatch[1], 10);
      const m1 = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
      const mod1 = rangeMatch[3] ? rangeMatch[3].toLowerCase() : '';
      let h2 = parseInt(rangeMatch[4], 10);
      const m2 = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
      const mod2 = rangeMatch[6] ? rangeMatch[6].toLowerCase() : '';

      if ((mod1 === 'pm' || raw.includes('tarde')) && h1 < 12 && !raw.startsWith('12')) h1 += 12;
      if ((mod2 === 'pm' || h2 < h1 || (h2 >= 1 && h2 <= 7 && h1 >= 8)) && h2 < 12) h2 += 12;

      startMin = h1 * 60 + m1;
      endMin = h2 * 60 + m2;
      hasExplicitRange = true;
    } else {
      const singleMatch = raw.match(/(\d{1,2})(?:[:hH](\d{2}))?/);
      if (singleMatch) {
        let h = parseInt(singleMatch[1], 10);
        const m = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
        if (raw.includes('pm') && h < 12) h += 12;
        else if (raw.includes('tarde') && h < 12) h += 12;
        startMin = h * 60 + m;
      } else if (raw.includes('mañana') || raw.includes('manana')) {
        startMin = 9 * 60;
        endMin = 12 * 60;
        hasExplicitRange = true;
      } else if (raw.includes('tarde')) {
        startMin = 14 * 60;
        endMin = 18 * 60;
        hasExplicitRange = true;
      }
    }
  }

  // 2. Si la visita NO tiene un rango de texto explícito pero tiene ventana en BD (o fue arrastrada)
  if (!hasExplicitRange && v.ventana_inicio_min && v.ventana_inicio_min > 0) {
    startMin = v.ventana_inicio_min;
    if (v.ventana_fin_min && v.ventana_fin_min > v.ventana_inicio_min) {
      endMin = v.ventana_fin_min;
    }
  }

  if (startMin === null) {
    startMin = 8 * 60 + 30; // 08:30 por defecto
  }

  // 3. Caso especial: Técnico de apoyo como refuerzo
  if (v._esApoyo && v._inicioApoyoMin && v._inicioApoyoMin > startMin) {
    startMin = v._inicioApoyoMin;
  }

  if (endMin !== null && endMin > startMin) {
    durationMin = endMin - startMin;
  }

  // Limitar duración para que no sobrepase el final operativo del timeline (19:00 = endHour * 60)
  const maxDur = Math.max(30, endHour * 60 - startMin);
  durationMin = Math.max(30, Math.min(durationMin, maxDur));
  const calculatedEndMin = startMin + durationMin;

  const startOffset = Math.max(0, startMin - startHour * 60);
  const leftPct = Math.max(0, Math.min((startOffset / totalMinutes) * 100, 96));
  const widthPct = Math.max(4, Math.min((durationMin / totalMinutes) * 100, 100 - leftPct));

  return {
    startMin,
    endMin: calculatedEndMin,
    durationMin,
    leftPct,
    widthPct
  };
}

/**
 * Organiza las visitas de un técnico en sub-carriles para que NUNCA se monten una sobre otra.
 * Detecta si hay solapamientos reales y asigna índices de carril (laneIndex: 0, 1, 2...).
 */
export function computeTechLanes(visitas = [], startHour = 7, endHour = 21) {
  if (!visitas || visitas.length === 0) {
    return {
      visitasConLayout: [],
      maxLanes: 1,
      rowHeight: 94,
      conflictCount: 0
    };
  }

  // 1. Calcular tiempos iniciales para cada visita
  const list = visitas.map(v => {
    const times = computeVisitTimes(v, startHour, endHour);
    return {
      ...v,
      ...times,
      hasConflict: false,
      laneIndex: 0
    };
  });

  // 2. Detectar solapamientos (conflictos) entre visitas del mismo técnico
  let conflictCount = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const vA = list[i];
      const vB = list[j];
      // Se solapan si el inicio de A es menor al fin de B y el inicio de B es menor al fin de A
      // (con 2 min de tolerancia para visitas consecutivas como 10:00 y 10:00)
      if (vA.startMin < vB.endMin - 2 && vB.startMin < vA.endMin - 2) {
        vA.hasConflict = true;
        vB.hasConflict = true;
        conflictCount++;
      }
    }
  }

  // 3. Ordenar cronológicamente por hora de inicio
  list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // 4. Algoritmo de empaquetado en sub-carriles (Greedy Interval Coloring)
  // lanesEndMin guarda el minuto en que se desocupa cada sub-carril
  const lanesEndMin = [];

  list.forEach(v => {
    let placed = false;
    for (let l = 0; l < lanesEndMin.length; l++) {
      // Si el carril se desocupa antes o justo cuando empieza la visita, lo reutilizamos
      if (lanesEndMin[l] <= v.startMin) {
        v.laneIndex = l;
        lanesEndMin[l] = v.endMin;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Necesita un nuevo sub-carril paralelo
      v.laneIndex = lanesEndMin.length;
      lanesEndMin.push(v.endMin);
    }
  });

  const maxLanes = Math.max(1, lanesEndMin.length);
  // Si maxLanes === 1: altura estándar de 94px
  // Si maxLanes > 1: 16px padding + maxLanes * 46px
  const rowHeight = maxLanes > 1 ? Math.max(94, 16 + maxLanes * 46) : 94;

  const visitasConLayout = list.map(v => ({
    ...v,
    maxLanes
  }));

  return {
    visitasConLayout,
    maxLanes,
    rowHeight,
    conflictCount
  };
}
