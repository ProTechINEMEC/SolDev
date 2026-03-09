import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Card, Typography, Steps, Tag, Spin, Button, Input, Form, Descriptions, Alert, Progress, Space, Timeline, Divider, Result } from 'antd'
import {
  SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  ToolOutlined, RocketOutlined, SwapOutlined, CalendarOutlined, ExclamationCircleOutlined,
  MessageOutlined, UserOutlined, TeamOutlined, ProjectOutlined, PauseCircleOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import { solicitudesApi, ticketsApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const INEMEC_RED = '#D52B1E'

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

const proyectoEstadoConfig = {
  'Programado': { color: 'blue', icon: <CalendarOutlined /> },
  'En Desarrollo': { color: 'processing', icon: <ProjectOutlined /> },
  'Pausado': { color: 'warning', icon: <PauseCircleOutlined /> },
  'Completado': { color: 'success', icon: <CheckCircleOutlined /> },
  'Cancelado': { color: 'error', icon: <CloseCircleOutlined /> }
}

function RequestStatus() {
  const { codigo } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [transferencia, setTransferencia] = useState(null)
  const [resultType, setResultType] = useState(null) // 'solicitud', 'ticket', or 'proyecto'
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
      // Try proyecto
      if (code.toUpperCase().startsWith('PRY-')) {
        const response = await solicitudesApi.checkProyectoStatus(code)
        setResult(response.data.proyecto)
        setResultType('proyecto')
        return
      }

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

      // Unknown prefix, try all
      try {
        const response = await solicitudesApi.checkStatus(code)
        setResult({ ...response.data.solicitud, comentarios: response.data.comentarios })
        setTransferencia(response.data.transferencia)
        setResultType('solicitud')
      } catch {
        try {
          const response = await ticketsApi.checkStatus(code)
          setResult({ ...response.data.ticket, comentarios: response.data.comentarios })
          setTransferencia(response.data.transferencia)
          setResultType('ticket')
        } catch {
          const response = await solicitudesApi.checkProyectoStatus(code)
          setResult(response.data.proyecto)
          setResultType('proyecto')
        }
      }
    } catch (error) {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchCode) {
      const code = searchCode.toUpperCase()
      navigate(`/consulta/${code}`)
      // Only call loadStatus directly if the URL didn't change (same code),
      // otherwise useEffect will handle it via the new codigo param
      if (code === codigo?.toUpperCase()) {
        loadStatus(code)
      }
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
  const renderComentarios = (comentarios) => {
    if (!comentarios || comentarios.length === 0) return null

    return (
      <div style={{ marginTop: 24 }}>
        <Divider orientation="left">
          <MessageOutlined style={{ marginRight: 8 }} />
          Comunicaciones
        </Divider>
        <Timeline>
          {comentarios
            .slice()
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .map((c, index) => {
              const isUserResponse = c.es_respuesta
              const isPending = ['comunicacion', 'agendar_reunion'].includes(c.tipo) && !isUserResponse
              const hasResponse = isPending && comentarios.some(
                (r, ri) => r.es_respuesta && ri > index
              )
              return (
                <Timeline.Item
                  key={index}
                  color={isUserResponse ? 'green' : c.tipo === 'agendar_reunion' ? 'purple' : 'blue'}
                  dot={isUserResponse ? <UserOutlined /> : <TeamOutlined />}
                >
                  <div style={{ marginBottom: 4 }}>
                    <Text strong>{c.autor}</Text>
                    {c.tipo === 'agendar_reunion' && !isUserResponse && (
                      <Tag color="purple" style={{ marginLeft: 8, fontSize: 11 }}>Reunión</Tag>
                    )}
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {dayjs(c.fecha).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </div>
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {c.contenido}
                  </Paragraph>
                  {c.adjuntos_count > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <PaperClipOutlined style={{ marginRight: 4 }} />
                      {c.adjuntos_count} archivo{c.adjuntos_count > 1 ? 's' : ''} adjunto{c.adjuntos_count > 1 ? 's' : ''}
                    </Text>
                  )}
                  {isPending && !hasResponse && (
                    <Tag icon={<ClockCircleOutlined />} color="orange" style={{ marginTop: 4 }}>
                      Pendiente de respuesta
                    </Tag>
                  )}
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

        {/* Project link when solicitud has a project */}
        {result.proyecto_codigo && (
          <Alert
            message={<><ProjectOutlined style={{ marginRight: 8 }} /> Proyecto en Desarrollo</>}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  Su solicitud se encuentra en desarrollo como proyecto <strong>{result.proyecto_codigo}</strong>.
                </Paragraph>
                <Button
                  type="primary"
                  icon={<ProjectOutlined />}
                  onClick={() => { navigate(`/consulta/${result.proyecto_codigo}`); loadStatus(result.proyecto_codigo) }}
                  style={{ backgroundColor: INEMEC_RED, borderColor: INEMEC_RED }}
                >
                  Ver progreso del proyecto
                </Button>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Scheduled dates */}
        {result.fecha_inicio_programada && !result.proyecto_codigo && (
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

        {renderComentarios(result.comentarios)}
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

        {renderComentarios(result.comentarios)}
      </Card>
    )
  }

  const renderProyectoStatus = () => {
    const config = proyectoEstadoConfig[result.estado]

    return (
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Tag
            color={config?.color}
            icon={config?.icon}
            style={{ fontSize: 16, padding: '8px 16px', marginBottom: 16 }}
          >
            {result.estado}
          </Tag>
          <Title level={3} style={{ margin: 0 }}>{result.titulo}</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>{result.codigo}</Text>
          {result.solicitud_codigo && result.solicitud_codigo !== result.codigo && (
            <div style={{ marginTop: 4 }}>
              <Button type="link" style={{ fontSize: 12, padding: 0 }}
                onClick={() => { navigate(`/consulta/${result.solicitud_codigo}`); loadStatus(result.solicitud_codigo) }}
              >
                Solicitud original: {result.solicitud_codigo}
              </Button>
            </div>
          )}
        </div>

        {/* Pause Alert */}
        {result.is_paused && (
          <Alert
            type="warning"
            showIcon
            icon={<PauseCircleOutlined />}
            message="Proyecto Pausado Temporalmente"
            description={
              <div>
                <div><strong>Motivo:</strong> {result.pause_reason}</div>
                <div><strong>Desde:</strong> {dayjs(result.pause_since).format('DD/MM/YYYY')}</div>
              </div>
            }
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Progress Circle + Estimated Finish */}
        {['En Desarrollo', 'Pausado', 'Completado'].includes(result.estado) && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Progress
              type="circle"
              percent={result.progreso || 0}
              strokeColor={INEMEC_RED}
              size={140}
              format={(p) => (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 'bold' }}>{p}%</div>
                  <div style={{ fontSize: 12, color: '#999' }}>Progreso</div>
                </div>
              )}
            />
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                {result.tareas_completadas} de {result.total_tareas} tareas completadas
              </Text>
            </div>
            {result.fecha_fin_estimada && (() => {
              const estimada = dayjs(result.fecha_fin_estimada)
              const programada = result.fecha_fin_programada ? dayjs(result.fecha_fin_programada) : null
              let note = null
              if (programada) {
                if (estimada.isSame(programada, 'day')) {
                  note = { text: 'Como planeado', color: '#52c41a' }
                } else if (estimada.isAfter(programada, 'day')) {
                  note = { text: 'Con retrasos comparado al plan', color: '#faad14' }
                } else {
                  note = { text: 'Adelantado comparado al plan', color: '#52c41a' }
                }
              }
              return (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    Fecha estimada de finalización:{' '}
                  </Text>
                  <Text strong>{estimada.format('DD/MM/YYYY')}</Text>
                  {note && (
                    <Text style={{ marginLeft: 8, color: note.color, fontSize: 13 }}>
                      ({note.text})
                    </Text>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Dates */}
        <Descriptions column={1} size="small" bordered>
          {result.fecha_inicio_programada && (
            <Descriptions.Item label={<><CalendarOutlined /> Fecha de Inicio Programada</>}>
              {dayjs(result.fecha_inicio_programada).format('DD/MM/YYYY')}
            </Descriptions.Item>
          )}
          {result.fecha_fin_programada && (
            <Descriptions.Item label={<><CalendarOutlined /> Fecha de Fin Programada</>}>
              {dayjs(result.fecha_fin_programada).format('DD/MM/YYYY')}
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Public Comments */}
        {renderComentarios(result.comentarios)}

        {/* Contact Info */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Paragraph type="secondary">
            Si tiene preguntas sobre el estado de su proyecto, contacte al departamento de Nuevas Tecnologías.
          </Paragraph>
        </div>
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
              placeholder="Código (ej: SOL-2026-0001, TKT-..., PRY-...)"
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
            Ingrese el código de su solicitud, ticket o proyecto
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
      {!loading && result && resultType === 'proyecto' && renderProyectoStatus()}

      {!loading && notFound && (
        <Result
          status="404"
          title="No encontrado"
          subTitle={`No se encontró ninguna solicitud, ticket ni proyecto con el código "${searchCode}". Verifique que el código sea correcto e intente nuevamente.`}
          extra={
            <Link to="/nueva-solicitud">
              <Button type="primary" style={{ backgroundColor: INEMEC_RED, borderColor: INEMEC_RED }}>
                Crear Nueva Solicitud
              </Button>
            </Link>
          }
        />
      )}
    </div>
  )
}

export default RequestStatus
