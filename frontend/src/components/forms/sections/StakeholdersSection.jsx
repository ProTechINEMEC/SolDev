import { Form, Card, Radio, Divider, Typography } from 'antd'
import { ListableInput } from '../ListableInput'

const { Text } = Typography

function StakeholdersSection({ form, sectionNumber = 3 }) {
  const aplicaExternas = Form.useWatch(['stakeholders', 'aplica_externas'], form)

  return (
    <Card title={`${sectionNumber}. Partes Interesadas`} style={{ marginBottom: 24 }}>
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.1 Partes Interesadas Internas</Text>
      </Divider>

      <ListableInput
        name={['stakeholders', 'internas', 'areas']}
        label="Áreas Interesadas"
        placeholder="Nombre del área"
        addButtonText="Agregar Área"
        emptyText="No hay áreas agregadas"
      />

      <ListableInput
        name={['stakeholders', 'internas', 'personas']}
        label="Personas Clave Internas"
        placeholder="Nombre de la persona"
        addButtonText="Agregar Persona"
        emptyText="No hay personas agregadas"
      />

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.2 Partes Interesadas Externas</Text>
      </Divider>

      <Form.Item
        name={['stakeholders', 'aplica_externas']}
        label="¿Aplican partes interesadas externas?"
      >
        <Radio.Group>
          <Radio value={true}>Sí</Radio>
          <Radio value={false}>No aplica</Radio>
        </Radio.Group>
      </Form.Item>

      {aplicaExternas && (
        <>
          <ListableInput
            name={['stakeholders', 'externas', 'sectores']}
            label="Sectores Comerciales"
            placeholder="Nombre del sector"
            addButtonText="Agregar Sector"
            emptyText="No hay sectores agregados"
          />

          <ListableInput
            name={['stakeholders', 'externas', 'empresas']}
            label="Empresas Interesadas"
            placeholder="Nombre de la empresa"
            addButtonText="Agregar Empresa"
            emptyText="No hay empresas agregadas"
          />

          <ListableInput
            name={['stakeholders', 'externas', 'proveedores']}
            label="Proveedores"
            placeholder="Nombre del proveedor"
            addButtonText="Agregar Proveedor"
            emptyText="No hay proveedores agregados"
          />

          <ListableInput
            name={['stakeholders', 'externas', 'personas']}
            label="Personas Clave Externas"
            placeholder="Nombre de la persona"
            addButtonText="Agregar Persona"
            emptyText="No hay personas agregadas"
          />
        </>
      )}
    </Card>
  )
}

export default StakeholdersSection
