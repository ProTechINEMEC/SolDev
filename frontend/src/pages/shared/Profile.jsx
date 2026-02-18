/**
 * Profile Page
 * View and edit user profile settings
 */

import { useState, useEffect } from 'react'
import {
  Card, Form, Input, Button, Typography, message, Divider,
  Descriptions, Spin, Space, Alert, Tag, Modal
} from 'antd'
import {
  UserOutlined, LockOutlined, SaveOutlined, MailOutlined,
  CalendarOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import api from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const roleLabels = {
  nuevas_tecnologias: 'Nuevas Tecnologias',
  ti: 'Tecnologias de la Informacion',
  gerencia: 'Gerencia'
}

const roleColors = {
  nuevas_tecnologias: 'red',
  ti: 'green',
  gerencia: 'gold'
}

function Profile() {
  const { user, updateUser } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile')
      setProfile(response.data.profile)
      form.setFieldsValue({ nombre: response.data.profile.nombre })
    } catch (error) {
      message.error('Error al cargar el perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (values) => {
    setSaving(true)
    try {
      const response = await api.put('/profile', { nombre: values.nombre })
      setProfile(prev => ({ ...prev, ...response.data.profile }))
      // Update global auth state
      if (updateUser) {
        updateUser({ ...user, nombre: values.nombre })
      }
      message.success('Perfil actualizado exitosamente')
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (values) => {
    setChangingPassword(true)
    try {
      await api.put('/profile/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })
      message.success('Contrasena actualizada exitosamente')
      setPasswordModalVisible(false)
      passwordForm.resetFields()
    } catch (error) {
      message.error(error.response?.data?.error || 'Error al cambiar la contrasena')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>Mi Perfil</Title>

      {/* Account Information Card */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#D52B1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 24
          }}>
            <UserOutlined style={{ fontSize: 36, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>{profile?.nombre}</Title>
            <Text type="secondary">{profile?.email}</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color={roleColors[profile?.rol]}>
                {roleLabels[profile?.rol] || profile?.rol}
              </Tag>
            </div>
          </div>
        </div>

        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item
            label={<><MailOutlined /> Email</>}
          >
            {profile?.email}
          </Descriptions.Item>
          <Descriptions.Item
            label={<><UserOutlined /> Rol</>}
          >
            {roleLabels[profile?.rol]}
          </Descriptions.Item>
          <Descriptions.Item
            label={<><CalendarOutlined /> Miembro desde</>}
          >
            {profile?.creado_en && dayjs(profile.creado_en).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item
            label={<><ClockCircleOutlined /> Ultimo acceso</>}
          >
            {profile?.ultimo_acceso
              ? dayjs(profile.ultimo_acceso).format('DD/MM/YYYY HH:mm')
              : 'N/A'
            }
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Edit Name Card */}
      <Card title="Editar Nombre" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          onFinish={handleUpdateProfile}
          layout="vertical"
        >
          <Form.Item
            name="nombre"
            label="Nombre completo"
            rules={[
              { required: true, message: 'Ingrese su nombre' },
              { min: 2, message: 'Minimo 2 caracteres' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Su nombre completo"
              size="large"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
            >
              Guardar cambios
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Security Card */}
      <Card title="Seguridad">
        <Alert
          message="Contrasena"
          description="Es recomendable cambiar su contrasena periodicamente para mantener su cuenta segura."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Button
          type="primary"
          icon={<LockOutlined />}
          onClick={() => setPasswordModalVisible(true)}
        >
          Cambiar contrasena
        </Button>
      </Card>

      {/* Password Change Modal */}
      <Modal
        title="Cambiar Contrasena"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false)
          passwordForm.resetFields()
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          onFinish={handleChangePassword}
          layout="vertical"
        >
          <Form.Item
            name="currentPassword"
            label="Contrasena actual"
            rules={[{ required: true, message: 'Ingrese su contrasena actual' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Contrasena actual"
            />
          </Form.Item>

          <Divider />

          <Form.Item
            name="newPassword"
            label="Nueva contrasena"
            rules={[
              { required: true, message: 'Ingrese la nueva contrasena' },
              { min: 8, message: 'Minimo 8 caracteres' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Minimo 8 caracteres"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirmar nueva contrasena"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Confirme la nueva contrasena' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Las contrasenas no coinciden'))
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Repita la nueva contrasena"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setPasswordModalVisible(false)
                passwordForm.resetFields()
              }}>
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={changingPassword}
                icon={<LockOutlined />}
              >
                Cambiar contrasena
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Profile
