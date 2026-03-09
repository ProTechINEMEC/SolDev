const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../config/database');
const { AppError } = require('./errorHandler');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Check if session is still valid in database
    const sessionResult = await pool.query(
      'SELECT * FROM sesiones WHERE token = $1 AND activa = true AND expira_en > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      throw new AppError('Sesión inválida o expirada', 401);
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, nombre, rol, activo, contratos FROM usuarios WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].activo) {
      throw new AppError('Usuario no encontrado o inactivo', 401);
    }

    // Attach user to request
    const userData = userResult.rows[0];
    // Parse contratos JSONB to JS array
    if (typeof userData.contratos === 'string') {
      try { userData.contratos = JSON.parse(userData.contratos); } catch { userData.contratos = []; }
    }
    if (!Array.isArray(userData.contratos)) userData.contratos = [];
    req.user = userData;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new AppError('Token inválido o expirado', 401));
    } else {
      next(error);
    }
  }
};

// Check if user has required role(s)
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('No autenticado', 401));
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return next(new AppError('No tiene permisos para esta acción', 403));
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwtSecret);

    const userResult = await pool.query(
      'SELECT id, email, nombre, rol, activo, contratos FROM usuarios WHERE id = $1 AND activo = true',
      [decoded.userId]
    );

    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
      req.token = token;
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
