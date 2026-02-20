import { useState, useMemo } from 'react'
import { Form, Steps, Button, Space, message, Result, Typography, Card } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { solicitudesApi, archivosApi } from '../../../services/api'
import {
  IdentificacionSection,
  ReporteSection,
  CriticidadSection,
  ProyectoSelectorSection
} from '../../../components/forms/sections'

const { Title, Text, Paragraph } = Typography

function ReporteFalloForm({ sessionToken, onBack, onSuccess }) {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submittedCode, setSubmittedCode] = useState(null)

  const steps = useMemo(() => {
    let currentSection = 1
    return [
      {
        key: 'identificacion',
        title: 'Identificación',
        sectionNumber: currentSection++,
        content: <IdentificacionSection form={form} showSponsorQuestion={false} />
      },
      {
        key: 'proyecto_referencia',
        title: 'Proyecto',
        sectionNumber: currentSection++,
        content: <ProyectoSelectorSection form={form} sectionNumber={currentSection - 1} tipo="reporte_fallo" />
      },
      {
        key: 'reporte',
        title: 'Reporte',
        sectionNumber: currentSection++,
        content: <ReporteSection tipo="fallo" sectionNumber={currentSection - 1} />
      },
      {
        key: 'criticidad',
        title: 'Criticidad',
        sectionNumber: currentSection++,
        content: <CriticidadSection sectionNumber={currentSection - 1} />
      }
    ]
  }, [form])

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
          ['identificacion', 'cedula']
        ]
      case 'proyecto_referencia':
        return [['proyecto_referencia', 'proyecto_id']]
      case 'reporte':
        return [['reporte', 'titulo'], ['reporte', 'descripcion']]
      case 'criticidad':
        return [
          ['criticidad', 'urgencia'],
          ['criticidad', 'justificacion']
        ]
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
        tipo: 'reporte_fallo',
        titulo: values.reporte?.titulo,
        prioridad: values.criticidad?.urgencia || 'media',
        solicitante_session_token: sessionToken,
        identificacion: values.identificacion,
        proyecto_referencia: values.proyecto_referencia,
        reporte: values.reporte,
        criticidad: values.criticidad
      }

      const response = await solicitudesApi.create(solicitudData)
      const solicitudId = response.data.solicitud.id

      // Upload files if any
      const allFiles = []

      // Collect files from reporte evidencia
      if (values.reporte?.evidencia?.length > 0) {
        allFiles.push(...values.reporte.evidencia.filter(f => f.originFileObj))
      }

      // Upload all collected files
      if (allFiles.length > 0) {
        try {
          await archivosApi.upload('solicitud', solicitudId, allFiles, sessionToken)
          message.success(`${allFiles.length} archivo(s) subido(s)`)
        } catch (uploadError) {
          console.error('Error uploading files:', uploadError)
          message.warning('Reporte creado pero algunos archivos no se pudieron subir')
        }
      }

      setSubmittedCode(response.data.solicitud.codigo)
      message.success('Reporte de fallo enviado exitosamente')
      onSuccess?.(response.data.solicitud)
    } catch (error) {
      console.error('Error creating solicitud:', error)
      message.error(error.message || 'Error al enviar el reporte')
    } finally {
      setLoading(false)
    }
  }

  if (submittedCode) {
    return (
      <Card>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="Reporte de Fallo Enviado"
          subTitle={
            <Space direction="vertical" size="small">
              <Text>Su reporte ha sido registrado con el código:</Text>
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
                Enviar Reporte
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </Card>
  )
}

export default ReporteFalloForm
