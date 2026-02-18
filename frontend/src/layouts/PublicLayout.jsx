import { Outlet, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Space, Typography } from 'antd'
import {
  HomeOutlined,
  BookOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  LoginOutlined
} from '@ant-design/icons'

const { Header, Content, Footer } = Layout
const { Text } = Typography

function PublicLayout() {
  const location = useLocation()

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">Inicio</Link> },
    { key: '/conocimiento', icon: <BookOutlined />, label: <Link to="/conocimiento">Conocimiento</Link> },
    { key: '/nueva-solicitud', icon: <PlusCircleOutlined />, label: <Link to="/nueva-solicitud">Nueva Solicitud</Link> }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 50px',
        background: '#1a1a1a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <a href="https://inemec.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/inemec-logo.png"
              alt="INEMEC"
              style={{ height: 36, marginRight: 12, cursor: 'pointer', verticalAlign: 'middle' }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </a>
          <Link to="/">
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              Portal de Gestión de Tecnologías
            </Text>
          </Link>
        </div>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ flex: 1, marginLeft: 50, minWidth: 0, background: 'transparent' }}
        />

        <Space>
          <Link to="/consulta/buscar">
            <Button
              icon={<SearchOutlined />}
              style={{ background: '#333', borderColor: '#333', color: 'white' }}
            >
              Consultar Estado
            </Button>
          </Link>
          <Link to="/login">
            <Button
              type="primary"
              icon={<LoginOutlined />}
              style={{ background: '#D52B1E', borderColor: '#D52B1E' }}
            >
              Ingresar
            </Button>
          </Link>
        </Space>
      </Header>

      <Content style={{ padding: '24px 50px', background: '#f0f2f5' }}>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center', background: '#1a1a1a', color: 'rgba(255,255,255,0.65)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            Portal de Gestión de Tecnologías - Departamento de Nuevas Tecnologías
          </Text>
          <br />
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            © {new Date().getFullYear()} INEMEC S.A. Todos los derechos reservados.
          </Text>
        </div>
      </Footer>
    </Layout>
  )
}

export default PublicLayout
