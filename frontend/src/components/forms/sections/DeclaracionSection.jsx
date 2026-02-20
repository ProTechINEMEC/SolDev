import { Form, Card, Checkbox, Typography, Alert } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

function DeclaracionSection({ esSponsor = false, sectionNumber = 10 }) {
  return (
    <Card title={`${sectionNumber}. Declaración y Envío`} style={{ marginBottom: 24 }}>
      <Alert
        message="Antes de enviar"
        description="Por favor revise toda la información proporcionada. Una vez enviada, la solicitud será evaluada por el equipo de Nuevas Tecnologías."
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        name={['declaracion', 'confirmo_informacion']}
        valuePropName="checked"
        rules={[
          {
            validator: (_, value) =>
              value ? Promise.resolve() : Promise.reject(new Error('Debe confirmar la información'))
          }
        ]}
      >
        <Checkbox>
          <Text>
            <Text strong>{sectionNumber}.1 </Text>
            Confirmo que la información presentada en esta solicitud es correcta y completa al mejor de mi conocimiento.
          </Text>
        </Checkbox>
      </Form.Item>

      {esSponsor && (
        <Form.Item
          name={['declaracion', 'acepto_seguimiento']}
          valuePropName="checked"
        >
          <Checkbox>
            <Text>
              <Text strong>{sectionNumber}.2 </Text>
              Como sponsor del proyecto, acepto participar activamente en el seguimiento, validación y medición de resultados.
            </Text>
          </Checkbox>
        </Form.Item>
      )}

      <div style={{ marginTop: 24, padding: 16, background: '#f0f2f5', borderRadius: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Al enviar esta solicitud, usted acepta que:
        </Text>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
          <li>La información será revisada por el equipo de Nuevas Tecnologías</li>
          <li>Podrá ser contactado para aclaraciones o información adicional</li>
          <li>El tiempo de respuesta dependerá de la complejidad y prioridad de la solicitud</li>
          <li>Recibirá notificaciones sobre el estado de su solicitud</li>
        </ul>
      </div>
    </Card>
  )
}

export default DeclaracionSection
