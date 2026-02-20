import { useMemo } from 'react'
import { Card, Typography, Tooltip, Empty } from 'antd'
import { CrownOutlined } from '@ant-design/icons'

const { Text } = Typography

// Height per day in pixels
const DAY_HEIGHT = 20

// 16 distinct phase colors (good contrast for white text)
const PHASE_COLORS = [
  '#1890ff', // blue
  '#52c41a', // green
  '#722ed1', // purple
  '#fa541c', // orange
  '#13c2c2', // cyan
  '#eb2f96', // magenta
  '#faad14', // gold
  '#2f54eb', // geek blue
  '#a0d911', // lime
  '#fa8c16', // volcano
  '#1d39c4', // deep blue
  '#c41d7f', // deep magenta
  '#08979c', // teal
  '#d4380d', // red-orange
  '#7cb305', // olive
  '#531dab'  // deep purple
]

function WorkloadChart({ equipo, tareas, liderId, fases = [] }) {
  // Calculate timeline with proper phase sequencing and task alignment
  const timelineData = useMemo(() => {
    if (!equipo || equipo.length === 0 || fases.length === 0) {
      return { columns: [], totalDays: 0, phaseTimeline: [] }
    }

    // Build phase timeline - phases are sequential
    const phaseTimeline = []
    let currentDay = 0

    // Store all positioned tasks with their absolute positions
    const allPositionedTasks = []

    fases.forEach((fase) => {
      const faseTareas = tareas.filter(t => t.fase === fase)
      const phaseStartDay = currentDay

      // Get phase color (loops after 16)
      const phaseColor = PHASE_COLORS[phaseTimeline.length % PHASE_COLORS.length]

      if (faseTareas.length === 0) {
        phaseTimeline.push({
          fase,
          startDay: currentDay,
          endDay: currentDay,
          duration: 0,
          color: phaseColor
        })
        return
      }

      // Tasks are sequential - each task starts after the previous one finishes
      let currentTaskDay = phaseStartDay

      // Process tasks in order - sequential execution
      faseTareas.forEach((task) => {
        const assignedIds = task.asignados_ids || []
        if (assignedIds.length === 0) return

        const taskStartDay = currentTaskDay
        const taskEndDay = taskStartDay + (task.duracion_dias || 1)

        // Create positioned task for each assigned member
        assignedIds.forEach(memberId => {
          allPositionedTasks.push({
            ...task,
            memberId,
            startDay: taskStartDay,
            endDay: taskEndDay,
            phaseColor: phaseColor
          })
        })

        // Move to next task position (sequential)
        currentTaskDay = taskEndDay
      })

      // Phase duration is determined by the last task end
      const phaseEndDay = currentTaskDay
      const phaseDuration = phaseEndDay - phaseStartDay

      phaseTimeline.push({
        fase,
        startDay: phaseStartDay,
        endDay: phaseEndDay,
        duration: phaseDuration,
        color: phaseColor
      })

      currentDay = phaseEndDay
    })

    const totalDays = currentDay

    // Build columns for each team member
    const columns = equipo.map(member => {
      const memberTasks = allPositionedTasks.filter(t => t.memberId === member.id)
      const totalMemberDays = memberTasks.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)

      return {
        member,
        tasks: memberTasks,
        totalDays: totalMemberDays,
        isLider: member.id === liderId
      }
    })

    return { columns, totalDays, phaseTimeline }
  }, [equipo, tareas, liderId, fases])

  if (!equipo || equipo.length === 0) {
    return (
      <Card size="small">
        <Empty description="Seleccione el equipo para ver la distribución de carga" />
      </Card>
    )
  }

  if (fases.length === 0) {
    return (
      <Card size="small">
        <Empty description="Defina las fases para ver la distribución de carga" />
      </Card>
    )
  }

  if (tareas.length === 0) {
    return (
      <Card size="small">
        <Empty description="Agregue tareas para ver la distribución de carga" />
      </Card>
    )
  }

  const { columns, totalDays, phaseTimeline } = timelineData

  if (totalDays === 0) {
    return (
      <Card size="small">
        <Empty description="Asigne tareas al equipo para ver la distribución" />
      </Card>
    )
  }

  const chartHeight = totalDays * DAY_HEIGHT

  // Generate day markers
  const dayMarkers = Array.from({ length: totalDays }, (_, i) => i + 1)

  return (
    <Card
      size="small"
      title="Distribución de Carga de Trabajo"
      extra={
        <Text type="secondary">
          Duración total: <Text strong>{totalDays} días hábiles</Text>
        </Text>
      }
    >
      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {/* Phase labels on the left */}
        <div style={{
          minWidth: 30,
          borderRight: '1px solid #d9d9d9'
        }}>
          {/* Header spacer */}
          <div style={{ height: 40, borderBottom: '2px solid #d9d9d9' }} />

          {/* Phase labels */}
          <div style={{ position: 'relative', height: chartHeight }}>
            {phaseTimeline.map((phase, index) => (
              phase.duration > 0 && (
                <div
                  key={phase.fase}
                  style={{
                    position: 'absolute',
                    top: phase.startDay * DAY_HEIGHT,
                    height: phase.duration * DAY_HEIGHT,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: phase.color,
                    borderBottom: '2px solid #595959'
                  }}
                >
                  <Text
                    strong
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      transform: 'rotate(180deg)',
                      fontSize: 10,
                      color: 'white'
                    }}
                  >
                    F{index + 1}
                  </Text>
                </div>
              )
            ))}
          </div>

          {/* Footer spacer */}
          <div style={{ height: 40, borderTop: '2px solid #d9d9d9' }} />
        </div>

        {/* Day labels */}
        <div style={{
          minWidth: 35,
          borderRight: '2px solid #d9d9d9',
          marginRight: 8
        }}>
          {/* Header - "Días" label */}
          <div style={{
            height: 40,
            borderBottom: '2px solid #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text strong style={{ fontSize: 10 }}>Días</Text>
          </div>

          {/* Day numbers */}
          <div style={{ position: 'relative', height: chartHeight }}>
            {dayMarkers.map(day => (
              <div
                key={day}
                style={{
                  position: 'absolute',
                  top: (day - 1) * DAY_HEIGHT,
                  height: DAY_HEIGHT,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 6,
                  fontSize: 10,
                  color: '#595959'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Footer spacer */}
          <div style={{ height: 40, borderTop: '2px solid #d9d9d9' }} />
        </div>

        {/* Team member columns */}
        <div style={{
          display: 'flex',
          gap: 0,
          flex: 1
        }}>
          {columns.map(({ member, tasks, totalDays: memberDays, isLider }, colIndex) => (
            <div
              key={member.id}
              style={{
                minWidth: 120,
                maxWidth: 160,
                flex: '1 0 120px',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: colIndex === 0 ? '1px solid #d9d9d9' : 'none',
                borderRight: '1px solid #d9d9d9'
              }}
            >
              {/* Header - Member name */}
              <div style={{
                height: 40,
                padding: '4px',
                textAlign: 'center',
                borderBottom: '2px solid #d9d9d9',
                backgroundColor: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}>
                {isLider && (
                  <CrownOutlined style={{ color: 'rgba(0, 0, 0, 0.85)', fontSize: 12 }} />
                )}
                <Text strong style={{ fontSize: 11 }}>
                  {member.nombre.split(' ')[0]}
                </Text>
              </div>

              {/* Tasks column with proper positioning */}
              <div style={{
                height: chartHeight,
                backgroundColor: '#fff',
                position: 'relative'
              }}>
                {/* Phase separator lines */}
                {phaseTimeline.map((phase) => (
                  phase.duration > 0 && (
                    <div
                      key={`sep-${phase.fase}`}
                      style={{
                        position: 'absolute',
                        top: phase.endDay * DAY_HEIGHT,
                        left: 0,
                        right: 0,
                        height: 2,
                        backgroundColor: '#595959',
                        zIndex: 3
                      }}
                    />
                  )
                ))}

                {/* Day grid lines */}
                {dayMarkers.map(day => (
                  <div
                    key={day}
                    style={{
                      position: 'absolute',
                      top: (day - 1) * DAY_HEIGHT,
                      left: 0,
                      right: 0,
                      height: DAY_HEIGHT,
                      borderBottom: '1px solid #f0f0f0',
                      pointerEvents: 'none'
                    }}
                  />
                ))}

                {/* Task blocks - positioned by startDay */}
                {tasks.map((tarea, index) => {
                  const top = tarea.startDay * DAY_HEIGHT
                  const height = Math.max(tarea.duracion_dias * DAY_HEIGHT - 2, 16)

                  return (
                    <Tooltip
                      key={`${tarea.id}-${index}`}
                      title={
                        <div>
                          <div><strong>{tarea.nombre || 'Sin nombre'}</strong></div>
                          <div>Fase: {tarea.fase}</div>
                          <div>Día {tarea.startDay + 1} - {tarea.endDay}</div>
                          <div>Duración: {tarea.duracion_dias} días</div>
                        </div>
                      }
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: top + 1,
                          left: 3,
                          right: 3,
                          height,
                          backgroundColor: tarea.phaseColor,
                          borderRadius: 3,
                          padding: '1px 4px',
                          color: 'white',
                          fontSize: 10,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          zIndex: 2
                        }}
                      >
                        {tarea.nombre || '...'}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>

              {/* Footer - Total days */}
              <div style={{
                height: 40,
                padding: '4px',
                textAlign: 'center',
                borderTop: '2px solid #d9d9d9',
                backgroundColor: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text strong style={{ fontSize: 12 }}>
                  {memberDays} días
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Legend - simple text list */}
      {fases.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {fases.map((fase, index) => (
            <Text key={fase} style={{ fontSize: 11 }}>
              <Text strong>Fase {index + 1}:</Text> {fase}
            </Text>
          ))}
        </div>
      )}
    </Card>
  )
}

export default WorkloadChart
