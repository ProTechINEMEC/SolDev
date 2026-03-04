import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Tabs, Timeline, Input, message, Modal, Row, Col, Alert, List,
  DatePicker, Table, Checkbox
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  FileTextOutlined, UserOutlined, ExclamationCircleOutlined,
  CalendarOutlined, DollarOutlined, TeamOutlined, RedoOutlined,
  ProjectOutlined, FilePdfOutlined, AlertOutlined,
  ClockCircleOutlined, ToolOutlined, TrophyOutlined, LineChartOutlined,
  CrownOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import { solicitudesApi, evaluacionesApi, exportApi, usuariosApi } from '../../services/api'
import WorkloadChart from '../../components/WorkloadChart'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const estadoColors = {
  pendiente_evaluacion_nt: 'warning',
  en_estudio: 'processing',
  descartado_nt: 'error',
  pendiente_revision_coordinador_nt: 'processing',
  rechazado_coordinador_nt: 'error',
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
  pendiente_evaluacion_nt: 'Pendiente Evaluacion NT',
  en_estudio: 'En Estudio',
  descartado_nt: 'Descartado NT',
  pendiente_revision_coordinador_nt: 'Pendiente Revision Coordinador',
  rechazado_coordinador_nt: 'Rechazado por Coordinador',
  pendiente_aprobacion_gerencia: 'Pendiente Aprobacion Gerencia',
  pendiente_reevaluacion: 'Pendiente Reevaluacion',
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
  actualizacion: 'Actualizacion',
  reporte_fallo: 'Reporte de Fallo',
  cierre_servicio: 'Cierre de Servicio'
}

const recomendacionColors = {
  aprobar: 'success',
  rechazar: 'error',
  aplazar: 'warning'
}

const areaLabels = {
  gerencia_general: 'Gerencia General',
  operaciones: 'Operaciones',
  operaciones_planta: 'Operaciones > Planta',
  operaciones_campo: 'Operaciones > Campo',
  operaciones_taller: 'Operaciones > Taller',
  administracion: 'Administracion',
  nuevas_tecnologias: 'Nuevas Tecnologias',
  ti: 'Tecnologia de la Informacion',
  rrhh: 'Recursos Humanos',
  hse: 'HSE',
  calidad: 'Calidad',
  compras: 'Compras',
  contabilidad: 'Contabilidad',
  mantenimiento: 'Mantenimiento',
  logistica: 'Logistica',
  comercial: 'Comercial',
  juridico: 'Juridico',
  proyectos: 'Proyectos'
}

const getLabel = (value, labels) => labels[value] || value || '--'

