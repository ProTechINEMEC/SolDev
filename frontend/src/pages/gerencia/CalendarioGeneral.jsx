import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Row, Col, Typography, Tag, Space, Spin, Select, Switch,
  Tooltip, List, Badge, message, Statistic, Segmented, Table, Button,
  Progress, Empty
} from 'antd'
import {
  CalendarOutlined, TeamOutlined, ProjectOutlined, ToolOutlined,
  CheckCircleOutlined, ClockCircleOutlined, FilterOutlined, EyeOutlined,
  ExclamationCircleOutlined, RocketOutlined, ScheduleOutlined, ReloadOutlined
} from '@ant-design/icons'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { calendarioApi, ticketsApi, solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Title, Text } = Typography

const phaseColors = {
  analisis: '#1890ff',
  diseno: '#722ed1',
  desarrollo: '#52c41a',
  pruebas: '#faad14',
  documentacion: '#13c2c2',
  entrega: '#eb2f96'
}

const prioridadColors = {
  critica: '#ff4d4f',
  alta: '#fa8c16',
  media: '#1890ff',
  baja: '#52c41a'
}

const estadoProyectoColors = {
  aprobado: '#52c41a',
  agendado: '#722ed1',
  en_desarrollo: '#1890ff',
  completado: '#13c2c2',
  rechazado: '#ff4d4f'
}

