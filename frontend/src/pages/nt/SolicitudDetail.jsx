import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Timeline, Input, message, Modal, Collapse, List, Row, Col, Alert, Select,
  DatePicker, Upload, Form, Switch, InputNumber
} from 'antd'
import {
  ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  UserOutlined, TeamOutlined, AlertOutlined, ClockCircleOutlined,
  ToolOutlined, TrophyOutlined, LineChartOutlined, PaperClipOutlined,
  FileTextOutlined, SwapOutlined, StopOutlined, PlayCircleOutlined,
  ExclamationCircleOutlined, EditOutlined, FilePdfOutlined, DownloadOutlined, FileOutlined,
  SaveOutlined, PlusOutlined, MinusCircleOutlined, UploadOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import { solicitudesApi, transferenciasApi, exportApi, opcionesApi, archivosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Panel } = Collapse

const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Nuevo (Interno)',
  actualizacion: 'Actualización',
  reporte_fallo: 'Reporte de Fallo',
  cierre_servicio: 'Cierre de Servicio'
}

const estadoColors = {
  pendiente_evaluacion_nt: 'processing',
  en_estudio: 'processing',
  descartado_nt: 'error',
  transferido_ti: 'purple',
  pendiente_aprobacion_gerencia: 'warning',
  pendiente_reevaluacion: 'orange',
  rechazado_gerencia: 'error',
  agendado: 'cyan',
  aprobado: 'success',
  en_desarrollo: 'processing',
  stand_by: 'warning',
  completado: 'success',
  cancelado: 'default'
}

