const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const emailService = require('../services/email');
const logger = require('../utils/logger');
const publicLabels = require('../utils/publicLabels');
const { addWorkdays, getNextWorkday } = require('../utils/workdays');
const { uploadMultiple, uploadsDir } = require('../config/multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ==============================================
// SHARED VALIDATION SCHEMAS
// ==============================================

// Section 1: Identificación del Solicitante (ALL form types)
const identificacionSchema = Joi.object({
  nombre_completo: Joi.string().required(),
  cargo: Joi.string().required(),
  area: Joi.string().required(),
  operacion_contrato: Joi.string().required(),
  correo: Joi.string().email().required(),
  telefono: Joi.string().allow('', null).optional(),
  cedula: Joi.string().required(),
  es_doliente: Joi.boolean().optional().default(true) // Optional for reporte_fallo (no sponsor question)
});

// Section 2: Sponsor (conditional - only if es_doliente = false)
// Contains same fields as identificacion section
const sponsorSchema = Joi.object({
  nombre_completo: Joi.string().required(),
  cargo: Joi.string().required(),
  area: Joi.string().required(),
  operacion_contrato: Joi.string().required(),
  correo: Joi.string().email().required(),
  telefono: Joi.string().allow('', null).optional(),
  cedula: Joi.string().required()
});

// Section 3: Stakeholders
const stakeholdersSchema = Joi.object({
  internas: Joi.object({
    areas: Joi.array().items(Joi.string().allow('', null)).optional(),
    personas: Joi.array().items(Joi.string().allow('', null)).optional()
  }).optional(),
  aplica_externas: Joi.boolean().optional(),
  externas: Joi.object({
    sectores: Joi.array().items(Joi.string().allow('', null)).optional(),
    empresas: Joi.array().items(Joi.string().allow('', null)).optional(),
    proveedores: Joi.array().items(Joi.string().allow('', null)).optional(),
    personas: Joi.array().items(Joi.string().allow('', null)).optional()
  }).optional()
});

// File object schema (from FileUploader component)
const fileObjectSchema = Joi.object({
  uid: Joi.string().optional(),
  name: Joi.string().optional(),
  status: Joi.string().optional(),
  size: Joi.number().optional(),
  type: Joi.string().optional(),
  originFileObj: Joi.any().optional(),
  lastModified: Joi.number().optional(),
  lastModifiedDate: Joi.any().optional(),
  percent: Joi.number().optional(),
  thumbUrl: Joi.string().allow('', null).optional(),
  response: Joi.any().optional(),
  error: Joi.any().optional(),
  xhr: Joi.any().optional()
}).unknown(true);

// Section 4: Problemática
const problematicaSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).required(), // Title of the problem
  situacion_actual: Joi.string().required(),
  origen: Joi.string().required(),
  desde_cuando: Joi.date().allow(null).optional(),
  fecha_inicio: Joi.date().allow(null).optional(), // Alternative field name from frontend
  evidencia: Joi.array().items(Joi.alternatives().try(Joi.string(), fileObjectSchema)).optional(),
  afectacion_operacion: Joi.string().required(),
  procesos_comprometidos: Joi.string().required(),
  impacto_nivel: Joi.string().valid('baja', 'media', 'alta', 'critica').required(),
  impacto_descripcion: Joi.string().required()
});

// Section 5: Urgencia
const urgenciaSchema = Joi.object({
  necesidad_principal: Joi.string().required(),
  nivel: Joi.string().valid('inmediata', 'corto_plazo', 'mediano_plazo', 'largo_plazo').required(),
  fecha_limite: Joi.date().allow(null).optional(),
  justificacion_nt: Joi.string().required()
});

// Section 6: Solución
const solucionSchema = Joi.object({
  // Backend field names
  tipo_solucion: Joi.string().allow('', null).optional(),
  tipo_solucion_otro: Joi.string().allow('', null).optional(),
  solucion_ideal: Joi.string().allow('', null).optional(),
  // Frontend alternative field names
  tipo: Joi.string().allow('', null).optional(),
  tipo_descripcion: Joi.string().allow('', null).optional(),
  descripcion_ideal: Joi.string().allow('', null).optional(),
  tiene_restricciones: Joi.boolean().optional(),
  referencias: Joi.array().items(Joi.alternatives().try(Joi.string(), fileObjectSchema)).optional(),
  // Shared field names
  casos_uso: Joi.string().allow('', null).optional(),
  usuarios_finales: Joi.array().items(Joi.string()).optional(),
  funcionalidades_minimas: Joi.array().items(Joi.string()).optional(),
  funcionalidades_deseables: Joi.array().items(Joi.string()).optional(),
  restricciones_aplican: Joi.boolean().optional(),
  restricciones: Joi.array().items(Joi.string()).optional(),
  forma_entrega: Joi.string().allow('', null).optional(),
  material_referencia: Joi.array().items(Joi.alternatives().try(Joi.string(), fileObjectSchema)).optional()
});

// Cost item schema (for cost analysis)
const costoItemSchema = Joi.object({
  descripcion: Joi.string().allow('', null).optional(),
  cantidad: Joi.number().optional(),
  valor: Joi.number().optional()
});

// Monetary benefit item schema
const beneficioMonetarioItemSchema = Joi.object({
  descripcion: Joi.string().allow('', null).optional(),
  cantidad: Joi.number().optional(),
  valor: Joi.number().optional()
});

// Section 7: Beneficios
const beneficiosSchema = Joi.object({
  descripcion: Joi.string().allow('', null).optional(),
  mejora_concreta: Joi.string().allow('', null).optional(),
  procesos_optimizados: Joi.array().items(Joi.string()).optional(),
  reduccion_costos: Joi.boolean().optional(),
  reduccion_costos_descripcion: Joi.string().allow('', null).optional(),
  costos_descripcion: Joi.string().allow('', null).optional(),
  // Cost analysis (complex object from frontend)
  analisis_costos: Joi.object({
    costos_actuales: Joi.array().items(costoItemSchema).optional(),
    costos_esperados: Joi.array().items(costoItemSchema).optional()
  }).optional(),
  // Monetary benefit (can be boolean OR complex object from frontend)
  beneficio_monetario: Joi.alternatives().try(
    Joi.boolean(),
    Joi.object({
      espera_beneficio: Joi.boolean().optional(),
      items: Joi.array().items(beneficioMonetarioItemSchema).optional(),
      justificacion: Joi.string().allow('', null).optional()
    })
  ).optional(),
  beneficio_monetario_descripcion: Joi.string().allow('', null).optional()
});

// Section 8: Desempeño
const desempenoSchema = Joi.object({
  indicadores: Joi.array().items(
    Joi.object({
      nombre: Joi.string().required(),
      valor_actual: Joi.string().allow('', null).optional(),
      valor_objetivo: Joi.string().allow('', null).optional(),
      unidad: Joi.string().allow('', null).optional()
    })
  ).optional(),
  // Backend field names
  metodo_medicion: Joi.string().allow('', null).optional(),
  herramientas_medicion: Joi.string().allow('', null).optional(),
  responsable_captura: Joi.string().allow('', null).optional(),
  // Frontend field names (from DesempenoSection.jsx)
  como_medir: Joi.string().allow('', null).optional(),
  herramientas: Joi.string().allow('', null).optional(),
  responsable_datos: Joi.string().allow('', null).optional(),
  // Shared fields
  compromiso_sponsor: Joi.boolean().optional(),
  comentarios_adicionales: Joi.string().allow('', null).optional()
});

// Section 9: Adjuntos (file references or file objects from FileUploader)
const adjuntosSchema = Joi.object({
  archivos: Joi.array().items(Joi.alternatives().try(Joi.string(), fileObjectSchema)).optional()
});

// Section 10: Declaración
const declaracionSchema = Joi.object({
  confirmo_informacion: Joi.boolean().valid(true).required(),
  acepto_seguimiento: Joi.boolean().optional()
});

// ==============================================
// TYPE-SPECIFIC SCHEMAS
// ==============================================

// REPORTE FALLO (4 sections - identificacion, proyecto_referencia, reporte, criticidad)
const reporteFalloSchema = Joi.object({
  tipo: Joi.string().valid('reporte_fallo').required(),
  titulo: Joi.string().min(5).max(200).required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),
  solicitante_session_token: Joi.string().optional(),
  identificacion: identificacionSchema.required(),
  proyecto_referencia: Joi.object({
    proyecto_id: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, '').optional(),
    proyecto_nombre: Joi.string().allow('', null).optional(),
    proyecto_nombre_otro: Joi.string().allow('', null).optional()
  }).optional().allow(null),
  reporte: Joi.object({
    titulo: Joi.string().min(5).max(200).required(),
    descripcion: Joi.string().required()
  }).required(),
  criticidad: Joi.object({
    urgencia: Joi.string().valid('baja', 'media', 'alta', 'critica').required(),
    justificacion: Joi.string().required()
  }).required()
});

// CIERRE SERVICIO (6 sections - identificacion, sponsor, proyecto_referencia, razonamiento, responsables, confirmacion)
const cierreServicioSchema = Joi.object({
  tipo: Joi.string().valid('cierre_servicio').required(),
  titulo: Joi.string().min(5).max(200).required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),
  solicitante_session_token: Joi.string().optional(),
  identificacion: identificacionSchema.required(),
  sponsor: Joi.object({
    nombre_completo: Joi.string().required(),
    cargo: Joi.string().required(),
    area: Joi.string().required(),
    operacion_contrato: Joi.string().required(),
    correo: Joi.string().email().required(),
    telefono: Joi.string().allow('', null).optional(),
    cedula: Joi.string().required()
  }).optional().allow(null),
  proyecto_referencia: Joi.object({
    proyecto_id: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, '').optional(),
    proyecto_nombre: Joi.string().allow('', null).optional(),
    proyecto_nombre_otro: Joi.string().allow('', null).optional()
  }).optional().allow(null),
  razonamiento: Joi.object({
    titulo: Joi.string().min(5).max(200).required(),
    descripcion: Joi.string().required()
  }).required(),
  responsables: Joi.object({
    responsable_nombre: Joi.string().required(),
    responsable_cargo: Joi.string().required(),
    veedores: Joi.array().items(
      Joi.object({
        nombre: Joi.string().required(),
        cargo: Joi.string().required()
      })
    ).optional()
  }).required(),
  confirmacion: Joi.boolean().valid(true).required()
});

