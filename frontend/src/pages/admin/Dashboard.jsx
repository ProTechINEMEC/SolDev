import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Typography, Table, Tag, Space, Spin, message, Switch } from 'antd'
import {
  TeamOutlined, FileTextOutlined, ToolOutlined, ProjectOutlined,
  SettingOutlined, BookOutlined, ClockCircleOutlined, ExperimentOutlined
} from '@ant-design/icons'
import api from '../../services/api'
import { usuariosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const rolLabels = {
  admin: 'Admin',
  nuevas_tecnologias: 'NT',
  ti: 'TI',
  gerencia: 'Gerencia',
  coordinador_nt: 'Coord. NT',
  coordinador_ti: 'Coord. TI'
}

const rolColors = {
  admin: 'purple',
  nuevas_tecnologias: 'red',
  ti: 'green',
  gerencia: 'gold',
  coordinador_nt: 'volcano',
  coordinador_ti: 'cyan'
}

function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testToggling, setTestToggling] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await api.get('/dashboard/admin')
      setData(response.data)
    } catch (error) {
      message.error('Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTestUsers = async (activo) => {
    setTestToggling(true)
    try {
      await usuariosApi.toggleTestUsers(activo)
      message.success(activo ? 'Usuarios de prueba habilitados' : 'Usuarios de prueba deshabilitados')
      loadDashboard()
    } catch (error) {
      message.error('Error al cambiar estado de usuarios de prueba')
    } finally {
      setTestToggling(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  const { users, recentActivity, counts, testUsers } = data || {}

  const activityColumns = [
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      key: 'creado_en',
      width: 160,
      render: (d) => dayjs(d).format('DD/MM/YYYY HH:mm')
    },
    {
      title: 'Usuario',
      dataIndex: 'usuario_nombre',
      key: 'usuario_nombre',
      render: (v) => v || <Text type="secondary">Sistema</Text>
    },
    {
      title: 'Entidad',
      dataIndex: 'entidad_tipo',
      key: 'entidad_tipo',
      render: (v) => <Tag>{v}</Tag>
    },
    {
      title: 'Accion',
      dataIndex: 'accion',
      key: 'accion'
    }
  ]

  // Build role distribution data for display
  const roleEntries = [
    { role: 'nuevas_tecnologias', count: parseInt(users?.nt || 0) },
    { role: 'ti', count: parseInt(users?.ti || 0) },
    { role: 'gerencia', count: parseInt(users?.gerencia || 0) },
    { role: 'coordinador_nt', count: parseInt(users?.coordinador_nt || 0) },
    { role: 'coordinador_ti', count: parseInt(users?.coordinador_ti || 0) }
  ].filter(e => e.count > 0)

  return (
    <div>
      <Title level={3}>Panel de Administracion</Title>

      {/* User Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => navigate('/admin/usuarios')}>
            <Statistic
              title="Usuarios Totales"
              value={users?.total || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Usuarios Activos"
              value={users?.activos || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Solicitudes Pendientes"
              value={counts?.solicitudes_pendientes || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Tickets Abiertos"
              value={counts?.tickets_abiertos || 0}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Role Distribution */}
        <Col xs={24} md={8}>
          <Card title="Distribucion por Rol" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {roleEntries.map(({ role, count }) => (
                <div key={role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag color={rolColors[role]}>{rolLabels[role]}</Tag>
                  <Text strong>{count}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        {/* Global Counts */}
        <Col xs={24} md={8}>
          <Card title="Resumen Global" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text><FileTextOutlined /> Solicitudes</Text>
                <Text strong>{counts?.total_solicitudes || 0}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text><ToolOutlined /> Tickets</Text>
                <Text strong>{counts?.total_tickets || 0}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text><ProjectOutlined /> Proyectos</Text>
                <Text strong>{counts?.total_proyectos || 0}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text><ProjectOutlined /> Proyectos Activos</Text>
                <Text strong>{counts?.proyectos_activos || 0}</Text>
              </div>
            </Space>
          </Card>
        </Col>

        {/* Quick Links & Test Users */}
        <Col xs={24} md={8}>
          <Card
            title={<><ExperimentOutlined /> Usuarios de Prueba</>}
            size="small"
            extra={
              <Switch
                checked={testUsers?.enabled}
                checkedChildren="ON"
                unCheckedChildren="OFF"
                loading={testToggling}
                onChange={(checked) => handleToggleTestUsers(checked)}
              />
            }
            style={{ marginBottom: 16 }}
          >
            <Tag color={testUsers?.enabled ? 'green' : 'default'}>
              {testUsers?.enabled
                ? `${testUsers?.enabledCount} habilitados`
                : 'Deshabilitados'
              }
            </Tag>
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              {testUsers?.count} usuario(s) de prueba en total
            </Text>
          </Card>
          <Card title="Accesos Rapidos" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card.Grid
                style={{ width: '100%', padding: 12, cursor: 'pointer' }}
                onClick={() => navigate('/admin/usuarios')}
              >
                <TeamOutlined /> Gestionar Usuarios
              </Card.Grid>
              <Card.Grid
                style={{ width: '100%', padding: 12, cursor: 'pointer' }}
                onClick={() => navigate('/admin/configuracion')}
              >
                <SettingOutlined /> Configurar Opciones
              </Card.Grid>
              <Card.Grid
                style={{ width: '100%', padding: 12, cursor: 'pointer' }}
                onClick={() => navigate('/admin/articulos')}
              >
                <BookOutlined /> Articulos
              </Card.Grid>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card
        title={<><ClockCircleOutlined /> Actividad Reciente del Sistema</>}
      >
        <Table
          dataSource={recentActivity || []}
          columns={activityColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}

export default AdminDashboard
