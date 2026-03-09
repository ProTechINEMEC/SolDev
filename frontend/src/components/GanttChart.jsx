import { useState, useMemo, useRef, useCallback } from 'react'
import { Popover, Slider, Typography, Tag, Space, Tooltip, Empty, Select, Button } from 'antd'
import { UserOutlined, WarningOutlined, CheckOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Text } = Typography

const INEMEC_RED = '#D52B1E'

const PHASE_COLORS = {
  'Análisis': '#1890ff',
  'Analisis': '#1890ff',
  'analisis': '#1890ff',
  'Diseño': '#722ed1',
  'Diseno': '#722ed1',
  'diseno': '#722ed1',
  'Desarrollo': '#13c2c2',
  'desarrollo': '#13c2c2',
  'Pruebas': '#fa8c16',
  'pruebas': '#fa8c16',
  'Documentación': '#52c41a',
  'Documentacion': '#52c41a',
  'documentacion': '#52c41a',
  'Entrega': '#eb2f96',
  'entrega': '#eb2f96',
  'Tareas Emergentes': '#fa541c',
  'Sin Fase': '#8c8c8c'
}

const getPhaseColor = (fase) => PHASE_COLORS[fase] || '#1890ff'

function GanttChart({
  tareas = [],
  onProgressChange,
  onTaskUpdate,
  disabled = false,
  isLead = false,
  userId,
  holidays = [],
  members = [],
  planningMode = false
}) {
  const scrollRef = useRef(null)
  const [activeTask, setActiveTask] = useState(null)
  const [pendingProgress, setPendingProgress] = useState({})
  const [pendingMember, setPendingMember] = useState({})

  // Build a Set of holiday date strings for fast lookup
  const holidaySet = useMemo(() => new Set(holidays), [holidays])

  const isNonWorkday = useCallback((d) => {
    const day = d.day()
    if (day === 0 || day === 6) return 'weekend'
    if (holidaySet.has(d.format('YYYY-MM-DD'))) return 'holiday'
    return false
  }, [holidaySet])

  // Group tasks by phase
  const phases = useMemo(() => {
    const grouped = {}
    for (const t of tareas) {
      const fase = t.fase || 'Sin Fase'
      if (!grouped[fase]) grouped[fase] = []
      grouped[fase].push(t)
    }
    return grouped
  }, [tareas])

  // Calculate timeline bounds
  const { startDate, endDate, totalDays, dayWidth } = useMemo(() => {
    if (tareas.length === 0) return { startDate: dayjs(), endDate: dayjs(), totalDays: 1, dayWidth: 32 }

    const dates = tareas.flatMap(t => [
      t.fecha_inicio ? dayjs(t.fecha_inicio) : null,
      t.fecha_fin ? dayjs(t.fecha_fin) : null
    ]).filter(Boolean)

    if (dates.length === 0) return { startDate: dayjs(), endDate: dayjs(), totalDays: 1, dayWidth: 32 }

    let min = dates[0]
    let max = dates[0]
    for (const d of dates) {
      if (d.isBefore(min)) min = d
      if (d.isAfter(max)) max = d
    }

    const start = min.subtract(2, 'day')
    const end = max.add(3, 'day')
    const total = end.diff(start, 'day') + 1
    const width = total <= 30 ? 40 : total <= 60 ? 28 : total <= 120 ? 20 : 14

    return { startDate: start, endDate: end, totalDays: total, dayWidth: width }
  }, [tareas])

  // Build day columns
  const days = useMemo(() => {
    const result = []
    for (let i = 0; i < totalDays; i++) {
      result.push(startDate.add(i, 'day'))
    }
    return result
  }, [startDate, totalDays])

  // Month headers
  const months = useMemo(() => {
    const result = []
    let current = null
    for (let i = 0; i < days.length; i++) {
      const monthKey = days[i].format('YYYY-MM')
      if (monthKey !== current) {
        current = monthKey
        result.push({ label: days[i].format('MMM YYYY'), start: i, span: 1 })
      } else {
        result[result.length - 1].span++
      }
    }
    return result
  }, [days])

  const canEditTask = (task) => {
    if (disabled || planningMode) return false
    if (isLead) return true
    return task.asignado_id === userId
  }

  const handleConfirmUpdate = (taskId) => {
    const updates = {}
    if (pendingProgress[taskId] !== undefined) updates.progreso = pendingProgress[taskId]
    if (pendingMember[taskId] !== undefined) updates.asignado_id = pendingMember[taskId]

    if (Object.keys(updates).length > 0) {
      if (onTaskUpdate) {
        onTaskUpdate(taskId, updates)
      } else if (onProgressChange && updates.progreso !== undefined) {
        onProgressChange(taskId, updates.progreso)
      }
    }

    setPendingProgress(prev => { const n = { ...prev }; delete n[taskId]; return n })
    setPendingMember(prev => { const n = { ...prev }; delete n[taskId]; return n })
    setActiveTask(null)
  }

  if (tareas.length === 0) {
    return <Empty description="No hay tareas definidas" />
  }

  // Flatten tasks in phase order for rows
  const rows = []
  for (const [fase, tasks] of Object.entries(phases)) {
    rows.push({ type: 'phase', fase, count: tasks.length })
    for (const task of tasks) {
      rows.push({ type: 'task', task, fase })
    }
  }

  const LABEL_WIDTH = 280
  const ROW_HEIGHT = 40
  const HEADER_HEIGHT = 52

  const getDayBackground = (d) => {
    const type = isNonWorkday(d)
    if (type === 'holiday') return 'rgba(213,43,30,0.04)'
    if (type === 'weekend') return 'rgba(0,0,0,0.02)'
    return 'transparent'
  }

  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex' }}>
        {/* Left: Labels */}
        <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid #f0f0f0' }}>
          <div style={{ height: HEADER_HEIGHT, borderBottom: '1px solid #f0f0f0', padding: '8px 12px', display: 'flex', alignItems: 'flex-end' }}>
            <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>TAREAS</Text>
          </div>

          {rows.map((row, i) => {
            if (row.type === 'phase') {
              return (
                <div key={`phase-${row.fase}`} style={{
                  height: 28, display: 'flex', alignItems: 'center', padding: '0 12px',
                  background: '#fafafa', borderBottom: '1px solid #f0f0f0'
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: getPhaseColor(row.fase), marginRight: 8, flexShrink: 0
                  }} />
                  <Text strong style={{ fontSize: 12 }}>{row.fase}</Text>
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({row.count})</Text>
                </div>
              )
            }

            const { task } = row
            return (
              <div key={`task-${task.id}`} style={{
                height: ROW_HEIGHT, display: 'flex', alignItems: 'center',
                padding: '0 12px 0 28px', borderBottom: '1px solid #f5f5f5', cursor: 'default'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {task.es_emergente && (
                      <Tooltip title="Tarea emergente">
                        <WarningOutlined style={{ color: '#fa541c', fontSize: 11 }} />
                      </Tooltip>
                    )}
                    <Text ellipsis style={{ fontSize: 12, maxWidth: 160 }}>{task.titulo}</Text>
                  </div>
                  {task.asignado_nombre && (
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      <UserOutlined style={{ marginRight: 2 }} />{task.asignado_nombre}
                    </Text>
                  )}
                </div>
                {!planningMode && (
                  <Text style={{ fontSize: 11, fontWeight: 500, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                    {task.progreso || 0}%
                  </Text>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: Timeline */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ minWidth: totalDays * dayWidth }}>
            {/* Month + Day headers */}
            <div style={{ height: HEADER_HEIGHT, borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
              <div style={{ display: 'flex', height: 24 }}>
                {months.map((m, i) => (
                  <div key={i} style={{
                    width: m.span * dayWidth, textAlign: 'center', fontSize: 11, fontWeight: 600,
                    color: '#595959', borderRight: '1px solid #f0f0f0', lineHeight: '24px'
                  }}>{m.label}</div>
                ))}
              </div>
              <div style={{ display: 'flex', height: 28 }}>
                {days.map((d, i) => {
                  const nwd = isNonWorkday(d)
                  const isToday = d.isSame(dayjs(), 'day')
                  return (
                    <div key={i} style={{
                      width: dayWidth, textAlign: 'center', fontSize: 10, lineHeight: '28px',
                      color: isToday ? '#fff' : nwd ? '#bfbfbf' : '#8c8c8c',
                      background: isToday ? INEMEC_RED : nwd === 'holiday' ? 'rgba(213,43,30,0.06)' : 'transparent',
                      borderRadius: isToday ? 4 : 0, fontWeight: isToday ? 600 : 400
                    }}>{d.format('D')}</div>
                  )
                })}
              </div>
            </div>

            {/* Rows with bars */}
            {rows.map((row, i) => {
              if (row.type === 'phase') {
                return (
                  <div key={`phase-bar-${row.fase}`} style={{
                    height: 28, background: '#fafafa', borderBottom: '1px solid #f0f0f0', position: 'relative'
                  }}>
                    {days.map((d, di) => {
                      const bg = getDayBackground(d)
                      return bg !== 'transparent' ? (
                        <div key={di} style={{
                          position: 'absolute', left: di * dayWidth, top: 0,
                          width: dayWidth, height: '100%', background: bg
                        }} />
                      ) : null
                    })}
                  </div>
                )
              }

              const { task, fase } = row
              const taskStart = task.fecha_inicio ? dayjs(task.fecha_inicio) : null
              const taskEnd = task.fecha_fin ? dayjs(task.fecha_fin) : null

              let barLeft = 0
              let barWidth = dayWidth
              if (taskStart && taskEnd) {
                barLeft = taskStart.diff(startDate, 'day') * dayWidth
                barWidth = Math.max(dayWidth, (taskEnd.diff(taskStart, 'day') + 1) * dayWidth)
              }

              const phaseColor = getPhaseColor(fase)
              const progress = task.progreso || 0
              const editable = canEditTask(task)

              const barContent = (
                <div style={{
                  position: 'absolute', left: barLeft + 2, top: 6,
                  width: barWidth - 4, height: ROW_HEIGHT - 12, borderRadius: 4,
                  background: `${phaseColor}18`,
                  border: task.es_emergente ? `2px dashed ${phaseColor}` : `1px solid ${phaseColor}40`,
                  overflow: 'hidden',
                  cursor: editable ? 'pointer' : 'default',
                  transition: 'box-shadow 0.2s'
                }}
                  onMouseEnter={e => { if (editable) e.currentTarget.style.boxShadow = `0 0 0 2px ${phaseColor}40` }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                >
                  {/* Progress fill (hidden in planning mode) */}
                  {!planningMode && (
                    <div style={{
                      width: `${progress}%`, height: '100%',
                      background: `${phaseColor}50`, borderRadius: '3px 0 0 3px',
                      transition: 'width 0.3s ease'
                    }} />
                  )}
                  {/* Label */}
                  {!planningMode && barWidth > 50 && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 600, color: '#262626'
                    }}>{progress}%</div>
                  )}
                  {planningMode && barWidth > 60 && (
                    <div style={{
                      position: 'absolute', top: 0, left: 4, right: 4, bottom: 0,
                      display: 'flex', alignItems: 'center',
                      fontSize: 10, color: '#595959', overflow: 'hidden', whiteSpace: 'nowrap'
                    }}>{task.titulo}</div>
                  )}
                </div>
              )

              return (
                <div key={`bar-${task.id}`} style={{
                  height: ROW_HEIGHT, position: 'relative', borderBottom: '1px solid #f5f5f5'
                }}>
                  {/* Day shading (weekends, holidays, today) */}
                  {days.map((d, di) => {
                    const isToday = d.isSame(dayjs(), 'day')
                    const bg = isToday ? 'rgba(213, 43, 30, 0.04)' : getDayBackground(d)
                    return bg !== 'transparent' ? (
                      <div key={di} style={{
                        position: 'absolute', left: di * dayWidth, top: 0,
                        width: dayWidth, height: '100%', background: bg
                      }} />
                    ) : null
                  })}

                  {/* Task bar */}
                  {editable ? (
                    <Popover
                      trigger="click"
                      open={activeTask === task.id}
                      onOpenChange={(visible) => {
                        if (visible) {
                          setPendingProgress(prev => ({ ...prev, [task.id]: progress }))
                          setPendingMember(prev => ({ ...prev, [task.id]: task.asignado_id }))
                        }
                        setActiveTask(visible ? task.id : null)
                      }}
                      content={
                        <div style={{ width: 260 }}>
                          <Text strong>{task.titulo}</Text>
                          {task.descripcion && (
                            <div style={{ margin: '4px 0' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{task.descripcion}</Text>
                            </div>
                          )}
                          <Space style={{ marginTop: 4, marginBottom: 8 }} size={4}>
                            {task.es_emergente && <Tag color="volcano" style={{ fontSize: 11 }}>Emergente</Tag>}
                            {task.es_bloqueado && <Tag color="blue" style={{ fontSize: 11 }}>Del plan</Tag>}
                          </Space>
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8 }}>
                            {taskStart?.format('DD/MM/YYYY')} — {taskEnd?.format('DD/MM/YYYY')}
                            {task.duracion_dias && ` (${task.duracion_dias}d)`}
                          </div>

                          {/* Member reassignment (lead only) */}
                          {isLead && members.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <Text style={{ fontSize: 12 }}>Asignado a:</Text>
                              <Select
                                size="small"
                                style={{ width: '100%', marginTop: 4 }}
                                value={pendingMember[task.id] ?? task.asignado_id}
                                onChange={(val) => setPendingMember(prev => ({ ...prev, [task.id]: val }))}
                                options={members.map(m => ({ label: m.nombre, value: m.id || m.usuario_id }))}
                              />
                            </div>
                          )}

                          <Text style={{ fontSize: 12 }}>Progreso:</Text>
                          <Slider
                            min={task.progreso || 0}
                            max={100}
                            value={pendingProgress[task.id] ?? progress}
                            onChange={(val) => setPendingProgress(prev => ({ ...prev, [task.id]: val }))}
                            tooltip={{ formatter: v => `${v}%` }}
                            styles={{ track: { background: phaseColor }, rail: { background: '#f0f0f0' } }}
                          />

                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={() => handleConfirmUpdate(task.id)}
                            style={{ width: '100%', marginTop: 4, background: INEMEC_RED, borderColor: INEMEC_RED }}
                          >
                            Confirmar
                          </Button>
                        </div>
                      }
                    >
                      {barContent}
                    </Popover>
                  ) : planningMode ? (
                    <Tooltip title={
                      <span>
                        {task.titulo}
                        {task.asignado_nombre && <> — {task.asignado_nombre}</>}
                        {task.duracion_dias && <> ({task.duracion_dias}d)</>}
                      </span>
                    }>
                      {barContent}
                    </Tooltip>
                  ) : (
                    <Tooltip title={`${task.titulo} — ${progress}%`}>
                      {barContent}
                    </Tooltip>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GanttChart
