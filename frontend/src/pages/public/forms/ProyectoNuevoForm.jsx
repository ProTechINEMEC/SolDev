import { useState, useMemo } from 'react'
import { Form, Steps, Button, Space, message, Result, Typography, Card, Progress } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { solicitudesApi, archivosApi } from '../../../services/api'
import {
  IdentificacionSection,
  SponsorSection,
  StakeholdersSection,
  ProblematicaSection,
  UrgenciaSection,
  SolucionSection,
  BeneficiosSection,
  DesempenoSection,
  AdjuntosSection,
  DeclaracionSection,
  ProyectoSelectorSection
} from '../../../components/forms/sections'

const { Title, Text, Paragraph } = Typography

function ProyectoNuevoForm({ tipo = 'proyecto_nuevo_interno', sessionToken, onBack, onSuccess }) {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submittedCode, setSubmittedCode] = useState(null)

  const esDoliente = Form.useWatch(['identificacion', 'es_doliente'], form)
  const isActualizacion = tipo === 'actualizacion'

  // Build dynamic steps based on whether sponsor section is needed and form type
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

    // Add sponsor section only if esDoliente is explicitly false
    if (esDoliente === false) {
      baseSteps.push({
        key: 'sponsor',
        title: 'Sponsor',
        sectionNumber: currentSection++,
        content: <SponsorSection sectionNumber={currentSection - 1} />
      })
    }

    // Add proyecto selector for actualizacion
    if (isActualizacion) {
      baseSteps.push({
        key: 'proyecto_referencia',
        title: 'Proyecto',
        sectionNumber: currentSection++,
        content: <ProyectoSelectorSection form={form} sectionNumber={currentSection - 1} tipo="actualizacion" />
      })
    }

    baseSteps.push(
      {
        key: 'stakeholders',
        title: 'Partes Interesadas',
        sectionNumber: currentSection++,
        content: <StakeholdersSection form={form} sectionNumber={currentSection - 1} />
      },
      {
        key: 'problematica',
        title: 'Problemática',
        sectionNumber: currentSection++,
        content: <ProblematicaSection sectionNumber={currentSection - 1} />
      },
      {
        key: 'urgencia',
        title: 'Urgencia',
        sectionNumber: currentSection++,
        content: <UrgenciaSection tipo={tipo} sectionNumber={currentSection - 1} />
      },
      {
        key: 'solucion',
        title: 'Solución',
        sectionNumber: currentSection++,
        content: <SolucionSection form={form} sectionNumber={currentSection - 1} />
      },
      {
        key: 'beneficios',
        title: 'Beneficios',
        sectionNumber: currentSection++,
        content: <BeneficiosSection form={form} sectionNumber={currentSection - 1} />
      },
      {
        key: 'desempeno',
        title: 'Desempeño',
        sectionNumber: currentSection++,
        content: <DesempenoSection form={form} sectionNumber={currentSection - 1} />
      },
      {
        key: 'adjuntos',
        title: 'Adjuntos',
        sectionNumber: currentSection++,
        content: <AdjuntosSection sectionNumber={currentSection - 1} />
      },
      {
        key: 'declaracion',
        title: 'Declaración',
        sectionNumber: currentSection++,
        content: <DeclaracionSection esSponsor={esDoliente !== false} sectionNumber={currentSection - 1} />
      }
    )

    return baseSteps
  }, [esDoliente, tipo, form, isActualizacion])

  const validateCurrentStep = async () => {
    try {
      const fieldsToValidate = getFieldsForStep(steps[currentStep]?.key)
      if (fieldsToValidate.length > 0) {
        await form.validateFields(fieldsToValidate)
      }
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
      case 'problematica':
        return [
          ['problematica', 'titulo'],
          ['problematica', 'situacion_actual'],
          ['problematica', 'origen'],
          ['problematica', 'afectacion_operacion'],
          ['problematica', 'procesos_comprometidos'],
          ['problematica', 'impacto_nivel'],
          ['problematica', 'impacto_descripcion']
        ]
      case 'urgencia':
        return [
          ['urgencia', 'necesidad_principal'],
          ['urgencia', 'nivel'],
          ['urgencia', 'justificacion_nt']
        ]
      case 'solucion':
        return [['solucion', 'funcionalidades_minimas']]
      case 'beneficios':
        return [
          ['beneficios', 'descripcion'],
          ['beneficios', 'mejora_concreta']
        ]
      case 'declaracion':
        return [['declaracion', 'confirmo_informacion']]
      default:
        return []
    }
  }

  const handleNext = async () => {
    const valid = await validateCurrentStep()
    if (valid) {
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    try {
      const valid = await validateCurrentStep()
      if (!valid) return

      setLoading(true)
      const values = await form.validateFields()

      // Map urgencia level to prioridad
      const urgenciaToPrioridad = {
        'inmediata': 'critica',
        'corto_plazo': 'alta',
        'mediano_plazo': 'media',
        'largo_plazo': 'baja'
      }

      // Map form values to API format
      const solicitudData = {
        tipo,
        titulo: values.problematica?.titulo,
        prioridad: urgenciaToPrioridad[values.urgencia?.nivel] || 'media',
        solicitante_session_token: sessionToken,
        identificacion: values.identificacion,
        sponsor: esDoliente === false ? values.sponsor : null,
        proyecto_referencia: values.proyecto_referencia,
        stakeholders: values.stakeholders,
        problematica: values.problematica,
        urgencia: values.urgencia,
        solucion: values.solucion,
        beneficios: values.beneficios,
        desempeno: values.desempeno,
        adjuntos: values.adjuntos,
        declaracion: values.declaracion
      }

      const response = await solicitudesApi.create(solicitudData)
      const solicitudId = response.data.solicitud.id

      // Upload files from each form section with their respective origin
      let totalFilesUploaded = 0

      // Upload files from problematica evidencia
      const problematicaFiles = values.problematica?.evidencia?.filter(f => f.originFileObj) || []
      if (problematicaFiles.length > 0) {
        try {
          await archivosApi.upload('solicitud', solicitudId, problematicaFiles, sessionToken, 'problematica_evidencia')
          totalFilesUploaded += problematicaFiles.length
        } catch (err) {
          console.error('Error uploading problematica files:', err)
        }
      }

      // Upload files from solucion referencias
      const solucionRefFiles = values.solucion?.referencias?.filter(f => f.originFileObj) || []
      if (solucionRefFiles.length > 0) {
        try {
          await archivosApi.upload('solicitud', solicitudId, solucionRefFiles, sessionToken, 'solucion_referencias')
          totalFilesUploaded += solucionRefFiles.length
        } catch (err) {
          console.error('Error uploading solucion referencias files:', err)
        }
      }

      // Upload files from solucion material_referencia
      const solucionMatFiles = values.solucion?.material_referencia?.filter(f => f.originFileObj) || []
      if (solucionMatFiles.length > 0) {
        try {
          await archivosApi.upload('solicitud', solicitudId, solucionMatFiles, sessionToken, 'solucion_material')
          totalFilesUploaded += solucionMatFiles.length
        } catch (err) {
          console.error('Error uploading solucion material files:', err)
        }
      }

      // Upload files from adjuntos generales
      const adjuntosFiles = values.adjuntos?.archivos?.filter(f => f.originFileObj) || []
      if (adjuntosFiles.length > 0) {
        try {
          await archivosApi.upload('solicitud', solicitudId, adjuntosFiles, sessionToken, 'adjuntos_generales')
          totalFilesUploaded += adjuntosFiles.length
        } catch (err) {
          console.error('Error uploading adjuntos files:', err)
        }
      }

      if (totalFilesUploaded > 0) {
        message.success(`${totalFilesUploaded} archivo(s) subido(s)`)
      }

      setSubmittedCode(response.data.solicitud.codigo)
      message.success('Solicitud enviada exitosamente')
      onSuccess?.(response.data.solicitud)
    } catch (error) {
      console.error('Error creating solicitud:', error)
      message.error(error.message || 'Error al enviar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const progress = Math.round(((currentStep + 1) / steps.length) * 100)

  if (submittedCode) {
    return (
      <Card>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="Solicitud Enviada Exitosamente"
          subTitle={
            <Space direction="vertical" size="small">
              <Text>Su solicitud ha sido registrada con el código:</Text>
              <Title level={2} style={{ margin: 0, color: '#D52B1E' }}>
                {submittedCode}
              </Title>
              <Paragraph type="secondary">
                Guarde este código para consultar el estado de su solicitud.
                El equipo de Nuevas Tecnologías evaluará su solicitud y le notificará cualquier actualización.
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
    <div>
      {/* Progress indicator */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Progress
            percent={progress}
            showInfo={false}
            strokeColor="#D52B1E"
            style={{ flex: 1 }}
          />
          <Text type="secondary">
            Paso {currentStep + 1} de {steps.length}
          </Text>
        </div>
      </Card>

      {/* Steps navigation */}
      <Steps
        current={currentStep}
        items={steps.map((s) => ({ title: s.title }))}
        style={{ marginBottom: 24 }}
        responsive={false}
        size="small"
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
            {onBack && currentStep === 0 && (
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
                style={{ background: '#D52B1E', borderColor: '#D52B1E' }}
              >
                Enviar Solicitud
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </div>
  )
}

export default ProyectoNuevoForm
