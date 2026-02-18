/**
 * Global Search Routes
 * Search across solicitudes, proyectos, tickets, and articulos
 */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/search
 * Global search across all entities
 * Query params:
 *   - q: search term (required, min 2 chars)
 *   - type: filter by entity type (optional: solicitudes, proyectos, tickets, articulos)
 *   - limit: max results per type (default: 10)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { q, type, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ results: { solicitudes: [], proyectos: [], tickets: [], articulos: [] } });
    }

    const searchTerm = `%${q}%`;
    const maxResults = Math.min(parseInt(limit), 50); // Cap at 50

    const results = {
      solicitudes: [],
      proyectos: [],
      tickets: [],
      articulos: []
    };

    // Search solicitudes (accessible by NT and Gerencia)
    if ((!type || type === 'solicitudes') && ['nuevas_tecnologias', 'gerencia'].includes(req.user.rol)) {
      let solicitudesQuery = `
        SELECT id, codigo, titulo, tipo, estado, prioridad, creado_en,
               datos_solicitante->>'departamento' as departamento,
               'solicitud' as entidad_tipo
        FROM solicitudes
        WHERE (titulo ILIKE $1 OR codigo ILIKE $1)
      `;

      // Gerencia only sees certain states
      if (req.user.rol === 'gerencia') {
        solicitudesQuery += ` AND estado IN ('pendiente_aprobacion_gerencia', 'aprobado', 'en_desarrollo', 'completado', 'rechazado_gerencia')`;
      }

      solicitudesQuery += ` ORDER BY creado_en DESC LIMIT $2`;

      const solicitudesResult = await pool.query(solicitudesQuery, [searchTerm, maxResults]);
      results.solicitudes = solicitudesResult.rows;
    }

    // Search proyectos (accessible by NT and Gerencia)
    if ((!type || type === 'proyectos') && ['nuevas_tecnologias', 'gerencia'].includes(req.user.rol)) {
      const proyectosResult = await pool.query(`
        SELECT id, codigo, titulo, estado, progreso, creado_en,
               'proyecto' as entidad_tipo
        FROM proyectos
        WHERE titulo ILIKE $1 OR codigo ILIKE $1 OR descripcion ILIKE $1
        ORDER BY creado_en DESC
        LIMIT $2
      `, [searchTerm, maxResults]);

      results.proyectos = proyectosResult.rows;
    }

    // Search tickets (TI sees all, NT sees only escalated)
    if ((!type || type === 'tickets') && ['ti', 'nuevas_tecnologias'].includes(req.user.rol)) {
      let ticketsQuery = `
        SELECT id, codigo, titulo, categoria, estado, prioridad, creado_en,
               datos_solicitante->>'departamento' as departamento,
               'ticket' as entidad_tipo
        FROM tickets
        WHERE (titulo ILIKE $1 OR codigo ILIKE $1 OR descripcion ILIKE $1)
      `;

      // NT only sees escalated tickets
      if (req.user.rol === 'nuevas_tecnologias') {
        ticketsQuery += ` AND estado = 'escalado_nt'`;
      }

      ticketsQuery += ` ORDER BY creado_en DESC LIMIT $2`;

      const ticketsResult = await pool.query(ticketsQuery, [searchTerm, maxResults]);
      results.tickets = ticketsResult.rows;
    }

    // Search articulos (accessible by all authenticated users)
    if (!type || type === 'articulos') {
      const articulosResult = await pool.query(`
        SELECT id, slug, titulo, resumen, creado_en,
               'articulo' as entidad_tipo
        FROM conocimiento_articulos
        WHERE publicado = true
          AND (titulo ILIKE $1 OR contenido ILIKE $1 OR resumen ILIKE $1)
        ORDER BY creado_en DESC
        LIMIT $2
      `, [searchTerm, maxResults]);

      results.articulos = articulosResult.rows;
    }

    // Calculate total results
    const totalResults = results.solicitudes.length +
                         results.proyectos.length +
                         results.tickets.length +
                         results.articulos.length;

    res.json({
      query: q,
      total: totalResults,
      results
    });

  } catch (error) {
    logger.error('Search error:', error);
    next(error);
  }
});

/**
 * GET /api/search/quick
 * Quick search for autocomplete (returns fewer fields)
 */
router.get('/quick', authenticate, async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = `%${q}%`;
    const suggestions = [];

    // Quick search in solicitudes
    if (['nuevas_tecnologias', 'gerencia'].includes(req.user.rol)) {
      const solicitudes = await pool.query(`
        SELECT codigo as id, titulo as label, 'solicitud' as type
        FROM solicitudes
        WHERE titulo ILIKE $1 OR codigo ILIKE $1
        LIMIT 5
      `, [searchTerm]);
      suggestions.push(...solicitudes.rows);
    }

    // Quick search in proyectos
    if (['nuevas_tecnologias', 'gerencia'].includes(req.user.rol)) {
      const proyectos = await pool.query(`
        SELECT codigo as id, titulo as label, 'proyecto' as type
        FROM proyectos
        WHERE titulo ILIKE $1 OR codigo ILIKE $1
        LIMIT 5
      `, [searchTerm]);
      suggestions.push(...proyectos.rows);
    }

    // Quick search in articulos
    const articulos = await pool.query(`
      SELECT slug as id, titulo as label, 'articulo' as type
      FROM conocimiento_articulos
      WHERE publicado = true AND (titulo ILIKE $1)
      LIMIT 5
    `, [searchTerm]);
    suggestions.push(...articulos.rows);

    res.json({ suggestions: suggestions.slice(0, 15) });

  } catch (error) {
    logger.error('Quick search error:', error);
    next(error);
  }
});

module.exports = router;
