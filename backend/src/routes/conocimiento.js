const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createArticuloSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).max(200).optional(),
  resumen: Joi.string().max(500).optional(),
  contenido: Joi.string().min(10).required(),
  categoria_id: Joi.number().integer().optional(),
  etiquetas: Joi.array().items(Joi.string()).optional(),
  publicado: Joi.boolean().default(false)
});

const updateArticuloSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).optional(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).max(200).optional(),
  resumen: Joi.string().max(500).optional(),
  contenido: Joi.string().min(10).optional(),
  categoria_id: Joi.number().integer().optional(),
  etiquetas: Joi.array().items(Joi.string()).optional(),
  publicado: Joi.boolean().optional()
});

// Helper to generate slug
const generateSlug = (titulo) => {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
};

// GET /api/conocimiento/articulos - List articles (public)
router.get('/articulos', optionalAuth, async (req, res, next) => {
  try {
    const {
      categoria_id,
      etiqueta,
      search,
      page = 1,
      limit = 10
    } = req.query;

    let query = `
      SELECT a.id, a.titulo, a.slug, a.resumen, a.etiquetas, a.publicado,
        a.creado_en, a.actualizado_en, a.vistas,
        c.nombre as categoria_nombre,
        u.nombre as autor_nombre
      FROM conocimiento_articulos a
      LEFT JOIN conocimiento_categorias c ON a.categoria_id = c.id
      LEFT JOIN usuarios u ON a.autor_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Non-authenticated users only see published articles
    if (!req.user || req.user.rol !== 'nuevas_tecnologias') {
      query += ` AND a.publicado = true`;
    }

    if (categoria_id) {
      query += ` AND a.categoria_id = $${paramIndex++}`;
      params.push(categoria_id);
    }

    if (etiqueta) {
      query += ` AND $${paramIndex++} = ANY(a.etiquetas)`;
      params.push(etiqueta);
    }

    if (search) {
      query += ` AND (a.titulo ILIKE $${paramIndex} OR a.contenido ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Pagination
    query += ` ORDER BY a.publicado DESC, a.creado_en DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      articulos: result.rows,
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

// GET /api/conocimiento/articulos/:slug - Get single article (public)
router.get('/articulos/:slug', optionalAuth, async (req, res, next) => {
  try {
    const { slug } = req.params;

    let query = `
      SELECT a.*, c.nombre as categoria_nombre, u.nombre as autor_nombre
      FROM conocimiento_articulos a
      LEFT JOIN conocimiento_categorias c ON a.categoria_id = c.id
      LEFT JOIN usuarios u ON a.autor_id = u.id
      WHERE a.slug = $1 OR a.id::text = $1
    `;

    // Non-NT users can only see published
    if (!req.user || req.user.rol !== 'nuevas_tecnologias') {
      query += ` AND a.publicado = true`;
    }

    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      throw new AppError('Artículo no encontrado', 404);
    }

    // Increment view count
    await pool.query(
      'UPDATE conocimiento_articulos SET vistas = vistas + 1 WHERE id = $1',
      [result.rows[0].id]
    );

    // Get related articles
    const articulo = result.rows[0];
    let relacionados = [];

    if (articulo.categoria_id) {
      const relacionadosResult = await pool.query(
        `SELECT id, titulo, slug, resumen FROM conocimiento_articulos
         WHERE categoria_id = $1 AND id != $2 AND publicado = true
         ORDER BY creado_en DESC LIMIT 3`,
        [articulo.categoria_id, articulo.id]
      );
      relacionados = relacionadosResult.rows;
    }

    res.json({
      articulo,
      relacionados
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conocimiento/articulos - Create article (NT only)
router.post('/articulos', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { error, value } = createArticuloSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Generate slug if not provided
    let slug = value.slug || generateSlug(value.titulo);

    // Check slug uniqueness
    const existing = await pool.query(
      'SELECT id FROM conocimiento_articulos WHERE slug = $1',
      [slug]
    );

    if (existing.rows.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const result = await pool.query(
      `INSERT INTO conocimiento_articulos (
        titulo, slug, resumen, contenido, categoria_id, etiquetas, publicado, autor_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        value.titulo,
        slug,
        value.resumen || null,
        value.contenido,
        value.categoria_id || null,
        value.etiquetas || [],
        value.publicado,
        req.user.id
      ]
    );

    logger.info(`Article created: ${result.rows[0].titulo}`);

    res.status(201).json({
      message: 'Artículo creado',
      articulo: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/conocimiento/articulos/:id - Update article (NT only)
router.put('/articulos/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateArticuloSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (value.titulo) {
      updates.push(`titulo = $${paramIndex++}`);
      params.push(value.titulo);
    }

    if (value.slug) {
      // Check slug uniqueness
      const existing = await pool.query(
        'SELECT id FROM conocimiento_articulos WHERE slug = $1 AND id != $2',
        [value.slug, id]
      );
      if (existing.rows.length > 0) {
        throw new AppError('El slug ya está en uso', 409);
      }
      updates.push(`slug = $${paramIndex++}`);
      params.push(value.slug);
    }

    if (value.resumen !== undefined) {
      updates.push(`resumen = $${paramIndex++}`);
      params.push(value.resumen);
    }

    if (value.contenido) {
      updates.push(`contenido = $${paramIndex++}`);
      params.push(value.contenido);
    }

    if (value.categoria_id !== undefined) {
      updates.push(`categoria_id = $${paramIndex++}`);
      params.push(value.categoria_id);
    }

    if (value.etiquetas) {
      updates.push(`etiquetas = $${paramIndex++}`);
      params.push(value.etiquetas);
    }

    if (value.publicado !== undefined) {
      updates.push(`publicado = $${paramIndex++}`);
      params.push(value.publicado);
    }

    if (updates.length === 0) {
      throw new AppError('No hay campos para actualizar', 400);
    }

    updates.push(`actualizado_en = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE conocimiento_articulos SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new AppError('Artículo no encontrado', 404);
    }

    res.json({
      message: 'Artículo actualizado',
      articulo: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/conocimiento/articulos/:id - Delete article (NT only)
router.delete('/articulos/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM conocimiento_articulos WHERE id = $1 RETURNING titulo',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Artículo no encontrado', 404);
    }

    logger.info(`Article deleted: ${result.rows[0].titulo}`);

    res.json({ message: 'Artículo eliminado' });
  } catch (error) {
    next(error);
  }
});

// GET /api/conocimiento/categorias - List categories (public)
router.get('/categorias', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(a.id) as articulos_count
       FROM conocimiento_categorias c
       LEFT JOIN conocimiento_articulos a ON c.id = a.categoria_id AND a.publicado = true
       GROUP BY c.id
       ORDER BY c.orden, c.nombre`
    );

    res.json({ categorias: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/conocimiento/categorias - Create category (NT only)
router.post('/categorias', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { nombre, descripcion, orden = 0 } = req.body;

    if (!nombre || nombre.trim().length < 2) {
      throw new AppError('El nombre es requerido', 400);
    }

    const result = await pool.query(
      `INSERT INTO conocimiento_categorias (nombre, descripcion, orden)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), descripcion || null, orden]
    );

    res.status(201).json({
      message: 'Categoría creada',
      categoria: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/conocimiento/categorias/:id - Update category (NT only)
router.put('/categorias/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, orden } = req.body;

    const result = await pool.query(
      `UPDATE conocimiento_categorias SET
        nombre = COALESCE($1, nombre),
        descripcion = COALESCE($2, descripcion),
        orden = COALESCE($3, orden)
       WHERE id = $4 RETURNING *`,
      [nombre, descripcion, orden, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Categoría no encontrada', 404);
    }

    res.json({
      message: 'Categoría actualizada',
      categoria: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/conocimiento/categorias/:id - Delete category (NT only)
router.delete('/categorias/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if category has articles
    const articles = await pool.query(
      'SELECT COUNT(*) FROM conocimiento_articulos WHERE categoria_id = $1',
      [id]
    );

    if (parseInt(articles.rows[0].count, 10) > 0) {
      throw new AppError('No se puede eliminar una categoría con artículos', 400);
    }

    const result = await pool.query(
      'DELETE FROM conocimiento_categorias WHERE id = $1 RETURNING nombre',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Categoría no encontrada', 404);
    }

    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    next(error);
  }
});

// GET /api/conocimiento/etiquetas - Get all tags (public)
router.get('/etiquetas', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT unnest(etiquetas) as etiqueta
       FROM conocimiento_articulos WHERE publicado = true
       ORDER BY etiqueta`
    );

    res.json({ etiquetas: result.rows.map(r => r.etiqueta) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
