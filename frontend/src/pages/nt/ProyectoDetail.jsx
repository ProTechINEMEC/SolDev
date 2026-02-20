import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Progress, Modal, Form, Input, InputNumber, Table, Alert, Collapse,
  Timeline, message, Row, Col, Tooltip, Slider, Badge, Empty
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CalendarOutlined, TeamOutlined,
  ExclamationCircleOutlined, HistoryOutlined, UserOutlined, WarningOutlined
} from '@ant-design/icons'
import { solicitudesApi, usuariosApi } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Panel } = Collapse

// INEMEC Brand Colors
const INEMEC_RED = '#D52B1E'

const estadoColors = {
  agendado: 'blue',
  en_desarrollo: 'processing',
  pausado: 'warning',
  completado: 'success',
  cancelado: 'error'
}

const estadoLabels = {
  agendado: 'Agendado',
  en_desarrollo: 'En Desarrollo',
  pausado: 'Pausado',
  completado: 'Completado',
  cancelado: 'Cancelado'
}

const prioridadColors = {
  critica: 'red',
  alta: 'orange',
  media: 'blue',
  baja: 'green'
}

function NTProyectoDetail() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [solicitud, setSolicitud] = useState(null)
  const [progresoData, setProgresoData] = useState(null)
  const [pausas, setPausas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [comentarios, setComentarios] = useState([])

  // Modal states
  const [pauseModalVisible, setPauseModalVisible] = useState(false)
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [emergentModalVisible, setEmergentModalVisible] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [pauseForm] = Form.useForm()
  const [cancelForm] = Form.useForm()
  const [emergentForm] = Form.useForm()
  const [comment, setComment] = useState('')

  useEffect(() => {
    loadData()
    loadUsuarios()
  }, [codigo])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch solicitud and progress data
      const [solicitudRes, progresoRes, pausasRes] = await Promise.all([
        solicitudesApi.get(codigo),
        solicitudesApi.getProgreso(codigo),
        solicitudesApi.getPausas(codigo)
      ])

      setSolicitud(solicitudRes.data.solicitud)
      setProgresoData(progresoRes.data)
      setPausas(pausasRes.data.pausas || [])
      setComentarios(solicitudRes.data.comentarios || [])
    } catch (error) {
      console.error('Error loading project:', error)
      message.error('Error al cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  const loadUsuarios = async () => {
    try {
      const response = await usuariosApi.getByRole('nuevas_tecnologias')
      setUsuarios(response.data.usuarios || [])
    } catch {
      // Ignore
    }
  }

  // Check if current user is the project lead
  const isLead = progresoData?.evaluacion?.lider_id === user?.id

  // Filter tasks based on role
  const getVisibleTasks = () => {
    if (!progresoData?.tareas) return []

    if (isLead) {
      return progresoData.tareas
    }

    // Non-lead users only see their assigned tasks
    return progresoData.tareas.filter(t =>
      t.asignado_id === user?.id ||
      (t.asignados_ids && t.asignados_ids.includes(user?.id))
    )
  }

  const visibleTasks = getVisibleTasks()

  // Group tasks by phase
  const getTasksByPhase = () => {
    const phases = {}
    for (const task of visibleTasks) {
      const phase = task.fase || 'Sin Fase'
      if (!phases[phase]) {
        phases[phase] = []
      }
      phases[phase].push(task)
    }
    return phases
  }

  const tasksByPhase = getTasksByPhase()

  // Handlers
  const handleIniciarDesarrollo = async () => {
    setActionLoading(true)
    try {
      await solicitudesApi.iniciarDesarrollo(codigo)
      message.success('Proyecto iniciado en desarrollo')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.message || 'Error al iniciar desarrollo')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePausar = async () => {
    try {
      const values = await pauseForm.validateFields()
      setActionLoading(true)
      await solicitudesApi.pausar(codigo, { motivo: values.motivo })
      message.success('Proyecto pausado')
      setPauseModalVisible(false)
      pauseForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.message || 'Error al pausar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReanudar = async () => {
    setActionLoading(true)
    try {
      await solicitudesApi.reanudar(codigo)
      message.success('Proyecto reanudado')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.message || 'Error al reanudar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelar = async () => {
    try {
      const values = await cancelForm.validateFields()
      setActionLoading(true)
      await solicitudesApi.cancelarProyecto(codigo, { motivo: values.motivo })
      message.success('Proyecto cancelado')
      setCancelModalVisible(false)
      cancelForm.resetFields()
      navigate('/nt/proyectos')
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.message || 'Error al cancelar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompletar = async () => {
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(codigo, { estado: 'completado' })
      message.success('Proyecto completado')
      loadData()
    } catch (error) {
      message.error(error.response?.data?.message || 'Error al completar proyecto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateTaskProgress = async (tareaId, progreso) => {
    try {
      await solicitudesApi.updateTareaProgreso(codigo, tareaId, { progreso })
      // Update local state immediately for responsiveness
      setProgresoData(prev => ({
        ...prev,
        tareas: prev.tareas.map(t =>
          t.id === tareaId ? { ...t, progreso, completado: progreso === 100 } : t
        )
      }))
    } catch (error) {
      message.error('Error al actualizar progreso')
    }
  }

  const handleAddEmergentTask = async () => {
    try {
      const values = await emergentForm.validateFields()
      setActionLoading(true)
      await solicitudesApi.addTareaEmergente(codigo, values)
      message.success('Tarea emergente creada')
      setEmergentModalVisible(false)
      emergentForm.resetFields()
      loadData()
    } catch (error) {
      if (error.errorFields) return
      message.error(error.response?.data?.message || 'Error al crear tarea')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    try {
      await solicitudesApi.addComment(codigo, { contenido: comment, tipo: 'interno' })
      message.success('Comentario agregado')
      setComment('')
      loadData()
    } catch (error) {
      message.error('Error al agregar comentario')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!solicitud) {
    return <Card><Title level={4}>Proyecto no encontrado</Title></Card>
  }

  const isPaused = solicitud.estado === 'pausado'
  const isActive = solicitud.estado === 'en_desarrollo'
  const isAgendado = solicitud.estado === 'agendado'
  const activePause = pausas.find(p => !p.fecha_fin)

  return (
    <div style={{ padding: 24 }}>
      <Link to="/nt/proyectos">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Volver a Proyectos</Button>
      </Link>

      {/* Pause Alert */}
      {isPaused && activePause && (
        <Alert
          type="warning"
          showIcon
          icon={<PauseCircleOutlined />}
          message="Proyecto Pausado"
          description={
            <div>
              <div><strong>Motivo:</strong> {activePause.motivo}</div>
              <div><strong>Desde:</strong> {dayjs(activePause.fecha_inicio).format('DD/MM/YYYY HH:mm')}</div>
              <div><strong>Días pausado:</strong> {Math.ceil((new Date() - new Date(activePause.fecha_inicio)) / (1000 * 60 * 60 * 24))}</div>
            </div>
          }
          style={{ marginBottom: 16 }}
          action={
            isLead && (
              <Button type="primary" onClick={handleReanudar} loading={actionLoading}>
                Reanudar Proyecto
              </Button>
            )
          }
        />
      )}

      <Card>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Space>
              <Title level={3} style={{ margin: 0, color: INEMEC_RED }}>{solicitud.codigo}</Title>
              <Tag color={estadoColors[solicitud.estado]}>{estadoLabels[solicitud.estado]}</Tag>
              <Tag color={prioridadColors[solicitud.prioridad]}>{solicitud.prioridad}</Tag>
            </Space>
            <Title level={4} style={{ margin: '8px 0' }}>{solicitud.titulo}</Title>
            {progresoData?.evaluacion?.lider_nombre && (
              <Text type="secondary">
                <TeamOutlined style={{ marginRight: 4 }} />
                Líder: {progresoData.evaluacion.lider_nombre}
              </Text>
            )}
          </div>

          {/* Action Buttons - Only for Lead */}
          {isLead && (
            <Space>
              {isAgendado && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={actionLoading}
                  onClick={handleIniciarDesarrollo}
                >
                  Iniciar Desarrollo
                </Button>
              )}
              {isActive && (
                <>
                  <Button
                    icon={<PauseCircleOutlined />}
                    onClick={() => setPauseModalVisible(true)}
                  >
                    Pausar
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleCompletar}
                    loading={actionLoading}
                  >
                    Completar
                  </Button>
                </>
              )}
              {(isActive || isPaused) && (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setCancelModalVisible(true)}
                >
                  Cancelar
                </Button>
              )}
            </Space>
          )}
        </div>

        {/* Progress Section */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="Progreso del Proyecto">
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={progresoData?.progreso_teorico || 0}
                      strokeColor="#8c8c8c"
                      size={100}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Teórico</Text>
                      <Tooltip title="Días en desarrollo / Días planificados (excluyendo pausas)">
                        <ExclamationCircleOutlined style={{ marginLeft: 4, cursor: 'help' }} />
                      </Tooltip>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={progresoData?.progreso_practico || 0}
                      strokeColor={INEMEC_RED}
                      size={100}
                    />
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
                  {solicitud.fecha_inicio_programada
                    ? dayjs(solicitud.fecha_inicio_programada).format('DD/MM/YYYY')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<><CalendarOutlined /> Fecha Fin</>}>
                  {solicitud.fecha_fin_programada
                    ? dayjs(solicitud.fecha_fin_programada).format('DD/MM/YYYY')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Tareas">
                  {progresoData?.tareas_completadas || 0} / {progresoData?.total_tareas || 0} completadas
                </Descriptions.Item>
                <Descriptions.Item label="Días Pausados">
                  {solicitud.dias_pausados_total || 0} días
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Tasks by Phase */}
        <Divider orientation="left">
          Tareas por Fase
          {isLead && isActive && (
            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={() => setEmergentModalVisible(true)}
            >
              Tarea Emergente
            </Button>
          )}
        </Divider>

        {Object.keys(tasksByPhase).length === 0 ? (
          <Empty description={isLead ? "No hay tareas definidas" : "No tiene tareas asignadas"} />
        ) : (
          <Collapse defaultActiveKey={Object.keys(tasksByPhase)} ghost>
            {Object.entries(tasksByPhase).map(([fase, tareas]) => {
              const completedInPhase = tareas.filter(t => t.completado).length
              const isEmergent = fase === 'Tareas Emergentes'

              return (
                <Panel
                  key={fase}
                  header={
                    <Space>
                      {isEmergent && <WarningOutlined style={{ color: '#fa8c16' }} />}
                      <Text strong>{fase}</Text>
                      <Badge
                        count={`${completedInPhase}/${tareas.length}`}
                        style={{
                          backgroundColor: completedInPhase === tareas.length ? '#52c41a' : '#1890ff'
                        }}
                      />
                    </Space>
                  }
                >
                  {tareas.map(tarea => (
                    <Card
                      key={tarea.id}
                      size="small"
                      style={{
                        marginBottom: 8,
                        borderLeft: tarea.completado ? '3px solid #52c41a' : '3px solid #d9d9d9'
                      }}
                    >
                      <Row gutter={16} align="middle">
                        <Col flex="auto">
                          <Text strong>{tarea.nombre || tarea.titulo}</Text>
                          {tarea.descripcion && (
                            <div><Text type="secondary" style={{ fontSize: 12 }}>{tarea.descripcion}</Text></div>
                          )}
                          <Space style={{ marginTop: 4 }}>
                            {tarea.asignado_nombre && (
                              <Tag icon={<UserOutlined />}>{tarea.asignado_nombre}</Tag>
                            )}
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {dayjs(tarea.fecha_inicio).format('DD/MM')} - {dayjs(tarea.fecha_fin).format('DD/MM/YYYY')}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              ({tarea.duracion_dias || tarea.duracion} días)
                            </Text>
                          </Space>
                        </Col>
                        <Col style={{ minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Slider
                              value={tarea.progreso || 0}
                              onChange={(val) => handleUpdateTaskProgress(tarea.id, val)}
                              disabled={isPaused || (!isLead && tarea.asignado_id !== user?.id)}
                              style={{ flex: 1, margin: 0 }}
                              tooltip={{ formatter: (val) => `${val}%` }}
                            />
                            <Text style={{ minWidth: 40, textAlign: 'right' }}>
                              {tarea.progreso || 0}%
                            </Text>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </Panel>
              )
            })}
          </Collapse>
        )}

        {/* Pause History */}
        {pausas.length > 0 && (
          <>
            <Divider orientation="left">
              <HistoryOutlined /> Historial de Pausas
            </Divider>
            <Timeline>
              {pausas.map(pausa => (
                <Timeline.Item
                  key={pausa.id}
                  color={pausa.fecha_fin ? 'gray' : 'orange'}
                >
                  <div>
                    <Text strong>{pausa.motivo}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(pausa.fecha_inicio).format('DD/MM/YYYY HH:mm')}
                    {pausa.fecha_fin
                      ? ` - ${dayjs(pausa.fecha_fin).format('DD/MM/YYYY HH:mm')} (${pausa.dias_pausados} días)`
                      : ' - En curso'}
                  </Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Por: {pausa.creado_por_nombre}
                    </Text>
                  </div>
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
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
              </Text>
              <Paragraph style={{ margin: '4px 0' }}>{c.contenido}</Paragraph>
            </Timeline.Item>
          ))}
          {comentarios.length === 0 && (
            <Text type="secondary">Sin comentarios</Text>
          )}
        </Timeline>

        <Space.Compact style={{ width: '100%', marginTop: 16 }}>
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Agregar comentario..."
            rows={2}
          />
          <Button type="primary" onClick={handleAddComment}>
            Enviar
          </Button>
        </Space.Compact>
      </Card>

      {/* Pause Modal */}
      <Modal
        title="Pausar Proyecto"
        open={pauseModalVisible}
        onOk={handlePausar}
        onCancel={() => setPauseModalVisible(false)}
        confirmLoading={actionLoading}
        okText="Pausar"
        cancelText="Cancelar"
      >
        <Form form={pauseForm} layout="vertical">
          <Form.Item
            name="motivo"
            label="Motivo de la pausa"
            rules={[{ required: true, message: 'Ingrese el motivo de la pausa' }]}
          >
            <TextArea rows={3} placeholder="Explique el motivo por el cual se pausa el proyecto..." />
          </Form.Item>
        </Form>
        <Alert
          type="info"
          message="Al pausar el proyecto:"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Los días de pausa no contarán para el progreso teórico</li>
              <li>Las fechas en el calendario se desplazarán</li>
              <li>Se notificará a Gerencia y al solicitante</li>
            </ul>
          }
        />
      </Modal>

      {/* Cancel Modal */}
      <Modal
        title="Cancelar Proyecto"
        open={cancelModalVisible}
        onOk={handleCancelar}
        onCancel={() => setCancelModalVisible(false)}
        confirmLoading={actionLoading}
        okText="Cancelar Proyecto"
        okButtonProps={{ danger: true }}
        cancelText="Volver"
      >
        <Alert
          type="error"
          message="Esta acción no se puede deshacer"
          description="El proyecto será marcado como cancelado y no podrá continuarse."
          style={{ marginBottom: 16 }}
        />
        <Form form={cancelForm} layout="vertical">
          <Form.Item
            name="motivo"
            label="Motivo de la cancelación"
            rules={[{ required: true, message: 'Ingrese el motivo de la cancelación' }]}
          >
            <TextArea rows={3} placeholder="Explique el motivo por el cual se cancela el proyecto..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Emergent Task Modal */}
      <Modal
        title="Nueva Tarea Emergente"
        open={emergentModalVisible}
        onOk={handleAddEmergentTask}
        onCancel={() => setEmergentModalVisible(false)}
        confirmLoading={actionLoading}
        okText="Crear"
        cancelText="Cancelar"
      >
        <Alert
          type="warning"
          message="Las tareas emergentes son tareas no planificadas que surgieron durante el desarrollo."
          style={{ marginBottom: 16 }}
        />
        <Form form={emergentForm} layout="vertical">
          <Form.Item
            name="nombre"
            label="Nombre de la tarea"
            rules={[{ required: true, message: 'Ingrese el nombre' }]}
          >
            <Input placeholder="Nombre descriptivo de la tarea" />
          </Form.Item>
          <Form.Item
            name="duracion_dias"
            label="Duración (días)"
            rules={[{ required: true, message: 'Ingrese la duración' }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="asignado_id" label="Asignar a">
            <select
              style={{
                width: '100%',
                padding: '4px 11px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">Sin asignar</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <TextArea rows={2} placeholder="Descripción opcional de la tarea" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NTProyectoDetail
