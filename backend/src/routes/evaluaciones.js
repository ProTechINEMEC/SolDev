const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createEvaluacionSchema = Joi.object({
  solicitud_id: Joi.number().integer().optional(),
  solicitud_codigo: Joi.string().optional(),
  resumen_ejecutivo: Joi.string().required(),
  recomendacion: Joi.string().valid('aprobar', 'rechazar', 'aplazar').required(),
  justificacion_recomendacion: Joi.string().required(),
  riesgos_identificados: Joi.array().items(Joi.string()).optional(),
  notas_adicionales: Joi.string().allow('', null).optional(),
  fecha_inicio_posible: Joi.date().allow(null).optional()
}).or('solicitud_id', 'solicitud_codigo');

// Helper to get solicitud ID from codigo
const getSolicitudIdByCodigo = async (codigo) => {
  const result = await pool.query('SELECT id FROM solicitudes WHERE codigo = $1', [codigo]);
  if (result.rows.length === 0) {
    throw new AppError('Solicitud no encontrada', 404);
  }
  return result.rows[0].id;
};

const updateEvaluacionSchema = Joi.object({
  resumen_ejecutivo: Joi.string().optional(),
  recomendacion: Joi.string().valid('aprobar', 'rechazar', 'aplazar').optional(),
  justificacion_recomendacion: Joi.string().optional(),
  riesgos_identificados: Joi.array().items(Joi.string()).optional(),
  notas_adicionales: Joi.string().allow('', null).optional(),
  fecha_inicio_posible: Joi.date().allow(null).optional()
});

