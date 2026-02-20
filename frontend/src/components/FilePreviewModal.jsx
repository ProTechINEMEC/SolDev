import { useState, useEffect } from 'react'
import { Modal, Button, Space, Typography, Spin, Alert, Tooltip, Image } from 'antd'
import {
  DownloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileZipOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  CustomerServiceOutlined,
  CodeOutlined,
  ExpandOutlined,
  CompressOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography

// File types that can be previewed in browser
const PREVIEWABLE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
  pdf: ['application/pdf'],
  text: ['text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
}

// Get file type category
const getFileCategory = (mimeType, fileName) => {
  if (!mimeType && fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const extToMime = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
      pdf: 'application/pdf',
      txt: 'text/plain', csv: 'text/csv', html: 'text/html', css: 'text/css',
      js: 'text/javascript', json: 'application/json', xml: 'application/xml',
      mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
      mp3: 'audio/mpeg', wav: 'audio/wav'
    }
    mimeType = extToMime[ext] || 'application/octet-stream'
  }

  for (const [category, types] of Object.entries(PREVIEWABLE_TYPES)) {
    if (types.includes(mimeType)) {
      return category
    }
  }
  return null
}

// Check if file can be previewed
const canPreview = (mimeType, fileName) => {
  return getFileCategory(mimeType, fileName) !== null
}

// Get icon for file type
const getFileIcon = (mimeType, fileName) => {
  const category = getFileCategory(mimeType, fileName)

  if (category === 'image') return <FileImageOutlined style={{ fontSize: 48, color: '#1890ff' }} />
  if (category === 'pdf') return <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
  if (category === 'video') return <VideoCameraOutlined style={{ fontSize: 48, color: '#722ed1' }} />
  if (category === 'audio') return <CustomerServiceOutlined style={{ fontSize: 48, color: '#13c2c2' }} />
  if (category === 'text') return <FileTextOutlined style={{ fontSize: 48, color: '#52c41a' }} />

  // Check extension for non-previewable files
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (['doc', 'docx'].includes(ext)) return <FileWordOutlined style={{ fontSize: 48, color: '#2b579a' }} />
  if (['xls', 'xlsx'].includes(ext)) return <FileExcelOutlined style={{ fontSize: 48, color: '#217346' }} />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileZipOutlined style={{ fontSize: 48, color: '#faad14' }} />
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs'].includes(ext)) {
    return <CodeOutlined style={{ fontSize: 48, color: '#eb2f96' }} />
  }

  return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />
}

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes) return 'Desconocido'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function FilePreviewModal({
  open,
  onClose,
  file,
  downloadUrl,
  onDownload
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [textContent, setTextContent] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  const fileName = file?.name || file?.nombre || 'archivo'
  const mimeType = file?.type || file?.tipo_mime || ''
  const fileSize = file?.size || file?.tamano
  const category = getFileCategory(mimeType, fileName)
  const previewable = canPreview(mimeType, fileName)

  // Build the download/preview URL
  const fileUrl = downloadUrl || file?.url || (file?.id ? `/api/archivos/${file.id}/download` : null)

  useEffect(() => {
    if (!open || !previewable) return

    setLoading(true)
    setError(null)
    setTextContent(null)

    // For text files, fetch content
    if (category === 'text' && fileUrl) {
      fetch(fileUrl)
        .then(res => {
          if (!res.ok) throw new Error('Error al cargar el archivo')
          return res.text()
        })
        .then(text => {
          setTextContent(text)
          setLoading(false)
        })
        .catch(err => {
          setError(err.message)
          setLoading(false)
        })
    } else {
      // For images, videos, audio, and PDFs - just wait for load event
      setLoading(false)
    }
  }, [open, fileUrl, category, previewable])

  const handleDownload = () => {
    if (onDownload) {
      onDownload(file)
    } else if (fileUrl) {
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = fileName
      link.click()
    }
  }

  const renderPreview = () => {
    if (!previewable) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          background: '#fafafa',
          borderRadius: 8
        }}>
          {getFileIcon(mimeType, fileName)}
          <Text style={{ marginTop: 16, fontSize: 16 }}>{fileName}</Text>
          <Text type="secondary" style={{ marginTop: 8 }}>
            Este tipo de archivo no se puede previsualizar
          </Text>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            style={{ marginTop: 24 }}
            onClick={handleDownload}
          >
            Descargar Archivo
          </Button>
        </div>
      )
    }

    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Spin size="large" tip="Cargando archivo..." />
        </div>
      )
    }

    if (error) {
      return (
        <Alert
          type="error"
          message="Error al cargar el archivo"
          description={error}
          action={
            <Button size="small" onClick={handleDownload}>
              Descargar en su lugar
            </Button>
          }
        />
      )
    }

    switch (category) {
      case 'image':
        return (
          <div style={{ textAlign: 'center', maxHeight: fullscreen ? '90vh' : 500, overflow: 'auto' }}>
            <Image
              src={fileUrl}
              alt={fileName}
              style={{ maxWidth: '100%', maxHeight: fullscreen ? '85vh' : 450 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAPlNp/VgAAAA7SURBVHgB7cEBDQAAAMKg909tDjegAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHgzXgYAAT7NQEIAAAAASUVORK5CYII="
            />
          </div>
        )

      case 'pdf':
        return (
          <iframe
            src={`${fileUrl}#toolbar=1`}
            style={{
              width: '100%',
              height: fullscreen ? '85vh' : 500,
              border: 'none',
              borderRadius: 8
            }}
            title={fileName}
          />
        )

      case 'video':
        return (
          <video
            controls
            style={{ maxWidth: '100%', maxHeight: fullscreen ? '85vh' : 450 }}
            src={fileUrl}
          >
            Tu navegador no soporta la reproduccion de video.
          </video>
        )

      case 'audio':
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 32
          }}>
            {getFileIcon(mimeType, fileName)}
            <Text style={{ marginTop: 16, marginBottom: 24 }}>{fileName}</Text>
            <audio controls src={fileUrl} style={{ width: '100%', maxWidth: 400 }}>
              Tu navegador no soporta la reproduccion de audio.
            </audio>
          </div>
        )

      case 'text':
        return (
          <pre style={{
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            maxHeight: fullscreen ? '85vh' : 450,
            overflow: 'auto',
            fontSize: 13,
            fontFamily: 'Monaco, Consolas, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {textContent}
          </pre>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          {getFileIcon(mimeType, fileName)}
          <div>
            <Title level={5} style={{ margin: 0 }}>{fileName}</Title>
            {fileSize && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatFileSize(fileSize)}
              </Text>
            )}
          </div>
        </Space>
      }
      width={fullscreen ? '95vw' : 800}
      style={fullscreen ? { top: 20 } : undefined}
      footer={
        <Space>
          <Button
            icon={fullscreen ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? 'Reducir' : 'Expandir'}
          </Button>
          <Tooltip title={previewable ? 'Vista previa disponible' : 'Vista previa no disponible'}>
            <Button
              icon={previewable ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              disabled
            >
              {previewable ? 'Previsualizable' : 'Sin vista previa'}
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            Descargar
          </Button>
        </Space>
      }
    >
      {renderPreview()}
    </Modal>
  )
}

export default FilePreviewModal
