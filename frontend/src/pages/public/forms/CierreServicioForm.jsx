import { useState } from 'react'
import { Form, Steps, Button, Space, message, Result, Typography, Card } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { solicitudesApi } from '../../../services/api'
import {
  IdentificacionSection,
  RazonamientoSection,
  ResponsablesSection,
  ConfirmacionCierreSection
} from '../../../components/forms/sections'

const { Title, Text, Paragraph } = Typography

function CierreServicioForm({ sessionToken, onBack, onSuccess }) {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submittedCode, setSubmittedCode] = useState(null)

  const steps = [
    {
      title: 'Identificación',
      content: <IdentificacionSection form={form} />
    },
    {
      title: 'Razonamiento',
      content: <RazonamientoSection />
    },
    {
      title: 'Responsables',
      content: <ResponsablesSection />
    },
    {
      title: 'Confirmación',
      content: <ConfirmacionCierreSection />
    }
  ]

  const validateCurrentStep = async () => {
    try {
      const fieldsToValidate = getFieldsForStep(currentStep)
      await form.validateFields(fieldsToValidate)
      return true
    } catch (error) {
      return false
    }
  }

  const getFieldsForStep = (step) => {
    switch (step) {
      case 0:
        return [
          ['identificacion', 'nombre_completo'],
          ['identificacion', 'cargo'],
          ['identificacion', 'area'],
          ['identificacion', 'operacion_contrato'],
          ['identificacion', 'correo'],
          ['identificacion', 'cedula'],
          ['identificacion', 'es_doliente']
        ]
      case 1:
        return [['razonamiento', 'descripcion']]
      case 2:
        return [
          ['responsables', 'responsable_nombre'],
          ['responsables', 'responsable_cargo']
        ]
      case 3:
        return [['confirmacion', 'confirmo_cierre']]
      default:
        return []
    }
  }

  const handleNext = async () => {
    const valid = await validateCurrentStep()
    if (valid) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    try {
      const valid = await validateCurrentStep()
      if (!valid) return

      setLoading(true)
      const values = await form.validateFields()

      // Map form values to API format
      const solicitudData = {
        tipo: 'cierre_servicio',
        titulo: `Cierre: ${values.razonamiento?.descripcion?.substring(0, 50)}...`,
        prioridad: 'media',
        solicitante_session_token: sessionToken,
        identificacion: values.identificacion,
        razonamiento: values.razonamiento,
        responsables: values.responsables,
        confirmacion: values.confirmacion?.confirmo_cierre
      }

      const response = await solicitudesApi.create(solicitudData)
      setSubmittedCode(response.data.solicitud.codigo)
      message.success('Solicitud de cierre enviada exitosamente')
      onSuccess?.(response.data.solicitud)
    } catch (error) {
      console.error('Error creating solicitud:', error)
      message.error(error.message || 'Error al enviar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  if (submittedCode) {
    return (
      <Card>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="Solicitud de Cierre Enviada"
          subTitle={
            <Space direction="vertical" size="small">
              <Text>Su solicitud ha sido registrada con el código:</Text>
              <Title level={2} style={{ margin: 0, color: '#D52B1E' }}>
                {submittedCode}
              </Title>
              <Paragraph type="secondary">
                Guarde este código para consultar el estado de su solicitud
              </Paragraph>
            </Space>
          }
          extra={[
            <Button
              key="status"
              type="primary"
              onClick={() => window.location.href = `/consulta/buscar?codigo=${submittedCode}`}
            >
              Consultar Estado
            </Button>,
            <Button key="new" onClick={onBack}>
              Nueva Solicitud
            </Button>
          ]}
        />
      </Card>
    )
  }

  return (
    <Card>
      <Steps
        current={currentStep}
        items={steps.map((s, i) => ({ title: s.title }))}
        style={{ marginBottom: 32 }}
      />

      <Form
        form={form}
        layout="vertical"
        scrollToFirstError
      >
        {/* Render all steps but only show current one - preserves form values */}
        {steps.map((step, index) => (
          <div key={index} style={{ display: index === currentStep ? 'block' : 'none' }}>
            {step.content}
          </div>
        ))}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            {onBack && (
              <Button onClick={onBack} icon={<ArrowLeftOutlined />}>
                Volver
              </Button>
            )}
          </Space>

          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev} icon={<ArrowLeftOutlined />}>
                Anterior
              </Button>
            )}
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={handleNext}>
                Siguiente <ArrowRightOutlined />
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={loading}
                icon={<SendOutlined />}
              >
                Enviar Solicitud
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </Card>
  )
}

export default CierreServicioForm
