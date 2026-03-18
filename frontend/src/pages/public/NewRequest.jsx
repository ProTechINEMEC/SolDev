import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, Button, Space, Typography, message, Divider, Row, Col,
  Popconfirm, Tag, Empty, Spin
} from 'antd'
import {
  MailOutlined, ArrowLeftOutlined, ToolOutlined, RocketOutlined,
  BugOutlined, CloseCircleOutlined, SyncOutlined, PlusCircleOutlined,
  FileTextOutlined, DeleteOutlined, EditOutlined
} from '@ant-design/icons'
import { verificacionApi, borradoresApi } from '../../services/api'
import dayjs from 'dayjs'
import {
  ITTicketForm,
  ReporteFalloForm,
  CierreServicioForm,
  ProyectoNuevoForm
} from './forms'

const { Title, Paragraph, Text } = Typography

// Category definitions
const categories = [
  {
    key: 'it',
    title: 'Soporte TI',
    icon: <ToolOutlined style={{ fontSize: 48 }} />,
    description: 'Solicitudes de soporte técnico, problemas con equipos, software o accesos',
    color: '#1890ff'
  },
  {
    key: 'nt',
    title: 'Nuevas Tecnologías',
    icon: <RocketOutlined style={{ fontSize: 48 }} />,
    description: 'Proyectos de desarrollo, actualizaciones de sistemas, reportes de fallos en aplicaciones',
    color: '#D52B1E'
  }
]

// NT request type definitions
const ntTypes = [
  {
    key: 'proyecto_nuevo_interno',
    title: 'Proyecto Nuevo',
    icon: <PlusCircleOutlined style={{ fontSize: 32 }} />,
    description: 'Solicitud de desarrollo de una nueva aplicación, sistema o funcionalidad'
  },
  {
    key: 'actualizacion',
    title: 'Actualización',
    icon: <SyncOutlined style={{ fontSize: 32 }} />,
    description: 'Mejoras o modificaciones a un sistema o aplicación existente'
  },
  {
    key: 'reporte_fallo',
    title: 'Reporte de Fallo',
    icon: <BugOutlined style={{ fontSize: 32 }} />,
    description: 'Reportar un error, bug o mal funcionamiento en una aplicación'
  },
  {
    key: 'cierre_servicio',
    title: 'Cierre de Servicio',
    icon: <CloseCircleOutlined style={{ fontSize: 32 }} />,
    description: 'Solicitud para dar de baja o cerrar un sistema o servicio'
  }
]

const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Nuevo',
  actualizacion: 'Actualización'
}

