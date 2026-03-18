const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Helper: verify solicitante session token
const verifySolicitanteSession = async (req) => {
  const sessionToken = req.headers['x-session-token'];
  if (!sessionToken) {
    throw new AppError('Token de sesión requerido', 401);
  }
  const result = await pool.query(
    `SELECT s.solicitante_id FROM sesiones_solicitante s
     WHERE s.token = $1 AND s.expira_en > NOW() AND s.activa = true`,
    [sessionToken]
  );
  if (result.rows.length === 0) {
    throw new AppError('Sesión inválida o expirada', 401);
  }
  return result.rows[0].solicitante_id;
};

// Validation schemas
const createSchema = Joi.object({
  tipo: Joi.string().valid('proyecto_nuevo_interno', 'actualizacion').required()
    .messages({ 'any.only': 'Tipo debe ser proyecto_nuevo_interno o actualizacion' }),
  paso_actual: Joi.number().integer().min(0).default(0),
  datos_formulario: Joi.object().required(),
  titulo_borrador: Joi.string().max(200).allow('', null)
});

const updateSchema = Joi.object({
  paso_actual: Joi.number().integer().min(0),
  datos_formulario: Joi.object().required(),
  titulo_borrador: Joi.string().max(200).allow('', null)
});

const MAX_DRAFTS = 3;

// GET /api/borradores - List drafts for authenticated solicitante
router.get('/', async (req, res, next) => {
  try {
    const solicitanteId = await verifySolicitanteSession(req);

    const result = await pool.query(
      `SELECT id, tipo, paso_actual, titulo_borrador, actualizado_en, creado_en
       FROM borradores_solicitud
       WHERE solicitante_id = $1 AND expira_en > NOW()
       ORDER BY actualizado_en DESC`,
      [solicitanteId]
    );

    res.json({ borradores: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/borradores/:id - Get full draft with form data
router.get('/:id', async (req, res, next) => {
  try {
    const solicitanteId = await verifySolicitanteSession(req);
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, tipo, paso_actual, datos_formulario, titulo_borrador, actualizado_en, creado_en
       FROM borradores_solicitud
       WHERE id = $1 AND solicitante_id = $2 AND expira_en > NOW()`,
      [id, solicitanteId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Borrador no encontrado', 404);
    }

    // Also fetch associated files
    const archivos = await pool.query(
      `SELECT id, nombre_original, mime_type, tamano, origen, creado_en
       FROM archivos
       WHERE entidad_tipo = 'borrador' AND entidad_id = $1
       ORDER BY origen, creado_en`,
      [id]
    );

    res.json({
      borrador: result.rows[0],
      archivos: archivos.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/borradores - Create a new draft
router.post('/', async (req, res, next) => {
  try {
    const solicitanteId = await verifySolicitanteSession(req);

    const { error, value } = createSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check draft limit
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM borradores_solicitud
       WHERE solicitante_id = $1 AND expira_en > NOW()`,
      [solicitanteId]
    );
    if (parseInt(countResult.rows[0].total) >= MAX_DRAFTS) {
      throw new AppError(`Máximo de ${MAX_DRAFTS} borradores alcanzado. Elimine uno antes de crear otro.`, 409);
    }

    const result = await pool.query(
      `INSERT INTO borradores_solicitud (solicitante_id, tipo, paso_actual, datos_formulario, titulo_borrador)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tipo, paso_actual, titulo_borrador, actualizado_en, creado_en`,
      [solicitanteId, value.tipo, value.paso_actual, JSON.stringify(value.datos_formulario), value.titulo_borrador || null]
    );

    logger.info(`Draft created for solicitante ${solicitanteId}, type: ${value.tipo}`);
    res.status(201).json({ borrador: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/borradores/:id - Update draft (auto-save and manual save)
router.put('/:id', async (req, res, next) => {
  try {
    const solicitanteId = await verifySolicitanteSession(req);
    const { id } = req.params;

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const result = await pool.query(
      `UPDATE borradores_solicitud
       SET datos_formulario = $1,
           paso_actual = COALESCE($2, paso_actual),
           titulo_borrador = COALESCE($3, titulo_borrador),
           expira_en = NOW() + INTERVAL '30 days'
       WHERE id = $4 AND solicitante_id = $5 AND expira_en > NOW()
       RETURNING id, actualizado_en`,
      [JSON.stringify(value.datos_formulario), value.paso_actual, value.titulo_borrador, id, solicitanteId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Borrador no encontrado', 404);
    }

    res.json({ borrador: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/borradores/:id - Delete draft and associated files
router.delete('/:id', async (req, res, next) => {
  try {
    const solicitanteId = await verifySolicitanteSession(req);
    const { id } = req.params;

    // Verify ownership
    const draft = await pool.query(
      `SELECT id FROM borradores_solicitud WHERE id = $1 AND solicitante_id = $2`,
      [id, solicitanteId]
    );
    if (draft.rows.length === 0) {
      throw new AppError('Borrador no encontrado', 404);
    }

    // Delete associated files from disk and database
    const archivos = await pool.query(
      `SELECT id, ruta FROM archivos WHERE entidad_tipo = 'borrador' AND entidad_id = $1`,
      [id]
    );
    for (const archivo of archivos.rows) {
      try {
        const filePath = path.resolve(archivo.ruta);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        logger.warn(`Failed to delete file ${archivo.ruta}: ${err.message}`);
      }
    }
    await pool.query(
      `DELETE FROM archivos WHERE entidad_tipo = 'borrador' AND entidad_id = $1`,
      [id]
    );

    // Delete the draft
    await pool.query(
      `DELETE FROM borradores_solicitud WHERE id = $1 AND solicitante_id = $2`,
      [id, solicitanteId]
    );

    logger.info(`Draft ${id} deleted for solicitante ${solicitanteId}`);
    res.json({ message: 'Borrador eliminado' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
