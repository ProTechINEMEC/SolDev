import { Form, Input, Card, Typography } from 'antd'

const { TextArea } = Input
const { Text } = Typography

function ReporteSection({ tipo = 'soporte', sectionNumber = 2 }) {
  const cardTitle = tipo === 'fallo'
    ? `${sectionNumber}. Reporte del Fallo`
    : `${sectionNumber}. Reporte de la Situación`

  const tituloLabel = tipo === 'fallo'
    ? `${sectionNumber}.1 Título del reporte`
    : `${sectionNumber}.1 Título del ticket`

  const tituloPlaceholder = tipo === 'fallo'
    ? 'Ej: Error en sistema de facturación al generar reportes'
    : 'Ej: Problema con impresora en oficina 3er piso'

  const descripcionLabel = tipo === 'fallo'
    ? `${sectionNumber}.2 Descripción del fallo`
    : `${sectionNumber}.2 Descripción de la situación`

  const placeholder = tipo === 'fallo'
    ? 'Describa detalladamente el fallo o error que está experimentando...\n\n- ¿Qué sistema o aplicación presenta el problema?\n- ¿Qué acción estaba realizando cuando ocurrió?\n- ¿El error se presenta siempre o es intermitente?\n- ¿Hay algún mensaje de error?'
    : 'Describa detalladamente la situación o problema que requiere soporte...\n\n- ¿Cuál es el problema?\n- ¿Desde cuándo ocurre?\n- ¿Qué ha intentado para solucionarlo?'

  return (
    <Card title={cardTitle} style={{ marginBottom: 24 }}>
      <Form.Item
        name={['reporte', 'titulo']}
        label={tituloLabel}
        rules={[
          { required: true, message: 'Ingrese un título para el reporte' },
          { min: 5, message: 'El título debe tener al menos 5 caracteres' },
          { max: 100, message: 'El título no puede exceder 100 caracteres' }
        ]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Un título breve y descriptivo que resuma el problema
          </Text>
        }
      >
        <Input
          placeholder={tituloPlaceholder}
          maxLength={100}
          showCount
        />
      </Form.Item>

      <Form.Item
        name={['reporte', 'descripcion']}
        label={descripcionLabel}
        rules={[
          { required: true, message: 'Ingrese la descripción' },
          { min: 20, message: 'La descripción debe tener al menos 20 caracteres' }
        ]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Proporcione la mayor cantidad de detalles posible para facilitar la atención
          </Text>
        }
      >
        <TextArea
          rows={6}
          placeholder={placeholder}
          showCount
          maxLength={2000}
        />
      </Form.Item>
    </Card>
  )
}

export default ReporteSection
