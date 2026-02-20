const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Helper function to get project ID by codigo
const getProyectoIdByCodigo = async (codigo) => {
  const result = await pool.query('SELECT id FROM proyectos WHERE codigo = $1', [codigo]);
  if (result.rows.length === 0) {
    throw new AppError('Proyecto no encontrado', 404);
  }
  return result.rows[0].id;
};

// Validation schemas
const createTareaSchema = Joi.object({
  titulo: Joi.string().min(3).max(200).required(),
  descripcion: Joi.string().max(1000).optional(),
  fecha_inicio: Joi.date().required(),
  fecha_fin: Joi.date().min(Joi.ref('fecha_inicio')).required(),
  asignado_id: Joi.number().integer().optional(),
  progreso: Joi.number().min(0).max(100).default(0),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#1890ff')
});

const updateProyectoSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).optional(),
  descripcion: Joi.string().max(2000).optional(),
  fecha_inicio_estimada: Joi.date().optional(),
  fecha_fin_estimada: Joi.date().optional(),
  presupuesto_estimado: Joi.number().positive().optional(),
  datos_proyecto: Joi.object().optional()
});

// GET /api/proyectos/public - List projects for public forms (actualizacion, etc.)
// Returns only basic info: codigo, nombre, estado - no authentication required
router.get('/public', async (req, res, next) => {
  try {
    const query = `
      SELECT
        codigo,
        titulo as nombre,
        estado
      FROM proyectos
      WHERE estado IN ('completado', 'en_desarrollo')
      ORDER BY titulo ASC
    `;

    const result = await pool.query(query);

    res.json({
      proyectos: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/proyectos - List projects
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      estado,
      responsable_id,
      search,
      page = 1,
      limit = 20
    } = req.query;

    let query = `
      SELECT p.*,
        s.codigo as solicitud_codigo,
        s.tipo as solicitud_tipo,
        u.nombre as responsable_nombre,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id) as total_tareas,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id AND completada = true) as tareas_completadas
      FROM proyectos p
      LEFT JOIN solicitudes s ON p.solicitud_id = s.id
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (estado) {
      const estados = estado.split(',');
      query += ` AND p.estado = ANY($${paramIndex++})`;
      params.push(estados);
    }

    if (responsable_id) {
      query += ` AND p.responsable_id = $${paramIndex++}`;
      params.push(responsable_id);
    }

    if (search) {
      query += ` AND (p.titulo ILIKE $${paramIndex} OR p.codigo ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Role-based filtering
    if (req.user.rol === 'ti') {
      // TI can only see projects they're members of
      query += ` AND (p.responsable_id = $${paramIndex} OR EXISTS (
        SELECT 1 FROM proyecto_miembros pm WHERE pm.proyecto_id = p.id AND pm.usuario_id = $${paramIndex}
      ))`;
      params.push(req.user.id);
      paramIndex++;
    }

    // Count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Pagination
    query += ` ORDER BY p.creado_en DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      proyectos: result.rows,
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

// GET /api/proyectos/:codigo - Get single project
router.get('/:codigo', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const result = await pool.query(
      `SELECT p.*,
        s.codigo as solicitud_codigo,
        s.tipo as solicitud_tipo,
        s.datos_solicitante,
        u.nombre as responsable_nombre,
        u.email as responsable_email
       FROM proyectos p
       LEFT JOIN solicitudes s ON p.solicitud_id = s.id
       LEFT JOIN usuarios u ON p.responsable_id = u.id
       WHERE p.codigo = $1`,
      [codigo]
    );

    if (result.rows.length === 0) {
      throw new AppError('Proyecto no encontrado', 404);
    }

    const proyecto = result.rows[0];

    // Get team members
    const miembros = await pool.query(
      `SELECT pm.*, u.nombre, u.email, u.rol
       FROM proyecto_miembros pm
       JOIN usuarios u ON pm.usuario_id = u.id
       WHERE pm.proyecto_id = $1`,
      [proyecto.id]
    );

    // Get tasks for Gantt
    const tareas = await pool.query(
      `SELECT pt.*, u.nombre as asignado_nombre
       FROM proyecto_tareas pt
       LEFT JOIN usuarios u ON pt.asignado_id = u.id
       WHERE pt.proyecto_id = $1
       ORDER BY pt.fecha_inicio`,
      [proyecto.id]
    );

    // Get comments
    const comentarios = await pool.query(
      `SELECT c.*, u.nombre as autor_nombre
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.entidad_tipo = 'proyecto' AND c.entidad_id = $1
       ORDER BY c.creado_en DESC`,
      [proyecto.id]
    );

    res.json({
      proyecto,
      miembros: miembros.rows,
      tareas: tareas.rows,
      comentarios: comentarios.rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/proyectos/:codigo - Update project
router.put('/:codigo', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getProyectoIdByCodigo(codigo);
    const { error, value } = updateProyectoSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check project exists
    const existing = await pool.query('SELECT * FROM proyectos WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError('Proyecto no encontrado', 404);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        params.push(key === 'datos_proyecto' ? JSON.stringify(val) : val);
      }
    });

    if (updates.length === 0) {
      throw new AppError('No hay campos para actualizar', 400);
    }

    updates.push(`actualizado_en = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE proyectos SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    // Log change
    await pool.query(
      `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
       VALUES ('proyecto', $1, 'actualizar', $2, $3, $4)`,
      [id, JSON.stringify(existing.rows[0]), JSON.stringify(result.rows[0]), req.user.id]
    );

    res.json({
      message: 'Proyecto actualizado',
      proyecto: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/proyectos/:codigo/estado - Change project state
router.put('/:codigo/estado', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getProyectoIdByCodigo(codigo);
    const { estado, comentario } = req.body;

    const validStates = ['planificacion', 'en_desarrollo', 'pausado', 'completado', 'cancelado'];
    if (!validStates.includes(estado)) {
      throw new AppError('Estado inválido', 400);
    }

    const existing = await pool.query('SELECT * FROM proyectos WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError('Proyecto no encontrado', 404);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE proyectos SET estado = $1, actualizado_en = NOW() WHERE id = $2`,
        [estado, id]
      );

      // Also update related solicitud if completed or cancelled
      if (estado === 'completado') {
        await client.query(
          `UPDATE solicitudes SET estado = 'completado', actualizado_en = NOW()
           WHERE id = (SELECT solicitud_id FROM proyectos WHERE id = $1)`,
          [id]
        );
      } else if (estado === 'cancelado') {
        await client.query(
          `UPDATE solicitudes SET estado = 'cancelado', actualizado_en = NOW()
           WHERE id = (SELECT solicitud_id FROM proyectos WHERE id = $1)`,
          [id]
        );
      }

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('proyecto', $1, 'cambio_estado', $2, $3, $4)`,
        [id, JSON.stringify({ estado: existing.rows[0].estado }), JSON.stringify({ estado, comentario }), req.user.id]
      );

      if (comentario) {
        await client.query(
          `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
           VALUES ('proyecto', $1, $2, $3, 'cambio_estado')`,
          [id, req.user.id, comentario]
        );
      }
    });

    logger.info(`Project ${existing.rows[0].codigo} state changed to ${estado}`);

    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    next(error);
  }
});

// GET /api/proyectos/:codigo/tareas - Get project tasks (Gantt data)
router.get('/:codigo/tareas', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getProyectoIdByCodigo(codigo);

    const result = await pool.query(
      `SELECT pt.*, u.nombre as asignado_nombre
       FROM proyecto_tareas pt
       LEFT JOIN usuarios u ON pt.asignado_id = u.id
       WHERE pt.proyecto_id = $1
       ORDER BY pt.fecha_inicio`,
      [id]
    );

    res.json({ tareas: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/proyectos/:codigo/tareas - Create task
router.post('/:codigo/tareas', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getProyectoIdByCodigo(codigo);
    const { error, value } = createTareaSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const result = await pool.query(
      `INSERT INTO proyecto_tareas (
        proyecto_id, titulo, descripcion, fecha_inicio, fecha_fin,
        asignado_id, progreso, color
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [id, value.titulo, value.descripcion, value.fecha_inicio, value.fecha_fin,
       value.asignado_id, value.progreso, value.color]
    );

    res.status(201).json({
      message: 'Tarea creada',
      tarea: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/proyectos/:codigo/tareas/:tareaId - Update task
router.put('/:codigo/tareas/:tareaId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo, tareaId } = req.params;
    const id = await getProyectoIdByCodigo(codigo);
    const { titulo, descripcion, fecha_inicio, fecha_fin, asignado_id, progreso, color, completada } = req.body;

    const result = await pool.query(
      `UPDATE proyecto_tareas SET
        titulo = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        fecha_inicio = COALESCE($3, fecha_inicio),
        fecha_fin = COALESCE($4, fecha_fin),
        asignado_id = COALESCE($5, asignado_id),
        progreso = COALESCE($6, progreso),
        color = COALESCE($7, color),
        completada = COALESCE($8, completada),
        actualizado_en = NOW()
       WHERE id = $9 AND proyecto_id = $10
       RETURNING *`,
      [titulo, descripcion, fecha_inicio, fecha_fin, asignado_id, progreso, color, completada, tareaId, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Tarea no encontrada', 404);
    }

    res.json({
      message: 'Tarea actualizada',
      tarea: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/proyectos/:codigo/tareas/:tareaId - Delete task
router.delete('/:codigo/tareas/:tareaId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo, tareaId } = req.params;
    const id = await getProyectoIdByCodigo(codigo);

    const result = await pool.query(
      'DELETE FROM proyecto_tareas WHERE id = $1 AND proyecto_id = $2 RETURNING id',
      [tareaId, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Tarea no encontrada', 404);
    }

    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    next(error);
  }
});

// GET /api/proyectos/:codigo/miembros - Get team members
router.get('/:codigo/miembros', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getProyectoIdByCodigo(codigo);

    const result = await pool.query(
      `SELECT pm.*, u.nombre, u.email, u.rol
       FROM proyecto_miembros pm
       JOIN usuarios u ON pm.usuario_id = u.id
       WHERE pm.proyecto_id = $1`,
      [id]
    );

    res.json({ miembros: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/proyectos/:codigo/miembros - Add team member
router.post('/:codigo/miembros', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const id = await getProyectoIdByCodigo(codigo);
    const { usuario_id, rol_proyecto } = req.body;

    if (!usuario_id) {
      throw new AppError('usuario_id es requerido', 400);
    }

    // Verify user exists
    const user = await pool.query('SELECT id, nombre FROM usuarios WHERE id = $1 AND activo = true', [usuario_id]);
    if (user.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const result = await pool.query(
      `INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol_proyecto)
       VALUES ($1, $2, $3)
       ON CONFLICT (proyecto_id, usuario_id) DO UPDATE SET rol_proyecto = $3
       RETURNING *`,
      [id, usuario_id, rol_proyecto || 'miembro']
    );

    res.status(201).json({
      message: 'Miembro agregado',
      miembro: {
        ...result.rows[0],
        nombre: user.rows[0].nombre
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/proyectos/:codigo/miembros/:userId - Remove team member
router.delete('/:codigo/miembros/:userId', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo, userId } = req.params;
    const id = await getProyectoIdByCodigo(codigo);

    const result = await pool.query(
      'DELETE FROM proyecto_miembros WHERE proyecto_id = $1 AND usuario_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Miembro no encontrado', 404);
    }

    res.json({ message: 'Miembro eliminado' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
