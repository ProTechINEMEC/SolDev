import { Form, Card, Typography } from 'antd'
import FileUploader from '../FileUploader'

const { Text } = Typography

function AdjuntosSection({ sectionNumber = 9 }) {
  return (
    <Card title={`${sectionNumber}. Adjuntos`} style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Cargue cualquier archivo adicional que considere relevante para la evaluación de su solicitud.
        Puede adjuntar documentos, diagramas, especificaciones, presentaciones, imágenes, videos, etc.
      </Text>

      <Form.Item
        name={['adjuntos', 'archivos']}
        label={`${sectionNumber}.1 Anexos y Soportes Opcionales`}
      >
        <FileUploader
          name="adjuntos"
          hint="Se aceptan todos los tipos de archivo. Máximo 10 archivos, 10MB cada uno."
          maxCount={10}
        />
      </Form.Item>
    </Card>
  )
}

export default AdjuntosSection
