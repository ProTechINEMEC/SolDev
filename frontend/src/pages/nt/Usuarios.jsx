import { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Button, Space, Typography, Input, Select, Modal,
  Form, message, Popconfirm, Switch, Row, Col
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  UserOutlined, LockOutlined
} from '@ant-design/icons'
import { usuariosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const rolLabels = {
  nuevas_tecnologias: 'Nuevas Tecnologías',
  ti: 'TI',
  gerencia: 'Gerencia'
}

const rolColors = {
  nuevas_tecnologias: 'red',
  ti: 'green',
  gerencia: 'gold'
}

function NTUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [filters, setFilters] = useState({ search: '', rol: null, activo: null })
  const [form] = Form.useForm()

  useEffect(() => {
    loadUsuarios()
  }, [filters])

  const loadUsuarios = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.search) params.search = filters.search
      if (filters.rol) params.rol = filters.rol
      if (filters.activo !== null) params.activo = filters.activo

      const response = await usuariosApi.list(params)
      setUsuarios(response.data.usuarios || [])
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ activo: true })
    setModalVisible(true)
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    form.setFieldsValue({
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo
    })
    setModalVisible(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (editingUser) {
        // Don't send password if not changed
        const updateData = { ...values }
        if (!updateData.password) {
          delete updateData.password
        }
        await usuariosApi.update(editingUser.id, updateData)
        message.success('Usuario actualizado')
      } else {
        if (!values.password) {
          message.error('La contraseña es requerida para nuevos usuarios')
          return
        }
        await usuariosApi.create(values)
        message.success('Usuario creado')
      }
      setModalVisible(false)
      loadUsuarios()
    } catch (error) {
      message.error(error.message || 'Error al guardar usuario')
    }
  }

  const handleDelete = async (id) => {
    try {
      await usuariosApi.delete(id)
      message.success('Usuario desactivado')
      loadUsuarios()
    } catch (error) {
      message.error(error.message || 'Error al desactivar usuario')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await usuariosApi.update(user.id, { activo: !user.activo })
      message.success(user.activo ? 'Usuario desactivado' : 'Usuario activado')
      loadUsuarios()
    } catch (error) {
      message.error('Error al cambiar estado del usuario')
    }
  }

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (nombre, record) => (
        <div>
          <Text strong>{nombre}</Text>
          {!record.activo && <Tag color="red" style={{ marginLeft: 8 }}>Inactivo</Tag>}
        </div>
      )
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Rol',
      dataIndex: 'rol',
      key: 'rol',
      render: (rol) => (
        <Tag color={rolColors[rol]}>{rolLabels[rol]}</Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      render: (activo, record) => (
        <Switch
          checked={activo}
          checkedChildren="Activo"
          unCheckedChildren="Inactivo"
          onChange={() => handleToggleActive(record)}
        />
      )
    },
    {
      title: 'Último Acceso',
      dataIndex: 'ultimo_acceso',
      key: 'ultimo_acceso',
      render: (d) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : <Text type="secondary">Nunca</Text>
    },
    {
      title: 'Creado',
      dataIndex: 'creado_en',
      key: 'creado_en',
      render: (d) => dayjs(d).format('DD/MM/YYYY')
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          {record.activo && (
            <Popconfirm
              title="¿Desactivar este usuario?"
              description="El usuario no podrá acceder al sistema"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3}>Gestión de Usuarios</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Buscar por nombre o email..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onPressEnter={loadUsuarios}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Filtrar por rol"
              value={filters.rol}
              onChange={(v) => setFilters({ ...filters, rol: v })}
              style={{ width: '100%' }}
              allowClear
            >
              <Select.Option value="nuevas_tecnologias">Nuevas Tecnologías</Select.Option>
              <Select.Option value="ti">TI</Select.Option>
              <Select.Option value="gerencia">Gerencia</Select.Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Estado"
              value={filters.activo}
              onChange={(v) => setFilters({ ...filters, activo: v })}
              style={{ width: '100%' }}
              allowClear
            >
              <Select.Option value="true">Activos</Select.Option>
              <Select.Option value="false">Inactivos</Select.Option>
            </Select>
          </Col>
        </Row>

        <Table
          dataSource={usuarios}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* User Modal */}
      <Modal
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, message: 'Ingrese el nombre' }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Ingrese el email' },
              { type: 'email', message: 'Ingrese un email válido' }
            ]}
          >
            <Input prefix="@" />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
            rules={editingUser ? [] : [
              { required: true, message: 'Ingrese la contraseña' },
              { min: 8, message: 'Mínimo 8 caracteres' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item
            name="rol"
            label="Rol"
            rules={[{ required: true, message: 'Seleccione un rol' }]}
          >
            <Select placeholder="Seleccionar rol">
              <Select.Option value="nuevas_tecnologias">
                <Tag color="red">NT</Tag> Nuevas Tecnologías
              </Select.Option>
              <Select.Option value="ti">
                <Tag color="green">TI</Tag> Tecnología de Información
              </Select.Option>
              <Select.Option value="gerencia">
                <Tag color="gold">GER</Tag> Gerencia
              </Select.Option>
            </Select>
          </Form.Item>

          {editingUser && (
            <Form.Item name="activo" label="Estado" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
            </Form.Item>
          )}
        </Form>

        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Text strong>Permisos por Rol:</Text>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
            <li><Tag color="red">NT</Tag> Gestión completa de solicitudes, proyectos, usuarios y artículos</li>
            <li><Tag color="green">TI</Tag> Gestión de tickets de soporte técnico</li>
            <li><Tag color="gold">Gerencia</Tag> Aprobación de solicitudes y visualización de reportes</li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}

export default NTUsuarios
