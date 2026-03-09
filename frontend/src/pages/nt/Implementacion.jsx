import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, Row, Col, Typography, Tag, Space, Spin, Empty, Tooltip, Progress } from 'antd'
import { ToolOutlined, CalendarOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { proyectosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const INEMEC_RED = '#D52B1E'

function ImplementacionCard({ proyecto, linkPrefix = '/nt/proyectos' }) {
  const completadas = proyecto.impl_completadas || 0
  const total = proyecto.impl_total || 0
  const percent = total > 0 ? Math.round((completadas / total) * 100) : 100

  return (
    <Link to={`${linkPrefix}/${proyecto.codigo}`}>
      <Card hoverable size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <Text strong style={{ color: INEMEC_RED }}>{proyecto.codigo}</Text>
                <Tag color="cyan">En Implementación</Tag>
                <Tag color={{ critica: 'red', alta: 'orange', media: 'blue', baja: 'green' }[proyecto.prioridad]}>
                  {proyecto.prioridad}
                </Tag>
              </Space>
              <Text ellipsis style={{ maxWidth: '100%' }}>{proyecto.titulo}</Text>
              <Space size="middle">
                {proyecto.lider_nombre && (
                  <Tooltip title="Líder del Proyecto">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <TeamOutlined style={{ marginRight: 4 }} />
                      {proyecto.lider_nombre}
                    </Text>
                  </Tooltip>
                )}
                {proyecto.fecha_fin_real && (
                  <Tooltip title="Desarrollo completado">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <CalendarOutlined style={{ marginRight: 4 }} />
                      Completado {dayjs(proyecto.fecha_fin_real).format('DD/MM/YYYY')}
                    </Text>
                  </Tooltip>
                )}
              </Space>
            </Space>
          </Col>
          <Col style={{ minWidth: 160, textAlign: 'right' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />
                  Implementación
                </Text>
                <Text style={{ fontSize: 11 }}>{completadas}/{total}</Text>
              </div>
              <Progress percent={percent} size="small" showInfo={false} strokeColor={INEMEC_RED} />
            </Space>
          </Col>
        </Row>
      </Card>
    </Link>
  )
}

function Implementacion({ linkPrefix = '/nt/proyectos', soloLider = false }) {
  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState([])

  useEffect(() => { loadProyectos() }, [])

  const loadProyectos = async () => {
    try {
      setLoading(true)
      const params = { estado: 'en_implementacion' }
      if (soloLider) params.solo_lider = 'true'
      const res = await proyectosApi.list(params)
      setProyectos(res.data.proyectos || res.data || [])
    } catch (err) {
      console.error('Error loading implementation projects:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ToolOutlined style={{ marginRight: 8 }} />
        Proyectos en Implementación
        <Tag style={{ marginLeft: 12 }}>{proyectos.length}</Tag>
      </Title>

      {proyectos.length === 0 ? (
        <Empty description="No hay proyectos en fase de implementación" />
      ) : (
        proyectos.map(p => (
          <ImplementacionCard key={p.id} proyecto={p} linkPrefix={linkPrefix} />
        ))
      )}
    </div>
  )
}

export default function NTImplementacion() {
  return <Implementacion linkPrefix="/nt/implementacion" soloLider />
}

export { Implementacion }
