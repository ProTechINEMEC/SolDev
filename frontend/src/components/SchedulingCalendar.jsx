import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Modal, Card, Row, Col, Typography, Tag, Alert, Button, Space, Spin,
  Tooltip, Divider, List, Badge, DatePicker, message
} from 'antd'
import {
  CalendarOutlined, TeamOutlined, WarningOutlined, CheckCircleOutlined,
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

function SchedulingCalendar({ visible, onClose, solicitud, onSchedule }) {
  const calendarRef = useRef(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const lastLoadedRange = useRef(null)

  // Data states
  const [proyectos, setProyectos] = useState([])
  const [equipoCarga, setEquipoCarga] = useState([])
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

      const [proyectosRes, equipoRes, festivosRes] = await Promise.all([
        calendarioApi.getProyectosConTareas({
          fecha_inicio: range.start,
          fecha_fin: range.end
        }),
        calendarioApi.getEquipoCarga({
          fecha_inicio: range.start,
          fecha_fin: range.end,
          solicitud_id: solicitud?.id
        }),
        calendarioApi.getFestivos({
          year_start: startYear,
          year_end: endYear
        })
      ])

      setProyectos(proyectosRes.data.proyectos || [])
      setEquipoCarga(equipoRes.data.equipo || [])
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
      await solicitudesApi.agendar(solicitud.id, {
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

  // Build calendar events from existing projects
  const buildCalendarEvents = () => {
    const events = []

    // Add existing project events
    proyectos.forEach(proyecto => {
      // Add main project bar
      events.push({
        id: `project-${proyecto.id}`,
        title: `${proyecto.codigo}: ${proyecto.titulo}`,
        start: proyecto.fecha_inicio_programada,
        end: dayjs(proyecto.fecha_fin_programada).add(1, 'day').format('YYYY-MM-DD'),
        allDay: true,
        backgroundColor: prioridadColors[proyecto.prioridad] || '#1890ff',
        borderColor: prioridadColors[proyecto.prioridad] || '#1890ff',
        textColor: '#fff',
        display: 'block',
        extendedProps: { type: 'project', proyecto }
      })

      // Add task events
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
    })

    // Add preview events if we have a preview
    if (preview) {
      events.push({
        id: 'preview-project',
        title: `[NUEVO] ${preview.proyecto.codigo}: ${preview.proyecto.titulo}`,
        start: preview.proyecto.fecha_inicio,
        end: dayjs(preview.proyecto.fecha_fin).add(1, 'day').format('YYYY-MM-DD'),
        allDay: true,
        backgroundColor: '#722ed1',
        borderColor: '#722ed1',
        textColor: '#fff',
        display: 'block',
        extendedProps: { type: 'preview-project' }
      })

      preview.tareas?.forEach(tarea => {
        events.push({
          id: `preview-task-${tarea.id}`,
          title: `  [NUEVO] ${tarea.nombre}${tarea.asignado_nombre ? ` (${tarea.asignado_nombre.split(' ')[0]})` : ''}`,
          start: tarea.fecha_inicio,
          end: dayjs(tarea.fecha_fin).add(1, 'day').format('YYYY-MM-DD'),
          allDay: true,
          backgroundColor: '#b37feb',
          borderColor: 'transparent',
          textColor: '#fff',
          display: 'block',
          extendedProps: { type: 'preview-task', tarea }
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
                height={500}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={4}
                weekends={false}
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: '08:00',
                  endTime: '18:00'
                }}
                datesSet={handleDatesSet}
              />
            </Card>

            {/* Team Workload */}
            <Card size="small" title={<><TeamOutlined /> Carga del Equipo NT</>} style={{ marginTop: 16 }}>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {equipoCarga.length === 0 ? (
                  <Text type="secondary">No hay miembros del equipo</Text>
                ) : (
                  <List
                    size="small"
                    dataSource={equipoCarga}
                    renderItem={miembro => (
                      <List.Item>
                        <List.Item.Meta
                          title={miembro.nombre}
                          description={
                            miembro.tareas.length === 0
                              ? <Tag color="green">Disponible</Tag>
                              : <Space wrap>
                                  {miembro.tareas.slice(0, 3).map(t => (
                                    <Tooltip
                                      key={t.id}
                                      title={`${t.proyecto_codigo}: ${t.nombre} (${dayjs(t.fecha_inicio).format('DD/MM')} - ${dayjs(t.fecha_fin).format('DD/MM')})`}
                                    >
                                      <Tag color="blue">{t.proyecto_codigo}</Tag>
                                    </Tooltip>
                                  ))}
                                  {miembro.tareas.length > 3 && (
                                    <Tag>+{miembro.tareas.length - 3} más</Tag>
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
                <DatePicker
                  value={selectedDate ? dayjs(selectedDate) : null}
                  onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : null)}
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  placeholder="Seleccione fecha de inicio"
                  disabledDate={(current) => {
                    // Disable weekends, past dates, and holidays
                    const day = current.day()
                    const dateStr = current.format('YYYY-MM-DD')
                    const isHoliday = festivos.some(f => f.fecha === dateStr)
                    return current < dayjs().startOf('day') || day === 0 || day === 6 || isHoliday
                  }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Solo días hábiles (lunes a viernes, sin festivos)
                </Text>
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
                    <div>
                      <Text type="secondary">Equipo asignado:</Text>
                      <div style={{ marginTop: 4 }}>
                        {getAssignedTeam().map(m => (
                          <Tag key={m.id} color="purple">{m.nombre}</Tag>
                        ))}
                        {getAssignedTeam().length === 0 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>Sin asignaciones</Text>
                        )}
                      </div>
                    </div>
                  </Space>
                </Card>

                {/* Warnings */}
                {preview.warnings && preview.warnings.length > 0 && (
                  <Alert
                    type="warning"
                    icon={<WarningOutlined />}
                    message="Advertencias de Sobrecarga"
                    description={
                      <List
                        size="small"
                        dataSource={preview.warnings}
                        renderItem={w => (
                          <List.Item style={{ padding: '4px 0', border: 'none' }}>
                            <Text type="warning" style={{ fontSize: 12 }}>
                              {w.mensaje}
                            </Text>
                          </List.Item>
                        )}
                      />
                    }
                    style={{ marginBottom: 16 }}
                  />
                )}

                {/* Actions */}
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<CheckCircleOutlined />}
                    onClick={handleConfirmSchedule}
                    loading={scheduling}
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
