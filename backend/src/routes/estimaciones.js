const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const detalleDesarrolloSchema = Joi.object({
  concepto: Joi.string().required(),
  horas: Joi.number().min(0).required(),
  tarifa_hora: Joi.number().min(0).required(),
  subtotal: Joi.number().min(0).required()
});

const detalleInfraestructuraSchema = Joi.object({
  concepto: Joi.string().required(),
  descripcion: Joi.string().allow('', null).optional(),
  costo_mensual: Joi.number().min(0).optional(),
  meses: Joi.number().min(1).optional(),
  costo_unico: Joi.number().min(0).optional(),
  subtotal: Joi.number().min(0).required()
});

const detalleExternoSchema = Joi.object({
  concepto: Joi.string().required(),
  proveedor: Joi.string().allow('', null).optional(),
  descripcion: Joi.string().allow('', null).optional(),
  monto: Joi.number().min(0).required()
});

const createEstimacionSchema = Joi.object({
  evaluacion_id: Joi.number().integer().required(),
  desarrollo_interno: Joi.array().items(detalleDesarrolloSchema).optional(),
  infraestructura: Joi.array().items(detalleInfraestructuraSchema).optional(),
  servicios_externos: Joi.array().items(detalleExternoSchema).optional(),
  contingencia_porcentaje: Joi.number().min(0).max(50).default(10),
  notas: Joi.string().allow('', null).optional()
});

const updateEstimacionSchema = Joi.object({
  desarrollo_interno: Joi.array().items(detalleDesarrolloSchema).optional(),
  infraestructura: Joi.array().items(detalleInfraestructuraSchema).optional(),
  servicios_externos: Joi.array().items(detalleExternoSchema).optional(),
  contingencia_porcentaje: Joi.number().min(0).max(50).optional(),
  notas: Joi.string().allow('', null).optional()
});

