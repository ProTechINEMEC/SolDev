import { useState } from 'react'
import { Upload, Button, message, Typography, Space } from 'antd'
import {
  UploadOutlined,
  DeleteOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileZipOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  CodeOutlined,
  FileTextOutlined
} from '@ant-design/icons'

const { Text } = Typography

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase()

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <FileImageOutlined style={{ color: '#52c41a' }} />
  }

  // PDF
  if (ext === 'pdf') {
    return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
  }

  // Excel
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileExcelOutlined style={{ color: '#52c41a' }} />
  }

  // Word
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return <FileWordOutlined style={{ color: '#1890ff' }} />
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileZipOutlined style={{ color: '#faad14' }} />
  }

  // Video
  if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'webm'].includes(ext)) {
    return <VideoCameraOutlined style={{ color: '#722ed1' }} />
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
    return <SoundOutlined style={{ color: '#eb2f96' }} />
  }

  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'json', 'xml', 'sql'].includes(ext)) {
    return <CodeOutlined style={{ color: '#13c2c2' }} />
  }

  // Text files
  if (['txt', 'log', 'md'].includes(ext)) {
    return <FileTextOutlined style={{ color: '#8c8c8c' }} />
  }

  // Default
  return <FileOutlined />
}

function FileUploader({
  name,
  label,
  accept, // Now optional - if not provided, accepts all files
  maxCount = 10,
  maxSize = 10, // MB
  required = false,
  hint = 'Se aceptan todos los tipos de archivo. Máximo 10MB por archivo.',
  value = [],
  onChange
}) {
  const [fileList, setFileList] = useState(value || [])

  const beforeUpload = (file) => {
    // Check file size
    const isLtMaxSize = file.size / 1024 / 1024 < maxSize
    if (!isLtMaxSize) {
      message.error(`El archivo debe ser menor a ${maxSize}MB`)
      return Upload.LIST_IGNORE
    }

    // Add to local file list (we'll upload on form submit)
    const newFile = {
      uid: file.uid || `-${Date.now()}`,
      name: file.name,
      status: 'done',
      originFileObj: file,
      size: file.size,
      type: file.type
    }

    const newFileList = [...fileList, newFile]
    setFileList(newFileList)
    onChange?.(newFileList)

    // Prevent auto upload - we'll handle it on form submit
    return false
  }

  const handleRemove = (file) => {
    const newFileList = fileList.filter(f => f.uid !== file.uid)
    setFileList(newFileList)
    onChange?.(newFileList)
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const uploadProps = {
    fileList,
    beforeUpload,
    onRemove: handleRemove,
    multiple: maxCount > 1,
    accept, // Will be undefined if not provided, accepting all files
    showUploadList: false
  }

  return (
    <div>
      {label && (
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          {label} {required && <span style={{ color: '#ff4d4f' }}>*</span>}
        </Text>
      )}

      <Upload {...uploadProps}>
        <Button icon={<UploadOutlined />} disabled={fileList.length >= maxCount}>
          Seleccionar Archivos
        </Button>
      </Upload>

      {hint && (
        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
          {hint}
        </Text>
      )}

      {fileList.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {fileList.map((file) => (
            <div
              key={file.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#fafafa',
                borderRadius: 4,
                marginBottom: 4
              }}
            >
              <Space>
                {getFileIcon(file.name)}
                <Text ellipsis style={{ maxWidth: 300 }}>{file.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({formatFileSize(file.size)})
                </Text>
              </Space>
              <DeleteOutlined
                onClick={() => handleRemove(file)}
                style={{ color: '#ff4d4f', cursor: 'pointer' }}
              />
            </div>
          ))}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {fileList.length} de {maxCount} archivos
          </Text>
        </div>
      )}
    </div>
  )
}

export default FileUploader
