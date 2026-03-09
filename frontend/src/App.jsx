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
import NTImplementacion from './pages/nt/Implementacion'
import NTImplementacionDetail from './pages/nt/ImplementacionDetail'
import NTUsuarios from './pages/nt/Usuarios'
import { OpcionesConfig } from './pages/nt/configuracion'

// TI Pages
import TIDashboard from './pages/ti/Dashboard'
import TITickets from './pages/ti/Tickets'
import TITicketDetail from './pages/ti/TicketDetail'
import TICalendario from './pages/ti/Calendario'
import CoordinadorTIStats from './pages/ti/CoordinadorStats'

// Gerencia Pages
import GerenciaDashboard from './pages/gerencia/Dashboard'
import GerenciaAprobaciones from './pages/gerencia/Aprobaciones'
import GerenciaAprobacionDetail from './pages/gerencia/AprobacionDetail'
import GerenciaReportes from './pages/gerencia/Reportes'
import GerenciaCalendario from './pages/gerencia/CalendarioGeneral'
import GerenciaProyectos from './pages/gerencia/Proyectos'
import GerenciaProyectoDetail from './pages/gerencia/ProyectoDetail'
import GerenciaImplementacion from './pages/gerencia/Implementacion'
import GerenciaImplementacionDetail from './pages/gerencia/ImplementacionDetail'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'

// Coordinador NT Pages
import CoordinadorNTDashboard from './pages/coordinador-nt/Dashboard'
import CoordinadorNTRevisiones from './pages/coordinador-nt/Revisiones'
import CoordinadorNTRevisionDetail from './pages/coordinador-nt/RevisionDetail'
import CoordinadorNTStats from './pages/coordinador-nt/Stats'
import CoordinadorNTProyectos from './pages/coordinador-nt/Proyectos'
import CoordinadorNTProyectoDetail from './pages/coordinador-nt/ProyectoDetail'
import CoordNTImplementacion from './pages/coordinador-nt/Implementacion'
import CoordNTImplementacionDetail from './pages/coordinador-nt/ImplementacionDetail'

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
      admin: '/admin',
      nuevas_tecnologias: '/nt',
      ti: '/ti',
      coordinador_ti: '/ti',
      gerencia: '/gerencia',
      coordinador_nt: '/coordinador-nt'
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
        <Route path="/consulta" element={<RequestStatus />} />
        <Route path="/tickets/consulta/:codigo" element={<TicketStatus />} />
        <Route path="/responder/:token" element={<ResponsePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<NTUsuarios />} />
        <Route path="configuracion" element={<OpcionesConfig />} />
        <Route path="articulos" element={<NTArticulos />} />
        <Route path="perfil" element={<Profile />} />
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
        <Route path="implementacion" element={<NTImplementacion />} />
        <Route path="implementacion/:codigo" element={<NTImplementacionDetail />} />
        <Route path="calendario" element={<NTCalendario />} />
        <Route path="articulos" element={<NTArticulos />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* TI Routes (includes coordinador_ti) */}
      <Route
        path="/ti"
        element={
          <ProtectedRoute allowedRoles={['ti', 'coordinador_ti']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TIDashboard />} />
        <Route path="tickets" element={<TITickets />} />
        <Route path="tickets/:codigo" element={<TITicketDetail />} />
        <Route path="calendario" element={<TICalendario />} />
        <Route path="articulos" element={<NTArticulos />} />
        <Route path="estadisticas" element={<CoordinadorTIStats />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* Coordinador NT Routes */}
      <Route
        path="/coordinador-nt"
        element={
          <ProtectedRoute allowedRoles={['coordinador_nt']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CoordinadorNTDashboard />} />
        <Route path="revisiones" element={<CoordinadorNTRevisiones />} />
        <Route path="revision/:codigo" element={<CoordinadorNTRevisionDetail />} />
        <Route path="proyectos" element={<CoordinadorNTProyectos />} />
        <Route path="proyectos/:codigo" element={<CoordinadorNTProyectoDetail />} />
        <Route path="implementacion" element={<CoordNTImplementacion />} />
        <Route path="implementacion/:codigo" element={<CoordNTImplementacionDetail />} />
        <Route path="calendario" element={<GerenciaCalendario />} />
        <Route path="articulos" element={<NTArticulos />} />
        <Route path="estadisticas" element={<CoordinadorNTStats />} />
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
        <Route path="proyectos" element={<GerenciaProyectos />} />
        <Route path="proyectos/:codigo" element={<GerenciaProyectoDetail />} />
        <Route path="implementacion" element={<GerenciaImplementacion />} />
        <Route path="implementacion/:codigo" element={<GerenciaImplementacionDetail />} />
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
