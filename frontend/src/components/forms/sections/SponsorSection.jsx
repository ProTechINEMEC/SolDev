import { useEffect, useState } from 'react'
import { Form, Input, Select, Card, Row, Col, Divider, Typography } from 'antd'
import { UserOutlined, MailOutlined } from '@ant-design/icons'
import { opcionesApi } from '../../../services/api'
import { AREAS, flattenAreas } from '../../../config/formOptions'

const { Text } = Typography

function SponsorSection() {
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const areasRes = await opcionesApi.getByCategoria('area').catch(() => ({ data: { opciones: [] } }))

      if (areasRes.data.opciones?.length > 0) {
        const transformedAreas = areasRes.data.opciones.map(opt => ({
          value: opt.valor,
          label: opt.etiqueta,
          children: opt.children?.map(child => ({
            value: child.valor,
            label: child.etiqueta
          }))
        }))
        setAreas(flattenAreas(transformedAreas))
      } else {
        setAreas(flattenAreas(AREAS))
      }
    } catch (error) {
      console.error('Error loading options:', error)
      setAreas(flattenAreas(AREAS))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="2. Doliente/Sponsor del Proyecto" style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Ingrese los datos del doliente/sponsor del proyecto (la persona responsable de impulsar y dar seguimiento)
      </Text>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>2.1 Datos del Sponsor</Text>
      </Divider>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'nombre_completo']}
            label="Nombre Completo"
            rules={[{ required: true, message: 'Ingrese el nombre del sponsor' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nombre y apellidos del sponsor" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'cargo']}
            label="Cargo"
            rules={[{ required: true, message: 'Ingrese el cargo del sponsor' }]}
          >
            <Input placeholder="Cargo del sponsor" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'area']}
            label="Área"
            rules={[{ required: true, message: 'Seleccione el área del sponsor' }]}
          >
            <Select
              showSearch
              loading={loading}
              placeholder="Seleccione área"
              options={areas}
              optionFilterProp="label"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'correo']}
            label="Correo Corporativo"
            rules={[
              { required: true, message: 'Ingrese el correo del sponsor' },
              { type: 'email', message: 'Ingrese un correo válido' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="correo@inemec.com" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

export default SponsorSection
