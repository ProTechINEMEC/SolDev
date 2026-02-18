import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, Table, Tag, Typography, Progress } from 'antd'
import { proyectosApi } from '../../services/api'
import dayjs from 'dayjs'

const { Title } = Typography

function NTProyectos() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProyectos()
  }, [])

  const loadProyectos = async () => {
    try {
      const response = await proyectosApi.list({})
      setProyectos(response.data.proyectos)
    } catch (error) {
      console.error('Error loading proyectos:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      render: (code, record) => <Link to={`/nt/proyectos/${record.id}`}><strong>{code}</strong></Link>
    },
    { title: 'Título', dataIndex: 'titulo', ellipsis: true },
    {
      title: 'Estado',
      dataIndex: 'estado',
      render: (s) => <Tag color={s === 'en_desarrollo' ? 'processing' : s === 'completado' ? 'success' : 'default'}>{s}</Tag>
    },
    { title: 'Responsable', dataIndex: 'responsable_nombre' },
    {
      title: 'Progreso',
      render: (_, record) => {
        const percent = record.total_tareas > 0 ? Math.round((record.tareas_completadas / record.total_tareas) * 100) : 0
        return <Progress percent={percent} size="small" />
      }
    },
    { title: 'Fecha', dataIndex: 'creado_en', render: (d) => dayjs(d).format('DD/MM/YYYY') }
  ]

  return (
    <div>
      <Title level={3}>Proyectos</Title>
      <Card>
        <Table dataSource={proyectos} columns={columns} rowKey="id" loading={loading} />
      </Card>
    </div>
  )
}

export default NTProyectos
