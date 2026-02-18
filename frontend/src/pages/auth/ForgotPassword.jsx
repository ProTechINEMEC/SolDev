/**
 * ForgotPassword Page
 * Request password reset via email
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Result, Space } from 'antd'
import { MailOutlined, ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import api from '../../services/api'

const { Title, Text, Paragraph } = Typography

function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [form] = Form.useForm()

  const handleSubmit = async (values) => {
    setLoading(true)
    setEmail(values.email)
    try {
      await api.post('/auth/forgot-password', { email: values.email })
      setSent(true)
    } catch (error) {
      // Always show success to prevent email enumeration
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
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
            status="success"
            title="Revise su correo electronico"
            subTitle={
              <div>
                <Paragraph>
                  Si el correo <strong>{email}</strong> esta registrado en nuestro sistema,
                  recibira un enlace para restablecer su contrasena.
                </Paragraph>
                <Paragraph type="secondary" style={{ marginTop: 16 }}>
                  El enlace expirara en 1 hora. Si no recibe el correo,
                  revise su carpeta de spam.
                </Paragraph>
              </div>
            }
            extra={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Link to="/login">
                  <Button type="primary" block>
                    Volver al inicio de sesion
                  </Button>
                </Link>
                <Button
                  type="link"
                  onClick={() => {
                    setSent(false)
                    form.resetFields()
                  }}
                >
                  Intentar con otro correo
                </Button>
              </Space>
            }
          />
        </Card>
      </div>
    )
  }

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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
            Recuperar Contrasena
          </Title>
          <Text type="secondary">
            Ingrese su correo electronico y le enviaremos instrucciones
            para restablecer su contrasena.
          </Text>
        </div>

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Ingrese su correo electronico' },
              { type: 'email', message: 'Ingrese un correo valido' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="correo@ejemplo.com"
              size="large"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              Enviar instrucciones
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Link to="/login">
            <Button type="link" icon={<ArrowLeftOutlined />}>
              Volver al inicio de sesion
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default ForgotPassword
