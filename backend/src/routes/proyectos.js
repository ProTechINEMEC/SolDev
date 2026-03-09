const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { uploadMultiple } = require('../config/multer');
const emailService = require('../services/email');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { getWorkdaysBetween, addWorkdays, calculateEndDate, getColombianHolidays, getHolidayList, getNextWorkday, isWorkday } = require('../utils/workdays');

const router = express.Router();

// =============================================================================
// HELPERS
// =============================================================================

const getProyectoByCode = async (codigo) => {
  const result = await pool.query(
    `SELECT p.*, s.codigo as solicitud_codigo, s.datos_solicitante,
            s.estado as solicitud_estado
     FROM proyectos p
     LEFT JOIN solicitudes s ON p.solicitud_id = s.id
     WHERE p.codigo = $1`,
    [codigo]
  );
  if (result.rows.length === 0) throw new AppError('Proyecto no encontrado', 404);
  return result.rows[0];
};

const isProjectLead = async (proyectoId, userId) => {
  const result = await pool.query(
    `SELECT es_lider FROM proyecto_miembros WHERE proyecto_id = $1 AND usuario_id = $2 AND es_lider = true`,
    [proyectoId, userId]
  );
  return result.rows.length > 0;
};

const requireLead = async (proyecto, userId, userRol) => {
  if (userRol === 'gerencia') return;
  const lead = await isProjectLead(proyecto.id, userId);
  if (!lead && proyecto.responsable_id !== userId) {
    throw new AppError('Solo el líder del proyecto puede realizar esta acción', 403);
  }
};

const logEmergentChange = async (client, proyectoId, tipoCambio, entidadTipo, entidadId, valorAnterior, valorNuevo, justificacion, usuarioId) => {
  await client.query(
    `INSERT INTO proyecto_cambios_emergentes (proyecto_id, tipo_cambio, entidad_tipo, entidad_id, valor_anterior, valor_nuevo, justificacion, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [proyectoId, tipoCambio, entidadTipo, entidadId, valorAnterior ? JSON.stringify(valorAnterior) : null, valorNuevo ? JSON.stringify(valorNuevo) : null, justificacion, usuarioId]
  );
};

const syncSolicitudEstado = async (client, solicitudId, estado) => {
  if (!solicitudId) return;
  await client.query(
    `UPDATE solicitudes SET estado = $1, actualizado_en = NOW() WHERE id = $2`,
    [estado, solicitudId]
  );
};

// JS workday-aware progress calculations (replaced SQL functions)
const calculateTheoreticalProgress = (proyecto, tareas, pausas) => {
  if (!proyecto.fecha_inicio_desarrollo || !proyecto.fecha_inicio_estimada || !proyecto.fecha_fin_estimada) return 0;
  const today = new Date();
  const devStart = new Date(proyecto.fecha_inicio_desarrollo);
  if (today < devStart) return 0;

  // Total paused workdays (closed pauses + active pause)
  let pausedWorkdays = 0;
  for (const p of pausas) {
    const pStart = new Date(p.fecha_inicio);
    const pEnd = p.fecha_fin ? new Date(p.fecha_fin) : today;
    pausedWorkdays += getWorkdaysBetween(pStart, pEnd);
  }

  // Numerator: workdays elapsed since dev start minus paused workdays
  const elapsedWorkdays = getWorkdaysBetween(devStart, today) - pausedWorkdays;

  // Denominator: planned workdays + emergent task days
  const plannedWorkdays = getWorkdaysBetween(new Date(proyecto.fecha_inicio_estimada), new Date(proyecto.fecha_fin_estimada));
  const emergentDays = tareas.filter(t => t.es_emergente).reduce((sum, t) => sum + (t.duracion_dias || 0), 0);
  const denominator = plannedWorkdays + emergentDays - pausedWorkdays;

  if (denominator <= 0) return 0;
  return Math.min(100, Math.round((elapsedWorkdays / denominator) * 100));
};

const calculatePracticalProgress = (tareas) => {
  if (!tareas || tareas.length === 0) return 0;
  const totalWeight = tareas.reduce((sum, t) => sum + (t.duracion_dias || 1), 0);
  if (totalWeight === 0) return 0;
  const weightedProgress = tareas.reduce((sum, t) => sum + (t.progreso || 0) * (t.duracion_dias || 1), 0);
  return Math.round(weightedProgress / totalWeight);
};

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createTareaSchema = Joi.object({
  titulo: Joi.string().min(3).max(200).required(),
  descripcion: Joi.string().max(1000).allow('', null),
  fecha_inicio: Joi.date().required(),
  fecha_fin: Joi.date().min(Joi.ref('fecha_inicio')).allow(null),
  duracion_dias: Joi.number().integer().min(1).default(1),
  asignado_id: Joi.number().integer().allow(null),
  fase: Joi.string().max(50).allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#1890ff')
});

const updateProyectoSchema = Joi.object({
  titulo: Joi.string().min(5).max(200),
  descripcion: Joi.string().max(2000),
  fecha_inicio_estimada: Joi.date(),
  fecha_fin_estimada: Joi.date(),
  presupuesto_estimado: Joi.number().positive(),
  datos_proyecto: Joi.object()
});

const costoSchema = Joi.object({
  concepto: Joi.string().min(3).max(300).required(),
  descripcion: Joi.string().max(1000).allow('', null),
  subtotal: Joi.number().min(0).required(),
  iva: Joi.number().min(0).default(0),
  cantidad: Joi.number().integer().min(1).default(1),
  archivo_id: Joi.number().integer().allow(null)
});

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

// GET /api/proyectos/public
router.get('/public', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT codigo, titulo as nombre, estado FROM proyectos
       WHERE estado IN ('completado', 'en_desarrollo') ORDER BY titulo ASC`
    );
    res.json({ proyectos: result.rows });
  } catch (error) { next(error); }
});

