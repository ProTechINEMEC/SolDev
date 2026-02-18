import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Button, Space, Typography
} from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  ProjectOutlined,
  ToolOutlined,
  TeamOutlined,
  BookOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  SettingOutlined,
  CalendarOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'
import NotificationDropdown from '../components/NotificationDropdown'
import GlobalSearch from '../components/GlobalSearch'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// Menu items by role
const menuItems = {
  nuevas_tecnologias: [
    { key: '/nt', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/nt/solicitudes', icon: <FileTextOutlined />, label: 'Solicitudes' },
    { key: '/nt/proyectos', icon: <ProjectOutlined />, label: 'Proyectos' },
    { key: '/nt/tickets-escalados', icon: <ToolOutlined />, label: 'Tickets Escalados' },
    { key: '/nt/articulos', icon: <BookOutlined />, label: 'Artículos' },
    { key: '/nt/usuarios', icon: <TeamOutlined />, label: 'Usuarios' },
    { key: '/nt/configuracion', icon: <SettingOutlined />, label: 'Configuración' }
  ],
  ti: [
    { key: '/ti', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/ti/tickets', icon: <ToolOutlined />, label: 'Tickets' }
  ],
  gerencia: [
    { key: '/gerencia', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/gerencia/calendario', icon: <CalendarOutlined />, label: 'Calendario' },
    { key: '/gerencia/reportes', icon: <BarChartOutlined />, label: 'Reportes' }
  ]
}

const roleLabels = {
  nuevas_tecnologias: 'Nuevas Tecnologías',
  ti: 'Tecnologías de la Información',
  gerencia: 'Gerencia'
}

function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token, logout } = useAuthStore()
  const { connect, disconnect } = useNotificationStore()

  // Initialize WebSocket connection for notifications
  useEffect(() => {
    if (token) {
      connect(token)
    }
    return () => disconnect()
  }, [token, connect, disconnect])

  const handleMenuClick = ({ key }) => {
    navigate(key)
  }

  const handleLogout = async () => {
    disconnect()
    await logout()
    navigate('/login')
  }

  // Get base path for current role
  const getBasePath = () => {
    const roleBasePaths = {
      nuevas_tecnologias: '/nt',
      ti: '/ti',
      gerencia: '/gerencia'
    }
    return roleBasePaths[user?.rol] || '/'
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Mi Perfil',
      onClick: () => navigate(`${getBasePath()}/perfil`)
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesion',
      onClick: handleLogout
    }
  ]

  const items = menuItems[user?.rol] || []

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          {collapsed ? (
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>I</Text>
          ) : (
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
              INEMEC Portal
            </Text>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          <Space size="middle">
            <GlobalSearch />
            <NotificationDropdown />

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#D52B1E' }} />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 500 }}>{user?.nombre}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {roleLabels[user?.rol]}
                  </Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          margin: 24,
          minHeight: 280
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
