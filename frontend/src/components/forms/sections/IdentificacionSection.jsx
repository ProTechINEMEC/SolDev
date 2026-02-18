import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, Radio, Card, Row, Col, Divider, Typography } from 'antd'
import { UserOutlined, MailOutlined, PhoneOutlined, IdcardOutlined, BankOutlined } from '@ant-design/icons'
import { opcionesApi } from '../../../services/api'
import { AREAS, OPERACIONES_CONTRATOS, flattenAreas } from '../../../config/formOptions'

const { Text } = Typography

function IdentificacionSection({ form }) {
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
    <Card title="1. Identificación del Solicitante" style={{ marginBottom: 24 }}>
      <Divider orientation="left" orientationMargin={0}>
        <Text strong>1.1 Datos Personales</Text>
      </Divider>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['identificacion', 'nombre_completo']}
            label="Nombre Completo"
            rules={[{ required: true, message: 'Ingrese su nombre completo' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nombre y apellidos" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['identificacion', 'cargo']}
            label="Cargo"
            rules={[{ required: true, message: 'Ingrese su cargo' }]}
          >
            <Input placeholder="Ej: Ingeniero de Operaciones" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['identificacion', 'area']}
            label="Área / Subárea"
            rules={[{ required: true, message: 'Seleccione su área' }]}
          >
            <Select
              showSearch
              loading={loading}
              placeholder="Seleccione su área"
              options={areas}
              optionFilterProp="label"
              suffixIcon={<BankOutlined />}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['identificacion', 'operacion_contrato']}
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
            name={['identificacion', 'correo']}
            label="Correo Corporativo"
            rules={[
              { required: true, message: 'Ingrese su correo corporativo' },
              { type: 'email', message: 'Ingrese un correo válido' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="correo@inemec.com" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name={['identificacion', 'telefono']}
            label="Teléfono"
          >
            <Input prefix={<PhoneOutlined />} placeholder="Número de contacto" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name={['identificacion', 'cedula']}
            label="Cédula"
            rules={[{ required: true, message: 'Ingrese su número de cédula' }]}
          >
            <Input prefix={<IdcardOutlined />} placeholder="Número de identificación" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" orientationMargin={0}>
        <Text strong>1.2 Rol dentro del Proyecto</Text>
      </Divider>

      <Form.Item
        name={['identificacion', 'es_doliente']}
        label="¿Es usted el doliente/sponsor del proyecto?"
        rules={[{ required: true, message: 'Seleccione una opción' }]}
        extra="El doliente/sponsor es la persona responsable de impulsar y dar seguimiento al proyecto"
      >
        <Radio.Group>
          <Radio value={true}>Sí, soy el doliente/sponsor</Radio>
          <Radio value={false}>No, otra persona es el doliente</Radio>
        </Radio.Group>
      </Form.Item>
    </Card>
  )
}

export default IdentificacionSection