// Calculate totals helper
const calculateTotals = (data) => {
  const desarrollo = (data.desarrollo_interno || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const infraestructura = (data.infraestructura || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const externos = (data.servicios_externos || []).reduce((sum, item) => sum + (item.monto || 0), 0);

  const subtotal = desarrollo + infraestructura + externos;
  const contingencia = subtotal * ((data.contingencia_porcentaje || 10) / 100);
  const total = subtotal + contingencia;

  return {
    subtotal_desarrollo: desarrollo,
    subtotal_infraestructura: infraestructura,
    subtotal_externos: externos,
    subtotal,
    contingencia,
    total
  };
};

// GET /api/estimaciones/:id - Get cost estimation by ID
router.get('/:id', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT e.*, ev.solicitud_id
       FROM estimaciones_costo e
       JOIN evaluaciones_nt ev ON e.evaluacion_id = ev.id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Estimación no encontrada', 404);
    }

    res.json({ estimacion: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/estimaciones/evaluacion/:evaluacionId - Get estimation by evaluation
router.get('/evaluacion/:evaluacionId', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { evaluacionId } = req.params;

    const result = await pool.query(
      'SELECT * FROM estimaciones_costo WHERE evaluacion_id = $1',
      [evaluacionId]
    );

    res.json({ estimacion: result.rows[0] || null });
  } catch (error) {
    next(error);
  }
});

// POST /api/estimaciones - Create cost estimation
router.post('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { error, value } = createEstimacionSchema.validate(req.body);
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

    // Check if estimation already exists
    const existingEstimacion = await pool.query(
      'SELECT id FROM estimaciones_costo WHERE evaluacion_id = $1',
      [value.evaluacion_id]
    );

    if (existingEstimacion.rows.length > 0) {
      throw new AppError('Ya existe una estimación para esta evaluación', 400);
    }

    // Calculate totals
    const totals = calculateTotals(value);

    const result = await pool.query(
      `INSERT INTO estimaciones_costo (
        evaluacion_id, desarrollo_interno, infraestructura, servicios_externos,
        contingencia_porcentaje, subtotal_desarrollo, subtotal_infraestructura,
        subtotal_externos, subtotal, contingencia, total, notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        value.evaluacion_id,
        JSON.stringify(value.desarrollo_interno || []),
        JSON.stringify(value.infraestructura || []),
        JSON.stringify(value.servicios_externos || []),
        value.contingencia_porcentaje,
        totals.subtotal_desarrollo,
        totals.subtotal_infraestructura,
        totals.subtotal_externos,
        totals.subtotal,
        totals.contingencia,
        totals.total,
        value.notas
      ]
    );

    logger.info(`Cost estimation created for evaluation ${value.evaluacion_id}`);

    res.status(201).json({
      message: 'Estimación de costos creada',
      estimacion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/estimaciones/:id - Update cost estimation
router.put('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateEstimacionSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check estimation exists and evaluation is editable
    const existing = await pool.query(
      `SELECT e.*, ev.estado as eval_estado
       FROM estimaciones_costo e
       JOIN evaluaciones_nt ev ON e.evaluacion_id = ev.id
       WHERE e.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Estimación no encontrada', 404);
    }

    if (existing.rows[0].eval_estado !== 'borrador') {
      throw new AppError('Solo se puede modificar evaluaciones en estado borrador', 400);
    }

    // Merge with existing data
    const currentData = existing.rows[0];
    const mergedData = {
      desarrollo_interno: value.desarrollo_interno !== undefined
        ? value.desarrollo_interno
        : (typeof currentData.desarrollo_interno === 'string'
            ? JSON.parse(currentData.desarrollo_interno)
            : currentData.desarrollo_interno),
      infraestructura: value.infraestructura !== undefined
        ? value.infraestructura
        : (typeof currentData.infraestructura === 'string'
            ? JSON.parse(currentData.infraestructura)
            : currentData.infraestructura),
      servicios_externos: value.servicios_externos !== undefined
        ? value.servicios_externos
        : (typeof currentData.servicios_externos === 'string'
            ? JSON.parse(currentData.servicios_externos)
            : currentData.servicios_externos),
      contingencia_porcentaje: value.contingencia_porcentaje !== undefined
        ? value.contingencia_porcentaje
        : currentData.contingencia_porcentaje
    };

    // Recalculate totals
    const totals = calculateTotals(mergedData);

    const result = await pool.query(
      `UPDATE estimaciones_costo SET
        desarrollo_interno = $1,
        infraestructura = $2,
        servicios_externos = $3,
        contingencia_porcentaje = $4,
        subtotal_desarrollo = $5,
        subtotal_infraestructura = $6,
        subtotal_externos = $7,
        subtotal = $8,
        contingencia = $9,
        total = $10,
        notas = COALESCE($11, notas),
        actualizado_en = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        JSON.stringify(mergedData.desarrollo_interno || []),
        JSON.stringify(mergedData.infraestructura || []),
        JSON.stringify(mergedData.servicios_externos || []),
        mergedData.contingencia_porcentaje,
        totals.subtotal_desarrollo,
        totals.subtotal_infraestructura,
        totals.subtotal_externos,
        totals.subtotal,
        totals.contingencia,
        totals.total,
        value.notas,
        id
      ]
    );

    res.json({
      message: 'Estimación actualizada',
      estimacion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/estimaciones/:id - Delete cost estimation
router.delete('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check estimation exists and evaluation is editable
    const existing = await pool.query(
      `SELECT e.*, ev.estado as eval_estado
       FROM estimaciones_costo e
       JOIN evaluaciones_nt ev ON e.evaluacion_id = ev.id
       WHERE e.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Estimación no encontrada', 404);
    }

    if (existing.rows[0].eval_estado !== 'borrador') {
      throw new AppError('Solo se puede modificar evaluaciones en estado borrador', 400);
    }

    await pool.query('DELETE FROM estimaciones_costo WHERE id = $1', [id]);

    res.json({ message: 'Estimación eliminada' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
