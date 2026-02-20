import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from './stores/authStore'

// Layouts
import MainLayout from './layouts/MainLayout'
import PublicLayout from './layouts/PublicLayout'

// Public Pages
import Landing from './pages/public/Landing'
import KnowledgePortal from './pages/public/KnowledgePortal'
import ArticleView from './pages/public/ArticleView'
import NewRequest from './pages/public/NewRequest'
import RequestStatus from './pages/public/RequestStatus'
import TicketStatus from './pages/public/TicketStatus'
import ProyectoStatus from './pages/public/ProyectoStatus'
import ResponsePage from './pages/public/ResponsePage'
import Login from './pages/auth/Login'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

// Shared Pages
import Profile from './pages/shared/Profile'

// NT Pages
import NTDashboard from './pages/nt/Dashboard'
import NTSolicitudes from './pages/nt/Solicitudes'
import NTSolicitudDetail from './pages/nt/SolicitudDetail'
import NTEvaluacionForm from './pages/nt/EvaluacionForm'
import NTProyectos from './pages/nt/Proyectos'
import NTProyectoDetail from './pages/nt/ProyectoDetail'
import NTCalendario from './pages/nt/Calendario'
import NTArticulos from './pages/nt/Articulos'
import NTUsuarios from './pages/nt/Usuarios'
import { OpcionesConfig } from './pages/nt/configuracion'

// TI Pages
import TIDashboard from './pages/ti/Dashboard'
import TITickets from './pages/ti/Tickets'
import TITicketDetail from './pages/ti/TicketDetail'
import TICalendario from './pages/ti/Calendario'

// Gerencia Pages
import GerenciaDashboard from './pages/gerencia/Dashboard'
import GerenciaAprobaciones from './pages/gerencia/Aprobaciones'
import GerenciaAprobacionDetail from './pages/gerencia/AprobacionDetail'
import GerenciaReportes from './pages/gerencia/Reportes'
import GerenciaCalendario from './pages/gerencia/CalendarioGeneral'

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <Spin size="large" tip="Cargando..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.rol)) {
    // Redirect to appropriate dashboard based on role
    const dashboardRoutes = {
      nuevas_tecnologias: '/nt',
      ti: '/ti',
      gerencia: '/gerencia'
    }
    return <Navigate to={dashboardRoutes[user?.rol] || '/'} replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/conocimiento" element={<KnowledgePortal />} />
        <Route path="/conocimiento/:slug" element={<ArticleView />} />
        <Route path="/nueva-solicitud" element={<NewRequest />} />
        <Route path="/consulta/:codigo" element={<RequestStatus />} />
        <Route path="/tickets/consulta/:codigo" element={<TicketStatus />} />
        <Route path="/proyecto/consulta/:codigo" element={<ProyectoStatus />} />
        <Route path="/proyecto/consulta" element={<ProyectoStatus />} />
        <Route path="/responder/:token" element={<ResponsePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Route>

      {/* NT Routes */}
      <Route
        path="/nt"
        element={
          <ProtectedRoute allowedRoles={['nuevas_tecnologias']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<NTDashboard />} />
        <Route path="solicitudes" element={<NTSolicitudes />} />
        <Route path="solicitudes/:codigo" element={<NTSolicitudDetail />} />
        <Route path="solicitudes/:codigo/evaluacion" element={<NTEvaluacionForm />} />
        <Route path="proyectos" element={<NTProyectos />} />
        <Route path="proyectos/:codigo" element={<NTProyectoDetail />} />
        <Route path="calendario" element={<NTCalendario />} />
        <Route path="articulos" element={<NTArticulos />} />
        <Route path="usuarios" element={<NTUsuarios />} />
        <Route path="configuracion" element={<OpcionesConfig />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* TI Routes */}
      <Route
        path="/ti"
        element={
          <ProtectedRoute allowedRoles={['ti']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TIDashboard />} />
        <Route path="tickets" element={<TITickets />} />
        <Route path="tickets/:codigo" element={<TITicketDetail />} />
        <Route path="calendario" element={<TICalendario />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* Gerencia Routes */}
      <Route
        path="/gerencia"
        element={
          <ProtectedRoute allowedRoles={['gerencia']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<GerenciaDashboard />} />
        <Route path="aprobaciones" element={<GerenciaAprobaciones />} />
        <Route path="aprobaciones/:codigo" element={<GerenciaAprobacionDetail />} />
        <Route path="calendario" element={<GerenciaCalendario />} />
        <Route path="reportes" element={<GerenciaReportes />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
