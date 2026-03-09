import { useMemo } from 'react'
import { Card, Tag, Table, Typography } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import GanttChart from './GanttChart'
import { addWorkdaysFE } from '../utils/workdays'

const { Text } = Typography

export default function IntegracionDisplay({ integracion, holidays = [] }) {
  if (!integracion?.tareas?.length) return null

  const fases = integracion.fases || []
  const tareas = integracion.tareas || []

  const ganttTareas = useMemo(() => {
    if (tareas.length === 0) return []
    const result = []
    let cursor = new Date()
    for (const fase of fases) {
      const faseTasks = tareas.filter(t => t.fase === fase)
      for (const t of faseTasks) {
        const fi = new Date(cursor)
        const ff = addWorkdaysFE(fi, (t.duracion_dias || 1) - 1, holidays)
        result.push({
          id: `impl-${result.length}`,
          titulo: t.nombre || 'Sin nombre',
          fase,
          fecha_inicio: fi.toISOString().split('T')[0],
          fecha_fin: ff.toISOString().split('T')[0],
          progreso: 0
        })
        cursor = addWorkdaysFE(ff, 1, holidays)
      }
    }
    return result
  }, [fases, tareas, holidays])

  const columns = [
    { title: 'Tarea', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Duración (días hábiles)',
      dataIndex: 'duracion_dias',
      key: 'duracion_dias',
      width: 160,
      align: 'center'
    }
  ]

  return (
    <Card
      title={<><ToolOutlined /> Plan de Implementación</>}
      size="small"
      style={{ marginBottom: 16 }}
    >
      {fases.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginRight: 8 }}>Fases:</Text>
          {fases.map(fase => <Tag key={fase}>{fase}</Tag>)}
        </div>
      )}

      {fases.map((fase, i) => {
        const faseTareas = tareas.filter(t => t.fase === fase)
        if (faseTareas.length === 0) return null
        return (
          <div key={fase} style={{ marginBottom: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              Fase {i + 1}: {fase}
            </Text>
            <Table
              dataSource={faseTareas}
              columns={columns}
              rowKey={(_, idx) => `${fase}-${idx}`}
              pagination={false}
              size="small"
              bordered
            />
          </div>
        )
      })}

      {ganttTareas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Vista Previa</Text>
          <GanttChart tareas={ganttTareas} planningMode disabled members={[]} holidays={holidays} />
        </div>
      )}
    </Card>
  )
}
