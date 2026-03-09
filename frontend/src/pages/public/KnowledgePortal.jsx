import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Input, Select, Tag, Typography, Spin, Empty } from 'antd'
import { SearchOutlined, BookOutlined, EyeOutlined } from '@ant-design/icons'
import { conocimientoApi } from '../../services/api'

const { Title, Paragraph, Text } = Typography
const { Search } = Input

const VISIBILITY_COLORS = {
  public: 'green',
  nt: 'blue',
  ti: 'orange',
  gerencia: 'purple'
}

const VISIBILITY_LABELS = {
  public: 'Público',
  nt: 'NT',
  ti: 'TI',
  gerencia: 'Gerencia'
}

function KnowledgePortal() {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)

  // Check if user is logged in (to show visibility tags)
  const isLoggedIn = (() => {
    try {
      const authStorage = localStorage.getItem('auth-storage')
      if (authStorage) {
        const { state } = JSON.parse(authStorage)
        return !!state?.token
      }
    } catch (e) { /* ignore */ }
    return false
  })()

  useEffect(() => {
    loadData()
  }, [search, selectedCategory])

  const loadData = async () => {
    setLoading(true)
    try {
      const [articlesRes, categoriesRes] = await Promise.all([
        conocimientoApi.listArticulos({
          search,
          categoria_id: selectedCategory,
          limit: 20
        }),
        conocimientoApi.listCategorias()
      ])
      setArticles(articlesRes.data.articulos)
      setCategories(categoriesRes.data.categorias)
    } catch (error) {
      console.error('Error loading knowledge portal:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>
          <BookOutlined /> Portal de Conocimiento
        </Title>
        <Paragraph type="secondary">
          Documentación técnica, guías y recursos de INEMEC
        </Paragraph>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col flex="auto">
            <Search
              placeholder="Buscar artículos..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={setSearch}
            />
          </Col>
          <Col>
            <Select
              placeholder="Categoría"
              allowClear
              size="large"
              style={{ width: 200 }}
              onChange={setSelectedCategory}
              options={categories.map(c => ({ value: c.id, label: c.nombre }))}
            />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : articles.length === 0 ? (
        <Empty description="No se encontraron artículos" />
      ) : (
        <Row gutter={[24, 24]}>
          {articles.map(article => (
            <Col xs={24} md={12} lg={8} key={article.id}>
              <Link to={`/conocimiento/${article.slug}`}>
                <Card hoverable className="hoverable-card">
                  <Title level={5} style={{ marginBottom: 8 }}>{article.titulo}</Title>
                  <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                    {article.resumen || 'Sin descripción'}
                  </Paragraph>
                  <div style={{ marginTop: 12 }}>
                    {article.etiquetas?.slice(0, 3).map(tag => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary"><EyeOutlined /> {article.vistas} vistas</Text>
                    {isLoggedIn && article.visibilidad && (
                      <div>
                        {(Array.isArray(article.visibilidad) ? article.visibilidad : []).map(v => (
                          <Tag key={v} color={VISIBILITY_COLORS[v]} style={{ fontSize: 10, marginRight: 2 }}>
                            {VISIBILITY_LABELS[v] || v}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}

export default KnowledgePortal
