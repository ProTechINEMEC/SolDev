import { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Button, Space, Typography, Input, Select, Modal,
  Form, message, Popconfirm, Switch, Row, Col, Alert, List, Checkbox
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  UserOutlined, LockOutlined, ExperimentOutlined
} from '@ant-design/icons'
import { usuariosApi, opcionesApi } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const rolLabels = {
  admin: 'Administrador',
  nuevas_tecnologias: 'Nuevas Tecnologías',
  ti: 'TI',
  gerencia: 'Gerencia',
  coordinador_nt: 'Coordinador NT',
  coordinador_ti: 'Coordinador TI'
}

const rolColors = {
  admin: 'purple',
  nuevas_tecnologias: 'red',
  ti: 'green',
  gerencia: 'gold',
  coordinador_nt: 'volcano',
  coordinador_ti: 'cyan'
}

function NTUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [filters, setFilters] = useState({ search: '', rol: null, activo: null })
  const [form] = Form.useForm()
  const [testUsersStatus, setTestUsersStatus] = useState(null)
  const [testUsersLoading, setTestUsersLoading] = useState(false)
  const [contractOptions, setContractOptions] = useState([])
  const { user: currentUser } = useAuthStore()

  // Watch form role field to show/hide contract selector
  const formRole = Form.useWatch('rol', form)

  useEffect(() => {
    loadUsuarios()
  }, [filters])

  useEffect(() => {
    if (currentUser?.rol === 'admin') {
      loadTestUsersStatus()
      loadContractOptions()
    }
  }, [currentUser])

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

  const loadTestUsersStatus = async () => {
    try {
      const response = await usuariosApi.getTestUsersStatus()
      setTestUsersStatus(response.data)
    } catch (error) {
      console.error('Error loading test users status:', error)
    }
  }

  const loadContractOptions = async () => {
    try {
      const response = await opcionesApi.getByCategoria('operacion_contrato')
      const opciones = response.data.opciones || response.data || []
      setContractOptions(opciones.filter(o => o.activo !== false).map(o => ({ label: o.valor, value: o.valor })))
    } catch (error) {
      console.error('Error loading contract options:', error)
    }
  }

  const handleToggleTestUsers = async (activo) => {
    setTestUsersLoading(true)
    try {
      await usuariosApi.toggleTestUsers(activo)
      message.success(activo ? 'Usuarios de prueba habilitados' : 'Usuarios de prueba deshabilitados')
      loadTestUsersStatus()
      loadUsuarios()
    } catch (error) {
      message.error('Error al cambiar estado de usuarios de prueba')
    } finally {
      setTestUsersLoading(false)
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
      activo: user.activo,
      contratos: user.contratos || []
    })
    setModalVisible(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      // Strip contratos for non-TI roles
      if (!['ti', 'coordinador_ti'].includes(values.rol)) {
        delete values.contratos
      }

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
      title: 'Usuario / Email',
      dataIndex: 'email',
      key: 'email',
      render: (email, record) => (
        <Space>
          <Text>{email}</Text>
          {record.es_prueba && <Tag color="orange">Prueba</Tag>}
        </Space>
      )
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

      {/* Test Users Section - Admin Only */}
      {currentUser?.rol === 'admin' && testUsersStatus && (
        <Card
          title={<><ExperimentOutlined /> Usuarios de Prueba</>}
          style={{ marginBottom: 16 }}
          extra={
            <Switch
              checked={testUsersStatus.enabled}
              checkedChildren="Habilitados"
              unCheckedChildren="Deshabilitados"
              loading={testUsersLoading}
              onChange={(checked) => handleToggleTestUsers(checked)}
            />
          }
        >
          <Alert
            message={testUsersStatus.enabled
              ? `${testUsersStatus.enabledCount} usuario(s) de prueba habilitados`
              : 'Todos los usuarios de prueba estan deshabilitados'
            }
            type={testUsersStatus.enabled ? 'success' : 'info'}
            showIcon
            style={{ marginBottom: 12 }}
          />
          <List
            size="small"
            dataSource={testUsersStatus.users || []}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  <Tag color={rolColors[item.rol]}>{rolLabels[item.rol]}</Tag>
                  <Text strong>{item.email}</Text>
                  <Text type="secondary">({item.nombre})</Text>
                </Space>
                <Tag color={item.activo ? 'green' : 'default'}>
                  {item.activo ? 'Activo' : 'Inactivo'}
                </Tag>
              </List.Item>
            )}
          />
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            Contrasena de prueba: Inemec2024
          </Text>
        </Card>
      )}

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
              <Select.Option value="admin">Administrador</Select.Option>
              <Select.Option value="nuevas_tecnologias">Nuevas Tecnologías</Select.Option>
              <Select.Option value="ti">TI</Select.Option>
              <Select.Option value="gerencia">Gerencia</Select.Option>
              <Select.Option value="coordinador_nt">Coordinador NT</Select.Option>
              <Select.Option value="coordinador_ti">Coordinador TI</Select.Option>
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
            label="Usuario / Email"
            rules={[
              { required: true, message: 'Ingrese el usuario o email' },
              { min: 2, message: 'Minimo 2 caracteres' }
            ]}
          >
            <Input prefix={<UserOutlined />} />
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
              <Select.Option value="coordinador_nt">
                <Tag color="volcano">C-NT</Tag> Coordinador NT
              </Select.Option>
              <Select.Option value="coordinador_ti">
                <Tag color="cyan">C-TI</Tag> Coordinador TI
              </Select.Option>
            </Select>
          </Form.Item>

          {(formRole === 'ti' || formRole === 'coordinador_ti') && contractOptions.length > 0 && (
            <Form.Item name="contratos" label="Contratos Asignados">
              <div>
                <Button
                  size="small"
                  style={{ marginBottom: 8 }}
                  onClick={() => form.setFieldsValue({ contratos: contractOptions.map(o => o.value) })}
                >
                  Seleccionar Todos
                </Button>
                <Button
                  size="small"
                  style={{ marginBottom: 8, marginLeft: 8 }}
                  onClick={() => form.setFieldsValue({ contratos: [] })}
                >
                  Limpiar
                </Button>
                <Checkbox.Group options={contractOptions} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} />
              </div>
            </Form.Item>
          )}

          {editingUser && (
            <Form.Item name="activo" label="Estado" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
            </Form.Item>
          )}
        </Form>

        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Text strong>Permisos por Rol:</Text>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
            <li><Tag color="red">NT</Tag> Gestión de solicitudes, proyectos y artículos</li>
            <li><Tag color="green">TI</Tag> Gestión de tickets de soporte técnico</li>
            <li><Tag color="gold">Gerencia</Tag> Aprobación de solicitudes y visualización de reportes</li>
            <li><Tag color="volcano">Coordinador NT</Tag> Revisión y aprobación de solicitudes antes de gerencia</li>
            <li><Tag color="cyan">Coordinador TI</Tag> Supervisión y reasignación de tickets de soporte</li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}

export default NTUsuarios
