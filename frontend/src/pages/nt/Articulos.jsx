import { useState, useEffect, useMemo } from 'react'
import {
  Card, Table, Tag, Button, Space, Typography, Input, Select, Modal,
  Form, message, Popconfirm, Switch, Row, Col, Checkbox, Upload, List, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, UploadOutlined, FilePdfOutlined, DownloadOutlined
} from '@ant-design/icons'
import { conocimientoApi, archivosApi } from '../../services/api'
import dayjs from 'dayjs'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

const { Title, Text } = Typography
const { TextArea } = Input

const VISIBILITY_OPTIONS = [
  { label: 'Público', value: 'public' },
  { label: 'Nuevas Tecnologías', value: 'nt' },
  { label: 'TI', value: 'ti' },
  { label: 'Gerencia', value: 'gerencia' }
]

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

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean']
  ]
}

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align',
  'list', 'bullet', 'blockquote', 'code-block',
  'link', 'image'
]

function NTArticulos() {
  const [articulos, setArticulos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [filters, setFilters] = useState({ search: '', categoria_id: null })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })
  const [form] = Form.useForm()
  const [categoryForm] = Form.useForm()
  const [contenido, setContenido] = useState('')
  const [allArticles, setAllArticles] = useState([])
  const [articlePDFs, setArticlePDFs] = useState([])
  const [uploadingPDF, setUploadingPDF] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadArticulos()
    loadCategorias()
    loadAllArticlesForRelated()
  }, [filters, pagination.page])

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const response = await conocimientoApi.listArticulos({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      })
      setArticulos(response.data.articulos || [])
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0
      }))
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al cargar artículos')
    } finally {
      setLoading(false)
    }
  }

  const loadCategorias = async () => {
    try {
      const response = await conocimientoApi.listCategorias()
      setCategorias(response.data.categorias || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadAllArticlesForRelated = async () => {
    try {
      const response = await conocimientoApi.listArticulos({ limit: 200 })
      setAllArticles(response.data.articulos || [])
    } catch (error) {
      console.error('Error loading articles for related:', error)
    }
  }

  const loadArticlePDFs = async (articleId) => {
    try {
      const response = await conocimientoApi.getArticulo(articleId)
      setArticlePDFs(response.data.archivos || [])
    } catch (error) {
      setArticlePDFs([])
    }
  }

  const handleCreate = () => {
    setEditingArticle(null)
    form.resetFields()
    form.setFieldsValue({
      publicado: false,
      etiquetas: [],
      visibilidad: ['public'],
      articulos_relacionados: []
    })
    setContenido('')
    setArticlePDFs([])
    setModalVisible(true)
  }

  const handleEdit = async (article) => {
    setEditingArticle(article)
    const vis = Array.isArray(article.visibilidad) ? article.visibilidad : ['public']
    const related = Array.isArray(article.articulos_relacionados) ? article.articulos_relacionados : []
    form.setFieldsValue({
      ...article,
      etiquetas: article.etiquetas?.join(', ') || '',
      visibilidad: vis,
      articulos_relacionados: related
    })
    setContenido(article.contenido || '')
    await loadArticlePDFs(article.id)
    setModalVisible(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const values = await form.validateFields()
      const data = {
        ...values,
        contenido,
        etiquetas: Array.isArray(values.etiquetas)
          ? values.etiquetas
          : values.etiquetas
            ? values.etiquetas.split(',').map(t => t.trim()).filter(Boolean)
            : [],
        visibilidad: values.visibilidad || ['public'],
        articulos_relacionados: values.articulos_relacionados || []
      }

      if (!contenido || contenido.replace(/<[^>]*>/g, '').trim().length < 10) {
        message.error('El contenido debe tener al menos 10 caracteres')
        return
      }

      if (editingArticle) {
        await conocimientoApi.updateArticulo(editingArticle.id, data)
        message.success('Artículo actualizado')
      } else {
        await conocimientoApi.createArticulo(data)
        message.success('Artículo creado')
      }
      setModalVisible(false)
      loadArticulos()
      loadAllArticlesForRelated()
    } catch (error) {
      message.error(error.message || 'Error al guardar artículo')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await conocimientoApi.deleteArticulo(id)
      message.success('Artículo eliminado')
      loadArticulos()
      loadAllArticlesForRelated()
    } catch (error) {
      message.error('Error al eliminar artículo')
    }
  }

  const handleTogglePublish = async (article) => {
    try {
      await conocimientoApi.updateArticulo(article.id, { publicado: !article.publicado })
      message.success(article.publicado ? 'Artículo despublicado' : 'Artículo publicado')
      loadArticulos()
    } catch (error) {
      message.error('Error al cambiar estado de publicación')
    }
  }

  const handleCreateCategory = async () => {
    try {
      const values = await categoryForm.validateFields()
      await conocimientoApi.createCategoria(values)
      message.success('Categoría creada')
      setCategoryModalVisible(false)
      categoryForm.resetFields()
      loadCategorias()
    } catch (error) {
      message.error(error.message || 'Error al crear categoría')
    }
  }

  const handleUploadPDF = async (info) => {
    if (!editingArticle) {
      message.warning('Guarde el artículo primero antes de subir PDFs')
      return
    }
    const file = info.file
    if (file.type !== 'application/pdf') {
      message.error('Solo archivos PDF')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      message.error('Máximo 25MB por archivo')
      return
    }
    setUploadingPDF(true)
    try {
      const formData = new FormData()
      formData.append('pdfs', file)
      await conocimientoApi.uploadPDFs(editingArticle.id, formData)
      message.success('PDF subido')
      await loadArticlePDFs(editingArticle.id)
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al subir PDF')
    } finally {
      setUploadingPDF(false)
    }
  }

  const handleDeletePDF = async (fileId) => {
    if (!editingArticle) return
    try {
      await conocimientoApi.deletePDF(editingArticle.id, fileId)
      message.success('PDF eliminado')
      await loadArticlePDFs(editingArticle.id)
    } catch (error) {
      message.error('Error al eliminar PDF')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Filter out current article from related articles dropdown
  const relatedArticleOptions = useMemo(() => {
    return allArticles
      .filter(a => a.publicado && (!editingArticle || a.id !== editingArticle.id))
      .map(a => ({ value: a.id, label: a.titulo }))
  }, [allArticles, editingArticle])

  const columns = [
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      render: (titulo, record) => (
        <div>
          <Text strong>{titulo}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.slug}</Text>
        </div>
      )
    },
    {
      title: 'Categoría',
      dataIndex: 'categoria_nombre',
      key: 'categoria',
      render: (cat) => cat || <Text type="secondary">Sin categoría</Text>
    },
    {
      title: 'Visibilidad',
      dataIndex: 'visibilidad',
      key: 'visibilidad',
      render: (vis) => {
        const arr = Array.isArray(vis) ? vis : ['public']
        return (
          <Space size={2} wrap>
            {arr.map(v => (
              <Tag key={v} color={VISIBILITY_COLORS[v] || 'default'} style={{ fontSize: 11 }}>
                {VISIBILITY_LABELS[v] || v}
              </Tag>
            ))}
          </Space>
        )
      }
    },
    {
      title: 'Estado',
      dataIndex: 'publicado',
      key: 'publicado',
      render: (pub, record) => (
        <Switch
          checked={pub}
          checkedChildren="Publicado"
          unCheckedChildren="Borrador"
          onChange={() => handleTogglePublish(record)}
        />
      )
    },
    {
      title: 'Vistas',
      dataIndex: 'vistas',
      key: 'vistas',
      render: (v) => v || 0
    },
    {
      title: 'Autor',
      dataIndex: 'autor_nombre',
      key: 'autor'
    },
    {
      title: 'Fecha',
      dataIndex: 'creado_en',
      key: 'fecha',
      render: (d) => dayjs(d).format('DD/MM/YYYY')
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            href={`/conocimiento/${record.slug}`}
            target="_blank"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="¿Eliminar este artículo?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3}>Gestión de Artículos</Title>
        <Space>
          <Button onClick={() => setCategoryModalVisible(true)}>
            Nueva Categoría
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Nuevo Artículo
          </Button>
        </Space>
      </div>

      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Buscar artículos..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onPressEnter={loadArticulos}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filtrar por categoría"
              value={filters.categoria_id}
              onChange={(v) => setFilters({ ...filters, categoria_id: v })}
              style={{ width: '100%' }}
              allowClear
            >
              {categorias.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.nombre}</Select.Option>
              ))}
            </Select>
          </Col>
        </Row>

        <Table
          dataSource={articulos}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page) => setPagination(prev => ({ ...prev, page }))
          }}
        />
      </Card>

      {/* Article Modal */}
      <Modal
        title={editingArticle ? 'Editar Artículo' : 'Nuevo Artículo'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        width={960}
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="titulo"
            label="Título"
            rules={[{ required: true, message: 'Ingrese el título' }]}
          >
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="slug"
                label="Slug (URL)"
                extra="Se genera automáticamente si se deja vacío"
              >
                <Input placeholder="mi-articulo" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="categoria_id" label="Categoría">
                <Select placeholder="Seleccionar categoría" allowClear>
                  {categorias.map(c => (
                    <Select.Option key={c.id} value={c.id}>{c.nombre}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="resumen" label="Resumen">
            <TextArea rows={2} placeholder="Breve descripción del artículo..." maxLength={500} showCount />
          </Form.Item>

          <Form.Item label="Contenido" required>
            <ReactQuill
              theme="snow"
              value={contenido}
              onChange={setContenido}
              modules={quillModules}
              formats={quillFormats}
              style={{ minHeight: 250 }}
              placeholder="Escriba el contenido del artículo..."
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="etiquetas"
                label="Etiquetas"
                extra="Separadas por comas"
              >
                <Input placeholder="guia, tutorial, api" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="publicado" label="Estado" valuePropName="checked">
                <Switch checkedChildren="Publicado" unCheckedChildren="Borrador" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="visibilidad"
            label="Visibilidad"
            extra="Seleccione qué roles pueden ver este artículo"
            rules={[{ required: true, message: 'Seleccione al menos un nivel de visibilidad' }]}
          >
            <Checkbox.Group options={VISIBILITY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="articulos_relacionados"
            label="Artículos Relacionados"
            extra="Seleccione artículos que se mostrarán como relacionados"
          >
            <Select
              mode="multiple"
              placeholder="Buscar y seleccionar artículos..."
              options={relatedArticleOptions}
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              allowClear
              showSearch
            />
          </Form.Item>

          {/* PDF Management — only visible when editing an existing article */}
          {editingArticle && (
            <Form.Item label="Archivos PDF Adjuntos">
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
                <Upload
                  accept=".pdf"
                  beforeUpload={() => false}
                  showUploadList={false}
                  onChange={handleUploadPDF}
                  disabled={uploadingPDF || articlePDFs.length >= 5}
                >
                  <Button
                    icon={<UploadOutlined />}
                    loading={uploadingPDF}
                    disabled={articlePDFs.length >= 5}
                  >
                    Subir PDF {articlePDFs.length >= 5 ? '(máximo 5)' : ''}
                  </Button>
                </Upload>

                {articlePDFs.length > 0 && (
                  <List
                    size="small"
                    style={{ marginTop: 12 }}
                    dataSource={articlePDFs}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          <Tooltip title="Descargar" key="download">
                            <Button
                              type="text"
                              size="small"
                              icon={<DownloadOutlined />}
                              href={archivosApi.getDownloadUrl(file.id)}
                              target="_blank"
                            />
                          </Tooltip>,
                          <Popconfirm
                            key="delete"
                            title="¿Eliminar este PDF?"
                            onConfirm={() => handleDeletePDF(file.id)}
                          >
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<FilePdfOutlined style={{ fontSize: 20, color: '#D52B1E' }} />}
                          title={file.nombre_original}
                          description={formatFileSize(file.tamano)}
                        />
                      </List.Item>
                    )}
                  />
                )}
                {articlePDFs.length === 0 && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    No hay PDFs adjuntos
                  </Text>
                )}
              </div>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Category Modal */}
      <Modal
        title="Nueva Categoría"
        open={categoryModalVisible}
        onOk={handleCreateCategory}
        onCancel={() => setCategoryModalVisible(false)}
        okText="Crear"
        cancelText="Cancelar"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, message: 'Ingrese el nombre' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="orden" label="Orden">
            <Input type="number" placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NTArticulos