function CalendarioGeneral() {
  const calendarRef = useRef(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const lastLoadedRange = useRef(null)

  // Data states
  const [proyectos, setProyectos] = useState([])
  const [tickets, setTickets] = useState([])
  const [equipoCarga, setEquipoCarga] = useState([])
  const [festivos, setFestivos] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])

  // Filter states
  const [showProjects, setShowProjects] = useState(true)
  const [showTickets, setShowTickets] = useState(true)
  const [showTasks, setShowTasks] = useState(true)
  const [filterPrioridad, setFilterPrioridad] = useState(null)
  const [viewMode, setViewMode] = useState('todos')

  // Stats
  const [stats, setStats] = useState({
    proyectosActivos: 0,
    proyectosAgendados: 0,
    ticketsAbiertos: 0,
    ticketsResueltos: 0
  })

  // Calendar view range - use wide range for data, calendar controls what's visible
  const dateRangeRef = useRef({
    start: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    end: dayjs().add(12, 'month').endOf('month').format('YYYY-MM-DD')
  })

  // Track if initial load is done to prevent datesSet from reloading with narrow range
  const initialLoadDone = useRef(false)

  useEffect(() => {
    loadData(dateRangeRef.current)
    initialLoadDone.current = true
  }, [])

  const loadData = async (range) => {
    const rangeKey = `${range.start}-${range.end}`
    if (lastLoadedRange.current === rangeKey) {
      return
    }
    lastLoadedRange.current = rangeKey

    try {
      const startYear = dayjs(range.start).year()
      const endYear = dayjs(range.end).year()

      // Fetch pending approvals separately to handle potential errors
      let pendingRes = { data: { solicitudes: [] } }
      try {
        pendingRes = await solicitudesApi.list({
          estado: 'pendiente_aprobacion_gerencia',
          tipo: 'proyecto_nuevo_interno,proyecto_nuevo_externo,actualizacion',
          limit: 50
        })
        console.log('Pending approvals response:', pendingRes.data)
      } catch (pendingError) {
        console.error('Error fetching pending approvals:', pendingError)
      }

      const [proyectosRes, equipoRes, ticketsRes, festivosRes] = await Promise.all([
        calendarioApi.getProyectosConTareas({
          fecha_inicio: range.start,
          fecha_fin: range.end
        }),
        calendarioApi.getEquipoCarga({
          fecha_inicio: range.start,
          fecha_fin: range.end
        }),
        ticketsApi.list({
          fecha_desde: range.start,
          fecha_hasta: range.end,
          limit: 500
        }),
        calendarioApi.getFestivos({
          year_start: startYear,
          year_end: endYear
        })
      ])

      const proyectosList = proyectosRes.data.proyectos || []
      const ticketsList = ticketsRes.data.tickets || []

      setProyectos(proyectosList)
      setEquipoCarga(equipoRes.data.equipo || [])
      setTickets(ticketsList)
      setFestivos(festivosRes.data.festivos || [])
      setPendingApprovals(pendingRes.data.solicitudes || [])

      // Calculate stats
      setStats({
        proyectosActivos: proyectosList.filter(p =>
          p.estado === 'en_desarrollo'
        ).length,
        proyectosAgendados: proyectosList.filter(p =>
          ['agendado', 'aprobado'].includes(p.estado)
        ).length,
        ticketsAbiertos: ticketsList.filter(t =>
          ['abierto', 'en_proceso'].includes(t.estado)
        ).length,
        ticketsResueltos: ticketsList.filter(t =>
          t.estado === 'solucionado'
        ).length
      })
    } catch (error) {
      console.error('Error loading calendar data:', error)
      message.error('Error al cargar datos del calendario')
    } finally {
      setInitialLoading(false)
    }
  }

  const handleDatesSet = useCallback((dateInfo) => {
    // Don't reload on every date change - we load a wide range initially
    // This just updates the ref for any components that need current view range
    dateRangeRef.current = {
      start: dayjs(dateInfo.start).format('YYYY-MM-DD'),
      end: dayjs(dateInfo.end).format('YYYY-MM-DD')
    }
  }, [])

  // Build calendar events
  const buildCalendarEvents = () => {
    const events = []

    // Add project events
    if (showProjects) {
      proyectos.forEach(proyecto => {
        // Filter by priority if set
        if (filterPrioridad && proyecto.prioridad !== filterPrioridad) {
          return
        }

        // Filter by view mode
        if (viewMode === 'nt' && proyecto.tipo === 'ticket') return
        if (viewMode === 'ti' && proyecto.tipo !== 'ticket') return

        // Add main project bar
        events.push({
          id: `project-${proyecto.id}`,
          title: `${proyecto.codigo}: ${proyecto.titulo}`,
          start: proyecto.fecha_inicio_programada,
          end: dayjs(proyecto.fecha_fin_programada).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: estadoProyectoColors[proyecto.estado] || prioridadColors[proyecto.prioridad] || '#1890ff',
          borderColor: estadoProyectoColors[proyecto.estado] || prioridadColors[proyecto.prioridad] || '#1890ff',
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'project', proyecto }
        })

        // Add task events
        if (showTasks) {
          proyecto.tareas?.forEach(tarea => {
            events.push({
              id: `task-${proyecto.id}-${tarea.id}`,
              title: `  ${tarea.nombre}${tarea.asignado_nombre ? ` (${tarea.asignado_nombre.split(' ')[0]})` : ''}`,
              start: tarea.fecha_inicio,
              end: dayjs(tarea.fecha_fin).add(1, 'day').format('YYYY-MM-DD'),
              allDay: true,
              backgroundColor: phaseColors[tarea.fase] || '#d9d9d9',
              borderColor: 'transparent',
              textColor: '#fff',
              display: 'block',
              extendedProps: { type: 'task', tarea, proyecto }
            })
          })
        }
      })
    }

    // Add ticket events (resolved tickets as milestones)
    if (showTickets && (viewMode === 'todos' || viewMode === 'ti')) {
      tickets.forEach(ticket => {
        if (filterPrioridad && ticket.prioridad !== filterPrioridad) {
          return
        }

        // Show resolved tickets on resolution date, open tickets on creation date
        const ticketDate = ticket.estado === 'solucionado' && ticket.fecha_solucion
          ? ticket.fecha_solucion
          : ticket.creado_en

        const color = ticket.estado === 'solucionado'
          ? '#52c41a'
          : ticket.estado === 'en_proceso'
          ? '#faad14'
          : '#ff4d4f'

        events.push({
          id: `ticket-${ticket.id}`,
          title: `[TI] ${ticket.codigo}: ${ticket.titulo}`,
          start: dayjs(ticketDate).format('YYYY-MM-DD'),
          end: dayjs(ticketDate).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'ticket', ticket }
        })
      })
    }

    // Add Colombian holidays as background events
    festivos.forEach(festivo => {
      events.push({
        id: `holiday-${festivo.fecha}`,
        title: festivo.nombre,
        start: festivo.fecha,
        end: dayjs(festivo.fecha).add(1, 'day').format('YYYY-MM-DD'),
        allDay: true,
        display: 'background',
        backgroundColor: '#ff4d4f33',
        borderColor: '#ff4d4f',
        extendedProps: { type: 'holiday', festivo }
      })
    })

    return events
  }

  const eventContent = (eventInfo) => {
    const { extendedProps } = eventInfo.event

    if (extendedProps.type === 'ticket') {
      return (
        <Tooltip title={
          <div>
            <div><strong>{extendedProps.ticket.codigo}</strong></div>
            <div>{extendedProps.ticket.titulo}</div>
            <div>Estado: {extendedProps.ticket.estado}</div>
            <div>Prioridad: {extendedProps.ticket.prioridad}</div>
          </div>
        }>
          <div style={{
            padding: '2px 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11
          }}>
            <ToolOutlined style={{ marginRight: 4 }} />
            {eventInfo.event.title}
          </div>
        </Tooltip>
      )
    }

    if (extendedProps.type === 'project') {
      return (
        <Tooltip title={
          <div>
            <div><strong>{extendedProps.proyecto.codigo}</strong></div>
            <div>{extendedProps.proyecto.titulo}</div>
            <div>Estado: {extendedProps.proyecto.estado}</div>
            <div>Prioridad: {extendedProps.proyecto.prioridad}</div>
            <div>
              {dayjs(extendedProps.proyecto.fecha_inicio_programada).format('DD/MM')} -
              {dayjs(extendedProps.proyecto.fecha_fin_programada).format('DD/MM/YYYY')}
            </div>
          </div>
        }>
          <div style={{
            padding: '2px 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontWeight: 'bold'
          }}>
            <ProjectOutlined style={{ marginRight: 4 }} />
            {eventInfo.event.title}
          </div>
        </Tooltip>
      )
    }

    // Task
    return (
      <Tooltip title={
        <div>
          <div><strong>{extendedProps.tarea?.nombre}</strong></div>
          <div>Fase: {extendedProps.tarea?.fase}</div>
          <div>Asignado: {extendedProps.tarea?.asignado_nombre || 'Sin asignar'}</div>
          <div>
            {dayjs(extendedProps.tarea?.fecha_inicio).format('DD/MM')} -
            {dayjs(extendedProps.tarea?.fecha_fin).format('DD/MM/YYYY')}
          </div>
        </div>
      }>
        <div style={{
          padding: '2px 4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 10
        }}>
          {eventInfo.event.title}
        </div>
      </Tooltip>
    )
  }

  // Force refresh data
  const handleRefresh = () => {
    lastLoadedRange.current = null // Reset to force reload
    setInitialLoading(true)
    loadData(dateRangeRef.current)
  }

  // Derived data for sections
  const projectsInDevelopment = proyectos.filter(p => p.estado === 'en_desarrollo')
  const scheduledProjects = proyectos.filter(p => p.estado === 'agendado')

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 12 }} />
          Calendario General
        </Title>
        <Tooltip title="Actualizar datos">
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={initialLoading}
          >
            Actualizar
          </Button>
        </Tooltip>
      </div>

      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Cargando calendario...</div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {/* Stats Row */}
          <Col span={24}>
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic
                    title="Proyectos Activos"
                    value={stats.proyectosActivos}
                    prefix={<ProjectOutlined style={{ color: '#1890ff' }} />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic
                    title="Proyectos Agendados"
                    value={stats.proyectosAgendados}
                    prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic
                    title="Tickets Abiertos"
                    value={stats.ticketsAbiertos}
                    prefix={<ToolOutlined style={{ color: '#fa8c16' }} />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic
                    title="Tickets Resueltos"
                    value={stats.ticketsResueltos}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          {/* Calendar Column */}
          <Col xs={24} lg={18}>
            <Card
              size="small"
              title={
                <Space>
                  <CalendarOutlined />
                  <span>Vista de Calendario</span>
                </Space>
              }
              extra={
                <Space>
                  <Segmented
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      { label: 'Todos', value: 'todos' },
                      { label: 'NT', value: 'nt' },
                      { label: 'TI', value: 'ti' }
                    ]}
                  />
                </Space>
              }
            >
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="es"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,dayGridWeek'
                }}
                events={buildCalendarEvents()}
                eventContent={eventContent}
                height={600}
                dayMaxEvents={5}
                weekends={false}
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: '08:00',
                  endTime: '18:00'
                }}
                datesSet={handleDatesSet}
              />
            </Card>

            {/* Pending Approvals */}
            <Card
              size="small"
              title={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                  <span>Aprobaciones Pendientes</span>
                  <Badge count={pendingApprovals.length} style={{ backgroundColor: pendingApprovals.length > 0 ? '#faad14' : '#d9d9d9' }} />
                </Space>
              }
              style={{ marginTop: 16 }}
            >
              {pendingApprovals.length === 0 ? (
                <Text type="secondary">No hay solicitudes pendientes de aprobación</Text>
              ) : (
                <Table
                  dataSource={pendingApprovals}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    {
                      title: 'Código',
                      dataIndex: 'codigo',
                      width: 120,
                      render: (codigo, record) => (
                        <Link to={`/gerencia/aprobaciones/${record.id}`}>
                          <Text strong style={{ color: '#1890ff' }}>{codigo}</Text>
                        </Link>
                      )
                    },
                    {
                      title: 'Título',
                      dataIndex: 'titulo',
                      ellipsis: true
                    },
                    {
                      title: 'Prioridad',
                      dataIndex: 'prioridad',
                      width: 90,
                      render: (p) => <Tag color={prioridadColors[p]}>{p?.toUpperCase()}</Tag>
                    },
                    {
                      title: 'Esperando',
                      dataIndex: 'creado_en',
                      width: 80,
                      render: (d) => {
                        const days = dayjs().diff(dayjs(d), 'day')
                        return (
                          <Badge
                            count={`${days}d`}
                            style={{ backgroundColor: days > 7 ? '#ff4d4f' : days > 3 ? '#faad14' : '#52c41a' }}
                          />
                        )
                      }
                    },
                    {
                      title: '',
                      width: 80,
                      render: (_, record) => (
                        <Link to={`/gerencia/aprobaciones/${record.id}`}>
                          <Button type="primary" size="small" icon={<EyeOutlined />}>
                            Revisar
                          </Button>
                        </Link>
                      )
                    }
                  ]}
                />
              )}
            </Card>

            {/* Projects in Development */}
            <Card
              size="small"
              title={
                <Space>
                  <RocketOutlined style={{ color: '#1890ff' }} />
                  <span>Proyectos en Desarrollo</span>
                  <Badge
                    count={projectsInDevelopment.length}
                    style={{ backgroundColor: '#1890ff' }}
                  />
                </Space>
              }
              style={{ marginTop: 16 }}
            >
              {projectsInDevelopment.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No hay proyectos en desarrollo"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {projectsInDevelopment.map(proyecto => {
                      // Calculate completion percentage based on tasks progress or time elapsed
                      const totalTareas = proyecto.tareas?.length || 0

                      // Calculate average progress from all tasks
                      let porcentaje = 0
                      if (totalTareas > 0) {
                        const totalProgreso = proyecto.tareas.reduce((sum, t) => sum + (t.progreso || 0), 0)
                        porcentaje = Math.round(totalProgreso / totalTareas)
                      } else if (proyecto.fecha_inicio_programada && proyecto.fecha_fin_programada) {
                        const inicio = dayjs(proyecto.fecha_inicio_programada)
                        const fin = dayjs(proyecto.fecha_fin_programada)
                        const hoy = dayjs()
                        const totalDias = fin.diff(inicio, 'day')
                        const diasTranscurridos = hoy.diff(inicio, 'day')
                        if (totalDias > 0) {
                          porcentaje = Math.min(100, Math.max(0, Math.round((diasTranscurridos / totalDias) * 100)))
                        }
                      }

                      // Days until deadline
                      const diasRestantes = proyecto.fecha_fin_programada
                        ? dayjs(proyecto.fecha_fin_programada).diff(dayjs(), 'day')
                        : null

                      const isOverdue = diasRestantes !== null && diasRestantes < 0
                      const isUrgent = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7

                      return (
                        <Card
                          key={proyecto.id}
                          size="small"
                          style={{
                            backgroundColor: isOverdue ? '#fff2f0' : isUrgent ? '#fffbe6' : '#fafafa',
                            border: isOverdue ? '1px solid #ffccc7' : isUrgent ? '1px solid #ffe58f' : '1px solid #f0f0f0'
                          }}
                        >
                          <Row gutter={[16, 8]}>
                            <Col span={24}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <Link to={`/nt/proyectos/${proyecto.id}`}>
                                    <Text strong style={{ color: '#1890ff', fontSize: 14 }}>
                                      {proyecto.codigo}
                                    </Text>
                                  </Link>
                                  <Text style={{ marginLeft: 8 }}>{proyecto.titulo}</Text>
                                </div>
                                <Tag color={prioridadColors[proyecto.prioridad]}>
                                  {proyecto.prioridad?.toUpperCase()}
                                </Tag>
                              </div>
                            </Col>

                            <Col span={16}>
                              <div style={{ marginBottom: 4 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Progreso {totalTareas > 0 ? `(${totalTareas} tareas)` : '(por tiempo)'}
                                </Text>
                              </div>
                              <Progress
                                percent={porcentaje}
                                size="small"
                                status={isOverdue ? 'exception' : porcentaje === 100 ? 'success' : 'active'}
                                strokeColor={isOverdue ? '#ff4d4f' : isUrgent ? '#faad14' : '#1890ff'}
                              />
                            </Col>

                            <Col span={8} style={{ textAlign: 'right' }}>
                              <div style={{ marginBottom: 4 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Fecha Fin</Text>
                              </div>
                              <div>
                                <Text
                                  strong
                                  style={{
                                    color: isOverdue ? '#ff4d4f' : isUrgent ? '#fa8c16' : 'inherit',
                                    fontSize: 13
                                  }}
                                >
                                  {proyecto.fecha_fin_programada
                                    ? dayjs(proyecto.fecha_fin_programada).format('DD/MM/YYYY')
                                    : 'Sin fecha'}
                                </Text>
                              </div>
                              {diasRestantes !== null && (
                                <Text
                                  type="secondary"
                                  style={{
                                    fontSize: 11,
                                    color: isOverdue ? '#ff4d4f' : isUrgent ? '#fa8c16' : undefined
                                  }}
                                >
                                  {isOverdue
                                    ? `${Math.abs(diasRestantes)} días de retraso`
                                    : diasRestantes === 0
                                    ? 'Vence hoy'
                                    : `${diasRestantes} días restantes`}
                                </Text>
                              )}
                            </Col>
                          </Row>
                        </Card>
                      )
                    })}
                </div>
              )}
            </Card>

            {/* Scheduled Projects */}
            <Card
              size="small"
              title={
                <Space>
                  <ScheduleOutlined style={{ color: '#722ed1' }} />
                  <span>Proyectos Programados</span>
                  <Badge
                    count={scheduledProjects.length}
                    style={{ backgroundColor: '#722ed1' }}
                  />
                </Space>
              }
              style={{ marginTop: 16 }}
            >
              {scheduledProjects.length === 0 ? (
                <Text type="secondary">No hay proyectos programados</Text>
              ) : (
                <List
                  size="small"
                  dataSource={scheduledProjects}
                  renderItem={proyecto => {
                    const diasParaInicio = proyecto.fecha_inicio_programada
                      ? dayjs(proyecto.fecha_inicio_programada).diff(dayjs(), 'day')
                      : null

                    return (
                      <List.Item
                        style={{
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                      >
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Link to={`/nt/proyectos/${proyecto.id}`}>
                              <Text strong style={{ color: '#722ed1' }}>{proyecto.codigo}</Text>
                            </Link>
                            <Tag color={prioridadColors[proyecto.prioridad]} style={{ margin: 0 }}>
                              {proyecto.prioridad?.toUpperCase()}
                            </Tag>
                          </div>
                          <Text ellipsis style={{ display: 'block', marginBottom: 4 }}>
                            {proyecto.titulo}
                          </Text>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {proyecto.fecha_inicio_programada
                                ? dayjs(proyecto.fecha_inicio_programada).format('DD/MM/YYYY')
                                : '?'}
                              {' → '}
                              {proyecto.fecha_fin_programada
                                ? dayjs(proyecto.fecha_fin_programada).format('DD/MM/YYYY')
                                : '?'}
                            </Text>
                            {diasParaInicio !== null && (
                              <Badge
                                count={diasParaInicio <= 0 ? 'Inicia hoy' : `${diasParaInicio}d`}
                                style={{
                                  backgroundColor: diasParaInicio <= 0 ? '#52c41a' : diasParaInicio <= 7 ? '#faad14' : '#1890ff',
                                  fontSize: 10
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )
                  }}
                />
              )}
            </Card>
          </Col>

          {/* Sidebar */}
          <Col xs={24} lg={6}>
            {/* Filters */}
            <Card size="small" title={<><FilterOutlined /> Filtros</>} style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Prioridad:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Todas las prioridades"
                    allowClear
                    value={filterPrioridad}
                    onChange={setFilterPrioridad}
                  >
                    <Select.Option value="critica">
                      <Tag color="red">Critica</Tag>
                    </Select.Option>
                    <Select.Option value="alta">
                      <Tag color="orange">Alta</Tag>
                    </Select.Option>
                    <Select.Option value="media">
                      <Tag color="blue">Media</Tag>
                    </Select.Option>
                    <Select.Option value="baja">
                      <Tag color="green">Baja</Tag>
                    </Select.Option>
                  </Select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Mostrar Proyectos</Text>
                  <Switch checked={showProjects} onChange={setShowProjects} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Mostrar Tareas</Text>
                  <Switch checked={showTasks} onChange={setShowTasks} disabled={!showProjects} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Mostrar Tickets TI</Text>
                  <Switch checked={showTickets} onChange={setShowTickets} />
                </div>
              </Space>
            </Card>

            {/* Legend */}
            <Card size="small" title="Leyenda" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 12 }}>Estados de Proyecto:</Text>
                <Space wrap>
                  <Tag color="#52c41a">Aprobado</Tag>
                  <Tag color="#722ed1">Agendado</Tag>
                  <Tag color="#1890ff">En Desarrollo</Tag>
                  <Tag color="#13c2c2">Completado</Tag>
                </Space>

                <Text strong style={{ fontSize: 12, marginTop: 8 }}>Fases de Tareas:</Text>
                <Space wrap>
                  <Tag color="#1890ff">Analisis</Tag>
                  <Tag color="#722ed1">Diseno</Tag>
                  <Tag color="#52c41a">Desarrollo</Tag>
                  <Tag color="#faad14">Pruebas</Tag>
                  <Tag color="#13c2c2">Documentacion</Tag>
                  <Tag color="#eb2f96">Entrega</Tag>
                </Space>

                <Text strong style={{ fontSize: 12, marginTop: 8 }}>Tickets TI:</Text>
                <Space wrap>
                  <Tag color="#ff4d4f">Abierto</Tag>
                  <Tag color="#faad14">En Proceso</Tag>
                  <Tag color="#52c41a">Solucionado</Tag>
                </Space>
              </Space>
            </Card>

            {/* Team Workload */}
            <Card size="small" title={<><TeamOutlined /> Carga del Equipo NT</>}>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {equipoCarga.length === 0 ? (
                  <Text type="secondary">No hay miembros del equipo</Text>
                ) : (
                  <List
                    size="small"
                    dataSource={equipoCarga}
                    renderItem={miembro => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <List.Item.Meta
                          title={<Text style={{ fontSize: 13 }}>{miembro.nombre}</Text>}
                          description={
                            miembro.tareas.length === 0
                              ? <Tag color="green" style={{ fontSize: 10 }}>Disponible</Tag>
                              : <Space wrap size={4}>
                                  {miembro.tareas.slice(0, 2).map(t => (
                                    <Tooltip
                                      key={t.id}
                                      title={`${t.proyecto_codigo}: ${t.nombre}`}
                                    >
                                      <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                                        {t.proyecto_codigo}
                                      </Tag>
                                    </Tooltip>
                                  ))}
                                  {miembro.tareas.length > 2 && (
                                    <Tag style={{ fontSize: 10, margin: 0 }}>+{miembro.tareas.length - 2}</Tag>
                                  )}
                                </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}

export default CalendarioGeneral