// GET /api/proyectos/holidays/:year — Colombian holidays as ISO date strings
router.get('/holidays/:year', authenticate, (req, res) => {
  const year = parseInt(req.params.year);
  if (isNaN(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Año inválido' });
  }
  const holidays = getColombianHolidays(year).map(h => h.toISOString().split('T')[0]);
  res.json({ holidays });
});

// =============================================================================
// LIST & DETAIL
// =============================================================================

// GET /api/proyectos — enhanced with inline progress
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { estado, responsable_id, search, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT p.*,
        s.codigo as solicitud_codigo,
        s.tipo as solicitud_tipo,
        u.nombre as responsable_nombre,
        (SELECT motivo FROM proyecto_pausas WHERE proyecto_id = p.id AND fecha_fin IS NULL ORDER BY fecha_inicio DESC LIMIT 1) as motivo_pausa_actual,
        (SELECT u2.nombre FROM proyecto_miembros pm2 JOIN usuarios u2 ON u2.id = pm2.usuario_id
         WHERE pm2.proyecto_id = p.id AND pm2.es_lider = true LIMIT 1) as lider_nombre
      FROM proyectos p
      LEFT JOIN solicitudes s ON p.solicitud_id = s.id
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let pi = 1;

    if (estado) {
      const estados = estado.split(',');
      query += ` AND p.estado = ANY($${pi++})`;
      params.push(estados);
    }
    if (responsable_id) {
      query += ` AND p.responsable_id = $${pi++}`;
      params.push(responsable_id);
    }
    if (search) {
      query += ` AND (p.titulo ILIKE $${pi} OR p.codigo ILIKE $${pi})`;
      params.push(`%${search}%`);
      pi++;
    }
    if (req.user.rol === 'ti') {
      query += ` AND (p.responsable_id = $${pi} OR EXISTS (
        SELECT 1 FROM proyecto_miembros pm WHERE pm.proyecto_id = p.id AND pm.usuario_id = $${pi}
      ))`;
      params.push(req.user.id);
      pi++;
    }

    // NT users: only see projects where they are responsable or team member
    if (req.user.rol === 'nuevas_tecnologias') {
      // solo_lider=true: NT Implementación page — only projects where user is lead
      if (req.query.solo_lider === 'true') {
        query += ` AND EXISTS (
          SELECT 1 FROM proyecto_miembros pm
          WHERE pm.proyecto_id = p.id AND pm.usuario_id = $${pi} AND pm.es_lider = true
        )`;
      } else {
        query += ` AND (p.responsable_id = $${pi} OR EXISTS (
          SELECT 1 FROM proyecto_miembros pm WHERE pm.proyecto_id = p.id AND pm.usuario_id = $${pi}
        ))`;
      }
      params.push(req.user.id);
      pi++;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as sub`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY p.creado_en DESC LIMIT $${pi++} OFFSET $${pi++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    // Batch-calculate progress in JS for all fetched projects
    const proyectoIds = result.rows.map(p => p.id);
    let taskStats = {};
    let pausasMap = {};
    if (proyectoIds.length > 0) {
      const [taskRes, pausasRes] = await Promise.all([
        pool.query(
          `SELECT proyecto_id,
            SUM(duracion_dias) as total_dias,
            SUM(CASE WHEN es_emergente THEN duracion_dias ELSE 0 END) as emergent_dias,
            SUM(progreso * COALESCE(duracion_dias, 1)) as weighted_progress,
            SUM(COALESCE(duracion_dias, 1)) as total_weight,
            COUNT(*) as total_tareas,
            COUNT(*) FILTER (WHERE progreso = 100) as tareas_completadas
           FROM proyecto_tareas WHERE proyecto_id = ANY($1) GROUP BY proyecto_id`,
          [proyectoIds]
        ),
        pool.query(
          `SELECT proyecto_id, fecha_inicio, fecha_fin FROM proyecto_pausas WHERE proyecto_id = ANY($1)`,
          [proyectoIds]
        )
      ]);
      for (const r of taskRes.rows) taskStats[r.proyecto_id] = r;
      for (const r of pausasRes.rows) {
        if (!pausasMap[r.proyecto_id]) pausasMap[r.proyecto_id] = [];
        pausasMap[r.proyecto_id].push(r);
      }
    }

    const proyectos = result.rows.map(p => {
      const stats = taskStats[p.id] || { total_tareas: 0, tareas_completadas: 0, weighted_progress: 0, total_weight: 0 };
      const pausas = pausasMap[p.id] || [];
      return {
        ...p,
        progreso_teorico: calculateTheoreticalProgress(p, (taskStats[p.id] ? [{ es_emergente: true, duracion_dias: parseInt(stats.emergent_dias || 0) }] : []), pausas),
        progreso_practico: stats.total_weight > 0 ? Math.round(parseInt(stats.weighted_progress || 0) / parseInt(stats.total_weight)) : 0,
        total_tareas: parseInt(stats.total_tareas || 0),
        tareas_completadas: parseInt(stats.tareas_completadas || 0)
      };
    });

    res.json({
      proyectos,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) { next(error); }
});

// GET /api/proyectos/:codigo — enhanced with costos, cambios, estimacion
router.get('/:codigo', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const result = await pool.query(
      `SELECT p.*,
        s.codigo as solicitud_codigo, s.tipo as solicitud_tipo, s.datos_solicitante,
        u.nombre as responsable_nombre, u.email as responsable_email
       FROM proyectos p
       LEFT JOIN solicitudes s ON p.solicitud_id = s.id
       LEFT JOIN usuarios u ON p.responsable_id = u.id
       WHERE p.codigo = $1`,
      [codigo]
    );

    if (result.rows.length === 0) throw new AppError('Proyecto no encontrado', 404);
    const proyecto = result.rows[0];

    const [miembrosRes, tareasRes, comentariosRes, costosRes, cambiosRes, pausasRes, implTareasRes] = await Promise.all([
      pool.query(
        `SELECT pm.*, u.nombre, u.email, u.rol
         FROM proyecto_miembros pm JOIN usuarios u ON pm.usuario_id = u.id
         WHERE pm.proyecto_id = $1 ORDER BY pm.es_lider DESC, u.nombre`,
        [proyecto.id]
      ),
      pool.query(
        `SELECT pt.*, u.nombre as asignado_nombre
         FROM proyecto_tareas pt LEFT JOIN usuarios u ON pt.asignado_id = u.id
         WHERE pt.proyecto_id = $1
         ORDER BY pt.fase NULLS LAST, pt.orden, pt.fecha_inicio`,
        [proyecto.id]
      ),
      pool.query(
        `SELECT c.*, u.nombre as autor_nombre,
                (SELECT json_agg(json_build_object(
                  'id', a.id, 'nombre_original', a.nombre_original,
                  'mime_type', a.mime_type, 'tamano', a.tamano
                ) ORDER BY a.creado_en)
                 FROM archivos a WHERE a.comentario_id = c.id) as adjuntos
         FROM comentarios c LEFT JOIN usuarios u ON c.usuario_id = u.id
         WHERE c.entidad_tipo = 'proyecto' AND c.entidad_id = $1
         ORDER BY c.creado_en ASC`,
        [proyecto.id]
      ),
      pool.query(
        `SELECT pc.*, u.nombre as creado_por_nombre,
                a.nombre_original as archivo_nombre
         FROM proyecto_costos pc
         LEFT JOIN usuarios u ON pc.creado_por = u.id
         LEFT JOIN archivos a ON pc.archivo_id = a.id
         WHERE pc.proyecto_id = $1 ORDER BY pc.creado_en`,
        [proyecto.id]
      ),
      pool.query(
        `SELECT pce.*, u.nombre as usuario_nombre
         FROM proyecto_cambios_emergentes pce LEFT JOIN usuarios u ON pce.usuario_id = u.id
         WHERE pce.proyecto_id = $1 ORDER BY pce.creado_en DESC`,
        [proyecto.id]
      ),
      pool.query(
        `SELECT pp.*, u.nombre as creado_por_nombre
         FROM proyecto_pausas pp LEFT JOIN usuarios u ON pp.creado_por = u.id
         WHERE pp.proyecto_id = $1
         ORDER BY pp.fecha_inicio DESC`,
        [proyecto.id]
      ),
      pool.query(
        'SELECT * FROM implementacion_tareas WHERE proyecto_id = $1 ORDER BY orden, fecha_inicio',
        [proyecto.id]
      )
    ]);

    // Get estimated costs from evaluation if available
    let estimacion = null;
    if (proyecto.evaluacion_id) {
      const estRes = await pool.query(
        `SELECT * FROM estimaciones_costo WHERE evaluacion_id = $1`,
        [proyecto.evaluacion_id]
      );
      estimacion = estRes.rows[0] || null;
    }

    const pausas = pausasRes.rows;
    const pausaActiva = pausas.find(p => !p.fecha_fin);
    const tareas = tareasRes.rows;

    // Calculate progress in JS
    proyecto.progreso_teorico = calculateTheoreticalProgress(proyecto, tareas, pausas);
    proyecto.progreso_practico = calculatePracticalProgress(tareas);

    // Map adjuntos (null -> [])
    const comentarios = comentariosRes.rows.map(c => ({ ...c, adjuntos: c.adjuntos || [] }));

    res.json({
      proyecto,
      miembros: miembrosRes.rows,
      tareas,
      comentarios,
      costos: costosRes.rows,
      cambios_emergentes: cambiosRes.rows,
      pausas,
      pausa_activa: pausaActiva ? {
        ...pausaActiva,
        dias_transcurridos: getWorkdaysBetween(new Date(pausaActiva.fecha_inicio), new Date())
      } : null,
      estimacion,
      implementacion_tareas: implTareasRes.rows
    });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo
router.put('/:codigo', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const { error, value } = updateProyectoSchema.validate(req.body);
    if (error) throw new AppError(error.details[0].message, 400);

    const updates = [];
    const params = [];
    let pi = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updates.push(`${key} = $${pi++}`);
        params.push(key === 'datos_proyecto' ? JSON.stringify(val) : val);
      }
    });

    if (updates.length === 0) throw new AppError('No hay campos para actualizar', 400);

    updates.push('actualizado_en = NOW()');
    params.push(proyecto.id);

    const result = await pool.query(
      `UPDATE proyectos SET ${updates.join(', ')} WHERE id = $${pi} RETURNING *`,
      params
    );

    await pool.query(
      `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
       VALUES ('proyecto', $1, 'actualizar', $2, $3, $4)`,
      [proyecto.id, JSON.stringify(proyecto), JSON.stringify(result.rows[0]), req.user.id]
    );

    res.json({ message: 'Proyecto actualizado', proyecto: result.rows[0] });
  } catch (error) { next(error); }
});

// =============================================================================
// PROJECT LIFECYCLE (moved from solicitudes.js)
// =============================================================================

// PUT /api/proyectos/:codigo/iniciar-desarrollo
router.put('/:codigo/iniciar-desarrollo', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (proyecto.estado !== 'planificacion') {
      throw new AppError(`Solo se puede iniciar desarrollo de proyectos en planificación. Estado actual: ${proyecto.estado}`, 400);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE proyectos SET estado = 'en_desarrollo', fecha_inicio_desarrollo = NOW(), actualizado_en = NOW() WHERE id = $1`,
        [proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'en_desarrollo');

      // Also set fecha_inicio_desarrollo on solicitud for backward compat
      if (proyecto.solicitud_id) {
        await client.query(
          `UPDATE solicitudes SET fecha_inicio_desarrollo = NOW() WHERE id = $1`,
          [proyecto.solicitud_id]
        );
      }

      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'iniciar_desarrollo', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: 'planificacion' }), JSON.stringify({ estado: 'en_desarrollo' }), req.user.id]
      );

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, 'Proyecto iniciado en desarrollo', 'cambio_estado', true)`,
        [proyecto.id, req.user.id]
      );

      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_iniciado', 'Proyecto iniciado',
           $1, $2
         FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'gerencia') AND activo = true`,
        [
          `El proyecto ${proyecto.codigo} ha iniciado desarrollo`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo })
        ]
      );
    });

    // Email requester
    const solicitanteData = proyecto.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    if (solicitanteEmail) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:11000';
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Su proyecto ha iniciado desarrollo - ${proyecto.codigo}`,
        html: `
          <h2>¡Su proyecto ha iniciado!</h2>
          <p>Estimado/a ${solicitanteData.nombre_completo || 'Solicitante'},</p>
          <p>Su solicitud <strong>${proyecto.solicitud_codigo}</strong> ha sido aprobada y el proyecto <strong>${proyecto.codigo}</strong> ha iniciado desarrollo.</p>
          <p><a href="${frontendUrl}/proyecto/consulta/${proyecto.codigo}" style="background-color: #D52B1E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Ver Progreso</a></p>
        `
      }).catch(err => logger.error('Error sending project start email:', err));
    }

    logger.info(`Project ${proyecto.codigo} started by ${req.user.email}`);

    res.json({
      message: 'Proyecto iniciado en desarrollo',
      proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'en_desarrollo' }
    });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/pausar
router.put('/:codigo/pausar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { motivo, fecha_estimada_reanudacion } = req.body;
    if (!motivo?.trim()) throw new AppError('Debe proporcionar un motivo para pausar el proyecto', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (proyecto.estado !== 'en_desarrollo') {
      throw new AppError(`Solo se pueden pausar proyectos en desarrollo. Estado actual: ${proyecto.estado}`, 400);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE proyectos SET estado = 'pausado', actualizado_en = NOW() WHERE id = $1`,
        [proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'pausado');

      await client.query(
        `INSERT INTO proyecto_pausas (proyecto_id, solicitud_id, motivo, creado_por, fecha_estimada_reanudacion)
         VALUES ($1, $2, $3, $4, $5)`,
        [proyecto.id, proyecto.solicitud_id, motivo, req.user.id, fecha_estimada_reanudacion || null]
      );

      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'pausar', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: 'en_desarrollo' }), JSON.stringify({ estado: 'pausado', motivo }), req.user.id]
      );

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, $3, 'cambio_estado', true)`,
        [proyecto.id, req.user.id, `Proyecto pausado. Motivo: ${motivo}`]
      );

      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_pausado', 'Proyecto pausado', $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `El proyecto ${proyecto.codigo} ha sido pausado`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, motivo })
        ]
      );
    });

    // Email requester
    const solicitanteData = proyecto.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    if (solicitanteEmail) {
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Proyecto pausado - ${proyecto.codigo}`,
        html: `
          <h2>Proyecto Pausado Temporalmente</h2>
          <p>Estimado/a ${solicitanteData.nombre_completo || 'Solicitante'},</p>
          <p>El proyecto <strong>${proyecto.codigo}</strong> ha sido pausado temporalmente.</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <p>Le notificaremos cuando el proyecto sea retomado.</p>
        `
      }).catch(err => logger.error('Error sending pause email:', err));
    }

    logger.info(`Project ${proyecto.codigo} paused by ${req.user.email}: ${motivo}`);
    res.json({ message: 'Proyecto pausado', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'pausado' } });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/reanudar
