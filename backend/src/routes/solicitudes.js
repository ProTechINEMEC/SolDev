const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const emailService = require('../services/email');
const logger = require('../utils/logger');
const publicLabels = require('../utils/publicLabels');

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
    areas: Joi.array().items(Joi.string()).optional(),
    personas: Joi.array().items(Joi.string()).optional()
  }).optional(),
  aplica_externas: Joi.boolean().optional(),
  externas: Joi.object({
    sectores: Joi.array().items(Joi.string()).optional(),
    empresas: Joi.array().items(Joi.string()).optional(),
    proveedores: Joi.array().items(Joi.string()).optional(),
    personas: Joi.array().items(Joi.string()).optional()
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
  declaracion: declaracionSchema.required()
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
        declaracion: value.declaracion
      };
    }

    // Create solicitud with new JSONB structure
    const result = await pool.query(
      `INSERT INTO solicitudes (
        codigo, tipo, estado, prioridad, titulo,
        solicitante_id, usuario_creador_id,
        datos_solicitante, datos_patrocinador, datos_stakeholders,
        descripcion_problema, necesidad_urgencia, solucion_propuesta,
        beneficios, kpis, declaracion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
        JSON.stringify(datosFormulario.declaracion || { confirmacion: datosFormulario.confirmacion })
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
        es_transferido: publicEstado.es_transferido
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

    // Get comments with attachment info for respuesta type
    const comentariosResult = await pool.query(
      `SELECT c.*, u.nombre as autor_nombre, u.rol as autor_rol,
              (SELECT array_agg(respuesta_numero ORDER BY respuesta_numero)
               FROM archivos a WHERE a.comentario_id = c.id) as attachment_nums
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.entidad_tipo = 'solicitud' AND c.entidad_id = $1
       ORDER BY c.creado_en DESC`,
      [solicitud.id]
    );

    // Add attachment info text to respuesta comments
    const comentarios = {
      rows: comentariosResult.rows.map(c => {
        if (c.tipo === 'respuesta' && c.attachment_nums && c.attachment_nums.length > 0) {
          const nums = c.attachment_nums.filter(n => n).join(', ');
          c.contenido += `\n\n📎 ${c.autor_externo} adjuntó archivo(s): ${nums}`;
        }
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
      creacion: 'Adjuntos del Solicitante'
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
router.put('/:codigo/estado', authenticate, authorize('nuevas_tecnologias', 'gerencia', 'ti'), async (req, res, next) => {
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
    const complexWorkflowTransitions = {
      pendiente_evaluacion_nt: ['en_estudio', 'descartado_nt'],
      en_estudio: ['pendiente_aprobacion_gerencia', 'descartado_nt'],
      pendiente_reevaluacion: ['en_estudio'],
      agendado: ['en_desarrollo'],
      aprobado: ['agendado', 'en_desarrollo'],
      en_desarrollo: ['stand_by', 'completado', 'cancelado'],
      stand_by: ['en_desarrollo', 'cancelado'],
      // Terminal states
      completado: [],
      rechazado_gerencia: [],
      cancelado: []
    };

    const validTransitions = {
      nuevas_tecnologias: isSimpleTipo(solicitud.tipo) ? simpleWorkflowTransitions : complexWorkflowTransitions,
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
        pendiente_aprobacion_gerencia: `Solicitud escalada a Gerencia para aprobación`,
        aprobado: `Solicitud aprobada por Gerencia`,
        rechazado_gerencia: `Solicitud rechazada por Gerencia`,
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

      // Create approval record if going to gerencia
      if (value.estado === 'pendiente_aprobacion_gerencia') {
        await client.query(
          `INSERT INTO aprobaciones (solicitud_id, estado)
           VALUES ($1, 'pendiente')`,
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
router.post('/:codigo/comentarios', authenticate, async (req, res, next) => {
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
        autor_rol: req.user.rol
      }
    });
  } catch (error) {
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

      if (proyectoExists.rows.length === 0) {
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
            responsable_id, fecha_inicio_estimada, fecha_fin_estimada, datos_proyecto
          ) VALUES ($1, $2, $3, $4, 'planificacion', $5, $6, $7, $8)`,
          [
            codigoProyecto,
            id,
            solicitud.titulo,
            solicitud.descripcion_problema?.situacion_actual || '',
            req.user.id,
            fechaInicio,
            fechaFin,
            JSON.stringify({
              solicitante: solicitud.datos_solicitante,
              stakeholders: solicitud.datos_stakeholders,
              beneficios: solicitud.beneficios,
              kpis: solicitud.kpis
            })
          ]
        );
      } else {
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

// POST /api/solicitudes/:codigo/solicitar-reevaluacion - Gerencia requests reevaluation from NT
router.post('/:codigo/solicitar-reevaluacion', authenticate, authorize('gerencia'), async (req, res, next) => {
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

    // Check valid state
    if (solicitud.estado !== 'pendiente_aprobacion_gerencia') {
      throw new AppError(`Solo se puede solicitar reevaluación de solicitudes pendientes de aprobación`, 400);
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

      // Notify NT team
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'reevaluacion_solicitada', 'Reevaluación solicitada',
           $1, $2
         FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true`,
        [
          `Gerencia solicita reevaluación de ${solicitud.codigo}`,
          JSON.stringify({
            solicitud_id: id,
            codigo: solicitud.codigo,
            comentario,
            areas_revisar
          })
        ]
      );
    });

    logger.info(`Reevaluation requested for ${solicitud.codigo} by gerencia`);

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
router.get('/:codigo/reevaluaciones', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
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
      proyecto_referencia
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
      proyecto_referencia: solicitud.proyecto_referencia || {}
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
      proyecto_referencia: proyecto_referencia !== undefined ? proyecto_referencia : currentData.proyecto_referencia
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
          actualizado_en = NOW()
         WHERE id = $9`,
        [
          JSON.stringify(newData.sponsor),
          JSON.stringify(newData.stakeholders),
          JSON.stringify(newData.problematica),
          JSON.stringify(newData.urgencia),
          JSON.stringify(newData.solucion),
          JSON.stringify(newData.beneficios),
          JSON.stringify(newData.desempeno.indicadores || []),
          JSON.stringify(newData.proyecto_referencia),
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

// ==============================================
// PROJECT WORKFLOW ENDPOINTS
// ==============================================

// PUT /api/solicitudes/:codigo/iniciar-desarrollo - Start project development
router.put('/:codigo/iniciar-desarrollo', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    // Must be agendado to start development
    if (solicitud.estado !== 'agendado') {
      throw new AppError(`Solo se puede iniciar desarrollo de solicitudes agendadas. Estado actual: ${solicitud.estado}`, 400);
    }

    // Check if user is project lead
    const evaluacionResult = await pool.query(
      'SELECT lider_id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado = $2',
      [id, 'enviado']
    );
    const liderId = evaluacionResult.rows[0]?.lider_id;

    // Only lead or gerencia can start development
    if (liderId && liderId !== req.user.id && req.user.rol !== 'gerencia') {
      throw new AppError('Solo el líder del proyecto puede iniciar el desarrollo', 403);
    }

    await withTransaction(async (client) => {
      // Update solicitud to en_desarrollo and set fecha_inicio_desarrollo
      await client.query(
        `UPDATE solicitudes SET
          estado = 'en_desarrollo',
          fecha_inicio_desarrollo = NOW(),
          actualizado_en = NOW()
         WHERE id = $1`,
        [id]
      );

      // Also update the project if exists
      await client.query(
        `UPDATE proyectos SET estado = 'en_desarrollo', actualizado_en = NOW()
         WHERE solicitud_id = $1`,
        [id]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'iniciar_desarrollo', $2, $3, $4)`,
        [id, JSON.stringify({ estado: 'agendado' }), JSON.stringify({ estado: 'en_desarrollo' }), req.user.id]
      );

      // Add comment
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('solicitud', $1, $2, 'Proyecto iniciado en desarrollo', 'cambio_estado', true)`,
        [id, req.user.id]
      );

      // Notify team and gerencia
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_iniciado', 'Proyecto iniciado',
           $1, $2
         FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'gerencia') AND activo = true`,
        [
          `El proyecto ${solicitud.codigo} ha iniciado desarrollo`,
          JSON.stringify({ solicitud_id: id, codigo: solicitud.codigo })
        ]
      );
    });

    // Send email to requester with project code
    const solicitanteData = solicitud.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    const solicitanteNombre = solicitanteData.nombre_completo || 'Solicitante';

    // Get project code if exists
    const proyectoResult = await pool.query(
      'SELECT codigo FROM proyectos WHERE solicitud_id = $1',
      [id]
    );
    const proyectoCodigo = proyectoResult.rows[0]?.codigo;

    if (solicitanteEmail) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:11000';
      const consultaUrl = proyectoCodigo
        ? `${frontendUrl}/proyecto/consulta/${proyectoCodigo}`
        : `${frontendUrl}/consulta/${solicitud.codigo}`;

      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Su proyecto ha iniciado desarrollo - ${proyectoCodigo || solicitud.codigo}`,
        html: `
          <h2>¡Su proyecto ha iniciado!</h2>
          <p>Estimado/a ${solicitanteNombre},</p>
          <p>Nos complace informarle que su solicitud <strong>${solicitud.codigo}</strong> ha sido aprobada y el proyecto ha iniciado su fase de desarrollo.</p>
          ${proyectoCodigo ? `<p><strong>Nuevo código de proyecto:</strong> ${proyectoCodigo}</p>` : ''}
          <p>Puede consultar el estado y progreso del proyecto en cualquier momento:</p>
          <p><a href="${consultaUrl}" style="background-color: #D52B1E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Ver Progreso del Proyecto</a></p>
          <p>Le mantendremos informado sobre avances importantes.</p>
        `
      }).catch(err => logger.error('Error sending project start email:', err));
    }

    logger.info(`Project ${solicitud.codigo} started development by ${req.user.email}`);

    res.json({
      message: 'Proyecto iniciado en desarrollo',
      solicitud: {
        id,
        codigo: solicitud.codigo,
        estado: 'en_desarrollo',
        fecha_inicio_desarrollo: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/solicitudes/:codigo/pausar - Pause project
router.put('/:codigo/pausar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const { motivo } = req.body;
    const id = await getSolicitudIdByCodigo(codigo);

    if (!motivo || motivo.trim().length === 0) {
      throw new AppError('Debe proporcionar un motivo para pausar el proyecto', 400);
    }

    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    if (solicitud.estado !== 'en_desarrollo') {
      throw new AppError(`Solo se pueden pausar proyectos en desarrollo. Estado actual: ${solicitud.estado}`, 400);
    }

    // Check if user is project lead
    const evaluacionResult = await pool.query(
      'SELECT lider_id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado = $2',
      [id, 'enviado']
    );
    const liderId = evaluacionResult.rows[0]?.lider_id;

    if (liderId && liderId !== req.user.id) {
      throw new AppError('Solo el líder del proyecto puede pausar el proyecto', 403);
    }

    await withTransaction(async (client) => {
      // Update solicitud to pausado
      await client.query(
        `UPDATE solicitudes SET
          estado = 'pausado',
          actualizado_en = NOW()
         WHERE id = $1`,
        [id]
      );

      // Create pause record
      await client.query(
        `INSERT INTO proyecto_pausas (solicitud_id, motivo, creado_por)
         VALUES ($1, $2, $3)`,
        [id, motivo, req.user.id]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'pausar', $2, $3, $4)`,
        [id, JSON.stringify({ estado: 'en_desarrollo' }), JSON.stringify({ estado: 'pausado', motivo }), req.user.id]
      );

      // Add comment
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('solicitud', $1, $2, $3, 'cambio_estado', true)`,
        [id, req.user.id, `Proyecto pausado. Motivo: ${motivo}`]
      );

      // Notify gerencia
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_pausado', 'Proyecto pausado',
           $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `El proyecto ${solicitud.codigo} ha sido pausado`,
          JSON.stringify({ solicitud_id: id, codigo: solicitud.codigo, motivo })
        ]
      );
    });

    // Send email to requester
    const solicitanteData = solicitud.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    const solicitanteNombre = solicitanteData.nombre_completo || 'Solicitante';

    if (solicitanteEmail) {
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Proyecto pausado - ${solicitud.codigo}`,
        html: `
          <h2>Proyecto Pausado Temporalmente</h2>
          <p>Estimado/a ${solicitanteNombre},</p>
          <p>Le informamos que el proyecto <strong>${solicitud.codigo}</strong> ha sido pausado temporalmente.</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <p>Le notificaremos cuando el proyecto sea retomado.</p>
        `
      }).catch(err => logger.error('Error sending pause email:', err));
    }

    logger.info(`Project ${solicitud.codigo} paused by ${req.user.email}: ${motivo}`);

    res.json({
      message: 'Proyecto pausado',
      solicitud: {
        id,
        codigo: solicitud.codigo,
        estado: 'pausado'
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/solicitudes/:codigo/reanudar - Resume paused project
router.put('/:codigo/reanudar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    if (solicitud.estado !== 'pausado') {
      throw new AppError(`Solo se pueden reanudar proyectos pausados. Estado actual: ${solicitud.estado}`, 400);
    }

    // Check if user is project lead
    const evaluacionResult = await pool.query(
      'SELECT lider_id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado = $2',
      [id, 'enviado']
    );
    const liderId = evaluacionResult.rows[0]?.lider_id;

    if (liderId && liderId !== req.user.id) {
      throw new AppError('Solo el líder del proyecto puede reanudar el proyecto', 403);
    }

    await withTransaction(async (client) => {
      // Get active pause to calculate days paused
      const pausaResult = await client.query(
        `SELECT id, fecha_inicio FROM proyecto_pausas
         WHERE solicitud_id = $1 AND fecha_fin IS NULL
         ORDER BY fecha_inicio DESC LIMIT 1`,
        [id]
      );

      if (pausaResult.rows.length > 0) {
        const pausa = pausaResult.rows[0];
        const diasPausados = Math.ceil((new Date() - new Date(pausa.fecha_inicio)) / (1000 * 60 * 60 * 24));

        // Close the pause record
        await client.query(
          `UPDATE proyecto_pausas SET fecha_fin = NOW(), dias_pausados = $1 WHERE id = $2`,
          [diasPausados, pausa.id]
        );

        // Add to total paused days
        await client.query(
          `UPDATE solicitudes SET
            dias_pausados_total = COALESCE(dias_pausados_total, 0) + $1
           WHERE id = $2`,
          [diasPausados, id]
        );
      }

      // Update solicitud to en_desarrollo
      await client.query(
        `UPDATE solicitudes SET
          estado = 'en_desarrollo',
          actualizado_en = NOW()
         WHERE id = $1`,
        [id]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'reanudar', $2, $3, $4)`,
        [id, JSON.stringify({ estado: 'pausado' }), JSON.stringify({ estado: 'en_desarrollo' }), req.user.id]
      );

      // Add comment
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('solicitud', $1, $2, 'Proyecto reanudado', 'cambio_estado', true)`,
        [id, req.user.id]
      );

      // Notify gerencia
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_reanudado', 'Proyecto reanudado',
           $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `El proyecto ${solicitud.codigo} ha sido reanudado`,
          JSON.stringify({ solicitud_id: id, codigo: solicitud.codigo })
        ]
      );
    });

    // Send email to requester
    const solicitanteData = solicitud.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    const solicitanteNombre = solicitanteData.nombre_completo || 'Solicitante';

    if (solicitanteEmail) {
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Proyecto reanudado - ${solicitud.codigo}`,
        html: `
          <h2>Proyecto Reanudado</h2>
          <p>Estimado/a ${solicitanteNombre},</p>
          <p>Le informamos que el proyecto <strong>${solicitud.codigo}</strong> ha sido reanudado y continúa su desarrollo.</p>
        `
      }).catch(err => logger.error('Error sending resume email:', err));
    }

    logger.info(`Project ${solicitud.codigo} resumed by ${req.user.email}`);

    res.json({
      message: 'Proyecto reanudado',
      solicitud: {
        id,
        codigo: solicitud.codigo,
        estado: 'en_desarrollo'
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/solicitudes/:codigo/cancelar-proyecto - Cancel project
router.put('/:codigo/cancelar-proyecto', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const { motivo } = req.body;
    const id = await getSolicitudIdByCodigo(codigo);

    if (!motivo || motivo.trim().length === 0) {
      throw new AppError('Debe proporcionar un motivo para cancelar el proyecto', 400);
    }

    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    // Can only cancel projects in desarrollo or pausado
    if (!['en_desarrollo', 'pausado'].includes(solicitud.estado)) {
      throw new AppError(`Solo se pueden cancelar proyectos en desarrollo o pausados. Estado actual: ${solicitud.estado}`, 400);
    }

    // Check if user is project lead
    const evaluacionResult = await pool.query(
      'SELECT lider_id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado = $2',
      [id, 'enviado']
    );
    const liderId = evaluacionResult.rows[0]?.lider_id;

    if (liderId && liderId !== req.user.id) {
      throw new AppError('Solo el líder del proyecto puede cancelar el proyecto', 403);
    }

    await withTransaction(async (client) => {
      // Close any active pause
      await client.query(
        `UPDATE proyecto_pausas SET fecha_fin = NOW() WHERE solicitud_id = $1 AND fecha_fin IS NULL`,
        [id]
      );

      // Update solicitud to cancelado
      await client.query(
        `UPDATE solicitudes SET
          estado = 'cancelado',
          motivo_cancelacion = $1,
          cancelado_en = NOW(),
          cancelado_por = $2,
          actualizado_en = NOW()
         WHERE id = $3`,
        [motivo, req.user.id, id]
      );

      // Also update related project if exists
      await client.query(
        `UPDATE proyectos SET estado = 'cancelado', actualizado_en = NOW()
         WHERE solicitud_id = $1`,
        [id]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'cancelar', $2, $3, $4)`,
        [id, JSON.stringify({ estado: solicitud.estado }), JSON.stringify({ estado: 'cancelado', motivo }), req.user.id]
      );

      // Add comment
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('solicitud', $1, $2, $3, 'cambio_estado', true)`,
        [id, req.user.id, `Proyecto cancelado. Motivo: ${motivo}`]
      );

      // Notify gerencia
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_cancelado', 'Proyecto cancelado',
           $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `El proyecto ${solicitud.codigo} ha sido cancelado`,
          JSON.stringify({ solicitud_id: id, codigo: solicitud.codigo, motivo })
        ]
      );
    });

    // Send email to requester
    const solicitanteData = solicitud.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    const solicitanteNombre = solicitanteData.nombre_completo || 'Solicitante';

    if (solicitanteEmail) {
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Proyecto cancelado - ${solicitud.codigo}`,
        html: `
          <h2>Proyecto Cancelado</h2>
          <p>Estimado/a ${solicitanteNombre},</p>
          <p>Lamentamos informarle que el proyecto <strong>${solicitud.codigo}</strong> ha sido cancelado.</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <p>Si tiene preguntas, por favor contacte al departamento de Nuevas Tecnologías.</p>
        `
      }).catch(err => logger.error('Error sending cancellation email:', err));
    }

    logger.info(`Project ${solicitud.codigo} cancelled by ${req.user.email}: ${motivo}`);

    res.json({
      message: 'Proyecto cancelado',
      solicitud: {
        id,
        codigo: solicitud.codigo,
        estado: 'cancelado'
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/:codigo/pausas - Get pause history
router.get('/:codigo/pausas', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    const result = await pool.query(
      `SELECT pp.*, u.nombre as creado_por_nombre
       FROM proyecto_pausas pp
       LEFT JOIN usuarios u ON pp.creado_por = u.id
       WHERE pp.solicitud_id = $1
       ORDER BY pp.fecha_inicio DESC`,
      [id]
    );

    // Calculate active pause days if any
    let pausaActiva = null;
    for (const pausa of result.rows) {
      if (!pausa.fecha_fin) {
        pausaActiva = {
          ...pausa,
          dias_transcurridos: Math.ceil((new Date() - new Date(pausa.fecha_inicio)) / (1000 * 60 * 60 * 24))
        };
        break;
      }
    }

    res.json({
      pausas: result.rows,
      pausa_activa: pausaActiva
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/:codigo/progreso - Get project progress data
router.get('/:codigo/progreso', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getSolicitudIdByCodigo(codigo);

    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    // Get evaluation and cronograma
    const evaluacionResult = await pool.query(
      `SELECT e.*, u.nombre as lider_nombre
       FROM evaluaciones_nt e
       LEFT JOIN usuarios u ON e.lider_id = u.id
       WHERE e.solicitud_id = $1 AND e.estado = 'enviado'`,
      [id]
    );
    const evaluacion = evaluacionResult.rows[0];

    // Get cronograma
    const cronogramaResult = await pool.query(
      'SELECT * FROM cronogramas WHERE solicitud_id = $1',
      [id]
    );
    const cronograma = cronogramaResult.rows[0];

    // Get tasks with assignee info
    let tareas = [];
    if (cronograma) {
      const tareasResult = await pool.query(
        `SELECT ct.*, u.nombre as asignado_nombre
         FROM cronograma_tareas ct
         LEFT JOIN usuarios u ON ct.asignado_id = u.id
         WHERE ct.cronograma_id = $1
         ORDER BY ct.fase, ct.orden, ct.fecha_inicio`,
        [cronograma.id]
      );
      tareas = tareasResult.rows;
    }

    // Calculate theoretical progress
    let progresoTeorico = 0;
    if (solicitud.fecha_inicio_desarrollo && solicitud.fecha_inicio_programada && solicitud.fecha_fin_programada) {
      const fechaInicio = new Date(solicitud.fecha_inicio_desarrollo);
      const diasPlanificados = Math.ceil(
        (new Date(solicitud.fecha_fin_programada) - new Date(solicitud.fecha_inicio_programada)) / (1000 * 60 * 60 * 24)
      );
      const diasPausados = solicitud.dias_pausados_total || 0;
      const diasEnDesarrollo = Math.max(0, Math.ceil((new Date() - fechaInicio) / (1000 * 60 * 60 * 24)) - diasPausados);

      if (diasPlanificados > 0) {
        progresoTeorico = Math.min(100, Math.round((diasEnDesarrollo / diasPlanificados) * 100));
      }
    }

    // Calculate practical progress (weighted average)
    let progresoPractico = 0;
    if (tareas.length > 0) {
      const totalPesoProgreso = tareas.reduce((sum, t) => sum + ((t.progreso || 0) * (t.duracion_dias || 1)), 0);
      const totalPeso = tareas.reduce((sum, t) => sum + (t.duracion_dias || 1), 0);
      if (totalPeso > 0) {
        progresoPractico = Math.round(totalPesoProgreso / totalPeso);
      }
    }

    // Group tasks by phase
    const tareasPorFase = {};
    for (const tarea of tareas) {
      const fase = tarea.fase || 'Sin Fase';
      if (!tareasPorFase[fase]) {
        tareasPorFase[fase] = [];
      }
      tareasPorFase[fase].push(tarea);
    }

    // Get pause info
    const pausasResult = await pool.query(
      `SELECT * FROM proyecto_pausas WHERE solicitud_id = $1 ORDER BY fecha_inicio DESC`,
      [id]
    );
    const pausas = pausasResult.rows;
    const pausaActiva = pausas.find(p => !p.fecha_fin);

    res.json({
      solicitud: {
        id: solicitud.id,
        codigo: solicitud.codigo,
        titulo: solicitud.titulo,
        estado: solicitud.estado,
        fecha_inicio_programada: solicitud.fecha_inicio_programada,
        fecha_fin_programada: solicitud.fecha_fin_programada,
        fecha_inicio_desarrollo: solicitud.fecha_inicio_desarrollo,
        dias_pausados_total: solicitud.dias_pausados_total || 0
      },
      evaluacion,
      cronograma,
      tareas,
      tareas_por_fase: tareasPorFase,
      progreso_teorico: progresoTeorico,
      progreso_practico: progresoPractico,
      total_tareas: tareas.length,
      tareas_completadas: tareas.filter(t => t.completado).length,
      tareas_emergentes: tareas.filter(t => t.es_emergente).length,
      pausas,
      pausa_activa: pausaActiva
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/solicitudes/:codigo/tareas/:tareaId/progreso - Update task progress
router.put('/:codigo/tareas/:tareaId/progreso', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo, tareaId } = req.params;
    const { progreso } = req.body;
    const id = await getSolicitudIdByCodigo(codigo);

    if (progreso === undefined || progreso < 0 || progreso > 100) {
      throw new AppError('El progreso debe ser un número entre 0 y 100', 400);
    }

    // Get the task and verify it belongs to this solicitud
    const taskResult = await pool.query(
      `SELECT ct.*, c.solicitud_id
       FROM cronograma_tareas ct
       JOIN cronogramas c ON c.id = ct.cronograma_id
       WHERE ct.id = $1 AND c.solicitud_id = $2`,
      [tareaId, id]
    );

    if (taskResult.rows.length === 0) {
      throw new AppError('Tarea no encontrada', 404);
    }

    const tarea = taskResult.rows[0];

    // Check if user can edit this task (assigned to them or is lead)
    const evaluacionResult = await pool.query(
      'SELECT lider_id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado = $2',
      [id, 'enviado']
    );
    const liderId = evaluacionResult.rows[0]?.lider_id;

    // Check if user is assigned to this task (asignado_id or in asignados_ids)
    const isAssigned = tarea.asignado_id === req.user.id ||
      (tarea.asignados_ids && tarea.asignados_ids.includes(req.user.id));
    const isLead = liderId === req.user.id;

    if (!isAssigned && !isLead) {
      throw new AppError('Solo puede actualizar tareas asignadas a usted o si es el líder del proyecto', 403);
    }

    // Update task progress
    const completado = progreso === 100;
    const result = await pool.query(
      `UPDATE cronograma_tareas SET progreso = $1, completado = $2 WHERE id = $3 RETURNING *`,
      [progreso, completado, tareaId]
    );

    logger.info(`Task ${tareaId} progress updated to ${progreso}% by ${req.user.email}`);

    res.json({
      message: 'Progreso actualizado',
      tarea: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/solicitudes/:codigo/tareas-emergentes - Add emergent task
router.post('/:codigo/tareas-emergentes', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const { nombre, duracion_dias, asignado_id, descripcion } = req.body;
    const id = await getSolicitudIdByCodigo(codigo);

    if (!nombre || !duracion_dias) {
      throw new AppError('El nombre y duración son requeridos', 400);
    }

    // Get solicitud and verify it's in desarrollo
    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = solicitudResult.rows[0];

    if (solicitud.estado !== 'en_desarrollo') {
      throw new AppError('Solo se pueden agregar tareas emergentes a proyectos en desarrollo', 400);
    }

    // Get the cronograma
    const cronogramaResult = await pool.query(
      'SELECT id FROM cronogramas WHERE solicitud_id = $1',
      [id]
    );

    if (cronogramaResult.rows.length === 0) {
      throw new AppError('No se encontró cronograma para este proyecto', 404);
    }

    const cronogramaId = cronogramaResult.rows[0].id;

    // Calculate dates (start today, end based on duration)
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + parseInt(duracion_dias));

    // Create emergent task
    const result = await pool.query(
      `INSERT INTO cronograma_tareas (
        cronograma_id, nombre, titulo, descripcion, duracion_dias,
        fecha_inicio, fecha_fin, asignado_id, es_emergente, fase, progreso
      ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, true, 'Tareas Emergentes', 0)
      RETURNING *`,
      [cronogramaId, nombre, descripcion || '', duracion_dias, fechaInicio, fechaFin, asignado_id || null]
    );

    const tarea = result.rows[0];

    // Get assignee name if any
    if (tarea.asignado_id) {
      const userResult = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [tarea.asignado_id]);
      tarea.asignado_nombre = userResult.rows[0]?.nombre;
    }

    // Add comment
    await pool.query(
      `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
       VALUES ('solicitud', $1, $2, $3, 'tarea_emergente', true)`,
      [id, req.user.id, `Tarea emergente agregada: ${nombre} (${duracion_dias} días)`]
    );

    logger.info(`Emergent task added to ${codigo}: ${nombre} by ${req.user.email}`);

    res.status(201).json({
      message: 'Tarea emergente creada',
      tarea
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/proyecto/consulta/:codigo - Public project consultation
router.get('/proyecto/consulta/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;

    // Try to find by project code first (PRY-xxxx), then by solicitud code
    let solicitud;
    if (codigo.toUpperCase().startsWith('PRY-')) {
      const proyectoResult = await pool.query(
        'SELECT solicitud_id FROM proyectos WHERE codigo = $1',
        [codigo.toUpperCase()]
      );
      if (proyectoResult.rows.length === 0) {
        throw new AppError('Proyecto no encontrado', 404);
      }
      const solicitudResult = await pool.query(
        'SELECT * FROM solicitudes WHERE id = $1',
        [proyectoResult.rows[0].solicitud_id]
      );
      solicitud = solicitudResult.rows[0];
    } else {
      const solicitudResult = await pool.query(
        'SELECT * FROM solicitudes WHERE codigo = $1',
        [codigo.toUpperCase()]
      );
      solicitud = solicitudResult.rows[0];
    }

    if (!solicitud) {
      throw new AppError('Proyecto no encontrado', 404);
    }

    // Verify it's a project type
    if (!['proyecto_nuevo_interno', 'actualizacion'].includes(solicitud.tipo)) {
      throw new AppError('El código no corresponde a un proyecto', 400);
    }

    // Get project code
    const proyectoResult = await pool.query(
      'SELECT codigo FROM proyectos WHERE solicitud_id = $1',
      [solicitud.id]
    );
    const proyectoCodigo = proyectoResult.rows[0]?.codigo;

    // Get cronograma and tasks for progress
    const cronogramaResult = await pool.query(
      'SELECT id FROM cronogramas WHERE solicitud_id = $1',
      [solicitud.id]
    );

    let progresoPractico = 0;
    let totalTareas = 0;
    let tareasCompletadas = 0;

    if (cronogramaResult.rows.length > 0) {
      const tareasResult = await pool.query(
        `SELECT progreso, duracion_dias, completado FROM cronograma_tareas WHERE cronograma_id = $1`,
        [cronogramaResult.rows[0].id]
      );

      totalTareas = tareasResult.rows.length;
      tareasCompletadas = tareasResult.rows.filter(t => t.completado).length;

      if (tareasResult.rows.length > 0) {
        const totalPesoProgreso = tareasResult.rows.reduce((sum, t) => sum + ((t.progreso || 0) * (t.duracion_dias || 1)), 0);
        const totalPeso = tareasResult.rows.reduce((sum, t) => sum + (t.duracion_dias || 1), 0);
        if (totalPeso > 0) {
          progresoPractico = Math.round(totalPesoProgreso / totalPeso);
        }
      }
    }

    // Check if paused
    const pausaResult = await pool.query(
      `SELECT motivo, fecha_inicio FROM proyecto_pausas WHERE solicitud_id = $1 AND fecha_fin IS NULL`,
      [solicitud.id]
    );
    const isPaused = pausaResult.rows.length > 0;

    // Get public-friendly estado
    const estadoLabels = {
      agendado: 'Programado',
      en_desarrollo: 'En Desarrollo',
      pausado: 'Pausado',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    res.json({
      proyecto: {
        codigo: proyectoCodigo || solicitud.codigo,
        solicitud_codigo: solicitud.codigo,
        titulo: solicitud.titulo,
        estado: estadoLabels[solicitud.estado] || solicitud.estado,
        estado_interno: solicitud.estado,
        fecha_inicio_programada: solicitud.fecha_inicio_programada,
        fecha_fin_programada: solicitud.fecha_fin_programada,
        progreso: progresoPractico,
        total_tareas: totalTareas,
        tareas_completadas: tareasCompletadas,
        is_paused: isPaused,
        pause_reason: isPaused ? pausaResult.rows[0].motivo : null,
        pause_since: isPaused ? pausaResult.rows[0].fecha_inicio : null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
