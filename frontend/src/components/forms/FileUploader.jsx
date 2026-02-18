import { useState } from 'react'
import { Upload, Button, message, Typography, Space } from 'antd'
import { UploadOutlined, DeleteOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined, FileExcelOutlined, FileWordOutlined } from '@ant-design/icons'

const { Text } = Typography

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return <FileImageOutlined style={{ color: '#52c41a' }} />
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileExcelOutlined style={{ color: '#52c41a' }} />
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={{ color: '#1890ff' }} />
    default:
      return <FileOutlined />
  }
}

function FileUploader({
  name,
  label,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif',
  maxCount = 10,
  maxSize = 10, // MB
  required = false,
  hint = 'Formatos permitidos: PDF, Word, Excel, imágenes. Máximo 10MB por archivo.',
  value = [],
  onChange
}) {
  const [fileList, setFileList] = useState(value || [])

  const beforeUpload = (file) => {
    // Check file size
    const isLt10M = file.size / 1024 / 1024 < maxSize
    if (!isLt10M) {
      message.error(`El archivo debe ser menor a ${maxSize}MB`)
      return Upload.LIST_IGNORE
    }

    // Add to local file list (we'll upload on form submit)
    const newFile = {
      uid: file.uid || `-${Date.now()}`,
      name: file.name,
      status: 'done',
      originFileObj: file,
      size: file.size
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

  const uploadProps = {
    fileList,
    beforeUpload,
    onRemove: handleRemove,
    multiple: maxCount > 1,
    accept,
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
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
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
