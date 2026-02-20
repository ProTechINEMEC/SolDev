import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Typography, Tag, Spin, Button, Divider, Row, Col } from 'antd'
import { ArrowLeftOutlined, EyeOutlined, CalendarOutlined, UserOutlined } from '@ant-design/icons'
import { conocimientoApi } from '../../services/api'
import { marked } from 'marked'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography

function ArticleView() {
  const { slug } = useParams()
  const [article, setArticle] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadArticle()
  }, [slug])

  const loadArticle = async () => {
    setLoading(true)
    try {
      const response = await conocimientoApi.getArticulo(slug)
      setArticle(response.data.articulo)
      setRelated(response.data.relacionados || [])
    } catch (error) {
      console.error('Error loading article:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!article) {
    return (
      <Card style={{ textAlign: 'center' }}>
        <Title level={4}>Artículo no encontrado</Title>
        <Link to="/conocimiento">
          <Button icon={<ArrowLeftOutlined />}>Volver al portal</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link to="/conocimiento">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Volver al portal
        </Button>
      </Link>

      <Card>
        <Title level={2}>{article.titulo}</Title>

        <div style={{ marginBottom: 24, color: '#8c8c8c' }}>
          <UserOutlined /> {article.autor_nombre || 'Anónimo'} &nbsp;|&nbsp;
          <CalendarOutlined /> {dayjs(article.creado_en).format('DD/MM/YYYY')} &nbsp;|&nbsp;
          <EyeOutlined /> {article.vistas} vistas
        </div>

        {article.etiquetas?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {article.etiquetas.map(tag => (
              <Tag key={tag} color="purple">{tag}</Tag>
            ))}
          </div>
        )}

        <Divider />

        <div
          className="markdown-content"
          style={{ lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: marked.parse(article.contenido || '') }}
        />
      </Card>

      {related.length > 0 && (
        <Card title="Artículos Relacionados" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            {related.map(rel => (
              <Col key={rel.id} xs={24} md={8}>
                <Link to={`/conocimiento/${rel.slug}`}>
                  <Card size="small" hoverable>
                    <Text strong>{rel.titulo}</Text>
                    <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                      {rel.resumen}
                    </Paragraph>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  )
}

export default ArticleView
