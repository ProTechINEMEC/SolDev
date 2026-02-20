import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Row, Col, Typography, Tag, Space, Spin, Select, Switch,
  Tooltip, message, Button
} from 'antd'
import {
  CalendarOutlined, ProjectOutlined, FilterOutlined, ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { calendarioApi, solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Title, Text } = Typography

// INEMEC Brand Colors
const INEMEC_RED = '#D52B1E'
const INEMEC_RED_LIGHT = '#E85A50'

// Colors
const entityColors = {
  proyecto: INEMEC_RED,
  tarea: INEMEC_RED_LIGHT,
  solucionado: '#52c41a',
  noRealizado: '#fa8c16'
}

const prioridadColors = {
  critica: '#ff4d4f',
  alta: '#fa8c16',
  media: '#1890ff',
  baja: '#52c41a'
}

function NTCalendario() {
  const calendarRef = useRef(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const lastLoadedRange = useRef(null)

  // Data states
  const [proyectos, setProyectos] = useState([])
  const [solicitudesNT, setSolicitudesNT] = useState([])
  const [festivos, setFestivos] = useState([])

  // Filter states
  const [showProyectos, setShowProyectos] = useState(true)
  const [showTareas, setShowTareas] = useState(true)
  const [showSolicitudes, setShowSolicitudes] = useState(true)
  const [filterPrioridad, setFilterPrioridad] = useState(null)

  // Calendar view range
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

      const [proyectosRes, festivosRes] = await Promise.all([
        calendarioApi.getProyectosConTareas({
          fecha_inicio: range.start,
          fecha_fin: range.end
        }),
        calendarioApi.getFestivos({
          year_start: startYear,
          year_end: endYear
        })
      ])

      setProyectos(proyectosRes.data.proyectos || [])
      setSolicitudesNT(solicitudesNTRes.data.solicitudes || [])
      setFestivos(festivosRes.data.festivos || [])
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
    if (showProyectos) {
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
        if (showTareas) {
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

    // Add NT solicitudes events (only closed)
    if (showSolicitudes) {
      solicitudesNT.forEach(solicitud => {
        if (filterPrioridad && solicitud.prioridad !== filterPrioridad) {
          return
        }

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

  const handleRefresh = () => {
    lastLoadedRange.current = null
    setInitialLoading(true)
    loadData(dateRangeRef.current)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 12 }} />
          Calendario NT
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
            <Card size="small">
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
                      <Tag color="red">Crítica</Tag>
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

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text>Mostrar Proyectos</Text>
                    <Switch checked={showProyectos} onChange={setShowProyectos} />
                  </div>
                  {showProyectos && (
                    <Select
                      style={{ width: '100%' }}
                      value={showTareas ? 'con_tareas' : 'sin_tareas'}
                      onChange={(val) => setShowTareas(val === 'con_tareas')}
                    >
                      <Select.Option value="con_tareas">Con tareas</Select.Option>
                      <Select.Option value="sin_tareas">Sin tareas</Select.Option>
                    </Select>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Solicitudes Cerradas</Text>
                  <Switch checked={showSolicitudes} onChange={setShowSolicitudes} />
                </div>
              </Space>
            </Card>

            {/* Legend */}
            <Card size="small" title="Leyenda">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 12 }}>Proyectos:</Text>
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

                <Text strong style={{ fontSize: 12, marginTop: 8 }}>Solicitudes (cerradas):</Text>
                <Space wrap>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: entityColors.solucionado, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>Resuelto</Text>
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

export default NTCalendario