router.put('/:codigo/reanudar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (proyecto.estado !== 'pausado') {
      throw new AppError(`Solo se pueden reanudar proyectos pausados. Estado actual: ${proyecto.estado}`, 400);
    }

    await withTransaction(async (client) => {
      // Close active pause
      const pausaResult = await client.query(
        `SELECT id, fecha_inicio FROM proyecto_pausas
         WHERE proyecto_id = $1 AND fecha_fin IS NULL ORDER BY fecha_inicio DESC LIMIT 1`,
        [proyecto.id]
      );

      if (pausaResult.rows.length > 0) {
        const pausa = pausaResult.rows[0];
        const diasPausados = getWorkdaysBetween(new Date(pausa.fecha_inicio), new Date());

        await client.query(
          `UPDATE proyecto_pausas SET fecha_fin = NOW(), dias_pausados = $1 WHERE id = $2`,
          [diasPausados, pausa.id]
        );

        await client.query(
          `UPDATE proyectos SET dias_pausados_total = COALESCE(dias_pausados_total, 0) + $1 WHERE id = $2`,
          [diasPausados, proyecto.id]
        );

        // Keep solicitud in sync
        if (proyecto.solicitud_id) {
          await client.query(
            `UPDATE solicitudes SET dias_pausados_total = COALESCE(dias_pausados_total, 0) + $1 WHERE id = $2`,
            [diasPausados, proyecto.solicitud_id]
          );
        }
      }

      await client.query(
        `UPDATE proyectos SET estado = 'en_desarrollo', actualizado_en = NOW() WHERE id = $1`,
        [proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'en_desarrollo');

      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'reanudar', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: 'pausado' }), JSON.stringify({ estado: 'en_desarrollo' }), req.user.id]
      );

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, 'Proyecto reanudado', 'cambio_estado', true)`,
        [proyecto.id, req.user.id]
      );

      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_reanudado', 'Proyecto reanudado', $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `El proyecto ${proyecto.codigo} ha sido reanudado`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo })
        ]
      );
    });

    // Email requester
    const solicitanteData = proyecto.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    if (solicitanteEmail) {
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Proyecto reanudado - ${proyecto.codigo}`,
        html: `
          <h2>Proyecto Reanudado</h2>
          <p>Estimado/a ${solicitanteData.nombre_completo || 'Solicitante'},</p>
          <p>El proyecto <strong>${proyecto.codigo}</strong> ha sido reanudado y continúa su desarrollo.</p>
        `
      }).catch(err => logger.error('Error sending resume email:', err));
    }

    logger.info(`Project ${proyecto.codigo} resumed by ${req.user.email}`);
    res.json({ message: 'Proyecto reanudado', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'en_desarrollo' } });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/cancelar-proyecto
router.put('/:codigo/cancelar-proyecto', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { motivo } = req.body;
    if (!motivo?.trim()) throw new AppError('Debe proporcionar un motivo para cancelar el proyecto', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (!['en_desarrollo', 'pausado'].includes(proyecto.estado)) {
      throw new AppError(`Solo se pueden cancelar proyectos en desarrollo o pausados. Estado actual: ${proyecto.estado}`, 400);
    }

    await withTransaction(async (client) => {
      // Close any active pause
      await client.query(
        `UPDATE proyecto_pausas SET fecha_fin = NOW() WHERE proyecto_id = $1 AND fecha_fin IS NULL`,
        [proyecto.id]
      );

      await client.query(
        `UPDATE proyectos SET estado = 'cancelado', motivo_cancelacion = $1, cancelado_en = NOW(), cancelado_por = $2, actualizado_en = NOW() WHERE id = $3`,
        [motivo, req.user.id, proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'cancelado');

      if (proyecto.solicitud_id) {
        await client.query(
          `UPDATE solicitudes SET motivo_cancelacion = $1, cancelado_en = NOW(), cancelado_por = $2 WHERE id = $3`,
          [motivo, req.user.id, proyecto.solicitud_id]
        );
      }

      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'cancelar', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: proyecto.estado }), JSON.stringify({ estado: 'cancelado', motivo }), req.user.id]
      );

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, $3, 'cambio_estado', true)`,
        [proyecto.id, req.user.id, `Proyecto cancelado. Motivo: ${motivo}`]
      );

      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_cancelado', 'Proyecto cancelado', $1, $2
         FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
        [
          `El proyecto ${proyecto.codigo} ha sido cancelado`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, motivo })
        ]
      );
    });

    // Email requester
    const solicitanteData = proyecto.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    if (solicitanteEmail) {
      emailService.sendEmail({
        to: solicitanteEmail,
        subject: `Proyecto cancelado - ${proyecto.codigo}`,
        html: `
          <h2>Proyecto Cancelado</h2>
          <p>Estimado/a ${solicitanteData.nombre_completo || 'Solicitante'},</p>
          <p>El proyecto <strong>${proyecto.codigo}</strong> ha sido cancelado.</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <p>Si tiene preguntas, contacte al departamento de Nuevas Tecnologías.</p>
        `
      }).catch(err => logger.error('Error sending cancellation email:', err));
    }

    logger.info(`Project ${proyecto.codigo} cancelled by ${req.user.email}: ${motivo}`);
    res.json({ message: 'Proyecto cancelado', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'cancelado' } });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/completar
router.put('/:codigo/completar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (proyecto.estado !== 'en_desarrollo') {
      throw new AppError(`Solo se pueden completar proyectos en desarrollo. Estado actual: ${proyecto.estado}`, 400);
    }

    // Load integracion from linked solicitud
    let integracionData = { fases: [], tareas: [] };
    if (proyecto.solicitud_id) {
      const solRes = await pool.query('SELECT integracion FROM solicitudes WHERE id = $1', [proyecto.solicitud_id]);
      if (solRes.rows.length > 0 && solRes.rows[0].integracion) {
        integracionData = solRes.rows[0].integracion;
      }
    }

    await withTransaction(async (client) => {
      // 1. Update project to en_implementacion
      const implResult = await client.query(
        `UPDATE proyectos SET estado = 'en_implementacion', fecha_fin_real = CURRENT_DATE, actualizado_en = NOW() WHERE id = $1 RETURNING fecha_fin_real`,
        [proyecto.id]
      );
      const implStartDate = new Date(implResult.rows[0].fecha_fin_real);

      // Solicitud stays completado during implementation phase
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'completado');

      // 2. Materialize implementation tasks starting from the transition date
      if (integracionData.tareas && integracionData.tareas.length > 0) {
        let nextStart = getNextWorkday(implStartDate);
        let orden = 0;
        for (const tarea of integracionData.tareas) {
          const fechaInicio = new Date(nextStart);
          const duracion = tarea.duracion_dias || 1;
          const fechaFin = addWorkdays(fechaInicio, duracion - 1);
          await client.query(
            `INSERT INTO implementacion_tareas (proyecto_id, titulo, fase, duracion_dias, fecha_inicio, fecha_fin, orden)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [proyecto.id, tarea.nombre, tarea.fase || null, duracion, fechaInicio, fechaFin, orden]
          );
          const dayAfter = new Date(fechaFin);
          dayAfter.setDate(dayAfter.getDate() + 1);
          nextStart = getNextWorkday(dayAfter);
          orden++;
        }
      }

      // 3. Historial
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'iniciar_implementacion', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: 'en_desarrollo' }), JSON.stringify({ estado: 'en_implementacion' }), req.user.id]
      );

      // 4. Internal comment
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, 'Desarrollo completado — proyecto en fase de implementación', 'cambio_estado', true)`,
        [proyecto.id, req.user.id]
      );

      // 5. Notifications to NT + gerencia
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_en_implementacion', 'Proyecto en implementación', $1, $2
         FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'gerencia') AND activo = true`,
        [
          `El proyecto ${proyecto.codigo} ha completado el desarrollo y está en fase de implementación`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo })
        ]
      );
    });

    // Email requester
    const solicitanteData = proyecto.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    if (solicitanteEmail) {
      const tareasCount = integracionData.tareas?.length || 0;
      emailService.sendImplementationStarted(
        solicitanteEmail,
        solicitanteData.nombre_completo || 'Solicitante',
        proyecto.codigo,
        proyecto.titulo,
        tareasCount
      ).catch(err => logger.error('Error sending implementation started email:', err));
    }

    // Email NT + gerencia
    pool.query("SELECT email, nombre FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'gerencia') AND activo = true")
      .then(res => {
        for (const u of res.rows) {
          emailService.sendProjectStatusChange(u.email, u.nombre, proyecto.codigo, proyecto.titulo, 'en_desarrollo', 'en_implementacion')
            .catch(err => logger.error('Error sending project status email:', err));
        }
      }).catch(err => logger.error('Error querying users for email:', err));

    logger.info(`Project ${proyecto.codigo} moved to en_implementacion by ${req.user.email}`);
    res.json({ message: 'Desarrollo completado — proyecto en implementación', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'en_implementacion' } });
  } catch (error) { next(error); }
});

