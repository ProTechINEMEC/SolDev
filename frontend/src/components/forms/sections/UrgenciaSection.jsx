import { useEffect, useState } from 'react'
import { Form, Input, Select, Card, Row, Col, DatePicker, Typography } from 'antd'
import { opcionesApi } from '../../../services/api'
import { NIVELES_URGENCIA } from '../../../config/formOptions'

const { TextArea } = Input
const { Text } = Typography

function UrgenciaSection({ tipo = 'proyecto_nuevo_interno' }) {
  const [urgenciaOptions, setUrgenciaOptions] = useState(NIVELES_URGENCIA)

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const res = await opcionesApi.getByCategoria('urgencia').catch(() => ({ data: { opciones: [] } }))
      if (res.data.opciones?.length > 0) {
        setUrgenciaOptions(res.data.opciones.map(opt => ({
          value: opt.valor,
          label: opt.etiqueta
        })))
      }
    } catch (error) {
      console.error('Error loading options:', error)
    }
  }

  const labelNecesidad = tipo === 'actualizacion'
    ? '5.1 Necesidad principal de la actualización'
    : '5.1 Necesidad principal del proyecto'

  return (
    <Card title="5. Necesidad y Urgencia" style={{ marginBottom: 24 }}>
      <Form.Item
        name={['urgencia', 'necesidad_principal']}
        label={labelNecesidad}
        rules={[{ required: true, message: 'Describa la necesidad principal' }]}
      >
        <TextArea
          rows={4}
          placeholder="¿Cuál es la necesidad que busca resolver con este proyecto/actualización?"
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['urgencia', 'nivel']}
            label="5.2 Nivel de Urgencia"
            rules={[{ required: true, message: 'Seleccione el nivel de urgencia' }]}
          >
            <Select
              placeholder="Seleccione nivel de urgencia"
              options={urgenciaOptions}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['urgencia', 'fecha_limite']}
            label="5.3 Fecha Límite (si aplica)"
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Seleccione fecha límite"
              format="DD/MM/YYYY"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name={['urgencia', 'justificacion_nt']}
        label="5.4 ¿Por qué este proyecto debe ser desarrollado por Nuevas Tecnologías?"
        rules={[{ required: true, message: 'Justifique por qué NT debe desarrollar esto' }]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Explique por qué considera que el equipo de Nuevas Tecnologías es el indicado para este desarrollo
          </Text>
        }
      >
        <TextArea
          rows={3}
          placeholder="¿Por qué NT? ¿Qué capacidades o recursos específicos requiere?"
        />
      </Form.Item>
    </Card>
  )
}

export default UrgenciaSection
