/**
 * Public-friendly labels for internal states
 * Used for public status pages to hide internal workflow details
 */

const solicitudEstadoLabels = {
  // Internal states -> Public labels
  pendiente_evaluacion_nt: 'En Revisión',
  en_estudio: 'En Análisis',
  en_proceso: 'En Proceso',
  pendiente_aprobacion_gerencia: 'Pendiente de Aprobación',
  pendiente_reevaluacion: 'En Revisión',
  aprobado: 'Aprobado',
  agendado: 'Programado',
  en_desarrollo: 'En Desarrollo',
  stand_by: 'En Espera',
  completado: 'Completado',
  cancelado: 'Cancelado',
  rechazado_gerencia: 'No Aprobado',
  descartado_nt: 'Descartado',
  solucionado: 'Solucionado',
  no_realizado: 'No Realizado',
  resuelto: 'Resuelto',
  transferido_ti: 'Transferido a Soporte',
  transferido_nt: 'Transferido a Desarrollo'
};

const ticketEstadoLabels = {
  abierto: 'Recibido',
  asignado: 'Asignado',
  en_proceso: 'En Proceso',
  pendiente_usuario: 'Esperando Información',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  solucionado: 'Solucionado',
  no_realizado: 'No Realizado',
  escalado_nt: 'En Revisión',
  transferido_nt: 'Transferido a Desarrollo'
};

const prioridadLabels = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Urgente'
};

const tipoSolicitudLabels = {
  proyecto_nuevo_interno: 'Proyecto Nuevo',
  proyecto_nuevo_externo: 'Proyecto Nuevo',
  actualizacion: 'Actualización',
  reporte_fallo: 'Reporte de Fallo',
  cierre_servicio: 'Cierre de Servicio',
  transferido_ti: 'Soporte Técnico'
};

/**
 * Get public-friendly label for solicitud estado
 */
function getSolicitudEstadoLabel(estado) {
  return solicitudEstadoLabels[estado] || estado?.replace(/_/g, ' ');
}

/**
 * Get public-friendly label for ticket estado
 */
function getTicketEstadoLabel(estado) {
  return ticketEstadoLabels[estado] || estado?.replace(/_/g, ' ');
}

/**
 * Get public-friendly label for priority
 */
function getPrioridadLabel(prioridad) {
  return prioridadLabels[prioridad] || prioridad;
}

/**
 * Get public-friendly label for solicitud tipo
 */
function getTipoSolicitudLabel(tipo) {
  return tipoSolicitudLabels[tipo] || tipo?.replace(/_/g, ' ');
}

/**
 * Get milestone info for progress display
 */
function getMilestones(estado, tipo) {
  const isComplexType = ['proyecto_nuevo_interno', 'proyecto_nuevo_externo', 'actualizacion'].includes(tipo);

  if (isComplexType) {
    // Complex workflow milestones for projects
    const milestones = [
      { id: 'recibido', label: 'Recibido', completed: true },
      { id: 'analisis', label: 'Análisis', completed: false },
      { id: 'aprobacion', label: 'Aprobación', completed: false },
      { id: 'desarrollo', label: 'Desarrollo', completed: false },
      { id: 'completado', label: 'Completado', completed: false }
    ];

    // Mark milestones as completed based on current state
    switch (estado) {
      case 'en_estudio':
      case 'pendiente_reevaluacion':
        milestones[1].completed = true;
        break;
      case 'pendiente_aprobacion_gerencia':
        milestones[1].completed = true;
        milestones[2].current = true;
        break;
      case 'aprobado':
      case 'agendado':
        milestones[1].completed = true;
        milestones[2].completed = true;
        break;
      case 'en_desarrollo':
        milestones[1].completed = true;
        milestones[2].completed = true;
        milestones[3].completed = true;
        milestones[3].current = true;
        break;
      case 'completado':
        milestones.forEach(m => m.completed = true);
        break;
      case 'rechazado_gerencia':
      case 'descartado_nt':
      case 'cancelado':
        milestones[1].completed = true;
        milestones[2].completed = true;
        milestones[2].rejected = true;
        break;
    }

    // Find current milestone
    if (!milestones.find(m => m.current || m.rejected)) {
      const firstIncomplete = milestones.find(m => !m.completed);
      if (firstIncomplete) firstIncomplete.current = true;
    }

    return milestones;
  } else {
    // Simple workflow milestones for reports/closures
    const milestones = [
      { id: 'recibido', label: 'Recibido', completed: true },
      { id: 'revision', label: 'En Revisión', completed: false },
      { id: 'resuelto', label: 'Resuelto', completed: false }
    ];

    switch (estado) {
      case 'en_proceso':
        milestones[1].completed = true;
        milestones[1].current = true;
        break;
      case 'solucionado':
      case 'resuelto':
        milestones.forEach(m => m.completed = true);
        break;
      case 'no_realizado':
        milestones[1].completed = true;
        milestones[2].rejected = true;
        break;
      case 'transferido_ti':
        milestones[1].completed = true;
        milestones[2].label = 'Transferido';
        milestones[2].transferred = true;
        break;
    }

    if (!milestones.find(m => m.current || m.rejected || m.transferred)) {
      const firstIncomplete = milestones.find(m => !m.completed);
      if (firstIncomplete) firstIncomplete.current = true;
    }

    return milestones;
  }
}

/**
 * Get progress percentage based on milestones
 */
function getProgressPercentage(estado, tipo) {
  const milestones = getMilestones(estado, tipo);
  const completed = milestones.filter(m => m.completed).length;
  return Math.round((completed / milestones.length) * 100);
}

/**
 * Format estado for public display with context
 */
function formatPublicEstado(estado, tipo, transferInfo = null) {
  const label = getSolicitudEstadoLabel(estado);
  const milestones = getMilestones(estado, tipo);
  const progress = getProgressPercentage(estado, tipo);

  return {
    estado: label,
    estado_interno: estado,
    progress,
    milestones,
    transferencia: transferInfo,
    es_terminal: ['completado', 'cancelado', 'rechazado_gerencia', 'descartado_nt', 'solucionado', 'no_realizado'].includes(estado),
    es_transferido: ['transferido_ti', 'transferido_nt'].includes(estado)
  };
}

module.exports = {
  solicitudEstadoLabels,
  ticketEstadoLabels,
  prioridadLabels,
  tipoSolicitudLabels,
  getSolicitudEstadoLabel,
  getTicketEstadoLabel,
  getPrioridadLabel,
  getTipoSolicitudLabel,
  getMilestones,
  getProgressPercentage,
  formatPublicEstado
};
