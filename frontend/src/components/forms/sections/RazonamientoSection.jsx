import { Form, Input, Card, Typography } from 'antd'

const { TextArea } = Input
const { Text } = Typography

function RazonamientoSection() {
  return (
    <Card title="2. Razonamiento" style={{ marginBottom: 24 }}>
      <Form.Item
        name={['razonamiento', 'descripcion']}
        label="2.1 Descripción de la razón de cierre"
        rules={[
          { required: true, message: 'Describa la razón del cierre' },
          { min: 20, message: 'La descripción debe tener al menos 20 caracteres' }
        ]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Proporcione una justificación clara y detallada de por qué se solicita el cierre de este servicio
          </Text>
        }
      >
        <TextArea
          rows={6}
          placeholder="Describa detalladamente las razones por las cuales se solicita el cierre del servicio...

Considere incluir:
- ¿Por qué ya no se necesita el servicio?
- ¿Fue reemplazado por otro sistema?
- ¿Cuántos usuarios se verán afectados?
- ¿Hay datos que deban preservarse?"
          showCount
          maxLength={2000}
        />
      </Form.Item>
    </Card>
  )
}

export default RazonamientoSection
