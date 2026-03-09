import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Row, Col, Typography, Tag, Progress, Space, Spin, Empty,
  Tooltip, Badge
} from 'antd'
import {
  ProjectOutlined, ClockCircleOutlined, PlayCircleOutlined,
  PauseCircleOutlined, CalendarOutlined, TeamOutlined
} from '@ant-design/icons'
import { proyectosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const INEMEC_RED = '#D52B1E'

const estadoColors = {
  planificacion: 'default',
  en_desarrollo: 'processing',
  pausado: 'warning',
  completado: 'success',
  cancelado_gerencia: 'error',
  cancelado_coordinador: 'error',
  cancelado: 'error'
}

const estadoLabels = {
  planificacion: 'Planificacion',
  en_desarrollo: 'En Desarrollo',
  pausado: 'Pausado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  cancelado_coordinador: 'Cancelado (Coord. NT)',
  cancelado_gerencia: 'Cancelado (Gerencia)'
}

const prioridadColors = { critica: 'red', alta: 'orange', media: 'blue', baja: 'green' }

function ProyectoCard({ proyecto, showProgress = false }) {
  return (
    <Link to={`/gerencia/proyectos/${proyecto.codigo}`}>
      <Card hoverable size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <Text strong style={{ color: INEMEC_RED }}>{proyecto.codigo}</Text>
                <Tag color={estadoColors[proyecto.estado]}>
                  {proyecto.estado === 'pausado' && <PauseCircleOutlined style={{ marginRight: 4 }} />}
                  {estadoLabels[proyecto.estado] || proyecto.estado}
                </Tag>
                <Tag color={prioridadColors[proyecto.prioridad]}>{proyecto.prioridad}</Tag>
              </Space>
              <Text ellipsis style={{ maxWidth: '100%' }}>{proyecto.titulo}</Text>
              <Space size="middle">
                {proyecto.lider_nombre && (
                  <Tooltip title="Lider del Proyecto">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <TeamOutlined style={{ marginRight: 4 }} />
                      {proyecto.lider_nombre}
                    </Text>
                  </Tooltip>
                )}
                {proyecto.fecha_inicio_estimada && proyecto.fecha_fin_estimada && (
                  <Tooltip title="Fechas programadas">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <CalendarOutlined style={{ marginRight: 4 }} />
                      {dayjs(proyecto.fecha_inicio_estimada).format('DD/MM')} - {dayjs(proyecto.fecha_fin_estimada).format('DD/MM/YYYY')}
                    </Text>
                  </Tooltip>
                )}
              </Space>
            </Space>
          </Col>

          {showProgress && (
            <Col style={{ minWidth: 200, textAlign: 'right' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Teorico</Text>
                  <Text style={{ fontSize: 11 }}>{proyecto.progreso_teorico || 0}%</Text>
                </div>
                <Progress percent={proyecto.progreso_teorico || 0} size="small" showInfo={false} strokeColor="#8c8c8c" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Practico</Text>
                  <Text style={{ fontSize: 11 }}>{proyecto.progreso_practico || 0}%</Text>
                </div>
                <Progress percent={proyecto.progreso_practico || 0} size="small" showInfo={false} strokeColor={INEMEC_RED} />
              </Space>
            </Col>
          )}

          {!showProgress && proyecto.estado === 'planificacion' && proyecto.fecha_inicio_estimada && (
            <Col style={{ textAlign: 'right' }}>
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Inicio en</Text>
                <div style={{
                  fontSize: 20, fontWeight: 'bold',
                  color: dayjs(proyecto.fecha_inicio_estimada).diff(dayjs(), 'day') <= 7 ? INEMEC_RED : '#1890ff'
                }}>
                  {Math.max(0, dayjs(proyecto.fecha_inicio_estimada).diff(dayjs(), 'day'))}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>dias</Text>
              </div>
            </Col>
          )}
        </Row>

        {proyecto.estado === 'pausado' && proyecto.motivo_pausa_actual && (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            backgroundColor: '#fff7e6', borderRadius: 4, fontSize: 12
          }}>
            <PauseCircleOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
            <Text type="warning">{proyecto.motivo_pausa_actual}</Text>
          </div>
        )}
      </Card>
    </Link>
  )
}

function GerenciaProyectos() {
  const [loading, setLoading] = useState(true)
  const [proyectosActivos, setProyectosActivos] = useState([])
  const [proyectosAgendados, setProyectosAgendados] = useState([])

  useEffect(() => { loadProyectos() }, [])

  const loadProyectos = async () => {
    try {
      setLoading(true)
      const [activosRes, agendadosRes] = await Promise.all([
        proyectosApi.list({ estado: 'en_desarrollo,pausado', limit: 100 }),
        proyectosApi.list({ estado: 'planificacion', limit: 100 })
      ])

      const sortProyectos = (a, b) => {
        if (a.estado === 'pausado' && b.estado !== 'pausado') return -1
        if (a.estado !== 'pausado' && b.estado === 'pausado') return 1
        const prioridadOrder = { critica: 0, alta: 1, media: 2, baja: 3 }
        if (prioridadOrder[a.prioridad] !== prioridadOrder[b.prioridad]) {
          return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad]
        }
        return new Date(b.creado_en) - new Date(a.creado_en)
      }

      setProyectosActivos((activosRes.data.proyectos || []).sort(sortProyectos))
      setProyectosAgendados((agendadosRes.data.proyectos || []).sort((a, b) =>
        new Date(a.fecha_inicio_estimada) - new Date(b.fecha_inicio_estimada)
      ))
    } catch (error) {
      console.error('Error loading proyectos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Cargando proyectos...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ margin: 0, marginBottom: 24 }}>
        <ProjectOutlined style={{ marginRight: 12, color: INEMEC_RED }} />
        Proyectos
      </Title>

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <PlayCircleOutlined style={{ color: INEMEC_RED }} />
                Proyectos Activos
                <Badge count={proyectosActivos.length} style={{ backgroundColor: INEMEC_RED }} />
              </Space>
            }
            styles={{ body: { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' } }}
          >
            {proyectosActivos.length === 0 ? (
              <Empty description="No hay proyectos activos" />
            ) : (
              proyectosActivos.map(p => <ProyectoCard key={p.id} proyecto={p} showProgress={true} />)
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1890ff' }} />
                Proyectos Programados
                <Badge count={proyectosAgendados.length} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            }
            styles={{ body: { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' } }}
          >
            {proyectosAgendados.length === 0 ? (
              <Empty description="No hay proyectos programados" />
            ) : (
              proyectosAgendados.map(p => <ProyectoCard key={p.id} proyecto={p} showProgress={false} />)
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default GerenciaProyectos
