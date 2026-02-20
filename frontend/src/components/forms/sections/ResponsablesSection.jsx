import { Form, Input, Card, Row, Col, Typography, Space, Button } from 'antd'
import { PlusOutlined, MinusCircleOutlined, UserOutlined } from '@ant-design/icons'

const { Text } = Typography

function ResponsablesSection({ sectionNumber = 4 }) {
  return (
    <Card title={`${sectionNumber}. Responsable y Veedores`} style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Indique quién será el responsable de coordinar el cierre y quiénes serán los veedores del proceso.
      </Text>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['responsables', 'responsable_nombre']}
            label={`${sectionNumber}.1 Responsable del cierre`}
            rules={[{ required: true, message: 'Ingrese el nombre del responsable' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nombre completo del responsable" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['responsables', 'responsable_cargo']}
            label="Cargo del responsable"
            rules={[{ required: true, message: 'Ingrese el cargo del responsable' }]}
          >
            <Input placeholder="Cargo del responsable" />
          </Form.Item>
        </Col>
      </Row>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>{sectionNumber}.2 Veedores del proceso</Text>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
        Los veedores son personas que supervisarán y validarán el proceso de cierre
      </Text>

      <Form.List name={['responsables', 'veedores']}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Row key={key} gutter={16} style={{ marginBottom: 8 }}>
                <Col xs={24} md={11}>
                  <Form.Item
                    {...restField}
                    name={[name, 'nombre']}
                    rules={[{ required: true, message: 'Ingrese el nombre del veedor' }]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input prefix={<UserOutlined />} placeholder="Nombre del veedor" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={11}>
                  <Form.Item
                    {...restField}
                    name={[name, 'cargo']}
                    rules={[{ required: true, message: 'Ingrese el cargo del veedor' }]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input placeholder="Cargo del veedor" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={2}>
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => remove(name)}
                    style={{ marginTop: 4 }}
                  />
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              onClick={() => add()}
              icon={<PlusOutlined />}
              style={{ width: '100%', maxWidth: 400 }}
            >
              Agregar Veedor
            </Button>
          </>
        )}
      </Form.List>
    </Card>
  )
}

export default ResponsablesSection
