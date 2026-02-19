import { useMemo } from 'react'
import { Card, Typography, Tooltip, Tag, Empty } from 'antd'
import { UserOutlined } from '@ant-design/icons'

const { Text } = Typography

// Phase colors
const phaseColors = {
  analisis: '#1890ff',
  diseno: '#722ed1',
  desarrollo: '#52c41a',
  pruebas: '#faad14',
  documentacion: '#13c2c2',
  entrega: '#eb2f96'
}

const phaseLabels = {
  analisis: 'Análisis',
  diseno: 'Diseño',
  desarrollo: 'Desarrollo',
  pruebas: 'Pruebas',
  documentacion: 'Documentación',
  entrega: 'Entrega'
}

// Phase order for sorting tasks
const PHASE_ORDER = ['analisis', 'diseno', 'desarrollo', 'pruebas', 'documentacion', 'entrega']

// Height per day in pixels
const DAY_HEIGHT = 8

function WorkloadChart({ equipo, tareas, liderId }) {
  // Calculate workload per team member
  const workloadData = useMemo(() => {
    if (!equipo || equipo.length === 0) return { columns: [], maxDays: 0, totalDays: 0 }

    // Group tasks by team member
    const memberTasks = {}
    equipo.forEach(member => {
      memberTasks[member.id] = []
    })

    // Also track unassigned tasks
    memberTasks['unassigned'] = []

    // Sort tasks by phase order, then by order within phase
    const sortedTasks = [...tareas].sort((a, b) => {
      const phaseA = PHASE_ORDER.indexOf(a.fase)
      const phaseB = PHASE_ORDER.indexOf(b.fase)
      if (phaseA !== phaseB) return phaseA - phaseB
      return (a.orden || 0) - (b.orden || 0)
    })

    // Assign tasks to columns
    sortedTasks.forEach(tarea => {
      const assignedIds = tarea.asignados_ids || []
      if (assignedIds.length === 0) {
        // Unassigned task
        memberTasks['unassigned'].push(tarea)
      } else {
        // Add to each assigned member's column
        assignedIds.forEach(userId => {
          if (memberTasks[userId]) {
            memberTasks[userId].push(tarea)
          }
        })
      }
    })

    // Calculate total days per member
    const columns = equipo.map(member => {
      const tasks = memberTasks[member.id] || []
      const totalDays = tasks.reduce((sum, t) => sum + (t.duracion_dias || 0), 0)
      return {
        member,
        tasks,
        totalDays,
        isLider: member.id === liderId
      }
    })

    // Add unassigned column if there are unassigned tasks
    if (memberTasks['unassigned'].length > 0) {
      const unassignedDays = memberTasks['unassigned'].reduce((sum, t) => sum + (t.duracion_dias || 0), 0)
      columns.push({
        member: { id: 'unassigned', nombre: 'Sin Asignar' },
        tasks: memberTasks['unassigned'],
        totalDays: unassignedDays,
        isUnassigned: true
      })
    }

    // Find max days for scaling
    const maxDays = Math.max(...columns.map(c => c.totalDays), 1)

    // Calculate total project duration (considering parallel work)
    // Group by phase and get max duration per phase
    const phaseMaxDurations = {}
    PHASE_ORDER.forEach(phase => {
      const phaseTasks = tareas.filter(t => t.fase === phase)
      if (phaseTasks.length > 0) {
        // For each phase, find the maximum total duration across all members
        const memberPhaseTotals = {}
        phaseTasks.forEach(task => {
          const assignedIds = task.asignados_ids?.length > 0 ? task.asignados_ids : ['unassigned']
          assignedIds.forEach(userId => {
            memberPhaseTotals[userId] = (memberPhaseTotals[userId] || 0) + (task.duracion_dias || 0)
          })
        })
        phaseMaxDurations[phase] = Math.max(...Object.values(memberPhaseTotals), 0)
      }
    })
    const totalDays = Object.values(phaseMaxDurations).reduce((sum, d) => sum + d, 0)

    return { columns, maxDays, totalDays }
  }, [equipo, tareas, liderId])

  if (!equipo || equipo.length === 0) {
    return (
      <Card size="small">
        <Empty description="Seleccione el equipo para ver la distribución de carga" />
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

  const { columns, maxDays, totalDays } = workloadData
  const chartHeight = maxDays * DAY_HEIGHT + 60 // Extra space for totals

  return (
    <Card
      size="small"
      title="Distribución de Carga de Trabajo"
      extra={
        <Text type="secondary">
          Duración total estimada: <Text strong>{totalDays} días hábiles</Text>
        </Text>
      }
    >
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 8
      }}>
        {columns.map(({ member, tasks, totalDays: memberDays, isLider, isUnassigned }) => (
          <div
            key={member.id}
            style={{
              minWidth: 140,
              maxWidth: 180,
              flex: '1 0 140px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header - Member name */}
            <div style={{
              padding: '8px 4px',
              textAlign: 'center',
              borderBottom: '2px solid #f0f0f0',
              backgroundColor: isUnassigned ? '#fff7e6' : (isLider ? '#e6f7ff' : '#fafafa'),
              borderRadius: '4px 4px 0 0'
            }}>
              <UserOutlined style={{ marginRight: 4, color: isUnassigned ? '#faad14' : '#1890ff' }} />
              <Text strong style={{ fontSize: 12 }}>
                {member.nombre.split(' ')[0]}
              </Text>
              {isLider && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>Líder</Tag>}
            </div>

            {/* Tasks column */}
            <div style={{
              flex: 1,
              minHeight: chartHeight,
              backgroundColor: '#fafafa',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              {tasks.map((tarea, index) => {
                const height = Math.max(tarea.duracion_dias * DAY_HEIGHT, 24)
                return (
                  <Tooltip
                    key={`${tarea.id || index}`}
                    title={
                      <div>
                        <div><strong>{tarea.nombre}</strong></div>
                        <div>Fase: {phaseLabels[tarea.fase]}</div>
                        <div>Duración: {tarea.duracion_dias} días</div>
                      </div>
                    }
                  >
                    <div
                      style={{
                        height,
                        backgroundColor: phaseColors[tarea.fase] || '#1890ff',
                        borderRadius: 4,
                        padding: '2px 6px',
                        color: 'white',
                        fontSize: 10,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.9,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = 1}
                      onMouseLeave={(e) => e.target.style.opacity = 0.9}
                    >
                      {height >= 32 ? tarea.nombre : `${tarea.duracion_dias}d`}
                    </div>
                  </Tooltip>
                )
              })}
            </div>

            {/* Footer - Total days */}
            <div style={{
              padding: '8px 4px',
              textAlign: 'center',
              borderTop: '2px solid #f0f0f0',
              backgroundColor: '#fafafa',
              borderRadius: '0 0 4px 4px'
            }}>
              <Text strong style={{ color: memberDays > maxDays * 0.8 ? '#ff4d4f' : '#52c41a' }}>
                {memberDays} días
              </Text>
            </div>
          </div>
        ))}
      </div>

      {/* Phase Legend */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {PHASE_ORDER.map(phase => (
          <Tag key={phase} color={phaseColors[phase]} style={{ margin: 0 }}>
            {phaseLabels[phase]}
          </Tag>
        ))}
      </div>
    </Card>
  )
}

export default WorkloadChart
