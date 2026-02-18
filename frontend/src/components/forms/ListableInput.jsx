import { Form, Input, Button, Space, Typography } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

function ListableInput({
  name,
  label,
  placeholder = 'Ingrese un valor',
  required = false,
  min = 0,
  max = 20,
  addButtonText = 'Agregar',
  emptyText = 'No hay elementos agregados'
}) {
  return (
    <Form.Item label={label} required={required}>
      <Form.List
        name={name}
        rules={required ? [
          {
            validator: async (_, values) => {
              if (!values || values.length < 1) {
                return Promise.reject(new Error('Debe agregar al menos un elemento'))
              }
            }
          }
        ] : []}
      >
        {(fields, { add, remove }, { errors }) => (
          <>
            {fields.length === 0 && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                {emptyText}
              </Text>
            )}
            {fields.map(({ key, name: fieldName, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item
                  {...restField}
                  name={fieldName}
                  rules={[{ required: true, message: 'Este campo es requerido' }]}
                  style={{ marginBottom: 0, flex: 1, minWidth: 300 }}
                >
                  <Input placeholder={placeholder} />
                </Form.Item>
                {fields.length > min && (
                  <MinusCircleOutlined
                    onClick={() => remove(fieldName)}
                    style={{ color: '#ff4d4f', fontSize: 18 }}
                  />
                )}
              </Space>
            ))}
            {fields.length < max && (
              <Button
                type="dashed"
                onClick={() => add()}
                icon={<PlusOutlined />}
                style={{ width: '100%', maxWidth: 400 }}
              >
                {addButtonText}
              </Button>
            )}
            <Form.ErrorList errors={errors} />
          </>
        )}
      </Form.List>
    </Form.Item>
  )
}

// Variant for complex listable items (e.g., nombre + cargo)
function ListableInputComplex({
  name,
  label,
  fields: fieldDefinitions,
  required = false,
  min = 0,
  max = 20,
  addButtonText = 'Agregar'
}) {
  return (
    <Form.Item label={label} required={required}>
      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name: fieldName, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8, flexWrap: 'wrap' }} align="start">
                {fieldDefinitions.map((fieldDef) => (
                  <Form.Item
                    {...restField}
                    key={fieldDef.name}
                    name={[fieldName, fieldDef.name]}
                    rules={fieldDef.required ? [{ required: true, message: `${fieldDef.label} es requerido` }] : []}
                    style={{ marginBottom: 0, minWidth: fieldDef.width || 180 }}
                  >
                    <Input placeholder={fieldDef.placeholder || fieldDef.label} />
                  </Form.Item>
                ))}
                {fields.length > min && (
                  <MinusCircleOutlined
                    onClick={() => remove(fieldName)}
                    style={{ color: '#ff4d4f', fontSize: 18, marginTop: 8 }}
                  />
                )}
              </Space>
            ))}
            {fields.length < max && (
              <Button
                type="dashed"
                onClick={() => add()}
                icon={<PlusOutlined />}
                style={{ width: '100%', maxWidth: 400 }}
              >
                {addButtonText}
              </Button>
            )}
          </>
        )}
      </Form.List>
    </Form.Item>
  )
}

export { ListableInput, ListableInputComplex }
export default ListableInput