// =============================================================================
// IMPLEMENTATION TASKS
// =============================================================================

// GET /api/proyectos/:codigo/implementacion-tareas
router.get('/:codigo/implementacion-tareas', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    const result = await pool.query(
      'SELECT * FROM implementacion_tareas WHERE proyecto_id = $1 ORDER BY orden, fecha_inicio',
      [proyecto.id]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/implementacion-tareas/:tareaId/progreso
router.put('/:codigo/implementacion-tareas/:tareaId/progreso', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    if (proyecto.estado !== 'en_implementacion') {
      throw new AppError('Solo se puede actualizar progreso de implementación en proyectos en fase de implementación', 400);
    }

    const { progreso } = req.body;
    if (progreso === undefined || progreso < 0 || progreso > 100) {
      throw new AppError('Progreso debe ser un número entre 0 y 100', 400);
    }

    const tareaRes = await pool.query(
      'SELECT * FROM implementacion_tareas WHERE id = $1 AND proyecto_id = $2',
      [req.params.tareaId, proyecto.id]
    );
    if (tareaRes.rows.length === 0) {
      throw new AppError('Tarea de implementación no encontrada', 404);
    }

    const tarea = tareaRes.rows[0];
    if (progreso < tarea.progreso) {
      throw new AppError(`El progreso solo puede avanzar. Actual: ${tarea.progreso}%, Nuevo: ${progreso}%`, 400);
    }

    const completada = progreso === 100;
    const result = await pool.query(
      `UPDATE implementacion_tareas SET progreso = $1, completada = $2, actualizado_en = NOW()
       WHERE id = $3 RETURNING *`,
      [progreso, completada, req.params.tareaId]
    );

    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/finalizar
router.put('/:codigo/finalizar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (proyecto.estado !== 'en_implementacion') {
      throw new AppError('Solo se pueden finalizar proyectos en fase de implementación', 400);
    }

    // Check all implementation tasks are at 100%
    const tareasRes = await pool.query(
      'SELECT * FROM implementacion_tareas WHERE proyecto_id = $1',
      [proyecto.id]
    );
    const incomplete = tareasRes.rows.filter(t => t.progreso < 100);
    if (incomplete.length > 0) {
      throw new AppError(`Hay ${incomplete.length} tarea(s) de implementación sin completar`, 400);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE proyectos SET estado = 'solucionado', fecha_fin_implementacion = NOW(), actualizado_en = NOW() WHERE id = $1`,
        [proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'solucionado');

      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'finalizar', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: 'en_implementacion' }), JSON.stringify({ estado: 'solucionado' }), req.user.id]
      );

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, 'Proyecto finalizado — implementación completada', 'cambio_estado', true)`,
        [proyecto.id, req.user.id]
      );

      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'proyecto_solucionado', 'Proyecto solucionado', $1, $2
         FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'gerencia') AND activo = true`,
        [
          `El proyecto ${proyecto.codigo} ha sido finalizado exitosamente`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo })
        ]
      );
    });

    // Email requester
    const solicitanteData = proyecto.datos_solicitante || {};
    const solicitanteEmail = solicitanteData.correo || solicitanteData.email;
    if (solicitanteEmail) {
      emailService.sendImplementationCompleted(
        solicitanteEmail,
        solicitanteData.nombre_completo || 'Solicitante',
        proyecto.codigo,
        proyecto.titulo
      ).catch(err => logger.error('Error sending implementation completed email:', err));
    }

    // Email NT + gerencia
    pool.query("SELECT email, nombre FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'gerencia') AND activo = true")
      .then(res => {
        for (const u of res.rows) {
          emailService.sendProjectStatusChange(u.email, u.nombre, proyecto.codigo, proyecto.titulo, 'en_implementacion', 'solucionado')
            .catch(err => logger.error('Error sending project status email:', err));
        }
      }).catch(err => logger.error('Error querying users for email:', err));

    logger.info(`Project ${proyecto.codigo} finalized by ${req.user.email}`);
    res.json({ message: 'Proyecto finalizado', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'solucionado' } });
  } catch (error) { next(error); }
});

// =============================================================================
// PAUSE HISTORY & PROGRESS
// =============================================================================

// GET /api/proyectos/:codigo/pausas
router.get('/:codigo/pausas', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const result = await pool.query(
      `SELECT pp.*, u.nombre as creado_por_nombre
       FROM proyecto_pausas pp LEFT JOIN usuarios u ON pp.creado_por = u.id
       WHERE pp.proyecto_id = $1 ORDER BY pp.fecha_inicio DESC`,
      [proyecto.id]
    );

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

    res.json({ pausas: result.rows, pausa_activa: pausaActiva });
  } catch (error) { next(error); }
});

// GET /api/proyectos/:codigo/progreso
router.get('/:codigo/progreso', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const [tareasRes, pausasRes] = await Promise.all([
      pool.query(
        `SELECT pt.*, u.nombre as asignado_nombre
         FROM proyecto_tareas pt LEFT JOIN usuarios u ON pt.asignado_id = u.id
         WHERE pt.proyecto_id = $1 ORDER BY pt.fase NULLS LAST, pt.orden, pt.fecha_inicio`,
        [proyecto.id]
      ),
      pool.query(
        `SELECT * FROM proyecto_pausas WHERE proyecto_id = $1 ORDER BY fecha_inicio DESC`,
        [proyecto.id]
      )
    ]);

    const tareas = tareasRes.rows;
    const pausas = pausasRes.rows;
    const pausaActiva = pausas.find(p => !p.fecha_fin);

    // Group tasks by phase
    const tareasPorFase = {};
    for (const tarea of tareas) {
      const fase = tarea.fase || 'Sin Fase';
      if (!tareasPorFase[fase]) tareasPorFase[fase] = [];
      tareasPorFase[fase].push(tarea);
    }

    // Get leader info
    const liderRes = await pool.query(
      `SELECT pm.usuario_id as lider_id, u.nombre as lider_nombre
       FROM proyecto_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.proyecto_id = $1 AND pm.es_lider = true LIMIT 1`,
      [proyecto.id]
    );

    res.json({
      proyecto: {
        id: proyecto.id,
        codigo: proyecto.codigo,
        titulo: proyecto.titulo,
        estado: proyecto.estado,
        fecha_inicio_estimada: proyecto.fecha_inicio_estimada,
        fecha_fin_estimada: proyecto.fecha_fin_estimada,
        fecha_inicio_desarrollo: proyecto.fecha_inicio_desarrollo,
        dias_pausados_total: proyecto.dias_pausados_total || 0
      },
      lider: liderRes.rows[0] || null,
      tareas,
      tareas_por_fase: tareasPorFase,
      progreso_teorico: calculateTheoreticalProgress(proyecto, tareas, pausas),
      progreso_practico: calculatePracticalProgress(tareas),
      total_tareas: tareas.length,
      tareas_completadas: tareas.filter(t => t.progreso === 100).length,
      tareas_emergentes: tareas.filter(t => t.es_emergente).length,
      pausas,
      pausa_activa: pausaActiva
    });
  } catch (error) { next(error); }
});

// =============================================================================
// TASKS (Gantt)
// =============================================================================

// GET /api/proyectos/:codigo/tareas
router.get('/:codigo/tareas', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const result = await pool.query(
      `SELECT pt.*, u.nombre as asignado_nombre
       FROM proyecto_tareas pt LEFT JOIN usuarios u ON pt.asignado_id = u.id
       WHERE pt.proyecto_id = $1
       ORDER BY pt.fase NULLS LAST, pt.orden, pt.fecha_inicio`,
      [proyecto.id]
    );

    res.json({ tareas: result.rows });
  } catch (error) { next(error); }
});

// POST /api/proyectos/:codigo/tareas — emergent task (es_emergente=true, es_bloqueado=false)
router.post('/:codigo/tareas', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    if (proyecto.estado !== 'en_desarrollo') {
      throw new AppError('Solo se pueden agregar tareas a proyectos en desarrollo', 400);
    }

    const { error, value } = createTareaSchema.validate(req.body);
    if (error) throw new AppError(error.details[0].message, 400);

    // Ensure fecha_inicio is a workday
    const startDate = new Date(value.fecha_inicio);
    if (!isWorkday(startDate)) {
      const nextWd = getNextWorkday(startDate);
      value.fecha_inicio = nextWd.toISOString().split('T')[0];
    }

    // Compute fecha_fin from workdays
    value.fecha_fin = calculateEndDate(new Date(value.fecha_inicio), value.duracion_dias).toISOString().split('T')[0];

    const result = await withTransaction(async (client) => {
      const tareaRes = await client.query(
        `INSERT INTO proyecto_tareas (
          proyecto_id, titulo, descripcion, fecha_inicio, fecha_fin,
          duracion_dias, asignado_id, color, fase,
          es_emergente, es_bloqueado, progreso
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, 0)
        RETURNING *`,
        [proyecto.id, value.titulo, value.descripcion, value.fecha_inicio, value.fecha_fin,
         value.duracion_dias, value.asignado_id, value.color, value.fase || 'Tareas Emergentes']
      );

      const tarea = tareaRes.rows[0];

      await logEmergentChange(client, proyecto.id, 'tarea_agregada', 'proyecto_tarea', tarea.id,
        null, { titulo: tarea.titulo, duracion_dias: tarea.duracion_dias }, null, req.user.id);

      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, $3, 'tarea_emergente', true)`,
        [proyecto.id, req.user.id, `Tarea emergente agregada: ${value.titulo} (${value.duracion_dias} días)`]
      );

      return tarea;
    });

    // Fetch assignee name
    if (result.asignado_id) {
      const userRes = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [result.asignado_id]);
      result.asignado_nombre = userRes.rows[0]?.nombre;
    }

    logger.info(`Emergent task added to ${proyecto.codigo}: ${value.titulo} by ${req.user.email}`);
    res.status(201).json({ message: 'Tarea emergente creada', tarea: result });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/tareas/:tareaId
