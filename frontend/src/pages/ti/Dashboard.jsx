import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin } from 'antd'
import { ToolOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

function TIDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await dashboardApi.getTI()
      setData(response.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', render: (c, r) => <Link to={`/ti/tickets/${r.codigo}`}>{c}</Link> },
    { title: 'Título', dataIndex: 'titulo', ellipsis: true },
    { title: 'Categoría', dataIndex: 'categoria' },
    { title: 'Prioridad', dataIndex: 'prioridad', render: (p) => <Tag color={p === 'critica' ? 'red' : p === 'alta' ? 'orange' : 'cyan'}>{p}</Tag> },
    { title: 'Fecha', dataIndex: 'creado_en', render: (d) => dayjs(d).format('DD/MM/YYYY') }
  ]

  return (
    <div>
      <Title level={3}>Dashboard - TI</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Abiertos" value={data?.tickets?.abiertos || 0} prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="En Proceso" value={data?.tickets?.en_proceso || 0} prefix={<ToolOutlined style={{ color: '#D52B1E' }} />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Resueltos Hoy" value={data?.tickets?.resueltos || 0} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Escalados" value={data?.tickets?.escalados || 0} prefix={<ExclamationCircleOutlined style={{ color: '#f5222d' }} />} /></Card>
        </Col>
      </Row>
      <Card title="Tickets Sin Asignar" extra={<Link to="/ti/tickets">Ver todos</Link>}>
        <Table dataSource={data?.ticketsSinAsignar || []} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default TIDashboard
