import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Table, Tag, Input, Select, Space, Button, Typography,
  DatePicker, Row, Col, Empty, Spin, Tooltip
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, FileTextOutlined,
  DownOutlined, RightOutlined
} from '@ant-design/icons'
import { solicitudesApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// Status configuration - display order for list
const statusConfig = {
  pendiente_evaluacion_nt: { text: 'Pendiente', order: 1, group: 'Pendiente' },
  pendiente_reevaluacion: { text: 'Requiere Revisión', order: 2, group: 'Requiere Revisión' },
  en_estudio: { text: 'En Estudio', order: 3, group: 'En Estudio' },
  agendado: { text: 'Agendado', order: 4, group: 'Agendado' },
  // All others go to "Otros" group (order 5)
  pendiente_aprobacion_gerencia: { text: 'En Gerencia', order: 5, group: 'Otros', subOrder: 1 },
  aprobado: { text: 'Aprobado', order: 5, group: 'Otros', subOrder: 2 },
  en_desarrollo: { text: 'En Desarrollo', order: 5, group: 'Otros', subOrder: 3 },
  stand_by: { text: 'En Espera', order: 5, group: 'Otros', subOrder: 4 },
  completado: { text: 'Completado', order: 5, group: 'Otros', subOrder: 5 },
  transferido_ti: { text: 'Transferido a TI', order: 5, group: 'Otros', subOrder: 6 },
  descartado_nt: { text: 'Descartado', order: 5, group: 'Otros', subOrder: 7 },
  rechazado_gerencia: { text: 'Rechazado', order: 5, group: 'Otros', subOrder: 8 },
  cancelado: { text: 'Cancelado', order: 5, group: 'Otros', subOrder: 9 }
}

const tipoConfig = {
  proyecto_nuevo_interno: { text: 'Proyecto Interno', order: 1 },
  proyecto_nuevo_externo: { text: 'Proyecto Externo', order: 2 },
  actualizacion: { text: 'Actualización', order: 3 },
  reporte_fallo: { text: 'Reporte de Fallo', order: 4 },
  cierre_servicio: { text: 'Cierre de Servicio', order: 5 },
  transferido_ti: { text: 'Transferido de TI', order: 6 }
}

const prioridadConfig = {
  critica: { color: 'red', text: 'Crítica', order: 1 },
  alta: { color: 'orange', text: 'Alta', order: 2 },
  media: { color: 'cyan', text: 'Media', order: 3 },
  baja: { color: 'green', text: 'Baja', order: 4 }
}

// Group display order
const groupOrder = ['Pendiente', 'Requiere Revisión', 'En Estudio', 'Agendado', 'Otros']

// Default collapse preferences (when group has items)
const defaultCollapsed = {
  'Pendiente': false,
  'Requiere Revisión': false,
  'En Estudio': false,
  'Agendado': true,
  'Otros': true
}

function NTSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState(defaultCollapsed)

  // Search state
  const [searchParams, setSearchParams] = useState({
    codigo: '',
    titulo: '',
    tipo: null,
    estado: null,
    prioridad: null,
    solicitante: '',
    fecha: null
  })
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    loadAllSolicitudes()
  }, [])

  const loadAllSolicitudes = async () => {
    setLoading(true)
    try {
      const response = await solicitudesApi.list({ limit: 500 })
      setSolicitudes(response.data.solicitudes || [])
    } catch (error) {
      console.error('Error loading solicitudes:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (groupName) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  // Check if any search param has a value
  const hasSearchCriteria = useMemo(() => {
    return (
      searchParams.codigo.trim() !== '' ||
      searchParams.titulo.trim() !== '' ||
      searchParams.tipo !== null ||
      searchParams.estado !== null ||
      searchParams.prioridad !== null ||
      searchParams.solicitante.trim() !== '' ||
      searchParams.fecha !== null
    )
  }, [searchParams])

  // Perform search
  const handleSearch = async () => {
    if (!hasSearchCriteria) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      let results = [...solicitudes]

      if (searchParams.codigo.trim()) {
        results = results.filter(s =>
          s.codigo?.toLowerCase().includes(searchParams.codigo.toLowerCase())
        )
      }

      if (searchParams.titulo.trim()) {
        results = results.filter(s =>
          s.titulo?.toLowerCase().includes(searchParams.titulo.toLowerCase())
        )
      }

      if (searchParams.tipo) {
        results = results.filter(s => s.tipo === searchParams.tipo)
      }

      if (searchParams.estado) {
        results = results.filter(s => s.estado === searchParams.estado)
      }

      if (searchParams.prioridad) {
        results = results.filter(s => s.prioridad === searchParams.prioridad)
      }

      if (searchParams.solicitante.trim()) {
        const searchTerm = searchParams.solicitante.toLowerCase()
        results = results.filter(s => {
          const nombre = s.datos_solicitante?.nombre_completo || s.datos_solicitante?.nombre || s.solicitante_nombre || ''
          return nombre.toLowerCase().includes(searchTerm)
        })
      }

      if (searchParams.fecha) {
        results = results.filter(s => {
          const fecha = dayjs(s.creado_en)
          return fecha.isSame(searchParams.fecha, 'day')
        })
      }

      setSearchResults(results)
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchParams({
      codigo: '',
      titulo: '',
      tipo: null,
      estado: null,
      prioridad: null,
      solicitante: '',
      fecha: null
    })
    setSearchResults([])
  }

  // Group solicitudes by state group and sort
  const groupedData = useMemo(() => {
    const groups = {}
    groupOrder.forEach(g => { groups[g] = [] })

    solicitudes.forEach(item => {
      const group = statusConfig[item.estado]?.group || 'Otros'
      if (groups[group]) {
        groups[group].push(item)
      } else {
        groups['Otros'].push(item)
      }
    })

    // Sort items within each group
    Object.keys(groups).forEach(g => {
      if (g === 'Otros') {
        // Otros: sort by state -> date -> priority
        groups[g] = [...groups[g]].sort((a, b) => {
          const stateA = statusConfig[a.estado]?.subOrder || 99
          const stateB = statusConfig[b.estado]?.subOrder || 99
          if (stateA !== stateB) return stateA - stateB

          const dateA = dayjs(a.creado_en).valueOf()
          const dateB = dayjs(b.creado_en).valueOf()
          if (dateA !== dateB) return dateB - dateA // newest first

          const prioA = prioridadConfig[a.prioridad]?.order || 99
          const prioB = prioridadConfig[b.prioridad]?.order || 99
          return prioA - prioB
        })
      } else {
        // Other groups: sort by priority -> date
        groups[g] = [...groups[g]].sort((a, b) => {
          const prioA = prioridadConfig[a.prioridad]?.order || 99
          const prioB = prioridadConfig[b.prioridad]?.order || 99
          if (prioA !== prioB) return prioA - prioB
          return dayjs(b.creado_en).valueOf() - dayjs(a.creado_en).valueOf()
        })
      }
    })

    return groups
  }, [solicitudes])

  // Update collapsed state when data changes - empty groups should be collapsed
  useEffect(() => {
    const newCollapsed = {}
    groupOrder.forEach(g => {
      const hasItems = (groupedData[g] || []).length > 0
      // If empty, always collapse. If has items, use default preference
      newCollapsed[g] = hasItems ? defaultCollapsed[g] : true
    })
    setCollapsedGroups(newCollapsed)
  }, [groupedData])

  // Table columns
  const columns = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      width: 145,
      render: (code, record) => (
        <Link to={`/nt/solicitudes/${record.id}`}>
          <Text strong style={{ color: '#1890ff', whiteSpace: 'nowrap' }}>{code}</Text>
        </Link>
      )
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      ellipsis: true,
      render: (titulo) => (
        <Tooltip title={titulo} placement="topLeft" mouseEnterDelay={0.3}>
          <span style={{ cursor: 'default' }}>{titulo}</span>
        </Tooltip>
      )
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      width: 150,
      render: (tipo) => <Tag style={{ whiteSpace: 'nowrap' }}>{tipoConfig[tipo]?.text || tipo}</Tag>
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 140,
      render: (estado) => <Tag style={{ whiteSpace: 'nowrap' }}>{statusConfig[estado]?.text || estado}</Tag>
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      width: 90,
      render: (prioridad) => (
        <Tag color={prioridadConfig[prioridad]?.color} style={{ whiteSpace: 'nowrap' }}>
          {prioridadConfig[prioridad]?.text}
        </Tag>
      )
    },
    {
      title: 'Solicitante',
      dataIndex: 'datos_solicitante',
      width: 180,
      ellipsis: true,
      render: (d, record) => {
        const nombre = d?.nombre_completo || d?.nombre || record.solicitante_nombre || '-'
        return (
          <Tooltip title={nombre} placement="topLeft" mouseEnterDelay={0.3}>
            <span style={{ cursor: 'default' }}>{nombre}</span>
          </Tooltip>
        )
      }
    },
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      width: 100,
      render: (d) => <span style={{ whiteSpace: 'nowrap' }}>{dayjs(d).format('DD/MM/YYYY')}</span>
    }
  ]

  // Search results columns
  const searchColumns = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      width: 145,
      render: (code, record) => (
        <Link to={`/nt/solicitudes/${record.id}`}>
          <Text strong style={{ color: '#1890ff', whiteSpace: 'nowrap' }}>{code}</Text>
        </Link>
      )
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      ellipsis: true,
      render: (titulo) => (
        <Tooltip title={titulo} placement="topLeft" mouseEnterDelay={0.3}>
          <span style={{ cursor: 'default' }}>{titulo}</span>
        </Tooltip>
      )
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      width: 150,
      render: (t) => <Tag style={{ whiteSpace: 'nowrap' }}>{tipoConfig[t]?.text || t}</Tag>
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 140,
      render: (s) => <Tag style={{ whiteSpace: 'nowrap' }}>{statusConfig[s]?.text || s}</Tag>
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      width: 90,
      render: (p) => <Tag color={prioridadConfig[p]?.color} style={{ whiteSpace: 'nowrap' }}>{prioridadConfig[p]?.text}</Tag>
    },
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      width: 100,
      render: (d) => <span style={{ whiteSpace: 'nowrap' }}>{dayjs(d).format('DD/MM/YYYY')}</span>
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Solicitudes
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadAllSolicitudes} loading={loading}>
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Cargando solicitudes...</div>
        </div>
      ) : (
        <>
          {/* Page Header */}
          <div style={{
            marginBottom: 16,
            padding: '16px 20px',
            background: '#fff',
            borderLeft: '4px solid #D52B1E',
            borderRadius: 4,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <Title level={4} style={{ margin: 0, marginBottom: 4, color: '#262626' }}>
              Gestión de Solicitudes
            </Title>
            <Text type="secondary">
              Solicitudes de proyectos, actualizaciones, reportes de fallo y cierres de servicio.
            </Text>
          </div>

          {/* Grouped List with Collapsible Sections */}
          <Card style={{ marginBottom: 24 }}>
            {solicitudes.length === 0 ? (
              <Empty description="No hay solicitudes" />
            ) : (
              groupOrder.map((groupName, groupIndex) => {
                const items = groupedData[groupName] || []
                const isCollapsed = collapsedGroups[groupName]

                return (
                  <div key={groupName} style={{ marginBottom: groupIndex < groupOrder.length - 1 ? 16 : 0 }}>
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleGroup(groupName)}
                      style={{
                        background: '#fafafa',
                        padding: '12px 16px',
                        borderBottom: isCollapsed ? 'none' : '1px solid #d9d9d9',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        userSelect: 'none',
                        borderRadius: isCollapsed ? 4 : '4px 4px 0 0',
                        marginBottom: isCollapsed ? 8 : 0
                      }}
                    >
                      {isCollapsed ? (
                        <RightOutlined style={{ marginRight: 8, fontSize: 12 }} />
                      ) : (
                        <DownOutlined style={{ marginRight: 8, fontSize: 12 }} />
                      )}
                      <Text strong style={{ fontSize: 14 }}>
                        {groupName}
                      </Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({items.length})
                      </Text>
                    </div>

                    {/* Table (hidden when collapsed) */}
                    {!isCollapsed && (
                      items.length > 0 ? (
                        <Table
                          dataSource={items}
                          columns={columns}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          style={{ marginBottom: 8 }}
                        />
                      ) : (
                        <div style={{
                          padding: '24px',
                          textAlign: 'center',
                          background: '#fff',
                          borderBottom: '1px solid #f0f0f0',
                          marginBottom: 8
                        }}>
                          <Text type="secondary">No hay solicitudes en este estado</Text>
                        </div>
                      )
                    )}
                  </div>
                )
              })
            )}
          </Card>

          {/* Advanced Search */}
          <Card title="Búsqueda Avanzada">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="Código"
                  prefix={<SearchOutlined />}
                  value={searchParams.codigo}
                  onChange={(e) => setSearchParams(p => ({ ...p, codigo: e.target.value }))}
                  onPressEnter={handleSearch}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="Título"
                  value={searchParams.titulo}
                  onChange={(e) => setSearchParams(p => ({ ...p, titulo: e.target.value }))}
                  onPressEnter={handleSearch}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Tipo"
                  style={{ width: '100%' }}
                  allowClear
                  value={searchParams.tipo}
                  onChange={(v) => setSearchParams(p => ({ ...p, tipo: v }))}
                >
                  {Object.entries(tipoConfig).map(([key, val]) => (
                    <Select.Option key={key} value={key}>{val.text}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Estado"
                  style={{ width: '100%' }}
                  allowClear
                  value={searchParams.estado}
                  onChange={(v) => setSearchParams(p => ({ ...p, estado: v }))}
                >
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <Select.Option key={key} value={key}>{val.text}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Prioridad"
                  style={{ width: '100%' }}
                  allowClear
                  value={searchParams.prioridad}
                  onChange={(v) => setSearchParams(p => ({ ...p, prioridad: v }))}
                >
                  {Object.entries(prioridadConfig).map(([key, val]) => (
                    <Select.Option key={key} value={key}>
                      <Tag color={val.color}>{val.text}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="Solicitante"
                  value={searchParams.solicitante}
                  onChange={(e) => setSearchParams(p => ({ ...p, solicitante: e.target.value }))}
                  onPressEnter={handleSearch}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Fecha de Creación"
                  value={searchParams.fecha}
                  onChange={(date) => setSearchParams(p => ({ ...p, fecha: date }))}
                  format="DD/MM/YYYY"
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                    loading={searchLoading}
                    disabled={!hasSearchCriteria}
                  >
                    Buscar
                  </Button>
                  <Button onClick={clearSearch}>Limpiar</Button>
                </Space>
              </Col>
            </Row>

            {/* Search Results */}
            {hasSearchCriteria && searchResults.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  Resultados ({searchResults.length})
                </Text>
                <Table
                  dataSource={searchResults}
                  columns={searchColumns}
                  rowKey="id"
                  size="small"
                  pagination={searchResults.length > 10 ? { pageSize: 10 } : false}
                />
              </div>
            )}

            {hasSearchCriteria && searchResults.length === 0 && !searchLoading && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Empty description="No se encontraron resultados" />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default NTSolicitudes
