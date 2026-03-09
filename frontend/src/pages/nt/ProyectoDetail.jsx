import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Progress, Modal, Form, Input, InputNumber, Table, Alert, Collapse,
  Timeline, message, Row, Col, Tooltip, Select, Badge, Empty, Upload, DatePicker, List
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CalendarOutlined, TeamOutlined,
  ExclamationCircleOutlined, HistoryOutlined, UserOutlined, WarningOutlined,
  DollarOutlined, AuditOutlined, DeleteOutlined, EditOutlined,
  UploadOutlined, FileOutlined, SwapOutlined, FileTextOutlined,
  AlertOutlined, ClockCircleOutlined, ToolOutlined, TrophyOutlined, LineChartOutlined
} from '@ant-design/icons'
import { proyectosApi, usuariosApi, archivosApi, solicitudesApi, evaluacionesApi, calendarioApi } from '../../services/api'
import IntegracionDisplay from '../../components/IntegracionDisplay'
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
  planificacion: 'Planificación',
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
  proyecto_nuevo_interno: 'Proyecto Nuevo (Interno)',
  proyecto_nuevo_externo: 'Proyecto Nuevo (Externo)',
  actualizacion: 'Actualización',
  reporte_fallo: 'Reporte de Fallo',
  cierre_servicio: 'Cierre de Servicio'
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
  tarea_duracion_modificada: 'Duración de tarea modificada',
  miembro_agregado: 'Miembro agregado',
  miembro_eliminado: 'Miembro eliminado',
  cambio_lider: 'Cambio de líder'
}

