import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card, Typography, Progress, Space, Spin, Tag, Descriptions, Alert, Input,
  Button, Result
} from 'antd'
import {
  ProjectOutlined, CalendarOutlined, CheckCircleOutlined,
  PauseCircleOutlined, CloseCircleOutlined, SearchOutlined
} from '@ant-design/icons'
import { solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

// INEMEC Brand Colors
const INEMEC_RED = '#D52B1E'

const estadoConfig = {
  'Programado': { color: 'blue', icon: <CalendarOutlined /> },
  'En Desarrollo': { color: 'processing', icon: <ProjectOutlined /> },
  'Pausado': { color: 'warning', icon: <PauseCircleOutlined /> },
  'Completado': { color: 'success', icon: <CheckCircleOutlined /> },
  'Cancelado': { color: 'error', icon: <CloseCircleOutlined /> }
}

function ProyectoStatus() {
  const { codigo } = useParams()
  const [loading, setLoading] = useState(false)
  const [proyecto, setProyecto] = useState(null)
  const [error, setError] = useState(null)
  const [searchCode, setSearchCode] = useState(codigo || '')

  useEffect(() => {
    if (codigo) {
      loadProyecto(codigo)
    }
  }, [codigo])

  const loadProyecto = async (code) => {
    setLoading(true)
    setError(null)
    try {
      const response = await solicitudesApi.checkProyectoStatus(code)
      setProyecto(response.data.proyecto)
    } catch (err) {
      setError(err.response?.data?.message || 'Proyecto no encontrado')
      setProyecto(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchCode.trim()) {
      loadProyecto(searchCode.trim())
    }
  }

  const config = proyecto ? estadoConfig[proyecto.estado] : null

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a href="https://inemec.com" target="_blank" rel="noopener noreferrer">
            <img
              src="/inemec-logo.png"
              alt="INEMEC"
              style={{ height: 50, marginBottom: 16 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </a>
          <Title level={2} style={{ margin: 0, color: INEMEC_RED }}>
            <ProjectOutlined style={{ marginRight: 12 }} />
            Consulta de Proyecto
          </Title>
          <Paragraph type="secondary">
            Ingrese el código del proyecto para ver su estado y progreso
          </Paragraph>
        </div>

        {/* Search Box */}
        <Card style={{ marginBottom: 24 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              size="large"
              placeholder="Código del proyecto (ej: PRY-2026-0001 o SOL-2026-0001)"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
            />
            <Button
              size="large"
              type="primary"
              onClick={handleSearch}
              loading={loading}
              style={{ backgroundColor: INEMEC_RED, borderColor: INEMEC_RED }}
            >
              Consultar
            </Button>
          </Space.Compact>
        </Card>

        {/* Loading */}
        {loading && (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Buscando proyecto...</div>
          </Card>
        )}

        {/* Error */}
        {error && !loading && (
          <Result
            status="404"
            title="Proyecto no encontrado"
            subTitle={error}
            extra={
              <Link to="/nueva-solicitud">
                <Button type="primary" style={{ backgroundColor: INEMEC_RED, borderColor: INEMEC_RED }}>
                  Crear Nueva Solicitud
                </Button>
              </Link>
            }
          />
        )}

        {/* Project Data */}
        {proyecto && !loading && (
          <Card>
            {/* Estado Header */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Tag
                color={config?.color}
                icon={config?.icon}
                style={{ fontSize: 16, padding: '8px 16px', marginBottom: 16 }}
              >
                {proyecto.estado}
              </Tag>
              <Title level={3} style={{ margin: 0 }}>{proyecto.titulo}</Title>
              <Text type="secondary" style={{ fontSize: 16 }}>{proyecto.codigo}</Text>
              {proyecto.solicitud_codigo && proyecto.solicitud_codigo !== proyecto.codigo && (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Solicitud original: {proyecto.solicitud_codigo}
                  </Text>
                </div>
              )}
            </div>

            {/* Pause Alert */}
            {proyecto.is_paused && (
              <Alert
                type="warning"
                showIcon
                icon={<PauseCircleOutlined />}
                message="Proyecto Pausado Temporalmente"
                description={
                  <div>
                    <div><strong>Motivo:</strong> {proyecto.pause_reason}</div>
                    <div><strong>Desde:</strong> {dayjs(proyecto.pause_since).format('DD/MM/YYYY')}</div>
                  </div>
                }
                style={{ marginBottom: 24 }}
              />
            )}

            {/* Progress */}
            {['En Desarrollo', 'Pausado', 'Completado'].includes(proyecto.estado) && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>Progreso del Proyecto</Title>
                <Progress
                  percent={proyecto.progreso || 0}
                  strokeColor={INEMEC_RED}
                  size="large"
                  format={(p) => `${p}% completado`}
                />
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <Text type="secondary">
                    {proyecto.tareas_completadas} de {proyecto.total_tareas} tareas completadas
                  </Text>
                </div>
              </div>
            )}

            {/* Dates */}
            <Descriptions column={1} size="small" bordered>
              {proyecto.fecha_inicio_programada && (
                <Descriptions.Item label={<><CalendarOutlined /> Fecha de Inicio Programada</>}>
                  {dayjs(proyecto.fecha_inicio_programada).format('DD/MM/YYYY')}
                </Descriptions.Item>
              )}
              {proyecto.fecha_fin_programada && (
                <Descriptions.Item label={<><CalendarOutlined /> Fecha de Fin Programada</>}>
                  {dayjs(proyecto.fecha_fin_programada).format('DD/MM/YYYY')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Contact Info */}
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Paragraph type="secondary">
                Si tiene preguntas sobre el estado de su proyecto, contacte al departamento de Nuevas Tecnologías.
              </Paragraph>
            </div>
          </Card>
        )}

        {/* Footer Links */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Space>
            <Link to="/">
              <Button type="link">Volver al Inicio</Button>
            </Link>
            <Link to="/conocimiento">
              <Button type="link">Portal de Conocimiento</Button>
            </Link>
          </Space>
        </div>
      </div>
    </div>
  )
}

export default ProyectoStatus
