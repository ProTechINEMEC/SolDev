import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Typography, Tag, Spin, Descriptions } from 'antd'
import { CloseCircleOutlined } from '@ant-design/icons'
import { ticketsApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const statusConfig = {
  abierto: { color: 'warning', text: 'Abierto' },
  en_proceso: { color: 'processing', text: 'En Proceso' },
  resuelto: { color: 'success', text: 'Resuelto' },
  cerrado: { color: 'default', text: 'Cerrado' },
  escalado_nt: { color: 'purple', text: 'Escalado a NT' }
}

function TicketStatus() {
  const { codigo } = useParams()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTicket()
  }, [codigo])

  const loadTicket = async () => {
    try {
      const response = await ticketsApi.checkStatus(codigo)
      setTicket(response.data.ticket)
    } catch (error) {
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <Card style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
        <Title level={4}>Ticket no encontrado</Title>
        <Paragraph type="secondary">
          No se encontró ningún ticket con el código "{codigo}"
        </Paragraph>
      </Card>
    )
  }

  const status = statusConfig[ticket.estado]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4}>{ticket.titulo}</Title>
          <Text type="secondary">Código: {ticket.codigo}</Text>
          <div style={{ marginTop: 16 }}>
            <Tag color={status?.color} style={{ fontSize: 16, padding: '4px 16px' }}>
              {status?.text}
            </Tag>
          </div>
        </div>

        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Categoría">
            {ticket.categoria?.replace(/\b\w/g, l => l.toUpperCase())}
          </Descriptions.Item>
          <Descriptions.Item label="Prioridad">
            <Tag color={
              ticket.prioridad === 'critica' ? 'red' :
              ticket.prioridad === 'alta' ? 'orange' :
              ticket.prioridad === 'media' ? 'cyan' : 'green'
            }>
              {ticket.prioridad?.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Fecha de Creación">
            {dayjs(ticket.creado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="Última Actualización">
            {dayjs(ticket.actualizado_en).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default TicketStatus
