import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Typography, Input, Button, Upload, message, Spin, Result, Alert, Space, Tag } from 'antd'
import { SendOutlined, UploadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../services/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

function ResponsePage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [contenido, setContenido] = useState('')
  const [fileList, setFileList] = useState([])

  useEffect(() => {
    loadData()
  }, [token])

  const loadData = async () => {
    try {
      const response = await api.get(`/respuestas/${token}`)
      setData(response.data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Este enlace no es válido o ya ha sido utilizado.')
      } else if (err.response?.status === 410) {
        setError('Este enlace ha expirado o ya ha sido utilizado.')
      } else {
        setError('Error al cargar la información. Por favor intente más tarde.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!contenido.trim()) {
      message.error('Por favor escriba su respuesta')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('contenido', contenido.trim())

      fileList.forEach(file => {
        if (file.originFileObj) {
          formData.append('archivos', file.originFileObj)
        }
      })

      await api.post(`/respuestas/${token}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setSubmitted(true)
      message.success('Respuesta enviada exitosamente')
    } catch (err) {
      if (err.response?.status === 410) {
        setError('Este enlace ha expirado o ya ha sido utilizado.')
      } else {
        message.error(err.response?.data?.error || 'Error al enviar respuesta')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px' }}>
        <Card>
          <Result
            status="warning"
            icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            title="Enlace no válido"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => window.location.href = '/'}>
                Ir al inicio
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px' }}>
        <Card>
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Respuesta enviada"
            subTitle="Su respuesta ha sido registrada exitosamente. El equipo técnico la revisará pronto."
            extra={
              <Button type="primary" onClick={() => window.location.href = `/consulta/${data.entidad_codigo}`}>
                Ver estado de mi {data.entidad_tipo === 'ticket' ? 'ticket' : 'solicitud'}
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 16px' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>Responder Comunicación</Title>
          <Space>
            <Tag color="blue">{data.entidad_codigo}</Tag>
            <Text type="secondary">{data.entidad_titulo}</Text>
          </Space>
        </div>

        <Alert
          message="Comunicación del equipo técnico"
          description={
            <div>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                {data.pregunta}
              </Paragraph>
              <Text type="secondary">
                De: {data.pregunta_autor} - {dayjs(data.pregunta_fecha).format('DD/MM/YYYY HH:mm')}
              </Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Su respuesta:</Text>
          <TextArea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder="Escriba su respuesta aquí..."
            rows={6}
            style={{ marginTop: 8 }}
            maxLength={2000}
            showCount
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong>Archivos adjuntos (opcional):</Text>
          <Upload
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={() => false}
            multiple
            maxCount={5}
            style={{ marginTop: 8 }}
          >
            <Button icon={<UploadOutlined />} style={{ marginTop: 8 }}>
              Seleccionar archivos
            </Button>
          </Upload>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            Máximo 5 archivos. Formatos permitidos: PDF, Word, Excel, imágenes.
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Este enlace expira el {dayjs(data.expira_en).format('DD/MM/YYYY HH:mm')}
          </Text>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmit}
            loading={submitting}
            size="large"
          >
            Enviar Respuesta
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default ResponsePage
