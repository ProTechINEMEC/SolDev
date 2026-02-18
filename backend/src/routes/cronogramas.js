const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const workdays = require('../utils/workdays');

const router = express.Router();

// Gantt chart templates
const GANTT_TEMPLATES = {
  proyecto_web_pequeno: {
    nombre: 'Proyecto Web Pequeño',
    duracion_dias: 20,
    tareas: [
      { nombre: 'Análisis de Requerimientos', duracion: 3, fase: 'analisis', dependencias: [] },
      { nombre: 'Diseño UI/UX', duracion: 4, fase: 'diseno', dependencias: [0] },
      { nombre: 'Desarrollo Frontend', duracion: 6, fase: 'desarrollo', dependencias: [1] },
      { nombre: 'Desarrollo Backend', duracion: 6, fase: 'desarrollo', dependencias: [1] },
      { nombre: 'Integración', duracion: 2, fase: 'desarrollo', dependencias: [2, 3] },
      { nombre: 'Pruebas', duracion: 3, fase: 'pruebas', dependencias: [4] },
      { nombre: 'Documentación', duracion: 2, fase: 'documentacion', dependencias: [5] },
      { nombre: 'Despliegue', duracion: 1, fase: 'entrega', dependencias: [6] }
    ]
  },
  proyecto_web_mediano: {
    nombre: 'Proyecto Web Mediano',
    duracion_dias: 40,
    tareas: [
      { nombre: 'Levantamiento de Requerimientos', duracion: 5, fase: 'analisis', dependencias: [] },
      { nombre: 'Análisis Técnico', duracion: 3, fase: 'analisis', dependencias: [0] },
      { nombre: 'Arquitectura de Solución', duracion: 3, fase: 'diseno', dependencias: [1] },
      { nombre: 'Diseño de Base de Datos', duracion: 3, fase: 'diseno', dependencias: [1] },
      { nombre: 'Diseño UI/UX', duracion: 5, fase: 'diseno', dependencias: [2] },
      { nombre: 'Sprint 1 - Core', duracion: 10, fase: 'desarrollo', dependencias: [3, 4] },
      { nombre: 'Sprint 2 - Features', duracion: 10, fase: 'desarrollo', dependencias: [5] },
      { nombre: 'Pruebas Unitarias', duracion: 3, fase: 'pruebas', dependencias: [6] },
      { nombre: 'Pruebas de Integración', duracion: 3, fase: 'pruebas', dependencias: [7] },
      { nombre: 'UAT', duracion: 5, fase: 'pruebas', dependencias: [8] },
      { nombre: 'Documentación', duracion: 3, fase: 'documentacion', dependencias: [9] },
      { nombre: 'Capacitación', duracion: 2, fase: 'entrega', dependencias: [10] },
      { nombre: 'Despliegue Producción', duracion: 2, fase: 'entrega', dependencias: [11] }
    ]
  },
  proyecto_movil: {
    nombre: 'Proyecto Móvil',
    duracion_dias: 45,
    tareas: [
      { nombre: 'Análisis de Requerimientos', duracion: 4, fase: 'analisis', dependencias: [] },
      { nombre: 'Diseño UX Mobile', duracion: 5, fase: 'diseno', dependencias: [0] },
      { nombre: 'Diseño UI Mobile', duracion: 5, fase: 'diseno', dependencias: [1] },
      { nombre: 'Arquitectura App', duracion: 3, fase: 'diseno', dependencias: [0] },
      { nombre: 'Desarrollo API', duracion: 10, fase: 'desarrollo', dependencias: [3] },
      { nombre: 'Desarrollo App - Core', duracion: 12, fase: 'desarrollo', dependencias: [2, 4] },
      { nombre: 'Desarrollo App - Features', duracion: 10, fase: 'desarrollo', dependencias: [5] },
      { nombre: 'Pruebas en Dispositivos', duracion: 5, fase: 'pruebas', dependencias: [6] },
      { nombre: 'Pruebas de Performance', duracion: 3, fase: 'pruebas', dependencias: [7] },
      { nombre: 'Corrección de Bugs', duracion: 4, fase: 'pruebas', dependencias: [8] },
      { nombre: 'Publicación App Store', duracion: 3, fase: 'entrega', dependencias: [9] },
      { nombre: 'Documentación', duracion: 2, fase: 'documentacion', dependencias: [9] }
    ]
  },
  automatizacion: {
    nombre: 'Automatización de Procesos',
    duracion_dias: 30,
    tareas: [
      { nombre: 'Mapeo de Proceso Actual', duracion: 3, fase: 'analisis', dependencias: [] },
      { nombre: 'Identificación de Mejoras', duracion: 2, fase: 'analisis', dependencias: [0] },
      { nombre: 'Diseño de Automatización', duracion: 4, fase: 'diseno', dependencias: [1] },
      { nombre: 'Desarrollo de Scripts', duracion: 8, fase: 'desarrollo', dependencias: [2] },
      { nombre: 'Integración con Sistemas', duracion: 5, fase: 'desarrollo', dependencias: [3] },
      { nombre: 'Pruebas de Automatización', duracion: 4, fase: 'pruebas', dependencias: [4] },
      { nombre: 'Ajustes y Optimización', duracion: 3, fase: 'pruebas', dependencias: [5] },
      { nombre: 'Documentación Técnica', duracion: 2, fase: 'documentacion', dependencias: [6] },
      { nombre: 'Capacitación Usuarios', duracion: 2, fase: 'entrega', dependencias: [7] },
      { nombre: 'Puesta en Producción', duracion: 1, fase: 'entrega', dependencias: [8] }
    ]
  },
  integracion: {
    nombre: 'Integración de Sistemas',
    duracion_dias: 35,
    tareas: [
      { nombre: 'Análisis de Sistemas', duracion: 4, fase: 'analisis', dependencias: [] },
      { nombre: 'Mapeo de Datos', duracion: 3, fase: 'analisis', dependencias: [0] },
      { nombre: 'Diseño de Interfaces', duracion: 4, fase: 'diseno', dependencias: [1] },
      { nombre: 'Desarrollo de Conectores', duracion: 8, fase: 'desarrollo', dependencias: [2] },
      { nombre: 'Transformación de Datos', duracion: 5, fase: 'desarrollo', dependencias: [3] },
      { nombre: 'Desarrollo de APIs', duracion: 6, fase: 'desarrollo', dependencias: [2] },
      { nombre: 'Pruebas de Integración', duracion: 5, fase: 'pruebas', dependencias: [4, 5] },
      { nombre: 'Pruebas de Carga', duracion: 3, fase: 'pruebas', dependencias: [6] },
      { nombre: 'Documentación Técnica', duracion: 3, fase: 'documentacion', dependencias: [7] },
      { nombre: 'Go-Live', duracion: 2, fase: 'entrega', dependencias: [8] }
    ]
  }
};

