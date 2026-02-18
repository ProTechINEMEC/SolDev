import { Form, Input, Card, Radio, Divider, Typography } from 'antd'
import { ListableInput } from '../ListableInput'

const { TextArea } = Input
const { Text } = Typography

function BeneficiosSection({ form }) {
  const reduccionCostos = Form.useWatch(['beneficios', 'reduccion_costos'], form)

  return (
    <Card title="7. Beneficio Esperado" style={{ marginBottom: 24 }}>
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>7.1 Desempeño de la Solución</Text>
      </Divider>

      <Form.Item
        name={['beneficios', 'descripcion']}
        label="7.1.1 Descripción del beneficio esperado"
        rules={[{ required: true, message: 'Describa el beneficio esperado' }]}
      >
        <TextArea
          rows={3}
          placeholder="¿Qué beneficios espera obtener con la implementación de este proyecto?"
        />
      </Form.Item>

      <Form.Item
        name={['beneficios', 'mejora_concreta']}
        label="7.1.2 ¿Qué mejora concreta se espera obtener?"
        rules={[{ required: true, message: 'Describa la mejora concreta' }]}
      >
        <TextArea
          rows={3}
          placeholder="Sea específico: ¿Qué se mejorará? ¿En qué porcentaje? ¿Cómo se evidenciará?"
        />
      </Form.Item>

      <ListableInput
        name={['beneficios', 'procesos_optimizados']}
        label="7.1.3 Procesos que se optimizan"
        placeholder="Nombre del proceso"
        addButtonText="Agregar Proceso"
        emptyText="No hay procesos agregados"
      />

      <Form.Item
        name={['beneficios', 'reduccion_costos']}
        label="7.1.4 ¿Se espera reducción de costos?"
      >
        <Radio.Group>
          <Radio value={true}>Sí</Radio>
          <Radio value={false}>No</Radio>
        </Radio.Group>
      </Form.Item>

      {reduccionCostos && (
        <Form.Item
          name={['beneficios', 'costos_descripcion']}
          label="Describa los costos afectados"
          rules={[{ required: true, message: 'Describa los costos que se reducirán' }]}
        >
          <TextArea
            rows={3}
            placeholder="¿Qué costos se reducirán? ¿En qué magnitud aproximada?"
          />
        </Form.Item>
      )}
    </Card>
  )
}

export default BeneficiosSection
