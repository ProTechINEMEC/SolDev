import { Form, Card, Typography } from 'antd'
import FileUploader from '../FileUploader'

const { Text } = Typography

function AdjuntosSection() {
  return (
    <Card title="9. Adjuntos" style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Cargue cualquier archivo adicional que considere relevante para la evaluación de su solicitud.
        Puede adjuntar documentos, diagramas, especificaciones, presentaciones, etc.
      </Text>

      <Form.Item
        name={['adjuntos', 'archivos']}
        label="9.1 Anexos y Soportes Opcionales"
      >
        <FileUploader
          name="adjuntos"
          hint="Formatos permitidos: PDF, Word, Excel, PowerPoint, imágenes, ZIP. Máximo 10 archivos, 10MB cada uno."
          maxCount={10}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.zip"
        />
      </Form.Item>
    </Card>
  )
}

export default AdjuntosSection
