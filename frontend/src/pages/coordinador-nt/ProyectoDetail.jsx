import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Progress, Modal, Form, Input, Table, Alert, Collapse,
  Timeline, message, Row, Col, Tooltip, Upload, List
} from 'antd'
import {
  ArrowLeftOutlined, PauseCircleOutlined, CloseCircleOutlined,
  CheckCircleOutlined, CalendarOutlined, TeamOutlined,
  ExclamationCircleOutlined, HistoryOutlined,
  DollarOutlined, AuditOutlined, FileOutlined, UploadOutlined,
  FileTextOutlined, UserOutlined, AlertOutlined, ClockCircleOutlined,
  ToolOutlined, TrophyOutlined, LineChartOutlined
} from '@ant-design/icons'
import { proyectosApi, archivosApi, solicitudesApi, evaluacionesApi, calendarioApi } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import GanttChart from '../../components/GanttChart'
import SchedulingCalendar from '../../components/SchedulingCalendar'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Panel } = Collapse

const INEMEC_RED = '#D52B1E'

const estadoColors = {
  planificacion: 'default',
  agendado: 'blue',
  en_desarrollo: 'processing',
  pausado: 'warning',
  completado: 'success',
  en_implementacion: 'cyan',
  solucionado: 'green',
  cancelado: 'error',
  cancelado_coordinador: 'error',
  cancelado_gerencia: 'error'
}

const estadoLabels = {
  planificacion: 'Planificacion',
  agendado: 'Agendado',
  en_desarrollo: 'En Desarrollo',
  pausado: 'Pausado',
  completado: 'Completado',
  en_implementacion: 'En Implementación',
  solucionado: 'Solucionado',
  cancelado: 'Cancelado',
  cancelado_coordinador: 'Cancelado (Coord. NT)',
  cancelado_gerencia: 'Cancelado (Gerencia)'
}

const prioridadColors = { critica: 'red', alta: 'orange', media: 'blue', baja: 'green' }

const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Nuevo (Interno)', proyecto_nuevo_externo: 'Proyecto Nuevo (Externo)',
  actualizacion: 'Actualización', reporte_fallo: 'Reporte de Fallo', cierre_servicio: 'Cierre de Servicio'
}
const areaLabels = {
  gerencia_general: 'Gerencia General', operaciones: 'Operaciones',
  operaciones_planta: 'Operaciones > Planta', operaciones_campo: 'Operaciones > Campo',
  operaciones_taller: 'Operaciones > Taller', administracion: 'Administración',
  nuevas_tecnologias: 'Nuevas Tecnologías', ti: 'Tecnología de la Información',
  rrhh: 'Recursos Humanos', hse: 'HSE', calidad: 'Calidad', compras: 'Compras',
  contabilidad: 'Contabilidad', mantenimiento: 'Mantenimiento', logistica: 'Logística',
  comercial: 'Comercial', juridico: 'Jurídico', proyectos: 'Proyectos'
}
const operacionContratoLabels = {
  oficina_principal: 'Oficina Principal', planta_barranca: 'Planta Barrancabermeja',
  planta_cartagena: 'Planta Cartagena', contrato_ecopetrol: 'Contrato Ecopetrol',
  contrato_oxy: 'Contrato OXY', contrato_gran_tierra: 'Contrato Gran Tierra',
  contrato_parex: 'Contrato Parex', contrato_frontera: 'Contrato Frontera Energy', otro: 'Otro'
}
const tipoSolucionLabels = {
  aplicacion_web: 'Aplicación Web', aplicacion_movil: 'Aplicación Móvil',
  automatizacion: 'Automatización de Proceso', integracion: 'Integración de Sistemas',
  reporte_dashboard: 'Reporte/Dashboard', otro: 'Otro'
}
const formaEntregaLabels = {
  web: 'Aplicación Web', movil: 'Aplicación Móvil', escritorio: 'Aplicación de Escritorio',
  reporte: 'Reporte Periódico', dashboard: 'Dashboard en Tiempo Real', api: 'API/Servicio'
}
const recomendacionColors = { aprobar: 'success', rechazar: 'error', aplazar: 'warning' }
const solEstadoColors = {
  pendiente_evaluacion_nt: 'warning', en_estudio: 'processing', descartado_nt: 'error',
  pendiente_aprobacion_gerencia: 'processing', pendiente_reevaluacion: 'orange',
  rechazado_gerencia: 'error', aprobado: 'success', agendado: 'purple',
  en_desarrollo: 'cyan', stand_by: 'orange', completado: 'green', solucionado: 'green', cancelado: 'default'
}
const getLabel = (value, labels) => labels[value] || value || '--'
const formatCOP = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$0'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}

const cambioLabels = {
  tarea_agregada: 'Tarea agregada',
  tarea_eliminada: 'Tarea eliminada',
  tarea_fecha_modificada: 'Fecha de tarea modificada',
  tarea_duracion_modificada: 'Duracion de tarea modificada',
  miembro_agregado: 'Miembro agregado',
  miembro_eliminado: 'Miembro eliminado',
  cambio_lider: 'Cambio de lider'
}

