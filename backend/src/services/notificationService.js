/**
 * Notification Service
 * Coordinates email and in-app notifications on status changes
 */

const { pool } = require('../config/database');
const emailService = require('./email');
const logger = require('../utils/logger');

// WebSocket service reference (set after initialization)
let websocketService = null;

const notificationService = {
  // Set websocket service reference
  setWebsocketService(ws) {
    websocketService = ws;
  },

  /**
   * Create in-app notification for a user
   */
  async createNotification(usuarioId, tipo, titulo, mensaje, datos = {}) {
    try {
      const result = await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [usuarioId, tipo, titulo, mensaje, JSON.stringify(datos)]
      );

      const notification = result.rows[0];

      // Send real-time notification if websocket is available
      if (websocketService) {
        websocketService.notifyUser(usuarioId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
    }
  },

  /**
   * Notify all users with a specific role
   */
  async notifyByRole(rol, tipo, titulo, mensaje, datos = {}) {
    try {
      const result = await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, $2, $3, $4, $5
         FROM usuarios WHERE rol = $1 AND activo = true
         RETURNING *`,
        [rol, tipo, titulo, mensaje, JSON.stringify(datos)]
      );

      // Send real-time notifications
      if (websocketService) {
        websocketService.notifyRole(rol, {
          tipo,
          titulo,
          mensaje,
          datos
        });
      }

      return result.rows;
    } catch (error) {
      logger.error('Error notifying by role:', error);
    }
  },

  /**
   * Handle solicitud status change - send email and in-app notifications
   */
  async onSolicitudStatusChange(solicitudId, estadoAnterior, nuevoEstado, usuarioId, comentario = null) {
    try {
      // Get solicitud with requester info
      const result = await pool.query(`
        SELECT s.*, sol.email as solicitante_email, sol.nombre as solicitante_nombre
        FROM solicitudes s
        LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
        WHERE s.id = $1
      `, [solicitudId]);

      if (result.rows.length === 0) return;
      const solicitud = result.rows[0];

      const solicitanteEmail = solicitud.solicitante_email || solicitud.datos_solicitante?.email;
      const solicitanteNombre = solicitud.solicitante_nombre || solicitud.datos_solicitante?.nombre || 'Solicitante';

      // Send email to requester on significant status changes
      if (solicitanteEmail) {
        const estadosNotificar = ['pendiente_aprobacion_gerencia', 'aprobado', 'rechazado_gerencia', 'descartado_nt', 'en_desarrollo', 'completado'];
        if (estadosNotificar.includes(nuevoEstado)) {
          await emailService.sendStatusChange(
            solicitanteEmail,
            solicitanteNombre,
            solicitud.codigo,
            solicitud.titulo,
            estadoAnterior,
            nuevoEstado,
            comentario
          );
        }
      }

      // Notify gerencia when solicitud needs approval
      if (nuevoEstado === 'pendiente_aprobacion_gerencia') {
        const gerenciaUsers = await pool.query(
          'SELECT id, email, nombre FROM usuarios WHERE rol = $1 AND activo = true',
          ['gerencia']
        );

        for (const user of gerenciaUsers.rows) {
          // In-app notification
          await this.createNotification(
            user.id,
            'solicitud_pendiente',
            `Nueva solicitud pendiente: ${solicitud.codigo}`,
            `La solicitud "${solicitud.titulo}" requiere su aprobacion`,
            { solicitud_id: solicitudId, codigo: solicitud.codigo }
          );

          // Email notification
          await emailService.sendApprovalRequest(
            user.email,
            user.nombre,
            solicitud.codigo,
            solicitud.titulo,
            solicitanteNombre,
            solicitud.datos_solicitante?.departamento
          );
        }
      }

      // Notify NT when solicitud is approved (to create project)
      if (nuevoEstado === 'aprobado') {
        await this.notifyByRole(
          'nuevas_tecnologias',
          'solicitud_aprobada',
          `Solicitud aprobada: ${solicitud.codigo}`,
          `La solicitud "${solicitud.titulo}" ha sido aprobada por Gerencia`,
          { solicitud_id: solicitudId, codigo: solicitud.codigo }
        );
      }

      // Notify NT when reevaluation is requested
      if (nuevoEstado === 'pendiente_reevaluacion') {
        await this.notifyByRole(
          'nuevas_tecnologias',
          'reevaluacion_solicitada',
          `Reevaluación solicitada: ${solicitud.codigo}`,
          `Gerencia solicita reevaluación de "${solicitud.titulo}"`,
          { solicitud_id: solicitudId, codigo: solicitud.codigo }
        );
      }

      // Notify NT when project is scheduled
      if (nuevoEstado === 'agendado') {
        await this.notifyByRole(
          'nuevas_tecnologias',
          'proyecto_agendado',
          `Proyecto agendado: ${solicitud.codigo}`,
          `El proyecto "${solicitud.titulo}" ha sido agendado`,
          {
            solicitud_id: solicitudId,
            codigo: solicitud.codigo,
            fecha_inicio: solicitud.fecha_inicio_programada,
            fecha_fin: solicitud.fecha_fin_programada
          }
        );
      }

      logger.info(`Notifications sent for solicitud ${solicitud.codigo}: ${estadoAnterior} -> ${nuevoEstado}`);
    } catch (error) {
      logger.error('Error in onSolicitudStatusChange:', error);
    }
  },

  /**
   * Handle ticket status change - send email and in-app notifications
   */
  async onTicketStatusChange(ticketId, estadoAnterior, nuevoEstado, usuarioId, resolucion = null) {
    try {
      const result = await pool.query(`
        SELECT t.*, sol.email as solicitante_email, sol.nombre as solicitante_nombre,
               u.nombre as asignado_nombre
        FROM tickets t
        LEFT JOIN solicitantes sol ON t.solicitante_id = sol.id
        LEFT JOIN usuarios u ON t.asignado_id = u.id
        WHERE t.id = $1
      `, [ticketId]);

      if (result.rows.length === 0) return;
      const ticket = result.rows[0];

      const solicitanteEmail = ticket.solicitante_email || ticket.datos_solicitante?.email;
      const solicitanteNombre = ticket.solicitante_nombre || ticket.datos_solicitante?.nombre || 'Solicitante';

      // Send email to requester when ticket is resolved or closed
      if (solicitanteEmail && ['resuelto', 'cerrado'].includes(nuevoEstado)) {
        await emailService.sendStatusChange(
          solicitanteEmail,
          solicitanteNombre,
          ticket.codigo,
          ticket.titulo,
          estadoAnterior,
          nuevoEstado,
          resolucion || ticket.resolucion
        );
      }

      // Notify NT when ticket is escalated
      if (nuevoEstado === 'escalado_nt') {
        await this.notifyByRole(
          'nuevas_tecnologias',
          'ticket_escalado',
          `Ticket escalado: ${ticket.codigo}`,
          `El ticket "${ticket.titulo}" ha sido escalado a Nuevas Tecnologias`,
          { ticket_id: ticketId, codigo: ticket.codigo }
        );
      }

      logger.info(`Notifications sent for ticket ${ticket.codigo}: ${estadoAnterior} -> ${nuevoEstado}`);
    } catch (error) {
      logger.error('Error in onTicketStatusChange:', error);
    }
  },

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(usuarioId) {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notificaciones WHERE usuario_id = $1 AND leida = false',
      [usuarioId]
    );
    return parseInt(result.rows[0].count);
  },

  /**
   * Get notifications for a user
   */
  async getNotifications(usuarioId, limit = 20) {
    const result = await pool.query(
      `SELECT * FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY creado_en DESC
       LIMIT $2`,
      [usuarioId, limit]
    );
    return result.rows;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, usuarioId) {
    await pool.query(
      `UPDATE notificaciones
       SET leida = true, leida_en = NOW()
       WHERE id = $1 AND usuario_id = $2`,
      [notificationId, usuarioId]
    );
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(usuarioId) {
    await pool.query(
      `UPDATE notificaciones
       SET leida = true, leida_en = NOW()
       WHERE usuario_id = $1 AND leida = false`,
      [usuarioId]
    );
  },

  /**
   * Handle ticket transfer to NT
   */
  async onTicketTransferToNT(ticketId, solicitudId, ticketCodigo, solicitudCodigo, motivo) {
    try {
      // Notify NT team about the new transferred solicitud
      await this.notifyByRole(
        'nuevas_tecnologias',
        'ticket_transferido',
        `Ticket transferido: ${ticketCodigo} → ${solicitudCodigo}`,
        `El ticket "${ticketCodigo}" ha sido transferido como solicitud. Motivo: ${motivo}`,
        {
          ticket_id: ticketId,
          ticket_codigo: ticketCodigo,
          solicitud_id: solicitudId,
          solicitud_codigo: solicitudCodigo
        }
      );

      logger.info(`Transfer notification sent: ${ticketCodigo} -> ${solicitudCodigo}`);
    } catch (error) {
      logger.error('Error in onTicketTransferToNT:', error);
    }
  },

  /**
   * Handle solicitud transfer to TI
   */
  async onSolicitudTransferToTI(solicitudId, ticketId, solicitudCodigo, ticketCodigo, motivo) {
    try {
      // Notify TI team about the new transferred ticket
      await this.notifyByRole(
        'ti',
        'solicitud_transferida',
        `Solicitud transferida: ${solicitudCodigo} → ${ticketCodigo}`,
        `La solicitud "${solicitudCodigo}" ha sido transferida como ticket. Motivo: ${motivo}`,
        {
          solicitud_id: solicitudId,
          solicitud_codigo: solicitudCodigo,
          ticket_id: ticketId,
          ticket_codigo: ticketCodigo
        }
      );

      logger.info(`Transfer notification sent: ${solicitudCodigo} -> ${ticketCodigo}`);
    } catch (error) {
      logger.error('Error in onSolicitudTransferToTI:', error);
    }
  },

  /**
   * Check for upcoming deadlines and send notifications
   * Called by scheduler daily
   */
  async checkUpcomingDeadlines() {
    try {
      const today = new Date();
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const oneDayFromNow = new Date(today);
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      // Check solicitudes with upcoming deadlines (fecha_fin_programada)
      const solicitudesResult = await pool.query(`
        SELECT s.id, s.codigo, s.titulo, s.fecha_fin_programada,
               s.evaluador_id
        FROM solicitudes s
        WHERE s.estado IN ('agendado', 'en_desarrollo')
          AND s.fecha_fin_programada IS NOT NULL
          AND (
            (s.fecha_fin_programada::date = $1::date) OR
            (s.fecha_fin_programada::date = $2::date)
          )
      `, [oneDayFromNow.toISOString().split('T')[0], threeDaysFromNow.toISOString().split('T')[0]]);

      for (const solicitud of solicitudesResult.rows) {
        const fechaFin = new Date(solicitud.fecha_fin_programada);
        const isOneDayAway = fechaFin.toDateString() === oneDayFromNow.toDateString();
        const tipo = isOneDayAway ? 'fecha_limite_proxima_1d' : 'fecha_limite_proxima_3d';
        const diasRestantes = isOneDayAway ? 1 : 3;

        // Notify assigned evaluator if exists
        if (solicitud.evaluador_id) {
          // Check if we already sent this notification today
          const existing = await pool.query(
            `SELECT id FROM notificaciones
             WHERE usuario_id = $1 AND tipo = $2
               AND datos->>'solicitud_id' = $3
               AND creado_en::date = CURRENT_DATE`,
            [solicitud.evaluador_id, tipo, solicitud.id.toString()]
          );

          if (existing.rows.length === 0) {
            await this.createNotification(
              solicitud.evaluador_id,
              tipo,
              `Fecha límite próxima: ${solicitud.codigo}`,
              `El proyecto "${solicitud.titulo}" vence en ${diasRestantes} día(s)`,
              { solicitud_id: solicitud.id, codigo: solicitud.codigo, dias_restantes: diasRestantes }
            );
          }
        }

        // Also notify NT team
        await this.notifyByRole(
          'nuevas_tecnologias',
          tipo,
          `Fecha límite próxima: ${solicitud.codigo}`,
          `El proyecto "${solicitud.titulo}" vence en ${diasRestantes} día(s)`,
          { solicitud_id: solicitud.id, codigo: solicitud.codigo, dias_restantes: diasRestantes }
        );
      }

      // Check projects with upcoming deadlines
      const proyectosResult = await pool.query(`
        SELECT p.id, p.codigo, p.titulo, p.fecha_fin_estimada,
               p.responsable_id
        FROM proyectos p
        WHERE p.estado IN ('en_desarrollo', 'planificacion')
          AND p.fecha_fin_estimada IS NOT NULL
          AND (
            (p.fecha_fin_estimada::date = $1::date) OR
            (p.fecha_fin_estimada::date = $2::date)
          )
      `, [oneDayFromNow.toISOString().split('T')[0], threeDaysFromNow.toISOString().split('T')[0]]);

      for (const proyecto of proyectosResult.rows) {
        const fechaFin = new Date(proyecto.fecha_fin_estimada);
        const isOneDayAway = fechaFin.toDateString() === oneDayFromNow.toDateString();
        const tipo = isOneDayAway ? 'fecha_limite_proxima_1d' : 'fecha_limite_proxima_3d';
        const diasRestantes = isOneDayAway ? 1 : 3;

        // Notify project lead
        if (proyecto.responsable_id) {
          const existing = await pool.query(
            `SELECT id FROM notificaciones
             WHERE usuario_id = $1 AND tipo = $2
               AND datos->>'proyecto_id' = $3
               AND creado_en::date = CURRENT_DATE`,
            [proyecto.responsable_id, tipo, proyecto.id.toString()]
          );

          if (existing.rows.length === 0) {
            await this.createNotification(
              proyecto.responsable_id,
              tipo,
              `Fecha límite proyecto: ${proyecto.codigo}`,
              `El proyecto "${proyecto.titulo}" vence en ${diasRestantes} día(s)`,
              { proyecto_id: proyecto.id, codigo: proyecto.codigo, dias_restantes: diasRestantes }
            );
          }
        }
      }

      logger.info(`Deadline check completed: ${solicitudesResult.rows.length} solicitudes, ${proyectosResult.rows.length} proyectos`);
    } catch (error) {
      logger.error('Error checking upcoming deadlines:', error);
    }
  }
};

module.exports = notificationService;
