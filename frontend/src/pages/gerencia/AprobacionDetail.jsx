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
  ScheduleOutlined, ProjectOutlined, FilePdfOutlined
} from '@ant-design/icons'
import { solicitudesApi, evaluacionesApi, calendarioApi, exportApi } from '../../services/api'
import SchedulingCalendar from '../../components/SchedulingCalendar'
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

function GerenciaAprobacionDetail() {
  const { id } = useParams()
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

  useEffect(() => {
    loadSolicitud()
  }, [id])

  const loadSolicitud = async () => {
    try {
      const [solicitudRes, evaluacionRes, reevalRes] = await Promise.all([
        solicitudesApi.get(id),
        evaluacionesApi.getBySolicitud(id).catch(() => ({ data: { evaluacion: null } })),
        solicitudesApi.getReevaluaciones(id).catch(() => ({ data: { reevaluaciones: [] } }))
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

  const checkConflicts = async (fechas) => {
    if (!fechas || !fechas[0] || !fechas[1]) return

    setConflictLoading(true)
    try {
      const response = await calendarioApi.getConflictos({
        fecha_inicio: fechas[0].format('YYYY-MM-DD'),
        fecha_fin: fechas[1].format('YYYY-MM-DD'),
        excluir_id: id
      })
      setScheduleData(prev => ({
        ...prev,
        fechas,
        conflictos: response.data.proyectos_superpuestos || []
      }))
    } catch (error) {
      console.error('Error checking conflicts:', error)
    } finally {
      setConflictLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!scheduleData.fechas || !scheduleData.fechas[0] || !scheduleData.fechas[1]) {
      message.error('Debe seleccionar las fechas de inicio y fin')
      return
    }

    setActionLoading(true)
    try {
      await solicitudesApi.agendar(id, {
        fecha_inicio: scheduleData.fechas[0].format('YYYY-MM-DD'),
        fecha_fin: scheduleData.fechas[1].format('YYYY-MM-DD'),
        comentario: scheduleData.comentario || 'Proyecto agendado por Gerencia'
      })
      message.success('Proyecto agendado exitosamente')
      setScheduleModalVisible(false)
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al agendar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectData.razon.trim()) {
      message.error('Debe proporcionar una razón para el rechazo')
      return
    }
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(id, {
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
      await solicitudesApi.solicitarReevaluacion(id, {
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
    if (!value) return '$0'
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
  const solicitante = solicitud.datos_solicitante || {}
  const patrocinador = solicitud.datos_patrocinador || {}
  const problema = solicitud.descripcion_problema || {}
  const solucion = solicitud.solucion_propuesta || {}
  const beneficios = solicitud.beneficios || {}
  const kpis = solicitud.kpis || []

  const isPending = solicitud.estado === 'pendiente_aprobacion_gerencia'
  const cronograma = evaluacion?.cronograma || {}
  const tareas = evaluacion?.tareas || []
  const estimacion = evaluacion?.estimacion || {}
  const equipo = evaluacion?.equipo || []

  const areasRevisarOptions = [
    { label: 'Cronograma', value: 'cronograma' },
    { label: 'Estimación de Costos', value: 'costos' },
    { label: 'Equipo Asignado', value: 'equipo' },
    { label: 'Alcance del Proyecto', value: 'alcance' },
    { label: 'Justificación', value: 'justificacion' },
    { label: 'Indicadores (KPIs)', value: 'kpis' }
  ]

  // Cost estimation columns
  const costColumns = [
    { title: 'Categoría', dataIndex: 'categoria', key: 'categoria' },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    { title: 'Monto', dataIndex: 'monto', key: 'monto', render: (v) => formatCOP(v), align: 'right' }
  ]

  // Build cost data from estimacion
  const costData = []
  if (estimacion.desarrollo_interno) {
    costData.push({
      key: 'desarrollo',
      categoria: 'Desarrollo Interno',
      descripcion: `${estimacion.desarrollo_interno.horas || 0} horas × ${formatCOP(estimacion.desarrollo_interno.tarifa_hora || 0)}`,
      monto: (estimacion.desarrollo_interno.horas || 0) * (estimacion.desarrollo_interno.tarifa_hora || 0)
    })
  }
  if (estimacion.infraestructura) {
    costData.push({
      key: 'infraestructura',
      categoria: 'Infraestructura',
      descripcion: estimacion.infraestructura.descripcion || 'Servidores, licencias, etc.',
      monto: estimacion.infraestructura.monto || 0
    })
  }
  if (estimacion.servicios_externos) {
    costData.push({
      key: 'servicios',
      categoria: 'Servicios Externos',
      descripcion: estimacion.servicios_externos.descripcion || 'Consultorías, APIs, etc.',
      monto: estimacion.servicios_externos.monto || 0
    })
  }
  const subtotal = costData.reduce((sum, item) => sum + item.monto, 0)
  const contingenciaPercent = estimacion.contingencia_porcentaje || 10
  const contingencia = subtotal * (contingenciaPercent / 100)
  const total = subtotal + contingencia

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
              </Space>
            }
            description={
              <Row gutter={[16, 8]}>
                <Col span={24}>
                  <Text>{evaluacion.resumen_ejecutivo?.substring(0, 300)}...</Text>
                </Col>
                <Col xs={12} md={6}>
                  <Text strong>Costo Estimado: </Text>
                  <Text>{formatCOP(total)}</Text>
                </Col>
                <Col xs={12} md={6}>
                  <Text strong>Duración: </Text>
                  <Text>{cronograma.duracion_dias || '-'} días</Text>
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
          {/* Tab 1: Solicitud Original */}
          <Tabs.TabPane tab={<span><FileTextOutlined /> Solicitud Original</span>} key="1">
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={12}>
                <Card size="small" title="Datos del Solicitante">
                  <p><strong>Nombre:</strong> {solicitante.nombre_completo || solicitante.nombre}</p>
                  <p><strong>Cargo:</strong> {solicitante.cargo}</p>
                  <p><strong>Área:</strong> {solicitante.area || solicitante.departamento}</p>
                  <p><strong>Email:</strong> {solicitante.correo || solicitante.email}</p>
                  <p><strong>Teléfono:</strong> {solicitante.telefono}</p>
                </Card>
              </Col>

              {patrocinador.nombre_completo && (
                <Col xs={24} lg={12}>
                  <Card size="small" title="Patrocinador/Sponsor">
                    <p><strong>Nombre:</strong> {patrocinador.nombre_completo}</p>
                    <p><strong>Cargo:</strong> {patrocinador.cargo}</p>
                    <p><strong>Área:</strong> {patrocinador.area}</p>
                    <p><strong>Email:</strong> {patrocinador.correo}</p>
                  </Card>
                </Col>
              )}

              <Col span={24}>
                <Card size="small" title="Descripción del Problema">
                  <Paragraph><strong>Situación Actual:</strong></Paragraph>
                  <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{problema.situacion_actual || problema.problema_actual}</Paragraph>

                  {(problema.impacto_descripcion || problema.impacto) && (
                    <>
                      <Paragraph><strong>Impacto:</strong></Paragraph>
                      <Paragraph>{problema.impacto_descripcion || problema.impacto}</Paragraph>
                    </>
                  )}
                </Card>
              </Col>

              <Col span={24}>
                <Card size="small" title="Solución Propuesta">
                  <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{solucion.descripcion_ideal || solucion.descripcion_solucion}</Paragraph>

                  {solucion.funcionalidades_minimas && solucion.funcionalidades_minimas.length > 0 && (
                    <>
                      <Paragraph><strong>Funcionalidades Mínimas:</strong></Paragraph>
                      <ul>
                        {solucion.funcionalidades_minimas.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </Col>

              <Col span={24}>
                <Card size="small" title="Beneficio Esperado">
                  <Paragraph>{beneficios.descripcion || beneficios.mejora_concreta}</Paragraph>
                </Card>
              </Col>

              {kpis.length > 0 && (
                <Col span={24}>
                  <Card size="small" title="Indicadores de Desempeño (KPIs)">
                    <List
                      dataSource={kpis}
                      renderItem={(kpi, index) => (
                        <List.Item>
                          <List.Item.Meta
                            title={`${index + 1}. ${kpi.nombre || kpi.indicador}`}
                            description={
                              <>
                                {kpi.valor_actual && <p><strong>Valor Actual:</strong> {kpi.valor_actual}</p>}
                                {kpi.valor_objetivo && <p><strong>Valor Objetivo:</strong> {kpi.valor_objetivo}</p>}
                              </>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              )}
            </Row>
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
                      </Space>
                      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{evaluacion.justificacion_recomendacion}</Paragraph>
                    </Space>
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert
                message="Sin evaluación NT"
                description="Esta solicitud aún no tiene una evaluación completa de Nuevas Tecnologías."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 3: Cronograma */}
          <Tabs.TabPane tab={<span><ProjectOutlined /> Cronograma</span>} key="3">
            {tareas && tareas.length > 0 ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title={`Cronograma Propuesto - ${cronograma.duracion_dias || tareas.length * 5} días laborables`}>
                    <Table
                      dataSource={tareas.map((t, i) => ({ ...t, key: i }))}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: 'Fase/Tarea', dataIndex: 'nombre', key: 'nombre' },
                        {
                          title: 'Inicio',
                          dataIndex: 'fecha_inicio',
                          key: 'fecha_inicio',
                          render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '-'
                        },
                        {
                          title: 'Fin',
                          dataIndex: 'fecha_fin',
                          key: 'fecha_fin',
                          render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '-'
                        },
                        {
                          title: 'Días',
                          dataIndex: 'duracion_dias',
                          key: 'duracion_dias',
                          align: 'center'
                        }
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert
                message="Sin cronograma"
                description="No se ha definido un cronograma para esta solicitud."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 4: Estimación de Costos */}
          <Tabs.TabPane tab={<span><DollarOutlined /> Costos</span>} key="4">
            {costData.length > 0 ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title="Estimación de Costos">
                    <Table
                      dataSource={costData}
                      columns={costColumns}
                      pagination={false}
                      size="small"
                      summary={() => (
                        <>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0}><Text strong>Subtotal</Text></Table.Summary.Cell>
                            <Table.Summary.Cell index={1}></Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">
                              <Text strong>{formatCOP(subtotal)}</Text>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0}>Contingencia ({contingenciaPercent}%)</Table.Summary.Cell>
                            <Table.Summary.Cell index={1}></Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">{formatCOP(contingencia)}</Table.Summary.Cell>
                          </Table.Summary.Row>
                          <Table.Summary.Row style={{ backgroundColor: '#f0f5ff' }}>
                            <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 16 }}>TOTAL</Text></Table.Summary.Cell>
                            <Table.Summary.Cell index={1}></Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">
                              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>{formatCOP(total)}</Text>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert
                message="Sin estimación de costos"
                description="No se ha definido una estimación de costos para esta solicitud."
                type="info"
              />
            )}
          </Tabs.TabPane>

          {/* Tab 5: Equipo */}
          <Tabs.TabPane tab={<span><TeamOutlined /> Equipo</span>} key="5">
            {equipo.length > 0 ? (
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <Card size="small" title="Equipo Propuesto">
                    <List
                      dataSource={equipo}
                      renderItem={(miembro) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<UserOutlined style={{ fontSize: 24 }} />}
                            title={
                              <Space>
                                <Text strong>{miembro.nombre}</Text>
                                {miembro.es_lider && <Tag color="gold">Líder</Tag>}
                              </Space>
                            }
                            description={
                              <>
                                <p>{miembro.rol}</p>
                                {miembro.horas_estimadas && <p><strong>Horas estimadas:</strong> {miembro.horas_estimadas}h</p>}
                              </>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
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
