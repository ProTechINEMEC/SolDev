import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, List, Progress } from 'antd'
import { CheckCircleOutlined, ProjectOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

function GerenciaDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await dashboardApi.getGerencia()
      setData(response.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', render: (c, r) => <Link to={`/gerencia/aprobaciones/${r.codigo}`}>{c}</Link> },
    { title: 'Título', dataIndex: 'titulo', ellipsis: true },
    { title: 'Prioridad', dataIndex: 'prioridad', render: (p) => <Tag color={p === 'critica' ? 'red' : p === 'alta' ? 'orange' : 'cyan'}>{p}</Tag> },
    { title: 'Solicitante', dataIndex: 'solicitante_nombre' },
    { title: 'Fecha', dataIndex: 'creado_en', render: (d) => dayjs(d).format('DD/MM/YYYY') }
  ]

  return (
    <div>
      <Title level={3}>Dashboard - Gerencia</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Pendientes Aprobación" value={data?.stats?.pendientes_aprobacion || 0} prefix={<FileTextOutlined style={{ color: '#faad14' }} />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Proyectos Activos" value={data?.stats?.proyectos_activos || 0} prefix={<ProjectOutlined style={{ color: '#D52B1E' }} />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Agendados" value={data?.stats?.agendados || 0} prefix={<CalendarOutlined style={{ color: '#52c41a' }} />} /></Card>
        </Col>
      </Row>
      <Card title="Solicitudes Pendientes de Aprobación" extra={<Link to="/gerencia/aprobaciones">Ver todas</Link>}>
        <Table dataSource={data?.pendientesAprobacion || []} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>

      {/* Implementation Projects */}
      {(data?.proyectosImplementacion?.length > 0) && (
        <Card
          title="Proyectos en Implementación"
          extra={<Link to="/gerencia/implementacion">Ver todos</Link>}
          style={{ marginTop: 16 }}
        >
          <List
            dataSource={data.proyectosImplementacion}
            size="small"
            renderItem={(item) => {
              const total = parseInt(item.impl_total, 10) || 0
              const done = parseInt(item.impl_completadas, 10) || 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <List.Item>
                  <List.Item.Meta
                    title={<Link to={`/gerencia/implementacion/${item.codigo}`}>{item.codigo}</Link>}
                    description={item.titulo}
                  />
                  <div style={{ minWidth: 180, textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{done}/{total} tareas</Text>
                    <Progress percent={pct} size="small" strokeColor="#D52B1E" />
                  </div>
                </List.Item>
              )
            }}
          />
        </Card>
      )}
    </div>
  )
}

export default GerenciaDashboard
