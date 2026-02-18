import { useEffect, useState } from 'react'
import { Form, Input, Select, Card, Row, Col, DatePicker, Divider, Typography } from 'antd'
import { opcionesApi } from '../../../services/api'
import { CRITICIDAD_LEVELS } from '../../../config/formOptions'
import FileUploader from '../FileUploader'

const { TextArea } = Input
const { Text } = Typography

function ProblematicaSection() {
  const [criticidadOptions, setCriticidadOptions] = useState(CRITICIDAD_LEVELS)

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const res = await opcionesApi.getByCategoria('criticidad').catch(() => ({ data: { opciones: [] } }))
      if (res.data.opciones?.length > 0) {
        setCriticidadOptions(res.data.opciones.map(opt => ({
          value: opt.valor,
          label: opt.etiqueta
        })))
      }
    } catch (error) {
      console.error('Error loading options:', error)
    }
  }

  return (
    <Card title="4. Descripción de la Problemática/Situación" style={{ marginBottom: 24 }}>
      <Form.Item
        name={['problematica', 'situacion_actual']}
        label="4.1 Describa la situación/problemática actual"
        rules={[{ required: true, message: 'Describa la situación actual' }]}
      >
        <TextArea
          rows={4}
          placeholder="Describa detalladamente la situación o problemática que motiva esta solicitud..."
        />
      </Form.Item>

      <Form.Item
        name={['problematica', 'origen']}
        label="4.2 ¿Cuál es el origen del problema?"
        rules={[{ required: true, message: 'Describa el origen del problema' }]}
      >
        <TextArea
          rows={3}
          placeholder="¿Cómo surgió esta situación? ¿Qué la causó?"
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['problematica', 'fecha_inicio']}
            label="4.3 ¿Desde cuándo se presenta el problema?"
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Seleccione fecha aproximada"
              format="DD/MM/YYYY"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name={['problematica', 'evidencia']}
        label="4.4 Evidencia del problema (adjuntos)"
      >
        <FileUploader
          name="evidencia"
          hint="Adjunte capturas, documentos o cualquier evidencia que ilustre el problema"
          maxCount={5}
        />
      </Form.Item>

      <Form.Item
        name={['problematica', 'afectacion_operacion']}
        label="4.5 ¿Cómo afecta a la operación?"
        rules={[{ required: true, message: 'Describa cómo afecta la operación' }]}
      >
        <TextArea
          rows={3}
          placeholder="Describa el impacto en las operaciones diarias..."
        />
      </Form.Item>

      <Form.Item
        name={['problematica', 'procesos_comprometidos']}
        label="4.6 ¿Qué procesos, tareas o resultados se ven comprometidos?"
        rules={[{ required: true, message: 'Liste los procesos afectados' }]}
      >
        <TextArea
          rows={3}
          placeholder="Liste los procesos, tareas o entregables que se ven afectados..."
        />
      </Form.Item>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>4.7 Impacto si NO se desarrolla el proyecto</Text>
      </Divider>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name={['problematica', 'impacto_nivel']}
            label="Nivel de Impacto"
            rules={[{ required: true, message: 'Seleccione el nivel de impacto' }]}
          >
            <Select
              placeholder="Seleccione nivel"
              options={criticidadOptions}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item
            name={['problematica', 'impacto_descripcion']}
            label="Descripción del Impacto"
            rules={[{ required: true, message: 'Describa el impacto' }]}
          >
            <TextArea
              rows={2}
              placeholder="Describa las consecuencias de no abordar este problema..."
            />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

export default ProblematicaSection
