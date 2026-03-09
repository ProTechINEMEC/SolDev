import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Progress, Table, Collapse, Timeline, message, Row, Col, Select, Upload, List, Input
} from 'antd'
import {
  ArrowLeftOutlined, CalendarOutlined, TeamOutlined,
  UserOutlined, DollarOutlined, FileOutlined, FileTextOutlined,
  AlertOutlined, ClockCircleOutlined, ToolOutlined, TrophyOutlined, LineChartOutlined,
  UploadOutlined, CheckCircleOutlined, PauseCircleOutlined
} from '@ant-design/icons'
import { proyectosApi, solicitudesApi, evaluacionesApi, archivosApi, calendarioApi } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import GanttChart from '../../components/GanttChart'
import IntegracionDisplay from '../../components/IntegracionDisplay'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Panel } = Collapse

const INEMEC_RED = '#D52B1E'

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

const getLabel = (value, labels) => labels[value] || value || '--'

const formatCOP = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$0'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}

export function ImplementacionDetail({ linkPrefix = '/nt', readOnly = false }) {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [proyecto, setProyecto] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [tareas, setTareas] = useState([])
  const [comentarios, setComentarios] = useState([])
  const [costos, setCostos] = useState([])
  const [pausas, setPausas] = useState([])
  const [implementacionTareas, setImplementacionTareas] = useState([])
  const [holidays, setHolidays] = useState([])
  const [solicitudOriginal, setSolicitudOriginal] = useState(null)
  const [evaluacionOriginal, setEvaluacionOriginal] = useState(null)

  const [comment, setComment] = useState('')
  const [commentType, setCommentType] = useState('comentario')
  const [commentFiles, setCommentFiles] = useState([])

  useEffect(() => { loadData(); loadHolidays() }, [codigo])

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
      setPausas(d.pausas || [])
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

  const handleImplTareaProgreso = async (tareaId, data) => {
    try {
      await proyectosApi.updateImplTareaProgreso(codigo, tareaId, data)
      loadData()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al actualizar progreso')
    }
  }

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

  const handleFinalizar = async () => {
    try {
      await proyectosApi.finalizar(codigo)
      message.success('Implementación finalizada — proyecto solucionado')
      navigate(`${linkPrefix}/implementacion`)
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al finalizar implementación')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
  }

  if (!proyecto) {
    return <Card><Title level={4}>Proyecto no encontrado</Title></Card>
  }

  const isLead = miembros.some(m => m.usuario_id === user?.id && m.es_lider) || proyecto?.responsable_id === user?.id
  const completedCount = implementacionTareas.filter(t => t.progreso >= 100 || t.completada).length
  const totalCount = implementacionTareas.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allComplete = totalCount > 0 && completedCount === totalCount

  // Solicitud Original data
  const sol = solicitudOriginal?.solicitud
  const solComentarios = solicitudOriginal?.comentarios || []

  // Estimacion data
  const estimacion = costos.length > 0 ? {
    planificado: costos.reduce((s, c) => s + (c.tipo === 'planificado' ? (c.cantidad || 1) * (c.valor || 0) : 0), 0),
    real: costos.reduce((s, c) => s + (c.tipo === 'real' ? (c.cantidad || 1) * (c.valor || 0) : 0), 0)
  } : null

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Link to={`${linkPrefix}/implementacion`}>
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Volver a Implementación</Button>
      </Link>

      <Card>
        <div style={{ marginBottom: 24 }}>
          <Space align="center" wrap>
            <Title level={4} style={{ margin: 0, color: INEMEC_RED }}>{proyecto.codigo}</Title>
            <Tag color="cyan">En Implementación</Tag>
            {proyecto.prioridad && <Tag color={prioridadColors[proyecto.prioridad]}>{proyecto.prioridad}</Tag>}
          </Space>
          <Title level={4} style={{ margin: '8px 0 0' }}>{proyecto.titulo}</Title>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {proyecto.lider_nombre && (
              <Text type="secondary"><UserOutlined /> Líder: {proyecto.lider_nombre}</Text>
            )}
            {!readOnly && isLead && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={!allComplete}
                onClick={handleFinalizar}
                style={allComplete ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
              >
                Finalizar Implementación
              </Button>
            )}
          </div>
        </div>

        {/* Implementation Gantt — front and center */}
        <Card
          title={<><ToolOutlined /> Plan de Implementación</>}
          size="small"
          style={{ marginBottom: 24 }}
          extra={
            <Space>
              <Text>{completedCount}/{totalCount} tareas completadas</Text>
              <Progress percent={progressPct} size="small" style={{ width: 120 }} />
            </Space>
          }
        >
          {implementacionTareas.length > 0 ? (
            <GanttChart
              tareas={implementacionTareas.map(t => ({ ...t, titulo: t.titulo }))}
              onTaskUpdate={readOnly ? undefined : (tareaId, data) => handleImplTareaProgreso(tareaId, data)}
              disabled={readOnly || !isLead}
              isLead={!readOnly && isLead}
              userId={user?.id}
              holidays={holidays}
              members={[]}
            />
          ) : (
            <Text type="secondary">No hay tareas de implementación definidas</Text>
          )}
        </Card>

        {/* Collapsible: Solicitud Original */}
        {sol && (
          <Collapse ghost style={{ marginBottom: 24 }}>
            <Panel
              header={<Space><FileTextOutlined /> <Text strong>Solicitud Original</Text> <Tag>{sol.codigo}</Tag></Space>}
              key="solicitud-original"
            >
              {renderSolicitudOriginal(sol, solComentarios, evaluacionOriginal, holidays)}
            </Panel>
          </Collapse>
        )}

        {/* Collapsible: Desarrollo del Proyecto */}
        <Collapse ghost style={{ marginBottom: 24 }}>
          <Panel
            header={<Space><CalendarOutlined /> <Text strong>Desarrollo del Proyecto</Text></Space>}
            key="desarrollo"
          >
            {renderDesarrollo(proyecto, tareas, miembros, costos, estimacion, pausas, holidays)}
          </Panel>
        </Collapse>

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

        {!readOnly && (
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
        )}
      </Card>
    </div>
  )
}

