import { Form, Input, Card, Radio, Divider, Typography, Space, Button } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'

const { TextArea } = Input
const { Text } = Typography

function DesempenoSection({ form, sectionNumber = 8 }) {
  const compromisoSponsor = Form.useWatch(['desempeno', 'compromiso_sponsor'], form)

  return (
    <Card title={`${sectionNumber}. Control de Desempeño`} style={{ marginBottom: 24 }}>
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.1 Definición de Indicadores Propuestos</Text>
      </Divider>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Defina los indicadores (KPIs) que permitirán medir el éxito del proyecto
      </Text>

      <Form.List name={['desempeno', 'indicadores']}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }, index) => (
              <div
                key={key}
                style={{
                  background: '#fafafa',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 16,
                  position: 'relative'
                }}
              >
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  Indicador {index + 1}
                </Text>

                <Form.Item
                  {...restField}
                  name={[name, 'nombre']}
                  label="Nombre del indicador"
                  rules={[{ required: true, message: 'Ingrese el nombre del indicador' }]}
                >
                  <Input placeholder="Ej: Tiempo de procesamiento, Tasa de error, etc." />
                </Form.Item>

                <Space style={{ display: 'flex', gap: 16 }} wrap>
                  <Form.Item
                    {...restField}
                    name={[name, 'valor_actual']}
                    label="Valor actual"
                    style={{ flex: 1, minWidth: 150 }}
                  >
                    <Input placeholder="Ej: 2 horas" />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'valor_objetivo']}
                    label="Valor objetivo"
                    style={{ flex: 1, minWidth: 150 }}
                  >
                    <Input placeholder="Ej: 30 minutos" />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'unidad']}
                    label="Unidad de medida"
                    style={{ flex: 1, minWidth: 120 }}
                  >
                    <Input placeholder="Ej: horas, %, unidades" />
                  </Form.Item>
                </Space>

                {fields.length > 0 && (
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => remove(name)}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="dashed"
              onClick={() => add()}
              icon={<PlusOutlined />}
              style={{ width: '100%' }}
            >
              Agregar Indicador
            </Button>
          </>
        )}
      </Form.List>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.2 Plan de Medición</Text>
      </Divider>

      <Form.Item
        name={['desempeno', 'como_medir']}
        label={`${sectionNumber}.2.1 ¿Cómo se medirá cada indicador?`}
      >
        <TextArea
          rows={3}
          placeholder="Describa la metodología de medición para cada indicador..."
        />
      </Form.Item>

      <Form.Item
        name={['desempeno', 'herramientas']}
        label={`${sectionNumber}.2.2 ¿Qué herramientas se usarán?`}
      >
        <Input placeholder="Ej: Excel, Power BI, Sistema interno, etc." />
      </Form.Item>

      <Form.Item
        name={['desempeno', 'responsable_datos']}
        label={`${sectionNumber}.2.3 ¿Quién captura y registra los datos?`}
      >
        <Input placeholder="Nombre o cargo del responsable de la medición" />
      </Form.Item>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.3 Responsabilidades del Sponsor</Text>
      </Divider>

      <Form.Item
        name={['desempeno', 'compromiso_sponsor']}
        label={`${sectionNumber}.3.1 ¿El sponsor se compromete a medir y reportar los KPIs?`}
      >
        <Radio.Group>
          <Radio value={true}>Sí, me comprometo</Radio>
          <Radio value={false}>No puedo comprometerme</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name={['desempeno', 'comentarios_adicionales']}
        label={`${sectionNumber}.3.2 Comentarios adicionales`}
      >
        <TextArea
          rows={2}
          placeholder="Cualquier comentario adicional sobre la medición de desempeño..."
        />
      </Form.Item>
    </Card>
  )
}

export default DesempenoSection