function NTProyectoDetail() {
  const { codigo } = useParams()
  const navigate = useNavigate()
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
  const [usuarios, setUsuarios] = useState([])
  const [holidays, setHolidays] = useState([])
  const [solicitudOriginal, setSolicitudOriginal] = useState(null)
  const [evaluacionOriginal, setEvaluacionOriginal] = useState(null)

  // Modal states
  const [pauseModalVisible, setPauseModalVisible] = useState(false)
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [emergentModalVisible, setEmergentModalVisible] = useState(false)
  const [costoModalVisible, setCostoModalVisible] = useState(false)
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [leaderModalVisible, setLeaderModalVisible] = useState(false)
  const [rescheduleCalendarVisible, setRescheduleCalendarVisible] = useState(false)
  const [rescheduleMotivo, setRescheduleMotivo] = useState('')
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false)
  const [rescheduleDates, setRescheduleDates] = useState(null)
  const [reprogramacion, setReprogramacion] = useState(null)
  const [editingCosto, setEditingCosto] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [commentFiles, setCommentFiles] = useState([])

  const [pauseForm] = Form.useForm()
  const [cancelForm] = Form.useForm()
  const [emergentForm] = Form.useForm()
  const [costoForm] = Form.useForm()
  const [memberForm] = Form.useForm()
  const [leaderForm] = Form.useForm()
  const [comment, setComment] = useState('')
  const [commentType, setCommentType] = useState('comentario')

  useEffect(() => { loadData(); loadUsuarios(); loadHolidays(); loadReprogramacion() }, [codigo])

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

      // Load original solicitud if project came from one
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

  const loadUsuarios = async () => {
    try {
      // Load NT + TI + coordinador_ti users (exclude coordinador_nt)
      const [ntRes, tiRes, coordTiRes] = await Promise.all([
        usuariosApi.getByRole('nuevas_tecnologias'),
        usuariosApi.getByRole('ti'),
        usuariosApi.getByRole('coordinador_ti')
      ])
      setUsuarios([
        ...(ntRes.data.usuarios || []).map(u => ({ ...u, rol: 'nuevas_tecnologias' })),
        ...(tiRes.data.usuarios || []).map(u => ({ ...u, rol: 'ti' })),
        ...(coordTiRes.data.usuarios || []).map(u => ({ ...u, rol: 'coordinador_ti' }))
      ])
    } catch { /* ignore */ }
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

  // Check if current user is the project lead
  const isLead = miembros.some(m => m.usuario_id === user?.id && m.es_lider) || proyecto?.responsable_id === user?.id

  const isPaused = proyecto?.estado === 'pausado'
  const isActive = proyecto?.estado === 'en_desarrollo'
  const isPlanning = proyecto?.estado === 'planificacion'
  const isImplementacion = proyecto?.estado === 'en_implementacion'
  const isSolucionado = proyecto?.estado === 'solucionado'
  const isCancelled = ['cancelado', 'cancelado_coordinador', 'cancelado_gerencia'].includes(proyecto?.estado)
  const isFinished = ['completado', 'solucionado', 'cancelado', 'cancelado_coordinador', 'cancelado_gerencia'].includes(proyecto?.estado) || isImplementacion

  // ---- Lifecycle Actions ----

  const handleIniciar = async () => {
    setActionLoading(true)
    try {
      await proyectosApi.iniciarDesarrollo(codigo)
      message.success('Proyecto iniciado en desarrollo')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al iniciar desarrollo')
    } finally { setActionLoading(false) }
  }

  const handlePausar = async () => {
    try {
      const values = await pauseForm.validateFields()
      setActionLoading(true)
      await proyectosApi.pausar(codigo, {
        motivo: values.motivo,
        fecha_estimada_reanudacion: values.fecha_estimada_reanudacion?.format('YYYY-MM-DD') || null
      })
      message.success('Proyecto pausado')
      setPauseModalVisible(false)
      pauseForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al pausar proyecto')
    } finally { setActionLoading(false) }
  }

  const handleReanudar = async () => {
    setActionLoading(true)
    try {
      await proyectosApi.reanudar(codigo)
      message.success('Proyecto reanudado')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al reanudar proyecto')
    } finally { setActionLoading(false) }
  }

  const handleCompletar = async () => {
    setActionLoading(true)
    try {
      await proyectosApi.completar(codigo)
      message.success('Desarrollo completado — proyecto en implementación')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al completar desarrollo')
    } finally { setActionLoading(false) }
  }

  const handleFinalizar = async () => {
    Modal.confirm({
      title: 'Finalizar Proyecto',
      content: '¿Confirma que la implementación ha sido completada y desea finalizar el proyecto?',
      okText: 'Finalizar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setActionLoading(true)
        try {
          await proyectosApi.finalizar(codigo)
          message.success('Proyecto finalizado exitosamente')
          loadData()
        } catch (error) {
          message.error(error.response?.data?.error || 'Error al finalizar proyecto')
        } finally { setActionLoading(false) }
      }
    })
  }

  const handleImplTareaProgreso = async (tareaId, data) => {
    try {
      await proyectosApi.updateImplTareaProgreso(codigo, tareaId, data)
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al actualizar progreso')
    }
  }

  const handleCancelar = async () => {
    try {
      const values = await cancelForm.validateFields()
      setActionLoading(true)
      await proyectosApi.cancelarProyecto(codigo, { motivo: values.motivo })
      message.success('Proyecto cancelado')
      setCancelModalVisible(false)
      cancelForm.resetFields()
      navigate('/nt/proyectos')
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al cancelar proyecto')
    } finally { setActionLoading(false) }
  }

  // ---- Reschedule ----

  const handleRescheduleConfirmDates = (dates) => {
    setRescheduleDates(dates)
    setRescheduleCalendarVisible(false)
    setRescheduleModalVisible(true)
  }

  const handleSubmitReschedule = async () => {
    if (!rescheduleMotivo.trim() || !rescheduleDates) return
    setActionLoading(true)
    try {
      await proyectosApi.solicitarReprogramacion(codigo, {
        motivo: rescheduleMotivo,
        fecha_inicio_propuesta: rescheduleDates.fecha_inicio,
        fecha_fin_propuesta: rescheduleDates.fecha_fin
      })
      message.success('Solicitud de reprogramación enviada')
      setRescheduleModalVisible(false)
      setRescheduleMotivo('')
      setRescheduleDates(null)
      loadReprogramacion()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al solicitar reprogramación')
    } finally { setActionLoading(false) }
  }

  const hasTasks = tareas.length > 0
  const canRescheduleState = (isPlanning || isActive || isPaused) && hasTasks
  const hasPendingReprogramacion = reprogramacion && ['pendiente_coordinador', 'pendiente_gerencia'].includes(reprogramacion.estado)
  const canRequestReschedule = canRescheduleState && !hasPendingReprogramacion

  // ---- Tasks ----

  const handleTaskUpdate = async (tareaId, updates) => {
    try {
      if (updates.progreso !== undefined) {
        await proyectosApi.updateTareaProgreso(codigo, tareaId, { progreso: updates.progreso })
      }
      if (updates.asignado_id !== undefined) {
        await proyectosApi.updateTarea(codigo, tareaId, { asignado_id: updates.asignado_id })
      }
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al actualizar tarea')
    }
  }

  const handleAddEmergentTask = async () => {
    try {
      const values = await emergentForm.validateFields()
      setActionLoading(true)
      await proyectosApi.createTarea(codigo, {
        titulo: values.titulo,
        descripcion: values.descripcion,
        duracion_dias: values.duracion_dias,
        asignado_id: values.asignado_id,
        fecha_inicio: values.fecha_inicio || dayjs().format('YYYY-MM-DD')
      })
      message.success('Tarea emergente creada')
      setEmergentModalVisible(false)
      emergentForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al crear tarea')
    } finally { setActionLoading(false) }
  }

  // ---- Costs ----

  const handleSaveCosto = async () => {
    try {
      const values = await costoForm.validateFields()
      setActionLoading(true)
      if (editingCosto) {
        await proyectosApi.updateCosto(codigo, editingCosto.id, values)
        message.success('Costo actualizado')
      } else {
        await proyectosApi.addCosto(codigo, values)
        message.success('Costo agregado')
      }
      setCostoModalVisible(false)
      setEditingCosto(null)
      costoForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al guardar costo')
    } finally { setActionLoading(false) }
  }

  const handleDeleteCosto = async (costoId) => {
    try {
      await proyectosApi.deleteCosto(codigo, costoId)
      message.success('Costo eliminado')
      loadData()
    } catch { message.error('Error al eliminar costo') }
  }

  // ---- Members ----

  const handleAddMember = async () => {
    try {
      const values = await memberForm.validateFields()
      setActionLoading(true)
      await proyectosApi.addMiembro(codigo, values)
      message.success('Miembro agregado')
      setMemberModalVisible(false)
      memberForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al agregar miembro')
    } finally { setActionLoading(false) }
  }

  const handleRemoveMember = async (userId) => {
    try {
      await proyectosApi.removeMiembro(codigo, userId)
      message.success('Miembro eliminado (sus tareas fueron reasignadas al líder)')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al eliminar miembro')
    }
  }

  const handleChangeLeader = async () => {
    try {
      const values = await leaderForm.validateFields()
      setActionLoading(true)
      await proyectosApi.cambiarLider(codigo, { nuevo_lider_id: values.nuevo_lider_id })
      message.success('Líder del proyecto cambiado')
      setLeaderModalVisible(false)
      leaderForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.error || 'Error al cambiar líder')
    } finally { setActionLoading(false) }
  }

  // ---- Comments ----

  const handleAddComment = async () => {
    if (!comment.trim()) return
    try {
      const files = commentFiles.map(f => f.originFileObj || f)
      await proyectosApi.addComment(codigo, { contenido: comment, tipo: commentType }, files)
      const successMsg = commentType === 'comunicacion' ? 'Comunicación enviada al solicitante'
        : commentType === 'agendar_reunion' ? 'Solicitud de reunión enviada al solicitante'
        : 'Comentario agregado'
      message.success(successMsg)
      setComment('')
      setCommentType('comentario')
      setCommentFiles([])
      loadData()
    } catch { message.error('Error al agregar comentario') }
  }

  // ---- Solicitud Original Render ----

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
        <Panel
          header={<Space><FileTextOutlined /> <Text strong>Solicitud Original</Text> <Tag>{sol.codigo}</Tag></Space>}
          key="solicitud-original"
        >
          {/* Metadata */}
          <Descriptions bordered column={{ xs: 1, sm: 4 }} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Código">{sol.codigo}</Descriptions.Item>
            <Descriptions.Item label="Tipo">{tipoLabels[sol.tipo] || sol.tipo}</Descriptions.Item>
            <Descriptions.Item label="Prioridad"><Tag color={prioridadColors[sol.prioridad]}>{sol.prioridad}</Tag></Descriptions.Item>
            <Descriptions.Item label="Creada">{dayjs(sol.creado_en).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>

          {/* Solicitante */}
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

          {/* Sponsor */}
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

          {/* Stakeholders */}
          {(stakeholders.internas?.areas?.length > 0 || stakeholders.internas?.personas?.length > 0) && (
            <Card title={<><TeamOutlined /> Partes Interesadas</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Áreas Interesadas">
                  {stakeholders.internas?.areas?.length > 0 ? stakeholders.internas.areas.map((a, i) => <Tag key={i}>{a}</Tag>) : '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Personas Clave">
                  {stakeholders.internas?.personas?.length > 0 ? stakeholders.internas.personas.map((p, i) => <Tag key={i}>{p}</Tag>) : '--'}
                </Descriptions.Item>
                {stakeholders.aplica_externas && (
                  <>
                    <Descriptions.Item label="Sectores Comerciales">
                      {stakeholders.externas?.sectores?.length > 0 ? stakeholders.externas.sectores.map((s, i) => <Tag key={i}>{s}</Tag>) : '--'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Empresas">
                      {stakeholders.externas?.empresas?.length > 0 ? stakeholders.externas.empresas.map((e, i) => <Tag key={i}>{e}</Tag>) : '--'}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Problemática */}
          <Card title={<><AlertOutlined /> Descripción de la Problemática</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Título">{problematica.titulo || sol.titulo || '--'}</Descriptions.Item>
              <Descriptions.Item label="Situación Actual"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.situacion_actual || problematica.problema_actual || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Origen">{problematica.origen || '--'}</Descriptions.Item>
              <Descriptions.Item label="Afectación"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.afectacion_operacion || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Procesos Comprometidos"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.procesos_comprometidos || '--'}</span></Descriptions.Item>
              {problematica.impacto_nivel && (
                <Descriptions.Item label="Impacto">
                  <Tag color={problematica.impacto_nivel === 'critico' ? 'red' : problematica.impacto_nivel === 'alto' ? 'orange' : problematica.impacto_nivel === 'medio' ? 'cyan' : 'green'}>
                    {problematica.impacto_nivel.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Urgencia */}
          {(urgencia.necesidad_principal || urgencia.nivel) && (
            <Card title={<><ClockCircleOutlined /> Necesidad y Urgencia</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Necesidad Principal"><span style={{ whiteSpace: 'pre-wrap' }}>{urgencia.necesidad_principal || '--'}</span></Descriptions.Item>
                {urgencia.nivel && (
                  <Descriptions.Item label="Nivel de Urgencia">
                    <Tag color={urgencia.nivel === 'inmediata' ? 'red' : urgencia.nivel === 'corto_plazo' ? 'orange' : urgencia.nivel === 'mediano_plazo' ? 'cyan' : 'green'}>
                      {urgencia.nivel.replace(/_/g, ' ').toUpperCase()}
                    </Tag>
                  </Descriptions.Item>
                )}
                {urgencia.fecha_limite && <Descriptions.Item label="Fecha Límite">{dayjs(urgencia.fecha_limite).format('DD/MM/YYYY')}</Descriptions.Item>}
                <Descriptions.Item label="¿Por qué NT?"><span style={{ whiteSpace: 'pre-wrap' }}>{urgencia.justificacion_nt || urgencia.justificacion || '--'}</span></Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* Solución */}
          <Card title={<><ToolOutlined /> Propuesta de Solución</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Tipo de Solución">
                {(solucion.tipo || solucion.tipo_solucion) ? <>{getLabel(solucion.tipo || solucion.tipo_solucion, tipoSolucionLabels)}{(solucion.tipo_descripcion || solucion.tipo_solucion_otro) && ` - ${solucion.tipo_descripcion || solucion.tipo_solucion_otro}`}</> : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Solución Ideal"><span style={{ whiteSpace: 'pre-wrap' }}>{solucion.descripcion_ideal || solucion.solucion_ideal || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Casos de Uso"><span style={{ whiteSpace: 'pre-wrap' }}>{solucion.casos_uso || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Usuarios Finales">
                {solucion.usuarios_finales?.length > 0 ? solucion.usuarios_finales.map((u, i) => <Tag key={i}>{u}</Tag>) : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Funcionalidades Mínimas">
                {solucion.funcionalidades_minimas?.length > 0 ? <List size="small" dataSource={solucion.funcionalidades_minimas} renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>} /> : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Funcionalidades Deseables">
                {solucion.funcionalidades_deseables?.length > 0 ? <List size="small" dataSource={solucion.funcionalidades_deseables} renderItem={item => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>} /> : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Forma de Entrega">{getLabel(solucion.forma_entrega, formaEntregaLabels)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <IntegracionDisplay integracion={sol.integracion} holidays={holidays} />

          {/* Beneficios */}
          <Card title={<><TrophyOutlined /> Beneficios Esperados</>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Descripción"><span style={{ whiteSpace: 'pre-wrap' }}>{beneficios.descripcion || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Mejora Concreta"><span style={{ whiteSpace: 'pre-wrap' }}>{beneficios.mejora_concreta || '--'}</span></Descriptions.Item>
              <Descriptions.Item label="Procesos a Optimizar">
                {beneficios.procesos_optimizados?.length > 0 ? beneficios.procesos_optimizados.map((p, i) => <Tag key={i}>{p}</Tag>) : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="¿Reducción de Costos?">{beneficios.reduccion_costos === true ? 'Sí' : beneficios.reduccion_costos === false ? 'No' : '--'}</Descriptions.Item>
            </Descriptions>
            {beneficios.reduccion_costos && (
              <div style={{ marginTop: 16, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Análisis de Costos</Text>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Actuales</Text>
                    {analisisCostos.costos_actuales?.length > 0 ? (
                      <List size="small" dataSource={analisisCostos.costos_actuales} renderItem={(item, i) => (
                        <List.Item key={i} style={{ padding: '4px 0' }}><Text>{item.descripcion}</Text><Text style={{ marginLeft: 8 }}>{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}</Text></List.Item>
                      )} footer={<Text strong>Total: {formatCOP(totalActual)}</Text>} />
                    ) : '--'}
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Esperados</Text>
                    {analisisCostos.costos_esperados?.length > 0 ? (
                      <List size="small" dataSource={analisisCostos.costos_esperados} renderItem={(item, i) => (
                        <List.Item key={i} style={{ padding: '4px 0' }}><Text>{item.descripcion}</Text><Text style={{ marginLeft: 8 }}>{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}</Text></List.Item>
                      )} footer={<Text strong>Total: {formatCOP(totalEsperado)}</Text>} />
                    ) : '--'}
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
                {beneficioMonetario.items?.length > 0 ? (
                  <List size="small" dataSource={beneficioMonetario.items} renderItem={(item, i) => (
                    <List.Item key={i}><Text>{item.descripcion}</Text><Text style={{ marginLeft: 8 }}>{item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor || item.monto)}</Text></List.Item>
                  )} />
                ) : '--'}
                <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 8, textAlign: 'center', border: '1px solid #52c41a' }}>
                  <Text strong style={{ fontSize: 16, color: '#52c41a' }}>Total: {formatCOP(totalBeneficioMonetario)}</Text>
                </div>
              </div>
            )}
          </Card>

          {/* KPIs */}
          <Card title={<><LineChartOutlined /> Control de Desempeño (KPIs)</>} size="small" style={{ marginBottom: 16 }}>
            {kpis.length > 0 ? (
              <List size="small" dataSource={kpis} renderItem={(kpi) => (
                <List.Item>
                  <Descriptions size="small" column={{ xs: 1, sm: 4 }}>
                    <Descriptions.Item label="Indicador">{kpi.nombre || kpi.indicador || '--'}</Descriptions.Item>
                    <Descriptions.Item label="Valor Actual">{kpi.valor_actual || '--'}</Descriptions.Item>
                    <Descriptions.Item label="Objetivo">{kpi.valor_objetivo || '--'}</Descriptions.Item>
                    <Descriptions.Item label="Unidad">{kpi.unidad || '--'}</Descriptions.Item>
                  </Descriptions>
                </List.Item>
              )} />
            ) : <Text type="secondary">Sin indicadores definidos</Text>}
          </Card>

          {/* NT Evaluation Summary */}
          {evaluacionOriginal && (
            <Card title={<><CheckCircleOutlined /> Evaluación NT</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Resumen Ejecutivo"><span style={{ whiteSpace: 'pre-wrap' }}>{evaluacionOriginal.resumen_ejecutivo || '--'}</span></Descriptions.Item>
                <Descriptions.Item label="Recomendación">
                  <Tag color={recomendacionColors[evaluacionOriginal.recomendacion]}>{evaluacionOriginal.recomendacion?.toUpperCase() || '--'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Justificación" span={2}><span style={{ whiteSpace: 'pre-wrap' }}>{evaluacionOriginal.justificacion || '--'}</span></Descriptions.Item>
                {evaluacionOriginal.fecha_inicio_posible && (
                  <Descriptions.Item label="Fecha Inicio Posible">{dayjs(evaluacionOriginal.fecha_inicio_posible).format('DD/MM/YYYY')}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Old solicitud comments */}
          {solComentarios.length > 0 && (
            <>
              <Divider orientation="left" style={{ marginTop: 16 }}>Comentarios de la Solicitud</Divider>
              <Timeline>
                {solComentarios.map(c => (
                  <Timeline.Item key={c.id}>
                    <Text strong>{c.autor_nombre}</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}</Text>
                    {c.tipo && c.tipo !== 'comentario' && <Tag style={{ marginLeft: 8 }}>{c.tipo}</Tag>}
                    <Paragraph style={{ margin: '4px 0' }}>{c.contenido}</Paragraph>
                  </Timeline.Item>
                ))}
              </Timeline>
            </>
          )}
        </Panel>
      </Collapse>
    )
  }

  // ---- Render ----

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!proyecto) return <Card><Title level={4}>Proyecto no encontrado</Title></Card>

  const lider = miembros.find(m => m.es_lider)

  // Cost summary
  const totalCostosActual = costos.reduce((sum, c) => sum + parseFloat(c.total || 0), 0)
  const totalEstimado = estimacion?.total_estimado ? parseFloat(estimacion.total_estimado) : null

  // Task stats
  const tareasCompletadas = tareas.filter(t => t.progreso === 100).length
  const diasEmergentes = tareas.filter(t => t.es_emergente).reduce((s, t) => s + (t.duracion_dias || 0), 0)

  // Members for Gantt reassignment
  const ganttMembers = miembros.map(m => ({ id: m.usuario_id, nombre: m.nombre }))

  // NT-only users (for leader change)
  const ntUsers = usuarios.filter(u => u.rol === 'nuevas_tecnologias')

  return (
    <div style={{ padding: 24 }}>
      <Link to="/nt/proyectos">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Volver a Proyectos</Button>
      </Link>

      {/* Pause Alert */}
      {isPaused && pausaActiva && (
        <Alert
          type="warning" showIcon icon={<PauseCircleOutlined />}
          message="Proyecto Pausado"
          description={
            <div>
              <div><strong>Motivo:</strong> {pausaActiva.motivo}</div>
              <div><strong>Desde:</strong> {dayjs(pausaActiva.fecha_inicio).format('DD/MM/YYYY HH:mm')}</div>
              <div><strong>Días hábiles pausado:</strong> {pausaActiva.dias_transcurridos}</div>
              {pausaActiva.fecha_estimada_reanudacion && (
                <div><strong>Reanudación estimada:</strong> {dayjs(pausaActiva.fecha_estimada_reanudacion).format('DD/MM/YYYY')}</div>
              )}
            </div>
          }
          style={{ marginBottom: 16 }}
          action={isLead && (
            <Button type="primary" onClick={handleReanudar} loading={actionLoading}>Reanudar Proyecto</Button>
          )}
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
              <Text type="secondary"><TeamOutlined style={{ marginRight: 4 }} />Líder: {lider.nombre}</Text>
            )}
          </div>

          {/* Action Buttons */}
          {isLead && (
            <Space>
              {isPlanning && (
                <Button type="primary" icon={<PlayCircleOutlined />} loading={actionLoading} onClick={handleIniciar}>
                  Iniciar Desarrollo
                </Button>
              )}
              {isActive && (
                <>
                  <Button icon={<PauseCircleOutlined />} onClick={() => setPauseModalVisible(true)}>Pausar</Button>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleCompletar} loading={actionLoading}>Completar Desarrollo</Button>
                </>
              )}
              {isImplementacion && (
                <Button
                  type="primary"
                  icon={<TrophyOutlined />}
                  onClick={handleFinalizar}
                  loading={actionLoading}
                  disabled={implementacionTareas.some(t => t.progreso < 100)}
                >
                  Finalizar Proyecto
                </Button>
              )}
              {(isActive || isPaused) && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModalVisible(true)}>Cancelar</Button>
              )}
            </Space>
          )}
          {canRequestReschedule && (
            <Button icon={<CalendarOutlined />} onClick={() => setRescheduleCalendarVisible(true)}>Reprogramar</Button>
          )}
        </div>

        {/* Reprogramacion Status Alert */}
        {reprogramacion && !['aprobada', 'rechazada_coordinador', 'rechazada_gerencia'].includes(reprogramacion.estado) && (
          <Alert
            style={{ marginBottom: 16 }}
            type={reprogramacion.estado === 'pendiente_coordinador' ? 'info' : 'warning'}
            showIcon
            message={`Reprogramación ${reprogramacion.estado === 'pendiente_coordinador' ? 'pendiente de Coordinador NT' : 'pendiente de Gerencia'}`}
            description={
              <Space direction="vertical" size={2}>
                <Text>Solicitado por: <Text strong>{reprogramacion.solicitante_nombre}</Text></Text>
                <Text>Motivo: {reprogramacion.motivo}</Text>
                <Text>Fechas propuestas: {dayjs(reprogramacion.fecha_inicio_propuesta).format('DD/MM/YYYY')} - {dayjs(reprogramacion.fecha_fin_propuesta).format('DD/MM/YYYY')}</Text>
                {reprogramacion.estado === 'pendiente_gerencia' && reprogramacion.coordinador_nombre && (
                  <Text type="success">Aprobado por Coord. NT: {reprogramacion.coordinador_nombre}</Text>
                )}
              </Space>
            }
          />
        )}
        {reprogramacion && reprogramacion.estado === 'aprobada' && (
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

        {/* Progress Section */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="Progreso del Proyecto">
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={proyecto.progreso_teorico || 0} strokeColor="#8c8c8c" size={100} />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Teórico</Text>
                      <Tooltip title="Días hábiles en desarrollo / Días hábiles planificados (excluyendo pausas)">
                        <ExclamationCircleOutlined style={{ marginLeft: 4, cursor: 'help' }} />
                      </Tooltip>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={proyecto.progreso_practico || 0} strokeColor={INEMEC_RED} size={100} />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Práctico</Text>
                      <Tooltip title="Promedio ponderado del progreso de tareas (por duración)">
                        <ExclamationCircleOutlined style={{ marginLeft: 4, cursor: 'help' }} />
                      </Tooltip>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Información">
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
                <Descriptions.Item label="Días por Tareas Emergentes">
                  {diasEmergentes} días
                </Descriptions.Item>
                <Descriptions.Item label="Días Pausados">
                  {proyecto.dias_pausados_total || 0} días
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Solicitud Original */}
        {renderSolicitudOriginal()}

        {/* Gantt Chart */}
        <Divider orientation="left">
          <CalendarOutlined /> Cronograma
          {isLead && isActive && (
            <Button type="link" icon={<PlusOutlined />} onClick={() => setEmergentModalVisible(true)}>
              Tarea Emergente
            </Button>
          )}
        </Divider>
        <GanttChart
          tareas={tareas}
          onTaskUpdate={handleTaskUpdate}
          disabled={isFinished || isPaused}
          isLead={isLead}
          userId={user?.id}
          holidays={holidays}
          members={ganttMembers}
        />

        {/* Implementation Tasks */}
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
              onTaskUpdate={(tareaId, data) => handleImplTareaProgreso(tareaId, data)}
              disabled={!isLead || !isImplementacion}
              isLead={isLead && isImplementacion}
              userId={user?.id}
              holidays={holidays}
              members={[]}
            />
          </>
        )}

        {/* Team Members */}
        <Divider orientation="left">
          <TeamOutlined /> Equipo
          {isLead && !isFinished && (
            <Space>
              <Button type="link" icon={<PlusOutlined />} onClick={() => setMemberModalVisible(true)}>
                Agregar
              </Button>
              <Button type="link" icon={<SwapOutlined />} onClick={() => setLeaderModalVisible(true)}>
                Cambiar Líder
              </Button>
            </Space>
          )}
        </Divider>
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
                  {r.es_lider && <Tag color="gold">Líder</Tag>}
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
            },
            ...(isLead && !isFinished ? [{
              title: '', width: 40,
              render: (_, r) => !r.es_lider && (
                <Button type="text" danger size="small" icon={<DeleteOutlined />}
                  onClick={() => handleRemoveMember(r.usuario_id)} />
              )
            }] : [])
          ]}
        />

        {/* Costs Section */}
        <Divider orientation="left">
          <DollarOutlined /> Costos
          {isLead && !isFinished && (
            <Button type="link" icon={<PlusOutlined />} onClick={() => {
              setEditingCosto(null)
              costoForm.resetFields()
              setCostoModalVisible(true)
            }}>
              Agregar
            </Button>
          )}
        </Divider>

        {/* Cost summary: Planificado | Real | Diferencia */}
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
            },
            ...(isLead && !isFinished ? [{
              title: '', width: 80,
              render: (_, r) => (
                <Space>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
                    setEditingCosto(r)
                    costoForm.setFieldsValue({
                      concepto: r.concepto, descripcion: r.descripcion,
                      subtotal: parseFloat(r.subtotal), iva: parseFloat(r.iva),
                      cantidad: r.cantidad || 1, archivo_id: r.archivo_id
                    })
                    setCostoModalVisible(true)
                  }} />
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteCosto(r.id)} />
                </Space>
              )
            }] : [])
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
                      ? ` - ${dayjs(pausa.fecha_fin).format('DD/MM/YYYY HH:mm')} (${pausa.dias_pausados} días hábiles)`
                      : ' - En curso'}
                  </Text>
                  {pausa.fecha_estimada_reanudacion && (
                    <div><Text type="secondary" style={{ fontSize: 11 }}>
                      Reanudación estimada: {dayjs(pausa.fecha_estimada_reanudacion).format('DD/MM/YYYY')}
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
          {comentarios.map(c => {
            const tipoColor = c.tipo === 'respuesta' ? 'green'
              : c.tipo === 'comunicacion' ? 'orange'
              : c.tipo === 'agendar_reunion' ? 'purple'
              : c.tipo === 'publico' ? 'cyan'
              : 'blue'
            const tipoLabel = c.tipo === 'respuesta' ? 'Respuesta solicitante'
              : c.tipo === 'comunicacion' ? 'Consulta'
              : c.tipo === 'agendar_reunion' ? 'Agendar reunión'
              : c.tipo === 'publico' ? 'Público'
              : null
            return (
              <Timeline.Item key={c.id} color={tipoColor}>
                <Text strong>{c.autor_externo || c.autor_nombre}</Text>
                {tipoLabel && <Tag color={tipoColor} style={{ marginLeft: 8, fontSize: 11 }}>{tipoLabel}</Tag>}
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
            )
          })}
          {comentarios.length === 0 && <Text type="secondary">Sin comentarios</Text>}
        </Timeline>

        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Select
              value={commentType}
              onChange={setCommentType}
              size="small"
              style={{ width: 260 }}
              options={[
                { value: 'comentario', label: 'Comentario interno' },
                { value: 'publico', label: 'Comentario público (visible al solicitante)' },
                { value: 'comunicacion', label: 'Consulta al solicitante (email)' },
                { value: 'agendar_reunion', label: 'Agendar reunión (email)' },
              ]}
            />
          </div>
          <TextArea value={comment} onChange={e => setComment(e.target.value)} placeholder={
            commentType === 'comunicacion' ? 'Escriba su consulta al solicitante...'
            : commentType === 'agendar_reunion' ? 'Describa el motivo de la reunión...'
            : 'Agregar comentario...'
          } rows={2} />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Upload
              beforeUpload={() => false}
              fileList={commentFiles}
              onChange={({ fileList }) => setCommentFiles(fileList)}
              multiple
            >
              <Button size="small" icon={<UploadOutlined />}>Adjuntar archivos</Button>
            </Upload>
            <Button type="primary" onClick={handleAddComment}>
              {commentType === 'comunicacion' ? 'Enviar consulta' : commentType === 'agendar_reunion' ? 'Enviar solicitud' : 'Enviar'}
            </Button>
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

      {/* Pause Modal */}
      <Modal title="Pausar Proyecto" open={pauseModalVisible} onOk={handlePausar}
        onCancel={() => setPauseModalVisible(false)} confirmLoading={actionLoading} okText="Pausar" cancelText="Cancelar">
        <Form form={pauseForm} layout="vertical">
          <Form.Item name="motivo" label="Motivo de la pausa" rules={[{ required: true, message: 'Ingrese el motivo' }]}>
            <TextArea rows={3} placeholder="Explique el motivo por el cual se pausa el proyecto..." />
          </Form.Item>
          <Form.Item name="fecha_estimada_reanudacion" label="Fecha estimada de reanudación (opcional)">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Seleccione fecha estimada" />
          </Form.Item>
        </Form>
        <Alert type="info" message="Al pausar el proyecto:"
          description={<ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Los días hábiles de pausa no contarán para el progreso teórico</li>
            <li>Se notificará a Gerencia y al solicitante</li>
          </ul>} />
      </Modal>

      {/* Cancel Modal */}
      <Modal title="Cancelar Proyecto" open={cancelModalVisible} onOk={handleCancelar}
        onCancel={() => setCancelModalVisible(false)} confirmLoading={actionLoading}
        okText="Cancelar Proyecto" okButtonProps={{ danger: true }} cancelText="Volver">
        <Alert type="error" message="Esta acción no se puede deshacer"
          description="El proyecto será marcado como cancelado y no podrá continuarse."
          style={{ marginBottom: 16 }} />
        <Form form={cancelForm} layout="vertical">
          <Form.Item name="motivo" label="Motivo de la cancelación" rules={[{ required: true, message: 'Ingrese el motivo' }]}>
            <TextArea rows={3} placeholder="Explique el motivo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Emergent Task Modal */}
      <Modal title="Nueva Tarea Emergente" open={emergentModalVisible} onOk={handleAddEmergentTask}
        onCancel={() => setEmergentModalVisible(false)} confirmLoading={actionLoading} okText="Crear" cancelText="Cancelar">
        <Alert type="warning" message="Las tareas emergentes son tareas no planificadas que surgieron durante el desarrollo." style={{ marginBottom: 16 }} />
        <Form form={emergentForm} layout="vertical">
          <Form.Item name="titulo" label="Nombre de la tarea" rules={[{ required: true, message: 'Ingrese el nombre' }]}>
            <Input placeholder="Nombre descriptivo de la tarea" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="duracion_dias" label="Duración (días hábiles)" rules={[{ required: true, message: 'Ingrese la duración' }]}>
                <InputNumber min={1} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asignado_id" label="Asignar a">
                <Select allowClear placeholder="Sin asignar">
                  {miembros.map(m => <Select.Option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="fecha_inicio" label="Fecha inicio">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <TextArea rows={2} placeholder="Descripción opcional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Cost Modal */}
      <Modal title={editingCosto ? 'Editar Costo' : 'Agregar Costo'} open={costoModalVisible}
        onOk={handleSaveCosto} onCancel={() => { setCostoModalVisible(false); setEditingCosto(null) }}
        confirmLoading={actionLoading} okText="Guardar" cancelText="Cancelar">
        <Form form={costoForm} layout="vertical">
          <Form.Item name="concepto" label="Concepto" rules={[{ required: true, message: 'Ingrese el concepto' }]}>
            <Input placeholder="Descripción del costo" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción adicional">
            <TextArea rows={2} placeholder="Detalles adicionales (opcional)" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="subtotal" label="Subtotal ($)" rules={[{ required: true, message: 'Ingrese el subtotal' }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="iva" label="IVA ($)" initialValue={0}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cantidad" label="Cantidad" initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="archivo_id" label="ID de documento adjunto (opcional)">
            <InputNumber style={{ width: '100%' }} placeholder="ID del archivo subido" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Member Modal */}
      <Modal title="Agregar Miembro" open={memberModalVisible} onOk={handleAddMember}
        onCancel={() => setMemberModalVisible(false)} confirmLoading={actionLoading} okText="Agregar" cancelText="Cancelar">
        <Form form={memberForm} layout="vertical">
          <Form.Item name="usuario_id" label="Usuario" rules={[{ required: true, message: 'Seleccione un usuario' }]}>
            <Select placeholder="Seleccionar usuario" showSearch optionFilterProp="children">
              {usuarios.filter(u => !miembros.some(m => m.usuario_id === u.id)).map(u => (
                <Select.Option key={u.id} value={u.id}>{u.nombre} ({u.rol})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="rol_proyecto" label="Rol en el proyecto" initialValue="desarrollador">
            <Select>
              <Select.Option value="desarrollador">Desarrollador</Select.Option>
              <Select.Option value="soporte">Soporte</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Leader Change Modal */}
      <Modal title="Cambiar Líder del Proyecto" open={leaderModalVisible} onOk={handleChangeLeader}
        onCancel={() => setLeaderModalVisible(false)} confirmLoading={actionLoading} okText="Cambiar" cancelText="Cancelar">
        <Alert type="info" message="Las tareas del líder actual serán reasignadas al nuevo líder." style={{ marginBottom: 16 }} />
        <Form form={leaderForm} layout="vertical">
          <Form.Item name="nuevo_lider_id" label="Nuevo Líder" rules={[{ required: true, message: 'Seleccione un usuario' }]}>
            <Select placeholder="Seleccionar nuevo líder">
              {ntUsers.filter(u => u.id !== lider?.usuario_id).map(u => (
                <Select.Option key={u.id} value={u.id}>{u.nombre}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reschedule Calendar */}
      <SchedulingCalendar
        visible={rescheduleCalendarVisible}
        onClose={() => setRescheduleCalendarVisible(false)}
        mode="reschedule"
        proyecto={proyecto}
        onConfirmReschedule={handleRescheduleConfirmDates}
      />

      {/* Reschedule Motivo Modal */}
      <Modal
        title="Motivo de Reprogramación"
        open={rescheduleModalVisible}
        onOk={handleSubmitReschedule}
        onCancel={() => { setRescheduleModalVisible(false); setRescheduleMotivo(''); setRescheduleDates(null) }}
        confirmLoading={actionLoading}
        okText="Enviar Solicitud"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !rescheduleMotivo.trim() }}
      >
        <Alert type="info" message="La solicitud será revisada por Coordinador NT y luego por Gerencia." style={{ marginBottom: 16 }} />
        {rescheduleDates && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Nuevas fechas propuestas: </Text>
            <Text strong>{dayjs(rescheduleDates.fecha_inicio).format('DD/MM/YYYY')} - {dayjs(rescheduleDates.fecha_fin).format('DD/MM/YYYY')}</Text>
          </div>
        )}
        <Input.TextArea
          rows={3}
          placeholder="Explique el motivo por el cual se necesita reprogramar el proyecto..."
          value={rescheduleMotivo}
          onChange={(e) => setRescheduleMotivo(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default NTProyectoDetail
