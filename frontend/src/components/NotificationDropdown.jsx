/**
 * NotificationDropdown Component
 * Bell icon with dropdown showing notifications
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown, Badge, Button, List, Typography, Empty, Space, Spin } from 'antd'
import { BellOutlined, CheckOutlined } from '@ant-design/icons'
import { useNotificationStore } from '../stores/notificationStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'

dayjs.extend(relativeTime)
dayjs.locale('es')

const { Text } = Typography

// Notification type icons and colors
const notificationConfig = {
  solicitud_pendiente: { color: '#faad14' },
  solicitud_aprobada: { color: '#52c41a' },
  ticket_escalado: { color: '#f5222d' },
  aprobacion_pendiente: { color: '#D52B1E' },
  default: { color: '#595959' }
}

function NotificationDropdown() {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead
  } = useNotificationStore()

  // Load notifications on mount (WebSocket connection is handled by MainLayout)
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleNotificationClick = (notification) => {
    if (!notification.leida) {
      markAsRead(notification.id)
    }

    // Navigate based on notification data - check entity type and use codigo for URL
    const { datos } = notification
    if (datos?.solicitud_id && datos?.codigo) {
      navigate(`/nt/solicitudes/${datos.codigo}`)
    } else if (datos?.ticket_id && datos?.codigo) {
      navigate(`/ti/tickets/${datos.codigo}`)
    } else if (datos?.proyecto_id && datos?.codigo) {
      navigate(`/nt/proyectos/${datos.codigo}`)
    }
  }

  const getNotificationStyle = (notification) => {
    const config = notificationConfig[notification.tipo] || notificationConfig.default
    return {
      borderLeft: `3px solid ${config.color}`,
      backgroundColor: notification.leida ? 'transparent' : '#f0f5ff'
    }
  }

  const dropdownContent = (
    <div style={{
      width: 380,
      maxHeight: 450,
      background: '#fff',
      borderRadius: 8,
      boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <Text strong>Notificaciones</Text>
          {isConnected && (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#52c41a',
              display: 'inline-block'
            }} title="Conectado en tiempo real" />
          )}
        </Space>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              markAllAsRead()
            }}
            icon={<CheckOutlined />}
          >
            Marcar todas
          </Button>
        )}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 380, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="Sin notificaciones"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 40 }}
          />
        ) : (
          <List
            dataSource={notifications.slice(0, 15)}
            renderItem={(item) => (
              <List.Item
                onClick={() => handleNotificationClick(item)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  ...getNotificationStyle(item)
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={(e) => e.currentTarget.style.background = item.leida ? 'transparent' : '#f0f5ff'}
              >
                <List.Item.Meta
                  title={
                    <Text strong={!item.leida} style={{ fontSize: 13 }}>
                      {item.titulo}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                        {item.mensaje}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(item.creado_en).fromNow()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center'
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leidas'}
          </Text>
        </div>
      )}
    </div>
  )

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Dropdown>
  )
}

export default NotificationDropdown
