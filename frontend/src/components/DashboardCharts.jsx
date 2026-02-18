/**
 * Dashboard Charts Components
 * Recharts-based chart components for dashboards and reports
 */

import { Card, Typography, Empty } from 'antd'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  LineChart, Line
} from 'recharts'

const { Title, Text } = Typography

// Color palette
const COLORS = ['#D52B1E', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96']

// Spanish labels
const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Interno',
  proyecto_nuevo_externo: 'Proyecto Externo',
  actualizacion: 'Actualizacion',
  reporte_fallo: 'Reporte Fallo',
  cierre_servicio: 'Cierre Servicio',
  nuevo_desarrollo: 'Nuevo Desarrollo',
  mejora: 'Mejora',
  correccion: 'Correccion'
}

const estadoLabels = {
  pendiente_evaluacion_nt: 'Pend. Evaluacion',
  pendiente_aprobacion_gerencia: 'Pend. Aprobacion',
  aprobado: 'Aprobado',
  en_desarrollo: 'En Desarrollo',
  completado: 'Completado',
  rechazado_gerencia: 'Rechazado',
  descartado_nt: 'Descartado',
  planificacion: 'Planificacion',
  pausado: 'Pausado',
  cancelado: 'Cancelado'
}

const categoriaLabels = {
  hardware: 'Hardware',
  software: 'Software',
  red: 'Red',
  acceso: 'Acceso',
  otro: 'Otro'
}

/**
 * Bar chart for solicitudes by type
 */
export function SolicitudesByTypeChart({ data, title = 'Solicitudes por Tipo' }) {
  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <Empty description="Sin datos" />
      </Card>
    )
  }

  const chartData = data.map(item => ({
    name: tipoLabels[item.tipo] || item.tipo,
    cantidad: parseInt(item.cantidad) || 0
  }))

  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis />
          <Tooltip />
          <Bar dataKey="cantidad" fill="#D52B1E" name="Cantidad" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * Pie chart for status distribution
 */
export function StatusPieChart({ data, title = 'Distribucion por Estado' }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Card title={title}>
        <Empty description="Sin datos" />
      </Card>
    )
  }

  const chartData = Object.entries(data)
    .filter(([key, value]) =>
      typeof value === 'number' &&
      value > 0 &&
      !['total', 'tiempo_promedio_horas'].includes(key)
    )
    .map(([key, value]) => ({
      name: estadoLabels[key] || key.replace(/_/g, ' '),
      value: parseInt(value) || 0
    }))

  if (chartData.length === 0) {
    return (
      <Card title={title}>
        <Empty description="Sin datos" />
      </Card>
    )
  }

  const renderCustomLabel = ({ name, percent }) => {
    if (percent < 0.05) return null
    return `${(percent * 100).toFixed(0)}%`
  }

  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [value, 'Cantidad']} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * Area chart for monthly trend
 */
export function MonthlyTrendChart({ data, title = 'Tendencia Mensual' }) {
  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <Empty description="Sin datos de tendencia" />
      </Card>
    )
  }

  const chartData = data.map(item => ({
    mes: new Date(item.mes || item.fecha).toLocaleDateString('es-EC', { month: 'short', year: '2-digit' }),
    total: parseInt(item.total) || 0,
    aprobadas: parseInt(item.aprobadas) || 0,
    completadas: parseInt(item.completadas) || 0
  }))

  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D52B1E" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#D52B1E" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorAprobadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#52c41a" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#D52B1E"
            fillOpacity={1}
            fill="url(#colorTotal)"
            name="Total"
          />
          <Area
            type="monotone"
            dataKey="aprobadas"
            stroke="#52c41a"
            fillOpacity={1}
            fill="url(#colorAprobadas)"
            name="Aprobadas"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * Horizontal bar chart for tickets by category
 */
export function TicketsByCategoryChart({ data, title = 'Tickets por Categoria' }) {
  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <Empty description="Sin datos" />
      </Card>
    )
  }

  const categoryColors = {
    hardware: '#722ed1',
    software: '#13c2c2',
    red: '#eb2f96',
    acceso: '#fa8c16',
    otro: '#595959'
  }

  const chartData = data.map(item => ({
    name: categoriaLabels[item.categoria] || item.categoria?.toUpperCase(),
    cantidad: parseInt(item.cantidad) || 0,
    fill: categoryColors[item.categoria] || '#D52B1E'
  }))

  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="cantidad" name="Cantidad">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * Line chart for project progress over time
 */
export function ProjectProgressChart({ data, title = 'Progreso de Proyectos' }) {
  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <Empty description="Sin datos de progreso" />
      </Card>
    )
  }

  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(value) => [`${value}%`, 'Progreso']} />
          <Legend />
          <Line
            type="monotone"
            dataKey="progreso"
            stroke="#D52B1E"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Progreso"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * Mini stat card with trend indicator
 */
export function StatCard({ title, value, trend, trendValue, color = '#D52B1E', icon }) {
  const isPositive = trend === 'up'

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <Title level={3} style={{ margin: '8px 0 0', color }}>{value}</Title>
        </div>
        {icon && (
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color
          }}>
            {icon}
          </div>
        )}
      </div>
      {trendValue !== undefined && (
        <div style={{ marginTop: 8 }}>
          <Text
            style={{
              fontSize: 12,
              color: isPositive ? '#52c41a' : '#f5222d'
            }}
          >
            {isPositive ? '↑' : '↓'} {trendValue}% vs periodo anterior
          </Text>
        </div>
      )}
    </Card>
  )
}

export default {
  SolicitudesByTypeChart,
  StatusPieChart,
  MonthlyTrendChart,
  TicketsByCategoryChart,
  ProjectProgressChart,
  StatCard
}