function CoordinadorNTRevisionDetail() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [evaluacion, setEvaluacion] = useState(null)
  const [reevaluaciones, setReevaluaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [approveModalVisible, setApproveModalVisible] = useState(false)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [reevalModalVisible, setReevalModalVisible] = useState(false)
  const [approveData, setApproveData] = useState({
    fecha_sugerida: null,
    comentario: ''
  })
  const [rejectData, setRejectData] = useState({ razon: '' })
  const [reevalData, setReevalData] = useState({
    comentario: '',
    areas_revisar: []
  })
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
      if (evaluacionRes.data.evaluacion) {
        setEvaluacion({
          ...evaluacionRes.data.evaluacion,
          cronograma: evaluacionRes.data.cronograma || {},
          tareas: evaluacionRes.data.tareas || [],
          estimacion: evaluacionRes.data.estimacion || {},
          equipo: evaluacionRes.data.equipo || []
        })
        // Set default fecha_sugerida from evaluation
        if (evaluacionRes.data.evaluacion.fecha_inicio_posible) {
          setApproveData(prev => ({
            ...prev,
            fecha_sugerida: dayjs(evaluacionRes.data.evaluacion.fecha_inicio_posible)
          }))
        }
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

  const handleApprove = async () => {
    if (!approveData.fecha_sugerida) {
      message.error('Debe seleccionar una fecha de inicio sugerida')
      return
    }
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(codigo, {
        estado: 'pendiente_aprobacion_gerencia',
        fecha_sugerida_coordinador: approveData.fecha_sugerida.format('YYYY-MM-DD'),
        comentario_coordinador: approveData.comentario
      })
      message.success('Proyecto aprobado y enviado a Gerencia')
      setApproveModalVisible(false)
      navigate('/coordinador-nt/revisiones')
    } catch (error) {
      message.error(error.message || 'Error al aprobar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectData.razon.trim()) {
      message.error('Debe proporcionar una razon para el rechazo')
      return
    }
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(codigo, {
        estado: 'rechazado_coordinador_nt',
        motivo_rechazo: rejectData.razon,
        comentario_coordinador: rejectData.razon
      })
      message.success('Proyecto rechazado')
      setRejectModalVisible(false)
      navigate('/coordinador-nt/revisiones')
    } catch (error) {
      message.error(error.message || 'Error al rechazar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReevaluation = async () => {
    if (!reevalData.comentario.trim()) {
      message.error('Debe proporcionar comentarios para la reevaluacion')
      return
    }
    setActionLoading(true)
    try {
      await solicitudesApi.solicitarReevaluacion(codigo, {
        comentario: reevalData.comentario,
        areas_revisar: reevalData.areas_revisar
      })
      message.success('Reevaluacion solicitada')
      setReevalModalVisible(false)
      navigate('/coordinador-nt/revisiones')
    } catch (error) {
      message.error(error.message || 'Error al solicitar reevaluacion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!evaluacion?.id) {
      message.warning('No hay evaluacion disponible para descargar')
      return
    }
    setPdfLoading(true)
    try {
      const response = await exportApi.evaluacionPdf(evaluacion.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `evaluacion-${data?.solicitud?.codigo || 'solicitud'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('PDF de evaluacion descargado')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      message.error('Error al descargar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

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

  const identificacion = solicitud.datos_solicitante || solicitud.identificacion || {}
  const problematica = solicitud.descripcion_problema || solicitud.problematica || {}
  const solucion = solicitud.solucion_propuesta || solicitud.solucion || {}
  const beneficios = solicitud.beneficios || {}

  const isPending = solicitud.estado === 'pendiente_revision_coordinador_nt'
  const tareas = evaluacion?.tareas || []
  const estimacion = evaluacion?.estimacion || {}
  const equipo = evaluacion?.equipo || []
  const cronograma = evaluacion?.cronograma || {}

  const fases = cronograma.fases || [...new Set(tareas.map(t => t.fase).filter(Boolean))]
  const equipoIds = cronograma.equipo_ids || equipo.map(e => e.usuario_id)
  const equipoForChart = ntUsers.filter(u => equipoIds.includes(u.id))
  const liderId = equipo.find(e => e.es_lider)?.usuario_id || cronograma.lider_id

  const tareasForChart = tareas.map(t => ({
    ...t,
    nombre: t.titulo || t.nombre,
    asignados_ids: t.asignados_ids || (t.asignado_id ? [t.asignado_id] : [])
  }))

  const areasRevisarOptions = [
    { label: 'Cronograma', value: 'cronograma' },
    { label: 'Estimacion de Costos', value: 'costos' },
    { label: 'Equipo Asignado', value: 'equipo' },
    { label: 'Alcance del Proyecto', value: 'alcance' },
    { label: 'Justificacion', value: 'justificacion' },
    { label: 'Indicadores (KPIs)', value: 'kpis' }
  ]

  const parseEstimacionItems = () => {
    const items = []
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

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/coordinador-nt/revisiones">
          <Button icon={<ArrowLeftOutlined />}>Volver a Revisiones</Button>
        </Link>
        {evaluacion && (
          <Button
            icon={<FilePdfOutlined />}
            loading={pdfLoading}
            onClick={handleDownloadPDF}
          >
            Descargar Evaluacion PDF
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
                icon={<CheckOutlined />}
                size="large"
                onClick={() => setApproveModalVisible(true)}
              >
                Aprobar y Enviar a Gerencia
              </Button>
              <Button
                icon={<RedoOutlined />}
                size="large"
                onClick={() => setReevalModalVisible(true)}
              >
                Solicitar Reevaluacion
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

        {/* NT Recommendation Summary */}
        {evaluacion && (
          <Alert
            message={
              <Space>
                <Text strong>Recomendacion NT:</Text>
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
                  <Text strong>Duracion: </Text>
                  <Text>{tareasForChart.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)} dias</Text>
                </Col>
              </Row>
            }
            type={evaluacion.recomendacion === 'aprobar' ? 'success' : evaluacion.recomendacion === 'rechazar' ? 'error' : 'warning'}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Reevaluation history */}
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
                              <Text type="secondary">Areas a revisar:</Text>
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
          {/* Tab 1: Solicitud Original */}
          <Tabs.TabPane tab={<span><FileTextOutlined /> Solicitud Original</span>} key="1">
            <Card title={<><UserOutlined /> Datos del Solicitante</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Nombre Completo">
                  {identificacion.nombre_completo || identificacion.nombre || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Cargo">
                  {identificacion.cargo || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Area">
                  {getLabel(identificacion.area || identificacion.departamento, areaLabels)}
                </Descriptions.Item>
                <Descriptions.Item label="Correo">
                  {identificacion.correo || identificacion.email || '--'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={<><AlertOutlined /> Descripcion de la Problematica</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Titulo">
                  {problematica.titulo || solicitud.titulo || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Situacion Actual">
                  <span style={{ whiteSpace: 'pre-wrap' }}>
                    {problematica.situacion_actual || problematica.problema_actual || '--'}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Afectacion a la Operacion">
                  <span style={{ whiteSpace: 'pre-wrap' }}>
                    {problematica.afectacion_operacion || '--'}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={<><ToolOutlined /> Propuesta de Solucion</>} size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Descripcion de la Solucion Ideal">
                  <span style={{ whiteSpace: 'pre-wrap' }}>
                    {solucion.descripcion_ideal || solucion.solucion_ideal || '--'}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={<><TrophyOutlined /> Beneficios Esperados</>} size="small">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Descripcion">
                  <span style={{ whiteSpace: 'pre-wrap' }}>
                    {beneficios.descripcion || '--'}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Tabs.TabPane>

          {/* Tab 2: Evaluacion NT */}
          <Tabs.TabPane tab={<span><UserOutlined /> Evaluacion NT</span>} key="2">
            {evaluacion ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title="Resumen Ejecutivo">
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{evaluacion.resumen_ejecutivo}</Paragraph>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" title="Justificacion de Recomendacion">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Text strong>Recomendacion:</Text>
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
              </Row>
            ) : (
              <Alert
                message="Sin evaluacion NT"
                description="Esta solicitud aun no tiene una evaluacion completa."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 3: Cronograma */}
          <Tabs.TabPane tab={<span><ProjectOutlined /> Cronograma</span>} key="3">
            {tareas && tareas.length > 0 ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title="Cronograma Propuesto">
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Text strong>Duracion Total: </Text>
                        <Tag color="blue">{tareasForChart.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)} dias habiles</Tag>
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

                    <Table
                      dataSource={tareasForChart.map((t, i) => ({ ...t, key: i }))}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: 'Fase', dataIndex: 'fase', key: 'fase', width: 120, render: (v) => v || '-' },
                        { title: 'Tarea', dataIndex: 'nombre', key: 'nombre' },
                        {
                          title: 'Asignados',
                          dataIndex: 'asignados_ids',
                          key: 'asignados',
                          render: (ids) => {
                            if (!ids || ids.length === 0) return '-'
                            return ids.map(id => {
                              const user = ntUsers.find(u => u.id === id)
                              return user ? <Tag key={id}>{user.nombre.split(' ')[0]}</Tag> : null
                            })
                          }
                        },
                        { title: 'Dias', dataIndex: 'duracion_dias', key: 'duracion_dias', align: 'center', width: 80 }
                      ]}
                    />
                  </Card>
                </Col>

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
              <Alert message="Sin cronograma" description="No se ha definido un cronograma." type="info" />
            )}
          </Tabs.TabPane>

          {/* Tab 4: Costos */}
          <Tabs.TabPane tab={<span><DollarOutlined /> Costos</span>} key="4">
            <Card size="small" title="Estimacion de Costos (NT)">
              {costItems.length > 0 ? (
                <Table
                  dataSource={costItems.map((item, i) => ({ ...item, key: i }))}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Concepto', dataIndex: 'concepto', key: 'concepto' },
                    { title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', render: (v) => formatCOP(v), align: 'right', width: 150 },
                    { title: 'IVA', dataIndex: 'iva', key: 'iva', render: (v) => formatCOP(v), align: 'right', width: 150 },
                    { title: 'Total', key: 'total', render: (_, r) => formatCOP((r.subtotal || 0) + (r.iva || 0)), align: 'right', width: 150 }
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
                <Alert message="Sin estimacion de costos" type="info" />
              )}
            </Card>
          </Tabs.TabPane>

          {/* Tab 5: Equipo */}
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
                      rol: equipoMember?.rol || (id === liderId ? 'Lider del Proyecto' : 'Miembro del equipo')
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
                            {miembro.es_lider && <Tag color="gold">Lider del Proyecto</Tag>}
                          </Space>
                        }
                        description={<>{miembro.email}</>}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ) : (
              <Alert message="Sin equipo asignado" type="info" />
            )}
          </Tabs.TabPane>

          {/* Tab 6: Historial */}
          <Tabs.TabPane tab="Historial" key="6">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Fecha de Creacion">
                {dayjs(solicitud.creado_en).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Ultima Actualizacion">
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
                    {c.tipo === 'reevaluacion' && <Tag color="orange" style={{ marginLeft: 8 }}>Reevaluacion</Tag>}
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

      {/* Approve Modal */}
      <Modal
        title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> Aprobar y Enviar a Gerencia</>}
        open={approveModalVisible}
        onOk={handleApprove}
        onCancel={() => setApproveModalVisible(false)}
        okText="Aprobar"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
        width={500}
      >
        <Alert
          message="Aprobacion de Proyecto"
          description="Al aprobar, el proyecto sera enviado a Gerencia para su revision final. Debe seleccionar una fecha de inicio sugerida."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Fecha de Inicio Sugerida *</Text>
          <DatePicker
            value={approveData.fecha_sugerida}
            onChange={(date) => setApproveData({ ...approveData, fecha_sugerida: date })}
            style={{ width: '100%', marginTop: 8 }}
            format="DD/MM/YYYY"
            placeholder="Seleccionar fecha"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </div>

        <div>
          <Text strong>Comentarios (opcional)</Text>
          <TextArea
            value={approveData.comentario}
            onChange={(e) => setApproveData({ ...approveData, comentario: e.target.value })}
            placeholder="Comentarios adicionales para Gerencia..."
            rows={3}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* Reevaluation Modal */}
      <Modal
        title={<><RedoOutlined /> Solicitar Reevaluacion</>}
        open={reevalModalVisible}
        onOk={handleReevaluation}
        onCancel={() => setReevalModalVisible(false)}
        okText="Solicitar Reevaluacion"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
        width={600}
      >
        <Alert
          message="Solicitar Ajustes"
          description="NT revisara y ajustara la evaluacion segun sus indicaciones. La solicitud volvera a ser enviada para su revision."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Areas a Revisar</Text>
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
            placeholder="Detalle que aspectos deben ser revisados o ajustados..."
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
          description="Esta accion es final. El proyecto sera rechazado y el solicitante sera notificado."
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div>
          <Text strong>Razon del Rechazo *</Text>
          <TextArea
            value={rejectData.razon}
            onChange={(e) => setRejectData({ ...rejectData, razon: e.target.value })}
            placeholder="Explique la razon del rechazo..."
            rows={4}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  )
}

export default CoordinadorNTRevisionDetail
