import { Card, Typography, Empty } from 'antd'
const { Title } = Typography
function NTTicketsEscalados() {
  return (
    <div>
      <Title level={3}>Tickets Escalados</Title>
      <Card><Empty description="No hay tickets escalados" /></Card>
    </div>
  )
}
export default NTTicketsEscalados