function CoordinadorNTProyectoDetail() {
  const { codigo } = useParams()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [proyecto, setProyecto] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [tareas, setTareas] = useState([])
  const [comentarios, setComentarios] = useState([])
  const [costos, setCostos] = useState([])
  const [cambiosEmergentes, setCambiosEmergentes] = useState([])
  const [pausas, setPausas] = useState([])
  const [pausaActiva, setPausaActiva] = useState(null)
  const [estimacion, setEstimacion] = useState(null)
  const [implementacionTareas, setImplementacionTareas] = useState([])
  const [holidays, setHolidays] = useState([])
  const [solicitudOriginal, setSolicitudOriginal] = useState(null)
  const [evaluacionOriginal, setEvaluacionOriginal] = useState(null)

  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [commentFiles, setCommentFiles] = useState([])
  const [cancelForm] = Form.useForm()
  const [comment, setComment] = useState('')

  // Reprogramacion state
  const [reprogramacion, setReprogramacion] = useState(null)
  const [rescheduleCalendarVisible, setRescheduleCalendarVisible] = useState(false)
  const [rescheduleComentario, setRescheduleComentario] = useState('')
  const [rescheduleRejectVisible, setRescheduleRejectVisible] = useState(false)
  const [rescheduleApproveComentario, setRescheduleApproveComentario] = useState('')
  const [rescheduleApproveModalVisible, setRescheduleApproveModalVisible] = useState(false)
  const [rescheduleDates, setRescheduleDates] = useState(null)

  useEffect(() => { loadData(); loadHolidays(); loadReprogramacion() }, [codigo])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await proyectosApi.get(codigo)
      const d = res.data
      setProyecto(d.proyecto)
      setMiembros(d.miembros || [])
      setTareas(d.tareas || [])
      setComentarios(d.comentarios || [])
      setCostos(d.costos || [])
      setCambiosEmergentes(d.cambios_emergentes || [])
      setPausas(d.pausas || [])
      setPausaActiva(d.pausa_activa || null)
      setEstimacion(d.estimacion || null)
      setImplementacionTareas(d.implementacion_tareas || [])

      if (d.proyecto?.solicitud_id && d.proyecto?.solicitud_codigo) {
        try {
          const [solRes, evalRes] = await Promise.all([
            solicitudesApi.get(d.proyecto.solicitud_codigo).catch(() => null),
            evaluacionesApi.getBySolicitud(d.proyecto.solicitud_id).catch(() => null)
          ])
          setSolicitudOriginal(solRes?.data || null)
          setEvaluacionOriginal(evalRes?.data?.evaluacion || null)
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Error loading project:', error)
      message.error('Error al cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  const loadHolidays = async () => {
    try {
      const year = new Date().getFullYear()
      const [r1, r2] = await Promise.all([
        proyectosApi.getHolidays(year),
        proyectosApi.getHolidays(year + 1)
      ])
      setHolidays([...r1.data.holidays, ...r2.data.holidays])
    } catch { /* ignore */ }
  }

  const loadReprogramacion = async () => {
    try {
      const res = await proyectosApi.getReprogramacion(codigo)
      setReprogramacion(res.data.reprogramacion || null)
    } catch { /* ignore */ }
  }

  const isPaused = proyecto?.estado === 'pausado'
  const isActive = proyecto?.estado === 'en_desarrollo'
  const isImplementacion = proyecto?.estado === 'en_implementacion'
  const isSolucionado = proyecto?.estado === 'solucionado'
  const isCancelled = ['cancelado', 'cancelado_coordinador', 'cancelado_gerencia'].includes(proyecto?.estado)
  const isFinished = ['completado', 'solucionado', 'cancelado', 'cancelado_coordinador', 'cancelado_gerencia'].includes(proyecto?.estado) || isImplementacion
  const canCancel = !isFinished && (isActive || isPaused)

  // Reprogramacion handlers
  const handleRescheduleApproveConfirmDates = (dates) => {
    setRescheduleDates(dates)
    setRescheduleCalendarVisible(false)
    setRescheduleApproveModalVisible(true)
  }

  const handleApproveReprogramacion = async () => {
    if (!reprogramacion) return
    setActionLoading(true)
    try {
      await proyectosApi.aprobarReprogramacionCoord(codigo, reprogramacion.id, {
        accion: 'aprobar',
        comentario: rescheduleApproveComentario || null,
        fecha_inicio: rescheduleDates?.fecha_inicio,
        fecha_fin: rescheduleDates?.fecha_fin
      })
      message.success('Reprogramación aprobada')
      setRescheduleApproveModalVisible(false)
      setRescheduleApproveComentario('')
      setRescheduleDates(null)
      loadReprogramacion()
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al aprobar reprogramación')
    } finally { setActionLoading(false) }
  }

  const handleRejectReprogramacion = async () => {
    if (!reprogramacion || !rescheduleComentario.trim()) return
    setActionLoading(true)
    try {
      await proyectosApi.aprobarReprogramacionCoord(codigo, reprogramacion.id, {
        accion: 'rechazar',
        comentario: rescheduleComentario
      })
      message.success('Reprogramación rechazada')
      setRescheduleRejectVisible(false)
      setRescheduleComentario('')
      loadReprogramacion()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al rechazar reprogramación')
    } finally { setActionLoading(false) }
  }

  const handleCancelar = async () => {
    try {
      const values = await cancelForm.validateFields()
      setActionLoading(true)
      await proyectosApi.cancelarCoordinador(codigo, { motivo: values.motivo })
      message.success('Proyecto cancelado')
      setCancelModalVisible(false)
      cancelForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al cancelar proyecto')
    } finally { setActionLoading(false) }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    try {
      const files = commentFiles.map(f => f.originFileObj || f)
      await proyectosApi.addComment(codigo, { contenido: comment, tipo: 'comentario' }, files)
      message.success('Comentario agregado')
      setComment('')
      setCommentFiles([])
      loadData()
    } catch { message.error('Error al agregar comentario') }
  }

  const renderSolicitudOriginal = () => {
    if (!solicitudOriginal?.solicitud) return null
    const sol = solicitudOriginal.solicitud
    const solComentarios = solicitudOriginal.comentarios || []
    const identificacion = sol.datos_solicitante || sol.identificacion || {}
    const sponsor = sol.datos_patrocinador || sol.sponsor || {}
    const stakeholders = sol.stakeholders || {}
    const problematica = sol.descripcion_problema || sol.problematica || {}
    const urgencia = sol.urgencia || {}
    const solucion = sol.solucion_propuesta || sol.solucion || {}
    const beneficios = sol.beneficios || {}
    const declaracion = sol.declaracion || {}
    const kpis = sol.kpis || declaracion.indicadores || []
    const analisisCostos = beneficios.analisis_costos || {}
    const beneficioMonetario = beneficios.beneficio_monetario || {}
    const totalActual = (analisisCostos.costos_actuales || []).reduce((sum, item) => sum + ((item.cantidad || 1) * (item.valor || item.monto || 0)), 0)
    const totalEsperado = (analisisCostos.costos_esperados || []).reduce((sum, item) => sum + ((item.cantidad || 1) * (item.valor || item.monto || 0)), 0)
    const ahorro = totalActual - totalEsperado
    const totalBeneficioMonetario = (beneficioMonetario.items || []).reduce((sum, item) => sum + ((item.cantidad || 1) * (item.valor || item.monto || 0)), 0)

    return (
      <Collapse ghost style={{ marginBottom: 24 }}>
        <Panel header={<Space><FileTextOutlined /> <Text strong>Solicitud Original</Text> <Tag>{sol.codigo}</Tag></Space>} key="solicitud-original">
          <Descriptions bordered column={{ xs: 1, sm: 4 }} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Código">{sol.codigo}</Descriptions.Item>
            <Descriptions.Item label="Tipo">{tipoLabels[sol.tipo] || sol.tipo}</Descriptions.Item>
            <Descriptions.Item label="Prioridad"><Tag color={prioridadColors[sol.prioridad]}>{sol.prioridad}</Tag></Descriptions.Item>
            <Descriptions.Item label="Creada">{dayjs(sol.creado_en).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>
          <Card title={<><UserOutlined /> Datos del Solicitante</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Nombre">{identificacion.nombre_completo || identificacion.nombre || '--'}</Descriptions.Item>
              <Descriptions.Item label="Cargo">{identificacion.cargo || '--'}</Descriptions.Item>
              <Descriptions.Item label="Área">{getLabel(identificacion.area || identificacion.departamento, areaLabels)}</Descriptions.Item>
              <Descriptions.Item label="Operación/Contrato">{getLabel(identificacion.operacion_contrato, operacionContratoLabels)}</Descriptions.Item>
              <Descriptions.Item label="Correo">{identificacion.correo || identificacion.email || '--'}</Descriptions.Item>
              <Descriptions.Item label="Teléfono">{identificacion.telefono || '--'}</Descriptions.Item>
            </Descriptions>
          </Card>
          {identificacion.es_doliente === false && (sponsor.nombre_completo || sponsor.nombre) && (
            <Card title={<><UserOutlined /> Datos del Patrocinador (Sponsor)</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Nombre">{sponsor.nombre_completo || sponsor.nombre || '--'}</Descriptions.Item>
                <Descriptions.Item label="Cargo">{sponsor.cargo || '--'}</Descriptions.Item>
                <Descriptions.Item label="Área">{getLabel(sponsor.area || sponsor.departamento, areaLabels)}</Descriptions.Item>
                <Descriptions.Item label="Correo">{sponsor.correo || sponsor.email || '--'}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
          {(stakeholders.internas?.areas?.length > 0 || stakeholders.internas?.personas?.length > 0) && (
            <Card title={<><TeamOutlined /> Partes Interesadas</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Áreas Interesadas">{stakeholders.internas?.areas?.length > 0 ? stakeholders.internas.areas.map((a, i) => <Tag key={i}>{a}</Tag>) : '--'}</Descriptions.Item>
                <Descriptions.Item label="Personas Clave">{stakeholders.internas?.personas?.length > 0 ? stakeholders.internas.personas.map((p, i) => <Tag key={i}>{p}</Tag>) : '--'}</Descriptions.Item>
                {stakeholders.aplica_externas && (<>
                  <Descriptions.Item label="Sectores Comerciales">{stakeholders.externas?.sectores?.length > 0 ? stakeholders.externas.sectores.map((s, i) => <Tag key={i}>{s}</Tag>) : '--'}</Descriptions.Item>
                  <Descriptions.Item label="Empresas">{stakeholders.externas?.empresas?.length > 0 ? stakeholders.externas.empresas.map((e, i) => <Tag key={i}>{e}</Tag>) : '--'}</Descriptions.Item>
                </>)}
              </Descriptions>
            </Card>
          )}
          <Card title={<><AlertOutlined /> Descripción de la Problemática</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Título">{problematica.titulo || sol.titulo || '--'}</Descriptions.Item>
              <Descriptions.Item label="Situación Actual"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.situacion_actual || problematica.problema_actual || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Origen">{problematica.origen || '--'}</Descriptions.Item>
              <Descriptions.Item label="Afectación"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.afectacion_operacion || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Procesos Comprometidos"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.procesos_comprometidos || '--'}</span></Descriptions.Item>
              {problematica.impacto_nivel && (
                <Descriptions.Item label="Impacto"><Tag color={problematica.impacto_nivel === 'critico' ? 'red' : problematica.impacto_nivel === 'alto' ? 'orange' : problematica.impacto_nivel === 'medio' ? 'cyan' : 'green'}>{problematica.impacto_nivel.toUpperCase()}</Tag></Descriptions.Item>
              )}
            </Descriptions>
          </Card>
          {(urgencia.necesidad_principal || urgencia.nivel) && (
            <Card title={<><ClockCircleOutlined /> Necesidad y Urgencia</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Necesidad Principal"><span style={{ whiteSpace: 'pre-wrap' }}>{urgencia.necesidad_principal || '--'}</span></Descriptions.Item>
                {urgencia.nivel && (<Descriptions.Item label="Nivel de Urgencia"><Tag color={urgencia.nivel === 'inmediata' ? 'red' : urgencia.nivel === 'corto_plazo' ? 'orange' : urgencia.nivel === 'mediano_plazo' ? 'cyan' : 'green'}>{urgencia.nivel.replace(/_/g, ' ').toUpperCase()}</Tag></Descriptions.Item>)}
                {urgencia.fecha_limite && <Descriptions.Item label="Fecha Límite">{dayjs(urgencia.fecha_limite).format('DD/MM/YYYY')}</Descriptions.Item>}
                <Descriptions.Item label="¿Por qué NT?"><span style={{ whiteSpace: 'pre-wrap' }}>{urgencia.justificacion_nt || urgencia.justificacion || '--'}</span></Descriptions.Item>
              </Descriptions>
            </Card>
          )}
          <Card title={<><ToolOutlined /> Propuesta de Solución</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Tipo de Solución">{(solucion.tipo || solucion.tipo_solucion) ? <>{getLabel(solucion.tipo || solucion.tipo_solucion, tipoSolucionLabels)}{(solucion.tipo_descripcion || solucion.tipo_solucion_otro) && ` - ${solucion.tipo_descripcion || solucion.tipo_solucion_otro}`}</> : '--'}</Descriptions.Item>
              <Descriptions.Item label="Solución Ideal"><span style={{ whiteSpace: 'pre-wrap' }}>{solucion.descripcion_ideal || solucion.solucion_ideal || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Casos de Uso"><span style={{ whiteSpace: 'pre-wrap' }}>{solucion.casos_uso || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Usuarios Finales">{solucion.usuarios_finales?.length > 0 ? solucion.usuarios_finales.map((u, i) => <Tag key={i}>{u}</Tag>) : '--'}</Descriptions.Item>
              <Descriptions.Item label="Funcionalidades Mínimas">{solucion.funcionalidades_minimas?.length > 0 ? <List size="small" dataSource={solucion.funcionalidades_minimas} renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>} /> : '--'}</Descriptions.Item>
              <Descriptions.Item label="Funcionalidades Deseables">{solucion.funcionalidades_deseables?.length > 0 ? <List size="small" dataSource={solucion.funcionalidades_deseables} renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>} /> : '--'}</Descriptions.Item>
              <Descriptions.Item label="Forma de Entrega">{getLabel(solucion.forma_entrega, formaEntregaLabels)}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title={<><TrophyOutlined /> Beneficios Esperados</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Descripción"><span style={{ whiteSpace: 'pre-wrap' }}>{beneficios.descripcion || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Mejora Concreta"><span style={{ whiteSpace: 'pre-wrap' }}>{beneficios.mejora_concreta || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Procesos a Optimizar">{beneficios.procesos_optimizados?.length > 0 ? beneficios.procesos_optimizados.map((p, i) => <Tag key={i}>{p}</Tag>) : '--'}</Descriptions.Item>
              <Descriptions.Item label="¿Reducción de Costos?">{beneficios.reduccion_costos === true ? 'Sí' : beneficios.reduccion_costos === false ? 'No' : '--'}</Descriptions.Item>
            </Descriptions>
            {beneficios.reduccion_costos && (
              <div style={{ marginTop: 16, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Análisis de Costos</Text>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Actuales</Text>
                    {analisisCostos.costos_actuales?.length > 0 ? (<List size="small" dataSource={analisisCostos.costos_actuales} renderItem={(item, i) => (<List.Item key={i} style={{ padding: '4px 0' }}><Text>{item.descripcion}</Text><Text style={{ marginLeft: 8 }}>{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}</Text></List.Item>)} footer={<Text strong>Total: {formatCOP(totalActual)}</Text>} />) : '--'}
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Esperados</Text>
                    {analisisCostos.costos_esperados?.length > 0 ? (<List size="small" dataSource={analisisCostos.costos_esperados} renderItem={(item, i) => (<List.Item key={i} style={{ padding: '4px 0' }}><Text>{item.descripcion}</Text><Text style={{ marginLeft: 8 }}>{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}</Text></List.Item>)} footer={<Text strong>Total: {formatCOP(totalEsperado)}</Text>} />) : '--'}
                  </Col>
                </Row>
                <div style={{ marginTop: 12, padding: 12, background: ahorro > 0 ? '#f6ffed' : '#fff1f0', borderRadius: 8, textAlign: 'center' }}>
                  <Text strong style={{ fontSize: 16, color: ahorro > 0 ? '#52c41a' : '#ff4d4f' }}>Ahorro Estimado: {formatCOP(ahorro)}</Text>
                </div>
              </div>
            )}
            {beneficioMonetario.espera_beneficio && (
              <div style={{ marginTop: 16, padding: 16, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Beneficio Monetario</Text>
                {beneficioMonetario.items?.length > 0 ? (<List size="small" dataSource={beneficioMonetario.items} renderItem={(item, i) => (<List.Item key={i}><Text>{item.descripcion}</Text><Text style={{ marginLeft: 8 }}>{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}</Text></List.Item>)} />) : '--'}
                <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 8, textAlign: 'center', border: '1px solid #52c41a' }}>
                  <Text strong style={{ fontSize: 16, color: '#52c41a' }}>Total: {formatCOP(totalBeneficioMonetario)}</Text>
                </div>
              </div>
            )}
          </Card>
          <Card title={<><LineChartOutlined /> Control de Desempeño (KPIs)</>} size="small" style={{ marginBottom: 16 }}>
            {kpis.length > 0 ? (<List size="small" dataSource={kpis} renderItem={(kpi) => (<List.Item><Descriptions size="small" column={{ xs: 1, sm: 4 }}><Descriptions.Item label="Indicador">{kpi.nombre || kpi.indicador || '--'}</Descriptions.Item><Descriptions.Item label="Valor Actual">{kpi.valor_actual || '--'}</Descriptions.Item><Descriptions.Item label="Objetivo">{kpi.valor_objetivo || '--'}</Descriptions.Item><Descriptions.Item label="Unidad">{kpi.unidad || '--'}</Descriptions.Item></Descriptions></List.Item>)} />) : <Text type="secondary">Sin indicadores definidos</Text>}
          </Card>
          {evaluacionOriginal && (
            <Card title={<><CheckCircleOutlined /> Evaluación NT</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Resumen Ejecutivo"><span style={{ whiteSpace: 'pre-wrap' }}>{evaluacionOriginal.resumen_ejecutivo || '--'}</span></Descriptions.Item>
                <Descriptions.Item label="Recomendación"><Tag color={recomendacionColors[evaluacionOriginal.recomendacion]}>{evaluacionOriginal.recomendacion?.toUpperCase() || '--'}</Tag></Descriptions.Item>
                <Descriptions.Item label="Justificación" span={2}><span style={{ whiteSpace: 'pre-wrap' }}>{evaluacionOriginal.justificacion || '--'}</span></Descriptions.Item>
                {evaluacionOriginal.fecha_inicio_posible && (<Descriptions.Item label="Fecha Inicio Posible">{dayjs(evaluacionOriginal.fecha_inicio_posible).format('DD/MM/YYYY')}</Descriptions.Item>)}
              </Descriptions>
            </Card>
          )}
          {solComentarios.length > 0 && (<>
            <Divider orientation="left" style={{ marginTop: 16 }}>Comentarios de la Solicitud</Divider>
            <Timeline>{solComentarios.map(c => (<Timeline.Item key={c.id}><Text strong>{c.autor_nombre}</Text><Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}</Text>{c.tipo && c.tipo !== 'comentario' && <Tag style={{ marginLeft: 8 }}>{c.tipo}</Tag>}<Paragraph style={{ margin: '4px 0' }}>{c.contenido}</Paragraph></Timeline.Item>))}</Timeline>
          </>)}
        </Panel>
      </Collapse>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!proyecto) return <Card><Title level={4}>Proyecto no encontrado</Title></Card>

  const lider = miembros.find(m => m.es_lider)
  const totalCostosActual = costos.reduce((sum, c) => sum + parseFloat(c.total || 0), 0)
  const totalEstimado = estimacion?.total_estimado ? parseFloat(estimacion.total_estimado) : null
  const tareasCompletadas = tareas.filter(t => t.progreso === 100).length
  const diasEmergentes = tareas.filter(t => t.es_emergente).reduce((s, t) => s + (t.duracion_dias || 0), 0)

  return (
    <div style={{ padding: 24 }}>
      <Link to="/coordinador-nt/proyectos">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Volver a Proyectos</Button>
      </Link>

      {isPaused && pausaActiva && (
        <Alert
          type="warning" showIcon icon={<PauseCircleOutlined />}
          message="Proyecto Pausado"
          description={
            <div>
              <div><strong>Motivo:</strong> {pausaActiva.motivo}</div>
              <div><strong>Desde:</strong> {dayjs(pausaActiva.fecha_inicio).format('DD/MM/YYYY HH:mm')}</div>
              <div><strong>Dias habiles pausado:</strong> {pausaActiva.dias_transcurridos}</div>
              {pausaActiva.fecha_estimada_reanudacion && (
                <div><strong>Reanudacion estimada:</strong> {dayjs(pausaActiva.fecha_estimada_reanudacion).format('DD/MM/YYYY')}</div>
              )}
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Space>
              <Title level={3} style={{ margin: 0, color: INEMEC_RED }}>{proyecto.codigo}</Title>
              <Tag color={estadoColors[proyecto.estado]}>{estadoLabels[proyecto.estado] || proyecto.estado}</Tag>
              <Tag color={prioridadColors[proyecto.prioridad]}>{proyecto.prioridad}</Tag>
            </Space>
            <Title level={4} style={{ margin: '8px 0' }}>{proyecto.titulo}</Title>
            {lider && (
              <Text type="secondary"><TeamOutlined style={{ marginRight: 4 }} />Lider: {lider.nombre}</Text>
            )}
          </div>
          {canCancel && (
            <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModalVisible(true)}>
              Cancelar Proyecto
            </Button>
          )}
        </div>

        {/* Reprogramacion pending for coordinator action */}
        {reprogramacion?.estado === 'pendiente_coordinador' && (
          <Card size="small" style={{ marginBottom: 16, borderColor: '#fa8c16' }}>
            <Alert type="warning" showIcon
              message="Solicitud de Reprogramación Pendiente"
              description={
                <Space direction="vertical" size={4}>
                  <Text>Solicitado por: <Text strong>{reprogramacion.solicitante_nombre}</Text></Text>
                  <Text>Motivo: {reprogramacion.motivo}</Text>
                  <Text>Fechas propuestas: {dayjs(reprogramacion.fecha_inicio_propuesta).format('DD/MM/YYYY')} - {dayjs(reprogramacion.fecha_fin_propuesta).format('DD/MM/YYYY')}</Text>
                </Space>
              }
              style={{ marginBottom: 12 }}
            />
            <Space>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setRescheduleCalendarVisible(true)}>
                Aprobar
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => setRescheduleRejectVisible(true)}>
                Rechazar
              </Button>
            </Space>
          </Card>
        )}
        {reprogramacion?.estado === 'pendiente_gerencia' && (
          <Alert style={{ marginBottom: 16 }} type="info" showIcon
            message="Reprogramación aprobada por Coordinador NT, pendiente de Gerencia"
            description={`Fechas aprobadas: ${dayjs(reprogramacion.fecha_inicio_coordinador).format('DD/MM/YYYY')} - ${dayjs(reprogramacion.fecha_fin_coordinador).format('DD/MM/YYYY')}`}
          />
        )}
        {reprogramacion?.estado === 'aprobada' && (
          <Alert style={{ marginBottom: 16 }} type="success" showIcon
            message="Reprogramación aprobada"
            description={`Nuevas fechas: ${dayjs(reprogramacion.fecha_inicio_gerencia).format('DD/MM/YYYY')} - ${dayjs(reprogramacion.fecha_fin_gerencia).format('DD/MM/YYYY')}`}
          />
        )}
        {reprogramacion && ['rechazada_coordinador', 'rechazada_gerencia'].includes(reprogramacion.estado) && (
          <Alert style={{ marginBottom: 16 }} type="error" showIcon
            message={`Reprogramación rechazada por ${reprogramacion.estado === 'rechazada_coordinador' ? 'Coordinador NT' : 'Gerencia'}`}
            description={reprogramacion.comentario_coordinador || reprogramacion.comentario_gerencia || ''}
          />
        )}

        {/* Progress */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="Progreso del Proyecto">
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={proyecto.progreso_teorico || 0} strokeColor="#8c8c8c" size={100} />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Teorico</Text>
                      <Tooltip title="Dias habiles en desarrollo / Dias habiles planificados (excluyendo pausas)">
                        <ExclamationCircleOutlined style={{ marginLeft: 4, cursor: 'help' }} />
                      </Tooltip>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={proyecto.progreso_practico || 0} strokeColor={INEMEC_RED} size={100} />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Practico</Text>
                      <Tooltip title="Promedio ponderado del progreso de tareas (por duracion)">
                        <ExclamationCircleOutlined style={{ marginLeft: 4, cursor: 'help' }} />
                      </Tooltip>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Informacion">
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<><CalendarOutlined /> Fecha Inicio</>}>
                  {proyecto.fecha_inicio_estimada ? dayjs(proyecto.fecha_inicio_estimada).format('DD/MM/YYYY') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<><CalendarOutlined /> Fecha Fin</>}>
                  {proyecto.fecha_fin_estimada ? dayjs(proyecto.fecha_fin_estimada).format('DD/MM/YYYY') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Tareas Completadas">
                  {tareasCompletadas} / {tareas.length}
                </Descriptions.Item>
                <Descriptions.Item label="Dias por Tareas Emergentes">
                  {diasEmergentes} dias
                </Descriptions.Item>
                <Descriptions.Item label="Dias Pausados">
                  {proyecto.dias_pausados_total || 0} dias
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Solicitud Original */}
        {renderSolicitudOriginal()}

        {/* Gantt Chart (read-only) */}
        <Divider orientation="left"><CalendarOutlined /> Cronograma</Divider>
        <GanttChart
          tareas={tareas}
          disabled={true}
          isLead={false}
          userId={user?.id}
          holidays={holidays}
          members={[]}
        />

        {/* Implementation Tasks (read-only) */}
        {(isImplementacion || isSolucionado) && implementacionTareas.length > 0 && (
          <>
            <Divider orientation="left">
              <ToolOutlined /> Plan de Implementación
              <Tag color={isSolucionado ? 'green' : 'cyan'} style={{ marginLeft: 8 }}>
                {implementacionTareas.filter(t => t.completada).length}/{implementacionTareas.length} completadas
              </Tag>
            </Divider>
            <GanttChart
              tareas={implementacionTareas.map(t => ({ ...t, titulo: t.titulo }))}
              disabled={true}
              isLead={false}
              userId={user?.id}
              holidays={holidays}
              members={[]}
            />
          </>
        )}

        {/* Team (read-only) */}
        <Divider orientation="left"><TeamOutlined /> Equipo</Divider>
        <Table
          dataSource={miembros}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: 'Nombre', dataIndex: 'nombre',
              render: (text, r) => (
                <Space>
                  {text}
                  {r.es_lider && <Tag color="gold">Lider</Tag>}
                  {r.es_original ? <Tag color="blue">Original</Tag> : <Tag color="volcano">Agregado</Tag>}
                </Space>
              )
            },
            { title: 'Rol', dataIndex: 'rol_proyecto', width: 120 },
            {
              title: 'Horas Est.', width: 90,
              render: (_, r) => {
                const memberTasks = tareas.filter(t => t.asignado_id === r.usuario_id)
                const dias = memberTasks.reduce((s, t) => s + (t.duracion_dias || 0), 0)
                return dias > 0 ? `${dias * 8}h` : '-'
              }
            }
          ]}
        />

        {/* Costs (read-only) */}
        <Divider orientation="left"><DollarOutlined /> Costos</Divider>
        {(costos.length > 0 || totalEstimado) && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {totalEstimado && (
              <Col span={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>Costo Planificado</Text>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    ${totalEstimado.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                  </div>
                </Card>
              </Col>
            )}
            <Col span={totalEstimado ? 8 : 12}>
              <Card size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>Costo Real</Text>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  ${totalCostosActual.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                </div>
              </Card>
            </Col>
            {totalEstimado && (
              <Col span={8}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>Diferencia</Text>
                  <div style={{
                    fontSize: 20, fontWeight: 600,
                    color: totalCostosActual > totalEstimado ? '#ff4d4f' : '#52c41a'
                  }}>
                    {totalCostosActual > totalEstimado ? '+' : ''}
                    ${(totalCostosActual - totalEstimado).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                  </div>
                </Card>
              </Col>
            )}
          </Row>
        )}

        <Table
          dataSource={costos}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Sin costos registrados' }}
          columns={[
            { title: 'Concepto', dataIndex: 'concepto' },
            { title: 'Cant.', dataIndex: 'cantidad', width: 60, align: 'center' },
            { title: 'Subtotal', dataIndex: 'subtotal', width: 120, render: v => `$${parseFloat(v).toLocaleString('es-CO', { minimumFractionDigits: 2 })}` },
            { title: 'IVA', dataIndex: 'iva', width: 100, render: v => `$${parseFloat(v).toLocaleString('es-CO', { minimumFractionDigits: 2 })}` },
            { title: 'Total', dataIndex: 'total', width: 120, render: v => <Text strong>${parseFloat(v).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</Text> },
            {
              title: 'Doc.', width: 80,
              render: (_, r) => r.archivo_nombre ? (
                <a href={archivosApi.getDownloadUrl(r.archivo_id)} target="_blank" rel="noopener noreferrer">
                  <FileOutlined style={{ marginRight: 4 }} />{r.archivo_nombre.length > 15 ? r.archivo_nombre.slice(0, 15) + '...' : r.archivo_nombre}
                </a>
              ) : r.archivo_id ? (
                <a href={archivosApi.getDownloadUrl(r.archivo_id)} target="_blank" rel="noopener noreferrer">
                  <FileOutlined />
                </a>
              ) : null
            }
          ]}
        />

        {/* Pause History */}
        {pausas.length > 0 && (
          <>
            <Divider orientation="left"><HistoryOutlined /> Historial de Pausas</Divider>
            <Timeline>
              {pausas.map(pausa => (
                <Timeline.Item key={pausa.id} color={pausa.fecha_fin ? 'gray' : 'orange'}>
                  <div><Text strong>{pausa.motivo}</Text></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(pausa.fecha_inicio).format('DD/MM/YYYY HH:mm')}
                    {pausa.fecha_fin
                      ? ` - ${dayjs(pausa.fecha_fin).format('DD/MM/YYYY HH:mm')} (${pausa.dias_pausados} dias habiles)`
                      : ' - En curso'}
                  </Text>
                  {pausa.fecha_estimada_reanudacion && (
                    <div><Text type="secondary" style={{ fontSize: 11 }}>
                      Reanudacion estimada: {dayjs(pausa.fecha_estimada_reanudacion).format('DD/MM/YYYY')}
                    </Text></div>
                  )}
                  <div><Text type="secondary" style={{ fontSize: 11 }}>Por: {pausa.creado_por_nombre}</Text></div>
                </Timeline.Item>
              ))}
            </Timeline>
          </>
        )}

        {/* Comments */}
        <Divider orientation="left">Comentarios</Divider>
        <Timeline>
          {comentarios.map(c => (
            <Timeline.Item key={c.id}>
              <Text strong>{c.autor_nombre}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}</Text>
              <Paragraph style={{ margin: '4px 0' }}>{c.contenido}</Paragraph>
              {c.adjuntos && c.adjuntos.length > 0 && (
                <Space wrap size={4}>
                  {c.adjuntos.map(a => (
                    <a key={a.id} href={archivosApi.getDownloadUrl(a.id)} target="_blank" rel="noopener noreferrer">
                      <Tag icon={<FileOutlined />}>{a.nombre_original}</Tag>
                    </a>
                  ))}
                </Space>
              )}
            </Timeline.Item>
          ))}
          {comentarios.length === 0 && <Text type="secondary">Sin comentarios</Text>}
        </Timeline>

        <div style={{ marginTop: 16 }}>
          <TextArea value={comment} onChange={e => setComment(e.target.value)} placeholder="Agregar comentario..." rows={2} />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Upload
              beforeUpload={() => false}
              fileList={commentFiles}
              onChange={({ fileList }) => setCommentFiles(fileList)}
              multiple
            >
              <Button size="small" icon={<UploadOutlined />}>Adjuntar archivos</Button>
            </Upload>
            <Button type="primary" onClick={handleAddComment}>Enviar</Button>
          </div>
        </div>

        {/* Emergent Changes Log */}
        {cambiosEmergentes.length > 0 && (
          <>
            <Divider orientation="left"><AuditOutlined /> Cambios Emergentes</Divider>
            <Collapse ghost>
              <Panel header={<Text type="secondary">{cambiosEmergentes.length} cambios registrados</Text>} key="cambios">
                <Timeline>
                  {cambiosEmergentes.map(c => (
                    <Timeline.Item key={c.id} color="orange">
                      <div>
                        <Tag color="volcano" style={{ fontSize: 11 }}>{cambioLabels[c.tipo_cambio] || c.tipo_cambio}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>{c.usuario_nombre}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                          {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
                        </Text>
                      </div>
                      {c.valor_nuevo && (
                        <Text style={{ fontSize: 12 }}>
                          {typeof c.valor_nuevo === 'object'
                            ? Object.entries(c.valor_nuevo).map(([k, v]) => `${k}: ${v}`).join(', ')
                            : JSON.stringify(c.valor_nuevo)}
                        </Text>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Panel>
            </Collapse>
          </>
        )}
      </Card>

      {/* Cancel Modal */}
      <Modal title="Cancelar Proyecto" open={cancelModalVisible} onOk={handleCancelar}
        onCancel={() => setCancelModalVisible(false)} confirmLoading={actionLoading}
        okText="Cancelar Proyecto" okButtonProps={{ danger: true }} cancelText="Volver">
        <Alert type="error" message="Esta accion no se puede deshacer"
          description="El proyecto sera marcado como cancelado por el Coordinador NT y no podra continuarse."
          style={{ marginBottom: 16 }} />
        <Form form={cancelForm} layout="vertical">
          <Form.Item name="motivo" label="Motivo de la cancelacion" rules={[{ required: true, message: 'Ingrese el motivo' }]}>
            <TextArea rows={3} placeholder="Explique el motivo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reschedule Calendar (Coordinator picks date to approve) */}
      <SchedulingCalendar
        visible={rescheduleCalendarVisible}
        onClose={() => setRescheduleCalendarVisible(false)}
        mode="reschedule"
        proyecto={proyecto}
        onConfirmReschedule={handleRescheduleApproveConfirmDates}
      />

      {/* Reschedule Approve Comentario Modal */}
      <Modal
        title="Aprobar Reprogramación"
        open={rescheduleApproveModalVisible}
        onOk={handleApproveReprogramacion}
        onCancel={() => { setRescheduleApproveModalVisible(false); setRescheduleApproveComentario(''); setRescheduleDates(null) }}
        confirmLoading={actionLoading}
        okText="Aprobar"
        cancelText="Cancelar"
      >
        <Alert type="info" message="La solicitud pasará a Gerencia para aprobación final." style={{ marginBottom: 16 }} />
        {rescheduleDates && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Fechas aprobadas: </Text>
            <Text strong>{dayjs(rescheduleDates.fecha_inicio).format('DD/MM/YYYY')} - {dayjs(rescheduleDates.fecha_fin).format('DD/MM/YYYY')}</Text>
          </div>
        )}
        <Input.TextArea
          rows={2}
          placeholder="Comentario opcional..."
          value={rescheduleApproveComentario}
          onChange={(e) => setRescheduleApproveComentario(e.target.value)}
        />
      </Modal>

      {/* Reschedule Reject Modal */}
      <Modal
        title="Rechazar Reprogramación"
        open={rescheduleRejectVisible}
        onOk={handleRejectReprogramacion}
        onCancel={() => { setRescheduleRejectVisible(false); setRescheduleComentario('') }}
        confirmLoading={actionLoading}
        okText="Rechazar"
        okButtonProps={{ danger: true, disabled: !rescheduleComentario.trim() }}
        cancelText="Cancelar"
      >
        <Alert type="warning" message="Indique el motivo del rechazo." style={{ marginBottom: 16 }} />
        <Input.TextArea
          rows={3}
          placeholder="Motivo del rechazo (requerido)..."
          value={rescheduleComentario}
          onChange={(e) => setRescheduleComentario(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default CoordinadorNTProyectoDetail
