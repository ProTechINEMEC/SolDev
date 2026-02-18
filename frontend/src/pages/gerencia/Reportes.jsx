import { useState, useEffect } from 'react'
import {
  Card, Typography, Row, Col, Statistic, DatePicker, Space, Spin,
  Table, Tag, Divider, Progress, message, Tabs, Select, Button
} from 'antd'
import {
  FileTextOutlined, ProjectOutlined, ToolOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, RiseOutlined, FallOutlined,
  DownloadOutlined, FilePdfOutlined
} from '@ant-design/icons'
import { reportesApi, exportApi } from '../../services/api'
import dayjs from 'dayjs'
import {
  SolicitudesByTypeChart,
  StatusPieChart,
  TicketsByCategoryChart
} from '../../components/DashboardCharts'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const estadoSolicitudColors = {
  pendiente_evaluacion_nt: 'orange',
  pendiente_aprobacion_gerencia: 'gold',
  aprobado: 'green',
  en_desarrollo: 'processing',
  completado: 'success',
  descartado_nt: 'default',
  rechazado_gerencia: 'error',
  cancelado: 'default'
}

const estadoProyectoColors = {
  planificacion: 'cyan',
  en_desarrollo: 'processing',
  pausado: 'orange',
  completado: 'success',
  cancelado: 'default'
}

const tipoLabels = {
  nuevo_desarrollo: 'Nuevo Desarrollo',
  mejora: 'Mejora',
  correccion: 'Corrección'
}

