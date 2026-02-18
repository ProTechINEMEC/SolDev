const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
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
  es_doliente: Joi.boolean().required()
});

// Section 2: Sponsor (conditional - only if es_doliente = false)
const sponsorSchema = Joi.object({
  nombre_completo: Joi.string().required(),
  cargo: Joi.string().required(),
  area: Joi.string().required(),
  correo: Joi.string().email().required()
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

// Section 7: Beneficios
const beneficiosSchema = Joi.object({
  descripcion: Joi.string().allow('', null).optional(),
  mejora_concreta: Joi.string().allow('', null).optional(),
  procesos_optimizados: Joi.array().items(Joi.string()).optional(),
  reduccion_costos: Joi.boolean().optional(),
  reduccion_costos_descripcion: Joi.string().allow('', null).optional(),
  costos_descripcion: Joi.string().allow('', null).optional() // Alternative frontend field name
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

// REPORTE FALLO (3 sections)
const reporteFalloSchema = Joi.object({
  tipo: Joi.string().valid('reporte_fallo').required(),
  titulo: Joi.string().min(5).max(200).required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),
  solicitante_session_token: Joi.string().optional(),
  identificacion: identificacionSchema.required(),
  reporte: Joi.object({
    descripcion: Joi.string().required()
  }).required(),
  criticidad: Joi.object({
    urgencia: Joi.string().valid('baja', 'media', 'alta', 'critica').required(),
    justificacion: Joi.string().required()
  }).required()
});

// CIERRE SERVICIO (4 sections)
const cierreServicioSchema = Joi.object({
  tipo: Joi.string().valid('cierre_servicio').required(),
  titulo: Joi.string().min(5).max(200).required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),
  solicitante_session_token: Joi.string().optional(),
  identificacion: identificacionSchema.required(),
  razonamiento: Joi.object({
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

// PROYECTO NUEVO INTERNO / ACTUALIZACION (10 sections)
const proyectoFullSchema = Joi.object({
  tipo: Joi.string().valid('proyecto_nuevo_interno', 'actualizacion').required(),
  titulo: Joi.string().min(5).max(200).required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),
  solicitante_session_token: Joi.string().optional(),
  identificacion: identificacionSchema.required(),
  // Sponsor is optional in schema - we validate conditionally in route handler
  sponsor: sponsorSchema.optional().allow(null),
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

    // Role-based filtering
    if (req.user.rol === 'gerencia') {
      // Gerencia only sees requests pending their approval or approved
      query += ` AND s.estado::text IN ('pendiente_aprobacion_gerencia', 'aprobado', 'en_desarrollo', 'completado')`;
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

// GET /api/solicitudes/:id - Get single request
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if id is numeric or a code string
    const isNumeric = /^\d+$/.test(id);
    const whereClause = isNumeric ? 's.id = $1' : 's.codigo = $1';

    const result = await pool.query(
      `SELECT s.*,
        sol.nombre as solicitante_nombre,
        sol.email as solicitante_email,
        u.nombre as evaluador_nombre
       FROM solicitudes s
       LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
       LEFT JOIN usuarios u ON s.evaluador_id = u.id
       WHERE ${whereClause}`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = result.rows[0];

    // Get comments
    const comentarios = await pool.query(
      `SELECT c.*, u.nombre as autor_nombre, u.rol as autor_rol
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.entidad_tipo = 'solicitud' AND c.entidad_id = $1
       ORDER BY c.creado_en DESC`,
      [solicitud.id]
    );

    // Get files
    const archivos = await pool.query(
      `SELECT * FROM archivos
       WHERE entidad_tipo = 'solicitud' AND entidad_id = $1`,
      [solicitud.id]
    );

    res.json({
      solicitud,
      comentarios: comentarios.rows,
      archivos: archivos.rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/solicitudes/:id/estado - Change request state
router.put('/:id/estado', authenticate, authorize('nuevas_tecnologias', 'gerencia', 'ti'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('ID de solicitud inválido', 400);
    }
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

      // Add comment if provided
      if (value.comentario) {
        await client.query(
          `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
           VALUES ('solicitud', $1, $2, $3, 'cambio_estado')`,
          [id, req.user.id, value.comentario]
        );
      }

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

// POST /api/solicitudes/:id/comentarios - Add comment
router.post('/:id/comentarios', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenido, interno = false } = req.body;

    if (!contenido || contenido.trim().length === 0) {
      throw new AppError('El comentario no puede estar vacío', 400);
    }

    // Verify solicitud exists
    const solicitudResult = await pool.query(
      'SELECT id, codigo FROM solicitudes WHERE id = $1',
      [id]
    );

    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const result = await pool.query(
      `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, interno)
       VALUES ('solicitud', $1, $2, $3, $4)
       RETURNING *`,
      [id, req.user.id, contenido.trim(), interno]
    );

    res.status(201).json({
      message: 'Comentario agregado',
      comentario: {
        ...result.rows[0],
        autor_nombre: req.user.nombre,
        autor_rol: req.user.rol
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/solicitudes/:id/historial - Get request history
router.get('/:id/historial', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

// GET /api/solicitudes/consulta/:codigo - Public status check
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
      transferencia: transferInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/solicitudes/:id/agendar - Gerencia schedules an approved project
router.post('/:id/agendar', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;
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
    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

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

// POST /api/solicitudes/:id/solicitar-reevaluacion - Gerencia requests reevaluation from NT
router.post('/:id/solicitar-reevaluacion', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comentario, areas_revisar } = req.body;

    if (!comentario || comentario.trim().length === 0) {
      throw new AppError('Debe proporcionar comentarios para la reevaluación', 400);
    }

    // Get the solicitud
    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

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

// GET /api/solicitudes/:id/reevaluaciones - Get reevaluation history
router.get('/:id/reevaluaciones', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;

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

// POST /api/solicitudes/:id/transferir-ti - Transfer solicitud to TI as a new ticket
router.post('/:id/transferir-ti', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('ID de solicitud inválido', 400);
    }
    const { motivo } = req.body;

    if (!motivo || motivo.trim().length === 0) {
      throw new AppError('Debe proporcionar un motivo para la transferencia', 400);
    }

    // Get the solicitud
    const solicitudResult = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

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
          `[Transferido de ${solicitud.codigo}] ${solicitud.titulo}`,
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

module.exports = router;
