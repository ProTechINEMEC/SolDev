import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Typography, Tag, Spin, Button, Divider, Row, Col, List } from 'antd'
import { ArrowLeftOutlined, EyeOutlined, CalendarOutlined, UserOutlined, FilePdfOutlined, DownloadOutlined } from '@ant-design/icons'
import { conocimientoApi, archivosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography

function ArticleView() {
  const { slug } = useParams()
  const [article, setArticle] = useState(null)
  const [related, setRelated] = useState([])
  const [archivos, setArchivos] = useState([])
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
      setArchivos(response.data.archivos || [])
    } catch (error) {
      console.error('Error loading article:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
          className="article-content"
          style={{ lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: article.contenido || '' }}
        />
      </Card>

      {/* PDF Attachments */}
      {archivos.length > 0 && (
        <Card title={<><FilePdfOutlined /> Archivos Adjuntos</>} style={{ marginTop: 24 }}>
          <List
            dataSource={archivos}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Button
                    key="download"
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    href={archivosApi.getDownloadUrl(file.id)}
                    target="_blank"
                  >
                    Descargar
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<FilePdfOutlined style={{ fontSize: 24, color: '#D52B1E' }} />}
                  title={file.nombre_original}
                  description={formatFileSize(file.tamano)}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Related Articles */}
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

      <style>{`
        .article-content h1 { font-size: 1.8em; margin: 1em 0 0.5em; color: #1a1a1a; }
        .article-content h2 { font-size: 1.5em; margin: 1em 0 0.5em; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        .article-content h3 { font-size: 1.25em; margin: 1em 0 0.5em; color: #333; }
        .article-content h4 { font-size: 1.1em; margin: 0.8em 0 0.4em; color: #333; }
        .article-content p { margin: 0.8em 0; }
        .article-content ul, .article-content ol { padding-left: 2em; margin: 0.5em 0; }
        .article-content li { margin: 0.3em 0; }
        .article-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .article-content th, .article-content td { border: 1px solid #d9d9d9; padding: 8px 12px; text-align: left; }
        .article-content th { background: #fafafa; font-weight: 600; }
        .article-content tr:nth-child(even) { background: #fafafa; }
        .article-content blockquote { border-left: 4px solid #D52B1E; padding: 8px 16px; margin: 1em 0; background: #fff7f6; color: #333; }
        .article-content pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
        .article-content code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
        .article-content pre code { background: none; padding: 0; }
        .article-content img { max-width: 100%; height: auto; border-radius: 4px; }
        .article-content a { color: #1677ff; }
        .article-content a:hover { color: #4096ff; }
      `}</style>
    </div>
  )
}

export default ArticleView
