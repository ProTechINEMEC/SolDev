import { useEffect, useState } from 'react'
import { Form, Input, Select, Card, Typography } from 'antd'
import { ProjectOutlined } from '@ant-design/icons'
import api from '../../../services/api'

const { Text } = Typography

function ProyectoSelectorSection({ form, sectionNumber = 2, tipo = 'actualizacion' }) {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)

  const proyectoSeleccionado = Form.useWatch(['proyecto_referencia', 'proyecto_id'], form)

  useEffect(() => {
    loadProyectos()
  }, [])

  const loadProyectos = async () => {
    try {
      // Use public endpoint (no authentication required)
      const response = await api.get('/proyectos/public')

      const proyectosOptions = response.data.proyectos?.map(p => ({
        value: p.codigo,
        label: `${p.codigo} - ${p.nombre}`,
        nombre: p.nombre,
        estado: p.estado
      })) || []

      // Add "Otro" option at the end
      proyectosOptions.push({
        value: 'otro',
        label: 'Otro (no listado)',
        nombre: 'Otro',
        estado: null
      })

      setProyectos(proyectosOptions)
    } catch (error) {
      console.error('Error loading projects:', error)
      // Still add the "Otro" option
      setProyectos([{
        value: 'otro',
        label: 'Otro (no listado)',
        nombre: 'Otro',
        estado: null
      }])
    } finally {
      setLoading(false)
    }
  }

  const getCardTitle = () => {
    switch (tipo) {
      case 'actualizacion':
        return `${sectionNumber}. Proyecto a Actualizar`
      case 'reporte_fallo':
        return `${sectionNumber}. Proyecto Relacionado`
      case 'cierre_servicio':
        return `${sectionNumber}. Servicio a Cerrar`
      default:
        return `${sectionNumber}. Proyecto Relacionado`
    }
  }

  const getSelectLabel = () => {
    switch (tipo) {
      case 'actualizacion':
        return `${sectionNumber}.1 Seleccione el proyecto a actualizar`
      case 'reporte_fallo':
        return `${sectionNumber}.1 Seleccione el proyecto relacionado con el fallo`
      case 'cierre_servicio':
        return `${sectionNumber}.1 Seleccione el servicio/proyecto a cerrar`
      default:
        return `${sectionNumber}.1 Seleccione el proyecto`
    }
  }

  const getSelectPlaceholder = () => {
    switch (tipo) {
      case 'actualizacion':
        return 'Busque y seleccione el proyecto que desea actualizar'
      case 'reporte_fallo':
        return 'Busque y seleccione el proyecto relacionado'
      case 'cierre_servicio':
        return 'Busque y seleccione el servicio a cerrar'
      default:
        return 'Busque y seleccione un proyecto'
    }
  }

  return (
    <Card title={getCardTitle()} style={{ marginBottom: 24 }}>
      <Form.Item
        name={['proyecto_referencia', 'proyecto_id']}
        label={getSelectLabel()}
        rules={[{ required: true, message: 'Seleccione un proyecto' }]}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Seleccione el proyecto de la lista o elija "Otro" si no está listado
          </Text>
        }
      >
        <Select
          showSearch
          loading={loading}
          placeholder={getSelectPlaceholder()}
          optionFilterProp="label"
          options={proyectos}
          suffixIcon={<ProjectOutlined />}
          optionLabelProp="label"
          optionRender={(option) => {
            const proyecto = proyectos.find(p => p.value === option.value)
            if (option.value === 'otro') {
              return (
                <div>
                  <div style={{ fontWeight: 500 }}>Otro (no listado)</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    El proyecto no aparece en la lista
                  </div>
                </div>
              )
            }
            return (
              <div>
                <div style={{ fontWeight: 500 }}>{proyecto?.label}</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Estado: {proyecto?.estado?.replace(/_/g, ' ')}
                </div>
              </div>
            )
          }}
        />
      </Form.Item>

      {proyectoSeleccionado === 'otro' && (
        <Form.Item
          name={['proyecto_referencia', 'proyecto_nombre_otro']}
          label={`${sectionNumber}.2 Nombre del proyecto`}
          rules={[
            { required: true, message: 'Ingrese el nombre del proyecto' },
            { min: 3, message: 'El nombre debe tener al menos 3 caracteres' }
          ]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ingrese el nombre del proyecto tal como lo conoce
            </Text>
          }
        >
          <Input
            prefix={<ProjectOutlined />}
            placeholder="Nombre del proyecto o sistema"
            maxLength={200}
            showCount
          />
        </Form.Item>
      )}
    </Card>
  )
}

export default ProyectoSelectorSection