// GET /api/evaluaciones - List evaluations
router.get('/', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { solicitud_id, estado, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT e.*,
        s.codigo as solicitud_codigo,
        s.titulo as solicitud_titulo,
        u.nombre as evaluador_nombre
      FROM evaluaciones_nt e
      JOIN solicitudes s ON e.solicitud_id = s.id
      LEFT JOIN usuarios u ON e.evaluador_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (solicitud_id) {
      query += ` AND e.solicitud_id = $${paramIndex++}`;
      params.push(solicitud_id);
    }

    if (estado) {
      query += ` AND e.estado = $${paramIndex++}`;
      params.push(estado);
    }

    // Count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY e.creado_en DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      evaluaciones: result.rows,
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

// GET /api/evaluaciones/solicitud/:param - Get evaluation by solicitud ID or codigo
// Accepts both numeric ID (e.g., 33) and codigo (e.g., SOL-2026-0033 or PRY-2026-0001)
router.get('/solicitud/:param', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { param } = req.params;
    let solicitudId;

    // Check if param is a codigo (starts with SOL- or PRY-) or a numeric ID
    const upperParam = param.toUpperCase();
    if (upperParam.startsWith('SOL-') || upperParam.startsWith('PRY-')) {
      // It's a codigo - need to resolve to solicitud_id
      if (upperParam.startsWith('PRY-')) {
        // Look up from proyectos table
        const proyectoResult = await pool.query(
          'SELECT solicitud_id FROM proyectos WHERE codigo = $1',
          [upperParam]
        );
        if (proyectoResult.rows.length === 0) {
          // Return empty evaluation if project not found
          return res.json({ evaluacion: null, cronograma: null, tareas: [], estimacion: null, equipo: [] });
        }
        solicitudId = proyectoResult.rows[0].solicitud_id;
      } else {
        // Look up from solicitudes table
        const solicitudResult = await pool.query(
          'SELECT id FROM solicitudes WHERE codigo = $1',
          [upperParam]
        );
        if (solicitudResult.rows.length === 0) {
          return res.json({ evaluacion: null, cronograma: null, tareas: [], estimacion: null, equipo: [] });
        }
        solicitudId = solicitudResult.rows[0].id;
      }
    } else {
      // It's a numeric ID
      solicitudId = parseInt(param, 10);
      if (isNaN(solicitudId)) {
        return res.json({ evaluacion: null, cronograma: null, tareas: [], estimacion: null, equipo: [] });
      }
    }

    const result = await pool.query(
      `SELECT e.*,
        s.codigo as solicitud_codigo,
        s.titulo as solicitud_titulo,
        s.tipo as solicitud_tipo,
        s.prioridad as solicitud_prioridad,
        u.nombre as evaluador_nombre,
        l.nombre as lider_nombre
       FROM evaluaciones_nt e
       JOIN solicitudes s ON e.solicitud_id = s.id
       LEFT JOIN usuarios u ON e.evaluador_id = u.id
       LEFT JOIN usuarios l ON e.lider_id = l.id
       WHERE e.solicitud_id = $1
       ORDER BY e.creado_en DESC
       LIMIT 1`,
      [solicitudId]
    );

    if (result.rows.length === 0) {
      return res.json({ evaluacion: null, cronograma: null, tareas: [], estimacion: null, equipo: [] });
    }

    const evaluacion = result.rows[0];

    // Get cronograma - check both by solicitud_id and evaluacion_id
    let cronogramaResult = await pool.query(
      `SELECT * FROM cronogramas WHERE solicitud_id = $1`,
      [solicitudId]
    );

    // If not found by solicitud_id, try by evaluacion_id
    if (cronogramaResult.rows.length === 0) {
      cronogramaResult = await pool.query(
        `SELECT * FROM cronogramas WHERE evaluacion_id = $1`,
        [evaluacion.id]
      );
    }
    const cronograma = cronogramaResult.rows[0] || null;

    // Get tasks if cronograma exists
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

    // Get cost estimation
    const estimacionResult = await pool.query(
      `SELECT * FROM estimaciones_costo WHERE evaluacion_id = $1`,
      [evaluacion.id]
    );
    const estimacion = estimacionResult.rows[0] || null;

    // Get team assignments
    const equipoResult = await pool.query(
      `SELECT ea.*, u.nombre as usuario_nombre, u.email as usuario_email
       FROM evaluacion_asignaciones ea
       JOIN usuarios u ON ea.usuario_id = u.id
       WHERE ea.evaluacion_id = $1
       ORDER BY ea.es_lider DESC, u.nombre`,
      [evaluacion.id]
    );
    const equipo = equipoResult.rows;

    res.json({
      evaluacion,
      cronograma,
      tareas,
      estimacion,
      equipo
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/evaluaciones/:id - Get single evaluation with all related data
router.get('/:id', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT e.*,
        s.codigo as solicitud_codigo,
        s.titulo as solicitud_titulo,
        s.tipo as solicitud_tipo,
        s.prioridad as solicitud_prioridad,
        u.nombre as evaluador_nombre
       FROM evaluaciones_nt e
       JOIN solicitudes s ON e.solicitud_id = s.id
       LEFT JOIN usuarios u ON e.evaluador_id = u.id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Evaluación no encontrada', 404);
    }

    const evaluacion = result.rows[0];

    // Get cronograma
    const cronograma = await pool.query(
      `SELECT * FROM cronogramas WHERE evaluacion_id = $1`,
      [id]
    );

    // Get cronograma tasks
    let tareas = [];
    if (cronograma.rows.length > 0) {
      const tareasResult = await pool.query(
        `SELECT * FROM cronograma_tareas
         WHERE cronograma_id = $1
         ORDER BY orden`,
        [cronograma.rows[0].id]
      );
      tareas = tareasResult.rows;
    }

    // Get cost estimation
    const estimacion = await pool.query(
      `SELECT * FROM estimaciones_costo WHERE evaluacion_id = $1`,
      [id]
    );

    // Get team assignments
    const equipo = await pool.query(
      `SELECT ea.*, u.nombre as usuario_nombre, u.email as usuario_email
       FROM evaluacion_asignaciones ea
       JOIN usuarios u ON ea.usuario_id = u.id
       WHERE ea.evaluacion_id = $1
       ORDER BY ea.es_lider DESC, u.nombre`,
      [id]
    );

    res.json({
      evaluacion,
      cronograma: cronograma.rows[0] || null,
      tareas,
      estimacion: estimacion.rows[0] || null,
      equipo: equipo.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/evaluaciones - Create evaluation
router.post('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { error, value } = createEvaluacionSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Get solicitud_id from codigo if provided
    let solicitudId = value.solicitud_id;
    if (value.solicitud_codigo && !solicitudId) {
      solicitudId = await getSolicitudIdByCodigo(value.solicitud_codigo);
    }

    if (!solicitudId) {
      throw new AppError('Se requiere solicitud_id o solicitud_codigo', 400);
    }

    // Check solicitud exists and is in correct state
    const solicitudResult = await pool.query(
      'SELECT * FROM solicitudes WHERE id = $1',
      [solicitudId]
    );

    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }

    const solicitud = solicitudResult.rows[0];
    if (!['en_estudio', 'pendiente_reevaluacion'].includes(solicitud.estado)) {
      throw new AppError('La solicitud no está en un estado válido para evaluación', 400);
    }

    // Check if evaluation already exists
    const existingEval = await pool.query(
      'SELECT id FROM evaluaciones_nt WHERE solicitud_id = $1 AND estado != $2',
      [solicitudId, 'descartado']
    );

    if (existingEval.rows.length > 0) {
      throw new AppError('Ya existe una evaluación activa para esta solicitud', 400);
    }

    const result = await pool.query(
      `INSERT INTO evaluaciones_nt (
        solicitud_id, evaluador_id, resumen_ejecutivo,
        recomendacion, justificacion_recomendacion,
        riesgos_identificados, notas_adicionales, fecha_inicio_posible, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'borrador')
      RETURNING *`,
      [
        solicitudId,
        req.user.id,
        value.resumen_ejecutivo,
        value.recomendacion,
        value.justificacion_recomendacion,
        JSON.stringify(value.riesgos_identificados || []),
        value.notas_adicionales,
        value.fecha_inicio_posible || null
      ]
    );

    logger.info(`Evaluation created for solicitud ${solicitud.codigo} by ${req.user.email}`);

    res.status(201).json({
      message: 'Evaluación creada',
      evaluacion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/evaluaciones/:id - Update evaluation
router.put('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateEvaluacionSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check evaluation exists and is editable
    const existing = await pool.query(
      'SELECT * FROM evaluaciones_nt WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Evaluación no encontrada', 404);
    }

    if (existing.rows[0].estado !== 'borrador') {
      throw new AppError('Solo se pueden editar evaluaciones en estado borrador', 400);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (value.resumen_ejecutivo !== undefined) {
      updates.push(`resumen_ejecutivo = $${paramIndex++}`);
      params.push(value.resumen_ejecutivo);
    }
    if (value.recomendacion !== undefined) {
      updates.push(`recomendacion = $${paramIndex++}`);
      params.push(value.recomendacion);
    }
    if (value.justificacion_recomendacion !== undefined) {
      updates.push(`justificacion_recomendacion = $${paramIndex++}`);
      params.push(value.justificacion_recomendacion);
    }
    if (value.riesgos_identificados !== undefined) {
      updates.push(`riesgos_identificados = $${paramIndex++}`);
      params.push(JSON.stringify(value.riesgos_identificados));
    }
    if (value.notas_adicionales !== undefined) {
      updates.push(`notas_adicionales = $${paramIndex++}`);
      params.push(value.notas_adicionales);
    }
    if (value.fecha_inicio_posible !== undefined) {
      updates.push(`fecha_inicio_posible = $${paramIndex++}`);
      params.push(value.fecha_inicio_posible || null);
    }

    if (updates.length === 0) {
      throw new AppError('No hay campos para actualizar', 400);
    }

    updates.push(`actualizado_en = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE evaluaciones_nt SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json({
      message: 'Evaluación actualizada',
      evaluacion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/evaluaciones/:id/lider - Set project leader
router.put('/:id/lider', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) {
      throw new AppError('Se requiere usuario_id', 400);
    }

    // Check evaluation exists and is editable
    const existing = await pool.query(
      'SELECT * FROM evaluaciones_nt WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Evaluación no encontrada', 404);
    }

    if (existing.rows[0].estado !== 'borrador') {
      throw new AppError('Solo se puede modificar evaluaciones en estado borrador', 400);
    }

    // Check user exists and is NT
    const userCheck = await pool.query(
      'SELECT id, nombre FROM usuarios WHERE id = $1 AND rol = $2 AND activo = true',
      [usuario_id, 'nuevas_tecnologias']
    );

    if (userCheck.rows.length === 0) {
      throw new AppError('Usuario no encontrado o no es de NT', 404);
    }

    await withTransaction(async (client) => {
      // Remove existing leader
      await client.query(
        `UPDATE evaluacion_asignaciones SET es_lider = false WHERE evaluacion_id = $1`,
        [id]
      );

      // Check if user is already assigned
      const existingAssign = await client.query(
        'SELECT id FROM evaluacion_asignaciones WHERE evaluacion_id = $1 AND usuario_id = $2',
        [id, usuario_id]
      );

      if (existingAssign.rows.length > 0) {
        // Update to leader
        await client.query(
          `UPDATE evaluacion_asignaciones SET es_lider = true WHERE evaluacion_id = $1 AND usuario_id = $2`,
          [id, usuario_id]
        );
      } else {
        // Insert as leader
        await client.query(
          `INSERT INTO evaluacion_asignaciones (evaluacion_id, usuario_id, rol, es_lider)
           VALUES ($1, $2, 'Líder del Proyecto', true)`,
          [id, usuario_id]
        );
      }
    });

    logger.info(`Project leader set for evaluation ${id}: user ${usuario_id}`);

    res.json({
      message: 'Líder del proyecto asignado',
      lider: userCheck.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/evaluaciones/:id/enviar - Submit evaluation to gerencia
router.post('/:id/enviar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get evaluation with related data
    const evalResult = await pool.query(
      `SELECT e.*, s.id as solicitud_id, s.codigo as solicitud_codigo
       FROM evaluaciones_nt e
       JOIN solicitudes s ON e.solicitud_id = s.id
       WHERE e.id = $1`,
      [id]
    );

    if (evalResult.rows.length === 0) {
      throw new AppError('Evaluación no encontrada', 404);
    }

    const evaluacion = evalResult.rows[0];

    if (evaluacion.estado !== 'borrador') {
      throw new AppError('Solo se pueden enviar evaluaciones en estado borrador', 400);
    }

    // Check required components exist
    const cronograma = await pool.query(
      'SELECT id FROM cronogramas WHERE evaluacion_id = $1',
      [id]
    );

    if (cronograma.rows.length === 0) {
      throw new AppError('Debe agregar un cronograma antes de enviar', 400);
    }

    const estimacion = await pool.query(
      'SELECT id FROM estimaciones_costo WHERE evaluacion_id = $1',
      [id]
    );

    if (estimacion.rows.length === 0) {
      throw new AppError('Debe agregar una estimación de costos antes de enviar', 400);
    }

    await withTransaction(async (client) => {
      // Update evaluation state
      await client.query(
        `UPDATE evaluaciones_nt SET estado = 'enviado', fecha_envio = NOW(), actualizado_en = NOW()
         WHERE id = $1`,
        [id]
      );

      // Update solicitud state
      await client.query(
        `UPDATE solicitudes SET estado = 'pendiente_aprobacion_gerencia', actualizado_en = NOW()
         WHERE id = $1`,
        [evaluacion.solicitud_id]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_id)
         VALUES ('solicitud', $1, 'enviar_a_gerencia', $2, $3)`,
        [
          evaluacion.solicitud_id,
          JSON.stringify({ evaluacion_id: id }),
          req.user.id
        ]
      );

      // Notify gerencia
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'aprobacion_pendiente', 'Solicitud pendiente de aprobación',
           $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `La solicitud ${evaluacion.solicitud_codigo} está lista para su aprobación`,
          JSON.stringify({
            solicitud_id: evaluacion.solicitud_id,
            evaluacion_id: id,
            codigo: evaluacion.solicitud_codigo
          })
        ]
      );
    });

    logger.info(`Evaluation ${id} sent to gerencia for solicitud ${evaluacion.solicitud_codigo}`);

    res.json({
      message: 'Evaluación enviada a Gerencia',
      evaluacion: { id, estado: 'enviado' }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
