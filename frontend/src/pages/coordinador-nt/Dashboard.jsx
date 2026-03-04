import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, List, Badge } from 'antd'
import {
  FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ProjectOutlined, ClockCircleOutlined, AuditOutlined
} from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const prioridadColors = {
  baja: 'green',
  media: 'cyan',
  alta: 'orange',
  critica: 'red'
}

function CoordinadorNTDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await dashboardApi.getCoordinadorNT()
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
    {
      title: 'Codigo',
      dataIndex: 'codigo',
      render: (c, r) => <Link to={`/coordinador-nt/revision/${r.codigo}`}>{c}</Link>
    },
    { title: 'Titulo', dataIndex: 'titulo', ellipsis: true },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      render: (p) => <Tag color={prioridadColors[p]}>{p?.toUpperCase()}</Tag>
    },
    { title: 'Solicitante', dataIndex: 'solicitante_nombre' },
    {
      title: 'Fecha Escalado',
      dataIndex: 'fecha_escalado',
      render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '--'
    },
    {
      title: 'Dias Esperando',
      dataIndex: 'fecha_escalado',
      render: (d) => {
        if (!d) return '--'
        const days = dayjs().diff(dayjs(d), 'day')
        return (
          <Badge
            count={`${days}d`}
            style={{
              backgroundColor: days > 7 ? '#ff4d4f' : days > 3 ? '#faad14' : '#8c8c8c'
            }}
          />
        )
      }
    }
  ]

  return (
    <div>
      <Title level={3}>Dashboard - Coordinador NT</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Pendientes Revision"
              value={data?.stats?.pendientes_revision || 0}
              prefix={<AuditOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Aprobados Hoy"
              value={data?.stats?.aprobados_hoy || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Rechazados Total"
              value={data?.stats?.rechazados_total || 0}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Proyectos Activos"
              value={data?.stats?.proyectos_activos || 0}
              prefix={<ProjectOutlined style={{ color: '#D52B1E' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <span>
                <FileTextOutlined style={{ marginRight: 8 }} />
                Solicitudes Pendientes de Revision
              </span>
            }
            extra={<Link to="/coordinador-nt/revisiones">Ver todas</Link>}
          >
            <Table
              dataSource={data?.pendientesRevision || []}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No hay solicitudes pendientes' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                Mis Decisiones Recientes
              </span>
            }
          >
            <List
              dataSource={data?.misDecisiones || []}
              size="small"
              locale={{ emptyText: 'Sin decisiones recientes' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <Text strong>{item.entidad_codigo}</Text>
                        <Tag
                          color={
                            item.accion === 'aprobar' ? 'success' :
                            item.accion === 'rechazar' ? 'error' : 'warning'
                          }
                          style={{ marginLeft: 8 }}
                        >
                          {item.accion}
                        </Tag>
                      </span>
                    }
                    description={dayjs(item.creado_en).format('DD/MM/YYYY HH:mm')}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default CoordinadorNTDashboard