function NewRequest() {
  const [step, setStep] = useState('verification') // verification, drafts, category, type, form
  const [verificationForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [sessionToken, setSessionToken] = useState(null)
  const [verificationSent, setVerificationSent] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [solicitanteData, setSolicitanteData] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [draftId, setDraftId] = useState(null)
  const [draftData, setDraftData] = useState(null)
  const [draftStep, setDraftStep] = useState(null)
  const navigate = useNavigate()

  // Check for existing drafts after verification
  const checkDrafts = async (token) => {
    setLoadingDrafts(true)
    try {
      const response = await borradoresApi.list(token)
      const borradores = response.data.borradores || []
      if (borradores.length > 0) {
        setDrafts(borradores)
        setStep('drafts')
      } else {
        setStep('category')
      }
    } catch {
      setStep('category')
    } finally {
      setLoadingDrafts(false)
    }
  }

  // Resume a draft
  const handleResumeDraft = async (draft) => {
    setLoading(true)
    try {
      const response = await borradoresApi.get(draft.id, sessionToken)
      const borrador = response.data.borrador
      setDraftId(borrador.id)
      setDraftData(borrador.datos_formulario)
      setDraftStep(borrador.paso_actual)
      setSelectedCategory('nt')
      setSelectedType(borrador.tipo)
      setStep('form')
    } catch {
      message.error('Error al cargar el borrador')
    } finally {
      setLoading(false)
    }
  }

  // Delete a draft
  const handleDeleteDraft = async (draftId) => {
    try {
      await borradoresApi.delete(draftId, sessionToken)
      const updated = drafts.filter(d => d.id !== draftId)
      setDrafts(updated)
      message.success('Borrador eliminado')
      if (updated.length === 0) {
        setStep('category')
      }
    } catch {
      message.error('Error al eliminar el borrador')
    }
  }

  // Request verification code
  const handleRequestCode = async (values) => {
    setLoading(true)
    try {
      const response = await verificacionApi.solicitar({
        email: values.email,
        nombre: values.nombre
      })

      // If auto-verified (email verification disabled), check for drafts
      if (response.data.autoVerified) {
        const token = response.data.sessionToken
        setSessionToken(token)
        setSolicitanteData({
          nombre: response.data.solicitante.nombre,
          email: response.data.solicitante.email
        })
        message.success('Verificación completada')
        await checkDrafts(token)
      } else {
        setVerificationSent(true)
        message.success('Código de verificación enviado a su email')
      }
    } catch (error) {
      message.error(error.message || 'Error al enviar código')
    } finally {
      setLoading(false)
    }
  }

  // Verify code
  const handleVerifyCode = async (values) => {
    setLoading(true)
    try {
      const response = await verificacionApi.validar({
        email: verificationForm.getFieldValue('email'),
        codigo: values.codigo
      })
      const token = response.data.sessionToken
      setSessionToken(token)
      setSolicitanteData({
        nombre: response.data.solicitante.nombre,
        email: response.data.solicitante.email
      })
      message.success('Email verificado correctamente')
      await checkDrafts(token)
    } catch (error) {
      message.error(error.message || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  // Handle category selection
  const handleCategorySelect = (categoryKey) => {
    setSelectedCategory(categoryKey)
    if (categoryKey === 'it') {
      // IT goes directly to form
      setSelectedType('ticket_soporte')
      setStep('form')
    } else {
      // NT needs type selection
      setStep('type')
    }
  }

  // Handle NT type selection
  const handleTypeSelect = (typeKey) => {
    setSelectedType(typeKey)
    setStep('form')
  }

  // Handle back navigation
  const handleBack = () => {
    if (step === 'form') {
      // Clear draft state when going back
      setDraftId(null)
      setDraftData(null)
      setDraftStep(null)
      if (selectedCategory === 'it') {
        setStep('category')
      } else {
        setStep('type')
      }
      setSelectedType(null)
    } else if (step === 'type') {
      setStep('category')
      setSelectedCategory(null)
    } else if (step === 'category') {
      if (drafts.length > 0) {
        setStep('drafts')
      }
    } else if (step === 'drafts') {
      // Stay on drafts - going back to verification would lose session
    }
  }

  // Handle form success
  const handleFormSuccess = (result) => {
    // The form components handle their own success state
    console.log('Form submitted successfully:', result)
  }

  // Handle starting a new request
  const handleNewRequest = () => {
    setStep('category')
    setSelectedCategory(null)
    setSelectedType(null)
  }

  // Render verification step
  const renderVerification = () => (
    <Card style={{ maxWidth: 500, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <MailOutlined style={{ fontSize: 48, color: '#D52B1E', marginBottom: 16 }} />
        <Title level={3} style={{ margin: 0 }}>Verificación de Email</Title>
        <Paragraph type="secondary">
          Primero necesitamos verificar su correo electrónico para continuar.
        </Paragraph>
      </div>

      <Form form={verificationForm} layout="vertical" onFinish={handleRequestCode}>
        <Form.Item
          name="nombre"
          label="Nombre Completo"
          rules={[{ required: true, message: 'Ingrese su nombre' }]}
        >
          <Input placeholder="Su nombre completo" disabled={verificationSent} size="large" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Correo Electrónico Corporativo"
          rules={[
            { required: true, message: 'Ingrese su email' },
            { type: 'email', message: 'Email inválido' }
          ]}
        >
          <Input placeholder="su.email@empresa.com" disabled={verificationSent} size="large" />
        </Form.Item>

        {!verificationSent ? (
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            Enviar Código de Verificación
          </Button>
        ) : (
          <>
            <Divider />
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Text type="secondary">
                Hemos enviado un código de 6 dígitos a su correo electrónico.
              </Text>
            </div>
            <Form.Item
              name="codigo"
              rules={[
                { required: true, message: 'Ingrese el código' },
                { len: 6, message: 'El código debe tener 6 dígitos' }
              ]}
            >
              <Input
                placeholder="000000"
                maxLength={6}
                style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
                size="large"
              />
            </Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                onClick={() => handleVerifyCode(verificationForm.getFieldsValue())}
                loading={loading}
                block
                size="large"
              >
                Verificar Código
              </Button>
              <Button onClick={() => setVerificationSent(false)} block>
                Reenviar código
              </Button>
            </Space>
          </>
        )}
      </Form>
    </Card>
  )

  // Render category selection step
  const renderCategorySelection = () => (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>¿Qué tipo de solicitud desea realizar?</Title>
        <Paragraph type="secondary">
          Seleccione la categoría que mejor describe su necesidad
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {categories.map(cat => (
          <Col xs={24} md={12} key={cat.key}>
            <Card
              hoverable
              onClick={() => handleCategorySelect(cat.key)}
              style={{
                textAlign: 'center',
                height: '100%',
                cursor: 'pointer',
                border: `2px solid transparent`,
                transition: 'all 0.3s'
              }}
              bodyStyle={{ padding: 32 }}
              className="category-card"
            >
              <div style={{ color: cat.color, marginBottom: 16 }}>
                {cat.icon}
              </div>
              <Title level={3} style={{ marginBottom: 8 }}>{cat.title}</Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {cat.description}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      <style>{`
        .category-card:hover {
          border-color: #D52B1E !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
      `}</style>
    </div>
  )

  // Render NT type selection step
  const renderTypeSelection = () => (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          Volver
        </Button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>Solicitud para Nuevas Tecnologías</Title>
        <Paragraph type="secondary">
          Seleccione el tipo de solicitud que desea realizar
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        {ntTypes.map(type => (
          <Col xs={24} sm={12} key={type.key}>
            <Card
              hoverable
              onClick={() => handleTypeSelect(type.key)}
              style={{
                cursor: 'pointer',
                height: '100%',
                border: '2px solid transparent',
                transition: 'all 0.3s'
              }}
              className="type-card"
            >
              <Space align="start">
                <div style={{ color: '#D52B1E' }}>
                  {type.icon}
                </div>
                <div>
                  <Title level={4} style={{ marginBottom: 4 }}>{type.title}</Title>
                  <Text type="secondary">{type.description}</Text>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <style>{`
        .type-card:hover {
          border-color: #D52B1E !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  )

  // Render drafts selection step
  const renderDraftSelection = () => (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <FileTextOutlined style={{ fontSize: 48, color: '#D52B1E', marginBottom: 16 }} />
        <Title level={2}>Borradores Guardados</Title>
        <Paragraph type="secondary">
          Tiene {drafts.length} borrador{drafts.length > 1 ? 'es' : ''} guardado{drafts.length > 1 ? 's' : ''}. Puede continuar donde lo dejó o crear una nueva solicitud.
        </Paragraph>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {drafts.map(draft => (
          <Card key={draft.id} size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Space direction="vertical" size={4}>
                  <Space>
                    <Tag color={draft.tipo === 'proyecto_nuevo_interno' ? 'blue' : 'orange'}>
                      {tipoLabels[draft.tipo] || draft.tipo}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Paso {(draft.paso_actual || 0) + 1}
                    </Text>
                  </Space>
                  <Text strong>
                    {draft.titulo_borrador || 'Sin título'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Último guardado: {dayjs(draft.actualizado_en).format('DD/MM/YYYY HH:mm')}
                  </Text>
                </Space>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => handleResumeDraft(draft)}
                  loading={loading}
                >
                  Continuar
                </Button>
                <Popconfirm
                  title="¿Eliminar este borrador?"
                  description="Esta acción no se puede deshacer"
                  onConfirm={() => handleDeleteDraft(draft.id)}
                  okText="Eliminar"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          </Card>
        ))}
      </Space>

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          icon={<PlusCircleOutlined />}
          onClick={handleNewRequest}
        >
          Crear Nueva Solicitud
        </Button>
      </div>
    </div>
  )

  // Render form based on selection
  const renderForm = () => {
    const commonProps = {
      sessionToken,
      onBack: handleBack,
      onSuccess: handleFormSuccess
    }

    // IT Ticket
    if (selectedCategory === 'it') {
      return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <ITTicketForm {...commonProps} />
        </div>
      )
    }

    // NT Forms
    switch (selectedType) {
      case 'reporte_fallo':
        return (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <ReporteFalloForm {...commonProps} />
          </div>
        )
      case 'cierre_servicio':
        return (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <CierreServicioForm {...commonProps} />
          </div>
        )
      case 'proyecto_nuevo_interno':
      case 'actualizacion':
        return (
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <ProyectoNuevoForm
              tipo={selectedType}
              draftId={draftId}
              draftData={draftData}
              draftStep={draftStep}
              {...commonProps}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ color: '#D52B1E', marginBottom: 8 }}>
          Nueva Solicitud
        </Title>
        {step !== 'verification' && solicitanteData && (
          <Text type="secondary">
            Solicitante: {solicitanteData.nombre} ({solicitanteData.email})
          </Text>
        )}
      </div>

      {step === 'verification' && renderVerification()}
      {step === 'drafts' && renderDraftSelection()}
      {step === 'category' && renderCategorySelection()}
      {step === 'type' && renderTypeSelection()}
      {step === 'form' && renderForm()}
    </div>
  )
}

export default NewRequest
