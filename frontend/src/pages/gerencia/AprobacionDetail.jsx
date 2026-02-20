import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Tabs, Timeline, Input, message, Modal, Select, Row, Col, Alert, List,
  DatePicker, Table, Progress, Checkbox
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  FileTextOutlined, UserOutlined, ExclamationCircleOutlined,
  CalendarOutlined, DollarOutlined, TeamOutlined, RedoOutlined,
  ScheduleOutlined, ProjectOutlined, FilePdfOutlined, AlertOutlined,
  ClockCircleOutlined, ToolOutlined, TrophyOutlined, LineChartOutlined,
  CrownOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import { solicitudesApi, evaluacionesApi, calendarioApi, exportApi, usuariosApi } from '../../services/api'
import SchedulingCalendar from '../../components/SchedulingCalendar'
import WorkloadChart from '../../components/WorkloadChart'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

const estadoColors = {
  pendiente_evaluacion_nt: 'warning',
  en_estudio: 'processing',
  descartado_nt: 'error',
  pendiente_aprobacion_gerencia: 'processing',
  pendiente_reevaluacion: 'orange',
  rechazado_gerencia: 'error',
  aprobado: 'success',
  agendado: 'purple',
  en_desarrollo: 'cyan',
  stand_by: 'orange',
  completado: 'green',
  cancelado: 'default'
}

const estadoLabels = {
  pendiente_evaluacion_nt: 'Pendiente Evaluación NT',
  en_estudio: 'En Estudio',
  descartado_nt: 'Descartado NT',
  pendiente_aprobacion_gerencia: 'Pendiente Aprobación Gerencia',
  pendiente_reevaluacion: 'Pendiente Reevaluación',
  rechazado_gerencia: 'Rechazado',
  aprobado: 'Aprobado',
  agendado: 'Agendado',
  en_desarrollo: 'En Desarrollo',
  stand_by: 'Stand By',
  completado: 'Completado',
  cancelado: 'Cancelado'
}

const prioridadColors = {
  baja: 'green',
  media: 'cyan',
  alta: 'orange',
  critica: 'red'
}

const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Nuevo (Interno)',
  proyecto_nuevo_externo: 'Proyecto Nuevo (Externo)',
  actualizacion: 'Actualización',
  reporte_fallo: 'Reporte de Fallo',
  cierre_servicio: 'Cierre de Servicio'
}

const recomendacionColors = {
  aprobar: 'success',
  rechazar: 'error',
  aplazar: 'warning'
}

// Label mappings for dropdown values
const areaLabels = {
  gerencia_general: 'Gerencia General',
  operaciones: 'Operaciones',
  operaciones_planta: 'Operaciones > Planta',
  operaciones_campo: 'Operaciones > Campo',
  operaciones_taller: 'Operaciones > Taller',
  administracion: 'Administración',
  nuevas_tecnologias: 'Nuevas Tecnologías',
  ti: 'Tecnología de la Información',
  rrhh: 'Recursos Humanos',
  hse: 'HSE',
  calidad: 'Calidad',
  compras: 'Compras',
  contabilidad: 'Contabilidad',
  mantenimiento: 'Mantenimiento',
  logistica: 'Logística',
  comercial: 'Comercial',
  juridico: 'Jurídico',
  proyectos: 'Proyectos'
}

const operacionContratoLabels = {
  oficina_principal: 'Oficina Principal',
  planta_barranca: 'Planta Barrancabermeja',
  planta_cartagena: 'Planta Cartagena',
  contrato_ecopetrol: 'Contrato Ecopetrol',
  contrato_oxy: 'Contrato OXY',
  contrato_gran_tierra: 'Contrato Gran Tierra',
  contrato_parex: 'Contrato Parex',
  contrato_frontera: 'Contrato Frontera Energy',
  otro: 'Otro'
}

const tipoSolucionLabels = {
  aplicacion_web: 'Aplicación Web',
  aplicacion_movil: 'Aplicación Móvil',
  automatizacion: 'Automatización de Proceso',
  integracion: 'Integración de Sistemas',
  reporte_dashboard: 'Reporte/Dashboard',
  otro: 'Otro'
}

const formaEntregaLabels = {
  web: 'Aplicación Web',
  movil: 'Aplicación Móvil',
  escritorio: 'Aplicación de Escritorio',
  reporte: 'Reporte Periódico',
  dashboard: 'Dashboard en Tiempo Real',
  api: 'API/Servicio'
}

// Helper to get label
const getLabel = (value, labels) => labels[value] || value || '--'

