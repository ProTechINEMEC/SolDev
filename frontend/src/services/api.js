import axios from 'axios'

// API URL from environment variable or default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:11001'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage)
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Error de conexión'

    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      // Clear auth state
      localStorage.removeItem('auth-storage')
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject({ ...error, message })
  }
)

export default api

// API helper functions
export const solicitudesApi = {
  list: (params) => api.get('/solicitudes', { params }),
  get: (id) => api.get(`/solicitudes/${id}`),
  create: (data) => api.post('/solicitudes', data),
  updateEstado: (id, data) => api.put(`/solicitudes/${id}/estado`, data),
  addComment: (id, data) => api.post(`/solicitudes/${id}/comentarios`, data),
  getHistory: (id) => api.get(`/solicitudes/${id}/historial`),
  checkStatus: (codigo) => api.get(`/solicitudes/consulta/${codigo}`),
  transferirTI: (id, data) => api.post(`/solicitudes/${id}/transferir-ti`, data),
  agendar: (id, data) => api.post(`/solicitudes/${id}/agendar`, data),
  solicitarReevaluacion: (id, data) => api.post(`/solicitudes/${id}/solicitar-reevaluacion`, data),
  getReevaluaciones: (id) => api.get(`/solicitudes/${id}/reevaluaciones`)
}

export const proyectosApi = {
  list: (params) => api.get('/proyectos', { params }),
  get: (id) => api.get(`/proyectos/${id}`),
  update: (id, data) => api.put(`/proyectos/${id}`, data),
  updateEstado: (id, data) => api.put(`/proyectos/${id}/estado`, data),
  getTareas: (id) => api.get(`/proyectos/${id}/tareas`),
  createTarea: (id, data) => api.post(`/proyectos/${id}/tareas`, data),
  updateTarea: (id, tareaId, data) => api.put(`/proyectos/${id}/tareas/${tareaId}`, data),
  deleteTarea: (id, tareaId) => api.delete(`/proyectos/${id}/tareas/${tareaId}`),
  getMiembros: (id) => api.get(`/proyectos/${id}/miembros`),
  addMiembro: (id, data) => api.post(`/proyectos/${id}/miembros`, data),
  removeMiembro: (id, userId) => api.delete(`/proyectos/${id}/miembros/${userId}`)
}

