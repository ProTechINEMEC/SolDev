import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Card, Typography, Button, Space, Steps, Form, Input, Select, Radio,
  message, Spin, Alert, Divider, Row, Col, InputNumber, DatePicker,
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

function EvaluacionForm() {
  const { codigo } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [solicitud, setSolicitud] = useState(null)
  const [evaluacion, setEvaluacion] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)

  // Form states
  const [resumenForm] = Form.useForm()
  const recomendacionValue = Form.useWatch('recomendacion', resumenForm)
  const [cronogramaData, setCronogramaData] = useState({
    tareas: [],
    liderId: null,
    equipoIds: [],  // Selected team member IDs
    fases: []  // Custom phases for this project
  })
  const [newFase, setNewFase] = useState('')  // For adding new phases
  const [estimacionData, setEstimacionData] = useState({
    id: null,
    items: [],  // Each item: { concepto, subtotal, iva }
    notas: ''
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
  }, [codigo])

  const loadData = async () => {
    try {
      // Load solicitud
      const solicitudRes = await solicitudesApi.get(codigo)
      setSolicitud(solicitudRes.data.solicitud)

      // Try to load existing evaluation
      const evalRes = await evaluacionesApi.getBySolicitud(codigo)
      if (evalRes.data.evaluacion) {
        setEvaluacion(evalRes.data.evaluacion)

        // Populate forms
        resumenForm.setFieldsValue({
          resumen_ejecutivo: evalRes.data.evaluacion.resumen_ejecutivo,
          recomendacion: evalRes.data.evaluacion.recomendacion,
          justificacion_recomendacion: evalRes.data.evaluacion.justificacion_recomendacion,
          riesgos_identificados: evalRes.data.evaluacion.riesgos_identificados,
          notas_adicionales: evalRes.data.evaluacion.notas_adicionales,
          fecha_inicio_posible: evalRes.data.evaluacion.fecha_inicio_posible
            ? dayjs(evalRes.data.evaluacion.fecha_inicio_posible)
            : null
        })

        // Load cronograma
        if (evalRes.data.cronograma) {
          // Find the project leader from equipo
          const lider = evalRes.data.equipo?.find(m => m.es_lider)
          const cronograma = evalRes.data.cronograma
          const tareas = (evalRes.data.tareas || []).map(t => ({
            id: t.id,
            nombre: t.titulo || t.nombre,
            duracion_dias: t.duracion_dias || 1,
            fase: t.fase || '',
            progreso: t.progreso || 0,
            dependencias: t.dependencias || [],
            orden: t.orden,
            asignado_id: t.asignado_id,
            asignados_ids: t.asignados_ids || []
          }))
          // Extract unique phases from tasks or use stored phases
          const existingFases = cronograma.fases || [...new Set(tareas.map(t => t.fase).filter(Boolean))]
          setCronogramaData({
            id: cronograma.id,
            nombre: cronograma.nombre,
            equipoIds: cronograma.equipo_ids || [],
            tareas,
            fases: existingFases,
            liderId: lider?.usuario_id || null
          })
        }

        // Load estimacion - convert from backend format to simple items
        if (evalRes.data.estimacion) {
          const est = evalRes.data.estimacion
          // Combine all items from different categories into simple format
          const allItems = []

          const desarrolloItems = typeof est.desarrollo_interno === 'string'
            ? JSON.parse(est.desarrollo_interno) : est.desarrollo_interno || []
          desarrolloItems.forEach(item => {
            allItems.push({
              concepto: item.concepto || '',
              subtotal: item.subtotal || 0,
              iva: item.iva || 0
            })
          })

          const infraItems = typeof est.infraestructura === 'string'
            ? JSON.parse(est.infraestructura) : est.infraestructura || []
          infraItems.forEach(item => {
            allItems.push({
              concepto: item.concepto || '',
              subtotal: item.subtotal || 0,
              iva: item.iva || 0
            })
          })

          const externosItems = typeof est.servicios_externos === 'string'
            ? JSON.parse(est.servicios_externos) : est.servicios_externos || []
          externosItems.forEach(item => {
            allItems.push({
              concepto: item.concepto || '',
              subtotal: item.monto || 0,
              iva: item.iva || 0
            })
          })

          setEstimacionData({
            id: est.id,
            items: allItems,
            notas: est.notas || ''
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
          solicitud_codigo: codigo,
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

      // Extract unique phases from template tasks
      const templateFases = [...new Set(template.tareas.map(t => t.fase).filter(Boolean))]

      setCronogramaData(prev => ({
        ...prev,
        nombre: template.nombre,
        fases: templateFases.length > 0 ? templateFases : prev.fases,
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
      const tareas = cronogramaData.tareas.map((t, i) => ({
        nombre: t.nombre.trim(),
        duracion_dias: t.duracion_dias || 1,
        fase: t.fase || '',
        progreso: t.progreso || 0,
        dependencias: t.dependencias || [],
        orden: i,
        asignado_id: t.asignado_id || null,
        asignados_ids: t.asignados_ids || []
      }))

      if (cronogramaData.id) {
        // Update - don't send evaluacion_id
        const updateData = {
          nombre: cronogramaData.nombre || 'Cronograma del Proyecto',
          equipo_ids: cronogramaData.equipoIds,
          fases: cronogramaData.fases,
          tareas
        }
        await cronogramasApi.update(cronogramaData.id, updateData)
        message.success('Cronograma actualizado')
      } else {
        // Create - include evaluacion_id
        const createData = {
          evaluacion_id: evaluacion.id,
          nombre: cronogramaData.nombre || 'Cronograma del Proyecto',
          equipo_ids: cronogramaData.equipoIds,
          fases: cronogramaData.fases,
          tareas
        }
        try {
          const res = await cronogramasApi.create(createData)
          setCronogramaData(prev => ({ ...prev, id: res.data.cronograma.id }))
          message.success('Cronograma guardado')
        } catch (createError) {
          // If cronograma already exists, try to get its ID and update instead
          if (createError.message?.includes('Ya existe')) {
            const existingRes = await evaluacionesApi.getBySolicitud(codigo)
            if (existingRes.data.cronograma?.id) {
              const existingId = existingRes.data.cronograma.id
              setCronogramaData(prev => ({ ...prev, id: existingId }))
              const updateData = {
                nombre: cronogramaData.nombre || 'Cronograma del Proyecto',
                equipo_ids: cronogramaData.equipoIds,
                fases: cronogramaData.fases,
                tareas
              }
              await cronogramasApi.update(existingId, updateData)
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

    // Store all items in servicios_externos format (simplest structure)
    const servicios_externos = estimacionData.items.map(item => ({
      concepto: item.concepto || '',
      monto: item.subtotal || 0,
      iva: item.iva || 0,
      proveedor: ''
    }))

    setSaving(true)
    try {
      if (estimacionData.id) {
        // Update - don't send evaluacion_id
        const updateData = {
          desarrollo_interno: [],
          infraestructura: [],
          servicios_externos,
          contingencia_porcentaje: 0,
          notas: estimacionData.notas
        }
        await estimacionesApi.update(estimacionData.id, updateData)
        message.success('Estimación actualizada')
      } else {
        // Create - include evaluacion_id
        const createData = {
          evaluacion_id: evaluacion.id,
          desarrollo_interno: [],
          infraestructura: [],
          servicios_externos,
          contingencia_porcentaje: 0,
          notas: estimacionData.notas
        }
        const res = await estimacionesApi.create(createData)
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
          navigate(`/nt/solicitudes/${codigo}`)
        } catch (error) {
          message.error(error.message || 'Error al enviar')
        } finally {
          setSaving(false)
        }
      }
    })
  }

  // Calculate cost totals
  // Calculate total from all items
  const calculateTotals = () => {
    const items = estimacionData.items || []
    const totalCompleto = items.reduce((sum, item) => sum + (item.subtotal || 0) + (item.iva || 0), 0)
    return { total: totalCompleto }
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
      <Link to={`/nt/solicitudes/${codigo}`}>
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

                {/* Show possible start date only for aprobar/aplazar */}
                {(recomendacionValue === 'aprobar' || recomendacionValue === 'aplazar') && (
                  <Form.Item
                    name="fecha_inicio_posible"
                    label="Fecha de Inicio Posible"
                    tooltip="Fecha sugerida para iniciar el proyecto si es aprobado"
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder="Seleccione fecha tentativa"
                      format="DD/MM/YYYY"
                    />
                  </Form.Item>
                )}
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

            {/* Step 1b: Phases */}
            <Card
              size="small"
              title={<><CalendarOutlined /> Paso 2: Fases del Proyecto</>}
              style={{ marginBottom: 16 }}
            >
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">
                  Define las fases del proyecto en orden. Las tareas se organizarán según estas fases.
                </Text>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {cronogramaData.fases.map((fase, index) => (
                  <Tag
                    key={fase}
                    closable={evaluacion?.estado !== 'enviado'}
                    onClose={() => {
                      setCronogramaData(prev => ({
                        ...prev,
                        fases: prev.fases.filter((_, i) => i !== index),
                        // Clear fase from tasks that used this phase
                        tareas: prev.tareas.map(t => t.fase === fase ? { ...t, fase: '' } : t)
                      }))
                    }}
                    style={{ padding: '4px 8px', fontSize: 13 }}
                  >
                    Fase {index + 1}: {fase}
                  </Tag>
                ))}
              </div>
              <Space.Compact style={{ width: '100%', maxWidth: 300 }}>
                <Input
                  placeholder="Nueva fase..."
                  value={newFase}
                  onChange={(e) => setNewFase(e.target.value)}
                  onPressEnter={() => {
                    if (newFase.trim() && !cronogramaData.fases.includes(newFase.trim())) {
                      setCronogramaData(prev => ({
                        ...prev,
                        fases: [...prev.fases, newFase.trim()]
                      }))
                      setNewFase('')
                    }
                  }}
                  disabled={evaluacion?.estado === 'enviado'}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    if (newFase.trim() && !cronogramaData.fases.includes(newFase.trim())) {
                      setCronogramaData(prev => ({
                        ...prev,
                        fases: [...prev.fases, newFase.trim()]
                      }))
                      setNewFase('')
                    }
                  }}
                  disabled={evaluacion?.estado === 'enviado' || !newFase.trim()}
                >
                  Agregar
                </Button>
              </Space.Compact>
            </Card>

            {/* Step 1c: Tasks by Phase */}
            <Card
              size="small"
              title={<><FileTextOutlined /> Paso 3: Tareas del Proyecto</>}
              style={{ marginBottom: 16 }}
            >
              {cronogramaData.fases.length === 0 ? (
                <Alert
                  message="Sin Fases"
                  description="Primero defina las fases del proyecto en el Paso 2."
                  type="warning"
                  showIcon
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {cronogramaData.fases.map((fase, faseIndex) => {
                    const faseTareas = cronogramaData.tareas.filter(t => t.fase === fase)
                    return (
                      <Card
                        key={fase}
                        size="small"
                        type="inner"
                        title={<Text strong>Fase {faseIndex + 1}: {fase}</Text>}
                        extra={
                          <Button
                            size="small"
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setCronogramaData(prev => ({
                                ...prev,
                                tareas: [...prev.tareas, {
                                  id: `task-${Date.now()}`,
                                  nombre: '',
                                  duracion_dias: 1,
                                  fase: fase,
                                  progreso: 0,
                                  dependencias: [],
                                  asignado_id: null,
                                  asignados_ids: []
                                }]
                              }))
                            }}
                            disabled={evaluacion?.estado === 'enviado'}
                          >
                            Agregar Tarea
                          </Button>
                        }
                        style={{ backgroundColor: '#fafafa' }}
                      >
                        {faseTareas.length > 0 ? (
                          <Table
                            dataSource={faseTareas}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            showHeader={faseTareas.length > 0}
                            columns={[
                              {
                                title: 'Tarea',
                                dataIndex: 'nombre',
                                render: (text, record) => (
                                  <Input
                                    value={text}
                                    placeholder="Nombre de la tarea"
                                    onChange={(e) => {
                                      const newTareas = cronogramaData.tareas.map(t =>
                                        t.id === record.id ? { ...t, nombre: e.target.value } : t
                                      )
                                      setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                                    }}
                                    disabled={evaluacion?.estado === 'enviado'}
                                  />
                                )
                              },
                              {
                                title: 'Asignados',
                                dataIndex: 'asignados_ids',
                                width: 220,
                                render: (asignados_ids, record) => (
                                  <Select
                                    mode="multiple"
                                    value={asignados_ids || []}
                                    style={{ width: '100%' }}
                                    placeholder="Seleccionar"
                                    onChange={(values) => {
                                      const newTareas = cronogramaData.tareas.map(t =>
                                        t.id === record.id ? { ...t, asignados_ids: values } : t
                                      )
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
                                title: 'Días',
                                dataIndex: 'duracion_dias',
                                width: 80,
                                render: (duracion, record) => (
                                  <InputNumber
                                    value={duracion}
                                    min={1}
                                    max={365}
                                    style={{ width: '100%' }}
                                    onChange={(value) => {
                                      const newTareas = cronogramaData.tareas.map(t =>
                                        t.id === record.id ? { ...t, duracion_dias: value || 1 } : t
                                      )
                                      setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                                    }}
                                    disabled={evaluacion?.estado === 'enviado'}
                                  />
                                )
                              },
                              {
                                title: '',
                                width: 50,
                                render: (_, record) => (
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => {
                                      const newTareas = cronogramaData.tareas.filter(t => t.id !== record.id)
                                      setCronogramaData(prev => ({ ...prev, tareas: newTareas }))
                                    }}
                                    disabled={evaluacion?.estado === 'enviado'}
                                  />
                                )
                              }
                            ]}
                          />
                        ) : (
                          <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '12px 0' }}>
                            Sin tareas en esta fase
                          </Text>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Step 1d: Workload Visualization */}
            {cronogramaData.equipoIds.length > 0 && cronogramaData.tareas.length > 0 && (
              <WorkloadChart
                equipo={ntUsers.filter(u => cronogramaData.equipoIds.includes(u.id))}
                tareas={cronogramaData.tareas}
                liderId={cronogramaData.liderId}
                fases={cronogramaData.fases}
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
            {/* Items Table */}
            <Card
              size="small"
              title="Detalle de Costos"
              extra={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => {
                    setEstimacionData(prev => ({
                      ...prev,
                      items: [...prev.items, {
                        concepto: '',
                        subtotal: 0,
                        iva: 0
                      }]
                    }))
                  }}
                  disabled={evaluacion?.estado === 'enviado'}
                >
                  Agregar Item
                </Button>
              }
            >
              <Table
                dataSource={estimacionData.items}
                rowKey={(r, i) => i}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Concepto',
                    dataIndex: 'concepto',
                    render: (text, record, index) => (
                      <Input
                        value={text}
                        placeholder="Descripción del item"
                        onChange={(e) => {
                          const newItems = [...estimacionData.items]
                          newItems[index].concepto = e.target.value
                          setEstimacionData(prev => ({ ...prev, items: newItems }))
                        }}
                        disabled={evaluacion?.estado === 'enviado'}
                      />
                    )
                  },
                  {
                    title: 'Subtotal',
                    dataIndex: 'subtotal',
                    width: 150,
                    render: (val, record, index) => (
                      <InputNumber
                        value={val}
                        min={0}
                        style={{ width: '100%' }}
                        formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/\$\s?|(,*)/g, '')}
                        onChange={(v) => {
                          const newItems = [...estimacionData.items]
                          newItems[index].subtotal = v || 0
                          setEstimacionData(prev => ({ ...prev, items: newItems }))
                        }}
                        disabled={evaluacion?.estado === 'enviado'}
                      />
                    )
                  },
                  {
                    title: 'IVA',
                    dataIndex: 'iva',
                    width: 150,
                    render: (val, record, index) => (
                      <InputNumber
                        value={val}
                        min={0}
                        style={{ width: '100%' }}
                        formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/\$\s?|(,*)/g, '')}
                        onChange={(v) => {
                          const newItems = [...estimacionData.items]
                          newItems[index].iva = v || 0
                          setEstimacionData(prev => ({ ...prev, items: newItems }))
                        }}
                        disabled={evaluacion?.estado === 'enviado'}
                      />
                    )
                  },
                  {
                    title: 'Total',
                    width: 150,
                    render: (_, record) => {
                      const total = (record.subtotal || 0) + (record.iva || 0)
                      return <Text strong>{formatCOP(total)}</Text>
                    }
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
                          const newItems = estimacionData.items.filter((_, i) => i !== index)
                          setEstimacionData(prev => ({ ...prev, items: newItems }))
                        }}
                        disabled={evaluacion?.estado === 'enviado'}
                      />
                    )
                  }
                ]}
                locale={{ emptyText: 'Agregue items para estimar costos' }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#e6f7ff' }}>
                      <Table.Summary.Cell index={0}>
                        <Text strong style={{ fontSize: 14 }}>TOTAL</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3}>
                        <Text strong style={{ fontSize: 14 }}>{formatCOP(totals.total)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} />
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </Card>

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
                  {/* Show suggested start date if set */}
                  {evaluacion?.fecha_inicio_posible && (
                    <div style={{ marginTop: 12 }}>
                      <Text strong>Fecha Inicio Recomendada: </Text>
                      <Tag color="blue" icon={<CalendarOutlined />}>
                        {dayjs(evaluacion.fecha_inicio_posible).format('DD/MM/YYYY')}
                      </Tag>
                    </div>
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Estimación de Costos" size="small">
                  <Row>
                    <Col span={16}>Items:</Col>
                    <Col span={8} style={{ textAlign: 'right' }}>{estimacionData.items.length}</Col>
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
                    fases={cronogramaData.fases}
                  />
                </div>
              )}
            </Card>

            {/* Monetary Benefits from Solicitud */}
            <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>Beneficios Reportados por el Solicitante</Title>
            <Row gutter={[24, 24]}>
              {/* Cost Reductions */}
              <Col xs={24} md={12}>
                <Card title="Reducción de Costos" size="small">
                  {solicitud?.beneficios?.analisis_costos?.reduce_costos ? (
                    <>
                      <Alert
                        message="El solicitante reporta reducción de costos"
                        type="success"
                        showIcon
                        icon={<CheckCircleOutlined />}
                        style={{ marginBottom: 12 }}
                      />
                      {solicitud.beneficios.analisis_costos.costos_actuales?.length > 0 && (
                        <>
                          <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Actuales:</Text>
                          {solicitud.beneficios.analisis_costos.costos_actuales.map((item, i) => (
                            <Row key={i} style={{ marginBottom: 4 }}>
                              <Col span={16}><Text>{item.descripcion || '--'}</Text></Col>
                              <Col span={8} style={{ textAlign: 'right' }}>
                                <Text>{formatCOP(item.monto || 0)}</Text>
                              </Col>
                            </Row>
                          ))}
                          <Divider style={{ margin: '8px 0' }} />
                          <Row>
                            <Col span={16}><Text strong>Total Actual:</Text></Col>
                            <Col span={8} style={{ textAlign: 'right' }}>
                              <Text strong>
                                {formatCOP(solicitud.beneficios.analisis_costos.costos_actuales.reduce((sum, item) => sum + (item.monto || 0), 0))}
                              </Text>
                            </Col>
                          </Row>
                        </>
                      )}
                      {solicitud.beneficios.analisis_costos.costos_esperados?.length > 0 && (
                        <>
                          <Text strong style={{ display: 'block', marginTop: 12, marginBottom: 8 }}>Costos Esperados:</Text>
                          {solicitud.beneficios.analisis_costos.costos_esperados.map((item, i) => (
                            <Row key={i} style={{ marginBottom: 4 }}>
                              <Col span={16}><Text>{item.descripcion || '--'}</Text></Col>
                              <Col span={8} style={{ textAlign: 'right' }}>
                                <Text>{formatCOP(item.monto || 0)}</Text>
                              </Col>
                            </Row>
                          ))}
                          <Divider style={{ margin: '8px 0' }} />
                          <Row>
                            <Col span={16}><Text strong>Total Esperado:</Text></Col>
                            <Col span={8} style={{ textAlign: 'right' }}>
                              <Text strong>
                                {formatCOP(solicitud.beneficios.analisis_costos.costos_esperados.reduce((sum, item) => sum + (item.monto || 0), 0))}
                              </Text>
                            </Col>
                          </Row>
                        </>
                      )}
                      {/* Calculate and show savings */}
                      {solicitud.beneficios.analisis_costos.costos_actuales?.length > 0 &&
                       solicitud.beneficios.analisis_costos.costos_esperados?.length > 0 && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <Row style={{ background: '#f6ffed', padding: '8px', borderRadius: 4 }}>
                            <Col span={16}><Text strong style={{ color: '#52c41a' }}>Ahorro Estimado:</Text></Col>
                            <Col span={8} style={{ textAlign: 'right' }}>
                              <Text strong style={{ color: '#52c41a' }}>
                                {formatCOP(
                                  solicitud.beneficios.analisis_costos.costos_actuales.reduce((sum, item) => sum + (item.monto || 0), 0) -
                                  solicitud.beneficios.analisis_costos.costos_esperados.reduce((sum, item) => sum + (item.monto || 0), 0)
                                )}
                              </Text>
                            </Col>
                          </Row>
                        </>
                      )}
                    </>
                  ) : (
                    <Text type="secondary">El solicitante no reportó reducción de costos</Text>
                  )}
                </Card>
              </Col>

              {/* Direct Monetary Benefits */}
              <Col xs={24} md={12}>
                <Card title="Beneficio Monetario Directo" size="small">
                  {solicitud?.beneficios?.beneficio_monetario?.tiene_beneficio ? (
                    <>
                      <Alert
                        message="El solicitante reporta beneficio monetario directo"
                        type="success"
                        showIcon
                        icon={<CheckCircleOutlined />}
                        style={{ marginBottom: 12 }}
                      />
                      {solicitud.beneficios.beneficio_monetario.items?.length > 0 && (
                        <>
                          <Text strong style={{ display: 'block', marginBottom: 8 }}>Beneficios Identificados:</Text>
                          {solicitud.beneficios.beneficio_monetario.items.map((item, i) => (
                            <Row key={i} style={{ marginBottom: 4 }}>
                              <Col span={16}><Text>{item.descripcion || '--'}</Text></Col>
                              <Col span={8} style={{ textAlign: 'right' }}>
                                <Text>{formatCOP(item.monto || 0)}/mes</Text>
                              </Col>
                            </Row>
                          ))}
                          <Divider style={{ margin: '8px 0' }} />
                          <Row style={{ background: '#f6ffed', padding: '8px', borderRadius: 4 }}>
                            <Col span={16}><Text strong style={{ color: '#52c41a' }}>Total Mensual:</Text></Col>
                            <Col span={8} style={{ textAlign: 'right' }}>
                              <Text strong style={{ color: '#52c41a' }}>
                                {formatCOP(solicitud.beneficios.beneficio_monetario.total_mensual ||
                                  solicitud.beneficios.beneficio_monetario.items.reduce((sum, item) => sum + (item.monto || 0), 0)
                                )}/mes
                              </Text>
                            </Col>
                          </Row>
                        </>
                      )}
                    </>
                  ) : (
                    <Text type="secondary">El solicitante no reportó beneficio monetario directo</Text>
                  )}
                </Card>
              </Col>
            </Row>

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
