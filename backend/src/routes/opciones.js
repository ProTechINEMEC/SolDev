const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createOpcionSchema = Joi.object({
  categoria: Joi.string().required().max(50),
  valor: Joi.string().required().max(100),
  etiqueta: Joi.string().required().max(200),
  padre_id: Joi.number().integer().allow(null),
  orden: Joi.number().integer().default(0)
});

const updateOpcionSchema = Joi.object({
  valor: Joi.string().max(100),
  etiqueta: Joi.string().max(200),
  padre_id: Joi.number().integer().allow(null),
  orden: Joi.number().integer(),
  activo: Joi.boolean()
});

// GET /api/opciones/:categoria - List options by category (public)
router.get('/:categoria', async (req, res, next) => {
  try {
    const { categoria } = req.params;
    const { includeInactive } = req.query;

    let query = `
      SELECT id, categoria, valor, etiqueta, padre_id, orden, activo, creado_en, actualizado_en
      FROM opciones_formulario
      WHERE categoria = $1
    `;
    const params = [categoria];

    // By default, only return active options
    if (!includeInactive || includeInactive !== 'true') {
      query += ' AND activo = true';
    }

    query += ' ORDER BY orden ASC, etiqueta ASC';

    const result = await pool.query(query, params);

    // Build hierarchical structure for options with children
    const opciones = result.rows;
    const parentOptions = opciones.filter(o => !o.padre_id);
    const childOptions = opciones.filter(o => o.padre_id);

    // Attach children to parents
    const hierarchicalOptions = parentOptions.map(parent => ({
      ...parent,
      children: childOptions.filter(child => child.padre_id === parent.id)
    }));

    res.json({
      categoria,
      opciones: hierarchicalOptions,
      total: opciones.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/opciones - List all categories (NT only)
router.get('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT categoria, COUNT(*) as count
      FROM opciones_formulario
      GROUP BY categoria
      ORDER BY categoria
    `);

    res.json({
      categorias: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/opciones - Create new option (NT only)
router.post('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { error, value } = createOpcionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { categoria, valor, etiqueta, padre_id, orden } = value;

    // Check if valor already exists in this category
    const existing = await pool.query(
      'SELECT id FROM opciones_formulario WHERE categoria = $1 AND valor = $2',
      [categoria, valor]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una opción con ese valor en esta categoría' });
    }

    // If padre_id provided, verify it exists and belongs to same category
    if (padre_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM opciones_formulario WHERE id = $1 AND categoria = $2',
        [padre_id, categoria]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'El padre especificado no existe o no pertenece a la misma categoría' });
      }
    }

    const result = await pool.query(
      `INSERT INTO opciones_formulario (categoria, valor, etiqueta, padre_id, orden)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [categoria, valor, etiqueta, padre_id, orden]
    );

    logger.info(`Opción creada: ${categoria}/${valor} por usuario ${req.user.id}`);

    res.status(201).json({
      message: 'Opción creada exitosamente',
      opcion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/opciones/:id - Update option (NT only)
router.put('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateOpcionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check option exists
    const existing = await pool.query(
      'SELECT * FROM opciones_formulario WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Opción no encontrada' });
    }

    const opcion = existing.rows[0];

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(val);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE opciones_formulario
       SET ${updates.join(', ')}, actualizado_en = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    logger.info(`Opción actualizada: ${opcion.categoria}/${opcion.valor} por usuario ${req.user.id}`);

    res.json({
      message: 'Opción actualizada exitosamente',
      opcion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/opciones/:id - Soft delete option (NT only)
router.delete('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    // Check option exists
    const existing = await pool.query(
      'SELECT * FROM opciones_formulario WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Opción no encontrada' });
    }

    const opcion = existing.rows[0];

    // Check if option has children
    const children = await pool.query(
      'SELECT COUNT(*) FROM opciones_formulario WHERE padre_id = $1 AND activo = true',
      [id]
    );

    if (parseInt(children.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una opción que tiene sub-opciones activas. Elimine primero las sub-opciones.'
      });
    }

    if (permanent === 'true') {
      // Permanent delete (admin only)
      await pool.query('DELETE FROM opciones_formulario WHERE id = $1', [id]);
      logger.info(`Opción eliminada permanentemente: ${opcion.categoria}/${opcion.valor} por usuario ${req.user.id}`);
    } else {
      // Soft delete
      await pool.query(
        'UPDATE opciones_formulario SET activo = false, actualizado_en = NOW() WHERE id = $1',
        [id]
      );
      logger.info(`Opción desactivada: ${opcion.categoria}/${opcion.valor} por usuario ${req.user.id}`);
    }

    res.json({
      message: permanent === 'true' ? 'Opción eliminada permanentemente' : 'Opción desactivada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/opciones/:id/restore - Restore soft-deleted option (NT only)
router.post('/:id/restore', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE opciones_formulario
       SET activo = true, actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opción no encontrada' });
    }

    logger.info(`Opción restaurada: ${result.rows[0].categoria}/${result.rows[0].valor} por usuario ${req.user.id}`);

    res.json({
      message: 'Opción restaurada exitosamente',
      opcion: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/opciones/reorder - Reorder options (NT only)
router.post('/reorder', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { categoria, ordenes } = req.body;
    // ordenes: [{ id: 1, orden: 0 }, { id: 2, orden: 1 }, ...]

    if (!categoria || !Array.isArray(ordenes)) {
      return res.status(400).json({ error: 'Se requiere categoria y un array de ordenes' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const { id, orden } of ordenes) {
        await client.query(
          'UPDATE opciones_formulario SET orden = $1, actualizado_en = NOW() WHERE id = $2 AND categoria = $3',
          [orden, id, categoria]
        );
      }

      await client.query('COMMIT');

      res.json({ message: 'Orden actualizado exitosamente' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
