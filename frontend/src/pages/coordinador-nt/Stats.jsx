import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin, DatePicker, Select, Empty } from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, RedoOutlined,
  CalendarOutlined, BarChartOutlined
} from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function CoordinadorNTStats() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])

  useEffect(() => {
    loadStats()
  }, [dateRange])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await dashboardApi.getCoordinadorNT()
      setData(response.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  const decisionColumns = [
    {
      title: 'Codigo',
      dataIndex: 'entidad_codigo',
      key: 'codigo',
      width: 140
    },
    {
      title: 'Accion',
      dataIndex: 'accion',
      key: 'accion',
      width: 120,
      render: (accion) => {
        const colors = {
          aprobar: 'success',
          rechazar: 'error',
          reevaluar: 'warning'
        }
        return <Tag color={colors[accion]}>{accion?.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Fecha Sugerida',
      dataIndex: 'fecha_sugerida',
      key: 'fecha_sugerida',
      render: (fecha) => fecha ? dayjs(fecha).format('DD/MM/YYYY') : '--'
    },
    {
      title: 'Comentario',
      dataIndex: 'comentario',
      key: 'comentario',
      ellipsis: true
    },
    {
      title: 'Fecha Decision',
      dataIndex: 'creado_en',
      key: 'creado_en',
      width: 150,
      render: (fecha) => dayjs(fecha).format('DD/MM/YYYY HH:mm')
    }
  ]

  const stats = data?.stats || {}
  const decisiones = data?.misDecisiones || []

  // Calculate percentages
  const totalDecisiones = (stats.aprobados_total || 0) + (stats.rechazados_total || 0) + (stats.reevaluaciones_total || 0)
  const aprobadosPct = totalDecisiones > 0 ? ((stats.aprobados_total || 0) / totalDecisiones * 100).toFixed(1) : 0
  const rechazadosPct = totalDecisiones > 0 ? ((stats.rechazados_total || 0) / totalDecisiones * 100).toFixed(1) : 0
  const reevalPct = totalDecisiones > 0 ? ((stats.reevaluaciones_total || 0) / totalDecisiones * 100).toFixed(1) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            <BarChartOutlined style={{ marginRight: 8 }} />
            Estadisticas de Coordinador NT
          </Title>
          <Text type="secondary">Resumen de decisiones y metricas</Text>
        </div>
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates)}
          format="DD/MM/YYYY"
        />
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Aprobados"
              value={stats.aprobados_total || 0}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>({aprobadosPct}%)</Text>}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Rechazados"
              value={stats.rechazados_total || 0}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>({rechazadosPct}%)</Text>}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Reevaluaciones"
              value={stats.reevaluaciones_total || 0}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>({reevalPct}%)</Text>}
              valueStyle={{ color: '#faad14' }}
              prefix={<RedoOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Pendientes Ahora"
              value={stats.pendientes_revision || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Decision Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title="Resumen de Actividad"
            size="small"
          >
            <Row gutter={16}>
              <Col xs={12} md={6}>
                <Statistic
                  title="Aprobados Hoy"
                  value={stats.aprobados_hoy || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Aprobados Esta Semana"
                  value={stats.aprobados_semana || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Proyectos Activos"
                  value={stats.proyectos_activos || 0}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Total Decisiones"
                  value={totalDecisiones}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Decisions Table */}
      <Card
        title="Historial de Decisiones"
        size="small"
      >
        {decisiones.length > 0 ? (
          <Table
            dataSource={decisiones}
            columns={decisionColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <Empty description="Sin decisiones registradas" />
        )}
      </Card>
    </div>
  )
}

export default CoordinadorNTStats
