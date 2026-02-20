import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin } from 'antd'
import { CheckCircleOutlined, ProjectOutlined, FileTextOutlined } from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

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
          <Card><Statistic title="Completados (Año)" value={data?.stats?.proyectos_completados_ano || 0} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} /></Card>
        </Col>
      </Row>
      <Card title="Solicitudes Pendientes de Aprobación" extra={<Link to="/gerencia/aprobaciones">Ver todas</Link>}>
        <Table dataSource={data?.pendientesAprobacion || []} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default GerenciaDashboard
