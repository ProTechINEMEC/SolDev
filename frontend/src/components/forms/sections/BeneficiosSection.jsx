import { Form, Input, Card, Radio, Divider, Typography } from 'antd'
import { ListableInput } from '../ListableInput'
import CostAnalysisSection from './CostAnalysisSection'
import MonetaryBenefitSection from './MonetaryBenefitSection'

const { TextArea } = Input
const { Text } = Typography

function BeneficiosSection({ form, sectionNumber = 7 }) {
  const reduccionCostos = Form.useWatch(['beneficios', 'reduccion_costos'], form)

  return (
    <Card title={`${sectionNumber}. Beneficio Esperado`} style={{ marginBottom: 24 }}>
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.1 Desempeño de la Solución</Text>
      </Divider>

      <Form.Item
        name={['beneficios', 'descripcion']}
        label={`${sectionNumber}.1.1 Descripción del beneficio esperado`}
        rules={[{ required: true, message: 'Describa el beneficio esperado' }]}
      >
        <TextArea
          rows={3}
          placeholder="¿Qué beneficios espera obtener con la implementación de este proyecto?"
        />
      </Form.Item>

      <Form.Item
        name={['beneficios', 'mejora_concreta']}
        label={`${sectionNumber}.1.2 ¿Qué mejora concreta se espera obtener?`}
        rules={[{ required: true, message: 'Describa la mejora concreta' }]}
      >
        <TextArea
          rows={3}
          placeholder="Sea específico: ¿Qué se mejorará? ¿En qué porcentaje? ¿Cómo se evidenciará?"
        />
      </Form.Item>

      <ListableInput
        name={['beneficios', 'procesos_optimizados']}
        label={`${sectionNumber}.1.3 Procesos que se optimizan`}
        placeholder="Nombre del proceso"
        addButtonText="Agregar Proceso"
        emptyText="No hay procesos agregados"
      />

      <Form.Item
        name={['beneficios', 'reduccion_costos']}
        label={`${sectionNumber}.1.4 ¿Se espera reducción de costos?`}
      >
        <Radio.Group>
          <Radio value={true}>Sí</Radio>
          <Radio value={false}>No</Radio>
        </Radio.Group>
      </Form.Item>

      {reduccionCostos && (
        <CostAnalysisSection
          form={form}
          sectionNumber={sectionNumber}
          subSectionNumber={5}
        />
      )}

      <MonetaryBenefitSection
        form={form}
        sectionNumber={sectionNumber}
        subSectionNumber={reduccionCostos ? 6 : 5}
      />
    </Card>
  )
}

export default BeneficiosSection
