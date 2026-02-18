import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Timeline, Input, message, Modal, Collapse, List, Row, Col, Alert
} from 'antd'
import {
  ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  UserOutlined, TeamOutlined, AlertOutlined, ClockCircleOutlined,
  ToolOutlined, TrophyOutlined, LineChartOutlined, PaperClipOutlined,
  FileTextOutlined, SwapOutlined, StopOutlined, PlayCircleOutlined,
  ExclamationCircleOutlined, EditOutlined, FilePdfOutlined
} from '@ant-design/icons'
import { solicitudesApi, transferenciasApi, exportApi } from '../../services/api'
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

// Helper to determine if tipo uses simple workflow
const isSimpleTipo = (tipo) => ['reporte_fallo', 'cierre_servicio', 'transferido_ti'].includes(tipo)

// Only reporte_fallo can be transferred to TI (cierre_servicio cannot)
const canTransferToTI = (tipo) => tipo === 'reporte_fallo'

function NTSolicitudDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [transferModalVisible, setTransferModalVisible] = useState(false)
  const [transferMotivo, setTransferMotivo] = useState('')
  const [transferInfo, setTransferInfo] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    loadSolicitud()
  }, [id])

  useEffect(() => {
    if (data?.solicitud?.estado === 'transferido_ti') {
      loadTransferInfo()
    }
  }, [data?.solicitud?.estado])

  const loadTransferInfo = async () => {
    try {
      const response = await transferenciasApi.get('solicitud', id)
      if (response.data.transferencias_como_origen?.length > 0) {
        setTransferInfo(response.data.transferencias_como_origen[0])
      }
    } catch (error) {
      console.error('Error loading transfer info:', error)
    }
  }

  const loadSolicitud = async () => {
    try {
      const response = await solicitudesApi.get(id)
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
      const response = await exportApi.solicitudPdf(id)
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
      await solicitudesApi.updateEstado(id, { estado: nuevoEstado, comentario })
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
      await solicitudesApi.addComment(id, { contenido: comment })
      setComment('')
      message.success('Comentario agregado')
      loadSolicitud()
    } catch (error) {
      message.error('Error al agregar comentario')
    }
  }

  const handleTransferTI = async () => {
    if (!transferMotivo.trim()) {
      message.error('Debe ingresar un motivo para la transferencia')
      return
    }
    setActionLoading(true)
    try {
      const response = await solicitudesApi.transferirTI(id, { motivo: transferMotivo })
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
          await solicitudesApi.updateEstado(id, { estado: 'completado', comentario: 'Solicitud completada' })
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
      await solicitudesApi.updateEstado(id, { estado: 'en_estudio', comentario: 'Iniciando análisis de la solicitud' })
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

  const { solicitud, comentarios } = data

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
  const renderIdentificacion = () => (
    <Card
      title={<><UserOutlined /> Identificación del Solicitante</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Nombre Completo">
          {identificacion.nombre_completo || identificacion.nombre || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Cargo">
          {identificacion.cargo || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Área">
          {identificacion.area || identificacion.departamento || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Operación/Contrato">
          {identificacion.operacion_contrato || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Correo">
          {identificacion.correo || identificacion.email || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Teléfono">
          {identificacion.telefono || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Cédula">
          {identificacion.cedula || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="¿Es Doliente?">
          {identificacion.es_doliente === true ? 'Sí' :
           identificacion.es_doliente === false ? 'No' : '-'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Sponsor Section (for proyecto/actualizacion when es_doliente = false)
  const renderSponsor = () => {
    if (!sponsor || Object.keys(sponsor).length === 0) return null
    if (!sponsor.nombre_completo) return null

    return (
      <Card
        title={<><UserOutlined /> Sponsor / Doliente</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Nombre Completo">
            {sponsor.nombre_completo || sponsor.nombre || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Cargo">
            {sponsor.cargo || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Área">
            {sponsor.area || sponsor.departamento || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Correo">
            {sponsor.correo || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    )
  }

  // Render Stakeholders (for proyecto/actualizacion)
  const renderStakeholders = () => {
    const internas = stakeholders.internas || {}
    const externas = stakeholders.externas || {}

    if (Object.keys(stakeholders).length === 0) return null

    return (
      <Card
        title={<><TeamOutlined /> Partes Interesadas</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {internas.areas?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>Áreas Interesadas:</Text>
            <div>{internas.areas.map((a, i) => <Tag key={i}>{a}</Tag>)}</div>
          </div>
        )}
        {internas.personas?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>Personas Clave Internas:</Text>
            <div>{internas.personas.map((p, i) => <Tag key={i}>{p}</Tag>)}</div>
          </div>
        )}
        {stakeholders.aplica_externas && (
          <>
            {externas.sectores?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Text strong>Sectores Comerciales:</Text>
                <div>{externas.sectores.map((s, i) => <Tag key={i}>{s}</Tag>)}</div>
              </div>
            )}
            {externas.empresas?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Text strong>Empresas:</Text>
                <div>{externas.empresas.map((e, i) => <Tag key={i}>{e}</Tag>)}</div>
              </div>
            )}
            {externas.proveedores?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Text strong>Proveedores:</Text>
                <div>{externas.proveedores.map((p, i) => <Tag key={i}>{p}</Tag>)}</div>
              </div>
            )}
            {externas.personas?.length > 0 && (
              <div>
                <Text strong>Personas Clave Externas:</Text>
                <div>{externas.personas.map((p, i) => <Tag key={i}>{p}</Tag>)}</div>
              </div>
            )}
          </>
        )}
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
        <Descriptions.Item label="Situación Actual">
          {problematica.situacion_actual || problematica.problema_actual || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Origen del Problema">
          {problematica.origen || '-'}
        </Descriptions.Item>
        {problematica.desde_cuando && (
          <Descriptions.Item label="Desde Cuándo">
            {dayjs(problematica.desde_cuando).format('DD/MM/YYYY')}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Afectación a la Operación">
          {problematica.afectacion_operacion || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Procesos Comprometidos">
          {problematica.procesos_comprometidos || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Nivel de Impacto">
          <Tag color={
            problematica.impacto_nivel === 'critico' ? 'red' :
            problematica.impacto_nivel === 'alto' ? 'orange' :
            problematica.impacto_nivel === 'medio' ? 'cyan' : 'green'
          }>
            {problematica.impacto_nivel?.toUpperCase() || '-'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Descripción del Impacto">
          {problematica.impacto_descripcion || problematica.impacto || '-'}
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
          {urgencia.necesidad_principal || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Nivel de Urgencia">
          <Tag color={
            urgencia.nivel === 'inmediata' ? 'red' :
            urgencia.nivel === 'corto_plazo' ? 'orange' :
            urgencia.nivel === 'mediano_plazo' ? 'cyan' : 'green'
          }>
            {urgencia.nivel?.replace(/_/g, ' ').toUpperCase() || urgencia.nivel_urgencia || '-'}
          </Tag>
        </Descriptions.Item>
        {urgencia.fecha_limite && (
          <Descriptions.Item label="Fecha Límite">
            {dayjs(urgencia.fecha_limite).format('DD/MM/YYYY')}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="¿Por qué NT?">
          {urgencia.justificacion_nt || urgencia.justificacion || '-'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Solución (for proyecto/actualizacion)
  const renderSolucion = () => {
    if (Object.keys(solucion).length === 0) return null

    return (
      <Card
        title={<><ToolOutlined /> Propuesta de Solución</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          {solucion.tipo_solucion && (
            <Descriptions.Item label="Tipo de Solución">
              {solucion.tipo_solucion}
              {solucion.tipo_solucion_otro && ` - ${solucion.tipo_solucion_otro}`}
            </Descriptions.Item>
          )}
          {solucion.solucion_ideal && (
            <Descriptions.Item label="Solución Ideal">
              {solucion.solucion_ideal}
            </Descriptions.Item>
          )}
          {solucion.casos_uso && (
            <Descriptions.Item label="Casos de Uso">
              {solucion.casos_uso}
            </Descriptions.Item>
          )}
          {solucion.funcionalidades_minimas?.length > 0 && (
            <Descriptions.Item label="Funcionalidades Mínimas">
              <List
                size="small"
                dataSource={solucion.funcionalidades_minimas}
                renderItem={item => <List.Item>• {item}</List.Item>}
              />
            </Descriptions.Item>
          )}
          {solucion.funcionalidades_deseables?.length > 0 && (
            <Descriptions.Item label="Funcionalidades Deseables">
              <List
                size="small"
                dataSource={solucion.funcionalidades_deseables}
                renderItem={item => <List.Item>• {item}</List.Item>}
              />
            </Descriptions.Item>
          )}
          {solucion.forma_entrega && (
            <Descriptions.Item label="Forma de Entrega">
              {solucion.forma_entrega}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    )
  }

  // Render Beneficios (for proyecto/actualizacion)
  const renderBeneficios = () => {
    if (Object.keys(beneficios).length === 0) return null

    return (
      <Card
        title={<><TrophyOutlined /> Beneficios Esperados</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Descripción">
            {beneficios.descripcion || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Mejora Concreta">
            {beneficios.mejora_concreta || '-'}
          </Descriptions.Item>
          {beneficios.procesos_optimizados?.length > 0 && (
            <Descriptions.Item label="Procesos a Optimizar">
              {beneficios.procesos_optimizados.map((p, i) => <Tag key={i}>{p}</Tag>)}
            </Descriptions.Item>
          )}
          {beneficios.reduccion_costos && (
            <Descriptions.Item label="Reducción de Costos">
              {beneficios.reduccion_costos_descripcion || 'Sí'}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    )
  }

  // Render KPIs/Desempeño (for proyecto/actualizacion)
  const renderDesempeno = () => {
    if (kpis.length === 0) return null

    return (
      <Card
        title={<><LineChartOutlined /> Control de Desempeño</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <List
          size="small"
          dataSource={kpis}
          renderItem={(kpi, index) => (
            <List.Item>
              <Descriptions size="small" column={{ xs: 1, sm: 4 }}>
                <Descriptions.Item label="Indicador">{kpi.nombre}</Descriptions.Item>
                <Descriptions.Item label="Valor Actual">{kpi.valor_actual || '-'}</Descriptions.Item>
                <Descriptions.Item label="Objetivo">{kpi.valor_objetivo || '-'}</Descriptions.Item>
                <Descriptions.Item label="Unidad">{kpi.unidad || '-'}</Descriptions.Item>
              </Descriptions>
            </List.Item>
          )}
        />
      </Card>
    )
  }

  // Render Reporte (for reporte_fallo)
  const renderReporte = () => (
    <Card
      title={<><AlertOutlined /> Descripción del Fallo</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {reporte.descripcion || reporte.situacion_actual || reporte.problema_actual || '-'}
      </Paragraph>
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
        <Descriptions.Item label="Nivel de Urgencia">
          <Tag color={
            criticidad.urgencia === 'critica' ? 'red' :
            criticidad.urgencia === 'alta' ? 'orange' :
            criticidad.urgencia === 'media' ? 'cyan' : 'green'
          }>
            {(criticidad.urgencia || criticidad.nivel || '-').toUpperCase()}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Justificación">
          {criticidad.justificacion || criticidad.justificacion_nt || '-'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // Render Razonamiento (for cierre_servicio)
  const renderRazonamiento = () => (
    <Card
      title={<><FileTextOutlined /> Razonamiento del Cierre</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {razonamiento.descripcion || razonamiento.situacion_actual || '-'}
      </Paragraph>
    </Card>
  )

  // Render Responsables (for cierre_servicio)
  const renderResponsables = () => (
    <Card
      title={<><TeamOutlined /> Responsables</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Responsable del Cierre">
          {responsables.responsable_nombre || '-'} - {responsables.responsable_cargo || '-'}
        </Descriptions.Item>
        {responsables.veedores?.length > 0 && (
          <Descriptions.Item label="Veedores">
            <List
              size="small"
              dataSource={responsables.veedores}
              renderItem={v => <List.Item>{v.nombre} - {v.cargo}</List.Item>}
            />
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  )

  // Render form data based on tipo
  const renderFormData = () => {
    const tipo = solicitud.tipo

    if (tipo === 'reporte_fallo') {
      return (
        <>
          {renderIdentificacion()}
          {renderReporte()}
          {renderCriticidad()}
        </>
      )
    }

    if (tipo === 'cierre_servicio') {
      return (
        <>
          {renderIdentificacion()}
          {renderRazonamiento()}
          {renderResponsables()}
        </>
      )
    }

    // proyecto_nuevo_interno or actualizacion
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
            <Title level={3} style={{ marginBottom: 8 }}>{solicitud.titulo}</Title>
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
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/nt/solicitudes/${id}/evaluacion`)}
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
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={actionLoading}
                onClick={handleEnEstudio}
              >
                Volver a Estudio
              </Button>
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
                  <Link to={`/ti/tickets/${transferInfo.destino_id}`}>Ver ticket</Link>
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

        {renderFormData()}

        <Divider orientation="left">Comentarios</Divider>
        <Timeline>
          {comentarios?.slice().sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)).map(c => (
            <Timeline.Item key={c.id} color={c.tipo === 'cambio_estado' ? 'purple' : 'gray'}>
              <Text strong>{c.autor_nombre}</Text>
              {c.tipo === 'cambio_estado' && <Tag color="purple" style={{ marginLeft: 8 }}>Sistema</Tag>}
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
              </Text>
              <Paragraph style={{ marginTop: 4 }}>{c.contenido}</Paragraph>
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
          <Button type="primary" icon={<SendOutlined />} onClick={handleAddComment}>Enviar</Button>
        </Space.Compact>
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
