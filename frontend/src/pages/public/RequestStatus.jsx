import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Card, Typography, Steps, Tag, Spin, Button, Input, Form, Descriptions, Alert, Progress, Space, Timeline, Divider } from 'antd'
import {
  SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  ToolOutlined, RocketOutlined, SwapOutlined, CalendarOutlined, ExclamationCircleOutlined,
  MessageOutlined, UserOutlined, TeamOutlined
} from '@ant-design/icons'
import { solicitudesApi, ticketsApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const prioridadColors = {
  'Baja': 'green',
  'Media': 'cyan',
  'Alta': 'orange',
  'Urgente': 'red',
  'baja': 'green',
  'media': 'cyan',
  'alta': 'orange',
  'critica': 'red'
}

function RequestStatus() {
  const { codigo } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [transferencia, setTransferencia] = useState(null)
  const [resultType, setResultType] = useState(null) // 'solicitud' or 'ticket'
  const [loading, setLoading] = useState(false)
  const [searchCode, setSearchCode] = useState(codigo || searchParams.get('codigo') || '')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const codeToSearch = codigo || searchParams.get('codigo')
    if (codeToSearch && codeToSearch !== 'buscar') {
      loadStatus(codeToSearch)
    }
  }, [codigo, searchParams])

  const loadStatus = async (code) => {
    setLoading(true)
    setNotFound(false)
    setResult(null)
    setTransferencia(null)

    try {
      // Try solicitud first
      if (code.toUpperCase().startsWith('SOL-')) {
        const response = await solicitudesApi.checkStatus(code)
        setResult({ ...response.data.solicitud, comentarios: response.data.comentarios })
        setTransferencia(response.data.transferencia)
        setResultType('solicitud')
        return
      }

      // Try ticket
      if (code.toUpperCase().startsWith('TKT-')) {
        const response = await ticketsApi.checkStatus(code)
        setResult({ ...response.data.ticket, comentarios: response.data.comentarios })
        setTransferencia(response.data.transferencia)
        setResultType('ticket')
        return
      }

      // Unknown prefix, try both
      try {
        const response = await solicitudesApi.checkStatus(code)
        setResult({ ...response.data.solicitud, comentarios: response.data.comentarios })
        setTransferencia(response.data.transferencia)
        setResultType('solicitud')
      } catch {
        const response = await ticketsApi.checkStatus(code)
        setResult({ ...response.data.ticket, comentarios: response.data.comentarios })
        setTransferencia(response.data.transferencia)
        setResultType('ticket')
      }
    } catch (error) {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchCode) {
      navigate(`/consulta/${searchCode.toUpperCase()}`)
      loadStatus(searchCode)
    }
  }

  // Get step status for milestones
  const getMilestoneStatus = (milestone) => {
    if (milestone.rejected) return 'error'
    if (milestone.transferred) return 'process'
    if (milestone.completed) return 'finish'
    if (milestone.current) return 'process'
    return 'wait'
  }

  // Render public comments/conversation
  const renderComentarios = () => {
    if (!result?.comentarios || result.comentarios.length === 0) return null

    return (
      <div style={{ marginTop: 24 }}>
        <Divider orientation="left">
          <MessageOutlined style={{ marginRight: 8 }} />
          Comunicaciones
        </Divider>
        <Timeline>
          {result.comentarios
            .slice()
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .map((c, index) => {
              const isUserResponse = c.es_respuesta
              return (
                <Timeline.Item
                  key={index}
                  color={isUserResponse ? 'green' : 'blue'}
                  dot={isUserResponse ? <UserOutlined /> : <TeamOutlined />}
                >
                  <div style={{ marginBottom: 4 }}>
                    <Text strong>{c.autor}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {dayjs(c.fecha).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </div>
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {c.contenido}
                  </Paragraph>
                </Timeline.Item>
              )
            })}
        </Timeline>
      </div>
    )
  }

  // Render progress with milestones
  const renderMilestones = () => {
    if (!result?.milestones) return null

    const currentStep = result.milestones.findIndex(m => m.current) ||
                       result.milestones.filter(m => m.completed).length

    return (
      <div style={{ marginBottom: 32 }}>
        <Steps
          current={currentStep}
          size="small"
          responsive={false}
          style={{ marginBottom: 16 }}
        >
          {result.milestones.map((milestone, index) => (
            <Steps.Step
              key={milestone.id}
              title={milestone.label}
              status={getMilestoneStatus(milestone)}
              icon={
                milestone.rejected ? <CloseCircleOutlined /> :
                milestone.transferred ? <SwapOutlined /> :
                milestone.completed ? <CheckCircleOutlined /> :
                milestone.current ? <ClockCircleOutlined /> : null
              }
            />
          ))}
        </Steps>
        <div style={{ textAlign: 'center' }}>
          <Progress
            percent={result.progress}
            status={result.es_terminal && !result.milestones.some(m => m.rejected) ? 'success' :
                   result.milestones.some(m => m.rejected) ? 'exception' : 'active'}
            strokeColor={result.milestones.some(m => m.rejected) ? '#ff4d4f' : undefined}
          />
        </div>
      </div>
    )
  }

  const renderSolicitudStatus = () => {
    return (
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <RocketOutlined style={{ fontSize: 48, color: '#D52B1E' }} />
          </div>
          <Title level={4} style={{ marginBottom: 8 }}>{result.titulo}</Title>
          <Text type="secondary">Código: {result.codigo}</Text>
          <div style={{ marginTop: 16 }}>
            <Tag color={
              result.es_terminal ? (result.milestones?.some(m => m.rejected) ? 'error' : 'success') :
              result.es_transferido ? 'purple' : 'processing'
            } style={{ fontSize: 16, padding: '4px 16px' }}>
              {result.estado}
            </Tag>
          </div>
        </div>

        {/* Transfer Alert */}
        {transferencia && (
          <Alert
            message={<><SwapOutlined style={{ marginRight: 8 }} /> Transferido</>}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>{transferencia.mensaje}</Paragraph>
                <Link to={`/consulta/${transferencia.nuevo_codigo}`}>
                  <Button type="link" style={{ padding: 0 }}>
                    Ver estado del nuevo código: {transferencia.nuevo_codigo}
                  </Button>
                </Link>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Milestones Progress */}
        {!transferencia && renderMilestones()}

        {/* Terminal state alerts */}
        {result.es_terminal && result.milestones?.some(m => m.rejected) && (
          <Alert
            message="Solicitud No Aprobada"
            description="Esta solicitud no fue aprobada. Si tiene preguntas, puede comunicarse con el departamento de Nuevas Tecnologías."
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Scheduled dates */}
        {result.fecha_inicio_programada && (
          <Alert
            message={<><CalendarOutlined style={{ marginRight: 8 }} /> Proyecto Programado</>}
            description={
              <Space direction="vertical">
                <Text>Fecha de inicio: {dayjs(result.fecha_inicio_programada).format('DD/MM/YYYY')}</Text>
                <Text>Fecha de fin estimada: {dayjs(result.fecha_fin_programada).format('DD/MM/YYYY')}</Text>
              </Space>
            }
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Tipo de Solicitud">
            <Tag>{result.tipo}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Prioridad">
            <Tag color={prioridadColors[result.prioridad]}>
              {result.prioridad?.toUpperCase?.() || result.prioridad}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Fecha de Creación">
            {dayjs(result.creado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="Última Actualización">
            {dayjs(result.actualizado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        {renderComentarios()}
      </Card>
    )
  }

  const renderTicketStatus = () => {
    return (
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <ToolOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </div>
          <Title level={4} style={{ marginBottom: 8 }}>{result.titulo}</Title>
          <Text type="secondary">Código: {result.codigo}</Text>
          <div style={{ marginTop: 16 }}>
            <Tag color={
              result.es_terminal ? (result.milestones?.some(m => m.rejected) ? 'error' : 'success') :
              result.es_transferido ? 'purple' : 'processing'
            } style={{ fontSize: 16, padding: '4px 16px' }}>
              {result.estado}
            </Tag>
          </div>
        </div>

        {/* Transfer Alert */}
        {transferencia && (
          <Alert
            message={<><SwapOutlined style={{ marginRight: 8 }} /> Transferido</>}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>{transferencia.mensaje}</Paragraph>
                <Link to={`/consulta/${transferencia.nuevo_codigo}`}>
                  <Button type="link" style={{ padding: 0 }}>
                    Ver estado del nuevo código: {transferencia.nuevo_codigo}
                  </Button>
                </Link>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Milestones Progress */}
        {!transferencia && renderMilestones()}

        {/* Terminal state alerts */}
        {result.es_terminal && result.milestones?.some(m => m.rejected) && (
          <Alert
            message="Ticket No Realizado"
            description="Este ticket no pudo ser completado. Si tiene preguntas, puede comunicarse con el departamento de TI."
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 24 }}
          />
        )}

        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Categoría">
            {result.categoria?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Descriptions.Item>
          <Descriptions.Item label="Prioridad">
            <Tag color={prioridadColors[result.prioridad]}>
              {result.prioridad?.toUpperCase?.() || result.prioridad}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Fecha de Creación">
            {dayjs(result.creado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="Última Actualización">
            {dayjs(result.actualizado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        {renderComentarios()}
      </Card>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
        Consultar Estado
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" style={{ justifyContent: 'center' }}>
          <Form.Item>
            <Input
              placeholder="Código (ej: SOL-2026-0001 o TKT-202602-0001)"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              onPressEnter={handleSearch}
              style={{ width: 320 }}
              size="large"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
              size="large"
            >
              Buscar
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary">
            Ingrese el código de su solicitud (SOL-...) o ticket (TKT-...)
          </Text>
        </div>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && result && resultType === 'solicitud' && renderSolicitudStatus()}
      {!loading && result && resultType === 'ticket' && renderTicketStatus()}

      {!loading && notFound && (
        <Card style={{ textAlign: 'center' }}>
          <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <Title level={4}>No encontrado</Title>
          <Paragraph type="secondary">
            No se encontró ninguna solicitud ni ticket con el código "{searchCode}"
          </Paragraph>
          <Paragraph type="secondary">
            Verifique que el código sea correcto e intente nuevamente.
          </Paragraph>
        </Card>
      )}
    </div>
  )
}

export default RequestStatus
