const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createUsuarioSchema = Joi.object({
  email: Joi.string().email().required(),
  nombre: Joi.string().min(2).max(100).required(),
  password: Joi.string().min(8).required(),
  rol: Joi.string().valid('nuevas_tecnologias', 'ti', 'gerencia').required()
});

const updateUsuarioSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  rol: Joi.string().valid('nuevas_tecnologias', 'ti', 'gerencia').optional(),
  activo: Joi.boolean().optional()
});

// GET /api/usuarios - List users
router.get('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { rol, activo, search } = req.query;

    let query = `
      SELECT id, email, nombre, rol, activo, creado_en, ultimo_acceso
      FROM usuarios WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (rol) {
      query += ` AND rol = $${paramIndex++}`;
      params.push(rol);
    }

    if (activo !== undefined) {
      query += ` AND activo = $${paramIndex++}`;
      params.push(activo === 'true');
    }

    if (search) {
      query += ` AND (nombre ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY nombre';

    const result = await pool.query(query, params);

    res.json({ usuarios: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/usuarios/:id - Get single user
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Users can only see themselves, NT can see everyone
    if (req.user.rol !== 'nuevas_tecnologias' && req.user.id !== parseInt(id, 10)) {
      throw new AppError('No tiene permisos para ver este usuario', 403);
    }

    const result = await pool.query(
      `SELECT id, email, nombre, rol, activo, creado_en, ultimo_acceso
       FROM usuarios WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    res.json({ usuario: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/usuarios - Create user
router.post('/', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { error, value } = createUsuarioSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    // Check if email exists
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [value.email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      throw new AppError('El email ya está registrado', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 12);

    const result = await pool.query(
      `INSERT INTO usuarios (email, nombre, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, nombre, rol, activo, creado_en`,
      [value.email.toLowerCase(), value.nombre, passwordHash, value.rol]
    );

    logger.info(`New user created: ${value.email} with role ${value.rol}`);

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/usuarios/:id - Update user
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only NT can update other users
    if (req.user.rol !== 'nuevas_tecnologias' && req.user.id !== parseInt(id, 10)) {
      throw new AppError('No tiene permisos para actualizar este usuario', 403);
    }

    // Non-NT users can only update their own name and password
    let schema = updateUsuarioSchema;
    if (req.user.rol !== 'nuevas_tecnologias') {
      schema = Joi.object({
        nombre: Joi.string().min(2).max(100).optional(),
        password: Joi.string().min(8).optional()
      });
    }

    const { error, value } = schema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (value.nombre) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(value.nombre);
    }

    if (value.email) {
      // Check if email is taken
      const existing = await pool.query(
        'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
        [value.email.toLowerCase(), id]
      );
      if (existing.rows.length > 0) {
        throw new AppError('El email ya está registrado', 409);
      }
      updates.push(`email = $${paramIndex++}`);
      params.push(value.email.toLowerCase());
    }

    if (value.password) {
      const passwordHash = await bcrypt.hash(value.password, 12);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(passwordHash);
    }

    if (value.rol !== undefined && req.user.rol === 'nuevas_tecnologias') {
      updates.push(`rol = $${paramIndex++}`);
      params.push(value.rol);
    }

    if (value.activo !== undefined && req.user.rol === 'nuevas_tecnologias') {
      updates.push(`activo = $${paramIndex++}`);
      params.push(value.activo);
    }

    if (updates.length === 0) {
      throw new AppError('No hay campos para actualizar', 400);
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, nombre, rol, activo`,
      params
    );

    if (result.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    logger.info(`User updated: ${result.rows[0].email}`);

    res.json({
      message: 'Usuario actualizado',
      usuario: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/usuarios/:id - Deactivate user
router.delete('/:id', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Can't deactivate yourself
    if (req.user.id === parseInt(id, 10)) {
      throw new AppError('No puede desactivar su propia cuenta', 400);
    }

    const result = await pool.query(
      `UPDATE usuarios SET activo = false WHERE id = $1 RETURNING email`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // Invalidate all sessions
    await pool.query(
      'UPDATE sesiones SET activa = false WHERE usuario_id = $1',
      [id]
    );

    logger.info(`User deactivated: ${result.rows[0].email}`);

    res.json({ message: 'Usuario desactivado' });
  } catch (error) {
    next(error);
  }
});

// GET /api/usuarios/rol/:rol - Get users by role
router.get('/rol/:rol', authenticate, async (req, res, next) => {
  try {
    const { rol } = req.params;

    const validRoles = ['nuevas_tecnologias', 'ti', 'gerencia'];
    if (!validRoles.includes(rol)) {
      throw new AppError('Rol inválido', 400);
    }

    const result = await pool.query(
      `SELECT id, nombre, email FROM usuarios WHERE rol = $1 AND activo = true ORDER BY nombre`,
      [rol]
    );

    res.json({ usuarios: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
