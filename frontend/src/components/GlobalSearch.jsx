/**
 * GlobalSearch Component
 * Search modal for searching across all entities
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Modal, List, Tag, Empty, Spin, Typography, Space, Divider } from 'antd'
import {
  SearchOutlined, FileTextOutlined, ProjectOutlined,
  ToolOutlined, BookOutlined
} from '@ant-design/icons'
import api from '../services/api'

// Simple debounce utility
const debounce = (fn, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

const { Text } = Typography

// Entity configuration
const entityConfig = {
  solicitud: {
    icon: <FileTextOutlined />,
    color: 'red',
    label: 'Solicitud',
    getPath: (item) => `/nt/solicitudes/${item.id}`
  },
  proyecto: {
    icon: <ProjectOutlined />,
    color: 'green',
    label: 'Proyecto',
    getPath: (item) => `/nt/proyectos/${item.id}`
  },
  ticket: {
    icon: <ToolOutlined />,
    color: 'orange',
    label: 'Ticket',
    getPath: (item) => `/ti/tickets/${item.id}`
  },
  articulo: {
    icon: <BookOutlined />,
    color: 'purple',
    label: 'Articulo',
    getPath: (item) => `/conocimiento/${item.slug}`
  }
}

function GlobalSearch() {
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({
    solicitudes: [],
    proyectos: [],
    tickets: [],
    articulos: []
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setVisible(true)
      }
      if (e.key === 'Escape' && visible) {
        setVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible])

  // Debounced search function
  const search = useCallback(
    debounce(async (q) => {
      if (q.length < 2) {
        setResults({ solicitudes: [], proyectos: [], tickets: [], articulos: [] })
        return
      }

      setLoading(true)
      try {
        const response = await api.get('/search', { params: { q, limit: 8 } })
        setResults(response.data.results)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  const handleSearch = (value) => {
    setQuery(value)
    search(value)
  }

  const handleSelect = (item, type) => {
    setVisible(false)
    setQuery('')
    setResults({ solicitudes: [], proyectos: [], tickets: [], articulos: [] })

    const config = entityConfig[type]
    if (config) {
      navigate(config.getPath(item))
    }
  }

  const handleClose = () => {
    setVisible(false)
    setQuery('')
    setResults({ solicitudes: [], proyectos: [], tickets: [], articulos: [] })
  }

  // Flatten results for display
  const allResults = [
    ...results.solicitudes.map(s => ({ ...s, _type: 'solicitud' })),
    ...results.proyectos.map(p => ({ ...p, _type: 'proyecto' })),
    ...results.tickets.map(t => ({ ...t, _type: 'ticket' })),
    ...results.articulos.map(a => ({ ...a, _type: 'articulo' }))
  ]

  // Count by type
  const counts = {
    solicitudes: results.solicitudes.length,
    proyectos: results.proyectos.length,
    tickets: results.tickets.length,
    articulos: results.articulos.length
  }

  const totalResults = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <>
      {/* Search Trigger */}
      <Input
        placeholder="Buscar... (Ctrl+K)"
        prefix={<SearchOutlined />}
        onClick={() => setVisible(true)}
        style={{ width: 200, cursor: 'pointer' }}
        readOnly
      />

      {/* Search Modal */}
      <Modal
        title={
          <Space>
            <SearchOutlined />
            <span>Busqueda Global</span>
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={650}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px 24px' }}>
          <Input
            placeholder="Buscar solicitudes, proyectos, tickets, articulos..."
            prefix={<SearchOutlined />}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
            allowClear
            size="large"
          />
        </div>

        <Divider style={{ margin: 0 }} />

        <div style={{ maxHeight: 400, overflow: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin tip="Buscando..." />
            </div>
          ) : query.length < 2 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Escriba al menos 2 caracteres para buscar</Text>
            </div>
          ) : totalResults === 0 ? (
            <Empty
              description={`Sin resultados para "${query}"`}
              style={{ padding: 40 }}
            />
          ) : (
            <>
              {/* Results summary */}
              <div style={{ padding: '8px 24px' }}>
                <Space size={12}>
                  <Text type="secondary">{totalResults} resultados:</Text>
                  {counts.solicitudes > 0 && (
                    <Tag color="red">{counts.solicitudes} solicitudes</Tag>
                  )}
                  {counts.proyectos > 0 && (
                    <Tag color="green">{counts.proyectos} proyectos</Tag>
                  )}
                  {counts.tickets > 0 && (
                    <Tag color="orange">{counts.tickets} tickets</Tag>
                  )}
                  {counts.articulos > 0 && (
                    <Tag color="purple">{counts.articulos} articulos</Tag>
                  )}
                </Space>
              </div>

              {/* Results list */}
              <List
                dataSource={allResults}
                renderItem={(item) => {
                  const config = entityConfig[item._type]
                  return (
                    <List.Item
                      onClick={() => handleSelect(item, item._type)}
                      style={{
                        padding: '12px 24px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <List.Item.Meta
                        avatar={
                          <span style={{
                            fontSize: 20,
                            color: `var(--ant-color-${config.color})`
                          }}>
                            {config.icon}
                          </span>
                        }
                        title={
                          <Space>
                            <Tag color={config.color}>{config.label}</Tag>
                            <Text strong>{item.codigo || item.titulo}</Text>
                          </Space>
                        }
                        description={
                          <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
                            {item.titulo || item.resumen || item.descripcion}
                          </Text>
                        }
                      />
                      {item.estado && (
                        <Tag style={{ marginLeft: 8 }}>
                          {item.estado.replace(/_/g, ' ')}
                        </Tag>
                      )}
                    </List.Item>
                  )
                }}
              />
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa'
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Presione <Tag style={{ marginLeft: 4, marginRight: 4 }}>ESC</Tag> para cerrar
            o <Tag style={{ marginLeft: 4, marginRight: 4 }}>Enter</Tag> para seleccionar
          </Text>
        </div>
      </Modal>
    </>
  )
}

export default GlobalSearch
