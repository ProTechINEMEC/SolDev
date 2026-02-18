/**
 * User Profile Routes
 * Allows users to view and edit their own profile
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(8).required()
});

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, email, nombre, rol, creado_en, actualizado_en, ultimo_acceso
      FROM usuarios
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/profile
 * Update current user's profile (name only)
 */
router.put('/', authenticate, async (req, res, next) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    if (!value.nombre) {
      throw new AppError('No hay campos para actualizar', 400);
    }

    const result = await pool.query(`
      UPDATE usuarios
      SET nombre = $1, actualizado_en = NOW()
      WHERE id = $2
      RETURNING id, email, nombre, rol, creado_en, actualizado_en
    `, [value.nombre, req.user.id]);

    logger.info(`Profile updated for user ${req.user.email}`);

    res.json({
      message: 'Perfil actualizado exitosamente',
      profile: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/profile/password
 * Change current user's password
 */
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // Verify current password
    const validPassword = await bcrypt.compare(
      value.currentPassword,
      userResult.rows[0].password_hash
    );

    if (!validPassword) {
      throw new AppError('Contrasena actual incorrecta', 400);
    }

    // Check new password is different
    const samePassword = await bcrypt.compare(
      value.newPassword,
      userResult.rows[0].password_hash
    );

    if (samePassword) {
      throw new AppError('La nueva contrasena debe ser diferente a la actual', 400);
    }

    // Hash new password
    const newHash = await bcrypt.hash(value.newPassword, 12);

    // Update password
    await pool.query(`
      UPDATE usuarios
      SET password_hash = $1, actualizado_en = NOW()
      WHERE id = $2
    `, [newHash, req.user.id]);

    // Optionally invalidate other sessions (user will need to login again on other devices)
    // await pool.query(
    //   'UPDATE sesiones SET activa = false WHERE usuario_id = $1 AND token != $2',
    //   [req.user.id, req.token]
    // );

    logger.info(`Password changed for user ${req.user.email}`);

    res.json({ message: 'Contrasena actualizada exitosamente' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/profile/activity
 * Get user's recent activity (last actions performed)
 */
router.get('/activity', authenticate, async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const result = await pool.query(`
      SELECT id, entidad_tipo, entidad_id, accion, creado_en
      FROM historial_cambios
      WHERE usuario_id = $1
      ORDER BY creado_en DESC
      LIMIT $2
    `, [req.user.id, Math.min(parseInt(limit), 100)]);

    res.json({ activity: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/profile/sessions
 * Get user's active sessions
 */
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, ip_address, user_agent, creado_en, expira_en,
             CASE WHEN token = $2 THEN true ELSE false END as current_session
      FROM sesiones
      WHERE usuario_id = $1 AND activa = true AND expira_en > NOW()
      ORDER BY creado_en DESC
    `, [req.user.id, req.token]);

    res.json({ sessions: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/profile/sessions/:id
 * Invalidate a specific session (logout from device)
 */
router.delete('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Ensure user can only delete their own sessions
    const result = await pool.query(`
      UPDATE sesiones
      SET activa = false
      WHERE id = $1 AND usuario_id = $2
      RETURNING id
    `, [id, req.user.id]);

    if (result.rows.length === 0) {
      throw new AppError('Sesion no encontrada', 404);
    }

    res.json({ message: 'Sesion cerrada exitosamente' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
