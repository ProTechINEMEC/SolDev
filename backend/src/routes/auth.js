const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Joi = require('joi');
const config = require('../config');
const { pool, withTransaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('../services/email');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email inválido',
    'any.required': 'Email es requerido'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Contraseña debe tener al menos 6 caracteres',
    'any.required': 'Contraseña es requerida'
  })
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { email, password } = value;

    // Find user
    const userResult = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.activo) {
      throw new AppError('Usuario desactivado', 401);
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, rol: user.rol },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Calculate expiration
    const expiresIn = 24 * 60 * 60 * 1000; // 24 hours in ms
    const expiresAt = new Date(Date.now() + expiresIn);

    // Store session
    await pool.query(
      `INSERT INTO sesiones (usuario_id, token, expira_en, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, token, expiresAt, req.ip, req.headers['user-agent']]
    );

    // Update last login
    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info(`User ${user.email} logged in`);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Invalidate session
    await pool.query(
      'UPDATE sesiones SET activa = false WHERE token = $1',
      [req.token]
    );

    logger.info(`User ${req.user.email} logged out`);

    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        nombre: req.user.nombre,
        rol: req.user.rol
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    // Generate new token
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, rol: req.user.rol },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    const expiresIn = 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresIn);

    await withTransaction(async (client) => {
      // Invalidate old session
      await client.query(
        'UPDATE sesiones SET activa = false WHERE token = $1',
        [req.token]
      );

      // Create new session
      await client.query(
        `INSERT INTO sesiones (usuario_id, token, expira_en, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, token, expiresAt, req.ip, req.headers['user-agent']]
      );
    });

    res.json({
      message: 'Token renovado',
      token,
      expiresAt
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email es requerido', 400);
    }

    // Find user
    const userResult = await pool.query(
      'SELECT id, email, nombre FROM usuarios WHERE email = $1 AND activo = true',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return res.json({
        message: 'Si el email existe en nuestro sistema, recibira instrucciones para restablecer su contrasena'
      });
    }

    const user = userResult.rows[0];

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET usado = true WHERE usuario_id = $1 AND usado = false',
      [user.id]
    );

    // Store new token
    await pool.query(
      'INSERT INTO password_reset_tokens (usuario_id, token, expira_en) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Send email with reset link
    const resetUrl = `${config.frontendUrl}/reset-password/${token}`;
    await emailService.sendPasswordReset(user.email, user.nombre, resetUrl);

    logger.info(`Password reset requested for ${email}`);

    res.json({
      message: 'Si el email existe en nuestro sistema, recibira instrucciones para restablecer su contrasena'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError('Token y nueva contrasena son requeridos', 400);
    }

    if (password.length < 8) {
      throw new AppError('La contrasena debe tener al menos 8 caracteres', 400);
    }

    // Find valid token
    const tokenResult = await pool.query(`
      SELECT t.*, u.email, u.nombre
      FROM password_reset_tokens t
      JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.token = $1 AND t.usado = false AND t.expira_en > NOW()
    `, [token]);

    if (tokenResult.rows.length === 0) {
      throw new AppError('Token invalido o expirado', 400);
    }

    const resetToken = tokenResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    await withTransaction(async (client) => {
      // Update password
      await client.query(
        'UPDATE usuarios SET password_hash = $1, actualizado_en = NOW() WHERE id = $2',
        [passwordHash, resetToken.usuario_id]
      );

      // Mark token as used
      await client.query(
        'UPDATE password_reset_tokens SET usado = true, usado_en = NOW() WHERE id = $1',
        [resetToken.id]
      );

      // Invalidate all sessions for security
      await client.query(
        'UPDATE sesiones SET activa = false WHERE usuario_id = $1',
        [resetToken.usuario_id]
      );
    });

    logger.info(`Password reset completed for user ${resetToken.email}`);

    res.json({
      message: 'Contrasena restablecida exitosamente. Puede iniciar sesion con su nueva contrasena.'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/verify-reset-token - Verify if reset token is valid
router.get('/verify-reset-token/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await pool.query(`
      SELECT t.id, t.expira_en, u.email
      FROM password_reset_tokens t
      JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.token = $1 AND t.usado = false AND t.expira_en > NOW()
    `, [token]);

    if (result.rows.length === 0) {
      return res.json({ valid: false, message: 'Token invalido o expirado' });
    }

    res.json({
      valid: true,
      email: result.rows[0].email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