router.put('/:codigo/tareas/:tareaId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { tareaId } = req.params;
    const proyecto = await getProyectoByCode(req.params.codigo);
    const { titulo, descripcion, fecha_inicio, fecha_fin, duracion_dias, asignado_id, progreso, color, completada } = req.body;

    // Fetch existing task
    const existingRes = await pool.query(
      `SELECT * FROM proyecto_tareas WHERE id = $1 AND proyecto_id = $2`,
      [tareaId, proyecto.id]
    );
    if (existingRes.rows.length === 0) throw new AppError('Tarea no encontrada', 404);
    const existing = existingRes.rows[0];

    // Enforce: cannot change titulo if es_bloqueado=true
    if (existing.es_bloqueado && titulo && titulo !== existing.titulo) {
      throw new AppError('No se puede cambiar el nombre de tareas del plan original', 400);
    }

    // Check if user can update: lead, assigned, or gerencia
    const isLead = await isProjectLead(proyecto.id, req.user.id);
    const isAssigned = existing.asignado_id === req.user.id;
    if (!isLead && !isAssigned && proyecto.responsable_id !== req.user.id && req.user.rol !== 'gerencia') {
      throw new AppError('Solo puede actualizar tareas asignadas a usted o si es el líder', 403);
    }

    const result = await withTransaction(async (client) => {
      const tareaRes = await client.query(
        `UPDATE proyecto_tareas SET
          titulo = COALESCE($1, titulo),
          descripcion = COALESCE($2, descripcion),
          fecha_inicio = COALESCE($3, fecha_inicio),
          fecha_fin = COALESCE($4, fecha_fin),
          duracion_dias = COALESCE($5, duracion_dias),
          asignado_id = COALESCE($6, asignado_id),
          progreso = COALESCE($7, progreso),
          color = COALESCE($8, color),
          completada = COALESCE($9, completada),
          actualizado_en = NOW()
         WHERE id = $10 AND proyecto_id = $11
         RETURNING *`,
        [titulo, descripcion, fecha_inicio, fecha_fin, duracion_dias, asignado_id, progreso, color, completada, tareaId, proyecto.id]
      );

      // Log emergent changes for date/duration modifications
      if (fecha_inicio && fecha_inicio !== existing.fecha_inicio?.toISOString()?.split('T')[0]) {
        await logEmergentChange(client, proyecto.id, 'tarea_fecha_modificada', 'proyecto_tarea', parseInt(tareaId),
          { fecha_inicio: existing.fecha_inicio }, { fecha_inicio }, null, req.user.id);
      }
      if (fecha_fin && fecha_fin !== existing.fecha_fin?.toISOString()?.split('T')[0]) {
        await logEmergentChange(client, proyecto.id, 'tarea_fecha_modificada', 'proyecto_tarea', parseInt(tareaId),
          { fecha_fin: existing.fecha_fin }, { fecha_fin }, null, req.user.id);
      }
      if (duracion_dias && duracion_dias !== existing.duracion_dias) {
        await logEmergentChange(client, proyecto.id, 'tarea_duracion_modificada', 'proyecto_tarea', parseInt(tareaId),
          { duracion_dias: existing.duracion_dias }, { duracion_dias }, null, req.user.id);
      }

      return tareaRes.rows[0];
    });

    res.json({ message: 'Tarea actualizada', tarea: result });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/tareas/:tareaId/progreso — dedicated progress endpoint
router.put('/:codigo/tareas/:tareaId/progreso', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { tareaId } = req.params;
    const { progreso } = req.body;
    const proyecto = await getProyectoByCode(req.params.codigo);

    if (progreso === undefined || progreso < 0 || progreso > 100) {
      throw new AppError('El progreso debe ser un número entre 0 y 100', 400);
    }

    // Verify task exists and belongs to project
    const taskRes = await pool.query(
      `SELECT * FROM proyecto_tareas WHERE id = $1 AND proyecto_id = $2`,
      [tareaId, proyecto.id]
    );
    if (taskRes.rows.length === 0) throw new AppError('Tarea no encontrada', 404);

    const tarea = taskRes.rows[0];

    // Enforce: progress can only go up
    if (progreso < (tarea.progreso || 0)) {
      throw new AppError(`El progreso no puede disminuir. Valor actual: ${tarea.progreso}%`, 400);
    }

    // Check permissions: lead, assigned, or responsible
    const isLead = await isProjectLead(proyecto.id, req.user.id);
    const isAssigned = tarea.asignado_id === req.user.id;
    if (!isLead && !isAssigned && proyecto.responsable_id !== req.user.id) {
      throw new AppError('Solo puede actualizar tareas asignadas a usted o si es el líder', 403);
    }

    const completada = progreso === 100;
    const result = await pool.query(
      `UPDATE proyecto_tareas SET progreso = $1, completada = $2, actualizado_en = NOW() WHERE id = $3 RETURNING *`,
      [progreso, completada, tareaId]
    );

    logger.info(`Task ${tareaId} progress updated to ${progreso}% by ${req.user.email}`);
    res.json({ message: 'Progreso actualizado', tarea: result.rows[0] });
  } catch (error) { next(error); }
});

// DELETE /api/proyectos/:codigo/tareas/:tareaId — only allow if es_emergente=true
router.delete('/:codigo/tareas/:tareaId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { tareaId } = req.params;
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const taskRes = await pool.query(
      `SELECT * FROM proyecto_tareas WHERE id = $1 AND proyecto_id = $2`,
      [tareaId, proyecto.id]
    );
    if (taskRes.rows.length === 0) throw new AppError('Tarea no encontrada', 404);

    const tarea = taskRes.rows[0];
    if (!tarea.es_emergente) {
      throw new AppError('Solo se pueden eliminar tareas emergentes. Las tareas del plan original no pueden eliminarse.', 400);
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM proyecto_tareas WHERE id = $1', [tareaId]);

      await logEmergentChange(client, proyecto.id, 'tarea_eliminada', 'proyecto_tarea', parseInt(tareaId),
        { titulo: tarea.titulo, duracion_dias: tarea.duracion_dias }, null, null, req.user.id);
    });

    res.json({ message: 'Tarea eliminada' });
  } catch (error) { next(error); }
});

// =============================================================================
// TEAM MEMBERS
// =============================================================================

// GET /api/proyectos/:codigo/miembros
router.get('/:codigo/miembros', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const result = await pool.query(
      `SELECT pm.*, u.nombre, u.email, u.rol
       FROM proyecto_miembros pm JOIN usuarios u ON pm.usuario_id = u.id
       WHERE pm.proyecto_id = $1 ORDER BY pm.es_lider DESC, u.nombre`,
      [proyecto.id]
    );

    res.json({ miembros: result.rows });
  } catch (error) { next(error); }
});

// POST /api/proyectos/:codigo/miembros — es_original=false, log emergent change
router.post('/:codigo/miembros', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const { usuario_id, rol_proyecto } = req.body;
    if (!usuario_id) throw new AppError('usuario_id es requerido', 400);

    const userRes = await pool.query('SELECT id, nombre FROM usuarios WHERE id = $1 AND activo = true', [usuario_id]);
    if (userRes.rows.length === 0) throw new AppError('Usuario no encontrado', 404);

    const result = await withTransaction(async (client) => {
      const miembroRes = await client.query(
        `INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol_proyecto, es_original, es_lider)
         VALUES ($1, $2, $3, false, false)
         ON CONFLICT (proyecto_id, usuario_id) DO UPDATE SET rol_proyecto = $3
         RETURNING *`,
        [proyecto.id, usuario_id, rol_proyecto || 'miembro']
      );

      await logEmergentChange(client, proyecto.id, 'miembro_agregado', 'proyecto_miembro', miembroRes.rows[0].id,
        null, { usuario_id, nombre: userRes.rows[0].nombre, rol_proyecto: rol_proyecto || 'miembro' }, null, req.user.id);

      return miembroRes.rows[0];
    });

    res.status(201).json({
      message: 'Miembro agregado',
      miembro: { ...result, nombre: userRes.rows[0].nombre }
    });
  } catch (error) { next(error); }
});

// DELETE /api/proyectos/:codigo/miembros/:userId — log emergent change
router.delete('/:codigo/miembros/:userId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const existing = await pool.query(
      `SELECT pm.*, u.nombre FROM proyecto_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.proyecto_id = $1 AND pm.usuario_id = $2`,
      [proyecto.id, userId]
    );
    if (existing.rows.length === 0) throw new AppError('Miembro no encontrado', 404);

    if (existing.rows[0].es_lider) {
      throw new AppError('No se puede eliminar al líder del proyecto', 400);
    }

    await withTransaction(async (client) => {
      // Get the project leader for task reassignment
      const leaderRes = await client.query(
        `SELECT usuario_id FROM proyecto_miembros WHERE proyecto_id = $1 AND es_lider = true LIMIT 1`,
        [proyecto.id]
      );
      const leaderId = leaderRes.rows[0]?.usuario_id || proyecto.responsable_id;

      await client.query(
        'DELETE FROM proyecto_miembros WHERE proyecto_id = $1 AND usuario_id = $2',
        [proyecto.id, userId]
      );

      // Auto-reassign deleted member's tasks to the leader
      await client.query(
        `UPDATE proyecto_tareas SET asignado_id = $1 WHERE proyecto_id = $2 AND asignado_id = $3`,
        [leaderId, proyecto.id, parseInt(userId)]
      );

      await logEmergentChange(client, proyecto.id, 'miembro_eliminado', 'proyecto_miembro', existing.rows[0].id,
        { usuario_id: parseInt(userId), nombre: existing.rows[0].nombre }, null, null, req.user.id);
    });

    res.json({ message: 'Miembro eliminado' });
  } catch (error) { next(error); }
});

