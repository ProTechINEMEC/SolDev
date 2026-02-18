import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Tag, Typography, Spin, message, Select,
  Button, Space, Tooltip, Badge, Calendar, Modal, Descriptions, Alert, List
} from 'antd'
import {
  CalendarOutlined, ProjectOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DollarOutlined, EyeOutlined,
  LeftOutlined, RightOutlined, WarningOutlined
} from '@ant-design/icons'
import { calendarioApi, solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Title, Text } = Typography

const prioridadColors = {
  baja: '#52c41a',
  media: '#1890ff',
  alta: '#fa8c16',
  critica: '#ff4d4f'
}

const estadoColors = {
  agendado: '#722ed1',
  aprobado: '#52c41a',
  en_desarrollo: '#1890ff',
  pendiente_aprobacion_gerencia: '#faad14'
}

const estadoLabels = {
  agendado: 'Agendado',
  aprobado: 'Aprobado',
  en_desarrollo: 'En Desarrollo',
  pendiente_aprobacion_gerencia: 'Pendiente Aprobación'
}

function CalendarioProyectos() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [estadisticas, setEstadisticas] = useState({})
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [selectedProyecto, setSelectedProyecto] = useState(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  // Get current month and year for API calls
  const currentMonth = selectedDate.month() + 1
  const currentYear = selectedDate.year()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Calculate date range for the visible calendar (includes adjacent months)
      const startOfMonth = selectedDate.startOf('month')
      const endOfMonth = selectedDate.endOf('month')

      // Load projects and stats in parallel
      const [proyectosRes, estadisticasRes] = await Promise.all([
        calendarioApi.getProyectos({
          fecha_inicio: startOfMonth.subtract(7, 'day').format('YYYY-MM-DD'),
          fecha_fin: endOfMonth.add(7, 'day').format('YYYY-MM-DD')
        }),
        calendarioApi.getEstadisticas({
          mes: currentMonth,
          anio: currentYear
        })
      ])

      setProyectos(proyectosRes.data.eventos || [])
      setEstadisticas(estadisticasRes.data || {})
    } catch (error) {
      console.error('Error loading calendar data:', error)
      message.error('Error al cargar el calendario')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, currentMonth, currentYear])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Format COP currency
  const formatCOP = (value) => {
    if (!value) return '$0'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  // Get projects for a specific date
  const getProjectsForDate = (date) => {
    return proyectos.filter(p => {
      const start = dayjs(p.start)
      const end = dayjs(p.end)
      return date.isSameOrAfter(start, 'day') && date.isSameOrBefore(end, 'day')
    })
  }

  // Render calendar cell with projects
  const dateCellRender = (date) => {
    const dayProjects = getProjectsForDate(date)

    if (dayProjects.length === 0) return null

    return (
      <div style={{ padding: '2px 4px' }}>
        {dayProjects.slice(0, 3).map((p, index) => {
          const isStart = dayjs(p.start).isSame(date, 'day')
          const isEnd = dayjs(p.end).isSame(date, 'day')

          return (
            <Tooltip
              key={p.id}
              title={
                <div>
                  <div><strong>{p.extendedProps?.codigo}</strong></div>
                  <div>{p.extendedProps?.titulo}</div>
                  <div>Prioridad: {p.extendedProps?.prioridad}</div>
                  <div>Estado: {estadoLabels[p.extendedProps?.estado] || p.extendedProps?.estado}</div>
                </div>
              }
            >
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedProyecto(p)
                  setDetailModalVisible(true)
                }}
                style={{
                  backgroundColor: p.backgroundColor,
                  borderLeft: isStart ? `3px solid ${p.borderColor}` : 'none',
                  borderRight: isEnd ? `3px solid ${p.borderColor}` : 'none',
                  padding: '2px 6px',
                  marginBottom: 2,
                  fontSize: 11,
                  color: '#fff',
                  borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                {isStart ? p.extendedProps?.codigo : ''}
              </div>
            </Tooltip>
          )
        })}
        {dayProjects.length > 3 && (
          <div style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>
            +{dayProjects.length - 3} más
          </div>
        )}
      </div>
    )
  }

  // Month navigation
  const handlePrevMonth = () => {
    setSelectedDate(selectedDate.subtract(1, 'month'))
  }

  const handleNextMonth = () => {
    setSelectedDate(selectedDate.add(1, 'month'))
  }

  const handleToday = () => {
    setSelectedDate(dayjs())
  }

  // Calculate conflicts (projects on same days)
  const calculateConflicts = () => {
    const conflicts = []
    for (let i = 0; i < proyectos.length; i++) {
      for (let j = i + 1; j < proyectos.length; j++) {
        const p1Start = dayjs(proyectos[i].start)
        const p1End = dayjs(proyectos[i].end)
        const p2Start = dayjs(proyectos[j].start)
        const p2End = dayjs(proyectos[j].end)

        // Check if ranges overlap
        if (p1Start.isSameOrBefore(p2End) && p2Start.isSameOrBefore(p1End)) {
          conflicts.push({
            proyecto1: proyectos[i],
            proyecto2: proyectos[j]
          })
        }
      }
    }
    return conflicts
  }

  const conflicts = calculateConflicts()

  if (loading && proyectos.length === 0) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          Calendario de Proyectos
        </Title>
        <Link to="/gerencia/aprobaciones">
          <Button>Ver Aprobaciones Pendientes</Button>
        </Link>
      </div>

      {/* Statistics Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Proyectos del Mes"
              value={estadisticas.proyectos?.total || 0}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Agendados"
              value={estadisticas.proyectos?.agendados || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="En Desarrollo"
              value={estadisticas.proyectos?.en_desarrollo || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Costo Total Mes"
              value={formatCOP(estadisticas.costo_total_mes)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pending approvals alert */}
      {estadisticas.pendientes_aprobacion > 0 && (
        <Alert
          message={`${estadisticas.pendientes_aprobacion} solicitud(es) pendiente(s) de aprobación`}
          type="warning"
          showIcon
          action={
            <Link to="/gerencia/aprobaciones">
              <Button size="small" type="primary">Ver</Button>
            </Link>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <Alert
          message={<><WarningOutlined /> {conflicts.length} conflicto(s) de fechas detectado(s)</>}
          description={
            <List
              size="small"
              dataSource={conflicts.slice(0, 3)}
              renderItem={(c) => (
                <List.Item>
                  <Text>
                    <strong>{c.proyecto1.extendedProps?.codigo}</strong> se superpone con{' '}
                    <strong>{c.proyecto2.extendedProps?.codigo}</strong>
                  </Text>
                </List.Item>
              )}
            />
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Calendar */}
      <Card>
        {/* Custom header with navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '0 8px'
        }}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={handlePrevMonth} />
            <Button onClick={handleToday}>Hoy</Button>
            <Button icon={<RightOutlined />} onClick={handleNextMonth} />
          </Space>
          <Title level={4} style={{ margin: 0 }}>
            {selectedDate.format('MMMM YYYY').charAt(0).toUpperCase() + selectedDate.format('MMMM YYYY').slice(1)}
          </Title>
          <Space>
            {/* Legend */}
            <Space split={<span style={{ margin: '0 4px' }}>|</span>}>
              {Object.entries(prioridadColors).map(([key, color]) => (
                <Space key={key} size={4}>
                  <div style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 2 }} />
                  <Text style={{ fontSize: 12 }}>{key}</Text>
                </Space>
              ))}
            </Space>
          </Space>
        </div>

        <Calendar
          value={selectedDate}
          onSelect={setSelectedDate}
          dateCellRender={dateCellRender}
          headerRender={() => null}
          mode="month"
          onPanelChange={(date) => setSelectedDate(date)}
        />
      </Card>

      {/* Projects list for current month */}
      <Card title={`Proyectos en ${selectedDate.format('MMMM YYYY')}`} style={{ marginTop: 16 }}>
        {proyectos.length > 0 ? (
          <List
            dataSource={proyectos}
            renderItem={(p) => (
              <List.Item
                actions={[
                  <Button
                    key="view"
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/gerencia/aprobaciones/${p.id}`)}
                  >
                    Ver Detalle
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: p.backgroundColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${p.borderColor}`
                      }}
                    >
                      <ProjectOutlined style={{ color: '#fff', fontSize: 18 }} />
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong>{p.extendedProps?.codigo}</Text>
                      <Tag color={estadoColors[p.extendedProps?.estado]}>
                        {estadoLabels[p.extendedProps?.estado] || p.extendedProps?.estado}
                      </Tag>
                      <Tag color={prioridadColors[p.extendedProps?.prioridad]}>
                        {p.extendedProps?.prioridad?.toUpperCase()}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>{p.extendedProps?.titulo}</Text>
                      <Text type="secondary">
                        <CalendarOutlined style={{ marginRight: 4 }} />
                        {dayjs(p.start).format('DD/MM/YYYY')} - {dayjs(p.end).format('DD/MM/YYYY')}
                      </Text>
                      {p.extendedProps?.costo_estimado && (
                        <Text type="secondary">
                          <DollarOutlined style={{ marginRight: 4 }} />
                          {formatCOP(p.extendedProps.costo_estimado)}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">No hay proyectos programados para este mes</Text>
        )}
      </Card>

      {/* Project Detail Modal */}
      <Modal
        title={`${selectedProyecto?.extendedProps?.codigo} - Detalles`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Cerrar
          </Button>,
          <Button
            key="view"
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => {
              setDetailModalVisible(false)
              navigate(`/gerencia/aprobaciones/${selectedProyecto?.id}`)
            }}
          >
            Ver Completo
          </Button>
        ]}
        width={600}
      >
        {selectedProyecto && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Código">{selectedProyecto.extendedProps?.codigo}</Descriptions.Item>
            <Descriptions.Item label="Título">{selectedProyecto.extendedProps?.titulo}</Descriptions.Item>
            <Descriptions.Item label="Estado">
              <Tag color={estadoColors[selectedProyecto.extendedProps?.estado]}>
                {estadoLabels[selectedProyecto.extendedProps?.estado] || selectedProyecto.extendedProps?.estado}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Prioridad">
              <Tag color={prioridadColors[selectedProyecto.extendedProps?.prioridad]}>
                {selectedProyecto.extendedProps?.prioridad?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Fecha Inicio">
              {dayjs(selectedProyecto.start).format('DD/MM/YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Fecha Fin">
              {dayjs(selectedProyecto.end).format('DD/MM/YYYY')}
            </Descriptions.Item>
            {selectedProyecto.extendedProps?.costo_estimado && (
              <Descriptions.Item label="Costo Estimado">
                {formatCOP(selectedProyecto.extendedProps.costo_estimado)}
              </Descriptions.Item>
            )}
            {selectedProyecto.extendedProps?.recomendacion && (
              <Descriptions.Item label="Recomendación NT">
                <Tag color={
                  selectedProyecto.extendedProps.recomendacion === 'aprobar' ? 'success' :
                  selectedProyecto.extendedProps.recomendacion === 'rechazar' ? 'error' : 'warning'
                }>
                  {selectedProyecto.extendedProps.recomendacion?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default CalendarioProyectos
