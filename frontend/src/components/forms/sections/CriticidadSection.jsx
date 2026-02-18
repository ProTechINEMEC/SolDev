import { Form, Input, Card, Radio, Space, Typography } from 'antd'
import {
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'

const { TextArea } = Input
const { Text } = Typography

const urgenciaOptions = [
  {
    value: 'baja',
    label: 'Baja',
    description: 'Puede esperar, no afecta operaciones críticas',
    icon: <ClockCircleOutlined style={{ color: '#52c41a' }} />,
    color: '#52c41a'
  },
  {
    value: 'media',
    label: 'Media',
    description: 'Afecta productividad pero hay alternativas temporales',
    icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
    color: '#1890ff'
  },
  {
    value: 'alta',
    label: 'Alta',
    description: 'Impacta procesos importantes, requiere atención pronto',
    icon: <WarningOutlined style={{ color: '#faad14' }} />,
    color: '#faad14'
  },
  {
    value: 'critica',
    label: 'Crítica',
    description: 'Detiene operaciones críticas, requiere atención inmediata',
    icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
    color: '#ff4d4f'
  }
]

function CriticidadSection() {
  return (
    <Card title="3. Criticidad" style={{ marginBottom: 24 }}>
      <Form.Item
        name={['criticidad', 'urgencia']}
        label="3.1 Urgencia de la solución"
        rules={[{ required: true, message: 'Seleccione el nivel de urgencia' }]}
      >
        <Radio.Group>
          <Space direction="vertical" style={{ width: '100%' }}>
            {urgenciaOptions.map((option) => (
              <Radio
                key={option.value}
                value={option.value}
                style={{
                  display: 'flex',
                  padding: '12px 16px',
                  background: '#fafafa',
                  borderRadius: 8,
                  width: '100%'
                }}
              >
                <Space>
                  {option.icon}
                  <div>
                    <Text strong style={{ color: option.color }}>{option.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{option.description}</Text>
                  </div>
                </Space>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name={['criticidad', 'justificacion']}
        label="3.2 Justificación"
        rules={[
          { required: true, message: 'Justifique el nivel de urgencia seleccionado' },
          { min: 10, message: 'La justificación debe tener al menos 10 caracteres' }
        ]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Explique por qué considera que este es el nivel de urgencia apropiado
          </Text>
        }
      >
        <TextArea
          rows={3}
          placeholder="¿Por qué este nivel de urgencia? ¿Qué consecuencias hay si no se atiende pronto?"
          showCount
          maxLength={500}
        />
      </Form.Item>
    </Card>
  )
}

export default CriticidadSection
