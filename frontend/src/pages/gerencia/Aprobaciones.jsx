import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Table, Tag, Button, Typography, Input, Row, Col, Spin, Empty,
  Badge, Tooltip, message
} from 'antd'
import {
  EyeOutlined, SearchOutlined, ReloadOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import { solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const prioridadColors = {
  baja: 'green',
  media: 'cyan',
  alta: 'orange',
  critica: 'red'
}

const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Interno',
  proyecto_nuevo_externo: 'Proyecto Externo',
  actualizacion: 'Actualización'
}

function GerenciaAprobaciones() {
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

  useEffect(() => {
    loadSolicitudes()
  }, [pagination.current, pagination.pageSize, search])

  const loadSolicitudes = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        estado: 'pendiente_aprobacion_gerencia',
        tipo: 'proyecto_nuevo_interno,proyecto_nuevo_externo,actualizacion'
      }

      if (search) params.search = search

      const response = await solicitudesApi.list(params)
      setSolicitudes(response.data.solicitudes || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('Error loading solicitudes:', error)
      message.error('Error al cargar solicitudes')
    } finally {
      setLoading(false)
    }
  }

  const handleTableChange = (newPagination) => {
    setPagination(newPagination)
  }

  // Calculate days waiting
  const getDaysWaiting = (createdAt) => {
    return dayjs().diff(dayjs(createdAt), 'day')
  }

  const columns = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      key: 'codigo',
      width: 140,
      render: (codigo, record) => (
        <Link to={`/gerencia/aprobaciones/${record.id}`}>
          <Text strong style={{ color: '#1890ff' }}>{codigo}</Text>
        </Link>
      )
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      ellipsis: true,
      render: (titulo, record) => (
        <Tooltip title={titulo}>
          <div>
            <Text>{titulo}</Text>
            {record.evaluacion_recomendacion && (
              <div>
                <Tag
                  color={
                    record.evaluacion_recomendacion === 'aprobar' ? 'success' :
                    record.evaluacion_recomendacion === 'rechazar' ? 'error' : 'warning'
                  }
                  style={{ fontSize: 10 }}
                >
                  NT recomienda: {record.evaluacion_recomendacion}
                </Tag>
              </div>
            )}
          </div>
        </Tooltip>
      )
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 140,
      render: (tipo) => <Tag>{tipoLabels[tipo] || tipo}</Tag>
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      key: 'prioridad',
      width: 100,
      render: (prioridad) => (
        <Tag color={prioridadColors[prioridad]}>{prioridad?.toUpperCase()}</Tag>
      )
    },
    {
      title: 'Solicitante',
      dataIndex: 'datos_solicitante',
      key: 'solicitante',
      width: 150,
      render: (solicitante) => (
        <Text type="secondary">{solicitante?.nombre_completo || solicitante?.nombre || '-'}</Text>
      )
    },
    {
      title: 'Esperando',
      dataIndex: 'creado_en',
      key: 'esperando',
      width: 100,
      render: (creado_en) => {
        const days = getDaysWaiting(creado_en)
        return (
          <Tooltip title={`Creado: ${dayjs(creado_en).format('DD/MM/YYYY')}`}>
            <Badge
              count={`${days}d`}
              style={{
                backgroundColor: days > 7 ? '#ff4d4f' : days > 3 ? '#faad14' : '#52c41a'
              }}
            />
          </Tooltip>
        )
      }
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Link to={`/gerencia/aprobaciones/${record.id}`}>
          <Button type="primary" size="small" icon={<EyeOutlined />}>
            Revisar
          </Button>
        </Link>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>Aprobaciones Pendientes</Title>
          <Text type="secondary">Proyectos escalados por NT que requieren su aprobación</Text>
        </div>
        <Badge count={total} overflowCount={99}>
          <Tag color="processing" icon={<ClockCircleOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
            Pendientes
          </Tag>
        </Badge>
      </div>

      {/* Search */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input
              placeholder="Buscar por código o título..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Tooltip title="Recargar">
              <Button icon={<ReloadOutlined />} onClick={loadSolicitudes} />
            </Tooltip>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : solicitudes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No hay solicitudes pendientes de aprobación"
          />
        ) : (
          <Table
            dataSource={solicitudes}
            columns={columns}
            rowKey="id"
            pagination={{
              ...pagination,
              total,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} solicitudes`
            }}
            onChange={handleTableChange}
            scroll={{ x: 900 }}
            rowClassName={(record) => {
              const days = getDaysWaiting(record.creado_en)
              if (days > 7) return 'row-urgent'
              if (days > 3) return 'row-warning'
              return ''
            }}
          />
        )}
      </Card>

      <style>{`
        .row-urgent {
          background-color: #fff2f0;
        }
        .row-urgent:hover > td {
          background-color: #ffccc7 !important;
        }
        .row-warning {
          background-color: #fffbe6;
        }
        .row-warning:hover > td {
          background-color: #fff1b8 !important;
        }
      `}</style>
    </div>
  )
}

export default GerenciaAprobaciones