// =============================================================================
// COSTS
// =============================================================================

// GET /api/proyectos/:codigo/costos
router.get('/:codigo/costos', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const result = await pool.query(
      `SELECT pc.*, u.nombre as creado_por_nombre,
              a.nombre_original as archivo_nombre
       FROM proyecto_costos pc
       LEFT JOIN usuarios u ON pc.creado_por = u.id
       LEFT JOIN archivos a ON pc.archivo_id = a.id
       WHERE pc.proyecto_id = $1 ORDER BY pc.creado_en`,
      [proyecto.id]
    );

    res.json({ costos: result.rows });
  } catch (error) { next(error); }
});

// POST /api/proyectos/:codigo/costos
router.post('/:codigo/costos', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const { error, value } = costoSchema.validate(req.body);
    if (error) throw new AppError(error.details[0].message, 400);

    const result = await pool.query(
      `INSERT INTO proyecto_costos (proyecto_id, concepto, descripcion, subtotal, iva, cantidad, archivo_id, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [proyecto.id, value.concepto, value.descripcion, value.subtotal, value.iva, value.cantidad, value.archivo_id, req.user.id]
    );

    res.status(201).json({ message: 'Costo agregado', costo: result.rows[0] });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/costos/:costoId
router.put('/:codigo/costos/:costoId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { costoId } = req.params;
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const { error, value } = costoSchema.validate(req.body);
    if (error) throw new AppError(error.details[0].message, 400);

    const result = await pool.query(
      `UPDATE proyecto_costos SET concepto = $1, descripcion = $2, subtotal = $3, iva = $4, cantidad = $5, archivo_id = $6, actualizado_en = NOW()
       WHERE id = $7 AND proyecto_id = $8 RETURNING *`,
      [value.concepto, value.descripcion, value.subtotal, value.iva, value.cantidad, value.archivo_id, costoId, proyecto.id]
    );

    if (result.rows.length === 0) throw new AppError('Costo no encontrado', 404);
    res.json({ message: 'Costo actualizado', costo: result.rows[0] });
  } catch (error) { next(error); }
});

// DELETE /api/proyectos/:codigo/costos/:costoId
router.delete('/:codigo/costos/:costoId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { costoId } = req.params;
    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    const result = await pool.query(
      'DELETE FROM proyecto_costos WHERE id = $1 AND proyecto_id = $2 RETURNING id',
      [costoId, proyecto.id]
    );

    if (result.rows.length === 0) throw new AppError('Costo no encontrado', 404);
    res.json({ message: 'Costo eliminado' });
  } catch (error) { next(error); }
});

// GET /api/proyectos/:codigo/costos/resumen — actual vs estimated
router.get('/:codigo/costos/resumen', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const costosRes = await pool.query(
      `SELECT COALESCE(SUM(subtotal * cantidad), 0) as total_subtotal,
              COALESCE(SUM(iva * cantidad), 0) as total_iva,
              COALESCE(SUM((subtotal + iva) * cantidad), 0) as total_actual,
              COUNT(*) as num_items
       FROM proyecto_costos WHERE proyecto_id = $1`,
      [proyecto.id]
    );

    let estimado = null;
    if (proyecto.evaluacion_id) {
      const estRes = await pool.query(
        `SELECT total_estimado, desglose FROM estimaciones_costo WHERE evaluacion_id = $1`,
        [proyecto.evaluacion_id]
      );
      estimado = estRes.rows[0] || null;
    }

    res.json({
      actual: costosRes.rows[0],
      estimado,
      diferencia: estimado?.total_estimado
        ? parseFloat(costosRes.rows[0].total_actual) - parseFloat(estimado.total_estimado)
        : null
    });
  } catch (error) { next(error); }
});

// =============================================================================
// EMERGENT CHANGES LOG
// =============================================================================

// GET /api/proyectos/:codigo/cambios-emergentes
router.get('/:codigo/cambios-emergentes', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const result = await pool.query(
      `SELECT pce.*, u.nombre as usuario_nombre
       FROM proyecto_cambios_emergentes pce
       LEFT JOIN usuarios u ON pce.usuario_id = u.id
       WHERE pce.proyecto_id = $1 ORDER BY pce.creado_en DESC`,
      [proyecto.id]
    );

    res.json({ cambios: result.rows });
  } catch (error) { next(error); }
});

// =============================================================================
// COMMENTS
// =============================================================================

// POST /api/proyectos/:codigo/comentarios — with file attachments
// tipos: 'interno'/'comentario' (default), 'publico', 'comunicacion', 'agendar_reunion'
router.post('/:codigo/comentarios', authenticate, uploadMultiple, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);
    let { contenido, tipo } = req.body;
    tipo = tipo || 'comentario';

    if (!contenido?.trim()) throw new AppError('El comentario no puede estar vacío', 400);

    // Permission: must be project member, coordinador_nt, or gerencia
    const isMember = await pool.query(
      `SELECT 1 FROM proyecto_miembros WHERE proyecto_id = $1 AND usuario_id = $2`,
      [proyecto.id, req.user.id]
    );
    const allowedRoles = ['coordinador_nt', 'gerencia', 'admin'];
    if (isMember.rows.length === 0 && !allowedRoles.includes(req.user.rol)) {
      throw new AppError('No tiene permisos para comentar en este proyecto', 403);
    }

    // Only NT users can post publico, comunicacion, agendar_reunion
    const ntOnlyTipos = ['publico', 'comunicacion', 'agendar_reunion'];
    if (ntOnlyTipos.includes(tipo) && req.user.rol !== 'nuevas_tecnologias') {
      tipo = 'comentario';
    }

    const result = await pool.query(
      `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
       VALUES ('proyecto', $1, $2, $3, $4, $5) RETURNING *`,
      [proyecto.id, req.user.id, contenido.trim(), tipo, !ntOnlyTipos.includes(tipo)]
    );

    const comentario = result.rows[0];

    // Save file attachments linked to this comment
    const adjuntos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const archivoRes = await pool.query(
          `INSERT INTO archivos (entidad_tipo, entidad_id, nombre_original, nombre_almacenado, mime_type, tamano, ruta, subido_por, comentario_id, origen)
           VALUES ('proyecto', $1, $2, $3, $4, $5, $6, $7, $8, 'comentario') RETURNING *`,
          [proyecto.id, file.originalname, file.filename, file.mimetype, file.size, `/uploads/${file.filename}`, req.user.id, comentario.id]
        );
        adjuntos.push(archivoRes.rows[0]);
      }
    }

    // For comunicacion/agendar_reunion, create response token and send email
    if (['comunicacion', 'agendar_reunion'].includes(tipo)) {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const solicitanteEmail = proyecto.datos_solicitante?.correo || proyecto.datos_solicitante?.email;

      if (solicitanteEmail) {
        await pool.query(
          `INSERT INTO respuestas_pendientes
           (token, comentario_id, entidad_tipo, entidad_id, email_destino, usuario_pregunta_id, expira_en)
           VALUES ($1, $2, 'proyecto', $3, $4, $5, $6)`,
          [token, comentario.id, proyecto.id, solicitanteEmail, req.user.id, expiraEn]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:11000';
        const responseUrl = `${frontendUrl}/responder/${token}`;

        const subjectText = tipo === 'agendar_reunion'
          ? `Solicitud de reunión - Proyecto ${proyecto.codigo}`
          : `Comunicación sobre su proyecto ${proyecto.codigo}`;

        const headerText = tipo === 'agendar_reunion'
          ? 'Solicitud de Reunión'
          : 'Comunicación sobre su proyecto';

        const buttonText = tipo === 'agendar_reunion'
          ? 'Proponer Fecha y Hora'
          : 'Responder';

        emailService.sendEmail({
          to: solicitanteEmail,
          subject: subjectText,
          html: `
            <h2>${headerText}</h2>
            <p>El equipo de Nuevas Tecnologías le ha enviado ${tipo === 'agendar_reunion' ? 'una solicitud de reunión' : 'una comunicación'} sobre su proyecto <strong>${proyecto.codigo}</strong>:</p>
            <blockquote style="border-left: 3px solid #D52B1E; padding-left: 15px; margin: 20px 0; color: #333;">
              ${contenido.trim().replace(/\n/g, '<br>')}
            </blockquote>
            <p><strong>De:</strong> ${req.user.nombre}</p>
            <p>${tipo === 'agendar_reunion' ? 'Por favor proponga una fecha y hora para la reunión:' : 'Si desea responder, haga clic en el siguiente enlace:'}</p>
            <p><a href="${responseUrl}" style="background-color: #D52B1E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">${buttonText}</a></p>
            <p><small>Este enlace expira en 7 días y solo puede usarse una vez.</small></p>
            <hr>
            <p style="color: #666; font-size: 12px;">INEMEC S.A. - Sistema de Gestión de Proyectos</p>
          `
        }).catch(err => {
          logger.error('Error sending project comunicacion email:', err);
        });
      }
    }

    res.status(201).json({ message: 'Comentario agregado', comentario: { ...comentario, adjuntos } });
  } catch (error) { next(error); }
});

// =============================================================================
// CANCELLATION BY COORDINADOR NT / GERENCIA
// =============================================================================

// PUT /api/proyectos/:codigo/cancelar-coordinador
router.put('/:codigo/cancelar-coordinador', authenticate, authorize('coordinador_nt'), async (req, res, next) => {
  try {
    const { motivo } = req.body;
    if (!motivo?.trim()) throw new AppError('Debe proporcionar un motivo para cancelar el proyecto', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);
    if (!['en_desarrollo', 'pausado', 'planificacion'].includes(proyecto.estado)) {
      throw new AppError(`No se puede cancelar un proyecto en estado: ${proyecto.estado}`, 400);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE proyecto_pausas SET fecha_fin = NOW() WHERE proyecto_id = $1 AND fecha_fin IS NULL`,
        [proyecto.id]
      );
      await client.query(
        `UPDATE proyectos SET estado = 'cancelado_coordinador', motivo_cancelacion = $1, cancelado_en = NOW(), cancelado_por = $2, actualizado_en = NOW() WHERE id = $3`,
        [motivo, req.user.id, proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'cancelado');
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, $3, 'cambio_estado', true)`,
        [proyecto.id, req.user.id, `Proyecto cancelado por Coordinador NT. Motivo: ${motivo}`]
      );
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'cancelar_coordinador', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: proyecto.estado }), JSON.stringify({ estado: 'cancelado_coordinador', motivo }), req.user.id]
      );
    });

    // Notifications (in-app + websocket)
    notificationService.onProyectoStatusChange(proyecto.id, proyecto.estado, 'cancelado_coordinador', req.user.id, { motivo })
      .catch(err => logger.error('Error sending project cancel notifications:', err));

    // Email requester
    const solicitanteDataCoord = proyecto.datos_solicitante || {};
    const solicitanteEmailCoord = solicitanteDataCoord.correo || solicitanteDataCoord.email;
    if (solicitanteEmailCoord) {
      emailService.sendProjectStatusChange(
        solicitanteEmailCoord,
        solicitanteDataCoord.nombre_completo || 'Solicitante',
        proyecto.codigo,
        proyecto.titulo,
        proyecto.estado,
        'cancelado_coordinador',
        motivo
      ).catch(err => logger.error('Error sending cancel email:', err));
    }

    logger.info(`Project ${proyecto.codigo} cancelled by coordinador_nt ${req.user.email}: ${motivo}`);
    res.json({ message: 'Proyecto cancelado por Coordinador NT', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'cancelado_coordinador' } });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/cancelar-gerencia
router.put('/:codigo/cancelar-gerencia', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { motivo } = req.body;
    if (!motivo?.trim()) throw new AppError('Debe proporcionar un motivo para cancelar el proyecto', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);
    if (!['en_desarrollo', 'pausado', 'planificacion'].includes(proyecto.estado)) {
      throw new AppError(`No se puede cancelar un proyecto en estado: ${proyecto.estado}`, 400);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE proyecto_pausas SET fecha_fin = NOW() WHERE proyecto_id = $1 AND fecha_fin IS NULL`,
        [proyecto.id]
      );
      await client.query(
        `UPDATE proyectos SET estado = 'cancelado_gerencia', motivo_cancelacion = $1, cancelado_en = NOW(), cancelado_por = $2, actualizado_en = NOW() WHERE id = $3`,
        [motivo, req.user.id, proyecto.id]
      );
      await syncSolicitudEstado(client, proyecto.solicitud_id, 'cancelado');
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno)
         VALUES ('proyecto', $1, $2, $3, 'cambio_estado', true)`,
        [proyecto.id, req.user.id, `Proyecto cancelado por Gerencia. Motivo: ${motivo}`]
      );
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'cancelar_gerencia', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: proyecto.estado }), JSON.stringify({ estado: 'cancelado_gerencia', motivo }), req.user.id]
      );
    });

    // Notifications (in-app + websocket)
    notificationService.onProyectoStatusChange(proyecto.id, proyecto.estado, 'cancelado_gerencia', req.user.id, { motivo })
      .catch(err => logger.error('Error sending project cancel notifications:', err));

    // Email requester
    const solicitanteDataGer = proyecto.datos_solicitante || {};
    const solicitanteEmailGer = solicitanteDataGer.correo || solicitanteDataGer.email;
    if (solicitanteEmailGer) {
      emailService.sendProjectStatusChange(
        solicitanteEmailGer,
        solicitanteDataGer.nombre_completo || 'Solicitante',
        proyecto.codigo,
        proyecto.titulo,
        proyecto.estado,
        'cancelado_gerencia',
        motivo
      ).catch(err => logger.error('Error sending cancel email:', err));
    }

    logger.info(`Project ${proyecto.codigo} cancelled by gerencia ${req.user.email}: ${motivo}`);
    res.json({ message: 'Proyecto cancelado por Gerencia', proyecto: { id: proyecto.id, codigo: proyecto.codigo, estado: 'cancelado_gerencia' } });
  } catch (error) { next(error); }
});

// =============================================================================
// LEADER CHANGE
// =============================================================================

// PUT /api/proyectos/:codigo/cambiar-lider
router.put('/:codigo/cambiar-lider', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { nuevo_lider_id } = req.body;
    if (!nuevo_lider_id) throw new AppError('nuevo_lider_id es requerido', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);
    await requireLead(proyecto, req.user.id, req.user.rol);

    // Verify new leader is NT (not coordinador_nt)
    const newLeaderRes = await pool.query(
      `SELECT id, nombre, rol FROM usuarios WHERE id = $1 AND activo = true`,
      [nuevo_lider_id]
    );
    if (newLeaderRes.rows.length === 0) throw new AppError('Usuario no encontrado', 404);
    if (newLeaderRes.rows[0].rol !== 'nuevas_tecnologias') {
      throw new AppError('El nuevo líder debe tener rol Nuevas Tecnologías', 400);
    }

    await withTransaction(async (client) => {
      // Get current leader
      const oldLeaderRes = await client.query(
        `SELECT pm.usuario_id, u.nombre FROM proyecto_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
         WHERE pm.proyecto_id = $1 AND pm.es_lider = true LIMIT 1`,
        [proyecto.id]
      );
      const oldLeader = oldLeaderRes.rows[0];

      // Remove es_lider from old leader
      if (oldLeader) {
        await client.query(
          `UPDATE proyecto_miembros SET es_lider = false WHERE proyecto_id = $1 AND usuario_id = $2`,
          [proyecto.id, oldLeader.usuario_id]
        );
      }

      // Ensure new leader is a member, set es_lider = true
      await client.query(
        `INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol_proyecto, es_original, es_lider)
         VALUES ($1, $2, 'lider', false, true)
         ON CONFLICT (proyecto_id, usuario_id) DO UPDATE SET es_lider = true, rol_proyecto = 'lider'`,
        [proyecto.id, nuevo_lider_id]
      );

      // Reassign old leader's tasks to new leader
      if (oldLeader) {
        await client.query(
          `UPDATE proyecto_tareas SET asignado_id = $1 WHERE proyecto_id = $2 AND asignado_id = $3`,
          [nuevo_lider_id, proyecto.id, oldLeader.usuario_id]
        );
      }

      // Update proyectos.responsable_id
      await client.query(
        `UPDATE proyectos SET responsable_id = $1, actualizado_en = NOW() WHERE id = $2`,
        [nuevo_lider_id, proyecto.id]
      );

      // Log emergent change
      await logEmergentChange(client, proyecto.id, 'cambio_lider', 'proyecto', proyecto.id,
        { lider_id: oldLeader?.usuario_id, lider_nombre: oldLeader?.nombre },
        { lider_id: nuevo_lider_id, lider_nombre: newLeaderRes.rows[0].nombre },
        null, req.user.id);
    });

    logger.info(`Project ${proyecto.codigo} leader changed to ${newLeaderRes.rows[0].nombre} by ${req.user.email}`);
    res.json({ message: 'Líder del proyecto cambiado', nuevo_lider: newLeaderRes.rows[0] });
  } catch (error) { next(error); }
});

// =============================================================================
// REPROGRAMACION (RESCHEDULE)
// =============================================================================

// GET /api/proyectos/:codigo/reprogramacion - Get latest reprogramacion for project
router.get('/:codigo/reprogramacion', authenticate, async (req, res, next) => {
  try {
    const proyecto = await getProyectoByCode(req.params.codigo);

    const result = await pool.query(
      `SELECT r.*,
              sol.nombre as solicitante_nombre,
              coord.nombre as coordinador_nombre,
              ger.nombre as gerencia_nombre
       FROM reprogramaciones r
       LEFT JOIN usuarios sol ON r.solicitante_id = sol.id
       LEFT JOIN usuarios coord ON r.coordinador_id = coord.id
       LEFT JOIN usuarios ger ON r.gerencia_id = ger.id
       WHERE r.proyecto_id = $1
       ORDER BY r.creado_en DESC
       LIMIT 1`,
      [proyecto.id]
    );

    res.json({ reprogramacion: result.rows[0] || null });
  } catch (error) { next(error); }
});

// POST /api/proyectos/:codigo/reprogramacion - Request a reschedule
router.post('/:codigo/reprogramacion', authenticate, authorize('nuevas_tecnologias', 'coordinador_nt'), async (req, res, next) => {
  try {
    const { motivo, fecha_inicio_propuesta, fecha_fin_propuesta } = req.body;
    if (!motivo?.trim()) throw new AppError('Debe proporcionar un motivo', 400);
    if (!fecha_inicio_propuesta || !fecha_fin_propuesta) throw new AppError('Se requieren fechas propuestas', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);
    if (!['planificacion', 'en_desarrollo', 'pausado'].includes(proyecto.estado)) {
      throw new AppError(`No se puede reprogramar un proyecto en estado: ${proyecto.estado}`, 400);
    }

    // Check no pending reprogramacion
    const pending = await pool.query(
      `SELECT id FROM reprogramaciones WHERE proyecto_id = $1 AND estado IN ('pendiente_coordinador', 'pendiente_gerencia')`,
      [proyecto.id]
    );
    if (pending.rows.length > 0) {
      throw new AppError('Ya existe una solicitud de reprogramación pendiente para este proyecto', 400);
    }

    await withTransaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO reprogramaciones (proyecto_id, proyecto_codigo, solicitante_id, motivo, fecha_inicio_propuesta, fecha_fin_propuesta, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'pendiente_coordinador')
         RETURNING *`,
        [proyecto.id, proyecto.codigo, req.user.id, motivo, fecha_inicio_propuesta, fecha_fin_propuesta]
      );

      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'solicitar_reprogramacion', $2, $3, $4)`,
        [proyecto.id, JSON.stringify({ estado: proyecto.estado }), JSON.stringify({ motivo, fecha_inicio_propuesta, fecha_fin_propuesta }), req.user.id]
      );

      // Notify coordinador_nt users
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'reprogramacion_solicitada', 'Solicitud de Reprogramación',
           $1, $2
         FROM usuarios WHERE rol = 'coordinador_nt' AND activo = true`,
        [
          `Se ha solicitado reprogramar el proyecto ${proyecto.codigo}`,
          JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, reprogramacion_id: insertResult.rows[0].id })
        ]
      );
    });

    logger.info(`Reprogramacion requested for ${proyecto.codigo} by ${req.user.email}`);
    res.json({ message: 'Solicitud de reprogramación creada', reprogramacion: { proyecto_id: proyecto.id, estado: 'pendiente_coordinador' } });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/reprogramacion/:id/coordinador - Coordinador NT approves/rejects
