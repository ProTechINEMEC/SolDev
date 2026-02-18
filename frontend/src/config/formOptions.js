// Default/fallback dropdown configurations
// These are used if the API is unavailable or as initial data

export const AREAS = [
  { value: 'gerencia_general', label: 'Gerencia General' },
  { value: 'operaciones', label: 'Operaciones', children: [
    { value: 'operaciones_planta', label: 'Planta' },
    { value: 'operaciones_campo', label: 'Campo' },
    { value: 'operaciones_taller', label: 'Taller' }
  ]},
  { value: 'administracion', label: 'Administración' },
  { value: 'nuevas_tecnologias', label: 'Nuevas Tecnologías' },
  { value: 'ti', label: 'Tecnología de la Información' },
  { value: 'rrhh', label: 'Recursos Humanos' },
  { value: 'hse', label: 'HSE' },
  { value: 'calidad', label: 'Calidad' },
  { value: 'compras', label: 'Compras' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'logistica', label: 'Logística' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'proyectos', label: 'Proyectos' }
]

export const OPERACIONES_CONTRATOS = [
  { value: 'oficina_principal', label: 'Oficina Principal' },
  { value: 'planta_barranca', label: 'Planta Barrancabermeja' },
  { value: 'planta_cartagena', label: 'Planta Cartagena' },
  { value: 'contrato_ecopetrol', label: 'Contrato Ecopetrol' },
  { value: 'contrato_oxy', label: 'Contrato OXY' },
  { value: 'contrato_gran_tierra', label: 'Contrato Gran Tierra' },
  { value: 'contrato_parex', label: 'Contrato Parex' },
  { value: 'contrato_frontera', label: 'Contrato Frontera Energy' },
  { value: 'otro', label: 'Otro' }
]

export const NIVELES_URGENCIA = [
  { value: 'inmediata', label: 'Inmediata (< 1 semana)' },
  { value: 'corto_plazo', label: 'Corto Plazo (1-4 semanas)' },
  { value: 'mediano_plazo', label: 'Mediano Plazo (1-3 meses)' },
  { value: 'largo_plazo', label: 'Largo Plazo (> 3 meses)' }
]

export const TIPOS_SOLUCION = [
  { value: 'aplicacion_web', label: 'Aplicación Web' },
  { value: 'aplicacion_movil', label: 'Aplicación Móvil' },
  { value: 'automatizacion', label: 'Automatización de Proceso' },
  { value: 'integracion', label: 'Integración de Sistemas' },
  { value: 'reporte_dashboard', label: 'Reporte/Dashboard' },
  { value: 'otro', label: 'Otro (especificar)' }
]

export const FORMAS_ENTREGA = [
  { value: 'web', label: 'Aplicación Web' },
  { value: 'movil', label: 'Aplicación Móvil' },
  { value: 'escritorio', label: 'Aplicación de Escritorio' },
  { value: 'reporte', label: 'Reporte Periódico' },
  { value: 'dashboard', label: 'Dashboard en Tiempo Real' },
  { value: 'api', label: 'API/Servicio' }
]

export const CRITICIDAD_LEVELS = [
  { value: 'baja', label: 'Baja - Impacto mínimo' },
  { value: 'media', label: 'Media - Afecta productividad' },
  { value: 'alta', label: 'Alta - Detiene procesos críticos' },
  { value: 'critica', label: 'Crítica - Impacto en seguridad/negocio' }
]

// Request types for NT solicitudes
export const NT_REQUEST_TYPES = [
  {
    value: 'proyecto_nuevo_interno',
    label: 'Proyecto Nuevo (Interno)',
    description: 'Solicitud de desarrollo de un nuevo proyecto interno para la organización'
  },
  {
    value: 'actualizacion',
    label: 'Actualización de Sistema',
    description: 'Mejora o actualización de un sistema existente'
  },
  {
    value: 'reporte_fallo',
    label: 'Reporte de Fallo',
    description: 'Reportar un error o fallo en un sistema existente'
  },
  {
    value: 'cierre_servicio',
    label: 'Cierre de Servicio',
    description: 'Solicitud de cierre o descontinuación de un servicio tecnológico'
  }
]

// Category definitions for main form selection
export const FORM_CATEGORIES = [
  {
    value: 'it',
    label: 'Soporte TI',
    description: 'Tickets de soporte técnico general (hardware, software, red, accesos)',
    icon: 'ToolOutlined',
    color: '#52c41a'
  },
  {
    value: 'nt',
    label: 'Nuevas Tecnologías',
    description: 'Solicitudes de proyectos, actualizaciones, reportes de fallo o cierre de servicios',
    icon: 'RocketOutlined',
    color: '#D52B1E'
  }
]

// Helper function to flatten areas for simple select
export const flattenAreas = (areas, parentLabel = '') => {
  let result = []
  for (const area of areas) {
    const label = parentLabel ? `${parentLabel} > ${area.label}` : area.label
    result.push({ value: area.value, label })
    if (area.children) {
      result = result.concat(flattenAreas(area.children, area.label))
    }
  }
  return result
}

// Get label by value helper
export const getLabelByValue = (options, value) => {
  for (const opt of options) {
    if (opt.value === value) return opt.label
    if (opt.children) {
      const childLabel = getLabelByValue(opt.children, value)
      if (childLabel) return childLabel
    }
  }
  return value
}
