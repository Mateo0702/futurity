/**
 * Utilidad para formatear y despachar alertas de visitas técnicas hacia Telegram Operaciones.
 */

export function calculateOverdueMinutes(visita, now = new Date()) {
  const currentMin = now.getHours() * 60 + now.getMinutes();
  
  let startMin = null;
  if (visita.ventana_inicio_min && visita.ventana_inicio_min > 0) {
    startMin = visita.ventana_inicio_min;
  } else if (visita.preferencia_horaria) {
    const raw = String(visita.preferencia_horaria).toLowerCase();
    const match = raw.match(/(\d{1,2}):?(\d{2})?/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      if (raw.includes('pm') && h < 12) h += 12;
      else if (raw.includes('tarde') && h < 12) h += 12;
      startMin = h * 60 + m;
    } else if (raw.includes('mañana') || raw.includes('manana')) {
      startMin = 9 * 60; // 09:00 AM
    } else if (raw.includes('tarde')) {
      startMin = 14 * 60; // 02:00 PM
    }
  }

  if (startMin === null) return 0;
  return currentMin - startMin;
}

export function formatTelegramOverdueMessage(visita, overdueMinutes) {
  const contract = visita.contrato || 'S/C';
  const client = visita.cliente || 'Cliente no especificado';
  const sector = visita.sector || 'No indicado';
  const tech = visita.tecnico_principal || 'SIN ASIGNAR';
  const apoyo = visita.tecnico_apoyo ? `\n🤝 *Apoyo:* ${visita.tecnico_apoyo}` : '';
  const vehicle = visita.placa_vehiculo_principal ? ` (Vehículo: ${visita.placa_vehiculo_principal})` : '';
  const problem = visita.problema || visita.servicio || 'Revisión técnica';
  const horPref = visita.preferencia_horaria || 'No definida';
  const delayStr = overdueMinutes > 0 ? `${overdueMinutes} min` : 'Horario superado';

  return (
    `🚨 *ALERTA DE RETRASO EN VISITA TÉCNICA*\n\n` +
    `👤 *Cliente:* ${client}\n` +
    `📄 *Contrato:* #${contract}\n` +
    `📍 *Sector:* ${sector}\n` +
    `🛠️ *Técnico:* ${tech}${vehicle}${apoyo}\n` +
    `⏰ *Horario Estimado:* ${horPref}\n` +
    `⏳ *Tiempo de Atraso:* ${delayStr}\n` +
    `⚠️ *Problema:* ${problem}\n` +
    `📋 *Estado Actual:* ${visita.estado || 'PENDIENTE'}\n\n` +
    `_Notificación generada desde Centro de Comando Futurity_`
  );
}

export async function sendTelegramOverdueAlert(visita, overdueMinutes, token) {
  const text = formatTelegramOverdueMessage(visita, overdueMinutes);
  try {
    const res = await fetch('/api/cronograma/alerta_telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id_visita: visita.id_visita,
        contrato: visita.contrato,
        cliente: visita.cliente,
        tecnico_principal: visita.tecnico_principal,
        tecnico_apoyo: visita.tecnico_apoyo,
        mensaje: text,
        minutos_atraso: overdueMinutes
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Fallo endpoint backend telegram, retornando modo simulación:", err);
    return {
      status: 'simulated',
      message: 'Alerta preparada (Modo Prueba)',
      text
    };
  }
}
