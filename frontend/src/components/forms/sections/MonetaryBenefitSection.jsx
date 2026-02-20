import { Form, Input, InputNumber, Radio, Typography, Space, Button, Divider } from 'antd'
import { PlusOutlined, MinusCircleOutlined, DollarOutlined } from '@ant-design/icons'

const { Text, Title } = Typography
const { TextArea } = Input

// Format number as Colombian Pesos
const formatCOP = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$ 0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function MonetaryBenefitSection({ form, sectionNumber = 7, subSectionNumber = 6 }) {
  const esperaBeneficio = Form.useWatch(['beneficios', 'beneficio_monetario', 'espera_beneficio'], form)
  const beneficiosItems = Form.useWatch(['beneficios', 'beneficio_monetario', 'items'], form) || []

  // Calculate total
  const totalBeneficio = beneficiosItems.reduce((sum, item) => {
    const cantidad = item?.cantidad || 1
    const valor = item?.valor || 0
    return sum + (cantidad * valor)
  }, 0)

  return (
    <div style={{ marginTop: 24 }}>
      <Form.Item
        name={['beneficios', 'beneficio_monetario', 'espera_beneficio']}
        label={`${sectionNumber}.1.${subSectionNumber} ¿Se espera beneficio monetario directo?`}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Beneficio monetario directo incluye: nuevos ingresos, ahorros directos cuantificables,
            reducción de multas, mejora en facturación, etc.
          </Text>
        }
      >
        <Radio.Group>
          <Radio value={true}>Sí</Radio>
          <Radio value={false}>No</Radio>
        </Radio.Group>
      </Form.Item>

      {esperaBeneficio && (
        <div style={{ marginTop: 16, padding: 16, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
          <Title level={5} style={{ marginBottom: 16 }}>
            <DollarOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            Detalle del Beneficio Monetario Esperado
          </Title>

          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Describa los beneficios monetarios directos que se esperan obtener con el proyecto.
          </Text>

          <Form.List name={['beneficios', 'beneficio_monetario', 'items']}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <div
                    key={key}
                    style={{
                      background: '#fff',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      border: '1px solid #d9d9d9'
                    }}
                  >
                    <Space style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} align="start">
                      <Form.Item
                        {...restField}
                        name={[name, 'descripcion']}
                        rules={[{ required: true, message: 'Descripción requerida' }]}
                        style={{ marginBottom: 0, flex: 2, minWidth: 200 }}
                      >
                        <Input placeholder="Descripción del beneficio (ej: Incremento en ventas por automatización)" />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'cantidad']}
                        initialValue={1}
                        style={{ marginBottom: 0, width: 100 }}
                      >
                        <InputNumber
                          min={1}
                          placeholder="Cant."
                          style={{ width: '100%' }}
                          addonBefore="×"
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'valor']}
                        rules={[{ required: true, message: 'Valor requerido' }]}
                        style={{ marginBottom: 0, width: 150 }}
                      >
                        <InputNumber
                          min={0}
                          placeholder="Valor COP"
                          style={{ width: '100%' }}
                          formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                          parser={(value) => value.replace(/\$\s?|(\.)/g, '')}
                        />
                      </Form.Item>

                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Space>
                  </div>
                ))}

                <Button
                  type="dashed"
                  onClick={() => add({ cantidad: 1 })}
                  icon={<PlusOutlined />}
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  Agregar Beneficio Monetario
                </Button>

                {fields.length > 0 && (
                  <div
                    style={{
                      background: '#f6ffed',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #52c41a',
                      textAlign: 'center',
                      marginTop: 16
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>Total Beneficio Monetario Esperado</Text>
                    <br />
                    <Text strong style={{ fontSize: 24, color: '#52c41a' }}>
                      {formatCOP(totalBeneficio)}
                    </Text>
                  </div>
                )}
              </>
            )}
          </Form.List>

          <Form.Item
            name={['beneficios', 'beneficio_monetario', 'justificacion']}
            label="Justificación del beneficio"
            style={{ marginTop: 16 }}
            rules={[{ required: true, message: 'Justifique el beneficio esperado' }]}
          >
            <TextArea
              rows={3}
              placeholder="Explique cómo se calcularon estos valores y qué supuestos se utilizaron..."
            />
          </Form.Item>
        </div>
      )}
    </div>
  )
}

export default MonetaryBenefitSection