router.put('/:codigo/reprogramacion/:id/coordinador', authenticate, authorize('coordinador_nt'), async (req, res, next) => {
  try {
    const { accion, comentario, fecha_inicio, fecha_fin } = req.body;
    if (!['aprobar', 'rechazar'].includes(accion)) throw new AppError('Acción inválida', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);

    const reproResult = await pool.query(
      `SELECT * FROM reprogramaciones WHERE id = $1 AND proyecto_id = $2`,
      [req.params.id, proyecto.id]
    );
    if (reproResult.rows.length === 0) throw new AppError('Reprogramación no encontrada', 404);
    const repro = reproResult.rows[0];
    if (repro.estado !== 'pendiente_coordinador') throw new AppError('Esta reprogramación ya fue procesada por coordinador', 400);

    await withTransaction(async (client) => {
      if (accion === 'aprobar') {
        const coordInicio = fecha_inicio || repro.fecha_inicio_propuesta;
        const coordFin = fecha_fin || repro.fecha_fin_propuesta;

        await client.query(
          `UPDATE reprogramaciones SET
            estado = 'pendiente_gerencia',
            coordinador_id = $1,
            fecha_decision_coordinador = NOW(),
            comentario_coordinador = $2,
            fecha_inicio_coordinador = $3,
            fecha_fin_coordinador = $4
           WHERE id = $5`,
          [req.user.id, comentario || null, coordInicio, coordFin, repro.id]
        );

        // Notify gerencia
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           SELECT id, 'reprogramacion_pendiente_gerencia', 'Reprogramación Pendiente de Aprobación',
             $1, $2
           FROM usuarios WHERE rol = 'gerencia' AND activo = true`,
          [
            `La reprogramación del proyecto ${proyecto.codigo} fue aprobada por Coordinador NT y requiere su aprobación`,
            JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, reprogramacion_id: repro.id })
          ]
        );
      } else {
        await client.query(
          `UPDATE reprogramaciones SET
            estado = 'rechazada_coordinador',
            coordinador_id = $1,
            fecha_decision_coordinador = NOW(),
            comentario_coordinador = $2
           WHERE id = $3`,
          [req.user.id, comentario || null, repro.id]
        );

        // Notify requester
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           VALUES ($1, 'reprogramacion_rechazada', 'Reprogramación Rechazada',
             $2, $3)`,
          [
            repro.solicitante_id,
            `La solicitud de reprogramación del proyecto ${proyecto.codigo} fue rechazada por Coordinador NT`,
            JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, reprogramacion_id: repro.id })
          ]
        );
      }

      // Audit record
      await client.query(
        `INSERT INTO decisiones_coordinador (entidad_tipo, entidad_id, coordinador_id, tipo_coordinador, accion, fecha_sugerida, comentario)
         VALUES ('reprogramacion', $1, $2, 'coordinador_nt', $3, $4, $5)`,
        [repro.id, req.user.id, accion === 'aprobar' ? 'aprobado' : 'rechazado', fecha_inicio || null, comentario || null]
      );
    });

    logger.info(`Reprogramacion ${repro.id} ${accion} by coordinador ${req.user.email}`);
    res.json({ message: accion === 'aprobar' ? 'Reprogramación aprobada por Coordinador NT' : 'Reprogramación rechazada por Coordinador NT' });
  } catch (error) { next(error); }
});

