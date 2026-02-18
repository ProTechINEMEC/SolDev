/**
 * ResetPassword Page
 * Set new password using reset token
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Result, Spin, Alert } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import api from '../../services/api'

const { Title, Text, Paragraph } = Typography

function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [form] = Form.useForm()

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await api.get(`/auth/verify-reset-token/${token}`)
        if (response.data.valid) {
          setTokenValid(true)
          setMaskedEmail(response.data.email)
        } else {
          setTokenValid(false)
        }
      } catch (error) {
        setTokenValid(false)
      } finally {
        setVerifying(false)
      }
    }

    if (token) {
      verifyToken()
    } else {
      setVerifying(false)
      setTokenValid(false)
    }
  }, [token])

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        token,
        password: values.password
      })
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000)
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al restablecer la contrasena'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (verifying) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #333333 100%)'
      }}>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Paragraph style={{ marginTop: 16 }}>Verificando enlace...</Paragraph>
        </Card>
      </div>
    )
  }

  // Invalid/expired token
  if (!tokenValid) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #333333 100%)',
        padding: 24
      }}>
        <Card style={{ maxWidth: 450, width: '100%' }}>
          <Result
            status="error"
            title="Enlace invalido o expirado"
            subTitle="El enlace para restablecer la contrasena ha expirado o no es valido. Por favor solicite uno nuevo."
            extra={[
              <Link to="/forgot-password" key="retry">
                <Button type="primary">Solicitar nuevo enlace</Button>
              </Link>,
              <Link to="/login" key="login">
                <Button>Volver al inicio</Button>
              </Link>
            ]}
          />
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #333333 100%)',
        padding: 24
      }}>
        <Card style={{ maxWidth: 450, width: '100%' }}>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Contrasena restablecida"
            subTitle="Su contrasena ha sido actualizada exitosamente. Sera redirigido al inicio de sesion..."
            extra={
              <Link to="/login">
                <Button type="primary">Iniciar sesion ahora</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  // Reset form
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #333333 100%)',
      padding: 24
    }}>
      <Card style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#fce8e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <LockOutlined style={{ fontSize: 28, color: '#D52B1E' }} />
          </div>
          <Title level={3} style={{ marginBottom: 8 }}>
            Nueva Contrasena
          </Title>
          {maskedEmail && (
            <Text type="secondary">
              Cuenta: {maskedEmail}
            </Text>
          )}
        </div>

        <Alert
          message="Requisitos de contrasena"
          description="La contrasena debe tener al menos 8 caracteres."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="password"
            label="Nueva contrasena"
            rules={[
              { required: true, message: 'Ingrese la nueva contrasena' },
              { min: 8, message: 'Minimo 8 caracteres' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Minimo 8 caracteres"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirmar contrasena"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Confirme la nueva contrasena' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Las contrasenas no coinciden'))
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Repita la contrasena"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              Restablecer contrasena
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default ResetPassword
