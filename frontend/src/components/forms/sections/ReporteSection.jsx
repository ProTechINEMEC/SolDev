import { Form, Input, Card, Typography } from 'antd'

const { TextArea } = Input
const { Text } = Typography

function ReporteSection({ label = 'Descripción de la situación', tipo = 'soporte' }) {
  const cardTitle = tipo === 'fallo' ? '2. Reporte del Fallo' : '2. Reporte de la Situación'
  const fieldLabel = tipo === 'fallo' ? '2.1 Descripción del fallo' : '2.1 Descripción de la situación'
  const placeholder = tipo === 'fallo'
    ? 'Describa detalladamente el fallo o error que está experimentando...\n\n- ¿Qué sistema o aplicación presenta el problema?\n- ¿Qué acción estaba realizando cuando ocurrió?\n- ¿El error se presenta siempre o es intermitente?\n- ¿Hay algún mensaje de error?'
    : 'Describa detalladamente la situación o problema que requiere soporte...\n\n- ¿Cuál es el problema?\n- ¿Desde cuándo ocurre?\n- ¿Qué ha intentado para solucionarlo?'

  return (
    <Card title={cardTitle} style={{ marginBottom: 24 }}>
      <Form.Item
        name={['reporte', 'descripcion']}
        label={fieldLabel}
        rules={[
          { required: true, message: 'Ingrese la descripción' },
          { min: 20, message: 'La descripción debe tener al menos 20 caracteres' }
        ]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Proporcione la mayor cantidad de detalles posible para facilitar la atención
          </Text>
        }
      >
        <TextArea
          rows={6}
          placeholder={placeholder}
          showCount
          maxLength={2000}
        />
      </Form.Item>
    </Card>
  )
}

export default ReporteSection
