const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { cache } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('../services/email');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

// Generate 6-digit code
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validation schemas
const solicitarSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email inválido',
    'any.required': 'Email es requerido'
  }),
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'any.required': 'Nombre es requerido'
  })
});

const validarSchema = Joi.object({
  email: Joi.string().email().required(),
  codigo: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'Código debe tener 6 dígitos',
    'string.pattern.base': 'Código debe contener solo números'
  })
});

// POST /api/verificacion/solicitar - Request verification code
router.post('/solicitar', async (req, res, next) => {
  try {
    const { error, value } = solicitarSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { email, nombre } = value;
    const emailLower = email.toLowerCase();

    // Check for existing active code (rate limiting)
    const existingCode = await pool.query(
      `SELECT * FROM codigos_verificacion
       WHERE email = $1 AND usado = false AND expira_en > NOW()
       ORDER BY creado_en DESC LIMIT 1`,
      [emailLower]
    );

    if (existingCode.rows.length > 0) {
      const createdAt = new Date(existingCode.rows[0].creado_en);
      const now = new Date();
      const secondsSinceCreated = (now - createdAt) / 1000;

      // Allow resend after 60 seconds
      if (secondsSinceCreated < 60) {
        throw new AppError(
          `Por favor espere ${Math.ceil(60 - secondsSinceCreated)} segundos antes de solicitar otro código`,
          429
        );
      }
    }

    // Generate new code
    const codigo = generateCode();
    const expiresAt = new Date(Date.now() + config.verification.expiresIn);

    // Store code in database
    await pool.query(
      `INSERT INTO codigos_verificacion (email, nombre, codigo, expira_en)
       VALUES ($1, $2, $3, $4)`,
      [emailLower, nombre, codigo, expiresAt]
    );

    // Also store in Redis for faster verification
    await cache.set(`verification:${emailLower}`, {
      codigo,
      nombre,
      intentos: 0
    }, config.verification.expiresIn / 1000);

    // Send email
    try {
      await emailService.sendVerificationCode(emailLower, nombre, codigo);
      logger.info(`Verification code sent to ${emailLower}`);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail the request, code is still valid
    }

    res.json({
      message: 'Código de verificación enviado',
      expiresIn: config.verification.expiresIn / 1000 / 60, // minutes
      email: emailLower
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/verificacion/validar - Validate verification code
router.post('/validar', async (req, res, next) => {
  try {
    const { error, value } = validarSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { email, codigo } = value;
    const emailLower = email.toLowerCase();

    // Check cache first
    let cachedData = await cache.get(`verification:${emailLower}`);

    if (cachedData) {
      if (cachedData.intentos >= config.verification.maxAttempts) {
        throw new AppError('Demasiados intentos fallidos. Solicite un nuevo código.', 429);
      }

      if (cachedData.codigo !== codigo) {
        // Increment attempts
        cachedData.intentos++;
        await cache.set(`verification:${emailLower}`, cachedData, 900); // 15 min TTL

        throw new AppError(`Código inválido. ${config.verification.maxAttempts - cachedData.intentos} intentos restantes.`, 400);
      }
    }

    // Verify against database
    const codeResult = await pool.query(
      `SELECT * FROM codigos_verificacion
       WHERE email = $1 AND codigo = $2 AND usado = false AND expira_en > NOW()
       ORDER BY creado_en DESC LIMIT 1`,
      [emailLower, codigo]
    );

    if (codeResult.rows.length === 0) {
      // Update attempts in database too
      await pool.query(
        `UPDATE codigos_verificacion
         SET intentos = intentos + 1
         WHERE email = $1 AND usado = false AND expira_en > NOW()`,
        [emailLower]
      );
      throw new AppError('Código inválido o expirado', 400);
    }

    const codeRecord = codeResult.rows[0];

    // Mark code as used
    await pool.query(
      'UPDATE codigos_verificacion SET usado = true WHERE id = $1',
      [codeRecord.id]
    );

    // Clear cache
    await cache.del(`verification:${emailLower}`);

    // Create or update solicitante record
    const solicitanteResult = await pool.query(
      `INSERT INTO solicitantes (email, nombre, verificado)
       VALUES ($1, $2, true)
       ON CONFLICT (email)
       DO UPDATE SET nombre = $2, verificado = true, ultima_verificacion = NOW()
       RETURNING id, email, nombre`,
      [emailLower, codeRecord.nombre]
    );

    const solicitante = solicitanteResult.rows[0];

    // Generate temporary session token for form submission (valid 2 hours)
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    const sessionExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO sesiones_solicitante (solicitante_id, token, expira_en)
       VALUES ($1, $2, $3)`,
      [solicitante.id, sessionToken, sessionExpires]
    );

    logger.info(`Email verified: ${emailLower}`);

    res.json({
      message: 'Email verificado exitosamente',
      verified: true,
      solicitante: {
        id: solicitante.id,
        email: solicitante.email,
        nombre: solicitante.nombre
      },
      sessionToken,
      sessionExpires
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/verificacion/estado/:email - Check verification status
router.get('/estado/:email', async (req, res, next) => {
  try {
    const email = req.params.email.toLowerCase();

    const result = await pool.query(
      `SELECT id, email, nombre, verificado, ultima_verificacion
       FROM solicitantes WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({ verified: false, exists: false });
    }

    const solicitante = result.rows[0];

    // Check if verification is still valid (within 24 hours)
    const lastVerification = new Date(solicitante.ultima_verificacion);
    const isValid = (Date.now() - lastVerification) < 24 * 60 * 60 * 1000;

    res.json({
      verified: solicitante.verificado && isValid,
      exists: true,
      nombre: solicitante.nombre,
      lastVerification: solicitante.ultima_verificacion
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
