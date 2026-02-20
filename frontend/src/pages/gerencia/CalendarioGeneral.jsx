import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Row, Col, Typography, Tag, Space, Spin, Select, Switch,
  Tooltip, List, Badge, message, Table, Button,
  Progress, Empty
} from 'antd'
import {
  CalendarOutlined, ProjectOutlined, ToolOutlined,
  CheckCircleOutlined, ClockCircleOutlined, FilterOutlined, EyeOutlined,
  ExclamationCircleOutlined, RocketOutlined, ScheduleOutlined, ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { calendarioApi, ticketsApi, solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Title, Text } = Typography

// INEMEC Brand Colors
const INEMEC_RED = '#D52B1E'
const INEMEC_RED_LIGHT = '#E85A50'

// Colors for different entity types
const entityColors = {
  proyecto: INEMEC_RED,
  tarea: INEMEC_RED_LIGHT,
  solucionado: '#52c41a',     // Green for resolved
  noRealizado: '#fa8c16'      // Orange for no_realizado and transferred
}

const prioridadColors = {
  critica: '#ff4d4f',
  alta: '#fa8c16',
  media: '#1890ff',
  baja: '#52c41a'
}

function CalendarioGeneral() {
  const calendarRef = useRef(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const lastLoadedRange = useRef(null)

  // Data states
  const [proyectos, setProyectos] = useState([])
  const [ticketsTI, setTicketsTI] = useState([])
  const [solicitudesNT, setSolicitudesNT] = useState([])
  const [festivos, setFestivos] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])

  // Filter states
  const [showProyectosNT, setShowProyectosNT] = useState(true)
  const [showTareasNT, setShowTareasNT] = useState(true)
  const [showTicketsTI, setShowTicketsTI] = useState(true)
  const [showSolicitudesNT, setShowSolicitudesNT] = useState(true)
  const [filterPrioridad, setFilterPrioridad] = useState(null)

  // Calendar view range - use wide range for data
  const dateRangeRef = useRef({
    start: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    end: dayjs().add(12, 'month').endOf('month').format('YYYY-MM-DD')
  })

  useEffect(() => {
    loadData(dateRangeRef.current)
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

      // Fetch pending approvals
      let pendingRes = { data: { solicitudes: [] } }
      try {
        pendingRes = await solicitudesApi.list({
          estado: 'pendiente_aprobacion_gerencia',
          tipo: 'proyecto_nuevo_interno,proyecto_nuevo_externo,actualizacion',
          limit: 50
        })
      } catch (pendingError) {
        console.error('Error fetching pending approvals:', pendingError)
      }

      // Fetch closed NT solicitudes (non-project types)
      let solicitudesNTRes = { data: { solicitudes: [] } }
      try {
        solicitudesNTRes = await solicitudesApi.list({
          tipo: 'reporte_fallo,cierre_servicio',
          estado: 'resuelto,no_realizado,transferido_ti',
          fecha_desde: range.start,
          fecha_hasta: range.end,
          limit: 500
        })
      } catch (solError) {
        console.error('Error fetching NT solicitudes:', solError)
      }

      const [proyectosRes, ticketsRes, festivosRes] = await Promise.all([
        calendarioApi.getProyectosConTareas({
          fecha_inicio: range.start,
          fecha_fin: range.end
        }),
        ticketsApi.list({
          estado: 'solucionado,no_realizado,transferido_nt',
          fecha_desde: range.start,
          fecha_hasta: range.end,
          limit: 500
        }),
        calendarioApi.getFestivos({
          year_start: startYear,
          year_end: endYear
        })
      ])

      setProyectos(proyectosRes.data.proyectos || [])
      setTicketsTI(ticketsRes.data.tickets || [])
      setSolicitudesNT(solicitudesNTRes.data.solicitudes || [])
      setFestivos(festivosRes.data.festivos || [])
      setPendingApprovals(pendingRes.data.solicitudes || [])
    } catch (error) {
      console.error('Error loading calendar data:', error)
      message.error('Error al cargar datos del calendario')
    } finally {
      setInitialLoading(false)
    }
  }

  const handleDatesSet = useCallback((dateInfo) => {
    dateRangeRef.current = {
      start: dayjs(dateInfo.start).format('YYYY-MM-DD'),
      end: dayjs(dateInfo.end).format('YYYY-MM-DD')
    }
  }, [])

  // Build calendar events
  const buildCalendarEvents = () => {
    const events = []

    // Add NT project events
    if (showProyectosNT) {
      proyectos.forEach(proyecto => {
        if (filterPrioridad && proyecto.prioridad !== filterPrioridad) {
          return
        }

        // Add main project bar in INEMEC red
        events.push({
          id: `project-${proyecto.id}`,
          title: `${proyecto.codigo}: ${proyecto.titulo}`,
          start: proyecto.fecha_inicio_programada,
          end: dayjs(proyecto.fecha_fin_programada).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: INEMEC_RED,
          borderColor: INEMEC_RED,
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'project', proyecto }
        })

        // Add task events in lighter red
        if (showTareasNT) {
          proyecto.tareas?.forEach(tarea => {
            events.push({
              id: `task-${proyecto.id}-${tarea.id}`,
              title: `  ${tarea.nombre}${tarea.asignado_nombre ? ` (${tarea.asignado_nombre.split(' ')[0]})` : ''}`,
              start: tarea.fecha_inicio,
              end: dayjs(tarea.fecha_fin).add(1, 'day').format('YYYY-MM-DD'),
              allDay: true,
              backgroundColor: INEMEC_RED_LIGHT,
              borderColor: 'transparent',
              textColor: '#fff',
              display: 'block',
              extendedProps: { type: 'task', tarea, proyecto }
            })
          })
        }
      })
    }

    // Add TI ticket events (only closed/transferred tickets)
    if (showTicketsTI) {
      ticketsTI.forEach(ticket => {
        if (filterPrioridad && ticket.prioridad !== filterPrioridad) {
          return
        }

        // Show on closure date
        const closureDate = ticket.actualizado_en || ticket.creado_en
        const isSuccess = ticket.estado === 'solucionado'
        const color = isSuccess ? entityColors.solucionado : entityColors.noRealizado

        events.push({
          id: `ticket-${ticket.id}`,
          title: `${ticket.codigo}: ${ticket.titulo}`,
          start: dayjs(closureDate).format('YYYY-MM-DD'),
          end: dayjs(closureDate).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'ticket', ticket }
        })
      })
    }

    // Add NT solicitudes events (only closed)
    if (showSolicitudesNT) {
      solicitudesNT.forEach(solicitud => {
        if (filterPrioridad && solicitud.prioridad !== filterPrioridad) {
          return
        }

        // Show on closure date
        const closureDate = solicitud.actualizado_en || solicitud.creado_en
        const isSuccess = solicitud.estado === 'resuelto'
        const color = isSuccess ? entityColors.solucionado : entityColors.noRealizado

        events.push({
          id: `solicitud-${solicitud.id}`,
          title: `${solicitud.codigo}: ${solicitud.titulo}`,
          start: dayjs(closureDate).format('YYYY-MM-DD'),
          end: dayjs(closureDate).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'solicitud', solicitud }
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
      const estadoLabel = extendedProps.ticket.estado === 'solucionado' ? 'Solucionado' :
                          extendedProps.ticket.estado === 'transferido_nt' ? 'Transferido a NT' : 'No Realizado'
      return (
        <Tooltip title={
          <div>
            <div><strong>{extendedProps.ticket.codigo}</strong></div>
            <div>{extendedProps.ticket.titulo}</div>
            <div>Estado: {estadoLabel}</div>
            <div>Cerrado: {dayjs(extendedProps.ticket.actualizado_en).format('DD/MM/YYYY')}</div>
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

    if (extendedProps.type === 'solicitud') {
      return (
        <Tooltip title={
          <div>
            <div><strong>{extendedProps.solicitud.codigo}</strong></div>
            <div>{extendedProps.solicitud.titulo}</div>
            <div>Tipo: {extendedProps.solicitud.tipo}</div>
            <div>Estado: {extendedProps.solicitud.estado === 'resuelto' ? 'Resuelto' :
                         extendedProps.solicitud.estado === 'no_realizado' ? 'No Realizado' : 'Transferido'}</div>
            <div>Cerrado: {dayjs(extendedProps.solicitud.actualizado_en).format('DD/MM/YYYY')}</div>
          </div>
        }>
          <div style={{
            padding: '2px 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11
          }}>
            <FileTextOutlined style={{ marginRight: 4 }} />
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
    lastLoadedRange.current = null
    setInitialLoading(true)
    loadData(dateRangeRef.current)
  }

  // Derived data for sections
  const projectsInDevelopment = proyectos.filter(p => p.estado === 'en_desarrollo' || p.estado === 'pausado')
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

            {/* Pending Approvals - Fixed table */}
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
                  scroll={{ x: 500 }}
                  columns={[
                    {
                      title: 'Código',
                      dataIndex: 'codigo',
                      width: 120,
                      fixed: 'left',
                      render: (codigo, record) => (
                        <Link to={`/gerencia/aprobaciones/${record.codigo}`}>
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
                      width: 100,
                      render: (p) => <Tag color={prioridadColors[p]}>{p?.toUpperCase()}</Tag>
                    },
                    {
                      title: 'Acción',
                      width: 100,
                      fixed: 'right',
                      render: (_, record) => (
                        <Link to={`/gerencia/aprobaciones/${record.codigo}`}>
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
                  <RocketOutlined style={{ color: INEMEC_RED }} />
                  <span>Proyectos en Desarrollo</span>
                  <Badge
                    count={projectsInDevelopment.length}
                    style={{ backgroundColor: INEMEC_RED }}
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
                      const totalTareas = proyecto.tareas?.length || 0

                      // Calculate practical progress (weighted average by duration)
                      let progresoPractico = 0
                      if (totalTareas > 0) {
                        const totalPesoProgreso = proyecto.tareas.reduce((sum, t) =>
                          sum + ((t.progreso || 0) * (t.duracion_dias || t.duracion || 1)), 0)
                        const totalPeso = proyecto.tareas.reduce((sum, t) =>
                          sum + (t.duracion_dias || t.duracion || 1), 0)
                        if (totalPeso > 0) {
                          progresoPractico = Math.round(totalPesoProgreso / totalPeso)
                        }
                      }

                      // Calculate theoretical progress (days in development / planned days)
                      let progresoTeorico = 0
                      if (proyecto.fecha_inicio_desarrollo && proyecto.fecha_inicio_programada && proyecto.fecha_fin_programada) {
                        const diasPlanificados = dayjs(proyecto.fecha_fin_programada).diff(dayjs(proyecto.fecha_inicio_programada), 'day')
                        const diasPausados = proyecto.dias_pausados_total || 0
                        const diasEnDesarrollo = Math.max(0, dayjs().diff(dayjs(proyecto.fecha_inicio_desarrollo), 'day') - diasPausados)
                        if (diasPlanificados > 0) {
                          progresoTeorico = Math.min(100, Math.round((diasEnDesarrollo / diasPlanificados) * 100))
                        }
                      } else if (proyecto.fecha_inicio_programada && proyecto.fecha_fin_programada) {
                        // Fallback for projects without inicio_desarrollo
                        const inicio = dayjs(proyecto.fecha_inicio_programada)
                        const fin = dayjs(proyecto.fecha_fin_programada)
                        const hoy = dayjs()
                        const totalDias = fin.diff(inicio, 'day')
                        const diasTranscurridos = hoy.diff(inicio, 'day')
                        if (totalDias > 0) {
                          progresoTeorico = Math.min(100, Math.max(0, Math.round((diasTranscurridos / totalDias) * 100)))
                        }
                      }

                      const diasRestantes = proyecto.fecha_fin_programada
                        ? dayjs(proyecto.fecha_fin_programada).diff(dayjs(), 'day')
                        : null
                      const isOverdue = diasRestantes !== null && diasRestantes < 0
                      const isUrgent = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7
                      const isPaused = proyecto.estado === 'pausado'

                      return (
                        <Card
                          key={proyecto.id}
                          size="small"
                          style={{
                            backgroundColor: isPaused ? '#fffbe6' : isOverdue ? '#fff2f0' : isUrgent ? '#fffbe6' : '#fafafa',
                            border: isPaused ? '1px solid #ffe58f' : isOverdue ? '1px solid #ffccc7' : isUrgent ? '1px solid #ffe58f' : '1px solid #f0f0f0'
                          }}
                        >
                          <Row gutter={[16, 8]}>
                            <Col span={24}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <Link to={`/nt/proyectos/${proyecto.codigo}`}>
                                    <Text strong style={{ color: INEMEC_RED, fontSize: 14 }}>
                                      {proyecto.codigo}
                                    </Text>
                                  </Link>
                                  <Text style={{ marginLeft: 8 }}>{proyecto.titulo}</Text>
                                  {isPaused && (
                                    <Tag color="warning" style={{ marginLeft: 8 }}>PAUSADO</Tag>
                                  )}
                                </div>
                                <Tag color={prioridadColors[proyecto.prioridad]}>
                                  {proyecto.prioridad?.toUpperCase()}
                                </Tag>
                              </div>
                            </Col>

                            {/* Two progress bars */}
                            <Col span={16}>
                              <Row gutter={[0, 4]}>
                                <Col span={24}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tooltip title="Días en desarrollo / Días planificados">
                                      <Text type="secondary" style={{ fontSize: 11, minWidth: 55 }}>Teórico</Text>
                                    </Tooltip>
                                    <Progress
                                      percent={progresoTeorico}
                                      size="small"
                                      showInfo={false}
                                      strokeColor="#8c8c8c"
                                      style={{ flex: 1, margin: 0 }}
                                    />
                                    <Text style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{progresoTeorico}%</Text>
                                  </div>
                                </Col>
                                <Col span={24}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tooltip title="Promedio ponderado de progreso de tareas">
                                      <Text type="secondary" style={{ fontSize: 11, minWidth: 55 }}>Práctico</Text>
                                    </Tooltip>
                                    <Progress
                                      percent={progresoPractico}
                                      size="small"
                                      showInfo={false}
                                      strokeColor={isOverdue ? '#ff4d4f' : INEMEC_RED}
                                      style={{ flex: 1, margin: 0 }}
                                    />
                                    <Text style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{progresoPractico}%</Text>
                                  </div>
                                </Col>
                              </Row>
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
                            <Link to={`/nt/proyectos/${proyecto.codigo}`}>
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
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
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

                {/* Proyectos NT with tasks dropdown */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text>Mostrar Proyectos de NT</Text>
                    <Switch checked={showProyectosNT} onChange={setShowProyectosNT} />
                  </div>
                  {showProyectosNT && (
                    <Select
                      style={{ width: '100%' }}
                      value={showTareasNT ? 'con_tareas' : 'sin_tareas'}
                      onChange={(val) => setShowTareasNT(val === 'con_tareas')}
                    >
                      <Select.Option value="con_tareas">Con tareas</Select.Option>
                      <Select.Option value="sin_tareas">Sin tareas</Select.Option>
                    </Select>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Solicitudes de NT</Text>
                  <Switch checked={showSolicitudesNT} onChange={setShowSolicitudesNT} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Tickets TI</Text>
                  <Switch checked={showTicketsTI} onChange={setShowTicketsTI} />
                </div>
              </Space>
            </Card>

            {/* Legend */}
            <Card size="small" title="Leyenda">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 12 }}>Proyectos NT:</Text>
                <Space wrap>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: INEMEC_RED, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>Proyecto</Text>
                  </Space>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: INEMEC_RED_LIGHT, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>Tarea</Text>
                  </Space>
                </Space>

                <Text strong style={{ fontSize: 12, marginTop: 8 }}>Tickets TI / Solicitudes NT (cerrados):</Text>
                <Space wrap>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: entityColors.solucionado, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>Solucionado/Resuelto</Text>
                  </Space>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: entityColors.noRealizado, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>No Realizado/Transferido</Text>
                  </Space>
                </Space>

                <Text strong style={{ fontSize: 12, marginTop: 8 }}>Otros:</Text>
                <Space wrap>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: '#ff4d4f33', border: '1px solid #ff4d4f', borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>Festivo</Text>
                  </Space>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}

export default CalendarioGeneral
