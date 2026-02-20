import { Link } from 'react-router-dom'
import { Row, Col, Card, Typography, Button, Space, Collapse } from 'antd'
import {
  FileAddOutlined,
  ToolOutlined,
  BookOutlined,
  SearchOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CustomerServiceOutlined,
  SolutionOutlined,
  ReadOutlined,
  FileSearchOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

function Landing() {
  const services = [
    {
      icon: <FileAddOutlined style={{ fontSize: 48, color: '#D52B1E' }} />,
      title: 'Proyectos de Nuevas Tecnologías',
      description: 'Envíe solicitudes para nuevos proyectos de desarrollo, actualizaciones de sistemas existentes o reportes de fallas técnicas.',
      link: '/nueva-solicitud',
      linkText: 'Nueva Solicitud'
    },
    {
      icon: <ToolOutlined style={{ fontSize: 48, color: '#52c41a' }} />,
      title: 'Soporte Técnico General',
      description: 'Cree tickets de soporte para problemas de hardware, software, red, accesos o cualquier incidencia técnica que requiera atención.',
      link: '/nueva-solicitud?tipo=ticket',
      linkText: 'Crear Ticket'
    },
    {
      icon: <BookOutlined style={{ fontSize: 48, color: '#722ed1' }} />,
      title: 'Portal de Conocimiento',
      description: 'Acceda a guías, manuales, documentación técnica y recursos de capacitación de la organización.',
      link: '/conocimiento',
      linkText: 'Explorar'
    }
  ]

  // Features for Proyectos de Nuevas Tecnologías
  const proyectosFeatures = [
    {
      icon: <RocketOutlined />,
      title: 'Proceso Estructurado',
      description: 'Solicitudes evaluadas y priorizadas por el equipo de Nuevas Tecnologías'
    },
    {
      icon: <SafetyCertificateOutlined />,
      title: 'Aprobación Gerencial',
      description: 'Proyectos aprobados formalmente por Gerencia antes de iniciar'
    },
    {
      icon: <TeamOutlined />,
      title: 'Seguimiento Transparente',
      description: 'Consulte el estado de sus solicitudes en cualquier momento'
    }
  ]

  // Features for Soporte Técnico General
  const soporteFeatures = [
    {
      icon: <ClockCircleOutlined />,
      title: 'Atención Rápida',
      description: 'Tickets priorizados según urgencia y atendidos en orden'
    },
    {
      icon: <CustomerServiceOutlined />,
      title: 'Soporte Especializado',
      description: 'Técnicos capacitados para resolver problemas de hardware, software y redes'
    },
    {
      icon: <CheckCircleOutlined />,
      title: 'Resolución Efectiva',
      description: 'Seguimiento hasta la solución completa del problema reportado'
    }
  ]

  // Features for Portal de Conocimiento
  const conocimientoFeatures = [
    {
      icon: <ReadOutlined />,
      title: 'Documentación Actualizada',
      description: 'Manuales y guías técnicas mantenidas al día por el equipo'
    },
    {
      icon: <FileSearchOutlined />,
      title: 'Búsqueda Inteligente',
      description: 'Encuentre rápidamente la información que necesita'
    },
    {
      icon: <SolutionOutlined />,
      title: 'Autogestión',
      description: 'Resuelva dudas comunes sin necesidad de crear un ticket'
    }
  ]

  const FeatureSection = ({ features, color }) => (
    <Row gutter={[32, 16]} style={{ padding: '16px 0' }}>
      {features.map((feature, index) => (
        <Col xs={24} md={8} key={index}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: color === '#D52B1E' ? '#fce8e6' : color === '#52c41a' ? '#f6ffed' : '#f9f0ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: 22,
              color
            }}>
              {feature.icon}
            </div>
            <Title level={5} style={{ marginBottom: 4 }}>{feature.title}</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>{feature.description}</Text>
          </div>
        </Col>
      ))}
    </Row>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        background: '#1a1a1a',
        borderRadius: 16,
        marginBottom: 48,
        color: 'white'
      }}>
        <Title level={1} style={{ color: 'white', margin: '0 0 16px 0' }}>
          Portal de Gestión de Tecnologías
        </Title>
        <Paragraph style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', maxWidth: 600, margin: '0 auto' }}>
          Plataforma centralizada para solicitudes de desarrollo, soporte técnico y documentación tecnológica
        </Paragraph>
      </div>

      {/* Services */}
      <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
        {services.map((service, index) => (
          <Col xs={24} md={8} key={index}>
            <Card
              className="hoverable-card"
              style={{ height: '100%', textAlign: 'center' }}
              styles={{ body: { padding: 32 } }}
            >
              {service.icon}
              <Title level={4} style={{ marginTop: 16 }}>{service.title}</Title>
              <Paragraph type="secondary">{service.description}</Paragraph>
              <Link to={service.link}>
                <Button type="primary">{service.linkText}</Button>
              </Link>
            </Card>
          </Col>
        ))}
      </Row>

      {/* How It Works - Collapsible */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          ¿Cómo Funciona?
        </Title>
        <Collapse
          accordion
          bordered={false}
          style={{ background: 'transparent' }}
          items={[
            {
              key: '1',
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileAddOutlined style={{ fontSize: 20, color: '#D52B1E' }} />
                  <span style={{ fontWeight: 500, fontSize: 16 }}>Proyectos de Nuevas Tecnologías</span>
                </div>
              ),
              children: <FeatureSection features={proyectosFeatures} color="#D52B1E" />
            },
            {
              key: '2',
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ToolOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                  <span style={{ fontWeight: 500, fontSize: 16 }}>Soporte Técnico General</span>
                </div>
              ),
              children: <FeatureSection features={soporteFeatures} color="#52c41a" />
            },
            {
              key: '3',
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <BookOutlined style={{ fontSize: 20, color: '#722ed1' }} />
                  <span style={{ fontWeight: 500, fontSize: 16 }}>Portal de Conocimiento</span>
                </div>
              ),
              children: <FeatureSection features={conocimientoFeatures} color="#722ed1" />
            }
          ]}
        />
      </Card>

      {/* Status Check */}
      <Card style={{ textAlign: 'center', background: '#1a1a1a', marginBottom: 24 }}>
        <Title level={4} style={{ color: 'white' }}>¿Ya tiene una solicitud?</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)' }}>
          Ingrese el código de su solicitud para consultar el estado actual
        </Paragraph>
        <Link to="/consulta/buscar">
          <Button
            icon={<SearchOutlined />}
            size="large"
            style={{ background: '#D52B1E', borderColor: '#D52B1E', color: 'white' }}
          >
            Consultar Estado de Solicitud
          </Button>
        </Link>
      </Card>

    </div>
  )
}

export default Landing
