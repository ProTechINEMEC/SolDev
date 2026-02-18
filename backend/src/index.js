const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { pool, testConnection } = require('./config/database');
const { redisClient, connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');

// Service imports
const websocketService = require('./services/websocket');
const scheduler = require('./services/scheduler');
const notificationService = require('./services/notificationService');

// Route imports
const authRoutes = require('./routes/auth');
const verificacionRoutes = require('./routes/verificacion');
const solicitudesRoutes = require('./routes/solicitudes');
const proyectosRoutes = require('./routes/proyectos');
const ticketsRoutes = require('./routes/tickets');
const usuariosRoutes = require('./routes/usuarios');
const conocimientoRoutes = require('./routes/conocimiento');
const dashboardRoutes = require('./routes/dashboard');
const reportesRoutes = require('./routes/reportes');
const searchRoutes = require('./routes/search');
const profileRoutes = require('./routes/profile');
const exportRoutes = require('./routes/export');
const notificacionesRoutes = require('./routes/notificaciones');
const opcionesRoutes = require('./routes/opciones');
const transferenciasRoutes = require('./routes/transferencias');
const evaluacionesRoutes = require('./routes/evaluaciones');
const cronogramasRoutes = require('./routes/cronogramas');
const estimacionesRoutes = require('./routes/estimaciones');
const calendarioRoutes = require('./routes/calendario');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    config.frontendUrl,
    'http://localhost:11000',
    'http://127.0.0.1:11000',
    'http://192.168.0.200:11000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - relaxed for internal use
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 1000, // 1000 requests per minute per IP
  message: { error: 'Demasiadas solicitudes, intente de nuevo más tarde' },
  skip: (req) => {
    // Skip rate limiting for internal/local requests
    const ip = req.ip || req.connection.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip?.includes('192.168.');
  }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');

    // Check Redis
    const redisStatus = redisClient.isReady ? 'connected' : 'disconnected';

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redisStatus
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/verificacion', verificacionRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/conocimiento', conocimientoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/opciones', opcionesRoutes);
app.use('/api/transferencias', transferenciasRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/cronogramas', cronogramasRoutes);
app.use('/api/estimaciones', estimacionesRoutes);
app.use('/api/calendario', calendarioRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Portal de Gestión INEMEC - API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      verificacion: '/api/verificacion',
      solicitudes: '/api/solicitudes',
      proyectos: '/api/proyectos',
      tickets: '/api/tickets',
      usuarios: '/api/usuarios',
      conocimiento: '/api/conocimiento',
      dashboard: '/api/dashboard',
      reportes: '/api/reportes',
      search: '/api/search',
      profile: '/api/profile',
      export: '/api/export',
      notificaciones: '/api/notificaciones',
      opciones: '/api/opciones',
      transferencias: '/api/transferencias'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use(errorHandler);

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    logger.info('Database connection established');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connection established');

    // Initialize WebSocket server
    websocketService.initialize(server);
    logger.info('WebSocket server initialized');

    // Connect notification service to websocket
    notificationService.setWebsocketService(websocketService);
    logger.info('Notification service connected to WebSocket');

    // Start scheduler for automated tasks
    scheduler.start();
    logger.info('Scheduler started');

    // Start HTTP server (with WebSocket support)
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`WebSocket available at ws://localhost:${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close();
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});

module.exports = { app, server };
