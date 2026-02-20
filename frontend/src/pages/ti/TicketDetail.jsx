import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Timeline, Input, message, Modal, Select, Row, Col, Alert, Result
} from 'antd'
import {
  ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleOutlined, UserSwitchOutlined, PlayCircleOutlined,
  SwapOutlined, StopOutlined, FilePdfOutlined, DownloadOutlined, FileOutlined
} from '@ant-design/icons'
import { ticketsApi, usuariosApi, transferenciasApi, exportApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const estadoColors = {
  abierto: 'warning',
  en_proceso: 'processing',
  resuelto: 'success',
  solucionado: 'success',
  cerrado: 'default',
  escalado_nt: 'error',
  transferido_nt: 'purple',
  no_realizado: 'volcano'
}

const estadoLabels = {
  abierto: 'Abierto',
  en_proceso: 'En Proceso',
  resuelto: 'Resuelto',
  solucionado: 'Solucionado',
  cerrado: 'Cerrado',
  escalado_nt: 'Escalado a NT',
  transferido_nt: 'Transferido a NT',
  no_realizado: 'No Realizado'
}

const categoriaLabels = {
  hardware: 'Hardware',
  software: 'Software',
  red: 'Red',
  acceso: 'Acceso',
  soporte_general: 'Soporte General',
  otro: 'Otro'
}

const prioridadColors = {
  baja: 'green',
  media: 'cyan',
  alta: 'orange',
  critica: 'red'
}

function TITicketDetail() {
  const { codigo } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tiUsers, setTiUsers] = useState([])
  const [comment, setComment] = useState('')
  const [comentarioTipo, setComentarioTipo] = useState('interno')
  const [actionLoading, setActionLoading] = useState(false)
  const [escalarModalVisible, setEscalarModalVisible] = useState(false)
  const [resolverModalVisible, setResolverModalVisible] = useState(false)
  const [transferModalVisible, setTransferModalVisible] = useState(false)
  const [escalarMotivo, setEscalarMotivo] = useState('')
  const [resolucion, setResolucion] = useState('')
  const [transferMotivo, setTransferMotivo] = useState('')
  const [transferInfo, setTransferInfo] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const navigate = useNavigate()

  // Category selector state for tickets transferred from NT
  const [selectedCategoria, setSelectedCategoria] = useState(null)
  const [savingCategoria, setSavingCategoria] = useState(false)

  useEffect(() => {
    loadTicket()
    loadTiUsers()
  }, [codigo])

  useEffect(() => {
    if (data?.ticket?.estado === 'transferido_nt') {
      loadTransferInfo()
    }
  }, [data?.ticket?.estado])

  // Set initial categoria value for tickets transferred from NT
  useEffect(() => {
    if (data?.transfer_origen && data?.ticket?.categoria) {
      setSelectedCategoria(data.ticket.categoria)
    }
  }, [data?.transfer_origen, data?.ticket?.categoria])

  const handleSaveCategoria = async () => {
    if (!selectedCategoria) {
      message.warning('Seleccione una categoría')
      return
    }

    setSavingCategoria(true)
    try {
      await ticketsApi.updateCategoria(codigo, { categoria: selectedCategoria })
      message.success('Categoría actualizada')
      loadTicket()
    } catch (error) {
      message.error(error.message || 'Error al actualizar categoría')
    } finally {
      setSavingCategoria(false)
    }
  }

  const loadTransferInfo = async () => {
    try {
      const response = await transferenciasApi.get('ticket', codigo)
      if (response.data.transferencias_como_origen?.length > 0) {
        setTransferInfo(response.data.transferencias_como_origen[0])
      }
    } catch (error) {
      console.error('Error loading transfer info:', error)
    }
  }

  const loadTicket = async () => {
    try {
      const response = await ticketsApi.get(codigo)
      setData(response.data)
    } catch (error) {
      console.error('Error loading ticket:', error)
      message.error('Error al cargar el ticket')
    } finally {
      setLoading(false)
    }
  }

  const loadTiUsers = async () => {
    try {
      const response = await usuariosApi.getByRole('ti')
      setTiUsers(response.data.usuarios || [])
    } catch (error) {
      console.error('Error loading TI users:', error)
    }
  }

  const handleChangeEstado = async (nuevoEstado, extra = {}) => {
    setActionLoading(true)
    try {
      await ticketsApi.updateEstado(codigo, { estado: nuevoEstado, ...extra })
      message.success('Estado actualizado')
      loadTicket()
    } catch (error) {
      message.error(error.message || 'Error al actualizar estado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    try {
      await ticketsApi.addComment(codigo, { contenido: comment, tipo: comentarioTipo })
      setComment('')
      if (comentarioTipo === 'comunicacion') {
        message.success('Comunicación enviada al solicitante por correo')
      } else {
        message.success('Comentario agregado')
      }
      loadTicket()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al agregar comentario')
    }
  }

  const handleEscalar = async () => {
    if (!escalarMotivo.trim()) {
      message.error('Debe ingresar un motivo para escalar')
      return
    }
    setActionLoading(true)
    try {
      await ticketsApi.escalar(codigo, { motivo: escalarMotivo })
      message.success('Ticket escalado a Nuevas Tecnologías')
      setEscalarModalVisible(false)
      setEscalarMotivo('')
      loadTicket()
    } catch (error) {
      message.error(error.message || 'Error al escalar ticket')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolver = async () => {
    if (!resolucion.trim()) {
      message.error('Debe ingresar la resolución')
      return
    }
    setActionLoading(true)
    try {
      await ticketsApi.updateEstado(codigo, { estado: 'resuelto', resolucion })
      message.success('Ticket resuelto')
      setResolverModalVisible(false)
      setResolucion('')
      loadTicket()
    } catch (error) {
      message.error(error.message || 'Error al resolver ticket')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTransferNT = async () => {
    if (!transferMotivo.trim()) {
      message.error('Debe ingresar un motivo para la transferencia')
      return
    }
    setActionLoading(true)
    try {
      const response = await ticketsApi.transferirNT(codigo, { motivo: transferMotivo })
      message.success(`Ticket transferido a Nuevas Tecnologías. Nueva solicitud: ${response.data.solicitud.codigo}`)
      setTransferModalVisible(false)
      setTransferMotivo('')
      loadTicket()
    } catch (error) {
      message.error(error.message || 'Error al transferir ticket')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSolucionado = async () => {
    Modal.confirm({
      title: 'Marcar como Solucionado',
      content: '¿Está seguro que desea marcar este ticket como solucionado?',
      okText: 'Sí, Solucionado',
      cancelText: 'Cancelar',
      onOk: async () => {
        setActionLoading(true)
        try {
          await ticketsApi.updateEstado(codigo, { estado: 'solucionado' })
          message.success('Ticket marcado como solucionado')
          loadTicket()
        } catch (error) {
          message.error(error.message || 'Error al actualizar estado')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const handleNoRealizado = async () => {
    Modal.confirm({
      title: 'Marcar como No Realizado',
      icon: <ExclamationCircleOutlined />,
      content: '¿Está seguro que desea marcar este ticket como no realizado? Esta acción es definitiva.',
      okText: 'Sí, No Realizado',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        setActionLoading(true)
        try {
          await ticketsApi.updateEstado(codigo, { estado: 'no_realizado' })
          message.success('Ticket marcado como no realizado')
          loadTicket()
        } catch (error) {
          message.error(error.message || 'Error al actualizar estado')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const response = await exportApi.ticketPdf(codigo)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${ticket?.codigo || 'ticket'}.pdf`)
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!data?.ticket) {
    return <Card><Title level={4}>Ticket no encontrado</Title></Card>
  }

  const { ticket, comentarios, archivos, archivos_agrupados, transfer_origen } = data
  const solicitante = ticket.datos_solicitante || {}

  // Check if this ticket was transferred from NT
  const isTransferredFromNT = !!transfer_origen

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/ti/tickets">
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
            <Title level={3} style={{ marginBottom: 8 }}>{ticket.titulo?.replace(/^\[Transferido de [^\]]+\]\s*/, '')}</Title>
            <Space>
              <Text type="secondary">{ticket.codigo}</Text>
              <Tag color={estadoColors[ticket.estado]}>{estadoLabels[ticket.estado]}</Tag>
              <Tag color={prioridadColors[ticket.prioridad]}>{ticket.prioridad?.toUpperCase()}</Tag>
            </Space>
          </div>
          <Space>
            {ticket.estado === 'abierto' && (
              <>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => handleChangeEstado('en_proceso')}
                >
                  Tomar Ticket
                </Button>
                <Button
                  icon={<SwapOutlined />}
                  loading={actionLoading}
                  onClick={() => setTransferModalVisible(true)}
                >
                  Transferir a NT
                </Button>
              </>
            )}
            {ticket.estado === 'en_proceso' && (
              <>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={actionLoading}
                  onClick={handleSolucionado}
                >
                  Solucionado
                </Button>
                <Button
                  icon={<ArrowLeftOutlined />}
                  loading={actionLoading}
                  onClick={() => handleChangeEstado('abierto')}
                >
                  Devolver
                </Button>
                <Button
                  icon={<SwapOutlined />}
                  loading={actionLoading}
                  onClick={() => setTransferModalVisible(true)}
                >
                  Transferir a NT
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={actionLoading}
                  onClick={handleNoRealizado}
                >
                  No Realizado
                </Button>
              </>
            )}
            {ticket.estado === 'resuelto' && (
              <>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={actionLoading}
                  onClick={() => handleChangeEstado('cerrado')}
                >
                  Cerrar Ticket
                </Button>
                <Button
                  icon={<ArrowLeftOutlined />}
                  loading={actionLoading}
                  onClick={() => handleChangeEstado('abierto')}
                >
                  Reabrir
                </Button>
              </>
            )}
          </Space>
        </div>

        {ticket.estado === 'escalado_nt' && (
          <Alert
            message="Ticket Escalado"
            description="Este ticket ha sido escalado al departamento de Nuevas Tecnologías para su atención."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {ticket.estado === 'transferido_nt' && (
          <Alert
            message="Ticket Transferido a Nuevas Tecnologías"
            description={
              transferInfo ? (
                <span>
                  Este ticket fue transferido y se creó una nueva solicitud con código{' '}
                  <strong>{transferInfo.destino_codigo}</strong>.{' '}
                  <Link to={`/nt/solicitudes/${transferInfo.destino_codigo}`}>Ver solicitud</Link>
                </span>
              ) : (
                'Este ticket fue transferido al departamento de Nuevas Tecnologías.'
              )
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {ticket.estado === 'solucionado' && (
          <Alert
            message="Ticket Solucionado"
            description="Este ticket ha sido resuelto satisfactoriamente."
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {ticket.estado === 'no_realizado' && (
          <Alert
            message="Ticket No Realizado"
            description="Este ticket no pudo ser completado."
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {isTransferredFromNT && (
          <Alert
            message="Ticket Transferido desde NT"
            description={
              <span>
                Este ticket fue creado a partir de una transferencia de la solicitud{' '}
                <strong>{transfer_origen.origen_codigo}</strong>.{' '}
                <Link to={`/nt/solicitudes/${transfer_origen.origen_codigo}`}>Ver solicitud original</Link>
              </span>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Categoría">
                {isTransferredFromNT ? (
                  <Space>
                    <Select
                      value={selectedCategoria}
                      onChange={(v) => setSelectedCategoria(v)}
                      style={{ width: 180 }}
                      placeholder="Seleccionar categoría"
                    >
                      <Select.Option value="hardware">Hardware</Select.Option>
                      <Select.Option value="software">Software</Select.Option>
                      <Select.Option value="red">Red</Select.Option>
                      <Select.Option value="acceso">Acceso</Select.Option>
                      <Select.Option value="soporte_general">Soporte General</Select.Option>
                    </Select>
                    <Button
                      type="primary"
                      size="small"
                      loading={savingCategoria}
                      onClick={handleSaveCategoria}
                      disabled={!selectedCategoria || selectedCategoria === ticket.categoria}
                    >
                      Guardar
                    </Button>
                  </Space>
                ) : (
                  ticket.categoria ? <Tag>{categoriaLabels[ticket.categoria] || ticket.categoria}</Tag> : '--'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Prioridad">
                <Tag color={prioridadColors[ticket.prioridad]}>{ticket.prioridad?.toUpperCase() || '--'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Creado">
                {ticket.creado_en ? dayjs(ticket.creado_en).format('DD/MM/YYYY HH:mm') : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Actualizado">
                {ticket.actualizado_en ? dayjs(ticket.actualizado_en).format('DD/MM/YYYY HH:mm') : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Asignado a" span={2}>
                {ticket.asignado_nombre || '--'}
              </Descriptions.Item>
            </Descriptions>

            {/* Reporte Section */}
            <Card size="small" title="Reporte de la Situación" style={{ marginTop: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Título">
                  {ticket.titulo?.replace(/^\[Transferido de [^\]]+\]\s*/, '') || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Descripción">
                  <span style={{ whiteSpace: 'pre-wrap' }}>{ticket.descripcion || '--'}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {ticket.resolucion && (
              <Card size="small" title="Resolución" style={{ marginTop: 16 }}>
                <Alert
                  message="Resolución del Ticket"
                  description={ticket.resolucion}
                  type="success"
                  showIcon
                />
                {ticket.fecha_resolucion && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    Resuelto el {dayjs(ticket.fecha_resolucion).format('DD/MM/YYYY HH:mm')}
                  </Text>
                )}
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <Card size="small" title="Identificación del Solicitante">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Nombre Completo">
                  {solicitante.nombre_completo || solicitante.nombre || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Cargo">
                  {solicitante.cargo || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Área">
                  {solicitante.area || solicitante.departamento || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Operación/Contrato">
                  {solicitante.operacion_contrato || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Correo">
                  {solicitante.correo || solicitante.email || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Teléfono">
                  {solicitante.telefono || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Cédula">
                  {solicitante.cedula || '--'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Criticidad - Always show this section for IT tickets */}
            <Card size="small" title="Criticidad" style={{ marginTop: 16 }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Urgencia">
                  {(ticket.criticidad?.urgencia || solicitante.criticidad?.urgencia) ? (
                    <Tag color={
                      (ticket.criticidad?.urgencia || solicitante.criticidad?.urgencia) === 'critica' ? 'red' :
                      (ticket.criticidad?.urgencia || solicitante.criticidad?.urgencia) === 'alta' ? 'orange' :
                      (ticket.criticidad?.urgencia || solicitante.criticidad?.urgencia) === 'media' ? 'cyan' : 'green'
                    }>
                      {(ticket.criticidad?.urgencia || solicitante.criticidad?.urgencia).toUpperCase()}
                    </Tag>
                  ) : '--'}
                </Descriptions.Item>
                <Descriptions.Item label="Justificación">
                  {ticket.criticidad?.justificacion || solicitante.criticidad?.justificacion || '--'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Transfer Info - Show when ticket came from NT */}
            {isTransferredFromNT && transfer_origen && (
              <Card size="small" title="Información de Transferencia" style={{ marginTop: 16 }}>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Solicitud Origen">
                    <Link to={`/nt/solicitudes/${transfer_origen.origen_codigo}`}>
                      {transfer_origen.origen_codigo}
                    </Link>
                  </Descriptions.Item>
                  <Descriptions.Item label="Motivo">
                    <span style={{ whiteSpace: 'pre-wrap' }}>{transfer_origen.motivo || '--'}</span>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {(archivos_agrupados?.length > 0 || archivos?.length > 0) && (
              <Card size="small" title="Archivos Adjuntos" style={{ marginTop: 16 }}>
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
            )}
          </Col>
        </Row>

        <Divider orientation="left">Comentarios e Historial</Divider>
        <Timeline>
          {comentarios
            ?.slice()
            .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
            .map(c => (
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

      {/* Escalar Modal */}
      <Modal
        title="Escalar a Nuevas Tecnologías"
        open={escalarModalVisible}
        onOk={handleEscalar}
        onCancel={() => setEscalarModalVisible(false)}
        okText="Escalar"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
      >
        <Alert
          message="Atención"
          description="Este ticket será transferido al departamento de Nuevas Tecnologías. Use esta opción cuando el problema requiera conocimientos técnicos avanzados o cambios en sistemas."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <TextArea
          value={escalarMotivo}
          onChange={(e) => setEscalarMotivo(e.target.value)}
          placeholder="Motivo de la escalación..."
          rows={4}
        />
      </Modal>

      {/* Resolver Modal */}
      <Modal
        title="Resolver Ticket"
        open={resolverModalVisible}
        onOk={handleResolver}
        onCancel={() => setResolverModalVisible(false)}
        okText="Marcar como Resuelto"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
      >
        <Alert
          message="Documentar Resolución"
          description="Describa los pasos realizados para resolver el problema. Esta información será visible para el solicitante y servirá como referencia futura."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <TextArea
          value={resolucion}
          onChange={(e) => setResolucion(e.target.value)}
          placeholder="Descripción de la solución aplicada..."
          rows={6}
        />
      </Modal>

      {/* Transfer to NT Modal */}
      <Modal
        title="Transferir a Nuevas Tecnologías"
        open={transferModalVisible}
        onOk={handleTransferNT}
        onCancel={() => setTransferModalVisible(false)}
        okText="Transferir"
        cancelText="Cancelar"
        confirmLoading={actionLoading}
      >
        <Alert
          message="Transferencia de Ticket"
          description="Este ticket será transferido al departamento de Nuevas Tecnologías y se creará una nueva solicitud. El ticket actual quedará cerrado con estado 'Transferido'."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <TextArea
          value={transferMotivo}
          onChange={(e) => setTransferMotivo(e.target.value)}
          placeholder="Motivo de la transferencia y contexto relevante..."
          rows={4}
        />
      </Modal>
    </div>
  )
}

export default TITicketDetail
