import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Row, Col, Typography, Tag, Space, Spin, Select, Switch,
  Tooltip, message, Button
} from 'antd'
import {
  CalendarOutlined, ToolOutlined, FilterOutlined, ReloadOutlined
} from '@ant-design/icons'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ticketsApi, calendarioApi } from '../../services/api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Title, Text } = Typography

// Colors
const entityColors = {
  solucionado: '#52c41a',
  noRealizado: '#fa8c16'
}

const prioridadColors = {
  critica: '#ff4d4f',
  alta: '#fa8c16',
  media: '#1890ff',
  baja: '#52c41a'
}

function TICalendario() {
  const calendarRef = useRef(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const lastLoadedRange = useRef(null)

  // Data states
  const [tickets, setTickets] = useState([])
  const [festivos, setFestivos] = useState([])

  // Filter states
  const [showSolucionados, setShowSolucionados] = useState(true)
  const [showNoRealizados, setShowNoRealizados] = useState(true)
  const [showTransferidos, setShowTransferidos] = useState(true)
  const [filterPrioridad, setFilterPrioridad] = useState(null)
  const [filterCategoria, setFilterCategoria] = useState(null)

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

      const [ticketsRes, festivosRes] = await Promise.all([
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

      setTickets(ticketsRes.data.tickets || [])
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

    // Add TI ticket events (only closed/transferred tickets)
    tickets.forEach(ticket => {
      // Filter by estado visibility
      if (ticket.estado === 'solucionado' && !showSolucionados) return
      if (ticket.estado === 'no_realizado' && !showNoRealizados) return
      if (ticket.estado === 'transferido_nt' && !showTransferidos) return

      // Filter by priority
      if (filterPrioridad && ticket.prioridad !== filterPrioridad) return

      // Filter by category
      if (filterCategoria && ticket.categoria !== filterCategoria) return

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
            <div>Categoría: {extendedProps.ticket.categoria}</div>
            <div>Estado: {estadoLabel}</div>
            <div>Prioridad: {extendedProps.ticket.prioridad}</div>
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

    return null
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
          Calendario TI
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
                  <Text type="secondary" style={{ fontSize: 12 }}>Categoría:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Todas las categorías"
                    allowClear
                    value={filterCategoria}
                    onChange={setFilterCategoria}
                  >
                    <Select.Option value="hardware">Hardware</Select.Option>
                    <Select.Option value="software">Software</Select.Option>
                    <Select.Option value="red">Red</Select.Option>
                    <Select.Option value="acceso">Acceso</Select.Option>
                    <Select.Option value="soporte_general">Soporte General</Select.Option>
                    <Select.Option value="otro">Otro</Select.Option>
                  </Select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Solucionados</Text>
                  <Switch checked={showSolucionados} onChange={setShowSolucionados} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>No Realizados</Text>
                  <Switch checked={showNoRealizados} onChange={setShowNoRealizados} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>Transferidos a NT</Text>
                  <Switch checked={showTransferidos} onChange={setShowTransferidos} />
                </div>
              </Space>
            </Card>

            {/* Legend */}
            <Card size="small" title="Leyenda">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 12 }}>Tickets (cerrados):</Text>
                <Space wrap>
                  <Space size={4}>
                    <div style={{ width: 14, height: 14, backgroundColor: entityColors.solucionado, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>Solucionado</Text>
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

export default TICalendario
