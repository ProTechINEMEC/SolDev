import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Progress, Modal, Form, Input, DatePicker, Select, InputNumber, Table,
  Timeline, message, Popconfirm, Row, Col, Tooltip
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  UserAddOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SendOutlined
} from '@ant-design/icons'
import { proyectosApi, usuariosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const estadoColors = {
  planificacion: 'cyan',
  en_desarrollo: 'processing',
  pausado: 'warning',
  completado: 'success',
  cancelado: 'error'
}

const estadoLabels = {
  planificacion: 'Planificación',
  en_desarrollo: 'En Desarrollo',
  pausado: 'Pausado',
  completado: 'Completado',
  cancelado: 'Cancelado'
}

function NTProyectoDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [taskModalVisible, setTaskModalVisible] = useState(false)
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [taskForm] = Form.useForm()
  const [memberForm] = Form.useForm()

  useEffect(() => {
    loadData()
    loadUsuarios()
  }, [id])

  const loadData = async () => {
    try {
      const response = await proyectosApi.get(id)
      setData(response.data)
    } catch (error) {
      console.error('Error loading project:', error)
      message.error('Error al cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  const loadUsuarios = async () => {
    try {
      const response = await usuariosApi.list({})
      setUsuarios(response.data.usuarios || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const handleChangeEstado = async (nuevoEstado) => {
    setActionLoading(true)
    try {
      await proyectosApi.updateEstado(id, { estado: nuevoEstado })
      message.success('Estado actualizado')
      loadData()
    } catch (error) {
      message.error(error.message || 'Error al actualizar estado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddTask = () => {
    setEditingTask(null)
    taskForm.resetFields()
    taskForm.setFieldsValue({ color: '#D52B1E', progreso: 0 })
    setTaskModalVisible(true)
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    taskForm.setFieldsValue({
      ...task,
      fecha_inicio: dayjs(task.fecha_inicio),
      fecha_fin: dayjs(task.fecha_fin)
    })
    setTaskModalVisible(true)
  }

  const handleSaveTask = async () => {
    try {
      const values = await taskForm.validateFields()
      const taskData = {
        ...values,
        fecha_inicio: values.fecha_inicio.format('YYYY-MM-DD'),
        fecha_fin: values.fecha_fin.format('YYYY-MM-DD')
      }

      if (editingTask) {
        await proyectosApi.updateTarea(id, editingTask.id, taskData)
        message.success('Tarea actualizada')
      } else {
        await proyectosApi.createTarea(id, taskData)
        message.success('Tarea creada')
      }
      setTaskModalVisible(false)
      loadData()
    } catch (error) {
      message.error(error.message || 'Error al guardar tarea')
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      await proyectosApi.deleteTarea(id, taskId)
      message.success('Tarea eliminada')
      loadData()
    } catch (error) {
      message.error('Error al eliminar tarea')
    }
  }

  const handleAddMember = async () => {
    try {
      const values = await memberForm.validateFields()
      await proyectosApi.addMiembro(id, values)
      message.success('Miembro agregado')
      setMemberModalVisible(false)
      memberForm.resetFields()
      loadData()
    } catch (error) {
      message.error(error.message || 'Error al agregar miembro')
    }
  }

  const handleRemoveMember = async (userId) => {
    try {
      await proyectosApi.removeMiembro(id, userId)
      message.success('Miembro eliminado')
      loadData()
    } catch (error) {
      message.error('Error al eliminar miembro')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!data?.proyecto) {
    return <Card><Title level={4}>Proyecto no encontrado</Title></Card>
  }

  const { proyecto, miembros, tareas, comentarios } = data

  // Calculate project progress
  const totalProgress = tareas.length > 0
    ? Math.round(tareas.reduce((acc, t) => acc + t.progreso, 0) / tareas.length)
    : 0

  // Calculate Gantt chart date range
  const allDates = tareas.flatMap(t => [dayjs(t.fecha_inicio), dayjs(t.fecha_fin)])
  const minDate = allDates.length > 0 ? dayjs.min(...allDates) : dayjs()
  const maxDate = allDates.length > 0 ? dayjs.max(...allDates) : dayjs().add(30, 'day')
  const totalDays = maxDate.diff(minDate, 'day') + 1

  return (
    <div>
      <Link to="/nt/proyectos">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Volver</Button>
      </Link>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>{proyecto.titulo}</Title>
            <Space>
              <Text type="secondary">{proyecto.codigo}</Text>
              <Tag color={estadoColors[proyecto.estado]}>{estadoLabels[proyecto.estado]}</Tag>
            </Space>
          </div>
          <Space>
            {proyecto.estado === 'planificacion' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={actionLoading}
                onClick={() => handleChangeEstado('en_desarrollo')}
              >
                Iniciar Desarrollo
              </Button>
            )}
            {proyecto.estado === 'en_desarrollo' && (
              <>
                <Button
                  icon={<PauseCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => handleChangeEstado('pausado')}
                >
                  Pausar
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => handleChangeEstado('completado')}
                >
                  Completar
                </Button>
              </>
            )}
            {proyecto.estado === 'pausado' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={actionLoading}
                onClick={() => handleChangeEstado('en_desarrollo')}
              >
                Reanudar
              </Button>
            )}
            {['planificacion', 'en_desarrollo', 'pausado'].includes(proyecto.estado) && (
              <Popconfirm
                title="¿Cancelar este proyecto?"
                onConfirm={() => handleChangeEstado('cancelado')}
              >
                <Button danger icon={<CloseCircleOutlined />} loading={actionLoading}>
                  Cancelar
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Fecha Inicio Estimada">
                {proyecto.fecha_inicio_estimada ? dayjs(proyecto.fecha_inicio_estimada).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Fecha Fin Estimada">
                {proyecto.fecha_fin_estimada ? dayjs(proyecto.fecha_fin_estimada).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Responsable">{proyecto.responsable_nombre || '-'}</Descriptions.Item>
              <Descriptions.Item label="Presupuesto">
                {proyecto.presupuesto_estimado ? `$${Number(proyecto.presupuesto_estimado).toLocaleString()}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Solicitud Origen" span={2}>
                {proyecto.solicitud_codigo ? (
                  <Link to={`/nt/solicitudes/${proyecto.solicitud_id}`}>{proyecto.solicitud_codigo}</Link>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title="Progreso General">
              <Progress
                type="circle"
                percent={totalProgress}
                format={(p) => `${p}%`}
                style={{ display: 'block', margin: '0 auto' }}
              />
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Text type="secondary">{tareas.filter(t => t.completada).length} de {tareas.length} tareas completadas</Text>
              </div>
            </Card>
          </Col>
        </Row>

        {proyecto.descripcion && (
          <>
            <Divider orientation="left">Descripción</Divider>
            <Paragraph>{proyecto.descripcion}</Paragraph>
          </>
        )}

        <Divider orientation="left">
          Equipo del Proyecto
          <Button
            type="link"
            icon={<UserAddOutlined />}
            onClick={() => setMemberModalVisible(true)}
          >
            Agregar
          </Button>
        </Divider>
        <Space wrap>
          {miembros.map(m => (
            <Tag
              key={m.usuario_id}
              closable
              onClose={() => handleRemoveMember(m.usuario_id)}
            >
              {m.nombre} ({m.rol_proyecto})
            </Tag>
          ))}
          {miembros.length === 0 && <Text type="secondary">Sin miembros asignados</Text>}
        </Space>

        <Divider orientation="left">
          Tareas (Gantt)
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={handleAddTask}
          >
            Nueva Tarea
          </Button>
        </Divider>

        {tareas.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 800, padding: '16px 0' }}>
              {/* Gantt Header */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ width: 200, fontWeight: 'bold' }}>Tarea</div>
                <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                  {Array.from({ length: Math.min(totalDays, 60) }, (_, i) => {
                    const date = minDate.add(i, 'day')
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          fontSize: 10,
                          color: '#999',
                          minWidth: 20
                        }}
                      >
                        {i % 7 === 0 ? date.format('DD/MM') : ''}
                      </div>
                    )
                  })}
                </div>
                <div style={{ width: 100, textAlign: 'center', fontWeight: 'bold' }}>Acciones</div>
              </div>

              {/* Gantt Rows */}
              {tareas.map((task) => {
                const taskStart = dayjs(task.fecha_inicio)
                const taskEnd = dayjs(task.fecha_fin)
                const startOffset = taskStart.diff(minDate, 'day')
                const duration = taskEnd.diff(taskStart, 'day') + 1
                const leftPercent = (startOffset / totalDays) * 100
                const widthPercent = (duration / totalDays) * 100

                return (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ width: 200 }}>
                      <Text ellipsis style={{ display: 'block' }}>{task.titulo}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {task.asignado_nombre || 'Sin asignar'}
                      </Text>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 30 }}>
                      <Tooltip
                        title={`${task.titulo}: ${taskStart.format('DD/MM')} - ${taskEnd.format('DD/MM')} (${task.progreso}%)`}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            height: 24,
                            top: 3,
                            backgroundColor: task.color || '#D52B1E',
                            borderRadius: 4,
                            opacity: 0.8,
                            minWidth: 20
                          }}
                        >
                          <div
                            style={{
                              width: `${task.progreso}%`,
                              height: '100%',
                              backgroundColor: 'rgba(255,255,255,0.4)',
                              borderRadius: 4
                            }}
                          />
                        </div>
                      </Tooltip>
                    </div>
                    <div style={{ width: 100, textAlign: 'center' }}>
                      <Space size="small">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEditTask(task)}
                        />
                        <Popconfirm
                          title="¿Eliminar tarea?"
                          onConfirm={() => handleDeleteTask(task.id)}
                        >
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">No hay tareas definidas</Text>
            <br />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTask} style={{ marginTop: 16 }}>
              Crear Primera Tarea
            </Button>
          </div>
        )}

        <Divider orientation="left">Comentarios</Divider>
        <Timeline>
          {comentarios?.map(c => (
            <Timeline.Item key={c.id}>
              <Text strong>{c.autor_nombre}</Text> - {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
              <Paragraph>{c.contenido}</Paragraph>
            </Timeline.Item>
          ))}
          {(!comentarios || comentarios.length === 0) && (
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
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={async () => {
              if (!comment.trim()) return
              // Note: Would need to add comment endpoint to proyectos API
              message.info('Comentarios en proyectos pendiente de implementar en API')
              setComment('')
            }}
          >
            Enviar
          </Button>
        </Space.Compact>
      </Card>

      {/* Task Modal */}
      <Modal
        title={editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
        open={taskModalVisible}
        onOk={handleSaveTask}
        onCancel={() => setTaskModalVisible(false)}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={taskForm} layout="vertical">
          <Form.Item
            name="titulo"
            label="Título"
            rules={[{ required: true, message: 'Ingrese el título' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fecha_inicio"
                label="Fecha Inicio"
                rules={[{ required: true, message: 'Seleccione fecha' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fecha_fin"
                label="Fecha Fin"
                rules={[{ required: true, message: 'Seleccione fecha' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="asignado_id" label="Asignado a">
                <Select allowClear placeholder="Seleccionar">
                  {usuarios.map(u => (
                    <Select.Option key={u.id} value={u.id}>{u.nombre}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="progreso" label="Progreso (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="color" label="Color">
            <Input type="color" style={{ width: 60, height: 32, padding: 2 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Member Modal */}
      <Modal
        title="Agregar Miembro"
        open={memberModalVisible}
        onOk={handleAddMember}
        onCancel={() => setMemberModalVisible(false)}
        okText="Agregar"
        cancelText="Cancelar"
      >
        <Form form={memberForm} layout="vertical">
          <Form.Item
            name="usuario_id"
            label="Usuario"
            rules={[{ required: true, message: 'Seleccione un usuario' }]}
          >
            <Select placeholder="Seleccionar usuario">
              {usuarios
                .filter(u => !miembros.find(m => m.usuario_id === u.id))
                .map(u => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="rol_proyecto" label="Rol en el Proyecto">
            <Select defaultValue="miembro">
              <Select.Option value="miembro">Miembro</Select.Option>
              <Select.Option value="desarrollador">Desarrollador</Select.Option>
              <Select.Option value="analista">Analista</Select.Option>
              <Select.Option value="lider">Líder</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NTProyectoDetail