// Validation schemas - Duration-based (dates calculated when scheduling)
const tareaSchema = Joi.object({
  id: Joi.string().optional(),
  nombre: Joi.string().required().messages({
    'string.empty': 'El nombre de la tarea es requerido',
    'any.required': 'El nombre de la tarea es requerido'
  }),
  duracion_dias: Joi.number().integer().min(1).required().messages({
    'number.base': 'La duración debe ser un número',
    'number.min': 'La duración mínima es 1 día',
    'any.required': 'La duración es requerida'
  }),
  fase: Joi.string().valid('analisis', 'diseno', 'desarrollo', 'pruebas', 'documentacion', 'entrega').required().messages({
    'any.only': 'La fase debe ser: análisis, diseño, desarrollo, pruebas, documentación o entrega',
    'any.required': 'La fase es requerida'
  }),
  dependencias: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())).optional().default([]),
  progreso: Joi.number().min(0).max(100).default(0),
  orden: Joi.number().integer().optional(),
  color: Joi.string().optional(),
  descripcion: Joi.string().allow('', null).optional(),
  asignado_id: Joi.number().integer().allow(null).optional()
});

const createCronogramaSchema = Joi.object({
  evaluacion_id: Joi.number().integer().required().messages({
    'number.base': 'ID de evaluación inválido',
    'any.required': 'Se requiere el ID de la evaluación'
  }),
  nombre: Joi.string().optional().default('Cronograma del Proyecto'),
  tareas: Joi.array().items(tareaSchema).min(1).required().messages({
    'array.min': 'Debe agregar al menos una tarea',
    'any.required': 'Las tareas son requeridas'
  })
});

const updateCronogramaSchema = Joi.object({
  nombre: Joi.string().optional(),
  tareas: Joi.array().items(tareaSchema).optional()
});

// GET /api/cronogramas/templates - Get available templates
router.get('/templates', authenticate, async (req, res) => {
  const templates = Object.entries(GANTT_TEMPLATES).map(([key, value]) => ({
    id: key,
    nombre: value.nombre,
    duracion_dias: value.duracion_dias,
    num_tareas: value.tareas.length
  }));

  res.json({ templates });
});