// --- Helper render functions ---

function renderSolicitudOriginal(sol, solComentarios, evaluacionOriginal, holidays) {
  const identificacion = sol.datos_solicitante || sol.identificacion || {}
  const sponsor = sol.datos_patrocinador || sol.sponsor || {}
  const stakeholders = sol.stakeholders || {}
  const problematica = sol.descripcion_problema || sol.problematica || {}
  const urgencia = sol.urgencia || {}
  const solucion = sol.solucion_propuesta || sol.solucion || {}
  const beneficios = sol.beneficios || {}
  const kpis = sol.kpis || sol.declaracion?.indicadores || []

  return (
    <>
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
          </Descriptions>
        </Card>
      )}

      {/* Problemática */}
      <Card title={<><AlertOutlined /> Descripción de la Problemática</>} size="small" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Título">{problematica.titulo || sol.titulo || '--'}</Descriptions.Item>
          <Descriptions.Item label="Situación Actual"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.situacion_actual || problematica.problema_actual || '--'}</span></Descriptions.Item>
          <Descriptions.Item label="Afectación"><span style={{ whiteSpace: 'pre-wrap' }}>{problematica.afectacion_operacion || '--'}</span></Descriptions.Item>
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
          <Descriptions.Item label="Forma de Entrega">{getLabel(solucion.forma_entrega, formaEntregaLabels)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Integracion plan */}
      <IntegracionDisplay integracion={sol.integracion} holidays={holidays} />

      {/* Beneficios */}
      <Card title={<><TrophyOutlined /> Beneficios Esperados</>} size="small" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Descripción"><span style={{ whiteSpace: 'pre-wrap' }}>{beneficios.descripcion || '--'}</span></Descriptions.Item>
          <Descriptions.Item label="Mejora Concreta"><span style={{ whiteSpace: 'pre-wrap' }}>{beneficios.mejora_concreta || '--'}</span></Descriptions.Item>
        </Descriptions>
      </Card>

      {/* KPIs */}
      {kpis.length > 0 && (
        <Card title={<><LineChartOutlined /> KPIs</>} size="small" style={{ marginBottom: 16 }}>
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
        </Card>
      )}

      {/* NT Evaluation */}
      {evaluacionOriginal && (
        <Card title={<><CheckCircleOutlined /> Evaluación NT</>} size="small" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Resumen Ejecutivo"><span style={{ whiteSpace: 'pre-wrap' }}>{evaluacionOriginal.resumen_ejecutivo || '--'}</span></Descriptions.Item>
            <Descriptions.Item label="Recomendación">
              <Tag color={recomendacionColors[evaluacionOriginal.recomendacion]}>{evaluacionOriginal.recomendacion?.toUpperCase() || '--'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Justificación" span={2}><span style={{ whiteSpace: 'pre-wrap' }}>{evaluacionOriginal.justificacion || '--'}</span></Descriptions.Item>
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
    </>
  )
}

function renderDesarrollo(proyecto, tareas, miembros, costos, estimacion, pausas, holidays) {
  const costoPlanificado = costos.filter(c => c.tipo === 'planificado').reduce((s, c) => s + ((c.cantidad || 1) * (c.valor || 0)), 0)
  const costoReal = costos.filter(c => c.tipo === 'real').reduce((s, c) => s + ((c.cantidad || 1) * (c.valor || 0)), 0)
  const diferencia = costoPlanificado - costoReal

  return (
    <>
      {/* Project Dates */}
      <Card title={<><CalendarOutlined /> Fechas del Proyecto</>} size="small" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Inicio Estimado">{proyecto.fecha_inicio ? dayjs(proyecto.fecha_inicio).format('DD/MM/YYYY') : '--'}</Descriptions.Item>
          <Descriptions.Item label="Fin Estimado">{proyecto.fecha_fin ? dayjs(proyecto.fecha_fin).format('DD/MM/YYYY') : '--'}</Descriptions.Item>
          <Descriptions.Item label="Inicio Real">{proyecto.fecha_inicio_real ? dayjs(proyecto.fecha_inicio_real).format('DD/MM/YYYY') : '--'}</Descriptions.Item>
          <Descriptions.Item label="Fin Real">{proyecto.fecha_fin_real ? dayjs(proyecto.fecha_fin_real).format('DD/MM/YYYY') : '--'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Development Gantt */}
      {tareas.length > 0 && (
        <>
          <Divider orientation="left"><CalendarOutlined /> Cronograma de Desarrollo</Divider>
          <GanttChart tareas={tareas} disabled holidays={holidays} members={[]} />
        </>
      )}

      {/* Team */}
      {miembros.length > 0 && (
        <>
          <Divider orientation="left"><TeamOutlined /> Equipo</Divider>
          <Table
            dataSource={miembros}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
              { title: 'Rol', dataIndex: 'rol_proyecto', key: 'rol', render: v => v === 'lider' ? <Tag color="gold">Líder</Tag> : <Tag>Miembro</Tag> },
              { title: 'Asignado', dataIndex: 'fecha_asignacion', key: 'fecha', render: v => v ? dayjs(v).format('DD/MM/YYYY') : '--' }
            ]}
          />
        </>
      )}

      {/* Costs */}
      {costos.length > 0 && (
        <>
          <Divider orientation="left"><DollarOutlined /> Costos</Divider>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small"><Text type="secondary">Planificado</Text><Title level={5} style={{ margin: 0 }}>{formatCOP(costoPlanificado)}</Title></Card>
            </Col>
            <Col span={8}>
              <Card size="small"><Text type="secondary">Real</Text><Title level={5} style={{ margin: 0 }}>{formatCOP(costoReal)}</Title></Card>
            </Col>
            <Col span={8}>
              <Card size="small"><Text type="secondary">Diferencia</Text><Title level={5} style={{ margin: 0, color: diferencia >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatCOP(diferencia)}</Title></Card>
            </Col>
          </Row>
        </>
      )}

      {/* Pause History */}
      {pausas.length > 0 && (
        <>
          <Divider orientation="left"><PauseCircleOutlined /> Historial de Pausas</Divider>
          <Timeline>
            {pausas.map(p => (
              <Timeline.Item key={p.id} color={p.fecha_reanudacion ? 'green' : 'orange'}>
                <Text strong>Pausado: </Text>
                <Text>{dayjs(p.fecha_pausa).format('DD/MM/YYYY HH:mm')}</Text>
                {p.fecha_reanudacion && (
                  <>
                    <Text strong style={{ marginLeft: 12 }}>Reanudado: </Text>
                    <Text>{dayjs(p.fecha_reanudacion).format('DD/MM/YYYY HH:mm')}</Text>
                  </>
                )}
                <Paragraph style={{ margin: '4px 0' }}>{p.motivo}</Paragraph>
              </Timeline.Item>
            ))}
          </Timeline>
        </>
      )}
    </>
  )
}

export default function NTImplementacionDetail() {
  return <ImplementacionDetail linkPrefix="/nt" />
}