export const ticketsApi = {
  list: (params) => api.get('/tickets', { params }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  updateEstado: (id, data) => api.put(`/tickets/${id}/estado`, data),
  escalar: (id, data) => api.put(`/tickets/${id}/escalar`, data),
  addComment: (id, data) => api.post(`/tickets/${id}/comentarios`, data),
  checkStatus: (codigo) => api.get(`/tickets/consulta/${codigo}`),
  transferirNT: (id, data) => api.post(`/tickets/${id}/transferir-nt`, data)
}

export const transferenciasApi = {
  get: (tipo, id) => api.get(`/transferencias/${tipo}/${id}`),
  getByCodigo: (codigo) => api.get(`/transferencias/codigo/${codigo}`),
  list: (params) => api.get('/transferencias', { params })
}

export const evaluacionesApi = {
  list: (params) => api.get('/evaluaciones', { params }),
  get: (id) => api.get(`/evaluaciones/${id}`),
  getBySolicitud: (solicitudId) => api.get(`/evaluaciones/solicitud/${solicitudId}`),
  create: (data) => api.post('/evaluaciones', data),
  update: (id, data) => api.put(`/evaluaciones/${id}`, data),
  enviar: (id) => api.post(`/evaluaciones/${id}/enviar`),
  setLider: (id, usuarioId) => api.put(`/evaluaciones/${id}/lider`, { usuario_id: usuarioId })
}

export const cronogramasApi = {
  getTemplates: () => api.get('/cronogramas/templates'),
  getTemplate: (id) => api.get(`/cronogramas/templates/${id}`),
  get: (id) => api.get(`/cronogramas/${id}`),
  create: (data) => api.post('/cronogramas', data),
  update: (id, data) => api.put(`/cronogramas/${id}`, data),
  delete: (id) => api.delete(`/cronogramas/${id}`)
}

export const estimacionesApi = {
  get: (id) => api.get(`/estimaciones/${id}`),
  getByEvaluacion: (evaluacionId) => api.get(`/estimaciones/evaluacion/${evaluacionId}`),
  create: (data) => api.post('/estimaciones', data),
  update: (id, data) => api.put(`/estimaciones/${id}`, data),
  delete: (id) => api.delete(`/estimaciones/${id}`)
}

export const usuariosApi = {
  list: (params) => api.get('/usuarios', { params }),
  get: (id) => api.get(`/usuarios/${id}`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  delete: (id) => api.delete(`/usuarios/${id}`),
  getByRole: (rol) => api.get(`/usuarios/rol/${rol}`)
}

export const conocimientoApi = {
  listArticulos: (params) => api.get('/conocimiento/articulos', { params }),
  getArticulo: (slug) => api.get(`/conocimiento/articulos/${slug}`),
  createArticulo: (data) => api.post('/conocimiento/articulos', data),
  updateArticulo: (id, data) => api.put(`/conocimiento/articulos/${id}`, data),
  deleteArticulo: (id) => api.delete(`/conocimiento/articulos/${id}`),
  listCategorias: () => api.get('/conocimiento/categorias'),
  createCategoria: (data) => api.post('/conocimiento/categorias', data),
  getEtiquetas: () => api.get('/conocimiento/etiquetas')
}

export const dashboardApi = {
  getNT: () => api.get('/dashboard/nt'),
  getTI: () => api.get('/dashboard/ti'),
  getGerencia: () => api.get('/dashboard/gerencia'),
  markNotificationRead: (id) => api.put(`/dashboard/notificaciones/${id}/leer`),
  markAllNotificationsRead: () => api.put('/dashboard/notificaciones/leer-todas')
}

export const reportesApi = {
  getSemanal: (fecha) => api.get('/reportes/semanal', { params: { fecha } }),
  getProyectos: (params) => api.get('/reportes/proyectos', { params }),
  getTickets: (params) => api.get('/reportes/tickets', { params }),
  getSolicitudes: (params) => api.get('/reportes/solicitudes', { params }),
  generar: () => api.post('/reportes/generar')
}

export const verificacionApi = {
  solicitar: (data) => api.post('/verificacion/solicitar', data),
  validar: (data) => api.post('/verificacion/validar', data),
  checkEstado: (email) => api.get(`/verificacion/estado/${email}`)
}

export const searchApi = {
  search: (query, limit = 10) => api.get('/search', { params: { q: query, limit } })
}

export const profileApi = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
  changePassword: (data) => api.put('/profile/password', data)
}

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyResetToken: (token) => api.get(`/auth/verify-reset-token/${token}`)
}

export const exportApi = {
  solicitudPdf: (id) => api.get(`/export/solicitud/${id}/pdf`, { responseType: 'blob' }),
  ticketPdf: (id) => api.get(`/export/ticket/${id}/pdf`, { responseType: 'blob' }),
  evaluacionPdf: (id) => api.get(`/export/evaluacion/${id}/pdf`, { responseType: 'blob' }),
  getWeeklyReportPdf: (fecha) => api.get('/export/reporte-semanal/pdf', {
    params: { fecha },
    responseType: 'blob'
  }),
  getAuditLogExcel: (params) => api.get('/export/audit-log', {
    params,
    responseType: 'blob'
  })
}

export const notificacionesApi = {
  list: (params) => api.get('/notificaciones', { params }),
  markRead: (id) => api.put(`/notificaciones/${id}/leer`),
  markAllRead: () => api.put('/notificaciones/leer-todas')
}

export const opcionesApi = {
  getByCategoria: (categoria) => api.get(`/opciones/${categoria}`),
  listCategorias: () => api.get('/opciones'),
  create: (data) => api.post('/opciones', data),
  update: (id, data) => api.put(`/opciones/${id}`, data),
  delete: (id) => api.delete(`/opciones/${id}`),
  restore: (id) => api.post(`/opciones/${id}/restore`),
  reorder: (categoria, ordenes) => api.post('/opciones/reorder', { categoria, ordenes })
}

export const calendarioApi = {
  getProyectos: (params) => api.get('/calendario/proyectos', { params }),
  getProyectosConTareas: (params) => api.get('/calendario/proyectos-con-tareas', { params }),
  getEquipoCarga: (params) => api.get('/calendario/equipo-carga', { params }),
  getConflictos: (params) => api.get('/calendario/conflictos', { params }),
  getEstadisticas: (params) => api.get('/calendario/estadisticas', { params }),
  getFestivos: (params) => api.get('/calendario/festivos', { params }),
  calcularFechas: (data) => api.post('/calendario/calcular-fechas', data),
  preview: (data) => api.post('/calendario/preview', data)
}
