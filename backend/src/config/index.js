require('dotenv').config();

module.exports = {
  // Server
  port: parseInt(process.env.PORT, 10) || 11001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://soldev_user:soldev_secure_2024@localhost:11002/soldev_db',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:11003',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'soldev_jwt_secret_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // Email
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@inemec.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Portal INEMEC'
  },

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:11000',

  // File uploads
  uploads: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ]
  },

  // Verification codes
  verification: {
    codeLength: 6,
    expiresIn: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 3
  }
};
