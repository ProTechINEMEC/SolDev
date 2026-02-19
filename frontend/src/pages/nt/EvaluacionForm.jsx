import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card, Typography, Button, Space, Steps, Form, Input, Select, Radio,
  message, Spin, Alert, Divider, Row, Col, InputNumber,
  Table, Tag, Modal, List, Tooltip, Transfer, Checkbox
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, SendOutlined, PlusOutlined,
  DeleteOutlined, CalendarOutlined, DollarOutlined, TeamOutlined,
  FileTextOutlined, CheckCircleOutlined, CrownOutlined
} from '@ant-design/icons'
import {
  solicitudesApi, evaluacionesApi, cronogramasApi, estimacionesApi, usuariosApi
} from '../../services/api'
import WorkloadChart from '../../components/WorkloadChart'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Step } = Steps

// Phase colors for Gantt chart
const phaseColors = {
  analisis: '#1890ff',
  diseno: '#722ed1',
  desarrollo: '#52c41a',
  pruebas: '#faad14',
  documentacion: '#13c2c2',
  entrega: '#eb2f96'
}

const phaseLabels = {
  analisis: 'Análisis',
  diseno: 'Diseño',
  desarrollo: 'Desarrollo',
  pruebas: 'Pruebas',
  documentacion: 'Documentación',
  entrega: 'Entrega'
}

