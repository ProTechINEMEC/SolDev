import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin, Empty } from 'antd'
import {
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined,
  BarChartOutlined, ToolOutlined, UserOutlined
} from '@ant-design/icons'
import { dashboardApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

function CoordinadorTIStats() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await dashboardApi.getCoordinadorTI()
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

  const stats = data?.stats || {}
  const ticketsPorTrabajador = data?.ticketsPorTrabajador || []
  const ticketsEnCola = data?.ticketsEnCola || []
  const ticketsTomadosSinResolver = data?.ticketsTomadosSinResolver || []
  const misDecisiones = data?.misDecisiones || []

  const workerColumns = [
    {
      title: 'Trabajador',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (nombre) => (
        <span>
          <UserOutlined style={{ marginRight: 8 }} />
          {nombre}
        </span>
      )
    },
    {
      title: 'Tickets Asignados',
      dataIndex: 'tickets_asignados',
      key: 'tickets_asignados',
      align: 'center',
      render: (count) => <Tag color="blue">{count || 0}</Tag>
    },
    {
      title: 'Resueltos Este Mes',
      dataIndex: 'resueltos_mes',
      key: 'resueltos_mes',
      align: 'center',
      render: (count) => <Tag color="green">{count || 0}</Tag>
    },
    {
      title: 'Tiempo Promedio (dias)',
      dataIndex: 'tiempo_promedio_dias',
      key: 'tiempo_promedio',
      align: 'center',
      render: (tiempo) => tiempo ? `${parseFloat(tiempo).toFixed(1)}` : '--'
    }
  ]

  const queueColumns = [
    {
      title: 'Codigo',
      dataIndex: 'codigo',
      key: 'codigo',
      width: 140
    },
    {
      title: 'Titulo',
      dataIndex: 'titulo',
      key: 'titulo',
      ellipsis: true
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      key: 'prioridad',
      render: (p) => {
        const colors = { critica: 'red', alta: 'orange', media: 'cyan', baja: 'green' }
        return <Tag color={colors[p]}>{p?.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Dias en Cola',
      dataIndex: 'creado_en',
      key: 'dias',
      render: (fecha) => {
        const days = dayjs().diff(dayjs(fecha), 'day')
        return <Tag color={days > 5 ? 'red' : days > 2 ? 'orange' : 'default'}>{days}d</Tag>
      }
    }
  ]

  const pendingColumns = [
    {
      title: 'Codigo',
      dataIndex: 'codigo',
      key: 'codigo',
      width: 140
    },
    {
      title: 'Titulo',
      dataIndex: 'titulo',
      key: 'titulo',
      ellipsis: true
    },
    {
      title: 'Asignado a',
      dataIndex: 'asignado_nombre',
      key: 'asignado'
    },
    {
      title: 'Dias Tomado',
      dataIndex: 'fecha_asignacion',
      key: 'dias',
      render: (fecha) => {
        if (!fecha) return '--'
        const days = dayjs().diff(dayjs(fecha), 'day')
        return <Tag color={days > 5 ? 'red' : days > 2 ? 'orange' : 'default'}>{days}d</Tag>
      }
    }
  ]

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
      render: (accion) => {
        const colors = {
          reasignar: 'blue',
          cerrar_forzado: 'red'
        }
        return <Tag color={colors[accion] || 'default'}>{accion}</Tag>
      }
    },
    {
      title: 'Comentario',
      dataIndex: 'comentario',
      key: 'comentario',
      ellipsis: true
    },
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      key: 'fecha',
      render: (fecha) => dayjs(fecha).format('DD/MM/YYYY HH:mm')
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Estadisticas de Coordinador TI
        </Title>
        <Text type="secondary">Metricas de rendimiento y estado del equipo</Text>
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Tickets Abiertos"
              value={stats.tickets_abiertos || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="En Proceso"
              value={stats.tickets_en_proceso || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Resueltos Esta Semana"
              value={stats.resueltos_semana || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Trabajadores TI"
              value={stats.trabajadores_ti || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Resueltos Hoy"
              value={stats.resueltos_hoy || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Resueltos Este Mes"
              value={stats.resueltos_mes || 0}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Reasignaciones"
              value={stats.reasignaciones_total || 0}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Cierres Forzados"
              value={stats.cierres_forzados_total || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Worker Performance */}
      <Card
        title={<><TeamOutlined style={{ marginRight: 8 }} />Rendimiento por Trabajador</>}
        style={{ marginBottom: 24 }}
      >
        {ticketsPorTrabajador.length > 0 ? (
          <Table
            dataSource={ticketsPorTrabajador}
            columns={workerColumns}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="Sin datos de trabajadores" />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        {/* Tickets in Queue */}
        <Col xs={24} lg={12}>
          <Card
            title={<><ClockCircleOutlined style={{ marginRight: 8 }} />Tickets en Cola (Sin Asignar)</>}
          >
            {ticketsEnCola.length > 0 ? (
              <Table
                dataSource={ticketsEnCola}
                columns={queueColumns}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            ) : (
              <Empty description="No hay tickets en cola" />
            )}
          </Card>
        </Col>

        {/* Tickets Taken but Not Resolved */}
        <Col xs={24} lg={12}>
          <Card
            title={<><ToolOutlined style={{ marginRight: 8 }} />Tickets Tomados Sin Resolver</>}
          >
            {ticketsTomadosSinResolver.length > 0 ? (
              <Table
                dataSource={ticketsTomadosSinResolver}
                columns={pendingColumns}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            ) : (
              <Empty description="No hay tickets pendientes" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Coordinator Decisions */}
      <Card
        title="Mis Decisiones Recientes"
        style={{ marginTop: 24 }}
      >
        {misDecisiones.length > 0 ? (
          <Table
            dataSource={misDecisiones}
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

export default CoordinadorTIStats