function GerenciaReportes() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ])
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [solicitudesData, setSolicitudesData] = useState({ solicitudes: [], stats: {}, porTipo: [] })
  const [proyectosData, setProyectosData] = useState({ proyectos: [], stats: {} })
  const [ticketsData, setTicketsData] = useState({ tickets: [], stats: {}, porCategoria: [] })
  const [activeTab, setActiveTab] = useState('resumen')

  useEffect(() => {
    loadAllData()
  }, [dateRange])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const desde = dateRange[0].format('YYYY-MM-DD')
      const hasta = dateRange[1].format('YYYY-MM-DD')

      const [weeklyRes, solicitudesRes, proyectosRes, ticketsRes] = await Promise.all([
        reportesApi.getSemanal().catch(() => ({ data: { reporte: null } })),
        reportesApi.getSolicitudes({ desde, hasta }),
        reportesApi.getProyectos({ desde, hasta }),
        reportesApi.getTickets({ desde, hasta })
      ])

      setWeeklyReport(weeklyRes.data.reporte)
      setSolicitudesData(solicitudesRes.data)
      setProyectosData(proyectosRes.data)
      setTicketsData(ticketsRes.data)
    } catch (error) {
      console.error('Error loading reports:', error)
      message.error('Error al cargar los reportes')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates)
    }
  }

  const handleExportWeeklyPDF = async () => {
    try {
      message.loading({ content: 'Generando PDF...', key: 'pdf' })
      const response = await exportApi.getWeeklyReportPdf()
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte-semanal-${dayjs().format('YYYY-MM-DD')}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
      message.success({ content: 'PDF descargado', key: 'pdf' })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      message.error({ content: 'Error al generar el PDF', key: 'pdf' })
    }
  }

  const handleExportAuditLog = async () => {
    try {
      message.loading({ content: 'Generando Excel...', key: 'excel' })
      const desde = dateRange[0].format('YYYY-MM-DD')
      const hasta = dateRange[1].format('YYYY-MM-DD')
      const response = await exportApi.getAuditLogExcel({ desde, hasta })
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria-${desde}-${hasta}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
      message.success({ content: 'Excel descargado', key: 'excel' })
    } catch (error) {
      console.error('Error exporting audit log:', error)
      message.error({ content: 'Error al generar el Excel', key: 'excel' })
    }
  }

  // Calculate percentages for charts
  const calcPercentage = (value, total) => {
    if (!total || total === 0) return 0
    return Math.round((value / total) * 100)
  }

  // Summary Cards Component
  const SummaryCards = () => {
    const solStats = solicitudesData.stats || {}
    const proyStats = proyectosData.stats || {}
    const tickStats = ticketsData.stats || {}

    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Solicitudes Totales"
              value={solStats.total || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#D52B1E' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                {solStats.pendientes_nt || 0} pendientes evaluación
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pendientes Aprobación"
              value={solStats.pendientes_gerencia || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                Requieren su revisión
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Proyectos Activos"
              value={(parseInt(proyStats.planificacion) || 0) + (parseInt(proyStats.en_desarrollo) || 0)}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                {proyStats.completados || 0} completados
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tickets Abiertos"
              value={tickStats.activos || 0}
              prefix={<ToolOutlined />}
              valueStyle={{ color: tickStats.criticos > 0 ? '#f5222d' : '#D52B1E' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                {tickStats.criticos || 0} críticos, {tickStats.escalados || 0} escalados
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    )
  }

  // Weekly Report Component
  const WeeklyReportSection = () => {
    if (!weeklyReport?.datos) {
      return <Card><Text type="secondary">No hay reporte semanal disponible</Text></Card>
    }

    const { solicitudes, proyectos, tickets } = weeklyReport.datos

    return (
      <Card title="Reporte Semanal" extra={
        <Text type="secondary">
          {dayjs(weeklyReport.fecha_inicio).format('DD/MM')} - {dayjs(weeklyReport.fecha_fin).format('DD/MM/YYYY')}
        </Text>
      }>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Card size="small" title="Solicitudes" type="inner">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Nuevas"
                    value={solicitudes?.nuevas || 0}
                    valueStyle={{ fontSize: 20, color: '#D52B1E' }}
                    prefix={<RiseOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Aprobadas"
                    value={solicitudes?.aprobadas || 0}
                    valueStyle={{ fontSize: 20, color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Pend. Evaluación"
                    value={solicitudes?.pendientes_evaluacion || 0}
                    valueStyle={{ fontSize: 16, color: '#faad14' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Pend. Aprobación"
                    value={solicitudes?.pendientes_aprobacion || 0}
                    valueStyle={{ fontSize: 16, color: '#fa8c16' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card size="small" title="Proyectos" type="inner">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Activos"
                    value={proyectos?.activos || 0}
                    valueStyle={{ fontSize: 20, color: '#D52B1E' }}
                    prefix={<ProjectOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Completados"
                    value={proyectos?.completados_semana || 0}
                    valueStyle={{ fontSize: 20, color: '#52c41a' }}
                    suffix="/sem"
                  />
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">{proyectos?.pausados || 0} proyectos pausados</Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card size="small" title="Tickets TI" type="inner">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Nuevos"
                    value={tickets?.nuevos || 0}
                    valueStyle={{ fontSize: 20, color: '#D52B1E' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Resueltos"
                    value={tickets?.resueltos || 0}
                    valueStyle={{ fontSize: 20, color: '#52c41a' }}
                  />
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Abiertos"
                    value={tickets?.abiertos || 0}
                    valueStyle={{ fontSize: 16, color: '#faad14' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tiempo Prom."
                    value={tickets?.tiempo_promedio_horas ? Math.round(tickets.tiempo_promedio_horas) : '-'}
                    valueStyle={{ fontSize: 16 }}
                    suffix="h"
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Card>
    )
  }

  // Solicitudes Report Tab
  const SolicitudesReport = () => {
    const { solicitudes, stats, porTipo } = solicitudesData
    const total = parseInt(stats.total) || 1

    const columns = [
      {
        title: 'Código',
        dataIndex: 'codigo',
        key: 'codigo',
        width: 120
      },
      {
        title: 'Título',
        dataIndex: 'titulo',
        key: 'titulo',
        ellipsis: true
      },
      {
        title: 'Tipo',
        dataIndex: 'tipo',
        key: 'tipo',
        render: (tipo) => tipoLabels[tipo] || tipo
      },
      {
        title: 'Departamento',
        dataIndex: 'departamento',
        key: 'departamento'
      },
      {
        title: 'Estado',
        dataIndex: 'estado',
        key: 'estado',
        render: (estado) => (
          <Tag color={estadoSolicitudColors[estado]}>
            {estado?.replace(/_/g, ' ').toUpperCase()}
          </Tag>
        )
      },
      {
        title: 'Fecha',
        dataIndex: 'creado_en',
        key: 'fecha',
        render: (d) => dayjs(d).format('DD/MM/YYYY')
      }
    ]

    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <StatusPieChart
              data={stats}
              title="Distribución por Estado"
            />
          </Col>
          <Col xs={24} md={12}>
            <SolicitudesByTypeChart
              data={porTipo}
              title="Solicitudes por Tipo"
            />
          </Col>
        </Row>

        <Card title={`Solicitudes (${solicitudes?.length || 0})`}>
          <Table
            dataSource={solicitudes}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>
    )
  }

  // Proyectos Report Tab
  const ProyectosReport = () => {
    const { proyectos, stats } = proyectosData
    const total = parseInt(stats.total) || 1

    const columns = [
      {
        title: 'Código',
        dataIndex: 'codigo',
        key: 'codigo',
        width: 120
      },
      {
        title: 'Título',
        dataIndex: 'titulo',
        key: 'titulo',
        ellipsis: true
      },
      {
        title: 'Responsable',
        dataIndex: 'responsable_nombre',
        key: 'responsable'
      },
      {
        title: 'Estado',
        dataIndex: 'estado',
        key: 'estado',
        render: (estado) => (
          <Tag color={estadoProyectoColors[estado]}>
            {estado?.replace(/_/g, ' ').toUpperCase()}
          </Tag>
        )
      },
      {
        title: 'Progreso',
        key: 'progreso',
        render: (_, record) => {
          const progress = record.total_tareas > 0
            ? Math.round((record.tareas_completadas / record.total_tareas) * 100)
            : 0
          return <Progress percent={progress} size="small" style={{ width: 100 }} />
        }
      },
      {
        title: 'Tareas',
        key: 'tareas',
        render: (_, record) => (
          <Text>{record.tareas_completadas || 0}/{record.total_tareas || 0}</Text>
        )
      },
      {
        title: 'Fecha Inicio',
        dataIndex: 'fecha_inicio_estimada',
        key: 'fecha_inicio',
        render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '-'
      }
    ]

    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="Estado de Proyectos">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Total"
                    value={stats.total || 0}
                    valueStyle={{ fontSize: 24 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tasa Completado"
                    value={calcPercentage(stats.completados, total)}
                    suffix="%"
                    valueStyle={{ fontSize: 24, color: '#52c41a' }}
                  />
                </Col>
              </Row>
              <Divider />
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">Planificación</Text>
                <Progress
                  percent={calcPercentage(stats.planificacion, total)}
                  strokeColor="#D52B1E"
                  format={() => stats.planificacion || 0}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">En Desarrollo</Text>
                <Progress
                  percent={calcPercentage(stats.en_desarrollo, total)}
                  strokeColor="#52c41a"
                  format={() => stats.en_desarrollo || 0}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">Pausados</Text>
                <Progress
                  percent={calcPercentage(stats.pausados, total)}
                  strokeColor="#faad14"
                  format={() => stats.pausados || 0}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">Completados</Text>
                <Progress
                  percent={calcPercentage(stats.completados, total)}
                  strokeColor="#87d068"
                  format={() => stats.completados || 0}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">Cancelados</Text>
                <Progress
                  percent={calcPercentage(stats.cancelados, total)}
                  strokeColor="#f5222d"
                  format={() => stats.cancelados || 0}
                />
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Indicadores Clave">
              <Row gutter={[16, 24]}>
                <Col span={12}>
                  <Statistic
                    title="Proyectos Activos"
                    value={(parseInt(stats.planificacion) || 0) + (parseInt(stats.en_desarrollo) || 0)}
                    prefix={<ProjectOutlined />}
                    valueStyle={{ color: '#D52B1E' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Proyectos Pausados"
                    value={stats.pausados || 0}
                    prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Completados"
                    value={stats.completados || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Cancelados"
                    value={stats.cancelados || 0}
                    prefix={<FallOutlined />}
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Card title={`Proyectos (${proyectos?.length || 0})`}>
          <Table
            dataSource={proyectos}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>
    )
  }

  // Tickets Report Tab
  const TicketsReport = () => {
    const { tickets, stats, porCategoria } = ticketsData
    const total = parseInt(stats.total) || 1

    const categoriaColors = {
      hardware: '#722ed1',
      software: '#13c2c2',
      red: '#eb2f96',
      acceso: '#fa8c16',
      otro: '#595959'
    }

    const columns = [
      {
        title: 'Código',
        dataIndex: 'codigo',
        key: 'codigo',
        width: 120
      },
      {
        title: 'Título',
        dataIndex: 'titulo',
        key: 'titulo',
        ellipsis: true
      },
      {
        title: 'Categoría',
        dataIndex: 'categoria',
        key: 'categoria',
        render: (cat) => (
          <Tag color={categoriaColors[cat]}>{cat?.toUpperCase()}</Tag>
        )
      },
      {
        title: 'Prioridad',
        dataIndex: 'prioridad',
        key: 'prioridad',
        render: (p) => {
          const colors = { baja: 'green', media: 'cyan', alta: 'orange', critica: 'red' }
          return <Tag color={colors[p]}>{p?.toUpperCase()}</Tag>
        }
      },
      {
        title: 'Estado',
        dataIndex: 'estado',
        key: 'estado',
        render: (estado) => {
          const colors = {
            abierto: 'warning',
            en_proceso: 'processing',
            resuelto: 'success',
            cerrado: 'default',
            escalado_nt: 'error'
          }
          return <Tag color={colors[estado]}>{estado?.replace(/_/g, ' ').toUpperCase()}</Tag>
        }
      },
      {
        title: 'Departamento',
        dataIndex: 'departamento',
        key: 'departamento'
      },
      {
        title: 'Tiempo',
        dataIndex: 'horas_transcurridas',
        key: 'horas',
        render: (h) => h ? `${Math.round(h)}h` : '-'
      }
    ]

    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="Estadísticas de Tickets">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Total"
                    value={stats.total || 0}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Activos"
                    value={stats.activos || 0}
                    valueStyle={{ fontSize: 20, color: '#faad14' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Resueltos"
                    value={stats.resueltos || 0}
                    valueStyle={{ fontSize: 20, color: '#52c41a' }}
                  />
                </Col>
              </Row>
              <Divider />
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Escalados NT"
                    value={stats.escalados || 0}
                    valueStyle={{ fontSize: 16, color: '#f5222d' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Críticos"
                    value={stats.criticos || 0}
                    valueStyle={{ fontSize: 16, color: '#f5222d' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Tiempo Prom."
                    value={stats.tiempo_promedio_horas ? Math.round(stats.tiempo_promedio_horas) : '-'}
                    suffix="h"
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <TicketsByCategoryChart
              data={porCategoria}
              title="Tickets por Categoría"
            />
          </Col>
        </Row>

        <Card title={`Tickets (${tickets?.length || 0})`}>
          <Table
            dataSource={tickets}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  const tabItems = [
    {
      key: 'resumen',
      label: 'Resumen Semanal',
      children: <WeeklyReportSection />
    },
    {
      key: 'solicitudes',
      label: 'Solicitudes',
      children: <SolicitudesReport />
    },
    {
      key: 'proyectos',
      label: 'Proyectos',
      children: <ProyectosReport />
    },
    {
      key: 'tickets',
      label: 'Tickets TI',
      children: <TicketsReport />
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Reportes y Estadísticas</Title>
        <Space wrap>
          <Text type="secondary">Período:</Text>
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            format="DD/MM/YYYY"
            presets={[
              { label: 'Última Semana', value: [dayjs().subtract(7, 'days'), dayjs()] },
              { label: 'Últimos 30 días', value: [dayjs().subtract(30, 'days'), dayjs()] },
              { label: 'Últimos 90 días', value: [dayjs().subtract(90, 'days'), dayjs()] },
              { label: 'Este Año', value: [dayjs().startOf('year'), dayjs()] }
            ]}
          />
          <Button
            icon={<FilePdfOutlined />}
            onClick={handleExportWeeklyPDF}
          >
            PDF Semanal
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportAuditLog}
          >
            Auditoría Excel
          </Button>
        </Space>
      </div>

      <SummaryCards />

      <Card style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  )
}

export default GerenciaReportes
