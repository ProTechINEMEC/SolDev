import { useState, useEffect, useMemo } from 'react'
import { Form, Input, InputNumber, Card, Button, Table, Tag, Space, Typography, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, FileTextOutlined, ToolOutlined } from '@ant-design/icons'
import GanttChart from '../../GanttChart'
import { addWorkdaysFE } from '../../../utils/workdays'

const { Text } = Typography

function IntegracionSection({ form, sectionNumber = 9 }) {
  const [fases, setFases] = useState([])
  const [tareas, setTareas] = useState([])
  const [newFase, setNewFase] = useState('')

  // Load initial data from form
  useEffect(() => {
    const integracion = form.getFieldValue('integracion')
    if (integracion) {
      setFases(integracion.fases || [])
      setTareas((integracion.tareas || []).map((t, i) => ({ ...t, id: t.id || `impl-${Date.now()}-${i}` })))
    }
  }, [])

  // Sync to form whenever fases/tareas change
  useEffect(() => {
    form.setFieldsValue({
      integracion: {
        fases,
        tareas: tareas.map(({ id, ...rest }) => rest)
      }
    })
  }, [fases, tareas, form])

  // Build Gantt preview data
  const ganttTareas = useMemo(() => {
    if (tareas.length === 0) return []
    const result = []
    let cursor = new Date()
    for (const fase of fases) {
      const faseTasks = tareas.filter(t => t.fase === fase)
      for (const t of faseTasks) {
        const fi = new Date(cursor)
        const ff = addWorkdaysFE(fi, (t.duracion_dias || 1) - 1, [])
        result.push({
          ...t,
          titulo: t.nombre || 'Sin nombre',
          fecha_inicio: fi.toISOString().split('T')[0],
          fecha_fin: ff.toISOString().split('T')[0],
          progreso: 0
        })
        cursor = addWorkdaysFE(ff, 1, [])
      }
    }
    return result
  }, [fases, tareas])

  const addFase = () => {
    if (newFase.trim() && !fases.includes(newFase.trim())) {
      setFases(prev => [...prev, newFase.trim()])
      setNewFase('')
    }
  }

  const removeFase = (fase) => {
    setFases(prev => prev.filter(f => f !== fase))
    setTareas(prev => prev.filter(t => t.fase !== fase))
  }

  const addTarea = (fase) => {
    setTareas(prev => [...prev, {
      id: `impl-${Date.now()}`,
      nombre: '',
      duracion_dias: 1,
      fase
    }])
  }

  const updateTarea = (id, field, value) => {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const removeTarea = (id) => {
    setTareas(prev => prev.filter(t => t.id !== id))
  }

  return (
    <Card title={`${sectionNumber}. Plan de Implementación`} style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Defina cómo se desplegará, comunicará y adoptará la solución una vez desarrollada.
        Este plan será verificado por el equipo de Nuevas Tecnologías después del desarrollo.
      </Text>

      {/* Phases */}
      <Card
        size="small"
        title={<><ToolOutlined /> Fases de Implementación</>}
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 12 }}>
          {fases.map(fase => (
            <Tag
              key={fase}
              closable
              onClose={() => removeFase(fase)}
              style={{ marginBottom: 4 }}
            >
              {fase}
            </Tag>
          ))}
          {fases.length === 0 && (
            <Text type="secondary">No hay fases definidas</Text>
          )}
        </div>
        <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
          <Input
            value={newFase}
            onChange={e => setNewFase(e.target.value)}
            placeholder="Ej: Capacitación, Despliegue, Comunicación..."
            onPressEnter={addFase}
            maxLength={100}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addFase}
            disabled={!newFase.trim()}
          >
            Agregar
          </Button>
        </Space.Compact>
      </Card>

      {/* Tasks per phase */}
      <Card
        size="small"
        title={<><FileTextOutlined /> Tareas por Fase</>}
        style={{ marginBottom: 16 }}
      >
        {fases.length === 0 ? (
          <Alert
            message="Sin Fases"
            description="Primero defina las fases de implementación arriba."
            type="warning"
            showIcon
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fases.map((fase, faseIndex) => {
              const faseTareas = tareas.filter(t => t.fase === fase)
              return (
                <Card
                  key={fase}
                  size="small"
                  type="inner"
                  title={<Text strong>Fase {faseIndex + 1}: {fase}</Text>}
                  extra={
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => addTarea(fase)}
                    >
                      Agregar Tarea
                    </Button>
                  }
                  style={{ backgroundColor: '#fafafa' }}
                >
                  {faseTareas.length > 0 ? (
                    <Table
                      dataSource={faseTareas}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: 'Tarea',
                          dataIndex: 'nombre',
                          render: (text, record) => (
                            <Input
                              value={text}
                              placeholder="Nombre de la tarea"
                              onChange={e => updateTarea(record.id, 'nombre', e.target.value)}
                            />
                          )
                        },
                        {
                          title: 'Días Hábiles',
                          dataIndex: 'duracion_dias',
                          width: 120,
                          render: (duracion, record) => (
                            <InputNumber
                              value={duracion}
                              min={1}
                              max={365}
                              style={{ width: '100%' }}
                              onChange={value => updateTarea(record.id, 'duracion_dias', value || 1)}
                            />
                          )
                        },
                        {
                          title: '',
                          width: 50,
                          render: (_, record) => (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => removeTarea(record.id)}
                            />
                          )
                        }
                      ]}
                    />
                  ) : (
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '12px 0' }}>
                      Sin tareas en esta fase
                    </Text>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </Card>

      {/* Gantt Preview */}
      {ganttTareas.length > 0 && (
        <Card size="small" title="Vista Previa del Plan" style={{ marginBottom: 16 }}>
          <GanttChart tareas={ganttTareas} planningMode disabled members={[]} />
        </Card>
      )}
    </Card>
  )
}

export default IntegracionSection
