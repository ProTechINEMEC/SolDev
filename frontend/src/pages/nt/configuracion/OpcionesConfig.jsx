import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Tabs, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons'
import { opcionesApi } from '../../../services/api'

const { Title, Text } = Typography

const categorias = [
  { key: 'area', label: 'Áreas / Subáreas', description: 'Áreas organizacionales y subáreas' },
  { key: 'operacion_contrato', label: 'Operaciones / Contratos', description: 'Operaciones y contratos disponibles' },
  { key: 'nivel_urgencia', label: 'Niveles de Urgencia', description: 'Niveles de urgencia para solicitudes' },
  { key: 'tipo_solucion', label: 'Tipos de Solución', description: 'Tipos de solución esperada' },
  { key: 'forma_entrega', label: 'Formas de Entrega', description: 'Formas de entrega de soluciones' },
  { key: 'criticidad', label: 'Niveles de Criticidad', description: 'Niveles de criticidad para tickets' }
]

function OpcionesConfig() {
  const [activeTab, setActiveTab] = useState('area')
  const [opciones, setOpciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingOpcion, setEditingOpcion] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadOpciones()
  }, [activeTab])

  const loadOpciones = async () => {
    setLoading(true)
    try {
      const response = await opcionesApi.getByCategoria(activeTab, true) // includeInactive = true
      setOpciones(response.data.opciones || [])
    } catch (error) {
      console.error('Error loading opciones:', error)
      message.error('Error al cargar las opciones')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingOpcion(null)
    form.resetFields()
    form.setFieldsValue({ categoria: activeTab })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingOpcion(record)
    form.setFieldsValue({
      valor: record.valor,
      etiqueta: record.etiqueta,
      padre_id: record.padre_id,
      orden: record.orden
    })
    setModalVisible(true)
  }

  const handleDelete = async (id) => {
    try {
      await opcionesApi.delete(id)
      message.success('Opción eliminada')
      loadOpciones()
    } catch (error) {
      message.error(error.message || 'Error al eliminar')
    }
  }

  const handleRestore = async (id) => {
    try {
      await opcionesApi.restore(id)
      message.success('Opción restaurada')
      loadOpciones()
    } catch (error) {
      message.error(error.message || 'Error al restaurar')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      values.categoria = activeTab

      if (editingOpcion) {
        await opcionesApi.update(editingOpcion.id, values)
        message.success('Opción actualizada')
      } else {
        await opcionesApi.create(values)
        message.success('Opción creada')
      }

      setModalVisible(false)
      loadOpciones()
    } catch (error) {
      if (error.errorFields) {
        return // Validation error
      }
      message.error(error.message || 'Error al guardar')
    }
  }

  // Get parent options (only top-level for hierarchical categories)
  const parentOptions = opciones
    .filter(o => !o.padre_id && o.activo)
    .map(o => ({ value: o.id, label: o.etiqueta }))

  const isHierarchical = ['area'].includes(activeTab)

  const columns = [
    {
      title: 'Valor',
      dataIndex: 'valor',
      key: 'valor',
      width: 150
    },
    {
      title: 'Etiqueta',
      dataIndex: 'etiqueta',
      key: 'etiqueta',
      render: (text, record) => (
        <Space>
          {record.padre_id && <Text type="secondary">↳ </Text>}
          {text}
        </Space>
      )
    },
    ...(isHierarchical ? [{
      title: 'Padre',
      dataIndex: 'padre_etiqueta',
      key: 'padre_etiqueta',
      render: (text) => text || '-'
    }] : []),
    {
      title: 'Orden',
      dataIndex: 'orden',
      key: 'orden',
      width: 80,
      align: 'center'
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      width: 100,
      render: (activo) => (
        <Tag color={activo ? 'green' : 'red'}>
          {activo ? 'Activo' : 'Inactivo'}
        </Tag>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={!record.activo}
          />
          {record.activo ? (
            <Popconfirm
              title="¿Eliminar esta opción?"
              description="La opción quedará inactiva y no aparecerá en los formularios."
              onConfirm={() => handleDelete(record.id)}
              okText="Eliminar"
              cancelText="Cancelar"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ) : (
            <Button
              type="text"
              icon={<UndoOutlined />}
              onClick={() => handleRestore(record.id)}
              title="Restaurar"
            />
          )}
        </Space>
      )
    }
  ]

  // Add parent label to each row
  const dataWithParent = opciones.map(o => ({
    ...o,
    padre_etiqueta: opciones.find(p => p.id === o.padre_id)?.etiqueta
  }))

  // Sort: parents first, then children grouped under parents
  const sortedData = dataWithParent.sort((a, b) => {
    if (a.padre_id === b.padre_id) return a.orden - b.orden
    if (!a.padre_id && b.padre_id) return -1
    if (a.padre_id && !b.padre_id) return 1
    // Both have parents, sort by parent's order
    const parentA = opciones.find(p => p.id === a.padre_id)
    const parentB = opciones.find(p => p.id === b.padre_id)
    return (parentA?.orden || 0) - (parentB?.orden || 0)
  })

  const tabItems = categorias.map(cat => ({
    key: cat.key,
    label: cat.label,
    children: (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">{cat.description}</Text>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadOpciones}>
              Recargar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Agregar
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={sortedData}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          rowClassName={(record) => !record.activo ? 'row-inactive' : ''}
        />
      </div>
    )
  }))

  return (
    <div>
      <Title level={3}>Configuración de Opciones</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Configure las opciones disponibles en los formularios de solicitud
      </Text>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      <Modal
        title={editingOpcion ? 'Editar Opción' : 'Nueva Opción'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingOpcion ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="valor"
            label="Valor (identificador interno)"
            rules={[
              { required: true, message: 'Ingrese el valor' },
              { pattern: /^[a-z_]+$/, message: 'Solo letras minúsculas y guiones bajos' }
            ]}
          >
            <Input
              placeholder="ej: gerencia_general"
              disabled={!!editingOpcion}
            />
          </Form.Item>

          <Form.Item
            name="etiqueta"
            label="Etiqueta (texto visible)"
            rules={[{ required: true, message: 'Ingrese la etiqueta' }]}
          >
            <Input placeholder="ej: Gerencia General" />
          </Form.Item>

          {isHierarchical && (
            <Form.Item
              name="padre_id"
              label="Categoría padre (opcional)"
            >
              <Select
                allowClear
                placeholder="Seleccione si es una subcategoría"
                options={parentOptions}
              />
            </Form.Item>
          )}

          <Form.Item
            name="orden"
            label="Orden"
            initialValue={0}
          >
            <Input type="number" placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .row-inactive {
          background-color: #fafafa;
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}

export default OpcionesConfig