function EvaluacionForm() {
  const { solicitudId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [solicitud, setSolicitud] = useState(null)
  const [evaluacion, setEvaluacion] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)

  // Form states
  const [resumenForm] = Form.useForm()
  const [cronogramaData, setCronogramaData] = useState({
    tareas: [],
    liderId: null,
    equipoIds: []  // Selected team member IDs
  })
  const [estimacionData, setEstimacionData] = useState({
    desarrollo_interno: [],
    infraestructura: [],
    servicios_externos: [],
    contingencia_porcentaje: 10
  })
  const [equipo, setEquipo] = useState([])
  const [ntUsers, setNtUsers] = useState([])

  // Template modal
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    loadData()
    loadNtUsers()
    loadTemplates()
  }, [solicitudId])

  const loadData = async () => {
    try {
      // Load solicitud
      const solicitudRes = await solicitudesApi.get(solicitudId)
      setSolicitud(solicitudRes.data.solicitud)

      // Try to load existing evaluation
      const evalRes = await evaluacionesApi.getBySolicitud(solicitudId)
      if (evalRes.data.evaluacion) {
        setEvaluacion(evalRes.data.evaluacion)

        // Populate forms
        resumenForm.setFieldsValue({
          resumen_ejecutivo: evalRes.data.evaluacion.resumen_ejecutivo,
          recomendacion: evalRes.data.evaluacion.recomendacion,
          justificacion_recomendacion: evalRes.data.evaluacion.justificacion_recomendacion,
          riesgos_identificados: evalRes.data.evaluacion.riesgos_identificados,
          notas_adicionales: evalRes.data.evaluacion.notas_adicionales
        })

        // Load cronograma
        if (evalRes.data.cronograma) {
          // Find the project leader from equipo
          const lider = evalRes.data.equipo?.find(m => m.es_lider)
          const cronograma = evalRes.data.cronograma
          setCronogramaData({
            id: cronograma.id,
            nombre: cronograma.nombre,
            equipoIds: cronograma.equipo_ids || [],
            tareas: (evalRes.data.tareas || []).map(t => ({
              id: t.id,
              nombre: t.titulo || t.nombre,
              duracion_dias: t.duracion_dias || 1,
              fase: t.fase || 'desarrollo',
              progreso: t.progreso || 0,
              dependencias: t.dependencias || [],
              orden: t.orden,
              asignado_id: t.asignado_id,
              asignados_ids: t.asignados_ids || []
            })),
            liderId: lider?.usuario_id || null
          })
        }

        // Load estimacion
        if (evalRes.data.estimacion) {
          const est = evalRes.data.estimacion
          setEstimacionData({
            id: est.id,
            desarrollo_interno: typeof est.desarrollo_interno === 'string'
              ? JSON.parse(est.desarrollo_interno) : est.desarrollo_interno || [],
            infraestructura: typeof est.infraestructura === 'string'
              ? JSON.parse(est.infraestructura) : est.infraestructura || [],
            servicios_externos: typeof est.servicios_externos === 'string'
              ? JSON.parse(est.servicios_externos) : est.servicios_externos || [],
            contingencia_porcentaje: est.contingencia_porcentaje || 10
          })
        }

        // Load equipo
        if (evalRes.data.equipo) {
          setEquipo(evalRes.data.equipo)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      message.error('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const loadNtUsers = async () => {
    try {
      const res = await usuariosApi.getByRole('nuevas_tecnologias')
      setNtUsers(res.data.usuarios || [])
    } catch (error) {
      console.error('Error loading NT users:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const res = await cronogramasApi.getTemplates()
      setTemplates(res.data.templates || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const handleSaveResumen = async (values) => {
    setSaving(true)
    try {
      if (evaluacion) {
        await evaluacionesApi.update(evaluacion.id, values)
        message.success('Resumen actualizado')
      } else {
        const res = await evaluacionesApi.create({
          solicitud_id: parseInt(solicitudId),
          ...values
        })
        setEvaluacion(res.data.evaluacion)
        message.success('Evaluación creada')
      }
      setCurrentStep(1)
    } catch (error) {
      message.error(error.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) {
      message.error('Seleccione una plantilla')
      return
    }

    try {
      const res = await cronogramasApi.getTemplate(selectedTemplate)
      const template = res.data.template

      setCronogramaData(prev => ({
        ...prev,
        nombre: template.nombre,
        tareas: template.tareas.map(t => ({
          ...t,
          id: t.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          asignados_ids: []  // Initialize empty assignees
        }))
      }))

      setTemplateModalVisible(false)
      message.success('Plantilla aplicada. Ahora asigne las tareas al equipo.')
    } catch (error) {
      message.error('Error al cargar plantilla')
    }
  }

  const handleSaveCronograma = async () => {
    if (!evaluacion) {
      message.error('Primero debe guardar el resumen')
      return
    }

    if (cronogramaData.equipoIds.length === 0) {
      message.error('Debe seleccionar al menos un miembro del equipo')
      return
    }

    if (cronogramaData.tareas.length === 0) {
      message.error('Agregue al menos una tarea')
      return
    }

    if (!cronogramaData.liderId) {
      message.error('Debe seleccionar un líder de proyecto')
      return
    }

    if (!cronogramaData.equipoIds.includes(cronogramaData.liderId)) {
      message.error('El líder debe ser parte del equipo seleccionado')
      return
    }

    // Validate that all tasks have names
    const emptyNameTask = cronogramaData.tareas.find(t => !t.nombre || t.nombre.trim() === '')
    if (emptyNameTask) {
      message.error('Todas las tareas deben tener un nombre')
      return
    }

    // Validate that assigned users are in the team
    for (const tarea of cronogramaData.tareas) {
      if (tarea.asignados_ids && tarea.asignados_ids.length > 0) {
        for (const userId of tarea.asignados_ids) {
          if (!cronogramaData.equipoIds.includes(userId)) {
            message.error(`Tarea "${tarea.nombre}" tiene asignado un usuario que no está en el equipo`)
            return
          }
        }
      }
    }

    setSaving(true)
    try {
      const data = {
        evaluacion_id: evaluacion.id,
        nombre: cronogramaData.nombre || 'Cronograma del Proyecto',
        equipo_ids: cronogramaData.equipoIds,
        tareas: cronogramaData.tareas.map((t, i) => ({
          nombre: t.nombre.trim(),
          duracion_dias: t.duracion_dias || 1,
          fase: t.fase || 'desarrollo',
          progreso: t.progreso || 0,
          dependencias: t.dependencias || [],
          orden: i,
          asignado_id: t.asignado_id || null,
          asignados_ids: t.asignados_ids || []
        }))
      }

      if (cronogramaData.id) {
        await cronogramasApi.update(cronogramaData.id, data)
        message.success('Cronograma actualizado')
      } else {
        try {
          const res = await cronogramasApi.create(data)
          setCronogramaData(prev => ({ ...prev, id: res.data.cronograma.id }))
          message.success('Cronograma guardado')
        } catch (createError) {
          // If cronograma already exists, try to get its ID and update instead
          if (createError.message?.includes('Ya existe')) {
            const existingRes = await evaluacionesApi.getBySolicitud(solicitudId)
            if (existingRes.data.cronograma?.id) {
              setCronogramaData(prev => ({ ...prev, id: existingRes.data.cronograma.id }))
              await cronogramasApi.update(existingRes.data.cronograma.id, data)
              message.success('Cronograma actualizado')
            } else {
              throw createError
            }
          } else {
            throw createError
          }
        }
      }

      // Save project leader
      await evaluacionesApi.setLider(evaluacion.id, cronogramaData.liderId)

      setCurrentStep(2)
    } catch (error) {
      console.error('Error saving cronograma:', error)
      message.error(error.message || 'Error al guardar cronograma')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEstimacion = async () => {
    if (!evaluacion) {
      message.error('Primero debe guardar el resumen')
      return
    }

    setSaving(true)
    try {
      const data = {
        evaluacion_id: evaluacion.id,
        ...estimacionData
      }

      if (estimacionData.id) {
        await estimacionesApi.update(estimacionData.id, data)
        message.success('Estimación actualizada')
      } else {
        const res = await estimacionesApi.create(data)
        setEstimacionData(prev => ({ ...prev, id: res.data.estimacion.id }))
        message.success('Estimación guardada')
      }
      setCurrentStep(3)
    } catch (error) {
      message.error(error.message || 'Error al guardar estimación')
    } finally {
      setSaving(false)
    }
  }

  const handleEnviarGerencia = async () => {
    if (!evaluacion) {
      message.error('Debe completar todos los pasos')
      return
    }

    Modal.confirm({
      title: 'Enviar a Gerencia',
      content: '¿Está seguro que desea enviar esta evaluación a Gerencia para su aprobación? Una vez enviada, no podrá modificarla.',
      okText: 'Enviar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setSaving(true)
        try {
          await evaluacionesApi.enviar(evaluacion.id)
          message.success('Evaluación enviada a Gerencia')
          navigate(`/nt/solicitudes/${solicitudId}`)
        } catch (error) {
          message.error(error.message || 'Error al enviar')
        } finally {
          setSaving(false)
        }
      }
    })
  }

  // Calculate cost totals
  const calculateTotals = () => {
    const desarrollo = estimacionData.desarrollo_interno.reduce((sum, item) => sum + (item.subtotal || 0), 0)
    const infraestructura = estimacionData.infraestructura.reduce((sum, item) => sum + (item.subtotal || 0), 0)
    const externos = estimacionData.servicios_externos.reduce((sum, item) => sum + (item.monto || 0), 0)
    const subtotal = desarrollo + infraestructura + externos
    const contingencia = subtotal * (estimacionData.contingencia_porcentaje / 100)
    const total = subtotal + contingencia

    return { desarrollo, infraestructura, externos, subtotal, contingencia, total }
  }

  const formatCOP = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!solicitud) {
    return <Card><Title level={4}>Solicitud no encontrada</Title></Card>
  }

  const totals = calculateTotals()

  const steps = [
    { title: 'Resumen', icon: <FileTextOutlined /> },
    { title: 'Cronograma', icon: <CalendarOutlined /> },
    { title: 'Costos', icon: <DollarOutlined /> },
    { title: 'Enviar', icon: <SendOutlined /> }
  ]

  return (
    <div>
      <Link to={`/nt/solicitudes/${solicitudId}`}>
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Volver a Solicitud</Button>
      </Link>

      <Card>
        <Title level={3}>Evaluación: {solicitud.titulo}</Title>
        <Text type="secondary">{solicitud.codigo}</Text>

        {evaluacion?.estado === 'enviado' && (
          <Alert
            message="Evaluación Enviada"
            description="Esta evaluación ya fue enviada a Gerencia y no puede ser modificada."
            type="info"
            showIcon
            style={{ marginTop: 16, marginBottom: 16 }}
          />
        )}

        <Steps current={currentStep} style={{ marginTop: 24, marginBottom: 24 }}>
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              icon={step.icon}
              onClick={() => evaluacion && setCurrentStep(index)}
              style={{ cursor: evaluacion ? 'pointer' : 'default' }}
            />
          ))}
        </Steps>

        {/* Step 0: Resumen Ejecutivo */}
        {currentStep === 0 && (
          <Form
            form={resumenForm}
            layout="vertical"
            onFinish={handleSaveResumen}
            disabled={evaluacion?.estado === 'enviado'}
          >
            <Form.Item
              name="resumen_ejecutivo"
              label="Resumen Ejecutivo"
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <TextArea rows={6} placeholder="Resumen del análisis realizado y conclusiones principales..." />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="recomendacion"
                  label="Recomendación"
                  rules={[{ required: true, message: 'Seleccione una recomendación' }]}
                >
                  <Radio.Group>
                    <Space direction="vertical">
                      <Radio value="aprobar">
                        <Tag color="success">Aprobar</Tag> - Se recomienda aprobar el proyecto
                      </Radio>
                      <Radio value="rechazar">
                        <Tag color="error">Rechazar</Tag> - No se recomienda continuar
                      </Radio>
                      <Radio value="aplazar">
                        <Tag color="warning">Aplazar</Tag> - Se sugiere posponer para revisión futura
                      </Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="justificacion_recomendacion"
                  label="Justificación de la Recomendación"
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <TextArea rows={4} placeholder="Explique las razones de su recomendación..." />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="notas_adicionales" label="Notas Adicionales">
              <TextArea rows={3} placeholder="Observaciones adicionales (opcional)..." />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              Guardar y Continuar
            </Button>
          </Form>
        )}

        {/* Step 1: Cronograma */}
        {currentStep === 1 && (
          <div>
            {/* Step 1a: Team Selection */}
            <Card
              size="small"
              title={<><TeamOutlined /> Paso 1: Equipo del Proyecto</>}
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={16}>
                  <Text strong>Miembros del Equipo *</Text>
                  <Select
                    mode="multiple"
                    value={cronogramaData.equipoIds}
                    onChange={(values) => {
                      setCronogramaData(prev => {
                        // If leader was removed from team, clear leader
                        const newLiderId = values.includes(prev.liderId) ? prev.liderId : null
                        // Update task assignments - remove users no longer in team
                        const newTareas = prev.tareas.map(t => ({
                          ...t,
                          asignados_ids: (t.asignados_ids || []).filter(id => values.includes(id))
                        }))
                        return {
                          ...prev,
                          equipoIds: values,
                          liderId: newLiderId,
                          tareas: newTareas
                        }
                      })
                    }}
                    placeholder="Seleccione los miembros del equipo"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={evaluacion?.estado === 'enviado'}
                    optionFilterProp="children"
                    showSearch
                  >
                    {ntUsers.map(user => (
                      <Select.Option key={user.id} value={user.id}>
                        {user.nombre} ({user.email})
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong><CrownOutlined /> Líder del Proyecto *</Text>
                  <Select
                    value={cronogramaData.liderId}
                    onChange={(value) => setCronogramaData(prev => ({ ...prev, liderId: value }))}
                    placeholder="Seleccione el líder"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={evaluacion?.estado === 'enviado' || cronogramaData.equipoIds.length === 0}
                    notFoundContent={cronogramaData.equipoIds.length === 0 ? "Primero seleccione el equipo" : "Sin opciones"}
                  >
                    {ntUsers.filter(u => cronogramaData.equipoIds.includes(u.id)).map(user => (
                      <Select.Option key={user.id} value={user.id}>
                        {user.nombre.split(' ')[0]}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              </Row>
              {cronogramaData.equipoIds.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    Equipo seleccionado: {cronogramaData.equipoIds.length} miembro(s)
                    {cronogramaData.liderId && ` - Líder: ${ntUsers.find(u => u.id === cronogramaData.liderId)?.nombre.split(' ')[0]}`}
                  </Text>
                </div>
              )}
            </Card>

            {/* Step 1b: Tasks */}
            <Card
              size="small"
              title={<><CalendarOutlined /> Paso 2: Tareas del Proyecto</>}
              style={{ marginBottom: 16 }}
              extra={
                <Space>
                  <Button size="small" icon={<CalendarOutlined />} onClick={() => setTemplateModalVisible(true)}>
                    Usar Plantilla
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setCronogramaData(prev => ({
                        ...prev,
                        tareas: [...prev.tareas, {
                          id: `task-${Date.now()}`,
                          nombre: 'Nueva Tarea',
                          duracion_dias: 5,
                          fase: 'desarrollo',
                          progreso: 0,
                          dependencias: [],
                          asignado_id: null,
                          asignados_ids: []
                        }]
                      }))
                    }}
                  >
                    Agregar Tarea
                  </Button>
                </Space>
              }
            >
              {cronogramaData.tareas.length > 0 ? (
                <Table
                  dataSource={cronogramaData.tareas}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 900 }}
                  columns={[
                    {
                      title: 'Tarea',
                      dataIndex: 'nombre',
                      width: 200,
                      render: (text, record, index) => (
                        <Input
                          value={text}
                          onChange={(e) => {
                            const newTareas = [...cronogramaData.tareas]
                            newTareas[index].nombre = e.target.value
                            setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                          }}
                          disabled={evaluacion?.estado === 'enviado'}
                        />
                      )
                    },
                    {
                      title: 'Fase',
                      dataIndex: 'fase',
                      width: 130,
                      render: (fase, record, index) => (
                        <Select
                          value={fase}
                          style={{ width: '100%' }}
                          onChange={(value) => {
                            const newTareas = [...cronogramaData.tareas]
                            newTareas[index].fase = value
                            setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                          }}
                          disabled={evaluacion?.estado === 'enviado'}
                        >
                          {Object.entries(phaseLabels).map(([key, label]) => (
                            <Select.Option key={key} value={key}>
                              <Tag color={phaseColors[key]} style={{ margin: 0 }}>{label}</Tag>
                            </Select.Option>
                          ))}
                        </Select>
                      )
                    },
                    {
                      title: 'Días',
                      dataIndex: 'duracion_dias',
                      width: 80,
                      render: (duracion, record, index) => (
                        <InputNumber
                          value={duracion}
                          min={1}
                          max={365}
                          style={{ width: '100%' }}
                          onChange={(value) => {
                            const newTareas = [...cronogramaData.tareas]
                            newTareas[index].duracion_dias = value || 1
                            setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                          }}
                          disabled={evaluacion?.estado === 'enviado'}
                        />
                      )
                    },
                    {
                      title: 'Asignados',
                      dataIndex: 'asignados_ids',
                      width: 200,
                      render: (asignados_ids, record, index) => (
                        <Select
                          mode="multiple"
                          value={asignados_ids || []}
                          style={{ width: '100%' }}
                          placeholder="Sin asignar"
                          onChange={(values) => {
                            const newTareas = [...cronogramaData.tareas]
                            newTareas[index].asignados_ids = values
                            setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                          }}
                          disabled={evaluacion?.estado === 'enviado' || cronogramaData.equipoIds.length === 0}
                          maxTagCount={2}
                          maxTagPlaceholder={(omitted) => `+${omitted.length}`}
                          notFoundContent={cronogramaData.equipoIds.length === 0 ? "Primero seleccione el equipo" : "Sin opciones"}
                        >
                          {ntUsers.filter(u => cronogramaData.equipoIds.includes(u.id)).map(user => (
                            <Select.Option key={user.id} value={user.id}>
                              {user.nombre.split(' ')[0]}
                            </Select.Option>
                          ))}
                        </Select>
                      )
                    },
                    {
                      title: '',
                      width: 50,
                      fixed: 'right',
                      render: (_, record, index) => (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const newTareas = cronogramaData.tareas.filter((_, i) => i !== index)
                            setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                          }}
                          disabled={evaluacion?.estado === 'enviado'}
                        />
                      )
                    }
                  ]}
                />
              ) : (
                <Alert
                  message="Sin Tareas"
                  description="Use una plantilla o agregue tareas manualmente para crear el cronograma del proyecto."
                  type="info"
                  showIcon
                />
              )}
            </Card>

            {/* Step 1c: Workload Visualization */}
            {cronogramaData.equipoIds.length > 0 && cronogramaData.tareas.length > 0 && (
              <WorkloadChart
                equipo={ntUsers.filter(u => cronogramaData.equipoIds.includes(u.id))}
                tareas={cronogramaData.tareas}
                liderId={cronogramaData.liderId}
              />
            )}

            <div style={{ marginTop: 16 }}>
              <Space>
                <Button onClick={() => setCurrentStep(0)}>Anterior</Button>
                <Button type="primary" onClick={handleSaveCronograma} loading={saving} icon={<SaveOutlined />}>
                  Guardar y Continuar
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* Step 2: Estimación de Costos */}
        {currentStep === 2 && (
          <div>
            <Divider orientation="left">Desarrollo Interno</Divider>
            <Table
              dataSource={estimacionData.desarrollo_interno}
              rowKey={(r, i) => i}
              pagination={false}
              size="small"
              footer={() => (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEstimacionData(prev => ({
                      ...prev,
                      desarrollo_interno: [...prev.desarrollo_interno, {
                        concepto: '',
                        horas: 0,
                        tarifa_hora: 50000,
                        subtotal: 0
                      }]
                    }))
                  }}
                  disabled={evaluacion?.estado === 'enviado'}
                >
                  Agregar Item
                </Button>
              )}
              columns={[
                {
                  title: 'Concepto',
                  dataIndex: 'concepto',
                  render: (text, record, index) => (
                    <Input
                      value={text}
                      placeholder="Ej: Desarrollo Frontend"
                      onChange={(e) => {
                        const newItems = [...estimacionData.desarrollo_interno]
                        newItems[index].concepto = e.target.value
                        setEstimacionData(prev => ({ ...prev, desarrollo_interno: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Horas',
                  dataIndex: 'horas',
                  width: 100,
                  render: (val, record, index) => (
                    <InputNumber
                      value={val}
                      min={0}
                      onChange={(v) => {
                        const newItems = [...estimacionData.desarrollo_interno]
                        newItems[index].horas = v || 0
                        newItems[index].subtotal = (v || 0) * newItems[index].tarifa_hora
                        setEstimacionData(prev => ({ ...prev, desarrollo_interno: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Tarifa/Hora (COP)',
                  dataIndex: 'tarifa_hora',
                  width: 150,
                  render: (val, record, index) => (
                    <InputNumber
                      value={val}
                      min={0}
                      step={10000}
                      formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/\$\s?|(,*)/g, '')}
                      onChange={(v) => {
                        const newItems = [...estimacionData.desarrollo_interno]
                        newItems[index].tarifa_hora = v || 0
                        newItems[index].subtotal = newItems[index].horas * (v || 0)
                        setEstimacionData(prev => ({ ...prev, desarrollo_interno: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  width: 150,
                  render: (val) => <Text strong>{formatCOP(val || 0)}</Text>
                },
                {
                  title: '',
                  width: 50,
                  render: (_, record, index) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const newItems = estimacionData.desarrollo_interno.filter((_, i) => i !== index)
                        setEstimacionData(prev => ({ ...prev, desarrollo_interno: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                }
              ]}
            />

            <Divider orientation="left">Infraestructura</Divider>
            <Table
              dataSource={estimacionData.infraestructura}
              rowKey={(r, i) => i}
              pagination={false}
              size="small"
              footer={() => (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEstimacionData(prev => ({
                      ...prev,
                      infraestructura: [...prev.infraestructura, {
                        concepto: '',
                        descripcion: '',
                        costo_unico: 0,
                        subtotal: 0
                      }]
                    }))
                  }}
                  disabled={evaluacion?.estado === 'enviado'}
                >
                  Agregar Item
                </Button>
              )}
              columns={[
                {
                  title: 'Concepto',
                  dataIndex: 'concepto',
                  render: (text, record, index) => (
                    <Input
                      value={text}
                      placeholder="Ej: Servidor AWS"
                      onChange={(e) => {
                        const newItems = [...estimacionData.infraestructura]
                        newItems[index].concepto = e.target.value
                        setEstimacionData(prev => ({ ...prev, infraestructura: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Costo (COP)',
                  dataIndex: 'costo_unico',
                  width: 180,
                  render: (val, record, index) => (
                    <InputNumber
                      value={val}
                      min={0}
                      step={100000}
                      style={{ width: '100%' }}
                      formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/\$\s?|(,*)/g, '')}
                      onChange={(v) => {
                        const newItems = [...estimacionData.infraestructura]
                        newItems[index].costo_unico = v || 0
                        newItems[index].subtotal = v || 0
                        setEstimacionData(prev => ({ ...prev, infraestructura: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  width: 150,
                  render: (val) => <Text strong>{formatCOP(val || 0)}</Text>
                },
                {
                  title: '',
                  width: 50,
                  render: (_, record, index) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const newItems = estimacionData.infraestructura.filter((_, i) => i !== index)
                        setEstimacionData(prev => ({ ...prev, infraestructura: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                }
              ]}
            />

            <Divider orientation="left">Servicios Externos</Divider>
            <Table
              dataSource={estimacionData.servicios_externos}
              rowKey={(r, i) => i}
              pagination={false}
              size="small"
              footer={() => (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEstimacionData(prev => ({
                      ...prev,
                      servicios_externos: [...prev.servicios_externos, {
                        concepto: '',
                        proveedor: '',
                        monto: 0
                      }]
                    }))
                  }}
                  disabled={evaluacion?.estado === 'enviado'}
                >
                  Agregar Item
                </Button>
              )}
              columns={[
                {
                  title: 'Concepto',
                  dataIndex: 'concepto',
                  render: (text, record, index) => (
                    <Input
                      value={text}
                      placeholder="Ej: Consultoría externa"
                      onChange={(e) => {
                        const newItems = [...estimacionData.servicios_externos]
                        newItems[index].concepto = e.target.value
                        setEstimacionData(prev => ({ ...prev, servicios_externos: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Proveedor',
                  dataIndex: 'proveedor',
                  width: 200,
                  render: (text, record, index) => (
                    <Input
                      value={text}
                      placeholder="Nombre del proveedor"
                      onChange={(e) => {
                        const newItems = [...estimacionData.servicios_externos]
                        newItems[index].proveedor = e.target.value
                        setEstimacionData(prev => ({ ...prev, servicios_externos: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: 'Monto (COP)',
                  dataIndex: 'monto',
                  width: 180,
                  render: (val, record, index) => (
                    <InputNumber
                      value={val}
                      min={0}
                      step={100000}
                      style={{ width: '100%' }}
                      formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/\$\s?|(,*)/g, '')}
                      onChange={(v) => {
                        const newItems = [...estimacionData.servicios_externos]
                        newItems[index].monto = v || 0
                        setEstimacionData(prev => ({ ...prev, servicios_externos: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                },
                {
                  title: '',
                  width: 50,
                  render: (_, record, index) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const newItems = estimacionData.servicios_externos.filter((_, i) => i !== index)
                        setEstimacionData(prev => ({ ...prev, servicios_externos: newItems }))
                      }}
                      disabled={evaluacion?.estado === 'enviado'}
                    />
                  )
                }
              ]}
            />

            <Divider />

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Contingencia (%)">
                  <InputNumber
                    value={estimacionData.contingencia_porcentaje}
                    min={0}
                    max={50}
                    formatter={v => `${v}%`}
                    parser={v => v.replace('%', '')}
                    onChange={(v) => setEstimacionData(prev => ({ ...prev, contingencia_porcentaje: v || 0 }))}
                    disabled={evaluacion?.estado === 'enviado'}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small">
                  <Row>
                    <Col span={16}>Desarrollo Interno:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.desarrollo)}</Col>
                  </Row>
                  <Row>
                    <Col span={16}>Infraestructura:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.infraestructura)}</Col>
                  </Row>
                  <Row>
                    <Col span={16}>Servicios Externos:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.externos)}</Col>
                  </Row>
                  <Divider style={{ margin: '8px 0' }} />
                  <Row>
                    <Col span={16}>Subtotal:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.subtotal)}</Col>
                  </Row>
                  <Row>
                    <Col span={16}>Contingencia ({estimacionData.contingencia_porcentaje}%):</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.contingencia)}</Col>
                  </Row>
                  <Divider style={{ margin: '8px 0' }} />
                  <Row>
                    <Col span={16}><Text strong>TOTAL:</Text></Col>
                    <Col span={8} style={{ textAlign: 'right' }}><Text strong>{formatCOP(totals.total)}</Text></Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              <Space>
                <Button onClick={() => setCurrentStep(1)}>Anterior</Button>
                <Button type="primary" onClick={handleSaveEstimacion} loading={saving} icon={<SaveOutlined />}>
                  Guardar y Continuar
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* Step 3: Review and Submit */}
        {currentStep === 3 && (
          <div>
            <Alert
              message="Revisión Final"
              description="Revise que toda la información sea correcta antes de enviar a Gerencia."
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card title="Resumen Ejecutivo" size="small">
                  <Paragraph>{evaluacion?.resumen_ejecutivo}</Paragraph>
                  <Divider />
                  <Text strong>Recomendación: </Text>
                  <Tag color={
                    evaluacion?.recomendacion === 'aprobar' ? 'success' :
                    evaluacion?.recomendacion === 'rechazar' ? 'error' : 'warning'
                  }>
                    {evaluacion?.recomendacion?.toUpperCase()}
                  </Tag>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Estimación de Costos" size="small">
                  <Row>
                    <Col span={16}>Desarrollo:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.desarrollo)}</Col>
                  </Row>
                  <Row>
                    <Col span={16}>Infraestructura:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.infraestructura)}</Col>
                  </Row>
                  <Row>
                    <Col span={16}>Externos:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{formatCOP(totals.externos)}</Col>
                  </Row>
                  <Divider style={{ margin: '8px 0' }} />
                  <Row>
                    <Col span={16}><Text strong>TOTAL:</Text></Col>
                    <Col span={8} style={{ textAlign: 'right' }}><Text strong>{formatCOP(totals.total)}</Text></Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            <Card title="Cronograma y Equipo" size="small" style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Equipo: </Text>
                  <Text>{cronogramaData.equipoIds.length} miembro(s)</Text>
                  {cronogramaData.liderId && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      <CrownOutlined /> Líder: {ntUsers.find(u => u.id === cronogramaData.liderId)?.nombre.split(' ')[0]}
                    </Tag>
                  )}
                </Col>
                <Col span={12}>
                  <Text strong>Tareas: </Text>
                  <Text>{cronogramaData.tareas.length} programadas</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    ({cronogramaData.tareas.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)} días totales)
                  </Text>
                </Col>
              </Row>
              {cronogramaData.equipoIds.length > 0 && cronogramaData.tareas.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <WorkloadChart
                    equipo={ntUsers.filter(u => cronogramaData.equipoIds.includes(u.id))}
                    tareas={cronogramaData.tareas}
                    liderId={cronogramaData.liderId}
                  />
                </div>
              )}
            </Card>

            <div style={{ marginTop: 24 }}>
              <Space>
                <Button onClick={() => setCurrentStep(2)}>Anterior</Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleEnviarGerencia}
                  loading={saving}
                  disabled={evaluacion?.estado === 'enviado'}
                >
                  Enviar a Gerencia
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>

      {/* Template Modal */}
      <Modal
        title="Seleccionar Plantilla de Cronograma"
        open={templateModalVisible}
        onOk={handleApplyTemplate}
        onCancel={() => setTemplateModalVisible(false)}
        okText="Aplicar"
        cancelText="Cancelar"
      >
        <Form layout="vertical">
          <Form.Item label="Plantilla">
            <Select
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              placeholder="Seleccione una plantilla"
            >
              {templates.map(t => (
                <Select.Option key={t.id} value={t.id}>
                  {t.nombre} ({t.duracion_dias} días, {t.num_tareas} tareas)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Alert
            message="Las fechas exactas serán calculadas cuando Gerencia agende el proyecto"
            type="info"
            showIcon
            style={{ marginTop: 8 }}
          />
        </Form>
      </Modal>
    </div>
  )
}

export default EvaluacionForm
