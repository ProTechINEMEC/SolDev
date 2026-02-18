const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/transferencias/:tipo/:id - Get transfer info for an entity
router.get('/:tipo/:id', authenticate, async (req, res, next) => {
  try {
    const { tipo, id } = req.params;

    if (!['ticket', 'solicitud'].includes(tipo)) {
      throw new AppError('Tipo de entidad inválido', 400);
    }

    // Find transfer as origin
    const asOrigenResult = await pool.query(
      `SELECT t.*,
              u.nombre as usuario_nombre
       FROM transferencias t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.origen_tipo = $1 AND t.origen_id = $2
       ORDER BY t.creado_en DESC`,
      [tipo, id]
    );

    // Find transfer as destination
    const asDestinoResult = await pool.query(
      `SELECT t.*,
              u.nombre as usuario_nombre
       FROM transferencias t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.destino_tipo = $1 AND t.destino_id = $2
       ORDER BY t.creado_en DESC`,
      [tipo, id]
    );

    res.json({
      entidad: { tipo, id: parseInt(id, 10) },
      transferencias_como_origen: asOrigenResult.rows,
      transferencias_como_destino: asDestinoResult.rows,
      es_transferido: asOrigenResult.rows.length > 0 || asDestinoResult.rows.length > 0
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/transferencias/codigo/:codigo - Get transfer info by code
router.get('/codigo/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const upperCodigo = codigo.toUpperCase();

    // Search in both origin and destination codes
    const result = await pool.query(
      `SELECT t.*,
              u.nombre as usuario_nombre
       FROM transferencias t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.origen_codigo = $1 OR t.destino_codigo = $1
       ORDER BY t.creado_en DESC`,
      [upperCodigo]
    );

    if (result.rows.length === 0) {
      res.json({
        codigo: upperCodigo,
        transferencia: null,
        mensaje: null
      });
      return;
    }

    const transfer = result.rows[0];
    let mensaje = '';
    let codigoRelacionado = '';

    if (transfer.origen_codigo === upperCodigo) {
      // The code is the origin - show destination
      codigoRelacionado = transfer.destino_codigo;
      if (transfer.tipo === 'ticket_a_solicitud') {
        mensaje = `Este ticket fue transferido a Nuevas Tecnologías. Nuevo código: ${codigoRelacionado}`;
      } else {
        mensaje = `Esta solicitud fue transferida a TI. Nuevo código: ${codigoRelacionado}`;
      }
    } else {
      // The code is the destination - show origin
      codigoRelacionado = transfer.origen_codigo;
      if (transfer.tipo === 'ticket_a_solicitud') {
        mensaje = `Esta solicitud fue creada a partir del ticket ${codigoRelacionado}`;
      } else {
        mensaje = `Este ticket fue creado a partir de la solicitud ${codigoRelacionado}`;
      }
    }

    res.json({
      codigo: upperCodigo,
      transferencia: transfer,
      codigo_relacionado: codigoRelacionado,
      mensaje
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/transferencias - List all transfers (admin)
router.get('/', authenticate, authorize('nuevas_tecnologias', 'ti', 'gerencia'), async (req, res, next) => {
  try {
    const { tipo, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT t.*,
             u.nombre as usuario_nombre
      FROM transferencias t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (tipo) {
      query += ` AND t.tipo = $${paramIndex++}`;
      params.push(tipo);
    }

    // Count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY t.creado_en DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      transferencias: result.rows,
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

module.exports = router;
