import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, List, Badge } from 'antd'
import {
  FileTextOutlined, ProjectOutlined, ToolOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const priorityColors = {
  critica: 'red',
  alta: 'orange',
  media: 'cyan',
  baja: 'green'
}

function NTDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await dashboardApi.getNT()
      setData(response.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  const solicitudColumns = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      render: (code, record) => <Link to={`/nt/solicitudes/${record.id}`}>{code}</Link>
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      ellipsis: true
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      render: (p) => <Tag color={priorityColors[p]}>{p?.toUpperCase()}</Tag>
    },
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      render: (d) => dayjs(d).format('DD/MM/YYYY')
    }
  ]

  return (
    <div>
      <Title level={3}>Dashboard - Nuevas Tecnologías</Title>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Pendientes Evaluación"
              value={data?.solicitudes?.pendientes_evaluacion || 0}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Esperando Gerencia"
              value={data?.solicitudes?.pendientes_gerencia || 0}
              prefix={<ExclamationCircleOutlined style={{ color: '#D52B1E' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Proyectos Activos"
              value={(data?.proyectos?.planificacion || 0) + (data?.proyectos?.en_desarrollo || 0)}
              prefix={<ProjectOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Tickets Escalados"
              value={data?.ticketsEscalados || 0}
              prefix={<ToolOutlined style={{ color: '#f5222d' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Nuevas (7 días)"
              value={data?.solicitudes?.nuevas_semana || 0}
              prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Completadas"
              value={data?.solicitudes?.completadas || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Pending Solicitudes */}
        <Col xs={24} lg={14}>
          <Card
            title="Solicitudes Pendientes de Evaluación"
            extra={<Link to="/nt/solicitudes">Ver todas</Link>}
          >
            <Table
              dataSource={data?.solicitudesRecientes || []}
              columns={solicitudColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* Active Projects */}
        <Col xs={24} lg={10}>
          <Card
            title="Proyectos Activos"
            extra={<Link to="/nt/proyectos">Ver todos</Link>}
          >
            <List
              dataSource={data?.proyectosActivos || []}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Link to={`/nt/proyectos/${item.id}`}>{item.codigo}</Link>}
                    description={item.titulo}
                  />
                  <div>
                    <Text type="secondary">
                      {item.tareas_completadas}/{item.total_tareas} tareas
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Notifications */}
        <Col xs={24}>
          <Card title="Notificaciones Recientes">
            {data?.notificaciones?.length === 0 ? (
              <Text type="secondary">No hay notificaciones nuevas</Text>
            ) : (
              <List
                dataSource={data?.notificaciones || []}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Badge status={item.leida ? 'default' : 'processing'} />}
                      title={item.titulo}
                      description={dayjs(item.creado_en).format('DD/MM/YYYY HH:mm')}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default NTDashboard
