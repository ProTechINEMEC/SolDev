import { Form, Input, InputNumber, Card, Typography, Space, Button, Table, Divider } from 'antd'
import { PlusOutlined, MinusCircleOutlined, DollarOutlined } from '@ant-design/icons'

const { Text, Title } = Typography

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

function CostAnalysisSection({ form, sectionNumber = 7, subSectionNumber = 5 }) {
  const costosActuales = Form.useWatch(['beneficios', 'analisis_costos', 'costos_actuales'], form) || []
  const costosEsperados = Form.useWatch(['beneficios', 'analisis_costos', 'costos_esperados'], form) || []

  // Calculate totals
  const totalActual = costosActuales.reduce((sum, item) => {
    const cantidad = item?.cantidad || 1
    const valor = item?.valor || 0
    return sum + (cantidad * valor)
  }, 0)

  const totalEsperado = costosEsperados.reduce((sum, item) => {
    const cantidad = item?.cantidad || 1
    const valor = item?.valor || 0
    return sum + (cantidad * valor)
  }, 0)

  const beneficioEsperado = totalActual - totalEsperado

  return (
    <div style={{ marginTop: 24, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
      <Title level={5} style={{ marginBottom: 16 }}>
        <DollarOutlined style={{ marginRight: 8, color: '#52c41a' }} />
        {sectionNumber}.1.{subSectionNumber} Análisis de Reducción de Costos
      </Title>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Ingrese los costos actuales y los costos esperados después del proyecto para calcular el beneficio.
      </Text>

      {/* Current Costs */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>Costos Actuales</Text>
      </Divider>

      <Form.List name={['beneficios', 'analisis_costos', 'costos_actuales']}>
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
                    <Input placeholder="Descripción del costo (ej: Horas de trabajo manual)" />
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
              Agregar Costo Actual
            </Button>

            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <Text strong>Total Costos Actuales: </Text>
              <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                {formatCOP(totalActual)}
              </Text>
            </div>
          </>
        )}
      </Form.List>

      {/* Expected Costs After Project */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>Costos Esperados (después del proyecto)</Text>
      </Divider>

      <Form.List name={['beneficios', 'analisis_costos', 'costos_esperados']}>
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
                    <Input placeholder="Descripción del costo (ej: Mantenimiento sistema)" />
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
              Agregar Costo Esperado
            </Button>

            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <Text strong>Total Costos Esperados: </Text>
              <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
                {formatCOP(totalEsperado)}
              </Text>
            </div>
          </>
        )}
      </Form.List>

      {/* Benefit Summary */}
      <div
        style={{
          background: beneficioEsperado >= 0 ? '#f6ffed' : '#fff2f0',
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${beneficioEsperado >= 0 ? '#52c41a' : '#ff4d4f'}`,
          textAlign: 'center'
        }}
      >
        <Text style={{ fontSize: 14 }}>Beneficio Esperado por Reducción de Costos</Text>
        <br />
        <Text
          strong
          style={{
            fontSize: 24,
            color: beneficioEsperado >= 0 ? '#52c41a' : '#ff4d4f'
          }}
        >
          {formatCOP(beneficioEsperado)}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          (Costos Actuales - Costos Esperados = Ahorro)
        </Text>
      </div>
    </div>
  )
}

export default CostAnalysisSection
