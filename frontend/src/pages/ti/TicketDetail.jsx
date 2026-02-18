import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Typography, Spin, Divider,
  Timeline, Input, message, Modal, Select, Row, Col, Alert, Result
} from 'antd'
import {
  ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleOutlined, UserSwitchOutlined, PlayCircleOutlined,
  SwapOutlined, StopOutlined, FilePdfOutlined
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
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tiUsers, setTiUsers] = useState([])
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
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

  useEffect(() => {
    loadTicket()
    loadTiUsers()
  }, [id])

  useEffect(() => {
    if (data?.ticket?.estado === 'transferido_nt') {
      loadTransferInfo()
    }
  }, [data?.ticket?.estado])

  const loadTransferInfo = async () => {
    try {
      const response = await transferenciasApi.get('ticket', id)
      if (response.data.transferencias_como_origen?.length > 0) {
        setTransferInfo(response.data.transferencias_como_origen[0])
      }
    } catch (error) {
      console.error('Error loading transfer info:', error)
    }
  }

  const loadTicket = async () => {
    try {
      const response = await ticketsApi.get(id)
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
      await ticketsApi.updateEstado(id, { estado: nuevoEstado, ...extra })
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
      await ticketsApi.addComment(id, { contenido: comment, interno: isInternal })
      setComment('')
      message.success('Comentario agregado')
      loadTicket()
    } catch (error) {
      message.error('Error al agregar comentario')
    }
  }

  const handleEscalar = async () => {
    if (!escalarMotivo.trim()) {
      message.error('Debe ingresar un motivo para escalar')
      return
    }
    setActionLoading(true)
    try {
      await ticketsApi.escalar(id, { motivo: escalarMotivo })
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
      await ticketsApi.updateEstado(id, { estado: 'resuelto', resolucion })
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
      const response = await ticketsApi.transferirNT(id, { motivo: transferMotivo })
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
          await ticketsApi.updateEstado(id, { estado: 'solucionado' })
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
          await ticketsApi.updateEstado(id, { estado: 'no_realizado' })
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
      const response = await exportApi.ticketPdf(id)
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

  const { ticket, comentarios, archivos } = data
  const solicitante = ticket.datos_solicitante || {}

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
            <Title level={3} style={{ marginBottom: 8 }}>{ticket.titulo}</Title>
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
                  <Link to={`/nt/solicitudes/${transferInfo.destino_id}`}>Ver solicitud</Link>
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

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Categoría">
                <Tag>{categoriaLabels[ticket.categoria]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Prioridad">
                <Tag color={prioridadColors[ticket.prioridad]}>{ticket.prioridad?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Creado">
                {dayjs(ticket.creado_en).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Actualizado">
                {dayjs(ticket.actualizado_en).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Asignado a" span={2}>
                {ticket.asignado_nombre || <Text type="secondary">Sin asignar</Text>}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Descripción</Divider>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{ticket.descripcion}</Paragraph>

            {ticket.resolucion && (
              <>
                <Divider orientation="left">Resolución</Divider>
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
              </>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <Card size="small" title="Datos del Solicitante">
              <p><strong>Nombre:</strong> {solicitante.nombre_completo || solicitante.nombre || 'N/A'}</p>
              <p><strong>Cédula:</strong> {solicitante.cedula || 'N/A'}</p>
              <p><strong>Correo:</strong> {solicitante.correo || solicitante.email || 'N/A'}</p>
              <p><strong>Teléfono:</strong> {solicitante.telefono || 'N/A'}</p>
              <p><strong>Cargo:</strong> {solicitante.cargo || 'N/A'}</p>
              <p><strong>Área:</strong> {solicitante.area || solicitante.departamento || 'N/A'}</p>
              <p><strong>Operación/Contrato:</strong> {solicitante.operacion_contrato || 'N/A'}</p>
              <p>
                <strong>Es el afectado:</strong>{' '}
                {solicitante.es_doliente === true ? (
                  <Tag color="blue">Sí, es el doliente</Tag>
                ) : solicitante.es_doliente === false ? (
                  <Tag>No, reporta por otro</Tag>
                ) : (
                  'N/A'
                )}
              </p>
            </Card>

            {solicitante.criticidad && (
              <Card size="small" title="Criticidad Reportada" style={{ marginTop: 16 }}>
                <p>
                  <strong>Urgencia:</strong>{' '}
                  <Tag color={
                    solicitante.criticidad.urgencia === 'critica' ? 'red' :
                    solicitante.criticidad.urgencia === 'alta' ? 'orange' :
                    solicitante.criticidad.urgencia === 'media' ? 'cyan' : 'green'
                  }>
                    {solicitante.criticidad.urgencia?.toUpperCase()}
                  </Tag>
                </p>
                {solicitante.criticidad.justificacion && (
                  <>
                    <p style={{ marginBottom: 4 }}><strong>Justificación:</strong></p>
                    <Paragraph style={{ margin: 0, paddingLeft: 8, whiteSpace: 'pre-wrap' }}>
                      {solicitante.criticidad.justificacion}
                    </Paragraph>
                  </>
                )}
              </Card>
            )}

            {archivos?.length > 0 && (
              <Card size="small" title="Archivos Adjuntos" style={{ marginTop: 16 }}>
                {archivos.map(a => (
                  <div key={a.id}>
                    <a href={`/uploads/${a.nombre_almacenado}`} target="_blank" rel="noopener noreferrer">
                      {a.nombre_original}
                    </a>
                  </div>
                ))}
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
                color={c.tipo === 'cambio_estado' ? 'purple' : c.interno ? 'orange' : 'gray'}
              >
                <div>
                  <Text strong>{c.autor_nombre}</Text>
                  {c.interno && <Tag color="orange" style={{ marginLeft: 8 }}>Interno</Tag>}
                  {c.tipo === 'cambio_estado' && <Tag color="purple" style={{ marginLeft: 8 }}>Sistema</Tag>}
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {dayjs(c.creado_en).format('DD/MM/YYYY HH:mm')}
                  </Text>
                </div>
                <Paragraph style={{ marginTop: 4 }}>{c.contenido}</Paragraph>
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
                value={isInternal ? 'interno' : 'publico'}
                onChange={(v) => setIsInternal(v === 'interno')}
                style={{ width: 150 }}
              >
                <Select.Option value="publico">Comentario</Select.Option>
                <Select.Option value="interno">Nota Interna</Select.Option>
              </Select>
              {isInternal && (
                <Text type="secondary">Las notas internas no son visibles para el solicitante</Text>
              )}
            </Space>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isInternal ? 'Agregar nota interna...' : 'Agregar comentario...'}
                rows={2}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleAddComment}>
                Enviar
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