function GerenciaAprobacionDetail() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [evaluacion, setEvaluacion] = useState(null)
  const [reevaluaciones, setReevaluaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [reevalModalVisible, setReevalModalVisible] = useState(false)
  const [scheduleData, setScheduleData] = useState({
    fechas: null,
    comentario: '',
    conflictos: []
  })
  const [rejectData, setRejectData] = useState({ tipo: 'ajustable', razon: '', recomendaciones: '' })
  const [reevalData, setReevalData] = useState({
    comentario: '',
    areas_revisar: []
  })
  const [conflictLoading, setConflictLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [ntUsers, setNtUsers] = useState([])

  useEffect(() => {
    loadSolicitud()
    loadNtUsers()
  }, [codigo])

  const loadNtUsers = async () => {
    try {
      const res = await usuariosApi.getByRole('nuevas_tecnologias')
      setNtUsers(res.data.usuarios || [])
    } catch (error) {
      console.error('Error loading NT users:', error)
    }
  }

  const loadSolicitud = async () => {
    try {
      const [solicitudRes, evaluacionRes, reevalRes] = await Promise.all([
        solicitudesApi.get(codigo),
        evaluacionesApi.getBySolicitud(codigo).catch(() => ({ data: { evaluacion: null } })),
        solicitudesApi.getReevaluaciones(codigo).catch(() => ({ data: { reevaluaciones: [] } }))
      ])
      setData(solicitudRes.data)
      // Combine evaluation data into a single object for easier access
      if (evaluacionRes.data.evaluacion) {
        setEvaluacion({
          ...evaluacionRes.data.evaluacion,
          cronograma: evaluacionRes.data.cronograma || {},
          tareas: evaluacionRes.data.tareas || [],
          estimacion: evaluacionRes.data.estimacion || {},
          equipo: evaluacionRes.data.equipo || []
        })
      } else {
        setEvaluacion(null)
      }
      setReevaluaciones(reevalRes.data.reevaluaciones || [])
    } catch (error) {
      console.error('Error loading solicitud:', error)
      message.error('Error al cargar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectData.razon.trim()) {
      message.error('Debe proporcionar una razón para el rechazo')
      return
    }
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(codigo, {
        estado: 'rechazado_gerencia',
        motivo_rechazo: `${rejectData.tipo === 'definitivo' ? '[DEFINITIVO] ' : ''}${rejectData.razon}`,
        comentario: `Rechazado (${rejectData.tipo}): ${rejectData.razon}. ${rejectData.recomendaciones ? `Recomendaciones: ${rejectData.recomendaciones}` : ''}`
      })
      message.success('Proyecto rechazado')
      setRejectModalVisible(false)
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al rechazar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReevaluation = async () => {
    if (!reevalData.comentario.trim()) {
      message.error('Debe proporcionar comentarios para la reevaluación')
      return
    }
    setActionLoading(true)
    try {
      await solicitudesApi.solicitarReevaluacion(codigo, {
        comentario: reevalData.comentario,
        areas_revisar: reevalData.areas_revisar
      })
      message.success('Reevaluación solicitada')
      setReevalModalVisible(false)
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al solicitar reevaluación')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!evaluacion?.id) {
      message.warning('No hay evaluación disponible para descargar')
      return
    }
    setPdfLoading(true)
    try {
      const response = await exportApi.evaluacionPdf(evaluacion.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `evaluacion-${solicitud?.codigo || 'solicitud'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('PDF de evaluación descargado')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      message.error('Error al descargar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  // Format COP currency
  const formatCOP = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '$0'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!data?.solicitud) {
    return <Card><Title level={4}>Solicitud no encontrada</Title></Card>
  }

  const { solicitud, comentarios } = data

  // Extract all form sections from solicitud
  const identificacion = solicitud.datos_solicitante || solicitud.identificacion || {}
  const sponsor = solicitud.datos_patrocinador || solicitud.sponsor || {}
  const stakeholders = solicitud.stakeholders || {}
  const problematica = solicitud.descripcion_problema || solicitud.problematica || {}
  const urgencia = solicitud.urgencia || {}
  const solucion = solicitud.solucion_propuesta || solicitud.solucion || {}
  const beneficios = solicitud.beneficios || {}
  const declaracion = solicitud.declaracion || {}
  const kpis = solicitud.kpis || declaracion.indicadores || []

  const isPending = solicitud.estado === 'pendiente_aprobacion_gerencia'
  const cronograma = evaluacion?.cronograma || {}
  const tareas = evaluacion?.tareas || []
  const estimacion = evaluacion?.estimacion || {}
  const equipo = evaluacion?.equipo || []

  // Get fases from cronograma or extract from tasks
  const fases = cronograma.fases || [...new Set(tareas.map(t => t.fase).filter(Boolean))]

  // Build equipo data for WorkloadChart - map user IDs to user objects
  const equipoIds = cronograma.equipo_ids || equipo.map(e => e.usuario_id)
  const equipoForChart = ntUsers.filter(u => equipoIds.includes(u.id))
  const liderId = equipo.find(e => e.es_lider)?.usuario_id || cronograma.lider_id

  // Build tareas for WorkloadChart - need to transform to expected format
  const tareasForChart = tareas.map(t => ({
    ...t,
    nombre: t.titulo || t.nombre,
    asignados_ids: t.asignados_ids || (t.asignado_id ? [t.asignado_id] : [])
  }))

  const areasRevisarOptions = [
    { label: 'Cronograma', value: 'cronograma' },
    { label: 'Estimación de Costos', value: 'costos' },
    { label: 'Equipo Asignado', value: 'equipo' },
    { label: 'Alcance del Proyecto', value: 'alcance' },
    { label: 'Justificación', value: 'justificacion' },
    { label: 'Indicadores (KPIs)', value: 'kpis' }
  ]

  // Parse estimacion items - they might be stored in servicios_externos
  const parseEstimacionItems = () => {
    const items = []

    // Check servicios_externos (where EvaluacionForm stores items)
    const serviciosExternos = typeof estimacion.servicios_externos === 'string'
      ? JSON.parse(estimacion.servicios_externos)
      : estimacion.servicios_externos || []

    serviciosExternos.forEach(item => {
      items.push({
        concepto: item.concepto || item.descripcion || '',
        subtotal: item.monto || item.subtotal || 0,
        iva: item.iva || 0
      })
    })

    // Also check desarrollo_interno
    const desarrolloInterno = typeof estimacion.desarrollo_interno === 'string'
      ? JSON.parse(estimacion.desarrollo_interno)
      : estimacion.desarrollo_interno || []

    desarrolloInterno.forEach(item => {
      items.push({
        concepto: item.concepto || item.descripcion || '',
        subtotal: item.subtotal || 0,
        iva: item.iva || 0
      })
    })

    // Also check infraestructura
    const infraestructura = typeof estimacion.infraestructura === 'string'
      ? JSON.parse(estimacion.infraestructura)
      : estimacion.infraestructura || []

    infraestructura.forEach(item => {
      items.push({
        concepto: item.concepto || item.descripcion || '',
        subtotal: item.subtotal || item.monto || 0,
        iva: item.iva || 0
      })
    })

    return items
  }

  const costItems = parseEstimacionItems()
  const totalCostos = costItems.reduce((sum, item) => sum + (item.subtotal || 0) + (item.iva || 0), 0)

  // Calculate totals for cost analysis from solicitud
  const analisisCostos = beneficios.analisis_costos || {}
  const beneficioMonetario = beneficios.beneficio_monetario || {}

  const totalActual = (analisisCostos.costos_actuales || []).reduce(
    (sum, item) => sum + ((item.cantidad || 1) * (item.valor || item.monto || 0)), 0
  )
  const totalEsperado = (analisisCostos.costos_esperados || []).reduce(
    (sum, item) => sum + ((item.cantidad || 1) * (item.valor || item.monto || 0)), 0
  )
  const ahorro = totalActual - totalEsperado

  const totalBeneficioMonetario = (beneficioMonetario.items || []).reduce(
    (sum, item) => sum + ((item.cantidad || 1) * (item.valor || item.monto || 0)), 0
  )

  // Render Solicitante Section
  const renderSolicitante = () => (
    <Card
      title={<><UserOutlined /> Datos del Solicitante</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Nombre Completo">
          {identificacion.nombre_completo || identificacion.nombre || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Cargo">
          {identificacion.cargo || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Área">
          {getLabel(identificacion.area || identificacion.departamento, areaLabels)}
        </Descriptions.Item>
        <Descriptions.Item label="Operación/Contrato">
          {getLabel(identificacion.operacion_contrato, operacionContratoLabels)}
        </Descriptions.Item>
        <Descriptions.Item label="Correo">
          {identificacion.correo || identificacion.email || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Teléfono">
          {identificacion.telefono || '--'}
        </Descriptions.Item>
        {identificacion.es_doliente !== undefined && (
          <Descriptions.Item label="¿Es Doliente?">
            {identificacion.es_doliente === true ? 'Sí' :
             identificacion.es_doliente === false ? 'No' : '--'}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  )

  // Render Sponsor Section
  const renderSponsor = () => {
    if (identificacion.es_doliente !== false) return null
    if (!sponsor.nombre_completo && !sponsor.nombre) return null

    return (
      <Card
        title={<><UserOutlined /> Datos del Patrocinador (Sponsor)</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Nombre Completo">
            {sponsor.nombre_completo || sponsor.nombre || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Cargo">
            {sponsor.cargo || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Área">
            {getLabel(sponsor.area || sponsor.departamento, areaLabels)}
          </Descriptions.Item>
          <Descriptions.Item label="Correo">
            {sponsor.correo || sponsor.email || '--'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Stakeholders
  const renderStakeholders = () => {
    const internas = stakeholders.internas || {}
    const externas = stakeholders.externas || {}

    if (!internas.areas?.length && !internas.personas?.length) return null

    return (
      <Card
        title={<><TeamOutlined /> Partes Interesadas</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Áreas Interesadas">
            {internas.areas?.length > 0
              ? internas.areas.map((a, i) => <Tag key={i}>{a}</Tag>)
              : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Personas Clave Internas">
            {internas.personas?.length > 0
              ? internas.personas.map((p, i) => <Tag key={i}>{p}</Tag>)
              : '--'}
          </Descriptions.Item>
          {stakeholders.aplica_externas && (
            <>
              <Descriptions.Item label="Sectores Comerciales">
                {externas.sectores?.length > 0
                  ? externas.sectores.map((s, i) => <Tag key={i}>{s}</Tag>)
                  : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Empresas">
                {externas.empresas?.length > 0
                  ? externas.empresas.map((e, i) => <Tag key={i}>{e}</Tag>)
                  : '--'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>
    )
  }

  // Render Problemática
  const renderProblematica = () => (
    <Card
      title={<><AlertOutlined /> Descripción de la Problemática</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Título">
          {problematica.titulo || solicitud.titulo || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Situación Actual">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {problematica.situacion_actual || problematica.problema_actual || '--'}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Origen del Problema">
          {problematica.origen || '--'}
        </Descriptions.Item>
        {problematica.desde_cuando && (
          <Descriptions.Item label="Desde Cuándo">
            {dayjs(problematica.desde_cuando).format('DD/MM/YYYY')}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Afectación a la Operación">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {problematica.afectacion_operacion || '--'}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Procesos Comprometidos">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {problematica.procesos_comprometidos || '--'}
          </span>
        </Descriptions.Item>
        {problematica.impacto_nivel && (
          <Descriptions.Item label="Nivel de Impacto">
            <Tag color={
              problematica.impacto_nivel === 'critico' ? 'red' :
              problematica.impacto_nivel === 'alto' ? 'orange' :
              problematica.impacto_nivel === 'medio' ? 'cyan' : 'green'
            }>
              {problematica.impacto_nivel.toUpperCase()}
            </Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Descripción del Impacto">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {problematica.impacto_descripcion || problematica.impacto || '--'}
          </span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Urgencia
  const renderUrgencia = () => {
    if (!urgencia.necesidad_principal && !urgencia.nivel) return null

    return (
      <Card
        title={<><ClockCircleOutlined /> Necesidad y Urgencia</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Necesidad Principal">
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {urgencia.necesidad_principal || '--'}
            </span>
          </Descriptions.Item>
          {urgencia.nivel && (
            <Descriptions.Item label="Nivel de Urgencia">
              <Tag color={
                urgencia.nivel === 'inmediata' ? 'red' :
                urgencia.nivel === 'corto_plazo' ? 'orange' :
                urgencia.nivel === 'mediano_plazo' ? 'cyan' : 'green'
              }>
                {urgencia.nivel.replace(/_/g, ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
          )}
          {urgencia.fecha_limite && (
            <Descriptions.Item label="Fecha Límite">
              {dayjs(urgencia.fecha_limite).format('DD/MM/YYYY')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="¿Por qué NT?">
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {urgencia.justificacion_nt || urgencia.justificacion || '--'}
            </span>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Solución
  const renderSolucion = () => {
    const tipoSolucion = solucion.tipo || solucion.tipo_solucion
    const tipoDescripcion = solucion.tipo_descripcion || solucion.tipo_solucion_otro
    const descripcionIdeal = solucion.descripcion_ideal || solucion.solucion_ideal

    return (
      <Card
        title={<><ToolOutlined /> Propuesta de Solución</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Tipo de Solución">
            {tipoSolucion ? (
              <>
                {getLabel(tipoSolucion, tipoSolucionLabels)}
                {tipoDescripcion && ` - ${tipoDescripcion}`}
              </>
            ) : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Descripción de la Solución Ideal">
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {descripcionIdeal || '--'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Casos de Uso">
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {solucion.casos_uso || '--'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Usuarios Finales">
            {solucion.usuarios_finales?.length > 0
              ? solucion.usuarios_finales.map((u, i) => <Tag key={i}>{u}</Tag>)
              : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Funcionalidades Mínimas">
            {solucion.funcionalidades_minimas?.length > 0 ? (
              <List
                size="small"
                dataSource={solucion.funcionalidades_minimas}
                renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>}
              />
            ) : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Funcionalidades Deseables">
            {solucion.funcionalidades_deseables?.length > 0 ? (
              <List
                size="small"
                dataSource={solucion.funcionalidades_deseables}
                renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>}
              />
            ) : '--'}
          </Descriptions.Item>
          {solucion.tiene_restricciones && solucion.restricciones?.length > 0 && (
            <Descriptions.Item label="Restricciones">
              <List
                size="small"
                dataSource={solucion.restricciones}
                renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>}
              />
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Forma de Entrega">
            {getLabel(solucion.forma_entrega, formaEntregaLabels)}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Beneficios
  const renderBeneficios = () => (
    <Card
      title={<><TrophyOutlined /> Beneficios Esperados</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Descripción">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {beneficios.descripcion || '--'}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Mejora Concreta">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {beneficios.mejora_concreta || '--'}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Procesos a Optimizar">
          {beneficios.procesos_optimizados?.length > 0
            ? beneficios.procesos_optimizados.map((p, i) => <Tag key={i}>{p}</Tag>)
            : '--'}
        </Descriptions.Item>
        <Descriptions.Item label="¿Reducción de Costos?">
          {beneficios.reduccion_costos === true ? 'Sí' :
           beneficios.reduccion_costos === false ? 'No' : '--'}
        </Descriptions.Item>
      </Descriptions>

      {/* Cost Analysis Section */}
      {beneficios.reduccion_costos && (
        <div style={{ marginTop: 16, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Análisis de Costos</Text>

          <Row gutter={16}>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Actuales</Text>
              {analisisCostos.costos_actuales?.length > 0 ? (
                <List
                  size="small"
                  dataSource={analisisCostos.costos_actuales}
                  renderItem={(item, i) => (
                    <List.Item key={i} style={{ padding: '4px 0' }}>
                      <Text>{item.descripcion}</Text>
                      <Text style={{ marginLeft: 8 }}>
                        {item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}
                      </Text>
                    </List.Item>
                  )}
                  footer={<Text strong>Total: {formatCOP(totalActual)}</Text>}
                />
              ) : '--'}
            </Col>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Esperados</Text>
              {analisisCostos.costos_esperados?.length > 0 ? (
                <List
                  size="small"
                  dataSource={analisisCostos.costos_esperados}
                  renderItem={(item, i) => (
                    <List.Item key={i} style={{ padding: '4px 0' }}>
                      <Text>{item.descripcion}</Text>
                      <Text style={{ marginLeft: 8 }}>
                        {item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}
                      </Text>
                    </List.Item>
                  )}
                  footer={<Text strong>Total: {formatCOP(totalEsperado)}</Text>}
                />
              ) : '--'}
            </Col>
          </Row>

          <div style={{ marginTop: 12, padding: 12, background: ahorro > 0 ? '#f6ffed' : '#fff1f0', borderRadius: 8, textAlign: 'center' }}>
            <Text strong style={{ fontSize: 16, color: ahorro > 0 ? '#52c41a' : '#ff4d4f' }}>
              Ahorro Estimado: {formatCOP(ahorro)}
            </Text>
          </div>
        </div>
      )}

      {/* Monetary Benefit Section */}
      <div style={{ marginTop: 16 }}>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="¿Se espera beneficio monetario directo?">
            {beneficioMonetario.espera_beneficio === true ? 'Sí' :
             beneficioMonetario.espera_beneficio === false ? 'No' : '--'}
          </Descriptions.Item>
        </Descriptions>

        {beneficioMonetario.espera_beneficio && (
          <div style={{ marginTop: 12, padding: 16, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>Detalle del Beneficio Monetario</Text>

            {beneficioMonetario.items?.length > 0 ? (
              <List
                size="small"
                dataSource={beneficioMonetario.items}
                renderItem={(item, i) => (
                  <List.Item key={i}>
                    <Text>{item.descripcion}</Text>
                    <Text style={{ marginLeft: 8 }}>
                      {item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}
                    </Text>
                  </List.Item>
                )}
              />
            ) : '--'}

            <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 8, textAlign: 'center', border: '1px solid #52c41a' }}>
              <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                Total Beneficio Monetario: {formatCOP(totalBeneficioMonetario)}
              </Text>
            </div>
          </div>
        )}
      </div>
    </Card>
  )

  // Render KPIs/Desempeño
  const renderDesempeno = () => {
    const desempeno = declaracion.desempeno || solicitud.desempeno || {}

    return (
      <Card
        title={<><LineChartOutlined /> Control de Desempeño (KPIs)</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Indicadores Propuestos</Text>
        {kpis.length > 0 ? (
          <List
            size="small"
            dataSource={kpis}
            renderItem={(kpi, index) => (
              <List.Item>
                <Descriptions size="small" column={{ xs: 1, sm: 4 }}>
                  <Descriptions.Item label="Indicador">{kpi.nombre || kpi.indicador || '--'}</Descriptions.Item>
                  <Descriptions.Item label="Valor Actual">{kpi.valor_actual || '--'}</Descriptions.Item>
                  <Descriptions.Item label="Objetivo">{kpi.valor_objetivo || '--'}</Descriptions.Item>
                  <Descriptions.Item label="Unidad">{kpi.unidad || '--'}</Descriptions.Item>
                </Descriptions>
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">Sin indicadores definidos</Text>
        )}

        {(desempeno.como_medir || desempeno.herramientas || desempeno.responsable_datos) && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Plan de Medición</Text>
            <Descriptions bordered column={1} size="small">
              {desempeno.como_medir && (
                <Descriptions.Item label="¿Cómo se medirá cada indicador?">
                  <span style={{ whiteSpace: 'pre-wrap' }}>{desempeno.como_medir}</span>
                </Descriptions.Item>
              )}
              {desempeno.herramientas && (
                <Descriptions.Item label="Herramientas a usar">
                  {desempeno.herramientas}
                </Descriptions.Item>
              )}
              {desempeno.responsable_datos && (
                <Descriptions.Item label="¿Quién captura y registra los datos?">
                  {desempeno.responsable_datos}
                </Descriptions.Item>
              )}
              {desempeno.compromiso_sponsor !== undefined && (
                <Descriptions.Item label="¿Se compromete a medir y reportar KPIs?">
                  {desempeno.compromiso_sponsor === true ? 'Sí, me comprometo' :
                   desempeno.compromiso_sponsor === false ? 'No puedo comprometerme' : '--'}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Card>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/gerencia/aprobaciones">
          <Button icon={<ArrowLeftOutlined />}>Volver a Aprobaciones</Button>
        </Link>
        {evaluacion && (
          <Button
            icon={<FilePdfOutlined />}
            loading={pdfLoading}
            onClick={handleDownloadPDF}
          >
            Descargar Evaluación PDF
          </Button>
        )}
      </Space>

      <Card>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>{solicitud.titulo}</Title>
            <Space wrap>
              <Text type="secondary">{solicitud.codigo}</Text>
              <Tag color={estadoColors[solicitud.estado]}>{estadoLabels[solicitud.estado] || solicitud.estado}</Tag>
              <Tag color={prioridadColors[solicitud.prioridad]}>{solicitud.prioridad?.toUpperCase()}</Tag>
              <Tag>{tipoLabels[solicitud.tipo] || solicitud.tipo}</Tag>
            </Space>
          </div>
          {isPending && (
            <Space wrap>
              <Button
                type="primary"
                icon={<ScheduleOutlined />}
                size="large"
                onClick={() => setScheduleModalVisible(true)}
              >
                Aprobar y Agendar
              </Button>
              <Button
                icon={<RedoOutlined />}
                size="large"
                onClick={() => setReevalModalVisible(true)}
              >
                Solicitar Reevaluación
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                size="large"
                onClick={() => setRejectModalVisible(true)}
              >
                Rechazar
              </Button>
            </Space>
          )}
        </div>

        {/* Show if already scheduled */}
        {solicitud.estado === 'agendado' && solicitud.fecha_inicio_programada && (
          <Alert
            message="Proyecto Agendado"
            description={
              <Space direction="vertical">
                <Text>
                  <CalendarOutlined style={{ marginRight: 8 }} />
                  Fecha de inicio: {dayjs(solicitud.fecha_inicio_programada).format('DD/MM/YYYY')}
                </Text>
                <Text>
                  <CalendarOutlined style={{ marginRight: 8 }} />
                  Fecha de fin estimada: {dayjs(solicitud.fecha_fin_programada).format('DD/MM/YYYY')}
                </Text>
              </Space>
            }
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* NT Recommendation Summary if evaluation exists */}
        {evaluacion && (
          <Alert
            message={
              <Space>
                <Text strong>Recomendación NT:</Text>
                <Tag color={recomendacionColors[evaluacion.recomendacion]}>
                  {evaluacion.recomendacion?.toUpperCase()}
                </Tag>
                {evaluacion.fecha_inicio_posible && (
                  <Tag color="blue" icon={<CalendarOutlined />}>
                    Fecha Recomendada: {dayjs(evaluacion.fecha_inicio_posible).format('DD/MM/YYYY')}
                  </Tag>
                )}
              </Space>
            }
            description={
              <Row gutter={[16, 8]}>
                <Col span={24}>
                  <Text>{evaluacion.resumen_ejecutivo?.substring(0, 300)}...</Text>
                </Col>
                <Col xs={12} md={6}>
                  <Text strong>Costo Estimado: </Text>
                  <Text>{formatCOP(totalCostos)}</Text>
                </Col>
                <Col xs={12} md={6}>
                  <Text strong>Duración: </Text>
                  <Text>{tareasForChart.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)} días</Text>
                </Col>
              </Row>
            }
            type={evaluacion.recomendacion === 'aprobar' ? 'success' : evaluacion.recomendacion === 'rechazar' ? 'error' : 'warning'}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Reevaluation history if any */}
        {reevaluaciones.length > 0 && (
          <Alert
            message="Historial de Reevaluaciones"
            description={
              <List
                size="small"
                dataSource={reevaluaciones}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<><Text strong>{item.usuario_nombre}</Text> - {dayjs(item.creado_en).format('DD/MM/YYYY HH:mm')}</>}
                      description={
                        <>
                          <Paragraph style={{ marginBottom: 4 }}>{item.comentario}</Paragraph>
                          {item.areas_revisar?.length > 0 && (
                            <Space wrap>
                              <Text type="secondary">Áreas a revisar:</Text>
                              {item.areas_revisar.map(a => <Tag key={a}>{a}</Tag>)}
                            </Space>
                          )}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            }
            type="warning"
            style={{ marginBottom: 24 }}
          />
        )}

        <Tabs defaultActiveKey="1">
          {/* Tab 1: Solicitud Original - Full Form Data */}
          <Tabs.TabPane tab={<span><FileTextOutlined /> Solicitud Original</span>} key="1">
            {renderSolicitante()}
            {renderSponsor()}
            {renderStakeholders()}
            {renderProblematica()}
            {renderUrgencia()}
            {renderSolucion()}
            {renderBeneficios()}
            {renderDesempeno()}
          </Tabs.TabPane>

          {/* Tab 2: Evaluación NT */}
          <Tabs.TabPane tab={<span><UserOutlined /> Evaluación NT</span>} key="2">
            {evaluacion ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title="Resumen Ejecutivo">
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{evaluacion.resumen_ejecutivo}</Paragraph>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" title="Justificación de Recomendación">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Text strong>Recomendación:</Text>
                        <Tag color={recomendacionColors[evaluacion.recomendacion]} style={{ fontSize: 14 }}>
                          {evaluacion.recomendacion?.toUpperCase()}
                        </Tag>
                        {evaluacion.fecha_inicio_posible && (
                          <Tag color="blue" icon={<CalendarOutlined />}>
                            Fecha Inicio Recomendada: {dayjs(evaluacion.fecha_inicio_posible).format('DD/MM/YYYY')}
                          </Tag>
                        )}
                      </Space>
                      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{evaluacion.justificacion_recomendacion}</Paragraph>
                    </Space>
                  </Card>
                </Col>
                {evaluacion.notas_adicionales && (
                  <Col span={24}>
                    <Card size="small" title="Notas Adicionales">
                      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{evaluacion.notas_adicionales}</Paragraph>
                    </Card>
                  </Col>
                )}
              </Row>
            ) : (
              <Alert
                message="Sin evaluación NT"
                description="Esta solicitud aún no tiene una evaluación completa de Nuevas Tecnologías."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 3: Cronograma - Use WorkloadChart */}
          <Tabs.TabPane tab={<span><ProjectOutlined /> Cronograma</span>} key="3">
            {tareas && tareas.length > 0 ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title={`Cronograma Propuesto`}>
                    {/* Summary */}
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Text strong>Duración Total: </Text>
                        <Tag color="blue">{tareasForChart.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)} días hábiles</Tag>
                      </Col>
                      <Col span={8}>
                        <Text strong>Fases: </Text>
                        <Text>{fases.length}</Text>
                      </Col>
                      <Col span={8}>
                        <Text strong>Tareas: </Text>
                        <Text>{tareas.length}</Text>
                      </Col>
                    </Row>

                    {/* Phase Legend */}
                    {fases.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <Text strong>Fases del proyecto: </Text>
                        {fases.map((fase, i) => (
                          <Tag key={fase} style={{ marginLeft: i === 0 ? 8 : 0 }}>
                            Fase {i + 1}: {fase}
                          </Tag>
                        ))}
                      </div>
                    )}

                    {/* Task Table */}
                    <Table
                      dataSource={tareasForChart.map((t, i) => ({ ...t, key: i }))}
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: 'Fase',
                          dataIndex: 'fase',
                          key: 'fase',
                          width: 120,
                          render: (v) => v || '-'
                        },
                        {
                          title: 'Tarea',
                          dataIndex: 'nombre',
                          key: 'nombre'
                        },
                        {
                          title: 'Asignados',
                          dataIndex: 'asignados_ids',
                          key: 'asignados',
                          render: (ids) => {
                            if (!ids || ids.length === 0) return '-'
                            return ids.map(id => {
                              const user = ntUsers.find(u => u.id === id)
                              return user ? (
                                <Tag key={id}>{user.nombre.split(' ')[0]}</Tag>
                              ) : null
                            })
                          }
                        },
                        {
                          title: 'Días',
                          dataIndex: 'duracion_dias',
                          key: 'duracion_dias',
                          align: 'center',
                          width: 80
                        }
                      ]}
                    />
                  </Card>
                </Col>

                {/* WorkloadChart */}
                {equipoForChart.length > 0 && fases.length > 0 && tareasForChart.length > 0 && (
                  <Col span={24}>
                    <WorkloadChart
                      equipo={equipoForChart}
                      tareas={tareasForChart}
                      liderId={liderId}
                      fases={fases}
                    />
                  </Col>
                )}
              </Row>
            ) : (
              <Alert
                message="Sin cronograma"
                description="No se ha definido un cronograma para esta solicitud."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 4: Costos - NT Estimation + Solicitud Benefits */}
          <Tabs.TabPane tab={<span><DollarOutlined /> Costos</span>} key="4">
            <Row gutter={[24, 24]}>
              {/* NT Cost Estimation */}
              <Col span={24}>
                <Card size="small" title="Estimación de Costos (NT)">
                  {costItems.length > 0 ? (
                    <Table
                      dataSource={costItems.map((item, i) => ({ ...item, key: i }))}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: 'Concepto', dataIndex: 'concepto', key: 'concepto' },
                        {
                          title: 'Subtotal',
                          dataIndex: 'subtotal',
                          key: 'subtotal',
                          render: (v) => formatCOP(v),
                          align: 'right',
                          width: 150
                        },
                        {
                          title: 'IVA',
                          dataIndex: 'iva',
                          key: 'iva',
                          render: (v) => formatCOP(v),
                          align: 'right',
                          width: 150
                        },
                        {
                          title: 'Total',
                          key: 'total',
                          render: (_, r) => formatCOP((r.subtotal || 0) + (r.iva || 0)),
                          align: 'right',
                          width: 150
                        }
                      ]}
                      summary={() => (
                        <Table.Summary.Row style={{ backgroundColor: '#e6f7ff' }}>
                          <Table.Summary.Cell index={0}>
                            <Text strong style={{ fontSize: 14 }}>TOTAL ESTIMADO</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} />
                          <Table.Summary.Cell index={2} />
                          <Table.Summary.Cell index={3} align="right">
                            <Text strong style={{ fontSize: 14, color: '#1890ff' }}>{formatCOP(totalCostos)}</Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                    />
                  ) : (
                    <Alert message="Sin estimación de costos" description="NT no ha definido una estimación de costos." type="info" />
                  )}
                </Card>
              </Col>

              {/* Cost Reduction from Solicitud */}
              {beneficios.reduccion_costos && (
                <Col xs={24} md={12}>
                  <Card size="small" title="Reducción de Costos (Reportado por Solicitante)">
                    <Alert
                      message="El solicitante reporta reducción de costos"
                      type="success"
                      showIcon
                      icon={<CheckCircleOutlined />}
                      style={{ marginBottom: 12 }}
                    />
                    <Row gutter={16}>
                      <Col span={12}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Actuales</Text>
                        {analisisCostos.costos_actuales?.map((item, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <Text>{item.descripcion}: {formatCOP(item.valor || item.monto)}</Text>
                          </div>
                        ))}
                        <Divider style={{ margin: '8px 0' }} />
                        <Text strong>Total: {formatCOP(totalActual)}</Text>
                      </Col>
                      <Col span={12}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Esperados</Text>
                        {analisisCostos.costos_esperados?.map((item, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <Text>{item.descripcion}: {formatCOP(item.valor || item.monto)}</Text>
                          </div>
                        ))}
                        <Divider style={{ margin: '8px 0' }} />
                        <Text strong>Total: {formatCOP(totalEsperado)}</Text>
                      </Col>
                    </Row>
                    <div style={{ marginTop: 12, padding: 12, background: ahorro > 0 ? '#f6ffed' : '#fff1f0', borderRadius: 8, textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 16, color: ahorro > 0 ? '#52c41a' : '#ff4d4f' }}>
                        Ahorro Estimado: {formatCOP(ahorro)}
                      </Text>
                    </div>
                  </Card>
                </Col>
              )}

              {/* Monetary Benefits from Solicitud */}
              {beneficioMonetario.espera_beneficio && (
                <Col xs={24} md={12}>
                  <Card size="small" title="Beneficio Monetario Directo (Reportado por Solicitante)">
                    <Alert
                      message="El solicitante reporta beneficio monetario directo"
                      type="success"
                      showIcon
                      icon={<CheckCircleOutlined />}
                      style={{ marginBottom: 12 }}
                    />
                    {beneficioMonetario.items?.map((item, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <Text>{item.descripcion}: {formatCOP(item.valor || item.monto)}</Text>
                      </div>
                    ))}
                    <Divider style={{ margin: '8px 0' }} />
                    <div style={{ padding: 12, background: '#f6ffed', borderRadius: 8, textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                        Total Beneficio: {formatCOP(totalBeneficioMonetario)}
                      </Text>
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          </Tabs.TabPane>

          {/* Tab 5: Equipo - Show names properly */}
          <Tabs.TabPane tab={<span><TeamOutlined /> Equipo</span>} key="5">
            {equipo.length > 0 || equipoIds.length > 0 ? (
              <Card size="small" title="Equipo Propuesto">
                <List
                  dataSource={equipoIds.map(id => {
                    const user = ntUsers.find(u => u.id === id)
                    const equipoMember = equipo.find(e => e.usuario_id === id)
                    return {
                      id,
                      nombre: user?.nombre || equipoMember?.usuario_nombre || `Usuario ${id}`,
                      email: user?.email || equipoMember?.usuario_email || '',
                      es_lider: equipoMember?.es_lider || id === liderId,
                      rol: equipoMember?.rol || (id === liderId ? 'Líder del Proyecto' : 'Miembro del equipo')
                    }
                  })}
                  renderItem={(miembro) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          miembro.es_lider ? (
                            <CrownOutlined style={{ fontSize: 24, color: '#faad14' }} />
                          ) : (
                            <UserOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                          )
                        }
                        title={
                          <Space>
                            <Text strong>{miembro.nombre}</Text>
                            {miembro.es_lider && <Tag color="gold">Líder del Proyecto</Tag>}
                          </Space>
                        }
                        description={
                          <>
                            <p style={{ margin: 0 }}>{miembro.email}</p>
                            <p style={{ margin: 0, color: '#8c8c8c' }}>{miembro.rol}</p>
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ) : (
              <Alert
                message="Sin equipo asignado"
                description="No se ha definido un equipo para esta solicitud."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 6: Historial */}
          <Tabs.TabPane tab="Historial" key="6">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Fecha de Creación">
                {dayjs(solicitud.creado_en).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Última Actualización">
                {dayjs(solicitud.actualizado_en).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Estado Actual">
                <Tag color={estadoColors[solicitud.estado]}>{estadoLabels[solicitud.estado] || solicitud.estado}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider>Comentarios</Divider>
            {comentarios && comentarios.length > 0 ? (
              <Timeline>
                {comentarios.map(c => (
                  <Timeline.Item key={c.id}>
                    <Text strong>{c.autor_nombre}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
                    </Text>
                    {c.tipo === 'cambio_estado' && <Tag color="purple" style={{ marginLeft: 8 }}>Cambio de Estado</Tag>}
                    {c.tipo === 'reevaluacion' && <Tag color="orange" style={{ marginLeft: 8 }}>Reevaluación</Tag>}
                    {c.tipo === 'agendamiento' && <Tag color="green" style={{ marginLeft: 8 }}>Agendamiento</Tag>}
                    {c.tipo === 'interno' && <Tag color="blue" style={{ marginLeft: 8 }}>Interno NT</Tag>}
                    {c.tipo === 'publico' && <Tag color="cyan" style={{ marginLeft: 8 }}>Público</Tag>}
                    <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{c.contenido}</Paragraph>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Text type="secondary">Sin comentarios</Text>
            )}
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* Scheduling Calendar Modal */}
      <SchedulingCalendar
        visible={scheduleModalVisible}
        onClose={() => setScheduleModalVisible(false)}
        solicitud={data?.solicitud}
        evaluacion={evaluacion}
        onSchedule={() => {
          setScheduleModalVisible(false)
          loadSolicitud()
        }}
      />

      {/* Reevaluation Modal */}
      <Modal
        title={<><RedoOutlined /> Solicitar Reevaluación</>}
        open={reevalModalVisible}
        onOk={handleReevaluation}
        onCancel={() => setReevalModalVisible(false)}
        okText="Solicitar Reevaluación"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
        width={600}
      >
        <Alert
          message="Solicitar Ajustes"
          description="NT revisará y ajustará la evaluación según sus indicaciones. La solicitud volverá a ser enviada para su aprobación."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Áreas a Revisar</Text>
          <div style={{ marginTop: 8 }}>
            <Checkbox.Group
              options={areasRevisarOptions}
              value={reevalData.areas_revisar}
              onChange={(values) => setReevalData({ ...reevalData, areas_revisar: values })}
            />
          </div>
        </div>

        <div>
          <Text strong>Comentarios / Indicaciones *</Text>
          <TextArea
            value={reevalData.comentario}
            onChange={(e) => setReevalData({ ...reevalData, comentario: e.target.value })}
            placeholder="Detalle qué aspectos deben ser revisados o ajustados..."
            rows={4}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Rechazar Proyecto"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => setRejectModalVisible(false)}
        okText="Rechazar"
        okButtonProps={{ danger: true }}
        cancelText="Cancelar"
        confirmLoading={actionLoading}
      >
        <Alert
          message={<span><ExclamationCircleOutlined /> Confirmar Rechazo</span>}
          description="Esta acción notificará al solicitante y a NT sobre el rechazo del proyecto."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Tipo de Rechazo</Text>
          <Select
            value={rejectData.tipo}
            onChange={(v) => setRejectData({ ...rejectData, tipo: v })}
            style={{ width: '100%', marginTop: 8 }}
          >
            <Select.Option value="ajustable">
              Rechazado - Puede ajustar y reenviar
            </Select.Option>
            <Select.Option value="definitivo">
              Rechazado - Definitivo
            </Select.Option>
          </Select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong>Razón del Rechazo *</Text>
          <TextArea
            value={rejectData.razon}
            onChange={(e) => setRejectData({ ...rejectData, razon: e.target.value })}
            placeholder="Explique la razón del rechazo..."
            rows={4}
            style={{ marginTop: 8 }}
          />
        </div>

        <div>
          <Text strong>Recomendaciones (opcional)</Text>
          <TextArea
            value={rejectData.recomendaciones}
            onChange={(e) => setRejectData({ ...rejectData, recomendaciones: e.target.value })}
            placeholder="Sugerencias para el solicitante..."
            rows={3}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  )
}

export default GerenciaAprobacionDetail