// GET /api/cronogramas/festivos/:year - Get Colombian holidays for a year
router.get('/festivos/:year', authenticate, async (req, res) => {
  const { year } = req.params;
  const yearNum = parseInt(year, 10);

  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return res.status(400).json({ error: 'Año inválido' });
  }

  const holidays = workdays.getHolidayList(yearNum);

  res.json({
    year: yearNum,
    festivos: holidays.map(h => ({
      fecha: h.fecha.toISOString().split('T')[0],
      nombre: h.nombre,
      dia_semana: h.fecha.toLocaleDateString('es-CO', { weekday: 'long' })
    }))
  });
});

// POST /api/cronogramas/calcular-fechas - Calculate project dates
router.post('/calcular-fechas', authenticate, async (req, res, next) => {
  try {
    const { fecha_inicio, duracion_dias, usar_dias_habiles = true } = req.body;

    if (!fecha_inicio || !duracion_dias) {
      throw new AppError('Se requiere fecha_inicio y duracion_dias', 400);
    }

    const inputDate = new Date(fecha_inicio);
    const startDate = usar_dias_habiles ? workdays.getNextWorkday(inputDate) : inputDate;

    let endDate;
    if (usar_dias_habiles) {
      endDate = workdays.addWorkdays(startDate, duracion_dias - 1);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duracion_dias - 1);
    }

    const diasCalendario = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const diasHabiles = usar_dias_habiles
      ? workdays.getWorkdaysBetween(startDate, endDate)
      : duracion_dias;

    res.json({
      fecha_inicio: startDate.toISOString().split('T')[0],
      fecha_fin: endDate.toISOString().split('T')[0],
      dias_habiles: diasHabiles,
      dias_calendario: diasCalendario,
      usa_dias_habiles: usar_dias_habiles
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cronogramas/templates/:id - Get specific template with tasks (duration-only)
router.get('/templates/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const template = GANTT_TEMPLATES[id];
    if (!template) {
      throw new AppError('Plantilla no encontrada', 404);
    }

    // Build tasks with duration only (no dates - dates calculated when scheduling)
    const tareas = template.tareas.map((tarea, index) => ({
      id: `task-${index}`,
      nombre: tarea.nombre,
      duracion_dias: tarea.duracion,
      fase: tarea.fase,
      progreso: 0,
      dependencias: tarea.dependencias.map(d => `task-${d}`),
      orden: index,
      asignado_id: null
    }));

    // Calculate total duration considering dependencies (sequential vs parallel)
    // This is an estimate - actual dates depend on scheduling
    const duracionTotal = template.duracion_dias;

    res.json({
      template: {
        id,
        nombre: template.nombre,
        duracion_dias_estimada: duracionTotal,
        tareas
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cronogramas/:id - Get cronograma by ID
router.get('/:id', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, e.solicitud_id
       FROM cronogramas c
       JOIN evaluaciones_nt e ON c.evaluacion_id = e.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Cronograma no encontrado', 404);
    }

    const cronograma = result.rows[0];

    // Get tasks with assigned user info
    const tareas = await pool.query(
      `SELECT ct.*, u.nombre as asignado_nombre, u.email as asignado_email
       FROM cronograma_tareas ct
       LEFT JOIN usuarios u ON ct.asignado_id = u.id
       WHERE ct.cronograma_id = $1
       ORDER BY ct.orden`,
      [id]
    );

    res.json({
      cronograma,
      tareas: tareas.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cronogramas - Create cronograma (duration-only, no dates)
router.post('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { error, value } = createCronogramaSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check evaluation exists and is editable
    const evalResult = await pool.query(
      'SELECT * FROM evaluaciones_nt WHERE id = $1',
      [value.evaluacion_id]
    );

    if (evalResult.rows.length === 0) {
      throw new AppError('Evaluación no encontrada', 404);
    }

    if (evalResult.rows[0].estado !== 'borrador') {
      throw new AppError('Solo se puede modificar evaluaciones en estado borrador', 400);
    }

    // Check if cronograma already exists
    const existingCronograma = await pool.query(
      'SELECT id FROM cronogramas WHERE evaluacion_id = $1',
      [value.evaluacion_id]
    );

    if (existingCronograma.rows.length > 0) {
      throw new AppError('Ya existe un cronograma para esta evaluación', 400);
    }

    // Calculate total estimated duration from tasks
    const duracionTotal = value.tareas.reduce((sum, t) => sum + (t.duracion_dias || 0), 0);

    await withTransaction(async (client) => {
      // Create cronograma (no dates - dates set when scheduling)
      const cronogramaResult = await client.query(
        `INSERT INTO cronogramas (evaluacion_id, nombre, duracion_dias_habiles)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [value.evaluacion_id, value.nombre || 'Cronograma del Proyecto', duracionTotal]
      );

      const cronograma = cronogramaResult.rows[0];

      // Create tasks (duration-only, no dates)
      for (let i = 0; i < value.tareas.length; i++) {
        const tarea = value.tareas[i];
        await client.query(
          `INSERT INTO cronograma_tareas (
            cronograma_id, titulo, duracion_dias, progreso, fase, dependencias, orden, asignado_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            cronograma.id,
            tarea.nombre,
            tarea.duracion_dias,
            tarea.progreso || 0,
            tarea.fase,
            JSON.stringify(tarea.dependencias || []),
            tarea.orden ?? i,
            tarea.asignado_id || null
          ]
        );
      }

      // Get tasks for response
      const tareas = await client.query(
        'SELECT * FROM cronograma_tareas WHERE cronograma_id = $1 ORDER BY orden',
        [cronograma.id]
      );

      logger.info(`Cronograma created for evaluation ${value.evaluacion_id}`);

      res.status(201).json({
        message: 'Cronograma creado',
        cronograma,
        tareas: tareas.rows
      });
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/cronogramas/:id - Update cronograma (duration-only)
router.put('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateCronogramaSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check cronograma exists and evaluation is editable
    const existing = await pool.query(
      `SELECT c.*, e.estado as eval_estado
       FROM cronogramas c
       JOIN evaluaciones_nt e ON c.evaluacion_id = e.id
       WHERE c.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Cronograma no encontrado', 404);
    }

    if (existing.rows[0].eval_estado !== 'borrador') {
      throw new AppError('Solo se puede modificar evaluaciones en estado borrador', 400);
    }

    await withTransaction(async (client) => {
      // Update cronograma
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (value.nombre) {
        updates.push(`nombre = $${paramIndex++}`);
        params.push(value.nombre);
      }

      // Calculate total duration if tasks are provided
      if (value.tareas) {
        const duracionTotal = value.tareas.reduce((sum, t) => sum + (t.duracion_dias || 0), 0);
        updates.push(`duracion_dias_habiles = $${paramIndex++}`);
        params.push(duracionTotal);
      }

      if (updates.length > 0) {
        updates.push(`actualizado_en = NOW()`);
        params.push(id);
        await client.query(
          `UPDATE cronogramas SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          params
        );
      }

      // Update tasks if provided
      if (value.tareas) {
        // Delete existing tasks
        await client.query('DELETE FROM cronograma_tareas WHERE cronograma_id = $1', [id]);

        // Insert new tasks (duration-only)
        for (let i = 0; i < value.tareas.length; i++) {
          const tarea = value.tareas[i];
          await client.query(
            `INSERT INTO cronograma_tareas (
              cronograma_id, titulo, duracion_dias, progreso, fase, dependencias, orden, asignado_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              tarea.nombre,
              tarea.duracion_dias,
              tarea.progreso || 0,
              tarea.fase,
              JSON.stringify(tarea.dependencias || []),
              tarea.orden ?? i,
              tarea.asignado_id || null
            ]
          );
        }
      }

      // Get updated data
      const cronograma = await client.query('SELECT * FROM cronogramas WHERE id = $1', [id]);
      const tareas = await client.query(
        'SELECT * FROM cronograma_tareas WHERE cronograma_id = $1 ORDER BY orden',
        [id]
      );

      res.json({
        message: 'Cronograma actualizado',
        cronograma: cronograma.rows[0],
        tareas: tareas.rows
      });
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cronogramas/:id - Delete cronograma
router.delete('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cronograma exists and evaluation is editable
    const existing = await pool.query(
      `SELECT c.*, e.estado as eval_estado
       FROM cronogramas c
       JOIN evaluaciones_nt e ON c.evaluacion_id = e.id
       WHERE c.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Cronograma no encontrado', 404);
    }

    if (existing.rows[0].eval_estado !== 'borrador') {
      throw new AppError('Solo se puede modificar evaluaciones en estado borrador', 400);
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM cronograma_tareas WHERE cronograma_id = $1', [id]);
      await client.query('DELETE FROM cronogramas WHERE id = $1', [id]);
    });

    res.json({ message: 'Cronograma eliminado' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
