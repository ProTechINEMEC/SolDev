import { Form, Card, Checkbox, Typography, Alert } from 'antd'
import { WarningOutlined } from '@ant-design/icons'

const { Text } = Typography

function ConfirmacionCierreSection({ sectionNumber = 5 }) {
  return (
    <Card title={`${sectionNumber}. Confirmación`} style={{ marginBottom: 24 }}>
      <Alert
        message="Atención"
        description="El cierre de un servicio es una acción importante que puede afectar a múltiples usuarios y procesos. Asegúrese de que esta solicitud ha sido coordinada con todas las partes interesadas."
        type="warning"
        icon={<WarningOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        name={['confirmacion', 'confirmo_cierre']}
        valuePropName="checked"
        rules={[
          {
            validator: (_, value) =>
              value ? Promise.resolve() : Promise.reject(new Error('Debe confirmar la solicitud de cierre'))
          }
        ]}
      >
        <Checkbox>
          <Text>
            <Text strong>{sectionNumber}.1 </Text>
            Confirmo que deseo solicitar el cierre de este servicio y que he coordinado con las áreas afectadas.
          </Text>
        </Checkbox>
      </Form.Item>

      <div style={{ marginTop: 24, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
        <Text style={{ fontSize: 12 }}>
          <Text strong>Importante:</Text> Al enviar esta solicitud:
        </Text>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 12 }}>
          <li>El equipo de Nuevas Tecnologías evaluará la solicitud</li>
          <li>Se verificará que no haya dependencias críticas activas</li>
          <li>Se coordinará un plan de cierre si procede</li>
          <li>Los datos podrán ser respaldados antes del cierre definitivo</li>
        </ul>
      </div>
    </Card>
  )
}

export default ConfirmacionCierreSection
