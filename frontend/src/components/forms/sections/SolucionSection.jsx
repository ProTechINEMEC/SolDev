import { useEffect, useState } from 'react'
import { Form, Input, Select, Card, Row, Col, Radio, Divider, Typography } from 'antd'
import { opcionesApi } from '../../../services/api'
import { TIPOS_SOLUCION, FORMAS_ENTREGA } from '../../../config/formOptions'
import { ListableInput } from '../ListableInput'
import FileUploader from '../FileUploader'

const { TextArea } = Input
const { Text } = Typography

function SolucionSection({ form }) {
  const [tipoSolucionOptions, setTipoSolucionOptions] = useState(TIPOS_SOLUCION)
  const [formaEntregaOptions, setFormaEntregaOptions] = useState(FORMAS_ENTREGA)

  const tieneRestricciones = Form.useWatch(['solucion', 'tiene_restricciones'], form)

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const [tipoRes, formaRes] = await Promise.all([
        opcionesApi.getByCategoria('tipo_solucion').catch(() => ({ data: { opciones: [] } })),
        opcionesApi.getByCategoria('forma_entrega').catch(() => ({ data: { opciones: [] } }))
      ])

      if (tipoRes.data.opciones?.length > 0) {
        setTipoSolucionOptions(tipoRes.data.opciones.map(opt => ({
          value: opt.valor,
          label: opt.etiqueta
        })))
      }

      if (formaRes.data.opciones?.length > 0) {
        setFormaEntregaOptions(formaRes.data.opciones.map(opt => ({
          value: opt.valor,
          label: opt.etiqueta
        })))
      }
    } catch (error) {
      console.error('Error loading options:', error)
    }
  }

  return (
    <Card title="6. Propuesta de Solución" style={{ marginBottom: 24 }}>
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.1 Tipo de Solución Esperada</Text>
      </Divider>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['solucion', 'tipo']}
            label="Tipo de Solución"
          >
            <Select
              placeholder="Seleccione tipo de solución"
              options={tipoSolucionOptions}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['solucion', 'tipo_descripcion']}
            label="Descripción adicional del tipo"
          >
            <Input placeholder="Si seleccionó 'Otro', especifique aquí" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.2 Descripción de la Solución Ideal</Text>
      </Divider>

      <Form.Item
        name={['solucion', 'descripcion_ideal']}
        label="Describa cómo imagina la solución final"
      >
        <TextArea
          rows={4}
          placeholder="Describa con detalle cómo se imagina que funcionará la solución..."
        />
      </Form.Item>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.3 Casos de Uso Principales</Text>
      </Divider>

      <Form.Item
        name={['solucion', 'casos_uso']}
        label="Describa 1-3 casos reales de uso del proyecto"
        extra="Ejemplo: 'El usuario ingresa al sistema, consulta el reporte y exporta los datos'"
      >
        <TextArea
          rows={4}
          placeholder="Caso 1: ...&#10;Caso 2: ...&#10;Caso 3: ..."
        />
      </Form.Item>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.4 Usuarios Finales</Text>
      </Divider>

      <ListableInput
        name={['solucion', 'usuarios_finales']}
        label="¿Quiénes usarán la solución final?"
        placeholder="Ej: Ingenieros de campo, Supervisores de planta"
        addButtonText="Agregar Usuario"
      />

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.5 Requerimientos Funcionales</Text>
      </Divider>

      <ListableInput
        name={['solucion', 'funcionalidades_minimas']}
        label="Funcionalidades mínimas necesarias"
        placeholder="Describa una funcionalidad"
        addButtonText="Agregar Funcionalidad Mínima"
        required
      />

      <ListableInput
        name={['solucion', 'funcionalidades_deseables']}
        label="Funcionalidades deseables (nice to have)"
        placeholder="Describa una funcionalidad deseable"
        addButtonText="Agregar Funcionalidad Deseable"
      />

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.6 Restricciones o Condiciones Especiales</Text>
      </Divider>

      <Form.Item
        name={['solucion', 'tiene_restricciones']}
        label="¿Existen restricciones o condiciones especiales?"
      >
        <Radio.Group>
          <Radio value={true}>Sí</Radio>
          <Radio value={false}>No</Radio>
        </Radio.Group>
      </Form.Item>

      {tieneRestricciones && (
        <ListableInput
          name={['solucion', 'restricciones']}
          label="Liste las restricciones o condiciones especiales"
          placeholder="Describa una restricción"
          addButtonText="Agregar Restricción"
        />
      )}

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.7 Forma de Entrega Deseada</Text>
      </Divider>

      <Form.Item
        name={['solucion', 'forma_entrega']}
        label="¿Cómo espera que se entregue la solución?"
      >
        <Select
          placeholder="Seleccione forma de entrega"
          options={formaEntregaOptions}
        />
      </Form.Item>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>6.8 Material de Referencia</Text>
      </Divider>

      <Form.Item
        name={['solucion', 'referencias']}
        label="¿Tiene ejemplos, referencias o modelos que se parezcan a lo que desea?"
      >
        <FileUploader
          name="referencias"
          hint="Adjunte capturas, documentos o enlaces de referencia"
          maxCount={5}
        />
      </Form.Item>
    </Card>
  )
}

export default SolucionSection
