import React, { useState, useEffect, useMemo } from 'react';
import './cronograma.css';
import TimelineHeader from './TimelineHeader';
import TimelineResourcesList from './TimelineResourcesList';
import TimelineGrid from './TimelineGrid';
import UnassignedBacklogDrawer from './UnassignedBacklogDrawer';
import ModalAsignacionDoble from './ModalAsignacionDoble';
import FichaVisitaDrawer from './FichaVisitaDrawer';
import { calculateOverdueMinutes } from './telegramAlertHelper';
import { computeTechLanes } from './timelineLayoutHelper';

export default function CronogramaTimeline({
  visitas = [],
  tecnicos = [],
  fechaFiltro,
  setFechaFiltro,
  stats,
  token,
  user,
  activeArea,
  onRefresh,
  loading,
  vistaModo,
  setVistaModo,
  onOpenEditModal
}) {
  const [localVisitas, setLocalVisitas] = useState(visitas);
  const [now, setNow] = useState(new Date());
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [selectedVisitForModal, setSelectedVisitForModal] = useState(null);
  const [selectedVisitForFicha, setSelectedVisitForFicha] = useState(null);
  const [dragOverTecnico, setDragOverTecnico] = useState(null);

  // Mantener localVisitas sincronizado cuando se recargan las visitas del servidor
  useEffect(() => {
    setLocalVisitas(visitas);
  }, [visitas]);

  // Reloj en vivo que se actualiza cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const getTodayLocal = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = fechaFiltro === getTodayLocal();

  // Filtrar técnicos visibles según área activa
  const tecnicosVisibles = useMemo(() => {
    return tecnicos.filter(t => {
      if (!t.activo) return false;
      if (t.nombre === 'NO TECNICO' || t.nombre === 'TECNOLOGIA') return false;
      if (activeArea === 'INSTALACIONES') {
        return t.area_trabajo === 'INSTALACIONES' || t.area_trabajo === 'MIXTO' || !t.area_trabajo;
      }
      if (activeArea === 'SOPORTE') {
        return t.area_trabajo === 'SOPORTE' || t.area_trabajo === 'MIXTO' || !t.area_trabajo;
      }
      return true;
    });
  }, [tecnicos, activeArea]);

  // Agrupar visitas por técnico principal y calcular atrasos
  const { visitasPorTecnico, cantAtrasadas, cantSinAsignar } = useMemo(() => {
    const map = {};
    let atrasadasCount = 0;
    let sinAsignarCount = 0;

    tecnicosVisibles.forEach(t => {
      map[t.nombre] = [];
    });

    localVisitas.forEach(v => {
      const estado = (v.estado || 'PENDIENTE').toUpperCase();
      // Si la visita está cancelada o solventada por otro depto, no entra al cronograma activo ni a la bandeja
      if (estado === 'CANCELADA' || estado === 'SOLVENTADA_REMOTA') {
        return;
      }

      const tech = (v.tecnico_principal || '').trim();
      const pref = (v.preferencia_horaria || '').trim().toUpperCase();
      const isCoordinar = pref.includes('COORDINAR') || pref === 'FLEXIBLE';
      const isUnassigned = (estado === 'PENDIENTE') && (!tech || tech === 'NO TECNICO' || tech === 'SIN ASIGNAR' || tech === 'AUTO' || isCoordinar);

      if (isUnassigned) {
        sinAsignarCount++;
      }

      const overdueMin = isToday && estado === 'PENDIENTE' ? calculateOverdueMinutes(v, now) : 0;
      const isOverdue = overdueMin > 0;
      if (isOverdue) atrasadasCount++;

      const vEnriched = {
        ...v,
        _isOverdue: isOverdue,
        _overdueMin: overdueMin
      };

      // 1. Agregar a la fila del Técnico Principal (Titular)
      if (!isUnassigned && map[tech]) {
        map[tech].push({
          ...vEnriched,
          _esApoyo: false,
          _rolCuadrilla: 'TITULAR'
        });
      }

      // 2. Si tiene Técnico de Apoyo, duplicar/reflejar en la fila del Técnico de Apoyo
      const apoyo = (v.tecnico_apoyo || '').trim();
      const hasValidApoyo = apoyo && apoyo !== 'NO TECNICO' && apoyo !== 'SIN ASIGNAR' && apoyo !== tech;
      if (hasValidApoyo && map[apoyo]) {
        // Detectar si fue refuerzo a media visita
        let inicioApoyoMin = null;
        const allNotes = `${v.observacion_callcenter || ''} ${v.preferencia_horaria || ''} ${v.informacion_tecnico || ''}`;
        const refuerzoMatch = allNotes.match(/(?:refuerzo|apoyo).*?(?:desde|a las|inicia)\s*(\d{1,2}):?(\d{2})?/i);
        if (refuerzoMatch) {
          let rh = parseInt(refuerzoMatch[1], 10);
          const rm = refuerzoMatch[2] ? parseInt(refuerzoMatch[2], 10) : 0;
          if (allNotes.toLowerCase().includes('tarde') && rh < 12) rh += 12;
          inicioApoyoMin = rh * 60 + rm;
        }

        map[apoyo].push({
          ...vEnriched,
          _esApoyo: true,
          _rolCuadrilla: 'APOYO',
          _titularNombre: tech,
          _inicioApoyoMin: inicioApoyoMin
        });
      }
    });

    return {
      visitasPorTecnico: map,
      cantAtrasadas: atrasadasCount,
      cantSinAsignar: sinAsignarCount
    };
  }, [localVisitas, tecnicosVisibles, isToday, now]);

  // Distribución automática en sub-carriles para evitar que visitas se monten una sobre otra
  const techLayoutMap = useMemo(() => {
    const layout = {};
    tecnicosVisibles.forEach(t => {
      const list = visitasPorTecnico[t.nombre] || [];
      layout[t.nombre] = computeTechLanes(list, 7, 21);
    });
    return layout;
  }, [visitasPorTecnico, tecnicosVisibles]);

  // Manejador de Drop desde Timeline o Backlog con actualización optimista inmediata (0ms de retraso)
  const handleDropVisit = async (payload) => {
    // 1. Actualización optimista inmediata en la UI para respuesta instantánea y fluida
    setLocalVisitas(prev => prev.map(v => {
      if (v.id_visita === payload.id_visita) {
        return {
          ...v,
          tecnico_principal: payload.nuevo_tecnico,
          tecnico_apoyo: payload.tecnico_apoyo || '',
          preferencia_horaria: payload.nueva_preferencia_horaria || v.preferencia_horaria,
          ventana_inicio_min: payload.ventana_inicio_min,
          ventana_fin_min: payload.ventana_fin_min
        };
      }
      return v;
    }));

    try {
      const formData = new URLSearchParams({
        tecnico_principal: payload.nuevo_tecnico,
        tecnico_apoyo: payload.tecnico_apoyo || '',
        preferencia_horaria: payload.nueva_preferencia_horaria || '',
        ventana_inicio_min: String(payload.ventana_inicio_min || 0),
        ventana_fin_min: String(payload.ventana_fin_min || 0)
      });

      const res = await fetch(`/api/visitas/${payload.id_visita}/reasignar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.status === 'success' || data.status === 'ok') {
        onRefresh();
      } else {
        alert("Error al mover visita: " + (data.message || ''));
        onRefresh();
      }
    } catch (e) {
      console.error("Error en drag & drop de visita:", e);
      alert("Error de conexión al actualizar el cronograma.");
    }
  };

  // Manejador para confirmar asignación desde Modal (doble técnico)
  const handleAssignFromModal = async (data) => {
    const formData = new URLSearchParams({
      tecnico_principal: data.tecnico_principal,
      tecnico_apoyo: data.tecnico_apoyo || '',
      preferencia_horaria: data.preferencia_horaria || ''
    });

    const res = await fetch(`/api/visitas/${data.id_visita}/reasignar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const resData = await res.json();
    if (resData.status === 'success' || resData.status === 'ok') {
      onRefresh();
    } else {
      throw new Error(resData.message || 'Error en el servidor');
    }
  };

  return (
    <div className="cronograma-container">
      {/* Barra de herramientas superior */}
      <TimelineHeader
        fechaFiltro={fechaFiltro}
        setFechaFiltro={setFechaFiltro}
        stats={stats}
        cantAtrasadas={cantAtrasadas}
        cantSinAsignar={cantSinAsignar}
        backlogOpen={backlogOpen}
        setBacklogOpen={setBacklogOpen}
        vistaModo={vistaModo}
        setVistaModo={setVistaModo}
        onRefresh={onRefresh}
        loading={loading}
      />

      {/* Banner informativo de modo prueba Beta */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.08)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: '#4f46e5'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: '#6366f1',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '6px',
            fontSize: '0.68rem',
            fontWeight: 800
          }}>
            BETA PRUEBAS
          </span>
          <span>
            <strong>Cronograma Gantt Interactivo:</strong> Arrastra tarjetas entre técnicos para reasignar o en la línea de tiempo para reprogramar la hora estimada.
          </span>
        </div>

        <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
          💡 Tip: Abre la <strong>Bandeja Backlog</strong> para ubicar tickets pendientes.
        </span>
      </div>

      {/* Viewport del Gantt (Recursos a la izquierda + Grilla horizontal) */}
      <div className="cronograma-viewport">
        {/* Eje Vertical: Lista de Técnicos */}
        <TimelineResourcesList
          tecnicos={tecnicosVisibles}
          visitasPorTecnico={visitasPorTecnico}
          techLayoutMap={techLayoutMap}
          dragOverTecnico={dragOverTecnico}
          activeArea={activeArea}
        />

        {/* Eje Horizontal: Canvas con Horas y Visitas */}
        <TimelineGrid
          tecnicos={tecnicosVisibles}
          visitasPorTecnico={visitasPorTecnico}
          techLayoutMap={techLayoutMap}
          isToday={isToday}
          now={now}
          startHour={7}
          endHour={21}
          dragOverTecnico={dragOverTecnico}
          setDragOverTecnico={setDragOverTecnico}
          onDropVisit={handleDropVisit}
          onOpenEdit={(v) => setSelectedVisitForFicha(v)}
        />
      </div>

      {/* Bandeja de Visitas Sin Asignar (Slide-over Drawer independiente, fuera del viewport con scroll) */}
      <UnassignedBacklogDrawer
        isOpen={backlogOpen}
        onClose={() => setBacklogOpen(false)}
        visitas={localVisitas}
        onOpenAssignModal={(v) => setSelectedVisitForFicha(v)}
      />

      {/* Ficha Operativa Lateral (Slide-over Drawer) con Toda la Información Técnica */}
      <FichaVisitaDrawer
        isOpen={!!selectedVisitForFicha}
        onClose={() => setSelectedVisitForFicha(null)}
        visita={selectedVisitForFicha}
        token={token}
        tecnicos={tecnicos}
        onRefresh={onRefresh}
        onOpenAssignCuadrilla={(v) => {
          setSelectedVisitForFicha(null);
          setSelectedVisitForModal(v);
        }}
        onOpenEditModal={onOpenEditModal}
      />

      {/* Modal de Asignación / Cuadrilla Doble */}
      <ModalAsignacionDoble
        isOpen={!!selectedVisitForModal}
        onClose={() => setSelectedVisitForModal(null)}
        visita={selectedVisitForModal}
        tecnicos={tecnicos}
        onConfirm={handleAssignFromModal}
      />
    </div>
  );
}
