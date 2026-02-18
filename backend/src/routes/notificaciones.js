/**
 * Notificaciones Routes
 * Endpoints for managing user notifications
 */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notificaciones - List user notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, unread } = req.query;

    let whereClause = 'WHERE usuario_id = $1';
    const params = [req.user.id];

    if (unread === 'true') {
      whereClause += ' AND leida = false';
    }

    const result = await pool.query(`
      SELECT id, tipo, titulo, mensaje, datos, leida, creado_en
      FROM notificaciones
      ${whereClause}
      ORDER BY creado_en DESC
      LIMIT $2 OFFSET $3
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get unread count
    const unreadCount = await pool.query(
      'SELECT COUNT(*) FROM notificaciones WHERE usuario_id = $1 AND leida = false',
      [req.user.id]
    );

    res.json({
      notificaciones: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count, 10),
      total: result.rowCount
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notificaciones/:id/leer - Mark notification as read
router.put('/:id/leer', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notificaciones
       SET leida = true, leida_en = NOW()
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notificacion no encontrada' });
    }

    res.json({ message: 'Notificacion marcada como leida', notificacion: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notificaciones/leer-todas - Mark all as read
router.put('/leer-todas', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notificaciones
       SET leida = true, leida_en = NOW()
       WHERE usuario_id = $1 AND leida = false`,
      [req.user.id]
    );

    res.json({
      message: 'Todas las notificaciones marcadas como leidas',
      count: result.rowCount
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notificaciones/:id - Delete a notification
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM notificaciones WHERE id = $1 AND usuario_id = $2',
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notificacion no encontrada' });
    }

    res.json({ message: 'Notificacion eliminada' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
