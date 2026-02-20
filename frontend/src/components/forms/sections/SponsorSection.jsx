import { useEffect, useState } from 'react'
import { Form, Input, Select, Card, Row, Col, Divider, Typography } from 'antd'
import { UserOutlined, MailOutlined, PhoneOutlined, IdcardOutlined, BankOutlined } from '@ant-design/icons'
import { opcionesApi } from '../../../services/api'
import { AREAS, OPERACIONES_CONTRATOS, flattenAreas } from '../../../config/formOptions'

const { Text } = Typography

function SponsorSection({ sectionNumber = 2 }) {
  const [areas, setAreas] = useState([])
  const [operaciones, setOperaciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const [areasRes, operacionesRes] = await Promise.all([
        opcionesApi.getByCategoria('area').catch(() => ({ data: { opciones: [] } })),
        opcionesApi.getByCategoria('operacion_contrato').catch(() => ({ data: { opciones: [] } }))
      ])

      // Transform API response to Select options
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

      if (operacionesRes.data.opciones?.length > 0) {
        setOperaciones(operacionesRes.data.opciones.map(opt => ({
          value: opt.valor,
          label: opt.etiqueta
        })))
      } else {
        setOperaciones(OPERACIONES_CONTRATOS)
      }
    } catch (error) {
      console.error('Error loading options:', error)
      setAreas(flattenAreas(AREAS))
      setOperaciones(OPERACIONES_CONTRATOS)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title={`${sectionNumber}. Doliente/Sponsor del Proyecto`} style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Ingrese los datos del doliente/sponsor del proyecto (la persona responsable de impulsar y dar seguimiento)
      </Text>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>{sectionNumber}.1 Datos Personales del Sponsor</Text>
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
            label="Área / Subárea"
            rules={[{ required: true, message: 'Seleccione el área del sponsor' }]}
          >
            <Select
              showSearch
              loading={loading}
              placeholder="Seleccione área"
              options={areas}
              optionFilterProp="label"
              suffixIcon={<BankOutlined />}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'operacion_contrato']}
            label="Operación / Contrato"
            rules={[{ required: true, message: 'Seleccione la operación o contrato' }]}
          >
            <Select
              showSearch
              loading={loading}
              placeholder="Seleccione operación o contrato"
              options={operaciones}
              optionFilterProp="label"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
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
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'telefono']}
            label="Teléfono"
          >
            <Input prefix={<PhoneOutlined />} placeholder="Número de contacto" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['sponsor', 'cedula']}
            label="Cédula"
            rules={[{ required: true, message: 'Ingrese el número de cédula del sponsor' }]}
          >
            <Input prefix={<IdcardOutlined />} placeholder="Número de identificación" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

export default SponsorSection
