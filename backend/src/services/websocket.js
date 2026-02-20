/**
 * WebSocket Service
 * Real-time notifications using Socket.io
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

let io = null;
const userSockets = new Map(); // Map userId -> Set of socket IDs

const websocketService = {
  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    io = new Server(server, {
      cors: {
        origin: [
          config.frontendUrl,
          'http://localhost:11000',
          'http://127.0.0.1:11000',
          'https://tecnologia.inemec.com',
          'https://api.tecnologia.inemec.com'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        logger.warn('WebSocket connection rejected: no token');
        return next(new Error('Token de autenticacion requerido'));
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.userId = decoded.userId;
        socket.userRole = decoded.rol;
        socket.userEmail = decoded.email;
        next();
      } catch (error) {
        logger.warn('WebSocket connection rejected: invalid token');
        next(new Error('Token invalido'));
      }
    });

    // Connection handler
    io.on('connection', (socket) => {
      const { userId, userRole, userEmail } = socket;

      logger.info(`WebSocket connected: user ${userId} (${userRole})`);

      // Track user's socket connections (user can have multiple tabs/devices)
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);

      // Join rooms for targeted messaging
      socket.join(`user:${userId}`);
      socket.join(`role:${userRole}`);

      // Handle client events
      socket.on('markNotificationRead', async (notificationId) => {
        // Client can emit this to mark notification as read
        // The actual DB update should go through the REST API
        socket.emit('notificationMarked', { id: notificationId, success: true });
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`WebSocket disconnected: user ${userId} (${reason})`);

        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error for user ${userId}:`, error);
      });
    });

    logger.info('WebSocket server initialized');
    return io;
  },

  /**
   * Get the Socket.io instance
   */
  getIO() {
    return io;
  },

  /**
   * Check if a user is currently connected
   */
  isUserOnline(userId) {
    const sockets = userSockets.get(userId);
    return sockets && sockets.size > 0;
  },

  /**
   * Get count of connected users
   */
  getConnectedUsersCount() {
    return userSockets.size;
  },

  /**
   * Send notification to a specific user
   */
  notifyUser(userId, notification) {
    if (!io) {
      logger.warn('WebSocket not initialized, cannot send notification');
      return false;
    }

    io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Notification sent to user ${userId}`);
    return true;
  },

  /**
   * Send notification to all users with a specific role
   */
  notifyRole(role, notification) {
    if (!io) {
      logger.warn('WebSocket not initialized, cannot send notification');
      return false;
    }

    io.to(`role:${role}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Notification sent to role ${role}`);
    return true;
  },

  /**
   * Broadcast notification to all connected users
   */
  broadcast(notification) {
    if (!io) {
      logger.warn('WebSocket not initialized, cannot broadcast');
      return false;
    }

    io.emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    logger.debug('Notification broadcasted to all users');
    return true;
  },

  /**
   * Send event to specific user (generic event emitter)
   */
  emitToUser(userId, event, data) {
    if (!io) return false;
    io.to(`user:${userId}`).emit(event, data);
    return true;
  },

  /**
   * Send event to role (generic event emitter)
   */
  emitToRole(role, event, data) {
    if (!io) return false;
    io.to(`role:${role}`).emit(event, data);
    return true;
  }
};

module.exports = websocketService;