// PROYECTO NUEVO INTERNO / ACTUALIZACION (10-11 sections)
const proyectoFullSchema = Joi.object({
  tipo: Joi.string().valid('proyecto_nuevo_interno', 'actualizacion').required(),
  titulo: Joi.string().min(5).max(200).required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),
  solicitante_session_token: Joi.string().optional(),
  identificacion: identificacionSchema.required(),
  // Sponsor is optional in schema - we validate conditionally in route handler
  sponsor: sponsorSchema.optional().allow(null),
  // Project reference for actualizacion
  proyecto_referencia: Joi.object({
    proyecto_id: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, '').optional(),
    proyecto_nombre: Joi.string().allow('', null).optional(),
    proyecto_nombre_otro: Joi.string().allow('', null).optional()
  }).optional().allow(null),
  stakeholders: stakeholdersSchema.optional().allow(null),
  problematica: problematicaSchema.required(),
  urgencia: urgenciaSchema.required(),
  solucion: solucionSchema.optional().allow(null),
  beneficios: beneficiosSchema.optional().allow(null),
  desempeno: desempenoSchema.optional().allow(null),
  adjuntos: adjuntosSchema.optional().allow(null),
  declaracion: declaracionSchema.required(),
  integracion: Joi.object({
    fases: Joi.array().items(Joi.string().max(100)).optional().default([]),
    tareas: Joi.array().items(Joi.object({
      nombre: Joi.string().min(1).max(200).required(),
      duracion_dias: Joi.number().integer().min(1).required(),
      fase: Joi.string().max(100).allow('', null).optional()
    })).optional().default([])
  }).optional().allow(null)
});

// Function to get schema based on tipo
const getSchemaForTipo = (tipo) => {
  switch (tipo) {
    case 'reporte_fallo':
      return reporteFalloSchema;
    case 'cierre_servicio':
      return cierreServicioSchema;
    case 'proyecto_nuevo_interno':
    case 'actualizacion':
      return proyectoFullSchema;
    default:
      return proyectoFullSchema; // Fallback
  }
};

const updateEstadoSchema = Joi.object({
  estado: Joi.string().valid(
    'pendiente_evaluacion_nt',
    'en_estudio',
    'descartado_nt',
    'transferido_ti',
    'pendiente_aprobacion_gerencia',
    'pendiente_reevaluacion',
    'rechazado_gerencia',
    'agendado',
    'aprobado',
    'en_desarrollo',
    'stand_by',
    'completado',
    'cancelado'
  ).required(),
  comentario: Joi.string().max(1000).optional(),
  motivo_rechazo: Joi.string().max(500).optional(),
  resolucion: Joi.string().max(2000).optional()
});

// Helper function to check if solicitud tipo is simple (quick resolution workflow)
const isSimpleTipo = (tipo) => ['reporte_fallo', 'cierre_servicio', 'transferido_ti'].includes(tipo);

// Helper function to check if solicitud tipo is complex (escalation to gerencia)
const isComplexTipo = (tipo) => ['proyecto_nuevo_interno', 'actualizacion'].includes(tipo);

