const express = require('express');
const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { uploadArticlePDFs } = require('../config/multer');

const router = express.Router();

// Validation schemas
const createArticuloSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).max(200).optional(),
  resumen: Joi.string().max(500).optional(),
  contenido: Joi.string().min(10).required(),
  categoria_id: Joi.number().integer().optional(),
  etiquetas: Joi.array().items(Joi.string()).optional(),
  publicado: Joi.boolean().default(false),
  visibilidad: Joi.array().items(Joi.string().valid('public', 'nt', 'ti', 'gerencia')).min(1).default(['public']),
  articulos_relacionados: Joi.array().items(Joi.number().integer()).optional().default([])
});

const updateArticuloSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).optional(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).max(200).optional(),
  resumen: Joi.string().max(500).optional(),
  contenido: Joi.string().min(10).optional(),
  categoria_id: Joi.number().integer().optional(),
  etiquetas: Joi.array().items(Joi.string()).optional(),
  publicado: Joi.boolean().optional(),
  visibilidad: Joi.array().items(Joi.string().valid('public', 'nt', 'ti', 'gerencia')).min(1).optional(),
  articulos_relacionados: Joi.array().items(Joi.number().integer()).optional()
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

// Helper to build visibility filter SQL
const buildVisibilityFilter = (user) => {
  if (!user) {
    // Unauthenticated: only public
    return ` AND a.visibilidad @> '"public"'`;
  }
  const role = user.rol;
  if (role === 'admin') {
    // Admin sees everything
    return '';
  }
  if (role === 'nuevas_tecnologias' || role === 'coordinador_nt') {
    return ` AND (a.visibilidad @> '"public"' OR a.visibilidad @> '"nt"')`;
  }
  if (role === 'ti' || role === 'coordinador_ti') {
    return ` AND (a.visibilidad @> '"public"' OR a.visibilidad @> '"ti"')`;
  }
  if (role === 'gerencia') {
    return ` AND (a.visibilidad @> '"public"' OR a.visibilidad @> '"gerencia"')`;
  }
  // Unknown role: public only
  return ` AND a.visibilidad @> '"public"'`;
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
        a.creado_en, a.actualizado_en, a.vistas, a.visibilidad,
        c.nombre as categoria_nombre,
        u.nombre as autor_nombre
      FROM conocimiento_articulos a
      LEFT JOIN conocimiento_categorias c ON a.categoria_id = c.id
      LEFT JOIN usuarios u ON a.autor_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Only admin, NT, coordinador_nt, coordinador_ti can see unpublished articles
    const canSeeDrafts = ['admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'];
    if (!req.user || !canSeeDrafts.includes(req.user.rol)) {
      query += ` AND a.publicado = true`;
    }

    // Visibility filter
    query += buildVisibilityFilter(req.user);

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

    // Only admin, NT, coordinador_nt, coordinador_ti can see unpublished
    const canSeeDrafts = ['admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'];
    if (!req.user || !canSeeDrafts.includes(req.user.rol)) {
      query += ` AND a.publicado = true`;
    }

    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      throw new AppError('Artículo no encontrado', 404);
    }

    const articulo = result.rows[0];

    // Visibility check
    const visFilter = buildVisibilityFilter(req.user);
    if (visFilter) {
      // Re-check with visibility (simpler than parsing SQL fragment)
      const visCheck = await pool.query(
        `SELECT id FROM conocimiento_articulos a WHERE a.id = $1${visFilter}`,
        [articulo.id]
      );
      if (visCheck.rows.length === 0) {
        throw new AppError('Artículo no encontrado', 404);
      }
    }

    // Increment view count
    await pool.query(
      'UPDATE conocimiento_articulos SET vistas = vistas + 1 WHERE id = $1',
      [articulo.id]
    );

    // Get manually selected related articles (with visibility filtering)
    let relacionados = [];
    if (articulo.articulos_relacionados && articulo.articulos_relacionados.length > 0) {
      const relVisFilter = buildVisibilityFilter(req.user);
      const relacionadosResult = await pool.query(
        `SELECT a.id, a.titulo, a.slug, a.resumen FROM conocimiento_articulos a
         WHERE a.id = ANY($1) AND a.publicado = true${relVisFilter}
         ORDER BY a.titulo`,
        [articulo.articulos_relacionados]
      );
      relacionados = relacionadosResult.rows;
    }

    // Get attached files (PDFs)
    const archivosResult = await pool.query(
      `SELECT id, nombre_original, mime_type, tamano, creado_en
       FROM archivos WHERE entidad_tipo = 'articulo' AND entidad_id = $1
       ORDER BY creado_en`,
      [articulo.id]
    );

    res.json({
      articulo,
      relacionados,
      archivos: archivosResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conocimiento/articulos - Create article
router.post('/articulos', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
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
        titulo, slug, resumen, contenido, categoria_id, etiquetas, publicado, autor_id,
        visibilidad, articulos_relacionados
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        value.titulo,
        slug,
        value.resumen || null,
        value.contenido,
        value.categoria_id || null,
        value.etiquetas || [],
        value.publicado,
        req.user.id,
        JSON.stringify(value.visibilidad),
        value.articulos_relacionados || []
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

// PUT /api/conocimiento/articulos/:id - Update article
router.put('/articulos/:id', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
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

    if (value.visibilidad) {
      updates.push(`visibilidad = $${paramIndex++}`);
      params.push(JSON.stringify(value.visibilidad));
    }

    if (value.articulos_relacionados !== undefined) {
      updates.push(`articulos_relacionados = $${paramIndex++}`);
      params.push(value.articulos_relacionados);
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

// DELETE /api/conocimiento/articulos/:id - Delete article
router.delete('/articulos/:id', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
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

// POST /api/conocimiento/articulos/:id/pdfs - Upload PDFs for an article
router.post('/articulos/:id/pdfs', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), uploadArticlePDFs, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify article exists
    const article = await pool.query('SELECT id FROM conocimiento_articulos WHERE id = $1', [id]);
    if (article.rows.length === 0) {
      throw new AppError('Artículo no encontrado', 404);
    }

    if (!req.files || req.files.length === 0) {
      throw new AppError('No se enviaron archivos', 400);
    }

    // Check current PDF count for this article
    const currentCount = await pool.query(
      `SELECT COUNT(*) FROM archivos WHERE entidad_tipo = 'articulo' AND entidad_id = $1`,
      [id]
    );
    const existing = parseInt(currentCount.rows[0].count, 10);
    if (existing + req.files.length > 5) {
      // Clean up uploaded files
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      });
      throw new AppError(`Máximo 5 PDFs por artículo (ya tiene ${existing})`, 400);
    }

    const inserted = [];
    for (const file of req.files) {
      const result = await pool.query(
        `INSERT INTO archivos (entidad_tipo, entidad_id, nombre_original, nombre_almacenado, mime_type, tamano, ruta, subido_por)
         VALUES ('articulo', $1, $2, $3, $4, $5, $6, $7)
         RETURNING id, nombre_original, mime_type, tamano, creado_en`,
        [id, file.originalname, file.filename, file.mimetype, file.size, file.path, req.user.id]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${inserted.length} PDF(s) subido(s)`,
      archivos: inserted
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/conocimiento/articulos/:articleId/pdfs/:fileId - Delete a PDF
router.delete('/articulos/:articleId/pdfs/:fileId', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
  try {
    const { articleId, fileId } = req.params;

    const result = await pool.query(
      `DELETE FROM archivos WHERE id = $1 AND entidad_tipo = 'articulo' AND entidad_id = $2 RETURNING ruta, nombre_original`,
      [fileId, articleId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Archivo no encontrado', 404);
    }

    // Delete physical file
    const filePath = result.rows[0].ruta;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      logger.warn(`Could not delete physical file: ${filePath}`);
    }

    res.json({ message: 'Archivo eliminado' });
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

// POST /api/conocimiento/categorias - Create category
router.post('/categorias', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
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

// PUT /api/conocimiento/categorias/:id - Update category
router.put('/categorias/:id', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
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

// DELETE /api/conocimiento/categorias/:id - Delete category
router.delete('/categorias/:id', authenticate, authorize('admin', 'nuevas_tecnologias', 'coordinador_nt', 'coordinador_ti'), async (req, res, next) => {
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
