const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  // Log the error
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  if (err.stack) {
    logger.error(err.stack);
  }

  // Joi validation errors
  if (err.isJoi) {
    statusCode = 400;
    message = err.details.map(d => d.message).join(', ');
  }

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        statusCode = 409;
        message = 'El registro ya existe';
        break;
      case '23503': // Foreign key violation
        statusCode = 400;
        message = 'Referencia inválida a otro registro';
        break;
      case '23502': // Not null violation
        statusCode = 400;
        message = 'Faltan campos requeridos';
        break;
      default:
        if (err.code.startsWith('22') || err.code.startsWith('23')) {
          statusCode = 400;
          message = 'Error de validación de datos';
        }
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
  }

  // Don't leak error details in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      code: err.code
    })
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
module.exports.AppError = AppError;