// POST /api/solicitudes - Create new request
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    // Determine schema based on tipo
    const tipo = req.body.tipo;
    if (!tipo) {
      throw new AppError('El campo "tipo" es requerido', 400);
    }

    const schema = getSchemaForTipo(tipo);
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map(d => d.message).join('; ');
      throw new AppError(messages, 400);
    }

    let solicitanteId = null;

    // If public submission, verify session token
    if (!req.user && value.solicitante_session_token) {
      const sessionResult = await pool.query(
        `SELECT s.id, s.solicitante_id
         FROM sesiones_solicitante s
         WHERE s.token = $1 AND s.expira_en > NOW() AND s.activa = true`,
        [value.solicitante_session_token]
      );

      if (sessionResult.rows.length === 0) {
        throw new AppError('Sesión de verificación inválida o expirada. Por favor verifique su email nuevamente.', 401);
      }

      solicitanteId = sessionResult.rows[0].solicitante_id;
    } else if (!req.user) {
      throw new AppError('Debe verificar su email antes de enviar una solicitud', 401);
    }

    // Generate request code
    const year = new Date().getFullYear();
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM solicitudes WHERE EXTRACT(YEAR FROM creado_en) = $1`,
      [year]
    );
    const count = parseInt(countResult.rows[0].count, 10) + 1;
    const codigo = `SOL-${year}-${count.toString().padStart(4, '0')}`;

    // Build data objects based on tipo
    let datosFormulario = {};

    if (tipo === 'reporte_fallo') {
      datosFormulario = {
        identificacion: value.identificacion,
        reporte: value.reporte,
        criticidad: value.criticidad
      };
    } else if (tipo === 'cierre_servicio') {
      datosFormulario = {
        identificacion: value.identificacion,
        razonamiento: value.razonamiento,
        responsables: value.responsables,
        confirmacion: value.confirmacion
      };
    } else {
      // proyecto_nuevo_interno or actualizacion
      datosFormulario = {
        identificacion: value.identificacion,
        sponsor: value.sponsor || null,
        stakeholders: value.stakeholders || {},
        problematica: value.problematica,
        urgencia: value.urgencia,
        solucion: value.solucion || {},
        beneficios: value.beneficios || {},
        desempeno: value.desempeno || {},
        adjuntos: value.adjuntos || {},
        declaracion: value.declaracion,
        integracion: value.integracion || { fases: [], tareas: [] }
      };
    }

    // Create solicitud with new JSONB structure
    const result = await pool.query(
      `INSERT INTO solicitudes (
        codigo, tipo, estado, prioridad, titulo,
        solicitante_id, usuario_creador_id,
        datos_solicitante, datos_patrocinador, datos_stakeholders,
        descripcion_problema, necesidad_urgencia, solucion_propuesta,
        beneficios, kpis, declaracion, integracion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        codigo,
        value.tipo,
        'pendiente_evaluacion_nt',
        value.prioridad,
        value.titulo,
        solicitanteId,
        req.user?.id || null,
        // Map new structure to existing columns for backwards compatibility
        JSON.stringify(datosFormulario.identificacion || value.identificacion || {}),
        JSON.stringify(datosFormulario.sponsor || {}),
        JSON.stringify(datosFormulario.stakeholders || {}),
        JSON.stringify(datosFormulario.problematica || datosFormulario.reporte || datosFormulario.razonamiento || {}),
        JSON.stringify(datosFormulario.urgencia || datosFormulario.criticidad || {}),
        JSON.stringify(datosFormulario.solucion || {}),
        JSON.stringify(datosFormulario.beneficios || {}),
        JSON.stringify(datosFormulario.desempeno?.indicadores || []),
        JSON.stringify(datosFormulario.declaracion || { confirmacion: datosFormulario.confirmacion }),
        JSON.stringify(datosFormulario.integracion || { fases: [], tareas: [] })
      ]
    );

    const solicitud = result.rows[0];

    // Log creation in history
    await pool.query(
      `INSERT INTO historial_cambios (
        entidad_tipo, entidad_id, accion, datos_nuevos, usuario_id, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['solicitud', solicitud.id, 'crear', JSON.stringify(solicitud), req.user?.id, req.ip]
    );

    // Create notification for NT team
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
       SELECT id, 'nueva_solicitud', 'Nueva solicitud recibida',
         $1, $2
       FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true`,
      [
        `Nueva solicitud ${codigo}: ${value.titulo}`,
        JSON.stringify({ solicitud_id: solicitud.id, codigo })
      ]
    );

    // Send immediate email to NT team for urgent types (reporte_fallo, cierre_servicio)
    if (['reporte_fallo', 'cierre_servicio'].includes(value.tipo)) {
      const ntUsersResult = await pool.query(
        "SELECT nombre, email FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true"
      );
      const solNombre = (value.identificacion || {}).nombre_completo || 'Solicitante';
      for (const ntUser of ntUsersResult.rows) {
        emailService.sendNewSolicitudToNT(
          ntUser.email,
          ntUser.nombre,
          codigo,
          value.titulo,
          value.tipo,
          solNombre
        ).catch(err => logger.error(`Error sending solicitud email to NT user ${ntUser.email}:`, err));
      }
    }

    // Send confirmation email to solicitante with full form data
    const identificacion = value.identificacion || datosFormulario.identificacion || {};
    const solicitanteEmail = identificacion.correo;
    const solicitanteNombre = identificacion.nombre_completo || 'Solicitante';
    if (solicitanteEmail) {
      emailService.sendSolicitudCreatedWithForm(
        solicitanteEmail,
        solicitanteNombre,
        codigo,
        value.tipo,
        {
          titulo: value.titulo,
          identificacion: identificacion,
          sponsor: value.sponsor || {},
          stakeholders: value.stakeholders || {},
          problematica: value.problematica || {},
          urgencia: value.urgencia || {},
          solucion: value.solucion || {},
          beneficios: value.beneficios || {},
          desempeno: value.desempeno || {},
          reporte: value.reporte || {},
          criticidad: value.criticidad || {},
          razonamiento: value.razonamiento || {},
          responsables: value.responsables || {},
          confirmacion: value.confirmacion || {}
        }
      ).catch(err => logger.error('Error sending solicitud creation email:', err));
    }

    logger.info(`New solicitud created: ${codigo}`);

    res.status(201).json({
      message: 'Solicitud creada exitosamente',
      solicitud: {
        id: solicitud.id,
        codigo: solicitud.codigo,
        tipo: solicitud.tipo,
        estado: solicitud.estado,
        titulo: solicitud.titulo,
        creado_en: solicitud.creado_en
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes - List requests with filters
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      tipo,
      estado,
      prioridad,
      search,
      fecha_desde,
      fecha_hasta,
      page = 1,
      limit = 20,
      sort = 'creado_en',
      order = 'DESC'
    } = req.query;

    let query = `
      SELECT s.*,
        sol.nombre as solicitante_nombre,
        sol.email as solicitante_email
      FROM solicitudes s
      LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filters
    if (tipo) {
      const tipos = tipo.split(',');
      query += ` AND s.tipo = ANY($${paramIndex++})`;
      params.push(tipos);
    }

    if (estado) {
      const estados = estado.split(',');
      query += ` AND s.estado::text = ANY($${paramIndex++})`;
      params.push(estados);
    }

    if (prioridad) {
      query += ` AND s.prioridad = $${paramIndex++}`;
      params.push(prioridad);
    }

    if (search) {
      query += ` AND (s.titulo ILIKE $${paramIndex} OR s.codigo ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Date range filters (using actualizado_en for closed items to show closure date)
    if (fecha_desde) {
      query += ` AND s.actualizado_en >= $${paramIndex++}::date`;
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ` AND s.actualizado_en <= ($${paramIndex++}::date + interval '1 day')`;
      params.push(fecha_hasta);
    }

    // Role-based filtering
    if (req.user.rol === 'gerencia') {
      // Gerencia sees requests pending their approval, approved, in development, completed, and closed states
      query += ` AND s.estado::text IN ('pendiente_aprobacion_gerencia', 'aprobado', 'agendado', 'en_desarrollo', 'completado', 'resuelto', 'no_realizado', 'transferido_ti', 'rechazado')`;
    }

    // Debug logging
    logger.info(`Solicitudes query for ${req.user.rol}: estado=${estado}, tipo=${tipo}, params=${JSON.stringify(params)}`);

    // Count total - extract FROM clause onwards for count query
    const fromIndex = query.indexOf('FROM');
    const countQuery = `SELECT COUNT(*) as total ${query.substring(fromIndex)}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Sorting and pagination
    const allowedSorts = ['creado_en', 'actualizado_en', 'prioridad', 'estado', 'titulo'];
    const sortField = allowedSorts.includes(sort) ? sort : 'creado_en';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY s.${sortField} ${sortOrder}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      solicitudes: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get solicitud ID from codigo (supports both SOL- and PRY- codes)
const getSolicitudIdByCodigo = async (codigo) => {
  const upperCodigo = codigo.toUpperCase();

  // If it's a project code (PRY-), look up the solicitud_id from proyectos table
  if (upperCodigo.startsWith('PRY-')) {
    const proyectoResult = await pool.query(
      'SELECT solicitud_id FROM proyectos WHERE codigo = $1',
      [upperCodigo]
    );
    if (proyectoResult.rows.length === 0) {
      throw new AppError('Proyecto no encontrado', 404);
    }
    return proyectoResult.rows[0].solicitud_id;
  }

  // Otherwise look up directly by solicitud codigo
  const result = await pool.query('SELECT id FROM solicitudes WHERE codigo = $1', [upperCodigo]);
  if (result.rows.length === 0) {
    throw new AppError('Solicitud no encontrada', 404);
  }
  return result.rows[0].id;
};

// GET /api/solicitudes/consulta/:codigo - Public status check
// NOTE: This route MUST be defined BEFORE /:codigo to avoid route matching issues
router.get('/consulta/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const result = await pool.query(
      `SELECT s.codigo, s.tipo, s.estado, s.prioridad, s.titulo, s.creado_en, s.actualizado_en,
              s.transferido_a_ticket_id, s.fecha_inicio_programada, s.fecha_fin_programada,
              t.codigo as ticket_codigo
       FROM solicitudes s
       LEFT JOIN tickets t ON s.transferido_a_ticket_id = t.id
       WHERE s.codigo = $1`,
      [codigo.toUpperCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = result.rows[0];

    // Add transfer info if applicable
    let transferInfo = null;
    if (solicitud.estado === 'transferido_ti' && solicitud.ticket_codigo) {
      transferInfo = {
        tipo: 'solicitud_a_ticket',
        nuevo_codigo: solicitud.ticket_codigo,
        mensaje: `Esta solicitud fue transferida a Soporte Técnico. Nuevo código: ${solicitud.ticket_codigo}`
      };
    }

    // Get public-friendly labels and progress
    const publicEstado = publicLabels.formatPublicEstado(
      solicitud.estado,
      solicitud.tipo,
      transferInfo
    );

    // Get solicitud ID for fetching comments
    const solicitudIdResult = await pool.query(
      'SELECT id FROM solicitudes WHERE codigo = $1',
      [codigo.toUpperCase()]
    );
    const solicitudId = solicitudIdResult.rows[0]?.id;

    // Get public comments (tipo = 'publico', 'comunicacion', or 'respuesta')
    let comentariosPublicos = [];
    if (solicitudId) {
      const comentariosResult = await pool.query(
        `SELECT c.id, c.contenido, c.creado_en, c.tipo, c.autor_externo,
                COALESCE(u.nombre, 'Sistema') as autor_nombre,
                (SELECT COUNT(*) FROM archivos a WHERE a.comentario_id = c.id) as attachment_count
         FROM comentarios c
         LEFT JOIN usuarios u ON c.usuario_id = u.id
         WHERE c.entidad_tipo = 'solicitud' AND c.entidad_id = $1
           AND c.tipo IN ('publico', 'comunicacion', 'respuesta')
         ORDER BY c.creado_en ASC`,
        [solicitudId]
      );
      comentariosPublicos = comentariosResult.rows.map(c => {
        let contenido = c.contenido;
        // For public view, just indicate attachments without numbers
        if (c.tipo === 'respuesta' && parseInt(c.attachment_count) > 0) {
          contenido += `\n\n📎 ${c.autor_externo} adjuntó archivo(s)`;
        }
        return {
          contenido,
          fecha: c.creado_en,
          autor: c.tipo === 'respuesta' ? c.autor_externo : c.autor_nombre,
          es_respuesta: c.tipo === 'respuesta'
        };
      });
    }

    // Check if this solicitud has an associated project
    let proyectoCodigo = null;
    if (solicitudId) {
      const proyectoResult = await pool.query(
        'SELECT codigo FROM proyectos WHERE solicitud_id = $1',
        [solicitudId]
      );
      if (proyectoResult.rows.length > 0) {
        proyectoCodigo = proyectoResult.rows[0].codigo;
      }
    }

    res.json({
      solicitud: {
        codigo: solicitud.codigo,
        tipo: publicLabels.getTipoSolicitudLabel(solicitud.tipo),
        tipo_interno: solicitud.tipo,
        estado: publicEstado.estado,
        estado_interno: solicitud.estado,
        prioridad: publicLabels.getPrioridadLabel(solicitud.prioridad),
        titulo: solicitud.titulo,
        creado_en: solicitud.creado_en,
        actualizado_en: solicitud.actualizado_en,
        fecha_inicio_programada: solicitud.fecha_inicio_programada,
        fecha_fin_programada: solicitud.fecha_fin_programada,
        progress: publicEstado.progress,
        milestones: publicEstado.milestones,
        es_terminal: publicEstado.es_terminal,
        es_transferido: publicEstado.es_transferido,
        proyecto_codigo: proyectoCodigo
      },
      transferencia: transferInfo,
      comentarios: comentariosPublicos
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/:codigo - Get single request
router.get('/:codigo', optionalAuth, async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const result = await pool.query(
      `SELECT s.*,
        sol.nombre as solicitante_nombre,
        sol.email as solicitante_email,
        u.nombre as evaluador_nombre
       FROM solicitudes s
       LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
       LEFT JOIN usuarios u ON s.evaluador_id = u.id
       WHERE s.codigo = $1`,
      [codigo]
    );

    if (result.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = result.rows[0];

    // Get comments with attachment info
    const comentariosResult = await pool.query(
      `SELECT c.*, u.nombre as autor_nombre, u.rol as autor_rol,
              (SELECT json_agg(json_build_object(
                'id', a.id, 'nombre_original', a.nombre_original,
                'mime_type', a.mime_type, 'tamano', a.tamano
              ) ORDER BY a.creado_en)
               FROM archivos a WHERE a.comentario_id = c.id) as adjuntos
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.entidad_tipo = 'solicitud' AND c.entidad_id = $1
       ORDER BY c.creado_en ASC`,
      [solicitud.id]
    );

    const comentarios = {
      rows: comentariosResult.rows.map(c => {
        c.adjuntos = c.adjuntos || [];
        return c;
      })
    };

    // Get files with origin, uploader info, and respuesta_numero
    const archivos = await pool.query(
      `SELECT a.*, u.nombre as subido_por_nombre
       FROM archivos a
       LEFT JOIN usuarios u ON a.subido_por = u.id
       WHERE a.entidad_tipo = 'solicitud' AND a.entidad_id = $1
       ORDER BY a.origen, a.respuesta_numero, a.creado_en DESC`,
      [solicitud.id]
    );

    // Group archivos by origen (form section)
    const origenLabels = {
      problematica_evidencia: 'Problemática - Evidencia',
      solucion_referencias: 'Solución - Referencias',
      solucion_material: 'Solución - Material de Referencia',
      adjuntos_generales: 'Adjuntos Generales',
      reporte_evidencia: 'Reporte - Evidencia',
      respuesta_comunicacion: 'Respuesta a Comunicación',
      creacion: 'Adjuntos del Solicitante',
      comentario: 'Adjuntos de Comentarios'
    };

    const archivosAgrupados = {};
    for (const archivo of archivos.rows) {
      const origen = archivo.origen || 'creacion';
      if (!archivosAgrupados[origen]) {
        archivosAgrupados[origen] = {
          origen,
          label: origenLabels[origen] || origen,
          archivos: []
        };
      }
      archivosAgrupados[origen].archivos.push(archivo);
    }

    res.json({
      solicitud,
      comentarios: comentarios.rows,
      archivos: archivos.rows,
      archivos_agrupados: Object.values(archivosAgrupados)
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/solicitudes/:codigo/estado - Change request state
router.put('/:codigo/estado', authenticate, authorize('nuevas_tecnologias', 'coordinador_nt', 'gerencia', 'ti'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);
    const { error, value } = updateEstadoSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Get current state
    const currentResult = await pool.query(
      'SELECT * FROM solicitudes WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = currentResult.rows[0];
    const estadoAnterior = solicitud.estado;

    // Validate state transition based on role and tipo
    // Simple requests (reporte_fallo, cierre_servicio, transferido_ti) go directly to completado
    const simpleWorkflowTransitions = {
      pendiente_evaluacion_nt: ['completado', 'descartado_nt', 'transferido_ti'],
      // Terminal states
      completado: [],
      descartado_nt: [],
      transferido_ti: []
    };

    // Complex requests (proyecto_nuevo_interno, actualizacion) have full workflow
    // Now goes: en_estudio → pendiente_revision_coordinador_nt → pendiente_aprobacion_gerencia
    const complexWorkflowTransitions = {
      pendiente_evaluacion_nt: ['en_estudio', 'descartado_nt'],
      en_estudio: ['pendiente_revision_coordinador_nt', 'descartado_nt'],  // Changed: goes to coordinator first
      pendiente_revision_coordinador_nt: [],  // NT can't change this - coordinator handles it
      pendiente_reevaluacion: ['en_estudio'],
      agendado: ['en_desarrollo'],
      aprobado: ['agendado', 'en_desarrollo'],
      en_desarrollo: ['stand_by', 'completado', 'cancelado'],
      stand_by: ['en_desarrollo', 'cancelado'],
      // Terminal states
      completado: [],
      rechazado_gerencia: [],
      rechazado_coordinador_nt: [],  // New terminal state
      cancelado: []
    };

    const validTransitions = {
      nuevas_tecnologias: isSimpleTipo(solicitud.tipo) ? simpleWorkflowTransitions : complexWorkflowTransitions,
      coordinador_nt: {
        // Coordinator reviews NT evaluation before gerencia
        pendiente_revision_coordinador_nt: ['pendiente_aprobacion_gerencia', 'rechazado_coordinador_nt', 'pendiente_reevaluacion']
      },
      gerencia: {
        pendiente_aprobacion_gerencia: ['aprobado', 'rechazado_gerencia', 'pendiente_reevaluacion']
      },
      ti: {
        // TI can work on solicitudes transferred to them - go directly to completado
        transferido_ti: ['completado', 'descartado_nt']
      }
    };

    const allowedTransitions = validTransitions[req.user.rol]?.[estadoAnterior] || [];

    if (!allowedTransitions.includes(value.estado)) {
      throw new AppError(
        `No puede cambiar el estado de '${estadoAnterior}' a '${value.estado}' con su rol`,
        403
      );
    }

    await withTransaction(async (client) => {
      // Update state - use separate parameter for the IN check to avoid type inference issues
      const shouldUpdateMotivo = ['descartado_nt', 'rechazado_gerencia'].includes(value.estado);
      await client.query(
        `UPDATE solicitudes
         SET estado = $1::estado_solicitud, actualizado_en = NOW(),
             evaluador_id = CASE WHEN evaluador_id IS NULL THEN $2 ELSE evaluador_id END,
             motivo_rechazo = CASE WHEN $4 THEN $3 ELSE motivo_rechazo END
         WHERE id = $5`,
        [value.estado, req.user.id, value.motivo_rechazo || null, shouldUpdateMotivo, id]
      );

      // Log state change
      await client.query(
        `INSERT INTO historial_cambios (
          entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'solicitud',
          id,
          'cambio_estado',
          JSON.stringify({ estado: estadoAnterior }),
          JSON.stringify({ estado: value.estado, comentario: value.comentario }),
          req.user.id
        ]
      );

      // Generate system comment message based on state change
      const systemMessages = {
        en_estudio: `Iniciando estudio de la solicitud`,
        pendiente_revision_coordinador_nt: `Solicitud enviada a Coordinador NT para revisión`,
        pendiente_aprobacion_gerencia: `Solicitud escalada a Gerencia para aprobación`,
        aprobado: `Solicitud aprobada por Gerencia`,
        rechazado_gerencia: `Solicitud rechazada por Gerencia`,
        rechazado_coordinador_nt: `Solicitud rechazada por Coordinador NT`,
        pendiente_reevaluacion: `Solicitud devuelta para reevaluación`,
        agendado: `Proyecto agendado para inicio`,
        en_desarrollo: `Proyecto en desarrollo`,
        stand_by: `Proyecto pausado temporalmente`,
        completado: `Solicitud completada`,
        descartado_nt: `Solicitud descartada`,
        cancelado: `Proyecto cancelado`,
        transferido_ti: `Solicitud transferida a TI`
      };

      // Always add system comment for state changes (internal/private for NT)
      const systemComment = value.comentario || systemMessages[value.estado] || `Estado cambiado a ${value.estado}`;
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('solicitud', $1, $2, $3, 'cambio_estado', true)`,
        [id, req.user.id, systemComment]
      );

      // Notify coordinator when solicitud is ready for review (from NT en_estudio)
      if (value.estado === 'pendiente_revision_coordinador_nt') {
        // Notify coordinador_nt
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           SELECT id, 'revision_coordinador_pendiente', 'Solicitud pendiente de revisión',
             $1, $2
           FROM usuarios WHERE rol = 'coordinador_nt' AND activo = true`,
          [
            `La solicitud ${solicitud.codigo} requiere su revisión antes de escalar a Gerencia`,
            JSON.stringify({ solicitud_id: id, codigo: solicitud.codigo })
          ]
        );
      }

      // Create approval record if going to gerencia (from coordinator approval)
      if (value.estado === 'pendiente_aprobacion_gerencia') {
        // If coordinator is approving, save their suggested date
        if (req.user.rol === 'coordinador_nt' && value.fecha_sugerida) {
          await client.query(
            `UPDATE solicitudes
             SET fecha_sugerida_coordinador = $1,
                 coordinador_nt_id = $2,
                 fecha_revision_coordinador = NOW(),
                 comentario_coordinador = $3
             WHERE id = $4`,
            [value.fecha_sugerida, req.user.id, value.comentario || null, id]
          );

          // Log coordinator decision
          await client.query(
            `INSERT INTO decisiones_coordinador (entidad_tipo, entidad_id, entidad_codigo, coordinador_id, tipo_coordinador, accion, fecha_sugerida, comentario)
             VALUES ('solicitud', $1, $2, $3, 'coordinador_nt', 'aprobar', $4, $5)`,
            [id, solicitud.codigo, req.user.id, value.fecha_sugerida, value.comentario || null]
          );
        }

        await client.query(
          `INSERT INTO aprobaciones (solicitud_id, estado)
           VALUES ($1, 'pendiente')
           ON CONFLICT DO NOTHING`,
          [id]
        );

        // Notify gerencia
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           SELECT id, 'aprobacion_pendiente', 'Solicitud pendiente de aprobación',
             $1, $2
           FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
          [
            `La solicitud ${solicitud.codigo} requiere su aprobación`,
            JSON.stringify({ solicitud_id: id, codigo: solicitud.codigo })
          ]
        );
      }

      // If rejected by coordinator NT
      if (value.estado === 'rechazado_coordinador_nt') {
        // Log coordinator decision
        await client.query(
          `INSERT INTO decisiones_coordinador (entidad_tipo, entidad_id, entidad_codigo, coordinador_id, tipo_coordinador, accion, comentario)
           VALUES ('solicitud', $1, $2, $3, 'coordinador_nt', 'rechazar', $4)`,
          [id, solicitud.codigo, req.user.id, value.motivo_rechazo || value.comentario || null]
        );

        // Update solicitud with coordinator info
        await client.query(
          `UPDATE solicitudes
           SET coordinador_nt_id = $1,
               fecha_revision_coordinador = NOW(),
               comentario_coordinador = $2,
               motivo_rechazo = $3
           WHERE id = $4`,
          [req.user.id, value.comentario || null, value.motivo_rechazo || value.comentario || 'Rechazado por Coordinador NT', id]
        );
      }

      // If approved, create project
      if (value.estado === 'aprobado') {
        const year = new Date().getFullYear();
        const countResult = await client.query(
          `SELECT COUNT(*) FROM proyectos WHERE EXTRACT(YEAR FROM creado_en) = $1`,
          [year]
        );
        const count = parseInt(countResult.rows[0].count, 10) + 1;
        const codigoProyecto = `PRY-${year}-${count.toString().padStart(4, '0')}`;

        await client.query(
          `INSERT INTO proyectos (
            codigo, solicitud_id, titulo, descripcion, estado,
            responsable_id, datos_proyecto
          ) VALUES ($1, $2, $3, $4, 'planificacion', $5, $6)`,
          [
            codigoProyecto,
            id,
            solicitud.titulo,
            solicitud.descripcion_problema?.problema_actual || '',
            req.user.id,
            JSON.stringify({
              solicitante: solicitud.datos_solicitante,
              stakeholders: solicitud.datos_stakeholders,
              beneficios: solicitud.beneficios,
              kpis: solicitud.kpis
            })
          ]
        );

        // Update approval record
        await client.query(
          `UPDATE aprobaciones
           SET estado = 'aprobado', aprobador_id = $1, fecha_decision = NOW()
           WHERE solicitud_id = $2 AND estado = 'pendiente'`,
          [req.user.id, id]
        );
      }

      // If rejected by gerencia
      if (value.estado === 'rechazado_gerencia') {
        await client.query(
          `UPDATE aprobaciones
           SET estado = 'rechazado', aprobador_id = $1, fecha_decision = NOW(),
               comentario = $2
           WHERE solicitud_id = $3 AND estado = 'pendiente'`,
          [req.user.id, value.motivo_rechazo || value.comentario, id]
        );
      }
    });

    logger.info(`Solicitud ${solicitud.codigo} state changed: ${estadoAnterior} -> ${value.estado} by ${req.user.email}`);

    // Send email and real-time notifications asynchronously (don't await to not block response)
    notificationService.onSolicitudStatusChange(
      id,
      estadoAnterior,
      value.estado,
      req.user.id,
      value.comentario
    ).catch(err => logger.error('Failed to send solicitud notifications:', err));

    res.json({
      message: 'Estado actualizado exitosamente',
      estadoAnterior,
      estadoNuevo: value.estado
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/solicitudes/:codigo/comentarios - Add comment
// tipos: 'interno' (staff only), 'publico' (visible in public status), 'comunicacion' (sends email to creator)
router.post('/:codigo/comentarios', authenticate, uploadMultiple, async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);
    let { contenido, tipo = 'interno', interno } = req.body;

    // Legacy support: convert interno boolean to tipo
    if (tipo === 'interno' && interno === false) {
      tipo = 'publico';
    }

    // Gerencia users always have interno comments
    if (req.user.rol === 'gerencia') {
      tipo = 'interno';
    }

    // Validate tipo
    const validTipos = ['interno', 'publico', 'comunicacion'];
    if (!validTipos.includes(tipo)) {
      tipo = 'interno';
    }

    if (!contenido || contenido.trim().length === 0) {
      throw new AppError('El comentario no puede estar vacío', 400);
    }

    // Get solicitud info for email (if comunicacion)
    const solicitudResult = await pool.query(
      'SELECT s.*, s.datos_solicitante FROM solicitudes s WHERE s.id = $1',
      [id]
    );
    const solicitud = solicitudResult.rows[0];

    // Insert comment
    const result = await pool.query(
      `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
       VALUES ('solicitud', $1, $2, $3, $4, $5)
       RETURNING *`,
      [id, req.user.id, contenido.trim(), tipo, tipo === 'interno']
    );

    const comentario = result.rows[0];

    // Save uploaded files linked to this comment
    const adjuntos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileResult = await pool.query(
          `INSERT INTO archivos (
            entidad_tipo, entidad_id, nombre_original, nombre_almacenado,
            mime_type, tamano, ruta, subido_por, origen, comentario_id
          ) VALUES ('solicitud', $1, $2, $3, $4, $5, $6, $7, 'comentario', $8)
          RETURNING *`,
          [id, file.originalname, file.filename, file.mimetype, file.size,
           `/uploads/${file.filename}`, req.user.id, comentario.id]
        );
        adjuntos.push(fileResult.rows[0]);
      }
    }

    // If comunicacion, create response token and send email
    if (tipo === 'comunicacion') {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const solicitanteEmail = solicitud.datos_solicitante?.correo || solicitud.datos_solicitante?.email;

      if (solicitanteEmail) {
        // Create pending response record
        await pool.query(
          `INSERT INTO respuestas_pendientes
           (token, comentario_id, entidad_tipo, entidad_id, email_destino, usuario_pregunta_id, expira_en)
           VALUES ($1, $2, 'solicitud', $3, $4, $5, $6)`,
          [token, comentario.id, id, solicitanteEmail, req.user.id, expiraEn]
        );

        // Send email (async, don't wait)
        const emailService = require('../services/email');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:11000';
        const responseUrl = `${frontendUrl}/responder/${token}`;

        emailService.sendEmail({
          to: solicitanteEmail,
          subject: `Comunicación sobre su solicitud ${solicitud.codigo}`,
          html: `
            <h2>Comunicación sobre su solicitud</h2>
            <p>Hemos recibido una comunicación del equipo de Nuevas Tecnologías sobre su solicitud <strong>${solicitud.codigo}</strong>:</p>
            <blockquote style="border-left: 3px solid #D52B1E; padding-left: 15px; margin: 20px 0; color: #333;">
              ${contenido.trim().replace(/\n/g, '<br>')}
            </blockquote>
            <p><strong>De:</strong> ${req.user.nombre}</p>
            <p>Si desea responder a esta comunicación, haga clic en el siguiente enlace:</p>
            <p><a href="${responseUrl}" style="background-color: #D52B1E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Responder</a></p>
            <p><small>Este enlace expira en 7 días y solo puede usarse una vez.</small></p>
            <hr>
            <p style="color: #666; font-size: 12px;">INEMEC S.A. - Sistema de Gestión de Solicitudes</p>
          `
        }).catch(err => {
          logger.error('Error sending comunicacion email:', err);
        });
      }
    }

    res.status(201).json({
      message: 'Comentario agregado',
      comentario: {
        ...comentario,
        autor_nombre: req.user.nombre,
        autor_rol: req.user.rol,
        adjuntos
      }
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        const filePath = path.join(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
});

// GET /api/solicitudes/:codigo/historial - Get request history
router.get('/:codigo/historial', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    const result = await pool.query(
      `SELECT h.*, u.nombre as usuario_nombre
       FROM historial_cambios h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.entidad_tipo = 'solicitud' AND h.entidad_id = $1
       ORDER BY h.creado_en DESC`,
      [id]
    );

    res.json({ historial: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/solicitudes/:codigo/agendar - Gerencia schedules an approved project
router.post('/:codigo/agendar', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);
    const { fecha_inicio, fecha_fin, comentario } = req.body;

    if (!fecha_inicio || !fecha_fin) {
      throw new AppError('Se requieren fecha de inicio y fecha de fin', 400);
    }

    const fechaInicio = new Date(fecha_inicio);
    const fechaFin = new Date(fecha_fin);

    if (fechaFin <= fechaInicio) {
      throw new AppError('La fecha de fin debe ser posterior a la fecha de inicio', 400);
    }

    // Get the solicitud
    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    // Check valid states for scheduling
    const schedulableStates = ['pendiente_aprobacion_gerencia', 'aprobado'];
    if (!schedulableStates.includes(solicitud.estado)) {
      throw new AppError(`No se puede agendar una solicitud en estado '${solicitud.estado}'`, 400);
    }

    await withTransaction(async (client) => {
      // Update solicitud with scheduling dates and change to agendado
      await client.query(
        `UPDATE solicitudes SET
          estado = 'agendado',
          fecha_inicio_programada = $1,
          fecha_fin_programada = $2,
          actualizado_en = NOW()
         WHERE id = $3`,
        [fechaInicio, fechaFin, id]
      );

      // Update approval record
      await client.query(
        `UPDATE aprobaciones
         SET estado = 'aprobado', aprobador_id = $1, fecha_decision = NOW(),
             comentario = $2
         WHERE solicitud_id = $3 AND estado = 'pendiente'`,
        [req.user.id, comentario || 'Proyecto agendado', id]
      );

      // Create project if not exists
      const proyectoExists = await client.query(
        'SELECT id FROM proyectos WHERE solicitud_id = $1',
        [id]
      );

      let proyectoId;
      if (proyectoExists.rows.length === 0) {
        const year = new Date().getFullYear();
        const countResult = await client.query(
          `SELECT COUNT(*) FROM proyectos WHERE EXTRACT(YEAR FROM creado_en) = $1`,
          [year]
        );
        const count = parseInt(countResult.rows[0].count, 10) + 1;
        const codigoProyecto = `PRY-${year}-${count.toString().padStart(4, '0')}`;

        // Get evaluacion for linking
        const evalResult = await client.query(
          `SELECT id, lider_id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado = 'enviado' LIMIT 1`,
          [id]
        );
        const evaluacion = evalResult.rows[0];

        // Get leader from evaluacion_asignaciones
        let liderId = evaluacion?.lider_id;
        if (!liderId && evaluacion) {
          const liderResult = await client.query(
            `SELECT usuario_id FROM evaluacion_asignaciones WHERE evaluacion_id = $1 AND es_lider = true LIMIT 1`,
            [evaluacion.id]
          );
          liderId = liderResult.rows[0]?.usuario_id;
        }

        // Get priority from solicitud
        const solPrioridad = solicitud.prioridad || 'media';

        const proyectoInsert = await client.query(
          `INSERT INTO proyectos (
            codigo, solicitud_id, titulo, descripcion, estado,
            responsable_id, fecha_inicio_estimada, fecha_fin_estimada, datos_proyecto,
            evaluacion_id, prioridad
          ) VALUES ($1, $2, $3, $4, 'planificacion', $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            codigoProyecto,
            id,
            solicitud.titulo,
            solicitud.descripcion_problema?.situacion_actual || '',
            liderId || req.user.id,
            fechaInicio,
            fechaFin,
            JSON.stringify({
              solicitante: solicitud.datos_solicitante,
              stakeholders: solicitud.datos_stakeholders,
              beneficios: solicitud.beneficios,
              kpis: solicitud.kpis
            }),
            evaluacion?.id || null,
            solPrioridad
          ]
        );
        proyectoId = proyectoInsert.rows[0].id;

        // --- Auto-copy: evaluacion_asignaciones → proyecto_miembros ---
        if (evaluacion) {
          await client.query(
            `INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol_proyecto, es_original, es_lider, horas_estimadas)
             SELECT $1, ea.usuario_id, ea.rol, true, ea.es_lider, ea.horas_estimadas
             FROM evaluacion_asignaciones ea
             WHERE ea.evaluacion_id = $2
             ON CONFLICT (proyecto_id, usuario_id) DO NOTHING`,
            [proyectoId, evaluacion.id]
          );

          // --- Auto-copy: cronograma_tareas → proyecto_tareas ---
          const cronogramaResult = await client.query(
            `SELECT id FROM cronogramas WHERE evaluacion_id = $1 OR solicitud_id = $2 LIMIT 1`,
            [evaluacion.id, id]
          );

          if (cronogramaResult.rows.length > 0) {
            const cronogramaId = cronogramaResult.rows[0].id;
            await client.query(
              `INSERT INTO proyecto_tareas (
                proyecto_id, titulo, descripcion, fecha_inicio, fecha_fin,
                progreso, completada, asignado_id, color, orden,
                fase, duracion_dias, es_emergente, es_bloqueado,
                cronograma_tarea_id, dependencias
              )
              SELECT
                $1, ct.titulo, ct.descripcion, ct.fecha_inicio, ct.fecha_fin,
                0, false, ct.asignado_id, COALESCE(ct.color, '#1890ff'), ct.orden,
                ct.fase, COALESCE(ct.duracion_dias, 1), false, true,
                ct.id, COALESCE(ct.dependencias, '[]'::jsonb)
              FROM cronograma_tareas ct
              WHERE ct.cronograma_id = $2
              ORDER BY ct.fase, ct.orden, ct.fecha_inicio`,
              [proyectoId, cronogramaId]
            );

            // Compute workday dates sequentially for all proyecto_tareas
            const insertedTareas = await client.query(
              `SELECT id, duracion_dias FROM proyecto_tareas
               WHERE proyecto_id = $1
               ORDER BY fase NULLS LAST, orden, id`,
              [proyectoId]
            );

            let nextStart = getNextWorkday(new Date());
            for (const tarea of insertedTareas.rows) {
              const fechaInicioTarea = new Date(nextStart);
              const duracion = tarea.duracion_dias || 1;
              const fechaFinTarea = addWorkdays(fechaInicioTarea, duracion - 1);

              await client.query(
                `UPDATE proyecto_tareas SET fecha_inicio = $1, fecha_fin = $2 WHERE id = $3`,
                [fechaInicioTarea.toISOString().split('T')[0], fechaFinTarea.toISOString().split('T')[0], tarea.id]
              );

              // Next task starts the workday after this task ends
              const dayAfter = new Date(fechaFinTarea);
              dayAfter.setDate(dayAfter.getDate() + 1);
              nextStart = getNextWorkday(dayAfter);
            }
          }
        }
      } else {
        proyectoId = proyectoExists.rows[0].id;
        // Update existing project with dates
        await client.query(
          `UPDATE proyectos SET
            fecha_inicio_estimada = $1,
            fecha_fin_estimada = $2,
            actualizado_en = NOW()
           WHERE solicitud_id = $3`,
          [fechaInicio, fechaFin, id]
        );
      }

      // Add comment if provided
      if (comentario) {
        await client.query(
          `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
           VALUES ('solicitud', $1, $2, $3, 'agendamiento')`,
          [id, req.user.id, comentario]
        );
      }

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'agendar', $2, $3, $4)`,
        [
          id,
          JSON.stringify({ estado: solicitud.estado }),
          JSON.stringify({
            estado: 'agendado',
            fecha_inicio_programada: fechaInicio,
            fecha_fin_programada: fechaFin
          }),
          req.user.id
        ]
      );

      // Notify NT team
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_agendado', 'Proyecto agendado',
           $1, $2
         FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true`,
        [
          `El proyecto ${solicitud.codigo} ha sido agendado para ${fechaInicio.toLocaleDateString('es-CO')}`,
          JSON.stringify({
            solicitud_id: id,
            codigo: solicitud.codigo,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
          })
        ]
      );
    });

    logger.info(`Solicitud ${solicitud.codigo} scheduled by gerencia: ${fecha_inicio} to ${fecha_fin}`);

    res.json({
      message: 'Proyecto agendado exitosamente',
      solicitud: {
        id,
        codigo: solicitud.codigo,
        estado: 'agendado',
        fecha_inicio_programada: fechaInicio,
        fecha_fin_programada: fechaFin
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/solicitudes/:codigo/solicitar-reevaluacion - Gerencia or Coordinador NT requests reevaluation from NT
router.post('/:codigo/solicitar-reevaluacion', authenticate, authorize('gerencia', 'coordinador_nt'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);
    const { comentario, areas_revisar } = req.body;

    if (!comentario || comentario.trim().length === 0) {
      throw new AppError('Debe proporcionar comentarios para la reevaluación', 400);
    }

    // Get the solicitud
    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    // Check valid state - coordinator can request from coordinator review, gerencia from gerencia review
    const validStates = req.user.rol === 'coordinador_nt'
      ? ['pendiente_revision_coordinador_nt']
      : ['pendiente_aprobacion_gerencia'];

    if (!validStates.includes(solicitud.estado)) {
      throw new AppError(`Solo se puede solicitar reevaluación de solicitudes pendientes de su revisión`, 400);
    }

    await withTransaction(async (client) => {
      // Update solicitud state
      await client.query(
        `UPDATE solicitudes SET
          estado = 'pendiente_reevaluacion',
          actualizado_en = NOW()
         WHERE id = $1`,
        [id]
      );

      // Update evaluation back to borrador so NT can edit it
      await client.query(
        `UPDATE evaluaciones_nt SET estado = 'borrador', actualizado_en = NOW()
         WHERE solicitud_id = $1 AND estado = 'enviado'`,
        [id]
      );

      // Update approval record
      await client.query(
        `UPDATE aprobaciones
         SET estado = 'reevaluacion', aprobador_id = $1, fecha_decision = NOW(),
             comentario = $2
         WHERE solicitud_id = $3 AND estado = 'pendiente'`,
        [req.user.id, comentario, id]
      );

      // Create reevaluation comment record
      await client.query(
        `INSERT INTO comentarios_reevaluacion (
          solicitud_id, gerente_id, tipo, contenido, areas_revisar
        ) VALUES ($1, $2, 'reevaluacion', $3, $4)`,
        [id, req.user.id, comentario, JSON.stringify(areas_revisar || [])]
      );

      // Add general comment
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
         VALUES ('solicitud', $1, $2, $3, 'reevaluacion')`,
        [id, req.user.id, `Reevaluación solicitada:\n${comentario}${areas_revisar ? '\n\nÁreas a revisar: ' + areas_revisar.join(', ') : ''}`]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'solicitar_reevaluacion', $2, $3, $4)`,
        [
          id,
          JSON.stringify({ estado: solicitud.estado }),
          JSON.stringify({ estado: 'pendiente_reevaluacion', comentario, areas_revisar }),
          req.user.id
        ]
      );

      // Log coordinator decision if applicable
      if (req.user.rol === 'coordinador_nt') {
        await client.query(
          `INSERT INTO decisiones_coordinador (entidad_tipo, entidad_id, entidad_codigo, coordinador_id, tipo_coordinador, accion, comentario)
           VALUES ('solicitud', $1, $2, $3, 'coordinador_nt', 'reevaluar', $4)`,
          [id, solicitud.codigo, req.user.id, comentario]
        );

        // Update solicitud with coordinator info
        await client.query(
          `UPDATE solicitudes
           SET coordinador_nt_id = $1,
               fecha_revision_coordinador = NOW(),
               comentario_coordinador = $2
           WHERE id = $3`,
          [req.user.id, comentario, id]
        );
      }

      // Notify NT team
      const requesterType = req.user.rol === 'coordinador_nt' ? 'Coordinador NT' : 'Gerencia';
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'reevaluacion_solicitada', 'Reevaluación solicitada',
           $1, $2
         FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true`,
        [
          `${requesterType} solicita reevaluación de ${solicitud.codigo}`,
          JSON.stringify({
            solicitud_id: id,
            codigo: solicitud.codigo,
            comentario,
            areas_revisar,
            solicitante_rol: req.user.rol
          })
        ]
      );
    });

    logger.info(`Reevaluation requested for ${solicitud.codigo} by ${req.user.rol}`);

    res.json({
      message: 'Reevaluación solicitada exitosamente',
      solicitud: {
        id,
        codigo: solicitud.codigo,
        estado: 'pendiente_reevaluacion'
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/:codigo/reevaluaciones - Get reevaluation history
router.get('/:codigo/reevaluaciones', authenticate, authorize('nuevas_tecnologias', 'coordinador_nt', 'gerencia'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    const result = await pool.query(
      `SELECT cr.*, u.nombre as usuario_nombre, u.rol as usuario_rol
       FROM comentarios_reevaluacion cr
       LEFT JOIN usuarios u ON cr.gerente_id = u.id
       WHERE cr.solicitud_id = $1
       ORDER BY cr.creado_en DESC`,
      [id]
    );

    res.json({ reevaluaciones: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/solicitudes/:codigo/transferir-ti - Transfer solicitud to TI as a new ticket
router.post('/:codigo/transferir-ti', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);
    const { motivo } = req.body;

    if (!motivo || motivo.trim().length === 0) {
      throw new AppError('Debe proporcionar un motivo para la transferencia', 400);
    }

    // Get the solicitud
    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    // Only reporte_fallo can be transferred to TI (cierre_servicio cannot)
    if (solicitud.tipo === 'cierre_servicio') {
      throw new AppError('Las solicitudes de cierre de servicio no pueden ser transferidas a TI', 400);
    }

    // Check if solicitud is in a valid state for transfer
    // Only pendiente_evaluacion_nt allows transfer (simple workflow goes directly to completado)
    if (solicitud.estado !== 'pendiente_evaluacion_nt') {
      throw new AppError(`No se puede transferir una solicitud en estado '${solicitud.estado}'`, 400);
    }

    // Check if already transferred
    if (solicitud.transferido_a_ticket_id) {
      throw new AppError('Esta solicitud ya ha sido transferida', 400);
    }

    await withTransaction(async (client) => {
      // Generate ticket code
      const year = new Date().getFullYear();
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const countResult = await client.query(
        `SELECT COUNT(*) FROM tickets WHERE EXTRACT(YEAR FROM creado_en) = $1 AND EXTRACT(MONTH FROM creado_en) = $2`,
        [year, new Date().getMonth() + 1]
      );
      const count = parseInt(countResult.rows[0].count, 10) + 1;
      const ticketCodigo = `TKT-${year}${month}-${count.toString().padStart(4, '0')}`;

      // Build description from solicitud data
      let descripcion = `[Transferido de ${solicitud.codigo}]\n\n`;
      if (solicitud.descripcion_problema) {
        const problema = typeof solicitud.descripcion_problema === 'string'
          ? JSON.parse(solicitud.descripcion_problema)
          : solicitud.descripcion_problema;
        descripcion += problema.descripcion || problema.situacion_actual || JSON.stringify(problema);
      }
      descripcion += `\n\nMotivo de transferencia: ${motivo}`;

      // Create the new ticket (without origen_solicitud_id - tracked via transferencias table)
      const ticketResult = await client.query(
        `INSERT INTO tickets (
          codigo, titulo, descripcion, categoria, prioridad, estado,
          solicitante_id, usuario_creador_id, datos_solicitante
        ) VALUES ($1, $2, $3, $4, $5, 'abierto', $6, $7, $8)
        RETURNING *`,
        [
          ticketCodigo,
          solicitud.titulo,
          descripcion,
          'soporte_general',
          solicitud.prioridad,
          solicitud.solicitante_id,
          req.user.id,
          JSON.stringify(solicitud.datos_solicitante || {})
        ]
      );

      const ticket = ticketResult.rows[0];

      // Update solicitud to transferred state
      await client.query(
        `UPDATE solicitudes SET
          estado = 'transferido_ti',
          transferido_a_ticket_id = $1,
          resolucion = $2,
          fecha_resolucion = NOW(),
          actualizado_en = NOW()
         WHERE id = $3`,
        [ticket.id, `Transferido a TI. Nuevo ticket: ${ticketCodigo}. Motivo: ${motivo}`, id]
      );

      // Create transfer record
      await client.query(
        `INSERT INTO transferencias (
          tipo, origen_tipo, origen_id, origen_codigo,
          destino_tipo, destino_id, destino_codigo,
          motivo, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'solicitud_a_ticket',
          'solicitud',
          solicitud.id,
          solicitud.codigo,
          'ticket',
          ticket.id,
          ticketCodigo,
          motivo,
          req.user.id
        ]
      );

      // Add comment to solicitud
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
         VALUES ('solicitud', $1, $2, $3, 'transferencia')`,
        [id, req.user.id, `Solicitud transferida a TI. Nuevo ticket: ${ticketCodigo}\nMotivo: ${motivo}`]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'transferencia', $2, $3, $4)`,
        [
          id,
          JSON.stringify({ estado: solicitud.estado }),
          JSON.stringify({ estado: 'transferido_ti', ticket_id: ticket.id, ticket_codigo: ticketCodigo }),
          req.user.id
        ]
      );

      // Notify TI team
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'solicitud_transferida', 'Solicitud transferida de NT',
           $1, $2
         FROM usuarios WHERE rol = 'ti' AND activo = true`,
        [
          `La solicitud ${solicitud.codigo} ha sido transferida como ticket ${ticketCodigo}`,
          JSON.stringify({
            solicitud_id: solicitud.id,
            solicitud_codigo: solicitud.codigo,
            ticket_id: ticket.id,
            ticket_codigo: ticketCodigo
          })
        ]
      );

      logger.info(`Solicitud ${solicitud.codigo} transferred to TI as ${ticketCodigo}`);

      // Send transfer email to solicitante
      const solicitanteData = solicitud.datos_solicitante || {};
      const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
      const solicitanteNombre = solicitanteData.nombre_completo || solicitanteData.nombre || 'Solicitante';
      if (solicitanteEmail) {
        emailService.sendTransferNotification(
          solicitanteEmail,
          solicitanteNombre,
          solicitud.codigo,
          ticketCodigo,
          'solicitud_a_ticket',
          motivo
        ).catch(err => logger.error('Error sending transfer email:', err));
      }

      res.json({
        message: 'Solicitud transferida exitosamente',
        solicitud: {
          id: solicitud.id,
          codigo: solicitud.codigo,
          estado: 'transferido_ti'
        },
        ticket: {
          id: ticket.id,
          codigo: ticketCodigo
        },
        transferencia: {
          origen: solicitud.codigo,
          destino: ticketCodigo
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/solicitudes/:codigo/proyecto-referencia - Update proyecto_referencia for transferido_ti
router.patch('/:codigo/proyecto-referencia', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const { proyecto_id, proyecto_nombre_otro } = req.body;

    if (!proyecto_id) {
      throw new AppError('Se requiere proyecto_id', 400);
    }

    // Get solicitud
    const solicitudResult = await pool.query(
      'SELECT * FROM solicitudes WHERE codigo = $1',
      [codigo]
    );

    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = solicitudResult.rows[0];

    // Only allow for transferido_ti type
    if (solicitud.tipo !== 'transferido_ti') {
      throw new AppError('Solo se puede asignar proyecto a solicitudes transferidas desde TI', 400);
    }

    // Build proyecto_referencia object
    const proyectoReferencia = {
      proyecto_id,
      proyecto_nombre_otro: proyecto_id === 'otro' ? proyecto_nombre_otro : null
    };

    // Update solicitud
    await pool.query(
      `UPDATE solicitudes
       SET proyecto_referencia = $1, actualizado_en = NOW()
       WHERE id = $2`,
      [JSON.stringify(proyectoReferencia), solicitud.id]
    );

    logger.info(`Proyecto referencia updated for ${codigo}: ${proyecto_id}`);

    res.json({
      message: 'Proyecto referencia actualizado',
      proyecto_referencia: proyectoReferencia
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================
// FORM EDITING (proyecto_nuevo_interno, actualizacion)
// ==============================================

// Label mappings for human-readable change comments
const labelMappings = {
  // Field names to Spanish labels
  fields: {
    // Sponsor
    'sponsor.nombre_completo': 'Patrocinador - Nombre',
    'sponsor.cargo': 'Patrocinador - Cargo',
    'sponsor.area': 'Patrocinador - Área',
    'sponsor.operacion_contrato': 'Patrocinador - Operación/Contrato',
    'sponsor.correo': 'Patrocinador - Correo',
    'sponsor.telefono': 'Patrocinador - Teléfono',
    'sponsor.cedula': 'Patrocinador - Cédula',
    // Stakeholders
    'stakeholders.internas.areas': 'Stakeholders Internos - Áreas',
    'stakeholders.internas.personas': 'Stakeholders Internos - Personas',
    'stakeholders.aplica_externas': 'Stakeholders Externos - Aplica',
    'stakeholders.externas.sectores': 'Stakeholders Externos - Sectores',
    'stakeholders.externas.empresas': 'Stakeholders Externos - Empresas',
    'stakeholders.externas.proveedores': 'Stakeholders Externos - Proveedores',
    'stakeholders.externas.personas': 'Stakeholders Externos - Personas',
    // Problemática
    'problematica.situacion_actual': 'Problemática - Situación Actual',
    'problematica.origen': 'Problemática - Origen del Problema',
    'problematica.desde_cuando': 'Problemática - Desde Cuándo',
    'problematica.afectacion_operacion': 'Problemática - Afectación a la Operación',
    'problematica.procesos_comprometidos': 'Problemática - Procesos Comprometidos',
    'problematica.impacto_nivel': 'Problemática - Nivel de Impacto',
    'problematica.impacto_descripcion': 'Problemática - Descripción del Impacto',
    // Urgencia
    'urgencia.necesidad_principal': 'Urgencia - Necesidad Principal',
    'urgencia.nivel': 'Urgencia - Nivel',
    'urgencia.fecha_limite': 'Urgencia - Fecha Límite',
    'urgencia.justificacion_nt': 'Urgencia - Justificación',
    // Solución
    'solucion.tipo': 'Solución - Tipo',
    'solucion.tipo_descripcion': 'Solución - Descripción del Tipo',
    'solucion.descripcion_ideal': 'Solución - Descripción Ideal',
    'solucion.casos_uso': 'Solución - Casos de Uso',
    'solucion.funcionalidades_minimas': 'Solución - Funcionalidades Mínimas',
    'solucion.funcionalidades_deseables': 'Solución - Funcionalidades Deseables',
    'solucion.restricciones_aplican': 'Solución - Aplican Restricciones',
    'solucion.restricciones': 'Solución - Restricciones',
    'solucion.forma_entrega': 'Solución - Forma de Entrega',
    // Beneficios
    'beneficios.descripcion': 'Beneficios - Descripción',
    'beneficios.mejora_concreta': 'Beneficios - Mejora Concreta',
    'beneficios.procesos_optimizados': 'Beneficios - Procesos Optimizados',
    'beneficios.reduccion_costos': 'Beneficios - Reducción de Costos',
    'beneficios.costos_descripcion': 'Beneficios - Descripción de Costos',
    'beneficios.analisis_costos': 'Beneficios - Análisis de Costos',
    'beneficios.beneficio_monetario': 'Beneficios - Beneficio Monetario',
    'beneficios.beneficio_monetario_descripcion': 'Beneficios - Descripción Beneficio Monetario',
    // Desempeño
    'desempeno.indicadores': 'Desempeño - Indicadores (KPIs)',
    'desempeno.como_medir': 'Desempeño - Cómo Medir',
    'desempeno.herramientas': 'Desempeño - Herramientas',
    'desempeno.responsable_datos': 'Desempeño - Responsable de Datos',
    'desempeno.compromiso_sponsor': 'Desempeño - Compromiso del Sponsor',
    'desempeno.comentarios_adicionales': 'Desempeño - Comentarios Adicionales',
    // Proyecto referencia
    'proyecto_referencia.proyecto_id': 'Proyecto de Referencia',
    'proyecto_referencia.proyecto_nombre_otro': 'Proyecto de Referencia - Otro'
  },
  // Dropdown values to labels
  values: {
    area: {
      gerencia_general: 'Gerencia General',
      operaciones: 'Operaciones',
      operaciones_planta: 'Operaciones > Planta',
      operaciones_campo: 'Operaciones > Campo',
      operaciones_taller: 'Operaciones > Taller',
      administracion: 'Administración',
      nuevas_tecnologias: 'Nuevas Tecnologías',
      ti: 'Tecnología de la Información',
      rrhh: 'Recursos Humanos',
      hse: 'HSE',
      calidad: 'Calidad',
      compras: 'Compras',
      contabilidad: 'Contabilidad',
      mantenimiento: 'Mantenimiento',
      logistica: 'Logística',
      comercial: 'Comercial',
      juridico: 'Jurídico',
      proyectos: 'Proyectos'
    },
    operacion_contrato: {
      oficina_principal: 'Oficina Principal',
      planta_barranca: 'Planta Barrancabermeja',
      planta_cartagena: 'Planta Cartagena',
      contrato_ecopetrol: 'Contrato Ecopetrol',
      contrato_oxy: 'Contrato OXY',
      contrato_gran_tierra: 'Contrato Gran Tierra',
      contrato_parex: 'Contrato Parex',
      contrato_frontera: 'Contrato Frontera Energy',
      otro: 'Otro'
    },
    urgencia_nivel: {
      inmediata: 'Inmediata (< 1 semana)',
      corto_plazo: 'Corto Plazo (1-4 semanas)',
      mediano_plazo: 'Mediano Plazo (1-3 meses)',
      largo_plazo: 'Largo Plazo (> 3 meses)'
    },
    impacto_nivel: {
      baja: 'Baja',
      media: 'Media',
      alta: 'Alta',
      critica: 'Crítica'
    },
    tipo_solucion: {
      aplicacion_web: 'Aplicación Web',
      aplicacion_movil: 'Aplicación Móvil',
      automatizacion: 'Automatización de Proceso',
      integracion: 'Integración de Sistemas',
      reporte_dashboard: 'Reporte/Dashboard',
      otro: 'Otro'
    },
    forma_entrega: {
      web: 'Aplicación Web',
      movil: 'Aplicación Móvil',
      escritorio: 'Aplicación de Escritorio',
      reporte: 'Reporte Periódico',
      dashboard: 'Dashboard en Tiempo Real',
      api: 'API/Servicio'
    }
  }
};

// Helper to get label for dropdown value
const getValueLabel = (fieldPath, value) => {
  if (value === null || value === undefined) return '--';

  // Determine which value mapping to use based on field
  if (fieldPath.includes('area')) {
    return labelMappings.values.area[value] || value;
  }
  if (fieldPath.includes('operacion_contrato')) {
    return labelMappings.values.operacion_contrato[value] || value;
  }
  if (fieldPath === 'urgencia.nivel') {
    return labelMappings.values.urgencia_nivel[value] || value;
  }
  if (fieldPath === 'problematica.impacto_nivel') {
    return labelMappings.values.impacto_nivel[value] || value;
  }
  if (fieldPath === 'solucion.tipo') {
    return labelMappings.values.tipo_solucion[value] || value;
  }
  if (fieldPath === 'solucion.forma_entrega') {
    return labelMappings.values.forma_entrega[value] || value;
  }

  // For booleans
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  // For arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '--';
    // For KPIs array, summarize
    if (fieldPath === 'desempeno.indicadores') {
      return `${value.length} indicador(es)`;
    }
    // For cost analysis
    if (fieldPath === 'beneficios.analisis_costos') {
      return 'Ver análisis de costos';
    }
    return value.join(', ');
  }

  // For objects (like analisis_costos)
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 50) + '...';
  }

  // Truncate long text
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...';
  }

  return value;
};

// Helper to compare values and generate changes
const compareAndGenerateChanges = (oldData, newData, prefix = '') => {
  const changes = [];

  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {})
  ]);

  for (const key of allKeys) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];

    // Skip if both are empty/undefined
    if ((oldVal === undefined || oldVal === null || oldVal === '') &&
        (newVal === undefined || newVal === null || newVal === '')) {
      continue;
    }

    // Handle nested objects (but not arrays)
    if (typeof oldVal === 'object' && !Array.isArray(oldVal) &&
        typeof newVal === 'object' && !Array.isArray(newVal) &&
        oldVal !== null && newVal !== null) {
      changes.push(...compareAndGenerateChanges(oldVal, newVal, fieldPath));
      continue;
    }

    // Compare values
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);

    if (oldStr !== newStr) {
      const fieldLabel = labelMappings.fields[fieldPath] || fieldPath;
      const oldLabel = getValueLabel(fieldPath, oldVal);
      const newLabel = getValueLabel(fieldPath, newVal);

      changes.push({
        field: fieldPath,
        label: fieldLabel,
        oldValue: oldLabel,
        newValue: newLabel
      });
    }
  }

  return changes;
};

// PATCH /api/solicitudes/:codigo/formulario - Update form data for proyecto_nuevo_interno/actualizacion
router.patch('/:codigo/formulario', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    // Get current solicitud
    const solicitudResult = await pool.query(
      'SELECT * FROM solicitudes WHERE id = $1',
      [id]
    );

    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = solicitudResult.rows[0];

    // Validate tipo
    if (!['proyecto_nuevo_interno', 'actualizacion'].includes(solicitud.tipo)) {
      throw new AppError('Solo se pueden editar solicitudes de tipo Proyecto Nuevo o Actualización', 400);
    }

    // Validate estado
    if (!['en_estudio', 'pendiente_reevaluacion'].includes(solicitud.estado)) {
      throw new AppError('Solo se pueden editar solicitudes en estado "En Estudio" o "Pendiente de Reevaluación"', 400);
    }

    const {
      sponsor,
      stakeholders,
      problematica,
      urgencia,
      solucion,
      beneficios,
      desempeno,
      proyecto_referencia,
      integracion
    } = req.body;

    // Build current data for comparison
    const currentData = {
      sponsor: solicitud.datos_patrocinador || {},
      stakeholders: solicitud.datos_stakeholders || {},
      problematica: solicitud.descripcion_problema || {},
      urgencia: solicitud.necesidad_urgencia || {},
      solucion: solicitud.solucion_propuesta || {},
      beneficios: solicitud.beneficios || {},
      desempeno: {
        indicadores: solicitud.kpis || [],
        ...(solicitud.declaracion?.desempeno || {})
      },
      proyecto_referencia: solicitud.proyecto_referencia || {},
      integracion: solicitud.integracion || { fases: [], tareas: [] }
    };

    // Build new data
    const newData = {
      sponsor: sponsor !== undefined ? sponsor : currentData.sponsor,
      stakeholders: stakeholders !== undefined ? stakeholders : currentData.stakeholders,
      problematica: problematica !== undefined ? problematica : currentData.problematica,
      urgencia: urgencia !== undefined ? urgencia : currentData.urgencia,
      solucion: solucion !== undefined ? solucion : currentData.solucion,
      beneficios: beneficios !== undefined ? beneficios : currentData.beneficios,
      desempeno: desempeno !== undefined ? desempeno : currentData.desempeno,
      proyecto_referencia: proyecto_referencia !== undefined ? proyecto_referencia : currentData.proyecto_referencia,
      integracion: integracion !== undefined ? integracion : currentData.integracion
    };

    // Generate list of changes
    const allChanges = [];

    if (sponsor !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.sponsor, newData.sponsor, 'sponsor'));
    }
    if (stakeholders !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.stakeholders, newData.stakeholders, 'stakeholders'));
    }
    if (problematica !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.problematica, newData.problematica, 'problematica'));
    }
    if (urgencia !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.urgencia, newData.urgencia, 'urgencia'));
    }
    if (solucion !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.solucion, newData.solucion, 'solucion'));
    }
    if (beneficios !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.beneficios, newData.beneficios, 'beneficios'));
    }
    if (desempeno !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.desempeno, newData.desempeno, 'desempeno'));
    }
    if (proyecto_referencia !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.proyecto_referencia, newData.proyecto_referencia, 'proyecto_referencia'));
    }
    if (integracion !== undefined) {
      allChanges.push(...compareAndGenerateChanges(currentData.integracion, newData.integracion, 'integracion'));
    }

    // If no changes, return early
    if (allChanges.length === 0) {
      return res.json({
        message: 'No se detectaron cambios',
        changes: []
      });
    }

    await withTransaction(async (client) => {
      // Update solicitud with new data
      await client.query(
        `UPDATE solicitudes SET
          datos_patrocinador = $1,
          datos_stakeholders = $2,
          descripcion_problema = $3,
          necesidad_urgencia = $4,
          solucion_propuesta = $5,
          beneficios = $6,
          kpis = $7,
          proyecto_referencia = $8,
          integracion = $9,
          actualizado_en = NOW()
         WHERE id = $10`,
        [
          JSON.stringify(newData.sponsor),
          JSON.stringify(newData.stakeholders),
          JSON.stringify(newData.problematica),
          JSON.stringify(newData.urgencia),
          JSON.stringify(newData.solucion),
          JSON.stringify(newData.beneficios),
          JSON.stringify(newData.desempeno.indicadores || []),
          JSON.stringify(newData.proyecto_referencia),
          JSON.stringify(newData.integracion),
          id
        ]
      );

      // Log change in history
      await client.query(
        `INSERT INTO historial_cambios (
          entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'solicitud',
          id,
          'edicion_formulario',
          JSON.stringify(currentData),
          JSON.stringify(newData),
          req.user.id
        ]
      );

      // Generate and add private system comment with all changes
      let comentarioContent = 'Edición de solicitud:\n';
      for (const change of allChanges) {
        comentarioContent += `• ${change.label}: "${change.oldValue}" → "${change.newValue}"\n`;
      }

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('solicitud', $1, $2, $3, 'edicion', true)`,
        [id, req.user.id, comentarioContent.trim()]
      );
    });

    logger.info(`Solicitud ${codigo} form data updated by ${req.user.nombre}. ${allChanges.length} changes.`);

    res.json({
      message: 'Formulario actualizado exitosamente',
      changes: allChanges
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/proyecto/consulta/:codigo - Public project consultation
router.get('/proyecto/consulta/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;

    // Find the project — by PRY code directly, or by SOL code via solicitud
    let proyecto;
    if (codigo.toUpperCase().startsWith('PRY-')) {
      const result = await pool.query(
        `SELECT p.*, s.codigo as solicitud_codigo, s.datos_solicitante,
                s.fecha_inicio_programada, s.fecha_fin_programada
         FROM proyectos p
         LEFT JOIN solicitudes s ON p.solicitud_id = s.id
         WHERE p.codigo = $1`,
        [codigo.toUpperCase()]
      );
      proyecto = result.rows[0];
    } else {
      const result = await pool.query(
        `SELECT p.*, s.codigo as solicitud_codigo, s.datos_solicitante,
                s.fecha_inicio_programada, s.fecha_fin_programada
         FROM proyectos p
         JOIN solicitudes s ON p.solicitud_id = s.id
         WHERE s.codigo = $1`,
        [codigo.toUpperCase()]
      );
      proyecto = result.rows[0];
    }

    if (!proyecto) {
      throw new AppError('Proyecto no encontrado', 404);
    }

    const proyectoId = proyecto.id;

    // Get tasks for progress
    let progresoPractico = 0;
    let totalTareas = 0;
    let tareasCompletadas = 0;
    let fechaFinEstimada = null;

    const tareasResult = await pool.query(
      `SELECT progreso, duracion_dias, completada, fecha_fin FROM proyecto_tareas WHERE proyecto_id = $1
       ORDER BY fecha_fin DESC NULLS LAST`,
      [proyectoId]
    );

    totalTareas = tareasResult.rows.length;
    tareasCompletadas = tareasResult.rows.filter(t => t.completada).length;

    if (tareasResult.rows.length > 0) {
      const totalPesoProgreso = tareasResult.rows.reduce((sum, t) => sum + ((t.progreso || 0) * (t.duracion_dias || 1)), 0);
      const totalPeso = tareasResult.rows.reduce((sum, t) => sum + (t.duracion_dias || 1), 0);
      if (totalPeso > 0) {
        progresoPractico = Math.round(totalPesoProgreso / totalPeso);
      }
      fechaFinEstimada = tareasResult.rows[0]?.fecha_fin || null;
    }

    // Get public comments
    const comentariosResult = await pool.query(
      `SELECT c.id, c.contenido, c.tipo, c.creado_en as fecha, c.autor_externo,
              u.nombre as autor_nombre,
              (SELECT COUNT(*) FROM archivos a WHERE a.comentario_id = c.id) as adjuntos_count
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.entidad_tipo = 'proyecto' AND c.entidad_id = $1
         AND c.tipo IN ('publico', 'comunicacion', 'agendar_reunion', 'respuesta')
       ORDER BY c.creado_en ASC`,
      [proyectoId]
    );
    const comentarios = comentariosResult.rows.map(c => ({
      id: c.id,
      contenido: c.contenido,
      tipo: c.tipo,
      fecha: c.fecha,
      autor: c.autor_externo || c.autor_nombre || 'Equipo técnico',
      es_respuesta: c.tipo === 'respuesta',
      adjuntos_count: parseInt(c.adjuntos_count) || 0
    }));

    // Check if paused
    const pausaResult = await pool.query(
      `SELECT motivo, fecha_inicio FROM proyecto_pausas WHERE proyecto_id = $1 AND fecha_fin IS NULL`,
      [proyectoId]
    );
    const isPaused = pausaResult.rows.length > 0;

    // Public-friendly estado
    const estadoLabels = {
      planificacion: 'Programado',
      agendado: 'Programado',
      en_desarrollo: 'En Desarrollo',
      pausado: 'Pausado',
      completado: 'Completado',
      cancelado: 'Cancelado',
      cancelado_coordinador: 'Cancelado',
      cancelado_gerencia: 'Cancelado'
    };

    res.json({
      proyecto: {
        codigo: proyecto.codigo,
        solicitud_codigo: proyecto.solicitud_codigo || null,
        titulo: proyecto.titulo,
        estado: estadoLabels[proyecto.estado] || proyecto.estado,
        estado_interno: proyecto.estado,
        fecha_inicio_programada: proyecto.fecha_inicio_estimada || proyecto.fecha_inicio_programada,
        fecha_fin_programada: proyecto.fecha_fin_estimada || proyecto.fecha_fin_programada,
        fecha_fin_estimada: fechaFinEstimada,
        progreso: progresoPractico,
        total_tareas: totalTareas,
        tareas_completadas: tareasCompletadas,
        is_paused: isPaused,
        pause_reason: isPaused ? pausaResult.rows[0].motivo : null,
        pause_since: isPaused ? pausaResult.rows[0].fecha_inicio : null,
        comentarios
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
