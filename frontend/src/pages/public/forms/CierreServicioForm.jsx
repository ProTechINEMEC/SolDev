import { useState, useMemo } from 'react'
import { Form, Steps, Button, Space, message, Result, Typography, Card } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { solicitudesApi } from '../../../services/api'
import {
  IdentificacionSection,
  SponsorSection,
  ProyectoSelectorSection,
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

  const esDoliente = Form.useWatch(['identificacion', 'es_doliente'], form)

  const steps = useMemo(() => {
    let currentSection = 1
    const baseSteps = [
      {
        key: 'identificacion',
        title: 'Identificación',
        sectionNumber: currentSection++,
        content: <IdentificacionSection form={form} />
      }
    ]

    // Add sponsor section if requester is not the sponsor
    if (esDoliente === false) {
      baseSteps.push({
        key: 'sponsor',
        title: 'Sponsor',
        sectionNumber: currentSection++,
        content: <SponsorSection sectionNumber={currentSection - 1} />
      })
    }

    baseSteps.push(
      {
        key: 'proyecto_referencia',
        title: 'Servicio',
        sectionNumber: currentSection++,
        content: <ProyectoSelectorSection form={form} sectionNumber={currentSection - 1} tipo="cierre_servicio" />
      },
      {
        key: 'razonamiento',
        title: 'Razonamiento',
        sectionNumber: currentSection++,
        content: <RazonamientoSection sectionNumber={currentSection - 1} />
      },
      {
        key: 'responsables',
        title: 'Responsables',
        sectionNumber: currentSection++,
        content: <ResponsablesSection sectionNumber={currentSection - 1} />
      },
      {
        key: 'confirmacion',
        title: 'Confirmación',
        sectionNumber: currentSection++,
        content: <ConfirmacionCierreSection sectionNumber={currentSection - 1} />
      }
    )

    return baseSteps
  }, [form, esDoliente])

  const validateCurrentStep = async () => {
    try {
      const fieldsToValidate = getFieldsForStep(steps[currentStep]?.key)
      await form.validateFields(fieldsToValidate)
      return true
    } catch (error) {
      return false
    }
  }

  const getFieldsForStep = (stepKey) => {
    switch (stepKey) {
      case 'identificacion':
        return [
          ['identificacion', 'nombre_completo'],
          ['identificacion', 'cargo'],
          ['identificacion', 'area'],
          ['identificacion', 'operacion_contrato'],
          ['identificacion', 'correo'],
          ['identificacion', 'cedula'],
          ['identificacion', 'es_doliente']
        ]
      case 'sponsor':
        return [
          ['sponsor', 'nombre_completo'],
          ['sponsor', 'cargo'],
          ['sponsor', 'area'],
          ['sponsor', 'operacion_contrato'],
          ['sponsor', 'correo'],
          ['sponsor', 'cedula']
        ]
      case 'proyecto_referencia':
        return [['proyecto_referencia', 'proyecto_id']]
      case 'razonamiento':
        return [['razonamiento', 'titulo'], ['razonamiento', 'descripcion']]
      case 'responsables':
        return [
          ['responsables', 'responsable_nombre'],
          ['responsables', 'responsable_cargo']
        ]
      case 'confirmacion':
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
        titulo: values.razonamiento?.titulo,
        prioridad: 'media',
        solicitante_session_token: sessionToken,
        identificacion: values.identificacion,
        sponsor: esDoliente === false ? values.sponsor : null,
        proyecto_referencia: values.proyecto_referencia,
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
              onClick={() => window.location.href = `/consulta/${submittedCode}`}
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
        initialValues={{
          identificacion: {
            es_doliente: true
          }
        }}
      >
        {/* Render all steps but only show current one - preserves form values */}
        {steps.map((step, index) => (
          <div key={step.key} style={{ display: index === currentStep ? 'block' : 'none' }}>
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
