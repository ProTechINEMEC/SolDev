import { useState } from 'react'
import { Form, Steps, Button, Space, message, Result, Typography, Card, Select } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { ticketsApi } from '../../../services/api'
import {
  IdentificacionSection,
  ReporteSection,
  CriticidadSection
} from '../../../components/forms/sections'

const { Title, Text, Paragraph } = Typography

const categoriaOptions = [
  { value: 'hardware', label: 'Hardware', description: 'Problemas con equipos físicos (computadores, impresoras, monitores, etc.)' },
  { value: 'software', label: 'Software', description: 'Problemas con programas o aplicaciones' },
  { value: 'red', label: 'Red', description: 'Problemas de conectividad, internet o red interna' },
  { value: 'acceso', label: 'Acceso', description: 'Problemas de permisos, contraseñas o acceso a sistemas' },
  { value: 'soporte_general', label: 'Soporte General', description: 'Otros tipos de soporte técnico' }
]

function ITTicketForm({ sessionToken, onBack, onSuccess }) {
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
      title: 'Reporte',
      content: (
        <>
          <Card title="2. Tipo de Soporte" style={{ marginBottom: 24 }}>
            <Form.Item
              name={['reporte', 'categoria']}
              label="2.1 Categoría del problema"
              rules={[{ required: true, message: 'Seleccione la categoría del problema' }]}
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Seleccione la categoría que mejor describe su problema
                </Text>
              }
            >
              <Select
                placeholder="Seleccione una categoría"
                size="large"
                options={categoriaOptions.map(opt => ({
                  value: opt.value,
                  label: (
                    <div>
                      <div style={{ fontWeight: 500 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{opt.description}</div>
                    </div>
                  )
                }))}
              />
            </Form.Item>
          </Card>
          <ReporteSection tipo="soporte" />
        </>
      )
    },
    {
      title: 'Criticidad',
      content: <CriticidadSection />
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
        return [['reporte', 'categoria'], ['reporte', 'descripcion']]
      case 2:
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
      const ticketData = {
        titulo: `Soporte: ${values.reporte?.descripcion?.substring(0, 50)}...`,
        descripcion: values.reporte?.descripcion,
        categoria: values.reporte?.categoria || 'soporte_general',
        prioridad: values.criticidad?.urgencia || 'media',
        solicitante_session_token: sessionToken,
        datos_solicitante: values.identificacion,
        criticidad: values.criticidad
      }

      const response = await ticketsApi.create(ticketData)
      setSubmittedCode(response.data.ticket.codigo)
      message.success('Ticket creado exitosamente')
      onSuccess?.(response.data.ticket)
    } catch (error) {
      console.error('Error creating ticket:', error)
      message.error(error.message || 'Error al crear el ticket')
    } finally {
      setLoading(false)
    }
  }

  if (submittedCode) {
    return (
      <Card>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="Ticket Creado Exitosamente"
          subTitle={
            <Space direction="vertical" size="small">
              <Text>Su ticket ha sido registrado con el código:</Text>
              <Title level={2} style={{ margin: 0, color: '#D52B1E' }}>
                {submittedCode}
              </Title>
              <Paragraph type="secondary">
                Guarde este código para consultar el estado de su ticket
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
                Enviar Ticket
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </Card>
  )
}

export default ITTicketForm
