import { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Button, Space, Typography, Input, Select, Modal,
  Form, message, Popconfirm, Switch, Row, Col
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { conocimientoApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

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

  useEffect(() => {
    loadArticulos()
    loadCategorias()
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

  const handleCreate = () => {
    setEditingArticle(null)
    form.resetFields()
    form.setFieldsValue({ publicado: false, etiquetas: [] })
    setModalVisible(true)
  }

  const handleEdit = (article) => {
    setEditingArticle(article)
    form.setFieldsValue({
      ...article,
      etiquetas: article.etiquetas?.join(', ') || ''
    })
    setModalVisible(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        ...values,
        etiquetas: Array.isArray(values.etiquetas)
          ? values.etiquetas
          : values.etiquetas
            ? values.etiquetas.split(',').map(t => t.trim()).filter(Boolean)
            : []
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
    } catch (error) {
      message.error(error.message || 'Error al guardar artículo')
    }
  }

  const handleDelete = async (id) => {
    try {
      await conocimientoApi.deleteArticulo(id)
      message.success('Artículo eliminado')
      loadArticulos()
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
        width={800}
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

          <Form.Item
            name="contenido"
            label="Contenido (Markdown)"
            rules={[{ required: true, message: 'Ingrese el contenido' }]}
          >
            <TextArea
              rows={12}
              placeholder="# Título

Escribe tu contenido usando Markdown...

## Subtítulo

- Lista item 1
- Lista item 2

**Texto en negrita** y *texto en cursiva*

```javascript
// Código
console.log('Hola mundo');
```"
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