// PUT /api/proyectos/:codigo/reprogramacion/:id/gerencia - Gerencia approves/rejects
router.put('/:codigo/reprogramacion/:id/gerencia', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { accion, comentario, fecha_inicio, fecha_fin } = req.body;
    if (!['aprobar', 'rechazar'].includes(accion)) throw new AppError('Acción inválida', 400);

    const proyecto = await getProyectoByCode(req.params.codigo);

    const reproResult = await pool.query(
      `SELECT * FROM reprogramaciones WHERE id = $1 AND proyecto_id = $2`,
      [req.params.id, proyecto.id]
    );
    if (reproResult.rows.length === 0) throw new AppError('Reprogramación no encontrada', 404);
    const repro = reproResult.rows[0];
    if (repro.estado !== 'pendiente_gerencia') throw new AppError('Esta reprogramación no está pendiente de Gerencia', 400);

    await withTransaction(async (client) => {
      if (accion === 'aprobar') {
        const gerInicio = fecha_inicio || repro.fecha_inicio_coordinador;
        const gerFin = fecha_fin || repro.fecha_fin_coordinador;

        await client.query(
          `UPDATE reprogramaciones SET
            estado = 'aprobada',
            gerencia_id = $1,
            fecha_decision_gerencia = NOW(),
            comentario_gerencia = $2,
            fecha_inicio_gerencia = $3,
            fecha_fin_gerencia = $4
           WHERE id = $5`,
          [req.user.id, comentario || null, gerInicio, gerFin, repro.id]
        );

        // Recalculate ALL proyecto_tareas from the approved fecha_inicio
        const tareasResult = await client.query(
          `SELECT id, duracion_dias FROM proyecto_tareas
           WHERE proyecto_id = $1
           ORDER BY fase NULLS LAST, orden, id`,
          [proyecto.id]
        );

        let nextStart = getNextWorkday(new Date(gerInicio));
        for (const tarea of tareasResult.rows) {
          const fechaInicioTarea = new Date(nextStart);
          const duracion = tarea.duracion_dias || 1;
          const fechaFinTarea = addWorkdays(fechaInicioTarea, duracion - 1);

          await client.query(
            `UPDATE proyecto_tareas SET fecha_inicio = $1, fecha_fin = $2 WHERE id = $3`,
            [fechaInicioTarea.toISOString().split('T')[0], fechaFinTarea.toISOString().split('T')[0], tarea.id]
          );

          const dayAfter = new Date(fechaFinTarea);
          dayAfter.setDate(dayAfter.getDate() + 1);
          nextStart = getNextWorkday(dayAfter);
        }

        // Update solicitud programmed dates if exists
        if (proyecto.solicitud_id) {
          await client.query(
            `UPDATE solicitudes SET fecha_inicio_programada = $1, fecha_fin_programada = $2, actualizado_en = NOW() WHERE id = $3`,
            [gerInicio, gerFin, proyecto.solicitud_id]
          );
        }

        // Update proyecto dates
        await client.query(
          `UPDATE proyectos SET fecha_inicio_estimada = $1, fecha_fin_estimada = $2, actualizado_en = NOW() WHERE id = $3`,
          [gerInicio, gerFin, proyecto.id]
        );

        // Log change with old/new dates
        await client.query(
          `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
           VALUES ('proyecto', $1, 'reprogramacion_aprobada', $2, $3, $4)`,
          [
            proyecto.id,
            JSON.stringify({ fecha_inicio_estimada: proyecto.fecha_inicio_estimada, fecha_fin_estimada: proyecto.fecha_fin_estimada }),
            JSON.stringify({ fecha_inicio_estimada: gerInicio, fecha_fin_estimada: gerFin }),
            req.user.id
          ]
        );

        // Notify NT + coordinador_nt
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           SELECT id, 'reprogramacion_aprobada', 'Reprogramación Aprobada',
             $1, $2
           FROM usuarios WHERE rol IN ('nuevas_tecnologias', 'coordinador_nt') AND activo = true`,
          [
            `La reprogramación del proyecto ${proyecto.codigo} fue aprobada por Gerencia. Nuevas fechas: ${gerInicio} - ${gerFin}`,
            JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, reprogramacion_id: repro.id })
          ]
        );
      } else {
        await client.query(
          `UPDATE reprogramaciones SET
            estado = 'rechazada_gerencia',
            gerencia_id = $1,
            fecha_decision_gerencia = NOW(),
            comentario_gerencia = $2
           WHERE id = $3`,
          [req.user.id, comentario || null, repro.id]
        );

        // Notify requester + coordinador_nt
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           SELECT id, 'reprogramacion_rechazada', 'Reprogramación Rechazada por Gerencia',
             $1, $2
           FROM usuarios WHERE (id = $3 OR rol = 'coordinador_nt') AND activo = true`,
          [
            `La reprogramación del proyecto ${proyecto.codigo} fue rechazada por Gerencia`,
            JSON.stringify({ proyecto_id: proyecto.id, codigo: proyecto.codigo, reprogramacion_id: repro.id }),
            repro.solicitante_id
          ]
        );
      }
    });

    logger.info(`Reprogramacion ${repro.id} ${accion} by gerencia ${req.user.email}`);
    res.json({ message: accion === 'aprobar' ? 'Reprogramación aprobada por Gerencia' : 'Reprogramación rechazada por Gerencia' });
  } catch (error) { next(error); }
});

module.exports = router;
