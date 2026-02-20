import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Modal, Card, Row, Col, Typography, Tag, Alert, Button, Space, Spin,
  Tooltip, Divider, List, DatePicker, message
} from 'antd'
import {
  CalendarOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ProjectOutlined
} from '@ant-design/icons'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { calendarioApi, solicitudesApi } from '../services/api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Text, Paragraph } = Typography

// Colors for the new project and its tasks (INEMEC brand colors)
const NEW_PROJECT_COLOR = '#D52B1E'  // INEMEC primary red
const NEW_TASK_COLOR = '#E85A50'     // Lighter INEMEC red for tasks
const EXISTING_PROJECT_COLOR = '#8c8c8c'  // Gray for existing projects

const prioridadColors = {
  critica: '#ff4d4f',
  alta: '#fa8c16',
  media: '#1890ff',
  baja: '#52c41a'
}

function SchedulingCalendar({ visible, onClose, solicitud, evaluacion, onSchedule }) {
  const calendarRef = useRef(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const lastLoadedRange = useRef(null)

  // Data states
  const [proyectos, setProyectos] = useState([])
  const [festivos, setFestivos] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [preview, setPreview] = useState(null)

  // Calendar view range - use ref to avoid re-renders
  const dateRangeRef = useRef({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().add(3, 'month').endOf('month').format('YYYY-MM-DD')
  })

  // Initial load when modal opens
  useEffect(() => {
    if (visible) {
      setInitialLoading(true)
      setSelectedDate(null)
      setPreview(null)
      lastLoadedRange.current = null
      loadData(dateRangeRef.current)
    }
  }, [visible])

  useEffect(() => {
    if (selectedDate && solicitud) {
      loadPreview()
    } else {
      setPreview(null)
    }
  }, [selectedDate])

  const loadData = async (range) => {
    // Check if we already loaded this range
    const rangeKey = `${range.start}-${range.end}`
    if (lastLoadedRange.current === rangeKey) {
      return
    }
    lastLoadedRange.current = rangeKey

    try {
      const startYear = dayjs(range.start).year()
      const endYear = dayjs(range.end).year()

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
      setFestivos(festivosRes.data.festivos || [])
    } catch (error) {
      console.error('Error loading calendar data:', error)
      message.error('Error al cargar datos del calendario')
    } finally {
      setInitialLoading(false)
    }
  }

  // Debounced handler for date range changes
  const handleDatesSet = useCallback((dateInfo) => {
    const newRange = {
      start: dayjs(dateInfo.start).format('YYYY-MM-DD'),
      end: dayjs(dateInfo.end).format('YYYY-MM-DD')
    }
    dateRangeRef.current = newRange
    loadData(newRange)
  }, [solicitud?.id])

  const loadPreview = async () => {
    if (!selectedDate || !solicitud) return

    setPreviewing(true)
    try {
      const res = await calendarioApi.preview({
        solicitud_id: solicitud.id,
        fecha_inicio: selectedDate
      })
      setPreview(res.data)
    } catch (error) {
      console.error('Error loading preview:', error)
      message.error('Error al generar vista previa')
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  const handleDateClick = (info) => {
    const clickedDate = info.dateStr
    const clickedDay = dayjs(clickedDate)

    // Don't allow past dates
    if (clickedDay.isBefore(dayjs(), 'day')) {
      message.warning('No puede programar en fechas pasadas')
      return
    }

    // Don't allow weekends
    const day = clickedDay.day()
    if (day === 0 || day === 6) {
      message.warning('No puede programar en fines de semana')
      return
    }

    // Don't allow holidays
    const isHoliday = festivos.some(f => f.fecha === clickedDate)
    if (isHoliday) {
      const holiday = festivos.find(f => f.fecha === clickedDate)
      message.warning(`No puede programar en día festivo: ${holiday?.nombre}`)
      return
    }

    setSelectedDate(clickedDate)
  }

  const handleConfirmSchedule = async () => {
    if (!preview || !selectedDate) return

    setScheduling(true)
    try {
      await solicitudesApi.agendar(solicitud.codigo, {
        fecha_inicio: preview.proyecto.fecha_inicio,
        fecha_fin: preview.proyecto.fecha_fin,
        comentario: `Agendado desde el calendario. Duración: ${preview.proyecto.duracion_dias_habiles} días hábiles.`
      })

      message.success('Proyecto agendado exitosamente')
      onSchedule && onSchedule({
        fecha_inicio: preview.proyecto.fecha_inicio,
        fecha_fin: preview.proyecto.fecha_fin
      })
      onClose()
    } catch (error) {
      console.error('Error scheduling:', error)
      message.error(error.response?.data?.message || 'Error al agendar proyecto')
    } finally {
      setScheduling(false)
    }
  }

  // Build calendar events
  const buildCalendarEvents = () => {
    const events = []

    // Add existing projects as GRAY bars (no tasks shown)
    proyectos.forEach(proyecto => {
      events.push({
        id: `project-${proyecto.id}`,
        title: `${proyecto.codigo}: ${proyecto.titulo}`,
        start: proyecto.fecha_inicio_programada,
        end: dayjs(proyecto.fecha_fin_programada).add(1, 'day').format('YYYY-MM-DD'),
        allDay: true,
        backgroundColor: EXISTING_PROJECT_COLOR,
        borderColor: EXISTING_PROJECT_COLOR,
        textColor: '#fff',
        display: 'block',
        extendedProps: { type: 'project', proyecto }
      })
      // Note: We intentionally don't add task events for existing projects
    })

    // Add preview events if we have a preview (new project in RED)
    if (preview) {
      // Main project bar in RED
      events.push({
        id: 'preview-project',
        title: `${preview.proyecto.codigo}: ${preview.proyecto.titulo}`,
        start: preview.proyecto.fecha_inicio,
        end: dayjs(preview.proyecto.fecha_fin).add(1, 'day').format('YYYY-MM-DD'),
        allDay: true,
        backgroundColor: NEW_PROJECT_COLOR,
        borderColor: NEW_PROJECT_COLOR,
        textColor: '#fff',
        display: 'block',
        extendedProps: { type: 'preview-project' }
      })

      // Add preview task events in LIGHTER RED
      preview.tareas?.forEach(tarea => {
        events.push({
          id: `preview-task-${tarea.id}`,
          title: `${tarea.nombre}${tarea.asignado_nombre ? ` (${tarea.asignado_nombre.split(' ')[0]})` : ''}`,
          start: tarea.fecha_inicio,
          end: dayjs(tarea.fecha_fin).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: NEW_TASK_COLOR,
          borderColor: NEW_TASK_COLOR,
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'preview-task', tarea, fase: tarea.fase }
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

  // Get team members who would be assigned to this project
  const getAssignedTeam = () => {
    if (!preview) return []
    const assigned = preview.tareas
      .filter(t => t.asignado_id)
      .map(t => ({ id: t.asignado_id, nombre: t.asignado_nombre }))
    // Unique by id
    return [...new Map(assigned.map(m => [m.id, m])).values()]
  }

  return (
    <Modal
      title={
        <Space>
          <CalendarOutlined />
          <span>Programar Proyecto: {solicitud?.codigo}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      destroyOnClose
    >
      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Cargando calendario...</div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {/* Calendar Column */}
          <Col xs={24} lg={16}>
            <Card size="small" title="Calendario de Proyectos" extra={
              <Text type="secondary">Haga clic en una fecha para programar</Text>
            }>
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
                dateClick={handleDateClick}
                eventClick={(info) => {
                  // Could show project details on click
                }}
                height={550}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={5}
                weekends={false}
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: '08:00',
                  endTime: '18:00'
                }}
                datesSet={handleDatesSet}
              />

              {/* Legend */}
              <div style={{ marginTop: 12, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Space size={4}>
                  <div style={{ width: 12, height: 12, backgroundColor: NEW_PROJECT_COLOR, borderRadius: 2 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Nuevo Proyecto</Text>
                </Space>
                <Space size={4}>
                  <div style={{ width: 12, height: 12, backgroundColor: NEW_TASK_COLOR, borderRadius: 2 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Tareas del Nuevo Proyecto</Text>
                </Space>
                <Space size={4}>
                  <div style={{ width: 12, height: 12, backgroundColor: EXISTING_PROJECT_COLOR, borderRadius: 2 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Proyectos Existentes</Text>
                </Space>
              </div>
            </Card>
          </Col>

          {/* Scheduling Panel */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              title={<><ProjectOutlined /> Detalles del Proyecto</>}
              style={{ marginBottom: 16 }}
            >
              <Paragraph>
                <Text strong>{solicitud?.titulo}</Text>
              </Paragraph>
              <Space direction="vertical" size="small">
                <Text type="secondary">
                  <ClockCircleOutlined /> Prioridad:{' '}
                  <Tag color={prioridadColors[solicitud?.prioridad]}>{solicitud?.prioridad?.toUpperCase()}</Tag>
                </Text>
              </Space>
            </Card>

            {/* Date Selection */}
            <Card
              size="small"
              title="Seleccionar Fecha de Inicio"
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <DatePicker
                    value={selectedDate ? dayjs(selectedDate) : null}
                    onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : null)}
                    format="DD/MM/YYYY"
                    style={{ flex: 1 }}
                    placeholder="Seleccione fecha de inicio"
                    disabledDate={(current) => {
                      // Disable weekends, past dates, and holidays
                      const day = current.day()
                      const dateStr = current.format('YYYY-MM-DD')
                      const isHoliday = festivos.some(f => f.fecha === dateStr)
                      return current < dayjs().startOf('day') || day === 0 || day === 6 || isHoliday
                    }}
                  />
                  {evaluacion?.fecha_inicio_posible && (
                    <Tooltip title={`Fecha sugerida por NT: ${dayjs(evaluacion.fecha_inicio_posible).format('DD/MM/YYYY')}`}>
                      <Button
                        type="default"
                        onClick={() => setSelectedDate(evaluacion.fecha_inicio_posible)}
                      >
                        Usar Fecha Recomendada
                      </Button>
                    </Tooltip>
                  )}
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Solo días hábiles (lunes a viernes, sin festivos colombianos)
                </Text>
                {evaluacion?.fecha_inicio_posible && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    NT recomienda: <Text strong>{dayjs(evaluacion.fecha_inicio_posible).format('DD/MM/YYYY')}</Text>
                  </Text>
                )}
              </Space>
            </Card>

            {/* Preview */}
            {previewing && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spin />
                  <div style={{ marginTop: 8 }}>Calculando fechas...</div>
                </div>
              </Card>
            )}

            {preview && !previewing && (
              <>
                <Card
                  size="small"
                  title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> Vista Previa</>}
                  style={{ marginBottom: 16 }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">Fecha Inicio:</Text>
                      <Text strong style={{ marginLeft: 8 }}>
                        {dayjs(preview.proyecto.fecha_inicio).format('dddd, DD MMMM YYYY')}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">Fecha Fin:</Text>
                      <Text strong style={{ marginLeft: 8 }}>
                        {dayjs(preview.proyecto.fecha_fin).format('dddd, DD MMMM YYYY')}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">Duración:</Text>
                      <Text strong style={{ marginLeft: 8 }}>
                        {preview.proyecto.duracion_dias_habiles} días hábiles
                      </Text>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />

                    {/* Phase breakdown */}
                    {(() => {
                      const fases = [...new Set(preview.tareas?.map(t => t.fase).filter(Boolean) || [])]
                      if (fases.length === 0) return null
                      return (
                        <div>
                          <Text type="secondary">Fases del cronograma:</Text>
                          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {fases.map((fase, index) => (
                              <Tag key={fase} style={{ margin: 0 }}>
                                {fase}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Task list */}
                    {preview.tareas?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">Tareas ({preview.tareas.length}):</Text>
                        <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                          <List
                            size="small"
                            dataSource={preview.tareas}
                            renderItem={(tarea) => (
                              <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                <Space size={4}>
                                  <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: NEW_TASK_COLOR
                                  }} />
                                  <Text style={{ fontSize: 11 }}>
                                    {tarea.nombre} ({tarea.duracion_dias}d)
                                  </Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <Text type="secondary">Equipo asignado:</Text>
                      <div style={{ marginTop: 4 }}>
                        {getAssignedTeam().map(m => (
                          <Tag key={m.id} color="red">{m.nombre}</Tag>
                        ))}
                        {getAssignedTeam().length === 0 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>Sin asignaciones</Text>
                        )}
                      </div>
                    </div>
                  </Space>
                </Card>

                {/* Actions */}
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<CheckCircleOutlined />}
                    onClick={handleConfirmSchedule}
                    loading={scheduling}
                    danger
                  >
                    Confirmar y Agendar
                  </Button>
                  <Button
                    block
                    onClick={() => {
                      setSelectedDate(null)
                      setPreview(null)
                    }}
                  >
                    Cancelar Selección
                  </Button>
                </Space>
              </>
            )}

            {!selectedDate && !preview && (
              <Alert
                type="info"
                message="Seleccione una fecha"
                description="Haga clic en una fecha del calendario o use el selector arriba para ver cómo quedaría programado el proyecto."
              />
            )}
          </Col>
        </Row>
      )}
    </Modal>
  )
}

export default SchedulingCalendar