const estadoLabels = {
  pendiente_evaluacion_nt: 'Pendiente',
  en_estudio: 'En Estudio',
  descartado_nt: 'Descartado',
  transferido_ti: 'Transferido a TI',
  pendiente_aprobacion_gerencia: 'En Gerencia',
  pendiente_reevaluacion: 'Requiere Revisión',
  rechazado_gerencia: 'Rechazado',
  agendado: 'Agendado',
  aprobado: 'Aprobado',
  en_desarrollo: 'En Desarrollo',
  stand_by: 'En Espera',
  completado: 'Completado',
  cancelado: 'Cancelado'
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

const urgenciaNivelLabels = {
  inmediata: 'Inmediata (< 1 semana)',
  corto_plazo: 'Corto Plazo (1-4 semanas)',
  mediano_plazo: 'Mediano Plazo (1-3 meses)',
  largo_plazo: 'Largo Plazo (> 3 meses)'
}

const impactoNivelLabels = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica'
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

// Helper to determine if tipo uses simple workflow
const isSimpleTipo = (tipo) => ['reporte_fallo', 'cierre_servicio', 'transferido_ti'].includes(tipo)

// Only reporte_fallo can be transferred to TI (cierre_servicio cannot)
const canTransferToTI = (tipo) => tipo === 'reporte_fallo'

function NTSolicitudDetail() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [comentarioTipo, setComentarioTipo] = useState('interno')
  const [actionLoading, setActionLoading] = useState(false)
  const [transferModalVisible, setTransferModalVisible] = useState(false)
  const [transferMotivo, setTransferMotivo] = useState('')
  const [transferInfo, setTransferInfo] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Project selector state for transferido_ti
  const [proyectos, setProyectos] = useState([])
  const [proyectosLoading, setProyectosLoading] = useState(false)
  const [selectedProyecto, setSelectedProyecto] = useState(null)
  const [proyectoOtroNombre, setProyectoOtroNombre] = useState('')
  const [savingProyecto, setSavingProyecto] = useState(false)

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [editOptions, setEditOptions] = useState({
    areas: [],
    operaciones: [],
    proyectosLista: []
  })
  const [newFiles, setNewFiles] = useState([])
  const [form] = Form.useForm()

  useEffect(() => {
    loadSolicitud()
  }, [codigo])

  useEffect(() => {
    if (data?.solicitud?.estado === 'transferido_ti') {
      loadTransferInfo()
    }
  }, [data?.solicitud?.estado])

  // Load projects for transferido_ti
  useEffect(() => {
    if (data?.solicitud?.tipo === 'transferido_ti') {
      loadProyectos()
      // Set initial selected value from existing data
      const proyectoRef = data.solicitud.proyecto_referencia
      if (proyectoRef?.proyecto_id) {
        setSelectedProyecto(proyectoRef.proyecto_id)
        if (proyectoRef.proyecto_id === 'otro') {
          setProyectoOtroNombre(proyectoRef.proyecto_nombre_otro || '')
        }
      }
    }
  }, [data?.solicitud?.tipo])

  const loadProyectos = async () => {
    setProyectosLoading(true)
    try {
      const response = await solicitudesApi.getProyectosPublic()
      const proyectosOptions = response.data.proyectos?.map(p => ({
        value: p.codigo,
        label: `${p.codigo} - ${p.nombre}`
      })) || []
      proyectosOptions.push({ value: 'otro', label: 'Otro (no listado)' })
      setProyectos(proyectosOptions)
    } catch (error) {
      console.error('Error loading projects:', error)
      setProyectos([{ value: 'otro', label: 'Otro (no listado)' }])
    } finally {
      setProyectosLoading(false)
    }
  }

  const handleSaveProyecto = async () => {
    if (!selectedProyecto) {
      message.warning('Seleccione un proyecto')
      return
    }
    if (selectedProyecto === 'otro' && !proyectoOtroNombre.trim()) {
      message.warning('Ingrese el nombre del proyecto')
      return
    }

    setSavingProyecto(true)
    try {
      await solicitudesApi.updateProyectoReferencia(codigo, {
        proyecto_id: selectedProyecto,
        proyecto_nombre_otro: selectedProyecto === 'otro' ? proyectoOtroNombre : null
      })
      message.success('Proyecto actualizado')
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al actualizar proyecto')
    } finally {
      setSavingProyecto(false)
    }
  }

  // Edit mode functions
  const loadEditOptions = async () => {
    try {
      const [areasRes, operacionesRes, proyectosRes] = await Promise.all([
        opcionesApi.getByCategoria('area'),
        opcionesApi.getByCategoria('operacion_contrato'),
        solicitudesApi.getProyectosPublic()
      ])

      setEditOptions({
        areas: areasRes.data.opciones?.map(o => ({ value: o.valor, label: o.etiqueta })) || Object.entries(areaLabels).map(([value, label]) => ({ value, label })),
        operaciones: operacionesRes.data.opciones?.map(o => ({ value: o.valor, label: o.etiqueta })) || Object.entries(operacionContratoLabels).map(([value, label]) => ({ value, label })),
        proyectosLista: [
          ...(proyectosRes.data.proyectos?.map(p => ({ value: p.codigo, label: `${p.codigo} - ${p.nombre}` })) || []),
          { value: 'otro', label: 'Otro (no listado)' }
        ]
      })
    } catch (error) {
      console.error('Error loading edit options:', error)
      // Use static options as fallback
      setEditOptions({
        areas: Object.entries(areaLabels).map(([value, label]) => ({ value, label })),
        operaciones: Object.entries(operacionContratoLabels).map(([value, label]) => ({ value, label })),
        proyectosLista: [{ value: 'otro', label: 'Otro (no listado)' }]
      })
    }
  }

  const enterEditMode = () => {
    if (!data?.solicitud) return

    const s = data.solicitud
    // Initialize edit data from current values
    setEditData({
      sponsor: s.datos_patrocinador || {},
      stakeholders: s.datos_stakeholders || {},
      problematica: s.descripcion_problema || {},
      urgencia: s.necesidad_urgencia || {},
      solucion: s.solucion_propuesta || {},
      beneficios: s.beneficios || {},
      desempeno: {
        indicadores: s.kpis || [],
        como_medir: s.declaracion?.desempeno?.como_medir || '',
        herramientas: s.declaracion?.desempeno?.herramientas || '',
        responsable_datos: s.declaracion?.desempeno?.responsable_datos || '',
        compromiso_sponsor: s.declaracion?.desempeno?.compromiso_sponsor || false,
        comentarios_adicionales: s.declaracion?.desempeno?.comentarios_adicionales || ''
      },
      proyecto_referencia: s.proyecto_referencia || {}
    })
    setNewFiles([])
    loadEditOptions()
    setIsEditMode(true)
  }

  const cancelEditMode = () => {
    setIsEditMode(false)
    setEditData({})
    setNewFiles([])
  }

  const updateEditData = (section, field, value) => {
    setEditData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  const updateNestedEditData = (section, subSection, field, value) => {
    setEditData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subSection]: {
          ...(prev[section]?.[subSection] || {}),
          [field]: value
        }
      }
    }))
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      // Save form data
      const result = await solicitudesApi.updateFormulario(codigo, editData)

      // Upload new files if any
      if (newFiles.length > 0) {
        await archivosApi.upload('solicitud', data.solicitud.id, newFiles)
      }

      if (result.data.changes?.length === 0 && newFiles.length === 0) {
        message.info('No se detectaron cambios')
      } else {
        message.success(`Formulario actualizado. ${result.data.changes?.length || 0} cambio(s).`)
      }

      setIsEditMode(false)
      setEditData({})
      setNewFiles([])
      loadSolicitud()
    } catch (error) {
      message.error(error.response?.data?.error || error.message || 'Error al guardar cambios')
    } finally {
      setSavingEdit(false)
    }
  }

  // Cost item management for edit mode
  const addCostItem = (type) => {
    const analisisCostos = editData.beneficios?.analisis_costos || {}
    const items = analisisCostos[type] || []
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        analisis_costos: {
          ...analisisCostos,
          [type]: [...items, { descripcion: '', cantidad: 1, valor: 0 }]
        }
      }
    }))
  }

  const removeCostItem = (type, index) => {
    const analisisCostos = editData.beneficios?.analisis_costos || {}
    const items = analisisCostos[type] || []
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        analisis_costos: {
          ...analisisCostos,
          [type]: items.filter((_, i) => i !== index)
        }
      }
    }))
  }

  const updateCostItem = (type, index, field, value) => {
    const analisisCostos = editData.beneficios?.analisis_costos || {}
    const items = [...(analisisCostos[type] || [])]
    items[index] = { ...items[index], [field]: value }
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        analisis_costos: {
          ...analisisCostos,
          [type]: items
        }
      }
    }))
  }

  // Monetary benefit item management for edit mode
  const addBenefitItem = () => {
    const beneficioMonetario = editData.beneficios?.beneficio_monetario || {}
    const items = beneficioMonetario.items || []
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        beneficio_monetario: {
          ...beneficioMonetario,
          items: [...items, { descripcion: '', cantidad: 1, valor: 0 }]
        }
      }
    }))
  }

  const removeBenefitItem = (index) => {
    const beneficioMonetario = editData.beneficios?.beneficio_monetario || {}
    const items = beneficioMonetario.items || []
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        beneficio_monetario: {
          ...beneficioMonetario,
          items: items.filter((_, i) => i !== index)
        }
      }
    }))
  }

  const updateBenefitItem = (index, field, value) => {
    const beneficioMonetario = editData.beneficios?.beneficio_monetario || {}
    const items = [...(beneficioMonetario.items || [])]
    items[index] = { ...items[index], [field]: value }
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        beneficio_monetario: {
          ...beneficioMonetario,
          items
        }
      }
    }))
  }

  const updateBenefitMonetario = (field, value) => {
    const beneficioMonetario = editData.beneficios?.beneficio_monetario || {}
    setEditData(prev => ({
      ...prev,
      beneficios: {
        ...prev.beneficios,
        beneficio_monetario: {
          ...beneficioMonetario,
          [field]: value
        }
      }
    }))
  }

  // KPI management for edit mode
  const addKpi = () => {
    const indicadores = editData.desempeno?.indicadores || []
    setEditData(prev => ({
      ...prev,
      desempeno: {
        ...prev.desempeno,
        indicadores: [...indicadores, { nombre: '', valor_actual: '', valor_objetivo: '', unidad: '' }]
      }
    }))
  }

  const removeKpi = (index) => {
    const indicadores = editData.desempeno?.indicadores || []
    setEditData(prev => ({
      ...prev,
      desempeno: {
        ...prev.desempeno,
        indicadores: indicadores.filter((_, i) => i !== index)
      }
    }))
  }

  const updateKpi = (index, field, value) => {
    const indicadores = [...(editData.desempeno?.indicadores || [])]
    indicadores[index] = { ...indicadores[index], [field]: value }
    setEditData(prev => ({
      ...prev,
      desempeno: {
        ...prev.desempeno,
        indicadores
      }
    }))
  }

  // Check if edit is allowed
  const canEdit = () => {
    if (!data?.solicitud) return false
    const { tipo, estado } = data.solicitud
    return ['proyecto_nuevo_interno', 'actualizacion'].includes(tipo) &&
           ['en_estudio', 'pendiente_reevaluacion'].includes(estado)
  }

  // ========== EDITABLE FORM SECTIONS ==========

  // Render Editable Sponsor Section
  const renderSponsorEdit = () => {
    if (data?.solicitud?.datos_solicitante?.es_doliente !== false) return null

    return (
      <Card
        title={<><UserOutlined /> Datos del Patrocinador (Sponsor) - Editando</>}
        size="small"
        style={{ marginBottom: 16, borderColor: '#1890ff' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Nombre Completo</Text>
              <Input
                value={editData.sponsor?.nombre_completo || ''}
                onChange={(e) => updateEditData('sponsor', 'nombre_completo', e.target.value)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Cargo</Text>
              <Input
                value={editData.sponsor?.cargo || ''}
                onChange={(e) => updateEditData('sponsor', 'cargo', e.target.value)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Área</Text>
              <Select
                style={{ width: '100%' }}
                value={editData.sponsor?.area || undefined}
                onChange={(v) => updateEditData('sponsor', 'area', v)}
                options={editOptions.areas}
                showSearch
                optionFilterProp="label"
                placeholder="Seleccione área"
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Operación/Contrato</Text>
              <Select
                style={{ width: '100%' }}
                value={editData.sponsor?.operacion_contrato || undefined}
                onChange={(v) => updateEditData('sponsor', 'operacion_contrato', v)}
                options={editOptions.operaciones}
                showSearch
                optionFilterProp="label"
                placeholder="Seleccione operación"
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Correo</Text>
              <Input
                value={editData.sponsor?.correo || ''}
                onChange={(e) => updateEditData('sponsor', 'correo', e.target.value)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Teléfono</Text>
              <Input
                value={editData.sponsor?.telefono || ''}
                onChange={(e) => updateEditData('sponsor', 'telefono', e.target.value)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Cédula</Text>
              <Input
                value={editData.sponsor?.cedula || ''}
                onChange={(e) => updateEditData('sponsor', 'cedula', e.target.value)}
              />
            </div>
          </Col>
        </Row>
      </Card>
    )
  }

  // Render Editable Stakeholders Section
  const renderStakeholdersEdit = () => {
    const internas = editData.stakeholders?.internas || {}
    const externas = editData.stakeholders?.externas || {}

    return (
      <Card
        title={<><TeamOutlined /> Partes Interesadas - Editando</>}
        size="small"
        style={{ marginBottom: 16, borderColor: '#1890ff' }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Áreas Interesadas</Text>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                value={internas.areas || []}
                onChange={(v) => updateNestedEditData('stakeholders', 'internas', 'areas', v)}
                placeholder="Ingrese áreas"
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Personas Clave Internas</Text>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                value={internas.personas || []}
                onChange={(v) => updateNestedEditData('stakeholders', 'internas', 'personas', v)}
                placeholder="Ingrese nombres"
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>¿Aplica Partes Externas?</Text>
              <Switch
                checked={editData.stakeholders?.aplica_externas || false}
                onChange={(v) => updateEditData('stakeholders', 'aplica_externas', v)}
                style={{ marginLeft: 8 }}
              />
            </div>
          </Col>
          {editData.stakeholders?.aplica_externas && (
            <>
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>Sectores Comerciales</Text>
                  <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    value={externas.sectores || []}
                    onChange={(v) => updateNestedEditData('stakeholders', 'externas', 'sectores', v)}
                    placeholder="Ingrese sectores"
                  />
                </div>
              </Col>
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>Empresas</Text>
                  <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    value={externas.empresas || []}
                    onChange={(v) => updateNestedEditData('stakeholders', 'externas', 'empresas', v)}
                    placeholder="Ingrese empresas"
                  />
                </div>
              </Col>
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>Proveedores</Text>
                  <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    value={externas.proveedores || []}
                    onChange={(v) => updateNestedEditData('stakeholders', 'externas', 'proveedores', v)}
                    placeholder="Ingrese proveedores"
                  />
                </div>
              </Col>
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>Personas Clave Externas</Text>
                  <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    value={externas.personas || []}
                    onChange={(v) => updateNestedEditData('stakeholders', 'externas', 'personas', v)}
                    placeholder="Ingrese nombres"
                  />
                </div>
              </Col>
            </>
          )}
        </Row>
      </Card>
    )
  }

  // Render Editable Problemática Section
  const renderProblematicaEdit = () => (
    <Card
      title={<><AlertOutlined /> Descripción de la Problemática - Editando</>}
      size="small"
      style={{ marginBottom: 16, borderColor: '#1890ff' }}
    >
      <Row gutter={16}>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Título</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>(Solo lectura)</Text>
            <Input value={data?.solicitud?.titulo || ''} disabled />
          </div>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Situación Actual</Text>
            <TextArea
              rows={4}
              value={editData.problematica?.situacion_actual || ''}
              onChange={(e) => updateEditData('problematica', 'situacion_actual', e.target.value)}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Origen del Problema</Text>
            <Input
              value={editData.problematica?.origen || ''}
              onChange={(e) => updateEditData('problematica', 'origen', e.target.value)}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Desde Cuándo</Text>
            <DatePicker
              style={{ width: '100%' }}
              value={editData.problematica?.desde_cuando ? dayjs(editData.problematica.desde_cuando) : null}
              onChange={(d) => updateEditData('problematica', 'desde_cuando', d?.toISOString())}
              format="DD/MM/YYYY"
            />
          </div>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Afectación a la Operación</Text>
            <TextArea
              rows={3}
              value={editData.problematica?.afectacion_operacion || ''}
              onChange={(e) => updateEditData('problematica', 'afectacion_operacion', e.target.value)}
            />
          </div>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Procesos Comprometidos</Text>
            <TextArea
              rows={3}
              value={editData.problematica?.procesos_comprometidos || ''}
              onChange={(e) => updateEditData('problematica', 'procesos_comprometidos', e.target.value)}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Nivel de Impacto</Text>
            <Select
              style={{ width: '100%' }}
              value={editData.problematica?.impacto_nivel || undefined}
              onChange={(v) => updateEditData('problematica', 'impacto_nivel', v)}
              options={Object.entries(impactoNivelLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Seleccione nivel"
            />
          </div>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Descripción del Impacto</Text>
            <TextArea
              rows={3}
              value={editData.problematica?.impacto_descripcion || ''}
              onChange={(e) => updateEditData('problematica', 'impacto_descripcion', e.target.value)}
            />
          </div>
        </Col>
      </Row>
    </Card>
  )

  // Render Editable Urgencia Section
  const renderUrgenciaEdit = () => (
    <Card
      title={<><ClockCircleOutlined /> Necesidad y Urgencia - Editando</>}
      size="small"
      style={{ marginBottom: 16, borderColor: '#1890ff' }}
    >
      <Row gutter={16}>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Necesidad Principal</Text>
            <TextArea
              rows={3}
              value={editData.urgencia?.necesidad_principal || ''}
              onChange={(e) => updateEditData('urgencia', 'necesidad_principal', e.target.value)}
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Nivel de Urgencia</Text>
            <Select
              style={{ width: '100%' }}
              value={editData.urgencia?.nivel || undefined}
              onChange={(v) => updateEditData('urgencia', 'nivel', v)}
              options={Object.entries(urgenciaNivelLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Seleccione nivel"
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Fecha Límite</Text>
            <DatePicker
              style={{ width: '100%' }}
              value={editData.urgencia?.fecha_limite ? dayjs(editData.urgencia.fecha_limite) : null}
              onChange={(d) => updateEditData('urgencia', 'fecha_limite', d?.toISOString())}
              format="DD/MM/YYYY"
            />
          </div>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>¿Por qué NT?</Text>
            <TextArea
              rows={3}
              value={editData.urgencia?.justificacion_nt || ''}
              onChange={(e) => updateEditData('urgencia', 'justificacion_nt', e.target.value)}
            />
          </div>
        </Col>
      </Row>
    </Card>
  )

  // Render Editable Solución Section
  const renderSolucionEdit = () => {
    // Support both old and new field names
    const tipoValue = editData.solucion?.tipo || editData.solucion?.tipo_solucion
    const tipoDescValue = editData.solucion?.tipo_descripcion || editData.solucion?.tipo_solucion_otro
    const descripcionIdealValue = editData.solucion?.descripcion_ideal || editData.solucion?.solucion_ideal

    return (
      <Card
        title={<><ToolOutlined /> Propuesta de Solución - Editando</>}
        size="small"
        style={{ marginBottom: 16, borderColor: '#1890ff' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Tipo de Solución</Text>
              <Select
                style={{ width: '100%' }}
                value={tipoValue || undefined}
                onChange={(v) => {
                  updateEditData('solucion', 'tipo', v)
                  updateEditData('solucion', 'tipo_solucion', v)
                }}
                options={Object.entries(tipoSolucionLabels).map(([value, label]) => ({ value, label }))}
                placeholder="Seleccione tipo"
              />
            </div>
          </Col>
          {tipoValue === 'otro' && (
            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Especifique (Otro)</Text>
                <Input
                  value={tipoDescValue || ''}
                  onChange={(e) => {
                    updateEditData('solucion', 'tipo_descripcion', e.target.value)
                    updateEditData('solucion', 'tipo_solucion_otro', e.target.value)
                  }}
                />
              </div>
            </Col>
          )}
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Descripción de la Solución Ideal</Text>
              <TextArea
                rows={3}
                value={descripcionIdealValue || ''}
                onChange={(e) => {
                  updateEditData('solucion', 'descripcion_ideal', e.target.value)
                  updateEditData('solucion', 'solucion_ideal', e.target.value)
                }}
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Casos de Uso</Text>
              <TextArea
                rows={3}
                value={editData.solucion?.casos_uso || ''}
                onChange={(e) => updateEditData('solucion', 'casos_uso', e.target.value)}
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Usuarios Finales</Text>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                value={editData.solucion?.usuarios_finales || []}
                onChange={(v) => updateEditData('solucion', 'usuarios_finales', v)}
                placeholder="Ingrese usuarios finales"
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Funcionalidades Mínimas</Text>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                value={editData.solucion?.funcionalidades_minimas || []}
                onChange={(v) => updateEditData('solucion', 'funcionalidades_minimas', v)}
                placeholder="Ingrese funcionalidades"
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Funcionalidades Deseables</Text>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                value={editData.solucion?.funcionalidades_deseables || []}
                onChange={(v) => updateEditData('solucion', 'funcionalidades_deseables', v)}
                placeholder="Ingrese funcionalidades"
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>¿Restricciones o Condiciones Especiales?</Text>
              <Switch
                checked={editData.solucion?.tiene_restricciones || false}
                onChange={(v) => updateEditData('solucion', 'tiene_restricciones', v)}
                style={{ marginLeft: 8 }}
              />
            </div>
          </Col>
          {editData.solucion?.tiene_restricciones && (
            <Col span={24}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Restricciones</Text>
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  value={editData.solucion?.restricciones || []}
                  onChange={(v) => updateEditData('solucion', 'restricciones', v)}
                  placeholder="Ingrese restricciones"
                />
              </div>
            </Col>
          )}
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Forma de Entrega</Text>
              <Select
                style={{ width: '100%' }}
                value={editData.solucion?.forma_entrega || undefined}
                onChange={(v) => updateEditData('solucion', 'forma_entrega', v)}
                options={Object.entries(formaEntregaLabels).map(([value, label]) => ({ value, label }))}
                placeholder="Seleccione forma"
              />
            </div>
          </Col>
        </Row>
      </Card>
    )
  }

  // Render Editable Beneficios Section
  const renderBeneficiosEdit = () => {
    const analisisCostos = editData.beneficios?.analisis_costos || {}
    const beneficioMonetario = editData.beneficios?.beneficio_monetario || {}
    const costosActuales = analisisCostos.costos_actuales || []
    const costosEsperados = analisisCostos.costos_esperados || []
    const benefitItems = beneficioMonetario.items || []

    return (
      <Card
        title={<><TrophyOutlined /> Beneficios Esperados - Editando</>}
        size="small"
        style={{ marginBottom: 16, borderColor: '#1890ff' }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Descripción</Text>
              <TextArea
                rows={3}
                value={editData.beneficios?.descripcion || ''}
                onChange={(e) => updateEditData('beneficios', 'descripcion', e.target.value)}
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Mejora Concreta</Text>
              <TextArea
                rows={3}
                value={editData.beneficios?.mejora_concreta || ''}
                onChange={(e) => updateEditData('beneficios', 'mejora_concreta', e.target.value)}
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Procesos a Optimizar</Text>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                value={editData.beneficios?.procesos_optimizados || []}
                onChange={(v) => updateEditData('beneficios', 'procesos_optimizados', v)}
                placeholder="Ingrese procesos"
              />
            </div>
          </Col>
          <Col span={24}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>¿Reducción de Costos?</Text>
              <Switch
                checked={editData.beneficios?.reduccion_costos || false}
                onChange={(v) => updateEditData('beneficios', 'reduccion_costos', v)}
                style={{ marginLeft: 8 }}
              />
            </div>
          </Col>

          {/* Cost Analysis Section */}
          {editData.beneficios?.reduccion_costos && (
            <Col span={24}>
              <div style={{ marginTop: 12, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
                <Text strong style={{ display: 'block', marginBottom: 16 }}>Análisis de Costos</Text>

                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Actuales</Text>
                    {costosActuales.map((item, index) => (
                      <Row key={index} gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={10}>
                          <Input
                            placeholder="Descripción"
                            value={item.descripcion || ''}
                            onChange={(e) => updateCostItem('costos_actuales', index, 'descripcion', e.target.value)}
                          />
                        </Col>
                        <Col span={4}>
                          <InputNumber
                            min={1}
                            value={item.cantidad || 1}
                            onChange={(v) => updateCostItem('costos_actuales', index, 'cantidad', v)}
                            style={{ width: '100%' }}
                          />
                        </Col>
                        <Col span={8}>
                          <InputNumber
                            min={0}
                            value={item.valor || 0}
                            onChange={(v) => updateCostItem('costos_actuales', index, 'valor', v)}
                            style={{ width: '100%' }}
                            formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                            parser={(value) => value.replace(/\$\s?|(\.)/g, '')}
                          />
                        </Col>
                        <Col span={2}>
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeCostItem('costos_actuales', index)} />
                        </Col>
                      </Row>
                    ))}
                    <Button type="dashed" onClick={() => addCostItem('costos_actuales')} icon={<PlusOutlined />} style={{ width: '100%' }}>
                      Agregar Costo Actual
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Costos Esperados</Text>
                    {costosEsperados.map((item, index) => (
                      <Row key={index} gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={10}>
                          <Input
                            placeholder="Descripción"
                            value={item.descripcion || ''}
                            onChange={(e) => updateCostItem('costos_esperados', index, 'descripcion', e.target.value)}
                          />
                        </Col>
                        <Col span={4}>
                          <InputNumber
                            min={1}
                            value={item.cantidad || 1}
                            onChange={(v) => updateCostItem('costos_esperados', index, 'cantidad', v)}
                            style={{ width: '100%' }}
                          />
                        </Col>
                        <Col span={8}>
                          <InputNumber
                            min={0}
                            value={item.valor || 0}
                            onChange={(v) => updateCostItem('costos_esperados', index, 'valor', v)}
                            style={{ width: '100%' }}
                            formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                            parser={(value) => value.replace(/\$\s?|(\.)/g, '')}
                          />
                        </Col>
                        <Col span={2}>
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeCostItem('costos_esperados', index)} />
                        </Col>
                      </Row>
                    ))}
                    <Button type="dashed" onClick={() => addCostItem('costos_esperados')} icon={<PlusOutlined />} style={{ width: '100%' }}>
                      Agregar Costo Esperado
                    </Button>
                  </Col>
                </Row>
              </div>
            </Col>
          )}

          {/* Monetary Benefit Section */}
          <Col span={24}>
            <div style={{ marginTop: 16 }}>
              <Text strong>¿Se espera beneficio monetario directo?</Text>
              <Switch
                checked={beneficioMonetario.espera_beneficio || false}
                onChange={(v) => updateBenefitMonetario('espera_beneficio', v)}
                style={{ marginLeft: 8 }}
              />
            </div>
          </Col>

          {beneficioMonetario.espera_beneficio && (
            <Col span={24}>
              <div style={{ marginTop: 12, padding: 16, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
                <Text strong style={{ display: 'block', marginBottom: 16 }}>Detalle del Beneficio Monetario</Text>

                {benefitItems.map((item, index) => (
                  <Row key={index} gutter={8} style={{ marginBottom: 8 }}>
                    <Col span={10}>
                      <Input
                        placeholder="Descripción del beneficio"
                        value={item.descripcion || ''}
                        onChange={(e) => updateBenefitItem(index, 'descripcion', e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <InputNumber
                        min={1}
                        value={item.cantidad || 1}
                        onChange={(v) => updateBenefitItem(index, 'cantidad', v)}
                        style={{ width: '100%' }}
                        addonBefore="×"
                      />
                    </Col>
                    <Col span={8}>
                      <InputNumber
                        min={0}
                        value={item.valor || 0}
                        onChange={(v) => updateBenefitItem(index, 'valor', v)}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        parser={(value) => value.replace(/\$\s?|(\.)/g, '')}
                      />
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeBenefitItem(index)} />
                    </Col>
                  </Row>
                ))}

                <Button type="dashed" onClick={addBenefitItem} icon={<PlusOutlined />} style={{ width: '100%', marginBottom: 12 }}>
                  Agregar Beneficio Monetario
                </Button>

                <div style={{ marginTop: 12 }}>
                  <Text strong>Justificación</Text>
                  <TextArea
                    rows={2}
                    value={beneficioMonetario.justificacion || ''}
                    onChange={(e) => updateBenefitMonetario('justificacion', e.target.value)}
                    placeholder="Explique cómo se calcularon estos valores..."
                  />
                </div>
              </div>
            </Col>
          )}
        </Row>
      </Card>
    )
  }

  // Render Editable Desempeño/KPIs Section
  const renderDesempenoEdit = () => {
    const indicadores = editData.desempeno?.indicadores || []

    return (
      <Card
        title={<><LineChartOutlined /> Control de Desempeño (KPIs) - Editando</>}
        size="small"
        style={{ marginBottom: 16, borderColor: '#1890ff' }}
      >
        {/* Indicadores */}
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Indicadores Propuestos</Text>
        {indicadores.map((kpi, index) => (
          <Row key={index} gutter={8} style={{ marginBottom: 8 }}>
            <Col span={6}>
              <Input
                placeholder="Nombre del indicador"
                value={kpi.nombre || ''}
                onChange={(e) => updateKpi(index, 'nombre', e.target.value)}
              />
            </Col>
            <Col span={5}>
              <Input
                placeholder="Valor actual"
                value={kpi.valor_actual || ''}
                onChange={(e) => updateKpi(index, 'valor_actual', e.target.value)}
              />
            </Col>
            <Col span={5}>
              <Input
                placeholder="Valor objetivo"
                value={kpi.valor_objetivo || ''}
                onChange={(e) => updateKpi(index, 'valor_objetivo', e.target.value)}
              />
            </Col>
            <Col span={5}>
              <Input
                placeholder="Unidad"
                value={kpi.unidad || ''}
                onChange={(e) => updateKpi(index, 'unidad', e.target.value)}
              />
            </Col>
            <Col span={3}>
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeKpi(index)}
              />
            </Col>
          </Row>
        ))}
        <Button type="dashed" onClick={addKpi} icon={<PlusOutlined />} style={{ width: '100%', marginBottom: 16 }}>
          Agregar Indicador
        </Button>

        {/* Plan de Medición */}
        <Divider style={{ margin: '16px 0' }} />
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Plan de Medición</Text>

        <div style={{ marginBottom: 12 }}>
          <Text strong>¿Cómo se medirá cada indicador?</Text>
          <TextArea
            rows={3}
            value={editData.desempeno?.como_medir || ''}
            onChange={(e) => updateEditData('desempeno', 'como_medir', e.target.value)}
            placeholder="Describa la metodología de medición..."
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>Herramientas a usar</Text>
          <Input
            value={editData.desempeno?.herramientas || ''}
            onChange={(e) => updateEditData('desempeno', 'herramientas', e.target.value)}
            placeholder="Ej: Excel, Power BI, Sistema interno"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>¿Quién captura y registra los datos?</Text>
          <Input
            value={editData.desempeno?.responsable_datos || ''}
            onChange={(e) => updateEditData('desempeno', 'responsable_datos', e.target.value)}
            placeholder="Nombre o cargo del responsable"
          />
        </div>

        {/* Responsabilidades del Sponsor */}
        <Divider style={{ margin: '16px 0' }} />
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Responsabilidades del Sponsor</Text>

        <div style={{ marginBottom: 12 }}>
          <Text strong>¿Se compromete a medir y reportar KPIs?</Text>
          <Switch
            checked={editData.desempeno?.compromiso_sponsor || false}
            onChange={(v) => updateEditData('desempeno', 'compromiso_sponsor', v)}
            style={{ marginLeft: 8 }}
            checkedChildren="Sí"
            unCheckedChildren="No"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>Comentarios adicionales</Text>
          <TextArea
            rows={2}
            value={editData.desempeno?.comentarios_adicionales || ''}
            onChange={(e) => updateEditData('desempeno', 'comentarios_adicionales', e.target.value)}
            placeholder="Comentarios adicionales sobre medición..."
          />
        </div>
      </Card>
    )
  }

  // Render Editable Proyecto Referencia Section (for actualizacion only)
  const renderProyectoReferenciaEdit = () => (
    <Card
      title={<><FileTextOutlined /> Proyecto a Actualizar - Editando</>}
      size="small"
      style={{ marginBottom: 16, borderColor: '#1890ff' }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Proyecto</Text>
            <Select
              style={{ width: '100%' }}
              value={editData.proyecto_referencia?.proyecto_id || undefined}
              onChange={(v) => {
                updateEditData('proyecto_referencia', 'proyecto_id', v)
                if (v !== 'otro') {
                  updateEditData('proyecto_referencia', 'proyecto_nombre_otro', null)
                }
              }}
              options={editOptions.proyectosLista}
              showSearch
              optionFilterProp="label"
              placeholder="Seleccione proyecto"
            />
          </div>
        </Col>
        {editData.proyecto_referencia?.proyecto_id === 'otro' && (
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Nombre del Proyecto</Text>
              <Input
                value={editData.proyecto_referencia?.proyecto_nombre_otro || ''}
                onChange={(e) => updateEditData('proyecto_referencia', 'proyecto_nombre_otro', e.target.value)}
              />
            </div>
          </Col>
        )}
      </Row>
    </Card>
  )

  // Render New Files Upload Section
  const renderNewFilesUpload = () => (
    <Card
      title={<><UploadOutlined /> Agregar Archivos</>}
      size="small"
      style={{ marginBottom: 16, borderColor: '#1890ff' }}
    >
      <Upload
        multiple
        fileList={newFiles}
        beforeUpload={(file) => {
          setNewFiles(prev => [...prev, file])
          return false
        }}
        onRemove={(file) => {
          setNewFiles(prev => prev.filter(f => f.uid !== file.uid))
        }}
      >
        <Button icon={<UploadOutlined />}>Seleccionar Archivos</Button>
      </Upload>
      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        Los archivos se guardarán al hacer clic en "Guardar Cambios"
      </Text>
    </Card>
  )

  // ========== END EDITABLE FORM SECTIONS ==========

  const loadTransferInfo = async () => {
    try {
      const response = await transferenciasApi.get('solicitud', codigo)
      if (response.data.transferencias_como_origen?.length > 0) {
        setTransferInfo(response.data.transferencias_como_origen[0])
      }
    } catch (error) {
      console.error('Error loading transfer info:', error)
    }
  }

  const loadSolicitud = async () => {
    try {
      const response = await solicitudesApi.get(codigo)
      setData(response.data)
    } catch (error) {
      console.error('Error loading solicitud:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const response = await exportApi.solicitudPdf(codigo)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${data?.solicitud?.codigo || 'solicitud'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('PDF descargado')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      message.error('Error al descargar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleChangeEstado = async (nuevoEstado, comentario = '') => {
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(codigo, { estado: nuevoEstado, comentario })
      message.success('Estado actualizado')
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al actualizar estado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    try {
      await solicitudesApi.addComment(codigo, { contenido: comment, tipo: comentarioTipo })
      setComment('')
      if (comentarioTipo === 'comunicacion') {
        message.success('Comunicación enviada al solicitante por correo')
      } else {
        message.success('Comentario agregado')
      }
      loadSolicitud()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al agregar comentario')
    }
  }

  const handleTransferTI = async () => {
    if (!transferMotivo.trim()) {
      message.error('Debe ingresar un motivo para la transferencia')
      return
    }
    setActionLoading(true)
    try {
      const response = await solicitudesApi.transferirTI(codigo, { motivo: transferMotivo })
      message.success(`Solicitud transferida a TI. Nuevo ticket: ${response.data.ticket.codigo}`)
      setTransferModalVisible(false)
      setTransferMotivo('')
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al transferir solicitud')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompletado = async () => {
    Modal.confirm({
      title: 'Marcar como Completado',
      content: '¿Está seguro que desea marcar esta solicitud como completada?',
      okText: 'Sí, Completar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setActionLoading(true)
        try {
          await solicitudesApi.updateEstado(codigo, { estado: 'completado', comentario: 'Solicitud completada' })
          message.success('Solicitud marcada como completada')
          loadSolicitud()
        } catch (error) {
          message.error(error.message || 'Error al actualizar estado')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const handleEnEstudio = async () => {
    setActionLoading(true)
    try {
      await solicitudesApi.updateEstado(codigo, { estado: 'en_estudio', comentario: 'Iniciando análisis de la solicitud' })
      message.success('Solicitud puesta en estudio')
      loadSolicitud()
    } catch (error) {
      message.error(error.message || 'Error al actualizar estado')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!data?.solicitud) {
    return <Card><Title level={4}>Solicitud no encontrada</Title></Card>
  }

  const { solicitud, comentarios, archivos, archivos_agrupados } = data

  // Extract data from different storage formats (old and new)
  const identificacion = solicitud.datos_solicitante || {}
  const sponsor = solicitud.datos_patrocinador || {}
  const stakeholders = solicitud.datos_stakeholders || {}
  const problematica = solicitud.descripcion_problema || {}
  const urgencia = solicitud.necesidad_urgencia || {}
  const solucion = solicitud.solucion_propuesta || {}
  const beneficios = solicitud.beneficios || {}
  const kpis = solicitud.kpis || []
  const declaracion = solicitud.declaracion || {}

  // For cierre_servicio
  const razonamiento = problematica // Stored in descripcion_problema
  const responsables = stakeholders // Stored in datos_stakeholders

  // For reporte_fallo
  const reporte = problematica // Stored in descripcion_problema
  const criticidad = urgencia // Stored in necesidad_urgencia

  // Render Identificación Section (common to all types)
  // Note: es_doliente is asked for proyecto_nuevo_interno, actualizacion, and cierre_servicio
  const showEsDoliente = ['proyecto_nuevo_interno', 'actualizacion', 'cierre_servicio'].includes(solicitud.tipo)

  const renderIdentificacion = () => (
    <Card
      title={<><UserOutlined /> Identificación del Solicitante</>}
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
        <Descriptions.Item label="Cédula">
          {identificacion.cedula || '--'}
        </Descriptions.Item>
        {showEsDoliente && (
          <Descriptions.Item label="¿Es Doliente?">
            {identificacion.es_doliente === true ? 'Sí' :
             identificacion.es_doliente === false ? 'No' : '--'}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  )

  // Render Sponsor Section (for proyecto/actualizacion/cierre when es_doliente = false)
  const renderSponsor = () => {
    // Only show sponsor section if es_doliente is explicitly false
    if (identificacion.es_doliente !== false) return null

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
          <Descriptions.Item label="Operación/Contrato">
            {getLabel(sponsor.operacion_contrato, operacionContratoLabels)}
          </Descriptions.Item>
          <Descriptions.Item label="Correo">
            {sponsor.correo || sponsor.email || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Teléfono">
            {sponsor.telefono || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Cédula">
            {sponsor.cedula || '--'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Stakeholders (for proyecto/actualizacion)
  const renderStakeholders = () => {
    const internas = stakeholders.internas || {}
    const externas = stakeholders.externas || {}

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
          <Descriptions.Item label="¿Aplica Partes Externas?">
            {stakeholders.aplica_externas === true ? 'Sí' :
             stakeholders.aplica_externas === false ? 'No' : '--'}
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
              <Descriptions.Item label="Proveedores">
                {externas.proveedores?.length > 0
                  ? externas.proveedores.map((p, i) => <Tag key={i}>{p}</Tag>)
                  : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Personas Clave Externas">
                {externas.personas?.length > 0
                  ? externas.personas.map((p, i) => <Tag key={i}>{p}</Tag>)
                  : '--'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>
    )
  }

  // Render Problemática (for proyecto/actualizacion)
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
        <Descriptions.Item label="Desde Cuándo">
          {problematica.desde_cuando ? dayjs(problematica.desde_cuando).format('DD/MM/YYYY') : '--'}
        </Descriptions.Item>
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
        <Descriptions.Item label="Nivel de Impacto">
          {problematica.impacto_nivel ? (
            <Tag color={
              problematica.impacto_nivel === 'critico' ? 'red' :
              problematica.impacto_nivel === 'alto' ? 'orange' :
              problematica.impacto_nivel === 'medio' ? 'cyan' : 'green'
            }>
              {problematica.impacto_nivel.toUpperCase()}
            </Tag>
          ) : '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Descripción del Impacto">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {problematica.impacto_descripcion || problematica.impacto || '--'}
          </span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Urgencia (for proyecto/actualizacion)
  const renderUrgencia = () => (
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
        <Descriptions.Item label="Nivel de Urgencia">
          {urgencia.nivel ? (
            <Tag color={
              urgencia.nivel === 'inmediata' ? 'red' :
              urgencia.nivel === 'corto_plazo' ? 'orange' :
              urgencia.nivel === 'mediano_plazo' ? 'cyan' : 'green'
            }>
              {urgencia.nivel.replace(/_/g, ' ').toUpperCase()}
            </Tag>
          ) : '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Fecha Límite">
          {urgencia.fecha_limite ? dayjs(urgencia.fecha_limite).format('DD/MM/YYYY') : '--'}
        </Descriptions.Item>
        <Descriptions.Item label="¿Por qué NT?">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {urgencia.justificacion_nt || urgencia.justificacion || '--'}
          </span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Solución (for proyecto/actualizacion)
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
                renderItem={item => <List.Item>• {item}</List.Item>}
              />
            ) : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Funcionalidades Deseables">
            {solucion.funcionalidades_deseables?.length > 0 ? (
              <List
                size="small"
                dataSource={solucion.funcionalidades_deseables}
                renderItem={item => <List.Item>• {item}</List.Item>}
              />
            ) : '--'}
          </Descriptions.Item>
          <Descriptions.Item label="¿Restricciones o Condiciones Especiales?">
            {solucion.tiene_restricciones === true ? 'Sí' :
             solucion.tiene_restricciones === false ? 'No' : '--'}
          </Descriptions.Item>
          {solucion.tiene_restricciones && solucion.restricciones?.length > 0 && (
            <Descriptions.Item label="Restricciones">
              <List
                size="small"
                dataSource={solucion.restricciones}
                renderItem={item => <List.Item>• {item}</List.Item>}
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

  // Format Colombian Pesos
  const formatCOP = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '$ 0'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Render Beneficios (for proyecto/actualizacion)
  const renderBeneficios = () => {
    const analisisCostos = beneficios.analisis_costos || {}
    const beneficioMonetario = beneficios.beneficio_monetario || {}

    // Calculate totals for cost analysis
    const totalActual = (analisisCostos.costos_actuales || []).reduce(
      (sum, item) => sum + ((item.cantidad || 1) * (item.valor || 0)), 0
    )
    const totalEsperado = (analisisCostos.costos_esperados || []).reduce(
      (sum, item) => sum + ((item.cantidad || 1) * (item.valor || 0)), 0
    )
    const ahorro = totalActual - totalEsperado

    // Calculate total monetary benefit
    const totalBeneficio = (beneficioMonetario.items || []).reduce(
      (sum, item) => sum + ((item.cantidad || 1) * (item.valor || 0)), 0
    )

    return (
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
                          {item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor)}
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
                          {item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor)}
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
                        {item.cantidad > 1 ? `${item.cantidad} × ` : ''}{formatCOP(item.valor)}
                        {item.cantidad > 1 && <Text type="secondary"> = {formatCOP(item.cantidad * item.valor)}</Text>}
                      </Text>
                    </List.Item>
                  )}
                />
              ) : '--'}

              <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 8, textAlign: 'center', border: '1px solid #52c41a' }}>
                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                  Total Beneficio Monetario: {formatCOP(totalBeneficio)}
                </Text>
              </div>

              {beneficioMonetario.justificacion && (
                <div style={{ marginTop: 12 }}>
                  <Text strong>Justificación:</Text>
                  <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {beneficioMonetario.justificacion}
                  </Paragraph>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    )
  }

  // Render KPIs/Desempeño (for proyecto/actualizacion)
  const renderDesempeno = () => {
    const desempeno = declaracion.desempeno || solicitud.desempeno || {}

    return (
      <Card
        title={<><LineChartOutlined /> Control de Desempeño (KPIs)</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {/* Indicadores */}
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Indicadores Propuestos</Text>
        {kpis.length > 0 ? (
          <List
            size="small"
            dataSource={kpis}
            renderItem={(kpi, index) => (
              <List.Item>
                <Descriptions size="small" column={{ xs: 1, sm: 4 }}>
                  <Descriptions.Item label="Indicador">{kpi.nombre || '--'}</Descriptions.Item>
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

        {/* Plan de Medición */}
        <Divider style={{ margin: '16px 0' }} />
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Plan de Medición</Text>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="¿Cómo se medirá cada indicador?">
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {desempeno.como_medir || '--'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Herramientas a usar">
            {desempeno.herramientas || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="¿Quién captura y registra los datos?">
            {desempeno.responsable_datos || '--'}
          </Descriptions.Item>
        </Descriptions>

        {/* Responsabilidades del Sponsor */}
        <Divider style={{ margin: '16px 0' }} />
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Responsabilidades del Sponsor</Text>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="¿Se compromete a medir y reportar KPIs?">
            {desempeno.compromiso_sponsor === true ? 'Sí, me comprometo' :
             desempeno.compromiso_sponsor === false ? 'No puedo comprometerme' : '--'}
          </Descriptions.Item>
          {desempeno.comentarios_adicionales && (
            <Descriptions.Item label="Comentarios adicionales">
              <span style={{ whiteSpace: 'pre-wrap' }}>
                {desempeno.comentarios_adicionales}
              </span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    )
  }

  // Render Proyecto Referencia (for reporte_fallo, actualizacion)
  const renderProyectoReferencia = () => {
    const proyectoRef = solicitud.proyecto_referencia || {}
    const proyectoId = proyectoRef.proyecto_id || '--'
    const proyectoNombreOtro = proyectoRef.proyecto_nombre_otro || null

    const titulo = solicitud.tipo === 'actualizacion'
      ? 'Proyecto a Actualizar'
      : 'Proyecto Relacionado'

    return (
      <Card
        title={<><FileTextOutlined /> {titulo}</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Proyecto">
            {proyectoId === 'otro' ? (proyectoNombreOtro || '--') : (proyectoId === '--' ? '--' : proyectoId)}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Reporte (for reporte_fallo)
  const renderReporte = () => (
    <Card
      title={<><AlertOutlined /> Reporte del Fallo</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Título">
          {solicitud.titulo || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Descripción">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {reporte.descripcion || reporte.situacion_actual || reporte.problema_actual || '--'}
          </span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Criticidad (for reporte_fallo)
  const renderCriticidad = () => (
    <Card
      title={<><ClockCircleOutlined /> Criticidad</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Urgencia">
          {(criticidad.urgencia || criticidad.nivel) ? (
            <Tag color={
              (criticidad.urgencia || criticidad.nivel) === 'critica' ? 'red' :
              (criticidad.urgencia || criticidad.nivel) === 'alta' ? 'orange' :
              (criticidad.urgencia || criticidad.nivel) === 'media' ? 'cyan' : 'green'
            }>
              {(criticidad.urgencia || criticidad.nivel).toUpperCase()}
            </Tag>
          ) : '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Justificación">
          {criticidad.justificacion || criticidad.justificacion_nt || '--'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Proyecto Referencia for cierre_servicio
  const renderServicioReferencia = () => {
    const proyectoRef = solicitud.proyecto_referencia || {}
    const proyectoId = proyectoRef.proyecto_id || '--'
    const proyectoNombreOtro = proyectoRef.proyecto_nombre_otro || null

    return (
      <Card
        title={<><FileTextOutlined /> Servicio a Cerrar</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Servicio/Proyecto">
            {proyectoId === 'otro' ? (proyectoNombreOtro || '--') : proyectoId}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Razonamiento (for cierre_servicio)
  const renderRazonamiento = () => (
    <Card
      title={<><FileTextOutlined /> Razonamiento</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Título">
          {solicitud.titulo || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Descripción de la razón de cierre">
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {razonamiento.descripcion || razonamiento.situacion_actual || '--'}
          </span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Responsables (for cierre_servicio)
  const renderResponsables = () => (
    <Card
      title={<><TeamOutlined /> Responsable y Veedores</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Responsable del Cierre">
          {responsables.responsable_nombre || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Cargo del Responsable">
          {responsables.responsable_cargo || '--'}
        </Descriptions.Item>
        <Descriptions.Item label="Veedores">
          {responsables.veedores?.length > 0 ? (
            <List
              size="small"
              dataSource={responsables.veedores}
              renderItem={v => <List.Item>{v.nombre || '--'} - {v.cargo || '--'}</List.Item>}
            />
          ) : '--'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Confirmación (for cierre_servicio)
  const renderConfirmacion = () => {
    const confirmacion = solicitud.confirmacion || {}

    return (
      <Card
        title={<><CheckCircleOutlined /> Confirmación</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="¿Confirmó la solicitud de cierre?">
            {confirmacion.confirmo_cierre === true
              ? <Tag color="green">Sí - Confirmado</Tag>
              : confirmacion.confirmo_cierre === false
              ? <Tag color="red">No</Tag>
              : '--'}
          </Descriptions.Item>
        </Descriptions>
        {confirmacion.confirmo_cierre && (
          <Alert
            message="El solicitante confirmó que desea solicitar el cierre de este servicio y que ha coordinado con las áreas afectadas."
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    )
  }

  // Render Transferred IT Ticket data (as reporte_fallo form with all fields)
  const renderTransferredTicket = () => {
    // problematica contains: descripcion_original, motivo_transferencia, ticket_origen
    const ticketOrigen = problematica.ticket_origen || '--'
    const descripcionOriginal = problematica.descripcion_original || '--'
    const motivoTransferencia = problematica.motivo_transferencia || '--'

    // Get criticidad from identificacion (where it was stored from IT ticket)
    const crit = identificacion.criticidad || {}

    return (
      <>
        {renderIdentificacion()}

        {/* Proyecto Referencia - editable for transferido_ti */}
        <Card
          title={<><FileTextOutlined /> Proyecto Relacionado</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Proyecto">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Seleccione un proyecto"
                  loading={proyectosLoading}
                  options={proyectos}
                  value={selectedProyecto}
                  onChange={(value) => {
                    setSelectedProyecto(value)
                    if (value !== 'otro') setProyectoOtroNombre('')
                  }}
                  showSearch
                  optionFilterProp="label"
                />
                {selectedProyecto === 'otro' && (
                  <Input
                    placeholder="Nombre del proyecto"
                    value={proyectoOtroNombre}
                    onChange={(e) => setProyectoOtroNombre(e.target.value)}
                  />
                )}
                <Button
                  type="primary"
                  size="small"
                  loading={savingProyecto}
                  onClick={handleSaveProyecto}
                  disabled={!selectedProyecto || (selectedProyecto === 'otro' && !proyectoOtroNombre.trim())}
                >
                  Guardar Proyecto
                </Button>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Reporte del Fallo */}
        <Card
          title={<><AlertOutlined /> Reporte del Fallo</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Título">
              {solicitud.titulo?.replace(/^\[Transferido de [^\]]+\]\s*/, '') || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="Descripción">
              <span style={{ whiteSpace: 'pre-wrap' }}>{descripcionOriginal}</span>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Criticidad */}
        <Card
          title={<><ClockCircleOutlined /> Criticidad</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Urgencia">
              {crit.urgencia ? (
                <Tag color={
                  crit.urgencia === 'critica' ? 'red' :
                  crit.urgencia === 'alta' ? 'orange' :
                  crit.urgencia === 'media' ? 'cyan' : 'green'
                }>
                  {crit.urgencia.toUpperCase()}
                </Tag>
              ) : '--'}
            </Descriptions.Item>
            <Descriptions.Item label="Justificación">
              {crit.justificacion || '--'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Transfer Info */}
        <Card
          title={<><SwapOutlined /> Información de Transferencia</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Ticket Origen">
              <Link to={`/ti/tickets/${ticketOrigen}`}>{ticketOrigen}</Link>
            </Descriptions.Item>
            <Descriptions.Item label="Motivo de Transferencia">
              <span style={{ whiteSpace: 'pre-wrap' }}>{motivoTransferencia}</span>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </>
    )
  }

  // Render form data based on tipo
  const renderFormData = () => {
    const tipo = solicitud.tipo

    if (tipo === 'transferido_ti') {
      return renderTransferredTicket()
    }

    if (tipo === 'reporte_fallo') {
      return (
        <>
          {renderIdentificacion()}
          {renderProyectoReferencia()}
          {renderReporte()}
          {renderCriticidad()}
        </>
      )
    }

    if (tipo === 'cierre_servicio') {
      return (
        <>
          {renderIdentificacion()}
          {renderSponsor()}
          {renderServicioReferencia()}
          {renderRazonamiento()}
          {renderResponsables()}
          {renderConfirmacion()}
        </>
      )
    }

    // proyecto_nuevo_interno - with edit mode support
    if (tipo === 'proyecto_nuevo_interno') {
      if (isEditMode) {
        return (
          <>
            {renderIdentificacion()}
            {renderSponsorEdit()}
            {renderStakeholdersEdit()}
            {renderProblematicaEdit()}
            {renderUrgenciaEdit()}
            {renderSolucionEdit()}
            {renderBeneficiosEdit()}
            {renderDesempenoEdit()}
            {renderNewFilesUpload()}
          </>
        )
      }
      return (
        <>
          {renderIdentificacion()}
          {renderSponsor()}
          {renderStakeholders()}
          {renderProblematica()}
          {renderUrgencia()}
          {renderSolucion()}
          {renderBeneficios()}
          {renderDesempeno()}
        </>
      )
    }

    // actualizacion (includes proyecto reference) - with edit mode support
    if (isEditMode) {
      return (
        <>
          {renderIdentificacion()}
          {renderSponsorEdit()}
          {renderProyectoReferenciaEdit()}
          {renderStakeholdersEdit()}
          {renderProblematicaEdit()}
          {renderUrgenciaEdit()}
          {renderSolucionEdit()}
          {renderBeneficiosEdit()}
          {renderDesempenoEdit()}
          {renderNewFilesUpload()}
        </>
      )
    }
    return (
      <>
        {renderIdentificacion()}
        {renderSponsor()}
        {renderProyectoReferencia()}
        {renderStakeholders()}
        {renderProblematica()}
        {renderUrgencia()}
        {renderSolucion()}
        {renderBeneficios()}
        {renderDesempeno()}
      </>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/nt/solicitudes">
          <Button icon={<ArrowLeftOutlined />}>Volver</Button>
        </Link>
        <Button
          icon={<FilePdfOutlined />}
          loading={pdfLoading}
          onClick={handleDownloadPDF}
        >
          Descargar PDF
        </Button>
      </Space>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>{solicitud.titulo?.replace(/^\[Transferido de [^\]]+\]\s*/, '')}</Title>
            <Space wrap>
              <Text type="secondary">{solicitud.codigo}</Text>
              <Tag>{tipoLabels[solicitud.tipo] || solicitud.tipo}</Tag>
              <Tag color={estadoColors[solicitud.estado]}>{estadoLabels[solicitud.estado] || solicitud.estado?.replace(/_/g, ' ')}</Tag>
              <Tag color={
                solicitud.prioridad === 'critica' ? 'red' :
                solicitud.prioridad === 'alta' ? 'orange' : 'cyan'
              }>{solicitud.prioridad?.toUpperCase()}</Tag>
            </Space>
          </div>
          <Space wrap>
            {/* Simple workflow actions (reporte_fallo, cierre_servicio) */}
            {isSimpleTipo(solicitud.tipo) && solicitud.estado === 'pendiente_evaluacion_nt' && (
              <>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={actionLoading}
                  onClick={handleCompletado}
                >
                  Completar
                </Button>
                {canTransferToTI(solicitud.tipo) && (
                  <Button
                    icon={<SwapOutlined />}
                    loading={actionLoading}
                    onClick={() => setTransferModalVisible(true)}
                  >
                    Transferir a TI
                  </Button>
                )}
                <Button
                  danger
                  icon={<CloseOutlined />}
                  loading={actionLoading}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Descartar Solicitud',
                      content: 'Esta acción no se puede deshacer. ¿Está seguro?',
                      onOk: () => handleChangeEstado('descartado_nt', 'Solicitud descartada por NT')
                    })
                  }}
                >
                  Descartar
                </Button>
              </>
            )}

            {/* Complex workflow actions (proyecto_nuevo_interno, actualizacion) */}
            {!isSimpleTipo(solicitud.tipo) && solicitud.estado === 'pendiente_evaluacion_nt' && (
              <>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={actionLoading}
                  onClick={handleEnEstudio}
                >
                  Iniciar Estudio
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  loading={actionLoading}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Descartar Solicitud',
                      content: 'Esta acción no se puede deshacer. ¿Está seguro?',
                      onOk: () => handleChangeEstado('descartado_nt', 'Solicitud descartada por NT')
                    })
                  }}
                >
                  Descartar
                </Button>
              </>
            )}
            {!isSimpleTipo(solicitud.tipo) && solicitud.estado === 'en_estudio' && (
              <>
                {!isEditMode && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={enterEditMode}
                  >
                    Editar Formulario
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/nt/solicitudes/${codigo}/evaluacion`)}
                >
                  Crear Evaluación
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  loading={actionLoading}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Descartar Solicitud',
                      content: 'Esta acción no se puede deshacer. ¿Está seguro?',
                      onOk: () => handleChangeEstado('descartado_nt', 'Solicitud descartada por NT')
                    })
                  }}
                >
                  Descartar
                </Button>
              </>
            )}
            {!isSimpleTipo(solicitud.tipo) && solicitud.estado === 'pendiente_reevaluacion' && (
              <>
                {!isEditMode && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={enterEditMode}
                  >
                    Editar Formulario
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={actionLoading}
                  onClick={handleEnEstudio}
                >
                  Volver a Estudio
                </Button>
              </>
            )}
          </Space>
        </div>

        <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="Fecha de Creación">
            {dayjs(solicitud.creado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="Última Actualización">
            {dayjs(solicitud.actualizado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        {/* Terminal state alerts */}
        {solicitud.estado === 'transferido_ti' && (
          <Alert
            message="Solicitud Transferida a TI"
            description={
              transferInfo ? (
                <span>
                  Esta solicitud fue transferida y se creó un nuevo ticket con código{' '}
                  <strong>{transferInfo.destino_codigo}</strong>.{' '}
                  <Link to={`/ti/tickets/${transferInfo.destino_codigo}`}>Ver ticket</Link>
                </span>
              ) : (
                'Esta solicitud fue transferida al departamento de TI.'
              )
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {solicitud.estado === 'completado' && (
          <Alert
            message="Solicitud Completada"
            description="Esta solicitud ha sido completada satisfactoriamente."
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {solicitud.estado === 'descartado_nt' && (
          <Alert
            message="Solicitud Descartada"
            description={solicitud.motivo_rechazo || 'Esta solicitud fue descartada por el equipo de NT.'}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {solicitud.estado === 'pendiente_reevaluacion' && (
          <Alert
            message="Pendiente de Reevaluación"
            description="Gerencia ha solicitado una reevaluación de esta solicitud."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Divider orientation="left">Datos del Formulario</Divider>

        {isEditMode && (
          <Alert
            message="Modo de Edición"
            description="Está editando el formulario de la solicitud. Los cambios se guardarán al hacer clic en 'Guardar Cambios'."
            type="info"
            showIcon
            icon={<EditOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {renderFormData()}

        {/* Edit Mode Actions */}
        {isEditMode && (
          <div style={{
            position: 'sticky',
            bottom: 0,
            background: '#fff',
            padding: '16px',
            borderTop: '1px solid #f0f0f0',
            marginTop: 24,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            zIndex: 10
          }}>
            <Button onClick={cancelEditMode} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={savingEdit}
              onClick={handleSaveEdit}
            >
              Guardar Cambios
            </Button>
          </div>
        )}

        {(archivos_agrupados?.length > 0 || archivos?.length > 0) && (
          <>
            <Divider orientation="left">Archivos Adjuntos</Divider>
            <Card size="small">
              {archivos_agrupados?.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {archivos_agrupados.map(grupo => (
                    <div key={grupo.origen}>
                      <Text strong style={{ color: '#666', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                        {grupo.label} ({grupo.archivos.length})
                      </Text>
                      <Space direction="vertical" style={{ width: '100%', paddingLeft: 8 }}>
                        {grupo.archivos.map(a => {
                          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:11001'
                          const isImage = a.mime_type?.startsWith('image/')
                          const isPdf = a.mime_type === 'application/pdf'
                          return (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <FileOutlined style={{ color: isPdf ? '#ff4d4f' : isImage ? '#52c41a' : '#1890ff' }} />
                              <a href={`${API_URL}/api/archivos/${a.id}/preview`} target="_blank" rel="noopener noreferrer">
                                {a.nombre_original}
                              </a>
                              {a.respuesta_numero && (
                                <Tag color="cyan" style={{ fontSize: 11 }}>{a.respuesta_numero}</Tag>
                              )}
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                ({(a.tamano / 1024).toFixed(1)} KB)
                              </Text>
                              {a.subido_por_nombre && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  por {a.subido_por_nombre}
                                </Text>
                              )}
                              <Button
                                size="small"
                                type="link"
                                icon={<DownloadOutlined />}
                                href={`${API_URL}/api/archivos/${a.id}/download`}
                              />
                            </div>
                          )
                        })}
                      </Space>
                      <Divider style={{ margin: '8px 0' }} />
                    </div>
                  ))}
                </Space>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {archivos.map(a => {
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:11001'
                    const isImage = a.mime_type?.startsWith('image/')
                    const isPdf = a.mime_type === 'application/pdf'
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileOutlined style={{ color: isPdf ? '#ff4d4f' : isImage ? '#52c41a' : '#1890ff' }} />
                        <a href={`${API_URL}/api/archivos/${a.id}/preview`} target="_blank" rel="noopener noreferrer">
                          {a.nombre_original}
                        </a>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({(a.tamano / 1024).toFixed(1)} KB)
                        </Text>
                        <Button
                          size="small"
                          type="link"
                          icon={<DownloadOutlined />}
                          href={`${API_URL}/api/archivos/${a.id}/download`}
                        />
                      </div>
                    )
                  })}
                </Space>
              )}
            </Card>
          </>
        )}

        <Divider orientation="left">Comentarios</Divider>
        <Timeline>
          {comentarios?.slice().sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)).map(c => (
            <Timeline.Item
              key={c.id}
              color={
                c.tipo === 'cambio_estado' ? 'purple' :
                c.tipo === 'interno' ? 'orange' :
                c.tipo === 'comunicacion' ? 'blue' :
                c.tipo === 'publico' ? 'green' :
                c.interno ? 'orange' : 'gray'
              }
            >
              <div>
                <Text strong>{c.autor_externo || c.autor_nombre}</Text>
                {c.tipo === 'interno' && <Tag color="orange" style={{ marginLeft: 8 }}>Interno</Tag>}
                {c.tipo === 'publico' && <Tag color="green" style={{ marginLeft: 8 }}>Público</Tag>}
                {c.tipo === 'comunicacion' && <Tag color="blue" style={{ marginLeft: 8 }}>Comunicación</Tag>}
                {c.tipo === 'respuesta' && <Tag color="cyan" style={{ marginLeft: 8 }}>Respuesta Solicitante</Tag>}
                {c.tipo === 'cambio_estado' && <Tag color="purple" style={{ marginLeft: 8 }}>Sistema</Tag>}
                {!c.tipo && c.interno && <Tag color="orange" style={{ marginLeft: 8 }}>Interno</Tag>}
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
                </Text>
              </div>
              <Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.contenido}</Paragraph>
            </Timeline.Item>
          ))}
          {(!comentarios || comentarios.length === 0) && (
            <Text type="secondary">Sin comentarios</Text>
          )}
        </Timeline>

        <div style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Select
                value={comentarioTipo}
                onChange={(v) => setComentarioTipo(v)}
                style={{ width: 180 }}
              >
                <Select.Option value="interno">Nota Interna</Select.Option>
                <Select.Option value="publico">Comentario Público</Select.Option>
                <Select.Option value="comunicacion">Comunicación / Pregunta</Select.Option>
              </Select>
              <Text type="secondary">
                {comentarioTipo === 'interno' && 'Solo visible para el equipo técnico'}
                {comentarioTipo === 'publico' && 'Visible en la página de consulta pública'}
                {comentarioTipo === 'comunicacion' && 'Se enviará por correo al solicitante con enlace para responder'}
              </Text>
            </Space>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  comentarioTipo === 'interno' ? 'Agregar nota interna...' :
                  comentarioTipo === 'publico' ? 'Agregar comentario público...' :
                  'Escribir pregunta o comunicación para el solicitante...'
                }
                rows={2}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleAddComment}>
                {comentarioTipo === 'comunicacion' ? 'Enviar Correo' : 'Enviar'}
              </Button>
            </Space.Compact>
          </Space>
        </div>
      </Card>

      {/* Transfer to TI Modal */}
      <Modal
        title="Transferir a TI"
        open={transferModalVisible}
        onOk={handleTransferTI}
        onCancel={() => setTransferModalVisible(false)}
        okText="Transferir"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
      >
        <Alert
          message="Transferencia de Solicitud"
          description="Esta solicitud será transferida al departamento de TI y se creará un nuevo ticket de soporte. La solicitud actual quedará cerrada con estado 'Transferido'."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          value={transferMotivo}
          onChange={(e) => setTransferMotivo(e.target.value)}
          placeholder="Motivo de la transferencia y contexto relevante..."
          rows={4}
        />
      </Modal>
    </div>
  )
}

export default NTSolicitudDetail
